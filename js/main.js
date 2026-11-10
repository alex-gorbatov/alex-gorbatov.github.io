/* ==========================================================
   Главная: мобильное меню, переход «Первый экран → Лента»,
   движение размытых кругов по скроллу
   ========================================================== */

const root = document.documentElement;
const header = document.querySelector('.header');
const hero = document.querySelector('.hero');
const works = document.querySelector('.works');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------------- Мобильное меню ---------------- */
const toggle = document.querySelector('.menu-toggle');

const setMenuOpen = (open) => {
  header.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  document.body.classList.toggle('no-scroll', open);
  if (open) header.classList.remove('is-hidden');
};

if (toggle) {
  toggle.addEventListener('click', () => setMenuOpen(!header.classList.contains('is-open')));
  header.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => setMenuOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenuOpen(false); });
  matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches) setMenuOpen(false); });
}

/* ---------------- Переход между экранами ----------------
   Как в референсе: контент первого экрана уходит вверх и растворяется,
   затем элементы ленты по очереди проявляются снизу. Шапка и фон остаются. */

const OUT = { duration: 450, stagger: 40, shift: 40 };
const IN = { duration: 750, stagger: 90, shift: 60 };
const EASE_OUT = 'cubic-bezier(.22, .61, .36, 1)';
const EASE_IN = 'cubic-bezier(.55, .06, .68, .19)';

let mode = root.classList.contains('is-works') ? 'works' : 'hero';
let busy = false;

const heroItems = () => [...hero.querySelectorAll('[data-reveal]'), hero.querySelector('.hero__bg')];

/* Элементы ленты, которые сейчас в зоне видимости (анимируем только их) */
const visibleWorksItems = () => {
  const items = [...works.querySelectorAll('.project__head, .project__frame')];
  return items.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  });
};

const animateGroup = (els, keyframes, { duration, stagger, easing, fill }) => {
  if (reducedMotion.matches) {
    duration = 200; stagger = 0;
    keyframes = keyframes.map(({ opacity }) => ({ opacity }));
  }
  return Promise.all(els.map((el, i) =>
    el.animate(keyframes, { duration, delay: i * stagger, easing, fill }).finished
  ));
};

const clearAnimations = (els) => els.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));

const setMode = (next) => {
  mode = next;
  root.classList.toggle('is-hero', next === 'hero');
  root.classList.toggle('is-works', next === 'works');
  history.replaceState(null, '', next === 'works' ? '#works' : location.pathname + location.search);
};

async function goToWorks() {
  if (busy || mode === 'works') return;
  busy = true;
  setMenuOpen(false);

  const out = heroItems();
  await animateGroup(out,
    [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(-${OUT.shift}px)` }],
    { ...OUT, easing: EASE_IN, fill: 'forwards' });

  setMode('works');
  scrollTo(0, 0);
  clearAnimations(out);
  works.focus({ preventScroll: true });

  const entering = visibleWorksItems();
  markRevealed(entering);                // их проявит сам переход, а не наблюдатель скролла
  await animateGroup(entering,
    [{ opacity: 0, transform: `translateY(${IN.shift}px)` }, { opacity: 1, transform: 'none' }],
    { ...IN, easing: EASE_OUT, fill: 'backwards' });

  busy = false;
}

async function goToHero() {
  if (busy || mode === 'hero') return;
  busy = true;

  const out = visibleWorksItems();
  await animateGroup(out,
    [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${OUT.shift}px)` }],
    { ...OUT, stagger: 20, easing: EASE_IN, fill: 'forwards' });

  setMode('hero');
  scrollTo(0, 0);
  clearAnimations(out);
  header.classList.remove('is-hidden');
  hero.focus({ preventScroll: true });

  await animateGroup(heroItems(),
    [{ opacity: 0, transform: `translateY(-${IN.shift}px)` }, { opacity: 1, transform: 'none' }],
    { ...IN, easing: EASE_OUT, fill: 'backwards' });

  busy = false;
}

