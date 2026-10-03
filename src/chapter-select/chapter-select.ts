import './chapter-select.css';
import { QA } from '../qa';

/** Each room's `?chapter=` start, its name and its still, in the order of the journey. */
const ROOMS: [start: string, name: string, still: URL][] = [
  ['island', 'Still island', new URL('./stills/island.webp', import.meta.url)],
  ['washing', 'Washing', new URL('./stills/washing.webp', import.meta.url)],
  ['boats', 'Little boats', new URL('./stills/boats.webp', import.meta.url)],
  ['meadow', 'Meadow', new URL('./stills/meadow.webp', import.meta.url)],
  ['birches', 'Birches', new URL('./stills/birches.webp', import.meta.url)],
  ['stairs', 'Cloud stairs', new URL('./stills/stairs.webp', import.meta.url)],
  ['drowned', 'Drowned village', new URL('./stills/drowned.webp', import.meta.url)],
  ['wood', 'Dark wood', new URL('./stills/wood.webp', import.meta.url)],
  ['sleeping', 'Sleeping island', new URL('./stills/sleeping.webp', import.meta.url)],
  ['sea', 'Open sea', new URL('./stills/sea.webp', import.meta.url)],
  ['mirror', 'Sky mirror', new URL('./stills/mirror.webp', import.meta.url)],
  ['jetty', 'Home', new URL('./stills/home.webp', import.meta.url)],
];

/** Comp only, until Jeremy picks one: `chapterlayout=row` draws the rooms as one row instead of two rows of six. */
const LAYOUT = QA && new URLSearchParams(location.search).get('chapterlayout') === 'row' ? 'row' : 'grid';

/** A pointer that only passes over a tile does not fetch its painting. */
const DWELL = 120;

const paintingOf = (start: string): string => start === 'jetty' ? 'home' : start;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/**
 * The full painting behind the list follows the room the player looks at. Each is fetched on the first look; the
 * new one fades in over the old, which stays whole underneath until covered, so a crossfade never dips.
 */
class Backdrop {
  readonly root = el('div', `chapters-backdrop chapters-backdrop-${LAYOUT}`);
  room = '';
  private readonly images = new Map<string, HTMLImageElement>();
  private top = 0;

  constructor() {
    this.root.append(el('div', 'chapters-mute'));
  }

  look(room: string, now = false): void {
    this.room = room;
    const known = this.images.get(room);
    if (known) {
      if (known.dataset.ready !== undefined) this.reveal(known, now);
      return;
    }
    const img = el('img', 'chapters-painting');
    img.alt = '';
    img.decoding = 'async';
    img.dataset.room = room;
    img.src = new URL(`../paintings/${room}-${innerWidth / innerHeight < 3 / 4 ? 'port' : 'land'}.webp`, import.meta.url).href;
    this.images.set(room, img);
    this.root.prepend(img);
    img.decode().then(() => {
      img.dataset.ready = '';
      if (this.room === room) this.reveal(img, now);
    }, () => {});
  }

  private reveal(img: HTMLImageElement, now: boolean): void {
    if (img.classList.contains('shown') && +img.style.zIndex === this.top) return;
    const z = ++this.top;
    img.style.zIndex = String(z);
    const covered = (): void => {
      for (const other of this.images.values()) if (+other.style.zIndex < z) other.classList.remove('shown');
    };
    if (now) {
      img.classList.add('now', 'shown');
      void img.offsetWidth;
      img.classList.remove('now');
      covered();
      return;
    }
    img.classList.add('shown');
    img.addEventListener('transitionend', covered, { once: true });
  }
}

/**
 * Only for players who have finished. Everything lives inside the veil and keeps its presses to itself,
 * because a click anywhere else on the veil begins the game.
 */
