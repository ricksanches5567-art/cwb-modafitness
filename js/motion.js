/* CWB Moda Fitness — camada de movimento (GSAP + ScrollTrigger + Lenis, locais) */
(function () {
  'use strict';
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOBILE = window.matchMedia('(max-width: 767px)');
  var JUMP = new URLSearchParams(location.search).get('jump');
  if (JUMP !== null && 'scrollRestoration' in history) history.scrollRestoration = 'manual';
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var lenis = null;

  /* ---------- vídeos (9:16 no celular, 16:9 no computador) ---------- */
  function setVideo(v) {
    if (!v || v.getAttribute('data-set') === (MOBILE.matches ? 'm' : 'd')) return;
    var base = v.getAttribute(MOBILE.matches ? 'data-m' : 'data-d');
    v.setAttribute('data-set', MOBILE.matches ? 'm' : 'd');
    v.poster = base + '-poster.webp';
    v.innerHTML = '<source src="' + base + '.webm" type="video/webm"><source src="' + base + '.mp4" type="video/mp4">';
    v.load();
  }
  function tryPlay(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  var hero = $('#heroVideo'), detail = $('#detailVideo');
  if (!RM) {
    setVideo(hero); tryPlay(hero);
    if ('IntersectionObserver' in window) {
      var vio = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var v = e.target;
          if (e.isIntersecting) { if (!v.getAttribute('data-set')) setVideo(v); tryPlay(v); } else if (v.getAttribute('data-set')) v.pause();
        });
      }, { rootMargin: '300px 0px' });
      vio.observe(hero); vio.observe(detail);
    } else { setVideo(detail); tryPlay(detail); }
    MOBILE.addEventListener && MOBILE.addEventListener('change', function () {
      [hero, detail].forEach(function (v) { if (v.getAttribute('data-set')) { setVideo(v); tryPlay(v); } });
    });
  }

  /* ---------- topo: fica sólido depois do hero ---------- */
  var topbar = $('#topbar');
  function onScrollBar() { topbar.classList.toggle('is-solid', window.scrollY > window.innerHeight * 0.82); }
  window.addEventListener('scroll', onScrollBar, { passive: true }); onScrollBar();

  /* ---------- atalhos da coleção -> filtra o catálogo ---------- */
  function scrollToEl(el) {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -10, duration: 1.4 });
    else el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
  }
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-goto-cat]');
    if (g) {
      e.preventDefault();
      var chip = document.querySelector('#filters [data-cat="' + g.getAttribute('data-goto-cat') + '"]');
      if (chip) chip.click();
      scrollToEl($('#catalogo')); return;
    }
    var a = e.target.closest('a[href^="#"]');
    if (a && !e.defaultPrevented) {
      var h = a.getAttribute('href');
      if (h.length > 1 && h.indexOf('#p/') !== 0) {
        var t = h === '#top' ? document.body : document.getElementById(h.slice(1));
        if (t) { e.preventDefault(); if (h === '#top') { lenis ? lenis.scrollTo(0) : window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }); } else scrollToEl(t); }
      }
    }
  });

  /* ---------- contadores ---------- */
  function runCounters() {
    $$('[data-count]').forEach(function (el) {
      var n = +el.getAttribute('data-count');
      if (RM || !hasGsap) { el.textContent = n; return; }
      var o = { v: 0 }; el.textContent = '0';
      gsap.to(o, { v: n, duration: 1.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        onUpdate: function () { el.textContent = Math.round(o.v); } });
    });
  }

  if (RM || !hasGsap) {
    runCounters();
    window.__ready = true;
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Lenis (rolagem suave) ---------- */
  if (JUMP === null && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    // trava a rolagem do fundo quando a peça ou a sacola está aberta
    new MutationObserver(function () { document.body.classList.contains('lock') ? lenis.stop() : lenis.start(); })
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  /* ---------- título do hero: letra por letra ---------- */
  var h1 = $('[data-split]');
  if (h1) {
    h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' ').trim());
    var parts = [];
    Array.prototype.slice.call(h1.childNodes).forEach(function (n) {
      var isEm = n.nodeType === 1, txt = n.textContent;
      txt.split(/(\s+)/).forEach(function (w) {
        if (!w) return;
        if (/^\s+$/.test(w)) { parts.push(' '); return; }
        var chars = w.split('').map(function (c) { return '<span class="ch">' + c + '</span>'; }).join('');
        parts.push('<span class="word" aria-hidden="true">' + (isEm ? '<em>' + chars + '</em>' : chars) + '</span>');
      });
    });
    h1.innerHTML = parts.join('');
  }
  var intro = gsap.timeline({ defaults: { ease: 'power4.out' }, delay: 0.15 });
  intro.from('.hero__title .ch', { yPercent: 120, rotate: 6, duration: 1.3, stagger: 0.045 })
    .from('.hero__eyebrow, .hero__tag, .hero__sub, .hero__promo, .hero__cta > *', { y: 24, opacity: 0, duration: 1, stagger: 0.08 }, '-=0.9')
    .from('.hero__badge, .hero__cue', { opacity: 0, scale: 0.8, duration: 1 }, '-=0.8');

  /* ---------- coleção: filme em canvas a partir das fotos reais ---------- */
  var chSec = $('#colecao'), canvas = $('#chapterCanvas');
  var chapters = $$('.chapter'), railItems = $$('.chapters__rail li');
  var ctx = canvas.getContext('2d');
  var shots = chapters.map(function (c) {
    var img = c.querySelector('.chapter__img');
    var b = img.getAttribute('data-box').split('|').map(function (s) { return s.split(',').map(Number); });
    var im = new Image(); im.decoding = 'async';
    var shot = { el: c, copy: c.querySelector('.chapter__copy'), src: img.currentSrc || img.getAttribute('src'), img: im, a: b[0], b: b[1], ok: false };
    im.onload = function () { shot.ok = true; dirty = true; };
    return shot;
  });
  var loaded = false;
  function loadShots() { if (loaded) return; loaded = true; shots.forEach(function (s) { s.img.src = s.src; }); }
  var cur = 0, target = 0, dirty = true, cw = 0, chh = 0;
  function sizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    cw = Math.round(canvas.clientWidth * dpr); chh = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== cw || canvas.height !== chh) { canvas.width = cw; canvas.height = chh; }
    dirty = true;
  }
  function chProgress() {
    var r = chSec.getBoundingClientRect(), span = r.height - window.innerHeight;
    return span > 0 ? Math.max(0, Math.min(1, -r.top / span)) : 0;
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  var N = shots.length, F = 0.3;
  function weights(p) {
    return shots.map(function (s, i) {
      var u = p * N - i, w = 1;
      if (i > 0) w = Math.min(w, smooth((u + F / 2) / F));
      if (i < N - 1) w = Math.min(w, smooth((1 + F / 2 - u) / F));
      return { w: w, q: clamp01((u + F / 2) / (1 + F)) };
    });
  }
  function drawShot(s, q, alpha) {
    var im = s.img, sw = im.naturalWidth, sh = im.naturalHeight;
    var cx = s.a[0] + (s.b[0] - s.a[0]) * q, cy = s.a[1] + (s.b[1] - s.a[1]) * q, hf = s.a[2] + (s.b[2] - s.a[2]) * q;
    var ch = hf * sh, cwid = ch * cw / chh;
    if (cwid > sw) { cwid = sw; ch = cwid * chh / cw; }
    var x0 = Math.min(Math.max(cx * sw - cwid / 2, 0), sw - cwid), y0 = Math.min(Math.max(cy * sh - ch / 2, 0), sh - ch);
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, x0, y0, cwid, ch, 0, 0, cw, chh);
  }
  var lastActive = -1;
  function render(p) {
    var ws = weights(p);
    ctx.globalAlpha = 1; ctx.fillStyle = '#22101d'; ctx.fillRect(0, 0, cw, chh);
    var acc = 0;
    ws.forEach(function (o, i) {
      if (o.w <= 0.001 || !shots[i].ok) return;
      var a = acc === 0 ? 1 : o.w / (acc + o.w); acc += o.w;
      drawShot(shots[i], o.q, a);
    });
    ctx.globalAlpha = 1;
    var best = 0;
    ws.forEach(function (o, i) {
      var c = shots[i], alpha = clamp01((o.w - 0.5) * 2);
      c.el.classList.toggle('on', alpha > 0.01);
      c.copy.style.opacity = alpha.toFixed(3);
      c.copy.style.transform = 'translate3d(0,' + ((1 - alpha) * (o.q < 0.5 ? 40 : -40)).toFixed(1) + 'px,0)';
      if (o.w > ws[best].w) best = i;
    });
    if (best !== lastActive) { railItems.forEach(function (li, i) { li.classList.toggle('on', i === best); }); lastActive = best; }
  }
  function chTick() {
    target = chProgress();
    var d = target - cur;
    if (Math.abs(d) > 0.0002) { cur += d * 0.14; dirty = true; } else if (cur !== target) { cur = target; dirty = true; }
    if (dirty) { render(cur); dirty = false; }
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { if (es[0].isIntersecting) loadShots(); }, { rootMargin: '150% 0px' }).observe(chSec);
  } else loadShots();
  gsap.ticker.add(chTick);

  /* ---------- detalhes: janela do vídeo abre até tela cheia ---------- */
  var mm = gsap.matchMedia();
  mm.add({ desk: '(min-width: 960px)', mob: '(max-width: 959px)' }, function (c) {
    var from = c.conditions.desk ? 'inset(14% 18% 14% 40% round 32px)' : 'inset(12% 7% 30% 7% round 28px)';
    gsap.fromTo('.details__frame', { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
      scrollTrigger: { trigger: '.details', start: 'top top', end: '55% bottom', scrub: true } });
    gsap.fromTo('.details__copy > *', { y: 50, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, ease: 'power2.out',
      scrollTrigger: { trigger: '.details', start: '25% bottom', end: '60% bottom', scrub: true } });
  });

  /* ---------- efeitos de fundo (criados depois das cenas, como manda a lei) ---------- */
  gsap.to('.hero__video', { scale: 1.14, yPercent: 6, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__content', { yPercent: -18, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '30% top', end: 'bottom top', scrub: true } });
  $$('[data-parallax]').forEach(function (el) {
    gsap.fromTo(el, { yPercent: -(+el.getAttribute('data-parallax')) }, { yPercent: +el.getAttribute('data-parallax'), ease: 'none',
      scrollTrigger: { trigger: el.parentNode, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  $$('.ed').forEach(function (el, i) {
    gsap.fromTo(el, { clipPath: 'inset(100% 0% 0% 0% round 26px)' }, { clipPath: 'inset(0% 0% 0% 0% round 26px)', duration: 1.4, delay: i * 0.15, ease: 'power3.inOut',
      scrollTrigger: { trigger: '.manifesto__art', start: 'top 80%', once: true } });
    gsap.fromTo(el.querySelector('img'), { scale: 1.25 }, { scale: 1, duration: 1.8, delay: i * 0.15, ease: 'power3.out',
      scrollTrigger: { trigger: '.manifesto__art', start: 'top 80%', once: true } });
  });
  // ticker inclina com a velocidade da rolagem
  var skewTo = gsap.quickTo('.ticker__track', 'skewX', { duration: 0.4, ease: 'power3' });
  ScrollTrigger.create({ onUpdate: function (self) { skewTo(Math.max(-8, Math.min(8, self.getVelocity() / -300))); } });

  // entrada suave dos blocos de texto
  $$('.manifesto__text > *, .howto .wrap > *, .step, .cta__in > *, .catalog__head, .footer__in > *').forEach(function (el) { el.classList.add('rise'); });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  $$('.rise').forEach(function (el, i) { el.style.transitionDelay = ((i % 4) * 0.09) + 's'; io.observe(el); });
  runCounters();

  /* ---------- contrato de verificação (?jump=Y e window.__ready) ---------- */
  function ready() {
    ScrollTrigger.refresh();
    if (JUMP !== null) {
      window.scrollTo(0, +JUMP || 0);
      ScrollTrigger.update();
      intro.progress(1);
      cur = target = chProgress(); dirty = true; chTick();
      $$('.rise').forEach(function (el) { var r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('in'); });
    }
    requestAnimationFrame(function () { window.__ready = true; });
  }
  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  if (document.readyState === 'complete') fontsReady.then(ready);
  else window.addEventListener('load', function () { fontsReady.then(ready); });
})();