/* ---------------- Появление карточек при прокрутке ленты ----------------
   Та же анимация, что при переходе на ленту: снизу вверх с проявлением,
   заголовок → обложка с небольшой задержкой. Каждая карточка — один раз. */

const revealTargets = [...document.querySelectorAll('.project__head, .project__frame, [data-scroll-reveal]')];

const revealObserver = new IntersectionObserver((entries) => {
  const shown = entries
    .filter((e) => e.isIntersecting && e.target.classList.contains('is-pending'))
    .map((e) => e.target)
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  if (!shown.length) return;
  markRevealed(shown);
  animateGroup(shown,
    [{ opacity: 0, transform: `translateY(${IN.shift}px)` }, { opacity: 1, transform: 'none' }],
    { ...IN, easing: EASE_OUT, fill: 'backwards' });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

function markRevealed(els) {
  els.forEach((el) => {
    el.classList.remove('is-pending');
    revealObserver.unobserve(el);
  });
}

revealTargets.forEach((el) => {
  el.classList.add('is-pending');
  revealObserver.observe(el);
});

/* ---------------- Жесты ---------------- */

const atBottom = () => scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
const atTop = () => scrollY <= 0;

/* Колесо / тачпад. Один жест = серия событий без паузы > 200 мс.
   Жест, запустивший переход, «съедаем» целиком, чтобы инерция тачпада
   не пролистала ленту и не вернула экран обратно. */
let lastWheel = 0;
let gestureUsed = false;
let topSince = atTop() ? performance.now() : Infinity;

addEventListener('scroll', () => {
  if (atTop()) { if (topSince === Infinity) topSince = performance.now(); }
  else topSince = Infinity;
}, { passive: true });

addEventListener('wheel', (e) => {
  if (header.classList.contains('is-open')) return;
  const now = performance.now();
  if (now - lastWheel > 200) gestureUsed = false;
  lastWheel = now;

  if (busy || gestureUsed) { e.preventDefault(); return; }

  if (mode === 'hero' && e.deltaY > 0 && atBottom()) {
    e.preventDefault(); gestureUsed = true; goToWorks();
  } else if (mode === 'works' && e.deltaY < 0 && atTop() && now - topSince > 300) {
    // назад — только если пользователь уже «упёрся» в верх ленты, а не долетел до него по инерции
    e.preventDefault(); gestureUsed = true; goToHero();
  }
}, { passive: false });

/* Тач */
let touchY = null;
let touchAtEdge = false;

addEventListener('touchstart', (e) => {
  touchY = e.touches[0].clientY;
  touchAtEdge = mode === 'hero' ? atBottom() : atTop();
}, { passive: true });

addEventListener('touchmove', (e) => {
  if (touchY === null || busy) { if (busy) e.preventDefault(); return; }
  const dy = touchY - e.touches[0].clientY;
  // гасим «резинку» у края, если жест ведёт к переходу
  if (touchAtEdge && ((mode === 'hero' && dy > 0) || (mode === 'works' && dy < 0))) e.preventDefault();
}, { passive: false });

addEventListener('touchend', (e) => {
  if (touchY === null) return;
  const dy = touchY - e.changedTouches[0].clientY;
  touchY = null;
  if (!touchAtEdge || header.classList.contains('is-open')) return;
  if (mode === 'hero' && dy > 50) goToWorks();
  else if (mode === 'works' && dy < -70) goToHero();
}, { passive: true });

/* Клавиатура */
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (busy && ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) {
    e.preventDefault(); return;
  }
  if (mode === 'hero' && atBottom() && ['ArrowDown', 'PageDown', ' ', 'End'].includes(e.key)) {
    e.preventDefault(); goToWorks();
  } else if (mode === 'works' && (e.key === 'Home' || (atTop() && ['ArrowUp', 'PageUp'].includes(e.key)))) {
    e.preventDefault(); goToHero();
  }
});

/* Ссылки «Последние работы» и логотип */
document.querySelectorAll('a[href="#works"]').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault(); goToWorks();
}));
document.querySelectorAll('.logo').forEach((logo) => logo.addEventListener('click', (e) => {
  if (mode === 'works') { e.preventDefault(); goToHero(); }
}));

