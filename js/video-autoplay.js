/* Видео кейсов воспроизводятся, пока видны на странице. */
const motion = matchMedia('(prefers-reduced-motion: reduce)');

document.querySelectorAll('video[data-autoplay]').forEach((video) => {
  let visible = false;

  const updatePlayback = () => {
    if (!visible || motion.matches) {
      video.pause();
      video.controls = motion.matches;
      return;
    }

    video.controls = false;
    video.muted = true;
    video.play().catch((error) => {
      if (error.name !== 'AbortError') video.controls = true;
    });
  };

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updatePlayback();
  });
  observer.observe(video);
  motion.addEventListener('change', updatePlayback);
});
