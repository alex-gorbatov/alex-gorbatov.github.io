/* Шоурил ТОДО играет без звука, пока виден на странице. */
const todoVideo = document.querySelector('video[data-autoplay]');

if (todoVideo) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;

  const updatePlayback = () => {
    if (!visible || motion.matches) {
      todoVideo.pause();
      todoVideo.controls = motion.matches;
      return;
    }

    todoVideo.controls = false;
    todoVideo.muted = true;
    todoVideo.play().catch((error) => {
      if (error.name !== 'AbortError') todoVideo.controls = true;
    });
  };

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updatePlayback();
  });
  observer.observe(todoVideo);
  motion.addEventListener('change', updatePlayback);
}
