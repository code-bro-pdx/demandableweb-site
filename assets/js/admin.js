/* ==========================================================================
   Demandable Web — Admin console controller
   --------------------------------------------------------------------------
   Drives the Admin & Analytics section: passphrase gate, GA4 configuration
   form, consent controls and live status readout.

   Security note: the gate is a client-side convenience only. Anything shipped
   to the browser is readable by the visitor, so this deters casual access but
   is not an authorization boundary. Never place secrets in this page.
   ========================================================================== */

(function () {
  'use strict';

  // FNV-1a — small, dependency-free digest so the passphrase is not shipped
  // as plain text in the bundle.
  function digest(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16);
  }

  // Digest of the default passphrase: "demandable-admin"
  // Change this by running digest('your-new-passphrase') in the console.
  var PASS_DIGEST = 'fb6955a4';
  var UNLOCK_KEY = 'dw_admin_unlocked';

  function $(id) { return document.getElementById(id); }

  function setMsg(el, text, kind) {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'admin-msg' + (kind ? ' is-' + kind : '');
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    var gate = $('admin-gate');
    var consoleEl = $('admin-console');
    if (!gate || !consoleEl) return;   // admin section not on this page

    var A = window.DWAnalytics;

    /* ------------------------------------------------------------------
       Gate
       ------------------------------------------------------------------ */

    function unlock(remember) {
      gate.hidden = true;
      consoleEl.hidden = false;
      if (remember) {
        try { sessionStorage.setItem(UNLOCK_KEY, '1'); } catch (err) {}
      }
      loadConfigIntoForm();
      refreshStatus();
    }

    function lock() {
      consoleEl.hidden = true;
      gate.hidden = false;
      try { sessionStorage.removeItem(UNLOCK_KEY); } catch (err) {}
      var pass = $('admin-pass');
      if (pass) pass.value = '';
      setMsg($('admin-gate-msg'), '');
    }

    try {
      if (sessionStorage.getItem(UNLOCK_KEY) === '1') unlock(false);
    } catch (err) {}

    var loginForm = $('admin-login');
    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = $('admin-pass');
        var value = input ? input.value.trim() : '';
        if (!value) {
          setMsg($('admin-gate-msg'), 'Enter the administrator passphrase.', 'err');
          return;
        }
        if (digest(value) === PASS_DIGEST) {
          setMsg($('admin-gate-msg'), 'Unlocked.', 'ok');
          unlock(true);
        } else {
          setMsg($('admin-gate-msg'), 'Incorrect passphrase.', 'err');
          if (input) { input.value = ''; input.focus(); }
        }
      });
    }

    var lockBtn = $('btn-lock');
    if (lockBtn) lockBtn.addEventListener('click', lock);

    /* ------------------------------------------------------------------
       Status
       ------------------------------------------------------------------ */

    function refreshStatus() {
      var pill = $('admin-status-pill');

      if (!A) {
        if (pill) { pill.textContent = 'Module missing'; pill.className = 'admin-pill is-off'; }
        return;
      }

      var s = A.status();
      var set = function (id, val) { var el = $(id); if (el) el.textContent = val; };

      set('st-mid', s.measurementId);
      set('st-loaded', s.loaded ? 'Yes' : 'No');
      set('st-live', s.live ? 'Yes' : 'No');
      set('st-consent', s.consent);
      set('st-queued', String(s.queued));
      set('st-path', window.location.pathname + (window.location.hash || ''));

      if (pill) {
        if (!s.enabled) {
          pill.textContent = 'Disabled';
          pill.className = 'admin-pill is-off';
        } else if (s.live) {
          pill.textContent = 'Collecting';
          pill.className = 'admin-pill is-live';
        } else if (!s.validId) {
          pill.textContent = 'ID required';
          pill.className = 'admin-pill is-warn';
        } else {
          pill.textContent = 'Awaiting consent';
          pill.className = 'admin-pill is-warn';
        }
      }
    }

    var refreshBtn = $('btn-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        refreshStatus();
        setMsg($('admin-test-msg'), 'Status refreshed.', 'info');
      });
    }

    /* ------------------------------------------------------------------
       Configuration form
       ------------------------------------------------------------------ */

    function loadConfigIntoForm() {
      if (!A) return;
      var c = A.config();
      var setChecked = function (id, val) { var el = $(id); if (el) el.checked = !!val; };
      var mid = $('cfg-mid');
      if (mid) mid.value = c.measurementId || '';
      setChecked('cfg-enabled', c.enabled);
      setChecked('cfg-anon', c.anonymizeIp);
      setChecked('cfg-podcasts', c.trackPodcasts);
      setChecked('cfg-scroll', c.trackScrollDepth);
      setChecked('cfg-outbound', c.trackOutboundLinks);
      setChecked('cfg-debug', c.debug);
      validateId();
    }

    function validateId() {
      var input = $('cfg-mid');
      var hint = $('mid-hint');
      if (!input || !hint || !A) return true;
      var val = input.value.trim();

      if (!val) {
        input.className = '';
        hint.className = 'admin-hint';
        hint.textContent = 'Format: G- followed by at least 6 letters or digits.';
        return true;   // empty is allowed (analytics simply stays idle)
      }
      if (A.isValidId(val)) {
        input.className = 'is-valid';
        hint.className = 'admin-hint is-valid';
        hint.textContent = 'Valid Measurement ID format.';
        return true;
      }
      input.className = 'is-invalid';
      hint.className = 'admin-hint is-invalid';
      hint.textContent = 'Expected G-XXXXXXXXXX (G- plus at least 6 letters or digits).';
      return false;
    }

    var midInput = $('cfg-mid');
    if (midInput) midInput.addEventListener('input', validateId);

    var gaForm = $('admin-ga-form');
    if (gaForm) {
      gaForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!A) {
          setMsg($('admin-save-msg'), 'Analytics module is not loaded.', 'err');
          return;
        }
        if (!validateId()) {
          setMsg($('admin-save-msg'), 'Fix the Measurement ID before saving.', 'err');
          return;
        }
        var val = function (id) { var el = $(id); return el ? el.checked : false; };
        var s = A.save({
          measurementId: (midInput ? midInput.value.trim() : ''),
          enabled: val('cfg-enabled'),
          anonymizeIp: val('cfg-anon'),
          trackPodcasts: val('cfg-podcasts'),
          trackScrollDepth: val('cfg-scroll'),
          trackOutboundLinks: val('cfg-outbound'),
          debug: val('cfg-debug')
        });
        refreshStatus();
        if (s.live) {
          setMsg($('admin-save-msg'), 'Saved. Analytics is collecting for ' + s.measurementId + '.', 'ok');
        } else if (!s.enabled) {
          setMsg($('admin-save-msg'), 'Saved. Collection is currently disabled.', 'info');
        } else if (!s.validId) {
          setMsg($('admin-save-msg'), 'Saved. Add a Measurement ID to begin collecting.', 'info');
        } else {
          setMsg($('admin-save-msg'), 'Saved. Grant consent in this browser to begin collecting.', 'info');
        }
      });
    }

    var resetBtn = $('btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (!A) return;
        A.reset();
        setMsg($('admin-save-msg'), 'Stored settings cleared. Reload the page to apply defaults.', 'info');
        refreshStatus();
      });
    }

    /* ------------------------------------------------------------------
       Test event
       ------------------------------------------------------------------ */

    var testBtn = $('btn-test');
    if (testBtn) {
      testBtn.addEventListener('click', function () {
        if (!A) {
          setMsg($('admin-test-msg'), 'Analytics module is not loaded.', 'err');
          return;
        }
        var s = A.testEvent();
        refreshStatus();
        if (s.live) {
          setMsg($('admin-test-msg'),
            'Test event sent. Check GA4 → Reports → Realtime for "dw_admin_test" within about 30 seconds.', 'ok');
        } else if (!s.validId) {
          setMsg($('admin-test-msg'), 'Add a valid Measurement ID first — the event was queued locally.', 'err');
        } else if (!s.enabled) {
          setMsg($('admin-test-msg'), 'Enable collection first — the event was not sent.', 'err');
        } else {
          setMsg($('admin-test-msg'), 'Consent not granted, so the event was queued rather than sent.', 'info');
        }
      });
    }

    /* ------------------------------------------------------------------
       Consent
       ------------------------------------------------------------------ */

    var grantBtn = $('btn-consent-grant');
    if (grantBtn) {
      grantBtn.addEventListener('click', function () {
        if (!A) return;
        A.grantConsent();
        refreshStatus();
        setMsg($('admin-consent-msg'), 'Consent granted for this browser.', 'ok');
      });
    }

    var denyBtn = $('btn-consent-deny');
    if (denyBtn) {
      denyBtn.addEventListener('click', function () {
        if (!A) return;
        A.denyConsent();
        refreshStatus();
        setMsg($('admin-consent-msg'), 'Consent denied. Analytics storage stays blocked.', 'info');
      });
    }

    // Expose the digest helper so a new passphrase hash can be generated.
    window.dwAdminDigest = digest;
  });
})();