/* ---------------- Шапка на ленте: прячется при скролле вниз ---------------- */
let lastY = scrollY;
addEventListener('scroll', () => {
  const y = scrollY;
  if (mode === 'works' && !header.classList.contains('is-open')) {
    if (y > lastY + 4 && y > 120) header.classList.add('is-hidden');
    else if (y < lastY - 4 || y <= 120) header.classList.remove('is-hidden');
  }
  lastY = y;
}, { passive: true });

/* ---------------- Размытые круги ----------------
   При скролле ленты каждый круг едет по часовой стрелке вдоль границ экрана.
   Траектория — суперэллипс (прямоугольник со скруглёнными углами),
   один полный круг за всю длину ленты. Движение сглажено (инерция). */

const glows = [...document.querySelectorAll('.glow')];
const N = 4;            // «квадратность» траектории: 2 — эллипс, больше — ближе к прямоугольнику
const RX = 0.42;        // радиусы траектории от размеров экрана
const RY = 0.40;

const sp = (v, p) => Math.sign(v) * Math.abs(v) ** p;
const pathPoint = (t, w, h) => [
  w / 2 + RX * w * sp(Math.cos(t), 2 / N),
  h / 2 + RY * h * sp(Math.sin(t), 2 / N),
];

// Стартовый угол каждого круга на траектории — от его исходной позиции (в % экрана)
const glowStart = glows.map((g) => {
  const x = parseFloat(getComputedStyle(g).left) / innerWidth - 0.5;
  const y = parseFloat(getComputedStyle(g).top) / innerHeight - 0.5;
  return Math.atan2(sp(y / RY, N / 2), sp(x / RX, N / 2));
});

let target = 0;
let current = 0;
let rafId = 0;

const scrollProgress = () => {
  if (mode !== 'works') return 0;
  const max = document.documentElement.scrollHeight - innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
};

const renderGlows = () => {
  const w = innerWidth, h = innerHeight;
  const angle = current * Math.PI * 2;
  glows.forEach((g, i) => {
    const [x0, y0] = pathPoint(glowStart[i], w, h);
    const [x1, y1] = pathPoint(glowStart[i] + angle, w, h);
    g.style.setProperty('--dx', `${(x1 - x0).toFixed(1)}px`);
    g.style.setProperty('--dy', `${(y1 - y0).toFixed(1)}px`);
  });
};

const tick = () => {
  current += (target - current) * 0.08;
  if (Math.abs(target - current) < 0.0002) current = target;
  renderGlows();
  rafId = current === target ? 0 : requestAnimationFrame(tick);
};

const updateGlows = () => {
  if (reducedMotion.matches) return;
  target = scrollProgress();
  if (!rafId) rafId = requestAnimationFrame(tick);
};

addEventListener('scroll', updateGlows, { passive: true });
addEventListener('resize', updateGlows);
new MutationObserver(updateGlows).observe(root, { attributes: true, attributeFilter: ['class'] });

/* ---------------- Волны на обложках: «дышат» при наведении ----------------
   Каждая точка кривой смещается плавным синусоидальным полем, поэтому линия
   остаётся гладкой. Амплитуда нарастает при наведении и затухает при уходе —
   волна возвращается к исходной форме. Только для устройств с мышью. */

const WAVE_AMP = 46;          // максимальный сдвиг точек, в единицах SVG (~px макета; толщина линии — 50)
const WAVE_SPEED = 0.00045;   // скорость «течения», рад/мс — основной цикл ≈ 14 с
const WAVE_EASE_MS = 700;     // время нарастания/затухания амплитуды
const WAVE_PIN = 0.1;         // доля длины у концов линии, где сдвиг плавно гасится до нуля