export function offerChapters(veil: HTMLElement, begin: (start: string) => void): void {
  const toggle = el('button', 'chapters-toggle', 'chapters');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  const panel = el('div', `chapters chapters-${LAYOUT}`);
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Chapters');
  panel.hidden = true;
  const list = el('ul', 'chapters-list');
  const caption = el('p', 'chapters-caption');
  caption.setAttribute('aria-hidden', 'true');
  const back = el('button', 'chapters-back', 'back');
  back.type = 'button';
  panel.append(caption, list, back);
  for (const node of [toggle, panel]) {
    node.addEventListener('pointerdown', e => e.stopPropagation());
    node.addEventListener('click', e => e.stopPropagation());
  }
  const backdrop = new Backdrop();
  veil.insertBefore(backdrop.root, veil.querySelector('.veil-wind'));
  const titleRoom = (): string | undefined =>
    veil.classList.contains('painted') ? veil.querySelector<HTMLElement>('.veil-painting')?.dataset.room : undefined;

  // Where the list begins, so the painting is darkest under the tiles and opens out above them.
  const fold = (): void => {
    if (panel.hidden) return;
    const top = (LAYOUT === 'row' ? list.getBoundingClientRect().top - 56 : list.querySelector('.chapter')?.getBoundingClientRect().top) ?? 0;
    backdrop.root.style.setProperty('--fold', `${Math.round(veil.clientHeight - Math.max(0, top))}px`);
  };
  window.addEventListener('resize', fold);

  const show = (start: string, now = false): void => {
    backdrop.look(paintingOf(start), now);
    for (const button of list.querySelectorAll<HTMLElement>('.chapter')) button.classList.toggle('current', button.dataset.start === start);
    caption.textContent = ROOMS.find(r => r[0] === start)?.[1] ?? '';
  };

  // The stills are fetched only once the player reaches for the list.
  const fill = (): void => {
    if (list.childElementCount) return;
    for (const [start, name, still] of ROOMS) {
      const button = el('button', 'chapter');
      button.type = 'button';
      button.dataset.start = start;
      const img = el('img', 'chapter-still');
      img.alt = '';
      img.decoding = 'async';
      img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
      img.src = still.href;
      button.append(img, el('span', 'chapter-name', name));
      button.addEventListener('click', () => pick(start));
      // A touch starts the room at once, so only a hovering pointer or the keyboard moves the painting.
      let dwell = 0;
      button.addEventListener('pointerenter', e => {
        if (e.pointerType === 'touch') return;
        clearTimeout(dwell);
        dwell = window.setTimeout(() => show(start), DWELL);
      });
      button.addEventListener('pointerleave', () => clearTimeout(dwell));
      button.addEventListener('focus', () => {
        if (!button.matches(':focus-visible')) return;
        show(start);
      });
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
    // The list opens on the painting already behind the title, so nothing changes until the player looks elsewhere.
    const room = titleRoom();
    const start = ROOMS.find(r => paintingOf(r[0]) === room)?.[0];
    fold();
    if (start) show(start, true);
    const first = list.querySelector<HTMLElement>(start ? `[data-start="${start}"]` : '.chapter');
    first?.focus({ preventScroll: true });
    // Not scrollIntoView: it would also scroll the veil, which clips but still scrolls.
    if (LAYOUT === 'row' && first) list.scrollLeft = first.offsetLeft - (list.clientWidth - first.offsetWidth) / 2;
  };
  const close = (): void => {
    veil.classList.remove('choosing');
    toggle.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    toggle.focus({ preventScroll: true });
  };
  const pick = (start: string): void => {
    veil.classList.add('chapter-chosen');
    for (const button of panel.querySelectorAll('button')) button.disabled = true;
    begin(start);
  };

  toggle.addEventListener('pointerenter', fill, { once: true });
  toggle.addEventListener('focus', fill, { once: true });
  toggle.addEventListener('click', open);
  // `back` stands where `chapters` was, so the second press of a double click must not close the list again.
  back.addEventListener('click', e => { if (e.detail < 2) close(); });
  panel.addEventListener('click', e => {
    if (e.target === panel || e.target === list || e.target === caption) close();
  });
  panel.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !veil.classList.contains('chapter-chosen')) close();
  });
  veil.append(toggle, panel);
}
