// F, round 3: the saved room's picture as the whole veil, Continue in its quiet band; plain veil until it has decoded.
window.comp = (veil, ctx) => {
  if (!ctx.room && !ctx.art) return;
  veil.classList.add('cf', ctx.finished ? 'cf-finished' : 'cf-fresh', `cf-at-${ctx.layout ?? 'bottom'}`);
  if (ctx.quiet != null) veil.style.setProperty('--cf-quiet', ctx.quiet);
  if (ctx.shade != null) veil.style.setProperty('--cf-shade', ctx.shade);
  const before = veil.querySelector('.veil-wind');
  if (ctx.art) {
    const img = document.createElement('img');
    img.className = 'cf-art';
    img.alt = '';
    img.decoding = 'async';
    img.dataset.probe = 'art';
    const shade = document.createElement('div');
    shade.className = 'cf-shade';
    img.addEventListener('load', () => img.decode().catch(() => {}).then(() => {
      veil.classList.add('cf-art-on');
      if (ctx.artOpacity != null) for (const e of [img, shade]) { e.style.transition = 'none'; e.style.opacity = ctx.artOpacity; }
    }), { once: true });
    img.src = innerWidth / innerHeight < .75 ? ctx.art.port : ctx.art.land;
    veil.insertBefore(img, before);
    veil.insertBefore(shade, before);
  }
  if (!ctx.room) return;
  const restart = document.createElement('button');
  restart.className = 'cf-restart';
  restart.type = 'button';
  restart.textContent = 'start over';
  restart.dataset.restart = '';
  restart.dataset.text = 'restart';
  for (const type of ['pointerdown', 'click']) restart.addEventListener(type, e => e.stopPropagation());
  restart.addEventListener('click', () => {
    if (veil.classList.contains('cf-armed')) return;
    veil.classList.add('cf-armed');
    restart.textContent = 'start over and lose your progress?';
  });
  veil.append(restart);
};
