const porscheStory = document.querySelector('.porsche-story');
const playPorsche = porscheStory.querySelector('.porsche-play');
const porscheStatus = porscheStory.querySelector('.porsche-status');
const manualPorsche = matchMedia('(max-width: 800px), (pointer: coarse), (prefers-reduced-motion: reduce)');

async function startPorsche() {
  playPorsche.disabled = true;
  playPorsche.textContent = 'Loading 3D…';
  porscheStatus.textContent = 'Loading the 3D Porsche.';
  try {
    const { loadScene } = await import('./porsche.js');
    await loadScene();
    playPorsche.hidden = true;
    porscheStatus.textContent = 'The 3D Porsche is ready.';
  } catch {
    porscheStory.classList.add('poster-only');
    playPorsche.hidden = true;
    porscheStatus.classList.remove('sr-only');
    porscheStatus.textContent = '3D is unavailable on this device.';
  }
}

if (manualPorsche.matches) {
  playPorsche.hidden = false;
  playPorsche.addEventListener('click', startPorsche, { once: true });
} else {
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    startPorsche();
  });
  observer.observe(porscheStory);
}
