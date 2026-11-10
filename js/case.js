/* ==========================================================
   Страница кейса: меню, шапка, появление блоков,
   бесконечные ленты скриншотов и карусель логотипов
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

/* ---------------- Шапка прячется при скролле вниз ---------------- */
let lastY = scrollY;
addEventListener('scroll', () => {
  const y = scrollY;
  if (!header.classList.contains('is-open')) {
    if (y > lastY + 4 && y > 120) header.classList.add('is-hidden');
    else if (y < lastY - 4 || y <= 120) header.classList.remove('is-hidden');
  }
  lastY = y;
}, { passive: true });

/* ---------------- Появление: первый экран сразу, остальное по скроллу ----------------
   Та же анимация, что на главной: снизу вверх с проявлением, по очереди. */
const IN = { duration: 750, stagger: 90, shift: 60 };
const EASE_OUT = 'cubic-bezier(.22, .61, .36, 1)';

const reveal = (els) => els.forEach((el, i) => {
  el.classList.remove('is-pending');
  if (reducedMotion.matches) return;
  el.animate(
    [{ opacity: 0, transform: `translateY(${IN.shift}px)` }, { opacity: 1, transform: 'none' }],
    { duration: IN.duration, delay: i * IN.stagger, easing: EASE_OUT, fill: 'backwards' }
  );
});

reveal([...document.querySelectorAll('[data-reveal]')]);

const revealObserver = new IntersectionObserver((entries) => {
  const shown = entries
    .filter((e) => e.isIntersecting)
    .map((e) => e.target)
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  shown.forEach((el) => revealObserver.unobserve(el));
  reveal(shown);
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

document.querySelectorAll('[data-scroll-reveal]').forEach((el) => {
  el.classList.add('is-pending');
  revealObserver.observe(el);
});

/* ---------------- Бесконечные ленты ----------------
   Набор элементов дублируется один раз, дорожка едет ровно на половину своей
   ширины (= один набор + отступ) и начинает заново — стык незаметен:
   после последнего скриншота снова показываются первые, обратного хода нет.
   Скорость задаётся в px/с, длительность считается от реальной ширины набора. */
const LOOPS = [
  { selector: '.ribbon', track: '.ribbon__track', speed: 25 },   // px/с на 1920
  { selector: '.logos', track: '.logos__track', speed: 30 },
];

const loopers = [];

LOOPS.forEach(({ selector, track: trackSel, speed }) => {
  document.querySelectorAll(selector).forEach((root) => {
    const track = root.querySelector(trackSel);
    if (!track || reducedMotion.matches) return;

    [...track.children].forEach((item) => {
      const copy = item.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      copy.querySelectorAll('img').forEach((img) => { img.alt = ''; img.loading = 'lazy'; });
      track.append(copy);
    });

    const setDuration = () => {
      const half = track.scrollWidth / 2;
      const scale = Math.min(1, innerWidth / 1920);   // на узких экранах всё мельче — едем пропорционально
      root.style.setProperty('--loop-duration', `${(half / (speed * Math.max(scale, 0.45))).toFixed(1)}s`);
    };
    setDuration();
    addEventListener('resize', setDuration);
    track.querySelectorAll('img').forEach((img) => img.addEventListener('load', setDuration, { once: true }));

    root.classList.add('is-looping');
    loopers.push(root);
  });
});

/* Пауза, пока ленты вне экрана, — не тратим ресурсы */
const pauseObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    const target = e.target.classList.contains('ribbons') ? e.target.querySelectorAll('.ribbon') : [e.target];
    target.forEach((el) => el.classList.toggle('is-paused', !e.isIntersecting));
  });
});
const ribbons = document.querySelector('.ribbons');
if (ribbons) pauseObserver.observe(ribbons);
const logos = document.querySelector('.logos');
if (logos) pauseObserver.observe(logos);

/* Просмотр картинки поверх страницы: ссылки с data-lightbox */
const lightboxLinks = document.querySelectorAll('a[data-lightbox]');
if (lightboxLinks.length) {
  const box = document.createElement('dialog');
  box.className = 'lightbox';
  box.innerHTML = '<button class="lightbox__close" type="button" aria-label="Закрыть">×</button><img class="lightbox__img" alt="">';
  document.body.append(box);
  const img = box.querySelector('img');
  box.addEventListener('click', (e) => { if (e.target !== img) box.close(); });
  box.addEventListener('close', () => { img.removeAttribute('src'); });
  lightboxLinks.forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    img.src = a.href;
    img.alt = a.dataset.lightbox || '';
    box.showModal();
  }));
}