const parsePath = (d) => {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  const segs = [];
  let cmd = null, cx = 0, cy = 0;
  for (let i = 0; i < tokens.length;) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const n = () => parseFloat(tokens[i++]);
    if (cmd === 'M' || cmd === 'L') { cx = n(); cy = n(); segs.push({ c: cmd, p: [[cx, cy]] }); if (cmd === 'M') cmd = 'L'; }
    else if (cmd === 'H') { cx = n(); segs.push({ c: 'L', p: [[cx, cy]] }); }
    else if (cmd === 'V') { cy = n(); segs.push({ c: 'L', p: [[cx, cy]] }); }
    else if (cmd === 'C') { const p = [[n(), n()], [n(), n()], [n(), n()]]; [cx, cy] = p[2]; segs.push({ c: 'C', p }); }
    else return null;     // другие команды не используются в макете
  }
  return segs;
};

class WaveMorph {
  constructor(path) {
    this.path = path;
    this.base = path.getAttribute('d');
    this.segs = parsePath(this.base);
    this.amp = 0;
    this.target = 0;
    this.phase = Math.random() * Math.PI * 2;
    if (!this.segs) return;
    // Вес каждой точки: у концов линии → 0, чтобы концы не «вылезали» внутрь обложки
    const total = this.segs.reduce((n, s) => n + s.p.length, 0) - 1;
    let i = 0;
    this.weights = this.segs.map(({ p }) => p.map(() => {
      const s = i++ / total;
      const e = Math.min(1, s / WAVE_PIN, (1 - s) / WAVE_PIN);
      return e * e * (3 - 2 * e);          // smoothstep
    }));
  }
  render() {
    if (this.amp < 0.001) { this.path.setAttribute('d', this.base); return; }
    const a = this.amp * WAVE_AMP, t = this.phase;
    // Сумма волн с «несоразмерными» частотами и скоростями: форма всё время
    // меняется и не повторяется заметно, но остаётся плавной
    const d = this.segs.map(({ c, p }, si) => c + p.map(([x, y], pi) => {
      const k = a * this.weights[si][pi];
      const dy = k * (
        0.55 * Math.sin(x * 0.0045 + t) +
        0.30 * Math.sin(x * 0.0110 - t * 1.37 + 1.7) +
        0.15 * Math.sin(y * 0.0090 + t * 0.73 + 4.1));
      const dx = k * (
        0.45 * Math.sin(y * 0.0080 + t * 0.83 + 0.6) +
        0.20 * Math.sin(x * 0.0060 - t * 1.11 + 2.9));
      return `${(x + dx).toFixed(2)} ${(y + dy).toFixed(2)}`;
    }).join(' ')).join('');
    this.path.setAttribute('d', d);
  }
}

if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.project__frame').forEach((frame) => {
    const waves = [...frame.querySelectorAll('.project__wave-path')]
      .map((p) => new WaveMorph(p))
      .filter((w) => w.segs);
    if (!waves.length) return;

    let raf = 0, last = 0;
    const loop = (now) => {
      const dt = Math.min(64, now - (last || now));
      last = now;
      let active = false;
      waves.forEach((w) => {
        w.amp += (w.target - w.amp) * (1 - Math.exp(-dt / WAVE_EASE_MS));
        w.phase += dt * WAVE_SPEED;
        if (w.target === 0 && w.amp < 0.001) w.amp = 0;
        w.render();
        active ||= w.target > 0 || w.amp > 0;
      });
      raf = active ? requestAnimationFrame(loop) : 0;
      if (!raf) last = 0;
    };
    const set = (v) => {
      if (reducedMotion.matches) return;
      waves.forEach((w) => { w.target = v; });
      if (!raf) raf = requestAnimationFrame(loop);
    };

    frame.addEventListener('pointerenter', () => set(1));
    frame.addEventListener('pointerleave', () => set(0));
  });
}

/* ---------------- WebMoney: телефоны прокручиваются при наведении ----------------
   Телефоны в макете стоят 4 диагональными столбиками (повёрнуты на 45°).
   Строим ту же сетку из отдельных мокапов в «повёрнутой плоскости»:
   u — положение столбика, v — положение телефона вдоль столбика (в px макета).
   В покое сетка совпадает с макетом; при наведении соседние столбики едут
   в разные стороны, бесшовно по кругу. */

