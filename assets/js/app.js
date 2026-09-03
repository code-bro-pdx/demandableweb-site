document.addEventListener('DOMContentLoaded', () => {

  // --- Particle Background ---
  const canvas = document.getElementById('particles-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];
    const PARTICLE_COUNT = 55;
    function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.35;
        this.speedY = (Math.random() - 0.5) * 0.35;
        this.opacity = Math.random() * 0.5 + 0.1;
        const colors = ['224,114,79','232,155,108','55,199,192'];
        this.color = colors[Math.floor(Math.random()*colors.length)];
      }
      update() {
        this.x += this.speedX; this.y += this.speedY;
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color},${this.opacity})`;
        ctx.fill();
      }
    }
    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());
    function connectParticles() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 140) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(224,114,79,${0.06 * (1 - dist/140)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    }
    function animateParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => { p.update(); p.draw(); });
      connectParticles();
      requestAnimationFrame(animateParticles);
    }
    animateParticles();
  }

  // --- Carousel ---
  const track = document.querySelector('.carousel-track');
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.carousel-dot');
  const prevBtn = document.querySelector('.carousel-arrow.prev');
  const nextBtn = document.querySelector('.carousel-arrow.next');
  let currentSlide = 0;
  let autoSlideInterval;
  function goToSlide(n) {
    if (!track || slides.length === 0) return;
    currentSlide = ((n % slides.length) + slides.length) % slides.length;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    dots.forEach((d, i) => { d.classList.toggle('active', i === currentSlide); d.setAttribute('aria-selected', i === currentSlide); });
  }
  function nextSlide() { goToSlide(currentSlide + 1); }
  function prevSlide() { goToSlide(currentSlide - 1); }
  if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); resetAuto(); });
  if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); resetAuto(); });
  dots.forEach((d, i) => d.addEventListener('click', () => { goToSlide(i); resetAuto(); }));
  function resetAuto() { clearInterval(autoSlideInterval); autoSlideInterval = setInterval(nextSlide, 6000); }
  resetAuto();

  // --- SPA Navigation ---
  const navItems = document.querySelectorAll('.nav-item[data-page]');
  const pageSections = document.querySelectorAll('.page-section');
  const footerLinks = document.querySelectorAll('.footer-links a[data-page]');
  const carouselCTAs = document.querySelectorAll('.carousel-cta a[data-page]');

  function showPage(pageId, scrollToId) {
    pageSections.forEach(s => s.classList.remove('active'));
    const target = document.getElementById(pageId);
    if (target) target.classList.add('active');
    navItems.forEach(n => n.classList.toggle('active', n.dataset.page === pageId));

    if (scrollToId) {
      // Let the section become visible before measuring its position.
      requestAnimationFrame(() => {
        const anchor = document.getElementById(scrollToId);
        if (anchor) {
          anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Report the virtual page view to GA4. This SPA swaps sections without a
    // document reload, so analytics needs an explicit hit per navigation.
    if (window.DWAnalytics && typeof window.DWAnalytics.trackPageView === 'function') {
      window.DWAnalytics.trackPageView(pageId, scrollToId);
    }
  }

  // Plain links (not nav/submenu/footer items, which are wired below) that
  // carry data-scroll: switch page, then smooth-scroll to the anchor.
  document.querySelectorAll('a[data-scroll]:not(.footer-links a)').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      showPage(el.dataset.page || 'home', el.dataset.scroll);
    });
  });

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      if (item.dataset.page) { e.preventDefault(); showPage(item.dataset.page, item.dataset.scroll); }
    });
    item.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && item.dataset.page) { e.preventDefault(); showPage(item.dataset.page, item.dataset.scroll); }
    });
  });

  document.querySelectorAll('.submenu-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => { e.stopPropagation(); if (item.dataset.page) showPage(item.dataset.page, item.dataset.scroll); });
    item.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && item.dataset.page) { e.stopPropagation(); e.preventDefault(); showPage(item.dataset.page, item.dataset.scroll); } });
  });

  footerLinks.forEach(link => {
    link.addEventListener('click', (e) => { e.preventDefault(); if (link.dataset.page) showPage(link.dataset.page, link.dataset.scroll); });
  });

  carouselCTAs.forEach(link => {
    link.addEventListener('click', (e) => { e.preventDefault(); if (link.dataset.page) showPage(link.dataset.page, link.dataset.scroll); });
  });

  // --- FAQ Accordion ---
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => { i.classList.remove('open'); i.querySelector('.faq-question').setAttribute('aria-expanded', 'false'); });
      if (!wasOpen) { item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });

  // --- Contact Form ---
  const contactForm = document.getElementById('contact-form');
  const charField = document.getElementById('contact-content');
  const charCount = document.getElementById('char-count');
  if (charField && charCount) {
    charField.addEventListener('input', () => {
      const len = charField.value.length;
      charCount.textContent = `${len}/750`;
      if (len > 750) { charField.value = charField.value.substring(0, 750); charCount.textContent = '750/750'; }
    });
  }
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const captcha = document.getElementById('captcha-check');
      if (!captcha || !captcha.checked) { alert('Please complete the CAPTCHA verification.'); return; }
      alert('Thank you for reaching out! We will respond within 48 hours.');
      contactForm.reset();
      if (charCount) charCount.textContent = '0/750';
    });
  }

  // --- Scroll to Top ---
  const scrollTopBtn = document.querySelector('.scroll-top');
  if (scrollTopBtn) {
    window.addEventListener('scroll', () => { scrollTopBtn.classList.toggle('visible', window.scrollY > 400); });
    scrollTopBtn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  // --- Mobile Submenu Toggle ---
  document.querySelectorAll('.nav-item.has-submenu').forEach(item => {
    item.addEventListener('click', function(e) {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        const sub = this.querySelector('.submenu');
        if (sub) sub.classList.toggle('show');
      }
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-item')) {
      document.querySelectorAll('.submenu.show').forEach(s => s.classList.remove('show'));
    }
  });

  // Show home by default
  showPage('home');
});
