/* ==========================================================================
   Demandable Web — Analytics Module (GA4)
   --------------------------------------------------------------------------
   Privacy-first Google Analytics 4 instrumentation for a single-page app.

   Why this file exists:
   Demandable Web is an SPA — navigation swaps .page-section elements without
   a document reload, so the default GA4 snippet only ever records one page
   view. This module sends explicit virtual page_view hits on every in-app
   navigation, plus custom events for podcasts, downloads, CTAs and forms.

   Configuration lives in window.DW_ANALYTICS (see the admin section) and is
   persisted to localStorage so the Measurement ID can be changed without a
   redeploy.
   ========================================================================== */

(function () {
  'use strict';

  var STORAGE_KEY = 'dw_analytics_config';
  var CONSENT_KEY = 'dw_analytics_consent';

  /* ----------------------------------------------------------------------
     Configuration
     ---------------------------------------------------------------------- */

  var defaults = {
    measurementId: '',      // e.g. 'G-XXXXXXXXXX'
    enabled: true,          // master on/off switch
    anonymizeIp: true,      // truncate IP addresses
    trackScrollDepth: true,
    trackOutboundLinks: true,
    trackPodcasts: true,
    debug: false            // logs every hit to the console
  };

  function readStored() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  }

  function persist(cfg) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
      return true;
    } catch (err) {
      return false;
    }
  }

  // Precedence: stored admin settings > inline page config > defaults.
  var inline = window.DW_ANALYTICS || {};
  var config = {};
  Object.keys(defaults).forEach(function (k) { config[k] = defaults[k]; });
  Object.keys(inline).forEach(function (k) { config[k] = inline[k]; });
  var stored = readStored();
  Object.keys(stored).forEach(function (k) { config[k] = stored[k]; });

  var VALID_ID = /^G-[A-Z0-9]{6,}$/i;

  function log() {
    if (!config.debug) return;
    var args = ['[DW Analytics]'].concat([].slice.call(arguments));
    if (window.console && window.console.log) {
      window.console.log.apply(window.console, args);
    }
  }

  /* ----------------------------------------------------------------------
     Consent (GA4 Consent Mode v2)
     ---------------------------------------------------------------------- */

  function getConsent() {
    try { return window.localStorage.getItem(CONSENT_KEY); }
    catch (err) { return null; }
  }

  function setConsent(state) {
    try { window.localStorage.setItem(CONSENT_KEY, state); } catch (err) {}
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: state === 'granted' ? 'granted' : 'denied'
      });
    }
    log('consent', state);
  }

  /* ----------------------------------------------------------------------
     Loader
     ---------------------------------------------------------------------- */

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  var loaded = false;
  var queue = [];

  function isLive() {
    return loaded && config.enabled && VALID_ID.test(config.measurementId);
  }

  function load() {
    if (loaded) return;
    if (!config.enabled) { log('disabled — not loading'); return; }
    if (!VALID_ID.test(config.measurementId)) {
      log('no valid Measurement ID — running in queue-only mode');
      return;
    }

    // Default consent posture before any user choice is recorded.
    gtag('consent', 'default', {
      analytics_storage: getConsent() === 'granted' ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500
    });

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' +
            encodeURIComponent(config.measurementId);
    s.onerror = function () { log('gtag.js failed to load (blocked?)'); };
    document.head.appendChild(s);

    gtag('js', new Date());
    gtag('config', config.measurementId, {
      anonymize_ip: !!config.anonymizeIp,
      send_page_view: false,          // we send virtual views ourselves
      transport_type: 'beacon'
    });

    loaded = true;
    log('loaded', config.measurementId);

    // Flush anything captured before the tag was ready.
    while (queue.length) {
      var item = queue.shift();
      window.gtag('event', item.name, item.params);
      log('flushed', item.name, item.params);
    }
  }

  /* ----------------------------------------------------------------------
     Event helpers
     ---------------------------------------------------------------------- */

  function track(name, params) {
    params = params || {};
    if (!config.enabled) return;
    if (!isLive()) {
      if (queue.length < 50) queue.push({ name: name, params: params });
      log('queued', name, params);
      return;
    }
    window.gtag('event', name, params);
    log('event', name, params);
  }

  // Friendly titles so GA4 reports read like real pages instead of slugs.
  var PAGE_TITLES = {
    'home': 'Home',
    'core-features': 'Core Edition — Features',
    'core-benefits': 'Core Edition — Benefits',
    'core-license': 'Core Edition — Licensing',
    'faqs': 'FAQs',
    'download': 'Downloads',
    'about': 'About Demandable Web',
    'other-versions': 'Other Versions',
    'methodology': 'Methodology',
    'about-security': 'Security',
    'about-modus-logic': 'About Modus-Logic',
    'reach-out': 'Reach Out',
    'privacy': 'Privacy Policy',
    'legal': 'Legal',
    'partners': 'Partners',
    'accessibility': 'Accessibility'
  };

  var lastPath = null;

  function trackPageView(pageId, anchorId) {
    var id = pageId || 'home';
    var path = '/' + (id === 'home' ? '' : id) + (anchorId ? '#' + anchorId : '');
    if (path === lastPath) return;   // guard against double-fires
    lastPath = path;

    var title = PAGE_TITLES[id] || id;
    if (anchorId) title += ' — ' + anchorId;

    track('page_view', {
      page_title: title,
      page_path: path,
      page_location: window.location.origin + path,
      page_referrer: document.referrer || undefined,
      section_id: id
    });
  }

  /* ----------------------------------------------------------------------
     Automatic instrumentation
     ---------------------------------------------------------------------- */

  function instrumentPodcasts() {
    if (!config.trackPodcasts) return;

    document.querySelectorAll('.podcast-card').forEach(function (card, i) {
      var audio = card.querySelector('audio');
      var titleEl = card.querySelector('.podcast-title');
      var title = titleEl ? titleEl.textContent.trim() : 'Episode ' + (i + 1);
      if (!audio) return;

      var milestones = { 25: false, 50: false, 75: false, 90: false };
      var started = false;

      audio.addEventListener('play', function () {
        if (!started) {
          started = true;
          track('podcast_start', {
            episode_title: title,
            episode_number: i + 1,
            file_name: (audio.currentSrc || '').split('/').pop()
          });
        } else {
          track('podcast_resume', { episode_title: title, episode_number: i + 1 });
        }
      });

      audio.addEventListener('pause', function () {
        if (audio.ended) return;
        track('podcast_pause', {
          episode_title: title,
          episode_number: i + 1,
          playback_seconds: Math.round(audio.currentTime)
        });
      });

      audio.addEventListener('timeupdate', function () {
        if (!audio.duration || isNaN(audio.duration)) return;
        var pct = (audio.currentTime / audio.duration) * 100;
        Object.keys(milestones).forEach(function (m) {
          if (!milestones[m] && pct >= Number(m)) {
            milestones[m] = true;
            track('podcast_progress', {
              episode_title: title,
              episode_number: i + 1,
              percent_played: Number(m)
            });
          }
        });
      });

      audio.addEventListener('ended', function () {
        track('podcast_complete', { episode_title: title, episode_number: i + 1 });
      });
    });

    // "Open in Your Player" / "Download M4A"
    document.querySelectorAll('.podcast-link').forEach(function (link) {
      link.addEventListener('click', function () {
        var card = link.closest('.podcast-card');
        var titleEl = card ? card.querySelector('.podcast-title') : null;
        var isDownload = link.hasAttribute('download');
        track(isDownload ? 'podcast_download' : 'podcast_open_external', {
          episode_title: titleEl ? titleEl.textContent.trim() : 'unknown',
          file_name: (link.getAttribute('href') || '').split('/').pop(),
          link_text: link.textContent.trim()
        });
      });
    });
  }

  function instrumentOutboundAndFiles() {
    if (!config.trackOutboundLinks) return;

    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      if (a.classList.contains('podcast-link')) return; // already handled
      var href = a.getAttribute('href') || '';
      if (!href || href === '#' || href.charAt(0) === '#') return;

      // File downloads
      if (/\.(pdf|zip|m4a|mp3|docx?|xlsx?|csv|png|jpe?g|svg)$/i.test(href)) {
        track('file_download', {
          file_name: href.split('/').pop(),
          file_extension: (href.split('.').pop() || '').toLowerCase(),
          link_text: a.textContent.trim().slice(0, 100)
        });
        return;
      }

      // Outbound links
      if (/^https?:\/\//i.test(href) && a.hostname !== window.location.hostname) {
        track('click_outbound', {
          link_domain: a.hostname,
          link_url: href,
          link_text: a.textContent.trim().slice(0, 100)
        });
      }
    }, true);
  }

  function instrumentCTAsAndForm() {
    document.querySelectorAll('.carousel-cta a, .dw-btn-primary, .dw-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        track('cta_click', {
          cta_text: btn.textContent.trim().slice(0, 100),
          cta_target: btn.dataset.page || btn.getAttribute('href') || 'unknown',
          location_section: (btn.closest('.page-section') || {}).id || 'home'
        });
      });
    });

    var form = document.getElementById('contact-form');
    if (form) {
      var startedForm = false;
      form.addEventListener('focusin', function () {
        if (startedForm) return;
        startedForm = true;
        track('form_start', { form_id: 'contact-form' });
      });
      form.addEventListener('submit', function () {
        var subject = form.querySelector('#contact-subject');
        track('form_submit', {
          form_id: 'contact-form',
          subject: subject ? subject.value : 'unspecified'
        });
      });
    }

    // FAQ engagement
    document.querySelectorAll('.faq-question').forEach(function (q) {
      q.addEventListener('click', function () {
        if (q.getAttribute('aria-expanded') === 'true') return; // closing
        var label = q.querySelector('span');
        track('faq_open', {
          question: (label ? label.textContent : q.textContent).trim().slice(0, 150)
        });
      });
    });
  }

  function instrumentScrollDepth() {
    if (!config.trackScrollDepth) return;
    var fired = { 25: false, 50: false, 75: false, 90: false };
    var ticking = false;

    function check() {
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) { ticking = false; return; }
      var pct = (window.scrollY / scrollable) * 100;
      Object.keys(fired).forEach(function (m) {
        if (!fired[m] && pct >= Number(m)) {
          fired[m] = true;
          track('scroll_depth', { percent_scrolled: Number(m), section_id: lastPath || '/' });
        }
      });
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(check);
    }, { passive: true });
  }

  /* ----------------------------------------------------------------------
     Public API
     ---------------------------------------------------------------------- */

  var api = {
    config: function () {
      var copy = {};
      Object.keys(config).forEach(function (k) { copy[k] = config[k]; });
      return copy;
    },
    status: function () {
      return {
        loaded: loaded,
        live: isLive(),
        enabled: !!config.enabled,
        measurementId: config.measurementId || '(not set)',
        validId: VALID_ID.test(config.measurementId),
        consent: getConsent() || 'not set',
        queued: queue.length
      };
    },
    save: function (partial) {
      Object.keys(partial || {}).forEach(function (k) {
        if (k in defaults) config[k] = partial[k];
      });
      var toStore = {};
      Object.keys(defaults).forEach(function (k) { toStore[k] = config[k]; });
      persist(toStore);
      log('config saved', toStore);
      if (!loaded) load();
      return api.status();
    },
    reset: function () {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch (err) {}
      log('config reset');
    },
    grantConsent: function () { setConsent('granted'); if (!loaded) load(); },
    denyConsent: function () { setConsent('denied'); },
    track: track,
    trackPageView: trackPageView,
    isValidId: function (id) { return VALID_ID.test(id || ''); },
    testEvent: function () {
      track('dw_admin_test', { source: 'admin_panel', ts: Date.now() });
      return api.status();
    }
  };

  window.DWAnalytics = api;

  /* ----------------------------------------------------------------------
     Boot
     ---------------------------------------------------------------------- */

  function boot() {
    load();
    instrumentPodcasts();
    instrumentOutboundAndFiles();
    instrumentCTAsAndForm();
    instrumentScrollDepth();
    // Initial view — app.js also calls trackPageView on every navigation.
    trackPageView('home');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