const PHONE_SPEED = 28;       // px макета в секунду
const PHONE_EASE_MS = 450;    // разгон/торможение

const PHONE_COLUMNS = [
  // [v центра, рамка, экран] — первые элементы совпадают с макетом, остальные только для прокрутки
  { u: 140.6,  dir:  1, pitch: 582.0, items: [[2.8, 'silver', 7], [584.8, 'purple', 2], [1166.8, 'gold', 9]] },
  { u: 453.1,  dir: -1, pitch: 582.6, items: [[-715.6, 'purple', 2], [-132.9, 'black', 4], [449.7, 'purple', 8]] },
  { u: 767.5,  dir:  1, pitch: 581.0, items: [[-1009.8, 'black', 10], [-429.5, 'purple', 5], [152.2, 'gold', 9]] },
  { u: 1081.7, dir: -1, pitch: 573.4, items: [[-784.8, 'silver', 1], [-211.4, 'gold', 3], [362.0, 'gold', 6]] },
];
const PLANE_V_MIN = -1115;    // видимая часть обложки в координатах плоскости (+ полвысоты телефона)
const PLANE_V_MAX = 655;
const PHONE_DIR = 'assets/img/works/webmoney/';

const placeholder = document.querySelector('[data-phone-grid]');

// Сетку строим на всех устройствах: выгруженная из Figma картинка непрозрачная
// и закрывает волну под телефонами. Прокрутка — только для мыши.
if (placeholder) {
  const plane = document.createElement('div');
  plane.className = 'phone-plane';
  plane.setAttribute('aria-hidden', 'true');

  const cols = PHONE_COLUMNS.map((c) => {
    const n = c.items.length;
    const period = n * c.pitch;
    const col = document.createElement('div');
    col.className = 'phone-col';
    col.style.setProperty('--cu', c.u);

    // Слоты k: позиция = позиция в макете + целое число периодов → в покое всё как в Figma
    for (let k = -2 * n; k < 3 * n; k++) {
      const [v0, frame, screen] = c.items[((k % n) + n) % n];
      const v = v0 + Math.floor(k / n) * period;
      if (v < PLANE_V_MIN - period || v > PLANE_V_MAX + period) continue;
      const phone = document.createElement('div');
      phone.className = 'phone';
      phone.style.setProperty('--v', v);
      phone.innerHTML =
        `<img class="phone__screen" src="${PHONE_DIR}screen-${screen}.jpg" alt="" loading="lazy" decoding="async">` +
        `<img class="phone__frame" src="${PHONE_DIR}frame-${frame}.png" alt="" loading="lazy" decoding="async">`;
      col.append(phone);
    }
    plane.append(col);
    return { el: col, dir: c.dir, period, off: 0 };
  });

  placeholder.replaceWith(plane);

  const frameEl = plane.closest('.project__frame');
  let vel = 0, target = 0, raf = 0, last = 0;

  const loop = (now) => {
    const dt = Math.min(64, now - (last || now));
    last = now;
    vel += (target - vel) * (1 - Math.exp(-dt / PHONE_EASE_MS));
    if (target === 0 && vel < 0.002) vel = 0;
    cols.forEach((c) => {
      c.off = (c.off + c.dir * vel * PHONE_SPEED * dt / 1000) % c.period;
      // держим смещение в [-period/2, period/2), чтобы сетка всегда покрывала обложку
      if (c.off >= c.period / 2) c.off -= c.period;
      if (c.off < -c.period / 2) c.off += c.period;
      c.el.style.setProperty('--off', c.off.toFixed(2));
    });
    raf = vel > 0 || target > 0 ? requestAnimationFrame(loop) : 0;
    if (!raf) last = 0;
  };

  const set = (v) => { target = v; if (!raf) raf = requestAnimationFrame(loop); };
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion.matches) {
    frameEl.addEventListener('pointerenter', () => set(1));
    frameEl.addEventListener('pointerleave', () => set(0));
  }
}

