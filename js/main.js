/* ==========================================================
   Главная: мобильное меню, появление блоков при скролле,
   движение размытых кругов по скроллу
   ========================================================== */

const header = document.querySelector('.header');
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

/* ---------------- Анимации появления ----------------
   Страница листается обычным скроллом: первый экран, лента проектов, опыт, футер. */

const IN = { duration: 750, stagger: 90, shift: 60 };
const EASE_OUT = 'cubic-bezier(.22, .61, .36, 1)';

const animateGroup = (els, keyframes, { duration, stagger, easing, fill }) => {
  if (reducedMotion.matches) {
    duration = 200; stagger = 0;
    keyframes = keyframes.map(({ opacity }) => ({ opacity }));
  }
  return Promise.all(els.map((el, i) =>
    el.animate(keyframes, { duration, delay: i * stagger, easing, fill }).finished
  ));
};

/* Первый экран проявляется при загрузке */
const heroItems = [...document.querySelectorAll('.hero [data-reveal], .hero__bg')];
animateGroup(heroItems,
  [{ opacity: 0, transform: `translateY(-${IN.shift}px)` }, { opacity: 1, transform: 'none' }],
  { ...IN, easing: EASE_OUT, fill: 'backwards' });


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


/* ---------------- Ссылки на разделы и логотип ---------------- */
document.querySelectorAll('.logo').forEach((logo) => logo.addEventListener('click', (e) => {
  if (scrollY > 0) { e.preventDefault(); scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' }); }
}));

/* ---------------- Шапка: прячется при скролле вниз, подпись уходит после первого экрана ---------------- */
const root = document.documentElement;
const heroEl = document.querySelector('.hero');
let lastY = scrollY;
const onScroll = () => {
  const y = scrollY;
  if (!header.classList.contains('is-open')) {
    if (y > lastY + 4 && y > 120) header.classList.add('is-hidden');
    else if (y < lastY - 4 || y <= 120) header.classList.remove('is-hidden');
  }
  root.classList.toggle('is-works', y > heroEl.offsetHeight * 0.5);
  lastY = y;
};
addEventListener('scroll', onScroll, { passive: true });
onScroll();


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
