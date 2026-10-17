import { params } from './params';
import { QA } from './qa';
import { hasFinished, readProgress } from './story/progress';
import { tuning } from './tuning';
import { VeilWind } from './input/veil-wind';

declare const __QA__: boolean;
// Vite must drop this import before extracting CSS assets.
if (typeof __QA__ === 'undefined' || __QA__) void import('./styles-qa.css');

const T = tuning.veil;
interface Point { x: number; y: number }
interface StartUI {
  veil: HTMLElement;
  button: HTMLButtonElement;
  stageText: HTMLElement;
  percentText: HTMLElement;
}

/** What the veil says the game is doing, and the share of the number each stage covers (design: boot-veil, Progress). */
const STAGES = {
  build: { line: 'Building the world', from: 3, to: 41 },
  graphics: { line: 'Preparing the graphics', from: 41, to: 95 },
  ground: { line: 'Laying out the ground and grass', from: 95, to: 100 },
} as const;
export type LoadingStage = keyof typeof STAGES;

/** The room whose painting stands behind the veil, by saved chapter or `?chapter=` start (the names never clash). */
const PAINTINGS: Record<string, string> = {
  island: 'island', tree: 'island', crossing: 'washing', toLines: 'washing', lines: 'washing', washing: 'washing', rotary: 'washing',
  toBoats: 'boats', boats: 'boats', toMeadow: 'meadow', meadow: 'meadow', hills: 'meadow', piano: 'meadow',
  toBirches: 'birches', birches: 'birches', autumn: 'birches', toStairs: 'stairs', stairs: 'stairs', clouds: 'stairs',
  drowned: 'drowned', village: 'drowned', roofs: 'drowned', church: 'drowned', storm: 'drowned', toWood: 'wood', wood: 'wood', dark: 'wood', fears: 'wood',
  toSleeping: 'sleeping', sleeping: 'sleeping', toMirror: 'sea', sea: 'sea', dolphins: 'sea', mirror: 'mirror', mirrorEnd: 'mirror',
  toHarbour: 'home', toHome: 'home', home: 'home', jetty: 'home', summit: 'home',
};

/** The opening uses only DOM/SVG, so it can be drawn before the game and its graphics context exist. */
class StartScreen {
  readonly enabled = !QA || !params.shot || new URLSearchParams(location.search).get('start') === '1';
  started = !this.enabled;
  private ui: StartUI | null = null;
  private air: VeilWind | null = null;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly events = new AbortController();
  private start: ((pick?: string) => void) | null = null;
  private pointer: Point | null = null;
  private pressed = false;
  private travel = 0;
  private cleanupTimer = 0;
  private disposed = false;
  private failedPermanently = false;
  private stage: LoadingStage | null = null;
  private percent = -1;
  private painting: HTMLImageElement | null = null;
  private shade: HTMLElement | null = null;
  private decoded = false;
  private startOver: HTMLButtonElement | null = null;
  private departedAt = 0;
  private liftTimer = 0;