/* ---------------- Водоход: узор оживает при наведении ----------------
   Внешний круг (руны) и внутренний (плетёнка) вращаются в разные стороны
   с разной скоростью, человечек машет рукой. Всё плавно разгоняется
   и затухает; круги останавливаются там, где были, рука опускается. */

const RING_OUTER_SPEED = 4;   // град/с, по часовой
const RING_INNER_SPEED = -7;  // град/с, против часовой
const ARM_RAISE = 100;        // на сколько градусов поднимается рука (из «опущенной» в поднятую)
const ARM_SWING = 16;         // размах взмахов, ±градусов
const ARM_PERIOD = 900;       // длительность одного взмаха, мс
const PATTERN_EASE_MS = 600;

const pattern = document.querySelector('[data-pattern]');

if (pattern && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const outer = pattern.querySelector('.pattern__ring--outer');
  const inner = pattern.querySelector('.pattern__ring--inner');
  const arm = pattern.querySelector('.pattern__arm');
  const frameEl = pattern.closest('.project__frame');

  let vel = 0, target = 0, raf = 0, last = 0;
  let aOuter = 0, aInner = 0, swingT = 0;

  const loop = (now) => {
    const dt = Math.min(64, now - (last || now));
    last = now;
    vel += (target - vel) * (1 - Math.exp(-dt / PATTERN_EASE_MS));
    if (target === 0 && vel < 0.002) vel = 0;

    aOuter = (aOuter + RING_OUTER_SPEED * vel * dt / 1000) % 360;
    aInner = (aInner + RING_INNER_SPEED * vel * dt / 1000) % 360;
    swingT += dt;
    // Фигура в макете отражена по вертикали, поэтому «вверх» на экране — плюс
    const armAngle = vel * (ARM_RAISE + ARM_SWING * Math.sin(swingT / ARM_PERIOD * Math.PI * 2));

    outer.style.transform = `rotate(${aOuter.toFixed(3)}deg)`;
    inner.style.transform = `rotate(${aInner.toFixed(3)}deg)`;
    arm.style.transform = `rotate(${armAngle.toFixed(2)}deg)`;

    raf = vel > 0 || target > 0 ? requestAnimationFrame(loop) : 0;
    if (!raf) last = 0;
  };

  const set = (v) => {
    if (reducedMotion.matches) return;
    if (v && !raf) swingT = -ARM_PERIOD / 4;   // первый взмах начинается плавно, с середины
    target = v;
    if (!raf) raf = requestAnimationFrame(loop);
  };
  frameEl.addEventListener('pointerenter', () => set(1));
  frameEl.addEventListener('pointerleave', () => set(0));
}

/* ---------------- Курсор: внешний круг крутится при наведении ----------------
   Вращаем через CSS-свойство rotate: оно применяется поверх отражения
   scaleX(-1) из макета, поэтому положительный угол — по часовой на экране.
   Острый уголок вращается вместе с кругом вокруг его центра — как одно целое. */

const SPIN_SPEED = 30;        // град/с, по часовой
const SPIN_EASE_MS = 500;

const spinEls = [...document.querySelectorAll('[data-spin], [data-corner]')];

if (spinEls.length && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const frameEl = spinEls[0].closest('.project__frame');
  let vel = 0, target = 0, raf = 0, last = 0, angle = 0;

  const loop = (now) => {
    const dt = Math.min(64, now - (last || now));
    last = now;
    vel += (target - vel) * (1 - Math.exp(-dt / SPIN_EASE_MS));
    if (target === 0 && vel < 0.002) vel = 0;
    angle = (angle + SPIN_SPEED * vel * dt / 1000) % 360;
    spinEls.forEach((el) => { el.style.rotate = `${angle.toFixed(2)}deg`; });
    raf = vel > 0 || target > 0 ? requestAnimationFrame(loop) : 0;
    if (!raf) last = 0;
  };

  const set = (v) => {
    if (reducedMotion.matches) return;
    target = v;
    if (!raf) raf = requestAnimationFrame(loop);
  };
  frameEl.addEventListener('pointerenter', () => set(1));
  frameEl.addEventListener('pointerleave', () => set(0));
}
