/* =========================================================
   XBRI · Portal de Garantia — Homepage
   - escala Figma (1640) -> viewport
   - smooth scroll (Lenis) + parallax / esfumaçado do header
   - entrada do título por caractere
   - menu em tela cheia (wipe vertical, cascata dos itens, troca de imagem no hover)
   ========================================================= */
(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js');
  const body = document.body;
  const DESIGN_W = 1640;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- escala ---------------- */
  let unit = 1;
  const setUnit = () => {
    unit = root.clientWidth / DESIGN_W;
    root.style.setProperty('--u', unit + 'px');
  };
  setUnit();
  window.addEventListener('resize', setUnit);

  /* ---------------- easings ---------------- */
  const ease = {
    quintInOut: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
    quartOut: (t) => 1 - Math.pow(1 - t, 4),
    cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  };

  /* ---------------- tween (rAF) ---------------- */
  const tween = ({ from = 0, to = 1, duration = 1, delay = 0, easing = ease.quartOut, onUpdate, onComplete }) => {
    let raf = 0;
    let start = 0;
    let killed = false;
    const d = reduceMotion ? 0.001 : duration;
    const dl = reduceMotion ? 0 : delay;
    const step = (now) => {
      if (killed) return;
      if (!start) start = now + dl * 1000;
      const t = Math.min(1, Math.max(0, (now - start) / (d * 1000)));
      onUpdate(from + (to - from) * easing(t));
      if (t < 1) raf = requestAnimationFrame(step);
      else if (onComplete) onComplete();
    };
    onUpdate(from);
    raf = requestAnimationFrame(step);
    return { kill: () => { killed = true; cancelAnimationFrame(raf); } };
  };

  /* ---------------- título: split por caractere ---------------- */
  const splitTitle = () => {
    let index = 0;
    document.querySelectorAll('[data-split]').forEach((line) => {
      const words = line.textContent.trim().split(/\s+/);
      line.textContent = '';
      line.setAttribute('aria-hidden', 'true');
      words.forEach((word, wi) => {
        const w = document.createElement('span');
        w.className = 'hero__word';
        [...word].forEach((ch) => {
          const mask = document.createElement('span');
          mask.className = 'hero__mask';
          const c = document.createElement('span');
          c.className = 'hero__char';
          c.textContent = ch;
          c.style.transitionDelay = (0.15 + index * 0.028).toFixed(3) + 's';
          mask.appendChild(c);
          w.appendChild(mask);
          index += 1;
        });
        line.appendChild(w);
        if (wi < words.length - 1) {
          const sp = document.createElement('span');
          sp.className = 'hero__space';
          line.appendChild(sp);
          index += 1;
        }
      });
    });
  };
  splitTitle();

  /* ---------------- smooth scroll ---------------- */
  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new window.Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    const loop = (time) => { lenis.raf(time); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  /* ---------------- header: parallax + esfumaçado ---------------- */
  const hero = document.querySelector('[data-hero]');
  const heroMedia = document.querySelector('[data-hero-media]');
  const heroTitle = document.querySelector('[data-hero-title]');
  const heroSmoke = document.querySelector('[data-hero-smoke]');
  const homeEl = document.querySelector('.home');

  const onScroll = (y) => {
    const h = hero.offsetHeight;
    if (y > h * 1.2) return;
    heroMedia.style.transform = `translate3d(0, ${(y * 0.28).toFixed(2)}px, 0)`;
    heroTitle.style.transform = `translate3d(0, ${(y * 0.46).toFixed(2)}px, 0)`;
    heroTitle.style.opacity = Math.max(0, 1 - y / (520 * unit)).toFixed(3);
    const smoke = Math.min(1, Math.max(0, y / (320 * unit))).toFixed(3);
    heroSmoke.style.opacity = smoke;
    homeEl.style.setProperty('--smoke', smoke);
  };
  if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
  else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });
  onScroll(window.scrollY);

  /* ---------------- reveal ---------------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

  /* ---------------- entrada ---------------- */
  const ready = () => requestAnimationFrame(() => body.classList.add('is-ready'));
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(() => setTimeout(ready, 80));

  /* ---------------- vídeos ---------------- */
  document.querySelectorAll('video').forEach((v) => {
    v.muted = true;
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  });

  /* =========================================================
     MENU
     ========================================================= */
  const menu = document.querySelector('[data-menu]');
  const panel = menu.querySelector('[data-menu-panel]');
  const media = menu.querySelector('[data-menu-media]');
  const images = menu.querySelector('[data-menu-images]');
  const items = [...menu.querySelectorAll('[data-menu-item]')];
  const socials = menu.querySelector('[data-menu-socials]');
  const openBtn = document.querySelector('[data-menu-open]');
  const closeBtn = menu.querySelector('[data-menu-close]');
  const staggerEls = [...items, socials];

  let state = 'closed'; // closed | opening | open | closing
  let running = [];
  let current = -1;
  let layerZ = 1;

  const killAll = () => { running.forEach((t) => t.kill()); running = []; };
  const clip = (el, top, bottom) => { el.style.clipPath = `inset(${top}% 0% ${bottom}% 0%)`; };

  // pré-carrega as imagens do menu
  const preload = () => items.forEach((it) => { const i = new Image(); i.decoding = 'async'; i.src = it.dataset.image; });
  if (document.readyState === 'complete') setTimeout(preload, 600);
  else window.addEventListener('load', () => setTimeout(preload, 600));

  const makeLayer = (src) => {
    const layer = document.createElement('div');
    layer.className = 'menu__image';
    const img = document.createElement('img');
    img.className = 'menu__photo';
    img.src = src;
    img.alt = '';
    layer.appendChild(img);
    layer.style.zIndex = String(layerZ++);
    images.appendChild(layer);
    return layer;
  };

  const showImage = (index, animate = true) => {
    if (index === current) return;
    current = index;
    const layer = makeLayer(items[index].dataset.image);
    if (!animate) {
      [...images.children].forEach((c) => { if (c !== layer) c.remove(); });
      return;
    }
    clip(layer, 0, 100);
    layer.style.transform = 'scale(1.2)';
    tween({ from: 100, to: 0, duration: 0.9, easing: ease.cubicOut, onUpdate: (v) => clip(layer, 0, v) });
    tween({
      from: 1.2, to: 1, duration: 4, easing: ease.cubicOut,
      onUpdate: (v) => { layer.style.transform = `scale(${v})`; },
      onComplete: () => {
        // mantém apenas a camada final e a anterior
        const layers = [...images.children];
        const idx = layers.indexOf(layer);
        layers.slice(0, Math.max(0, idx - 1)).forEach((c) => c.remove());
      },
    });
  };

  items.forEach((item, i) => {
    item.addEventListener('mouseenter', () => { if (state !== 'closed') showImage(i); });
    item.querySelector('a').addEventListener('focus', () => { if (state !== 'closed') showImage(i); });
  });

  const openMenu = () => {
    if (state === 'open' || state === 'opening') return;
    killAll();
    state = 'opening';
    if (lenis) lenis.stop();
    menu.classList.add('is-active');
    menu.setAttribute('aria-hidden', 'false');
    openBtn.setAttribute('aria-expanded', 'true');

    // estado inicial
    current = -1;
    images.innerHTML = '';
    showImage(0, false);
    clip(panel, 0, 100);
    clip(media, 0, 100);
    staggerEls.forEach((el) => { el.style.opacity = '0'; el.style.transform = `translate3d(0, ${40 * unit}px, 0)`; });

    requestAnimationFrame(() => {
      menu.classList.add('is-open');
      running.push(tween({ from: 100, to: 0, duration: 1.2, easing: ease.quintInOut, onUpdate: (v) => clip(panel, 0, v) }));
      running.push(tween({
        from: 100, to: 0, duration: 1.2, delay: 0.05, easing: ease.quintInOut,
        onUpdate: (v) => clip(media, 0, v),
        onComplete: () => { state = 'open'; },
      }));
      staggerEls.forEach((el, i) => {
        running.push(tween({
          from: 0, to: 1, duration: 1.0, delay: 0.6 + i * 0.05, easing: ease.quartOut,
          onUpdate: (p) => {
            el.style.opacity = p.toFixed(4);
            el.style.transform = `translate3d(0, ${((1 - p) * 40 * unit).toFixed(3)}px, 0)`;
          },
        }));
      });
      setTimeout(() => closeBtn.focus({ preventScroll: true }), 650);
    });
  };

  const closeMenu = () => {
    if (state === 'closed' || state === 'closing') return;
    // ponto de partida: quanto do painel já está fechado (inset inferior)
    const insetBottom = (el) => { const m = el.style.clipPath.match(/inset\(([\d.]+)% [\d.]+% ([\d.]+)%/); return m ? parseFloat(m[2]) : 0; };
    const pb = insetBottom(panel);
    const mb = insetBottom(media);
    killAll();
    state = 'closing';
    menu.classList.remove('is-open');
    openBtn.setAttribute('aria-expanded', 'false');

    running.push(tween({ from: mb, to: 100, duration: 1.1, easing: ease.quintInOut, onUpdate: (v) => clip(media, 0, v) }));
    running.push(tween({
      from: pb, to: 100, duration: 1.15, delay: 0.06, easing: ease.quintInOut,
      onUpdate: (v) => clip(panel, 0, v),
      onComplete: () => {
        state = 'closed';
        menu.classList.remove('is-active');
        menu.setAttribute('aria-hidden', 'true');
        clip(panel, 0, 100);
        clip(media, 0, 100);
        if (lenis) lenis.start();
        openBtn.focus({ preventScroll: true });
      },
    }));
  };

  openBtn.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (e) => {
    if (state === 'closed') return;
    if (e.key === 'Escape') { closeMenu(); return; }
    if (e.key === 'Tab') {
      const f = [...menu.querySelectorAll('a, button')];
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!menu.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  });

  // links internos ainda não existem: evita salto para o topo
  document.querySelectorAll('a[href="#"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));

  // idioma (visual)
  document.querySelectorAll('.lang').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lang').forEach((b) => { b.classList.toggle('is-selected', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
    });
  });
})();