  constructor() {
    const veil = document.getElementById('veil')!;
    const ui = this.ui = {
      veil,
      button: document.getElementById('begin') as HTMLButtonElement,
      stageText: veil.querySelector<HTMLElement>('.progress-stage')!,
      percentText: veil.querySelector<HTMLElement>('.progress-percent')!,
    };
    if (params.shot) document.body.classList.add('shot');
    if (!this.enabled) {
      this.dispose();
      return;
    }
    const saved = params.progress ? readProgress() : null;
    ui.button.firstElementChild!.textContent = saved ? 'Continue' : 'Begin';
    const chapter = saved?.chapter ?? params.chapter;
    document.getElementById('home-screen-note')!.hidden = !swipeLeavesFullscreen();
    ui.veil.classList.toggle('night', (params.dusk ?? 0) > 1.3 || ['toWood', 'wood', 'dark', 'fears', 'toSleeping', 'sleeping', 'home', 'summit'].includes(chapter ?? ''));
    const room = PAINTINGS[chapter ?? 'island'];
    if (room) this.paint(room);
    const finished = params.progress && hasFinished();
    if (saved) this.offerStartOver(finished);

    const options = { signal: this.events.signal };
    this.air = new VeilWind(ui.veil.querySelector('.veil-wind')!, ui.veil.querySelector('.veil-colour')!, this.events.signal);
    ui.veil.addEventListener('pointermove', e => this.move(e), options);
    ui.veil.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button !== 0) return;
      this.pressed = true;
      this.travel = 0;
      this.pointer = { x: e.clientX, y: e.clientY };
      ui.veil.setPointerCapture(e.pointerId);
    }, options);
    ui.veil.addEventListener('pointerup', e => {
      if (!e.isPrimary) return;
      this.pressed = false;
      if (e.pointerType !== 'mouse') this.pointer = null;
    }, options);
    ui.veil.addEventListener('pointercancel', () => {
      this.pressed = false;
      this.travel = Infinity;
      this.pointer = null;
    }, options);
    ui.veil.addEventListener('pointerleave', () => {
      if (!this.pressed) this.pointer = null;
    }, options);
    ui.veil.addEventListener('click', e => {
      // A touch stroke may explore the wind without entering. Keyboard activation has detail === 0.
      if (e.detail !== 0 && this.travel > T.tapTravel) return;
      this.begin();
    }, options);
    window.addEventListener('resize', () => { this.pointer = null; }, options);
    // New players never download chapter select.
    if (finished) {
      void import('./chapter-select/chapter-select').then(m => {
        if (this.disposed || this.started) return;
        m.offerChapters(ui.veil, pick => this.begin(pick), this.events.signal);
        // Keeps the focus order the reading order: chapters, then start over.
        if (this.startOver) ui.veil.append(this.startOver);
      }, () => {});
    }
  }

  /** Shows the stage and a whole percentage that never falls; the live region hears only the stage changes. */
  progress(stage: LoadingStage, fraction: number): void {
    const ui = this.ui;
    if (!ui || this.failedPermanently) return;
    const { line, from, to } = STAGES[stage];
    const percent = Math.max(this.percent, Math.floor(from + (to - from) * Math.min(1, Math.max(0, fraction))));
    if (stage !== this.stage) {
      this.stage = stage;
      ui.stageText.textContent = line;
      document.getElementById('start-status')!.textContent = line;
    }
    if (percent !== this.percent) {
      this.percent = percent;
      ui.percentText.textContent = `${percent}%`;
    }
  }

  /** `start` gets the room a chapter pick chose; without one the game starts from the save or `?chapter=`. */
  ready(start: (sound: boolean, pick?: string) => void): void {
    if (!this.enabled) { start(false); return; }
    const ui = this.ui;
    if (!ui) return;
    this.start = pick => start(true, pick);
    ui.veil.setAttribute('aria-busy', 'false');
    const status = document.getElementById('start-status')!;
    if (status.textContent === 'Loading' || (this.stage && status.textContent === STAGES[this.stage].line)) status.textContent = '';
    ui.button.disabled = false;
    // Decided once: a painting that decodes later is never shown, so nothing moves once on screen.
    if (this.decoded && this.painting?.complete && this.painting.naturalWidth) ui.veil.classList.add('painted');
    else this.unpaint();
    ui.veil.classList.add('ready');
  }

  musicLoading(active: boolean): void {
    const ui = this.ui;
    if (!ui || this.failedPermanently) return;
    ui.veil.classList.toggle('ready', !active);
    ui.veil.setAttribute('aria-busy', String(active));
    ui.stageText.textContent = active ? 'Preparing music' : '';
    ui.percentText.textContent = '';
    document.getElementById('start-status')!.textContent = active ? 'Preparing music' : '';
  }

  /** Called after the first real frames, never over the warm-up render that shows hidden objects. */
  reveal(): void {
    const ui = this.ui;
    if (!ui || !this.started || this.liftTimer || ui.veil.classList.contains('lifted')) return;
    // The painting leaves with Continue before the veil dissolves, so it never cross-fades into the game's own view.
    const wait = ui.veil.classList.contains('painted') && !this.reduced.matches ? this.departedAt + 800 - performance.now() : 0;
    if (wait > 0) this.liftTimer = window.setTimeout(() => this.lift(), wait);
    else this.lift();
  }

  private lift(): void {
    const ui = this.ui;
    if (!ui) return;
    ui.veil.classList.add('lifted');
    ui.veil.addEventListener('transitionend', e => {
      if (e.target === ui.veil && e.propertyName === 'opacity') this.dispose();
    }, { signal: this.events.signal });
    this.cleanupTimer = window.setTimeout(() => this.dispose(), this.reduced.matches ? 500 : 2300);
  }

  /**
   * `permanent`: a fixed hardware/driver limitation, not something a reload can fix (missing WebGL2 render
   * target support). Hides Try again instead of wiring it to reload. A later, ordinary failure cannot
   * un-hide it: once the game is known unplayable here, it stays that way for this page.
   */
  fail(permanent = false): void {
    const ui = this.ui;
    if (!ui || this.failedPermanently) return;
    this.started = false;
    ui.veil.querySelector('.chapters-toggle')?.remove();
    this.startOver?.remove();
    this.startOver = null;
    ui.veil.classList.remove('painted');
    this.unpaint();
    if (permanent) {
      this.failedPermanently = true;
      ui.veil.setAttribute('aria-busy', 'false');
      document.getElementById('start-status')!.textContent = "The game couldn't start.";
      ui.stageText.textContent = "The game couldn't start.";
      ui.percentText.textContent = '';
      ui.button.hidden = true;
      return;
    }
    ui.button.firstElementChild!.textContent = 'Try again';
    document.getElementById('start-status')!.textContent = "The game couldn't start. Try again.";
    this.ready(() => location.reload());
  }

  private begin(pick?: string): void {
    const ui = this.ui;
    if (!ui || !this.start || this.started) return;
    this.started = true;
    this.departedAt = performance.now();
    ui.button.disabled = true;
    ui.veil.classList.add('departing');
    this.air?.finish();
    this.start(pick); // AudioContext creation/resume must remain in this user gesture.
  }

  /** One file per visit, fetched as soon as the room is known and at low priority, so it never competes with the game. */
  private paint(room: string): void {
    const ui = this.ui;
    if (!ui) return;
    const img = document.createElement('img');
    img.className = 'veil-painting';
    img.dataset.room = room;
    img.alt = '';
    img.decoding = 'async';
    img.fetchPriority = 'low';
    img.src = new URL(`./paintings/${room}-${innerWidth / innerHeight < 3 / 4 ? 'port' : 'land'}.webp`, import.meta.url).href;
    img.decode().then(() => { if (!this.disposed) this.decoded = true; }, () => {});
    const shade = document.createElement('div');
    shade.className = 'veil-shade';
    const wind = ui.veil.querySelector('.veil-wind');
    ui.veil.insertBefore(img, wind);
    ui.veil.insertBefore(shade, wind);
    this.painting = img;
    this.shade = shade;
  }

  private unpaint(): void {
    this.painting?.removeAttribute('src');
    this.painting?.remove();
    this.shade?.remove();
    this.painting = this.shade = null;
  }

  /** Two presses: the first asks, the second starts the first island over the save. Its presses stay its own. */
  private offerStartOver(finished: boolean): void {
    const ui = this.ui;
    if (!ui) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'start-over';
    button.textContent = 'start over';
    ui.veil.classList.toggle('finished', finished);
    const options = { signal: this.events.signal };
    let asking = 0;
    this.events.signal.addEventListener('abort', () => clearTimeout(asking), { once: true });
    const settle = (): void => {
      if (this.started || !ui.veil.classList.contains('asking')) return;
      clearTimeout(asking);
      ui.veil.classList.remove('asking');
      button.textContent = 'start over';
    };
    for (const type of ['pointerdown', 'click'] as const) button.addEventListener(type, e => e.stopPropagation(), options);
    // Safari blurs even an already-focused button on mousedown, cancelling the pending confirmation.
    button.addEventListener('mousedown', e => { if (e.button === 0) e.preventDefault(); }, options);
    button.addEventListener('click', () => {
      if (ui.veil.classList.contains('asking')) { this.begin('island'); return; }
      ui.veil.classList.add('asking');
      button.textContent = 'start over and lose your progress?';
      // Safari leaves a clicked button unfocused, and the question goes back when focus leaves it.
      button.focus({ preventScroll: true });
      asking = window.setTimeout(settle, T.startOverAsks * 1000);
    }, options);
    button.addEventListener('blur', settle, options);
    window.addEventListener('keydown', e => { if (e.key === 'Escape') settle(); }, options);
    ui.veil.append(button);
    this.startOver = button;
  }

  private move(e: PointerEvent): void {
    if (!e.isPrimary) return;
    if (this.started) return;
    const point = { x: e.clientX, y: e.clientY };
    if (!this.pointer) { this.pointer = point; return; }
    const dx = point.x - this.pointer.x, dy = point.y - this.pointer.y;
    if (this.pressed) this.travel += Math.hypot(dx, dy);
    this.pointer = point;
    this.air?.move(dx, dy);
  }

  private dispose(): void {
    const ui = this.ui;
    if (!ui) return;
    this.disposed = true;
    this.events.abort();
    clearTimeout(this.cleanupTimer);
    clearTimeout(this.liftTimer);
    this.air?.dispose();
    this.air = null;
    this.unpaint();
    ui.veil.remove();
    ui.veil.replaceChildren();
    this.ui = null;
    this.start = null;
    this.startOver = null;
    this.pointer = null;
    document.body.classList.remove('starting');
    document.getElementById('view')!.inert = false;
  }
}

/** iPad Safari leaves page full screen on any downward swipe; launching from the Home Screen avoids it. */
function swipeLeavesFullscreen(): boolean {
  const ua = navigator.userAgent;
  const iPad = navigator.maxTouchPoints > 1 && /iPad|Macintosh/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  const inBrowser = !matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  return iPad && inBrowser && document.fullscreenEnabled;
}

export const startScreen = new StartScreen();
