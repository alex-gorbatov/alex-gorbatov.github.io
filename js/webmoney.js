/* ==========================================================
   Кейс WebMoney: диаграмма 2019/2020 и видео
   (меню, шапка, появление блоков и ленты — в case.js)
   ========================================================== */
{
  /* ---------- Диаграмма «Что оплачивают электронными деньгами» ----------
     Данные: TNS и Mediascope, % пользователей. Сортировка по 2020 году. */
  const DATA = [
    ['Мобильная связь', 85.8, 81.6],
    ['Интернет-магазины', 81, 81],
    ['Коммунальные услуги (ЖКХ)', 74, 72.3],
    ['Интернет-провайдеры', 67, 67],
    ['Доставка продуктов', 51.5, 61.1],
    ['Денежные переводы', 55, 58.5],
    ['Такси и каршеринг', 50.8, 55.2],
    ['Штрафы и налоги', 52.5, 51.7],
    ['Билеты на транспорт', 59.9, 50.4],
    ['Билеты на мероприятия', 54.4, 44],
    ['Погашение кредитов', 41.7, 43.1],
    ['Онлайн-игры', 25.3, 29.4],
    ['Бронирование отелей', 32.4, 23.6],
  ];
  const fmt = (v) => v.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  const bars = document.querySelector('.wm-bars');
  const tbody = document.querySelector('.wm-chart tbody');

  if (bars) {
    bars.innerHTML = DATA.map(([name, a, b]) => {
      const d = +(b - a).toFixed(1);
      const delta = d === 0 ? 'без изменений' : `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))} п.п. за год`;
      return `<li class="wm-bar">
        <span class="wm-bar__label">${name}</span>
        <span class="wm-bar__track"><i style="--v:${a}"></i><span class="wm-bar__line"><i style="--v:${b}"></i><b>${fmt(b)}%</b></span></span>
        <span class="wm-bar__tip">2019: ${fmt(a)}% · 2020: ${fmt(b)}% · ${delta}</span>
      </li>`;
    }).join('');
  }
  if (tbody) {
    tbody.innerHTML = DATA.map(([n, a, b]) => `<tr><th>${n}</th><td>${fmt(a)}%</td><td>${fmt(b)}%</td></tr>`).join('');
  }

  /* ---------- Видео: играют, только пока видны на экране ---------- */
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const videos = [...document.querySelectorAll('video[data-autoplay]')];
  const userPaused = new WeakSet();

  const setToggle = (video) => {
    const btn = video.parentElement.querySelector('[data-video-toggle]');
    if (!btn) return;
    btn.classList.toggle('is-paused', video.paused);
    btn.setAttribute('aria-label', video.paused ? 'Воспроизвести' : 'Пауза');
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach(({ target: v, isIntersecting }) => {
      if (isIntersecting && !calm && !userPaused.has(v)) {
        if (v.preload === 'none') v.preload = 'auto';
        v.play().catch(() => {});
      } else if (!isIntersecting) {
        v.pause();
      }
    });
  }, { threshold: 0.35 });

  videos.forEach((v) => {
    io.observe(v);
    v.addEventListener('play', () => setToggle(v));
    v.addEventListener('pause', () => setToggle(v));
    setToggle(v);
  });

  document.querySelectorAll('[data-video-toggle]').forEach((btn) => {
    const v = btn.parentElement.querySelector('video');
    btn.addEventListener('click', () => {
      if (v.paused) { userPaused.delete(v); v.play().catch(() => {}); }
      else { userPaused.add(v); v.pause(); }
    });
  });
}
