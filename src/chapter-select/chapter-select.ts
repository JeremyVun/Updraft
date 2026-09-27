import './chapter-select.css';
import { chooseChapter } from '../story/progress';

/** Each room's `?chapter=` start, its name and its still, in the order of the journey. */
const ROOMS: [start: string, name: string, still: URL][] = [
  ['island', 'Still island', new URL('./stills/island.webp', import.meta.url)],
  ['washing', 'Washing', new URL('./stills/washing.webp', import.meta.url)],
  ['boats', 'Little boats', new URL('./stills/boats.webp', import.meta.url)],
  ['meadow', 'Meadow', new URL('./stills/meadow.webp', import.meta.url)],
  ['birches', 'Birches', new URL('./stills/birches.webp', import.meta.url)],
  ['drowned', 'Drowned village', new URL('./stills/drowned.webp', import.meta.url)],
  ['wood', 'Dark wood', new URL('./stills/wood.webp', import.meta.url)],
  ['sleeping', 'Sleeping island', new URL('./stills/sleeping.webp', import.meta.url)],
  ['sea', 'Open sea', new URL('./stills/sea.webp', import.meta.url)],
  ['mirror', 'Sky mirror', new URL('./stills/mirror.webp', import.meta.url)],
  ['jetty', 'Home', new URL('./stills/home.webp', import.meta.url)],
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/**
 * Only for players who have finished. Everything lives inside the veil and keeps its presses to itself,
 * because a click anywhere else on the veil begins the game.
 */
export function offerChapters(veil: HTMLElement): void {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = el('button', 'chapters-toggle', 'chapters');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  const panel = el('div', 'chapters');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Chapters');
  panel.hidden = true;
  const list = el('ul', 'chapters-list');
  panel.append(list);
  for (const node of [toggle, panel]) {
    node.addEventListener('pointerdown', e => e.stopPropagation());
    node.addEventListener('click', e => e.stopPropagation());
  }

  // The stills are fetched only once the player reaches for the list.
  const fill = (): void => {
    if (list.childElementCount) return;
    for (const [start, name, still] of ROOMS) {
      const button = el('button', 'chapter');
      button.type = 'button';
      const img = el('img', 'chapter-still');
      img.alt = '';
      img.decoding = 'async';
      img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
      img.src = still.href;
      button.append(img, el('span', 'chapter-name', name));
      button.addEventListener('click', () => pick(start));
      const item = el('li', '');
      item.append(button);
      list.append(item);
    }
  };
  const open = (): void => {
    fill();
    panel.hidden = false;
    veil.classList.add('choosing');
    toggle.setAttribute('aria-expanded', 'true');
    list.querySelector('button')?.focus({ preventScroll: true });
  };
  const close = (): void => {
    veil.classList.remove('choosing');
    toggle.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    toggle.focus({ preventScroll: true });
  };
  const pick = (start: string): void => {
    veil.classList.add('chapter-chosen');
    for (const button of list.querySelectorAll('button')) button.disabled = true;
    chooseChapter(start);
    setTimeout(() => location.reload(), reduced.matches ? 0 : 500);
  };

  toggle.addEventListener('pointerenter', fill, { once: true });
  toggle.addEventListener('focus', fill, { once: true });
  toggle.addEventListener('click', open);
  panel.addEventListener('click', e => {
    if (e.target === panel || e.target === list) close();
  });
  panel.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !veil.classList.contains('chapter-chosen')) close();
  });
  veil.append(toggle, panel);
}
