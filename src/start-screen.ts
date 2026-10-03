import { params } from './params';
import { QA } from './qa';
import { chosenChapter, hasFinished, readProgress } from './story/progress';
import { tuning } from './tuning';
import { VeilWind } from './input/veil-wind';

declare const __QA__: boolean;
// Vite must drop this import before extracting CSS assets.
if (typeof __QA__ === 'undefined' || __QA__) void import('./styles-qa.css');

const T = tuning.veil;
interface Point { x: number; y: number }

/** What the veil says the game is doing, and the share of the number each stage covers (design: boot-veil, Progress). */
const STAGES = {
  build: { line: 'Building the world', from: 3, to: 41 },
  graphics: { line: 'Preparing the graphics', from: 41, to: 95 },
  ground: { line: 'Laying out the ground and grass', from: 95, to: 100 },
} as const;
export type LoadingStage = keyof typeof STAGES;

/** The opening uses only DOM/SVG, so it can be drawn before the game and its graphics context exist. */
class StartScreen {
  readonly enabled = !QA || !params.shot || new URLSearchParams(location.search).get('start') === '1';
  started = !this.enabled;
  private readonly veil = document.getElementById('veil')!;
  private readonly button = document.getElementById('begin') as HTMLButtonElement;
  private air: VeilWind | null = null;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly events = new AbortController();
  private start: (() => void) | null = null;
  private pointer: Point | null = null;
  private pressed = false;
  private travel = 0;
  private cleanupTimer = 0;
  private disposed = false;
  private failedPermanently = false;
  private stage: LoadingStage | null = null;
  private percent = -1;
  private readonly stageText = this.veil.querySelector<HTMLElement>('.progress-stage')!;
  private readonly percentText = this.veil.querySelector<HTMLElement>('.progress-percent')!;

  constructor() {
    if (params.shot) document.body.classList.add('shot');
    if (!this.enabled) {
      this.dispose();
      return;
    }
    const saved = params.progress ? readProgress() : null;
    this.button.firstElementChild!.textContent = saved ? 'Continue' : 'Begin';
    const chapter = saved?.chapter ?? params.chapter ?? (params.progress ? chosenChapter() : null);
    document.getElementById('home-screen-note')!.hidden = !swipeLeavesFullscreen();
    this.veil.classList.toggle('night', (params.dusk ?? 0) > 1.3 || ['toWood', 'wood', 'dark', 'toSleeping', 'sleeping', 'home', 'summit'].includes(chapter ?? ''));

    const options = { signal: this.events.signal };
    this.air = new VeilWind(this.veil.querySelector('.veil-wind')!, this.veil.querySelector('.veil-colour')!, this.events.signal);
    this.veil.addEventListener('pointermove', e => this.move(e), options);
    this.veil.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button !== 0) return;
      this.pressed = true;
      this.travel = 0;
      this.pointer = { x: e.clientX, y: e.clientY };
      this.veil.setPointerCapture(e.pointerId);
    }, options);
    this.veil.addEventListener('pointerup', e => {
      if (!e.isPrimary) return;
      this.pressed = false;
      if (e.pointerType !== 'mouse') this.pointer = null;
    }, options);
    this.veil.addEventListener('pointercancel', () => {
      this.pressed = false;
      this.travel = Infinity;
      this.pointer = null;
    }, options);
    this.veil.addEventListener('pointerleave', () => {
      if (!this.pressed) this.pointer = null;
    }, options);
    this.veil.addEventListener('click', e => {
      // A touch stroke may explore the wind without entering. Keyboard activation has detail === 0.
      if (!this.start || this.started || (e.detail !== 0 && this.travel > T.tapTravel)) return;
      this.started = true;
      this.button.disabled = true;
      this.veil.classList.add('departing');
      this.air?.finish();
      this.start(); // AudioContext creation/resume must remain in this user gesture.
    }, options);
    window.addEventListener('resize', () => { this.pointer = null; }, options);
    // New players never download chapter select.
    if (params.progress && hasFinished()) {
      void import('./chapter-select/chapter-select').then(m => { if (!this.disposed && !this.started) m.offerChapters(this.veil); }, () => {});
    }
  }

  /** Shows the stage and a whole percentage that never falls; the live region hears only the stage changes. */
  progress(stage: LoadingStage, fraction: number): void {
    if (!this.enabled || this.disposed || this.failedPermanently) return;
    const { line, from, to } = STAGES[stage];
    const percent = Math.max(this.percent, Math.floor(from + (to - from) * Math.min(1, Math.max(0, fraction))));
    if (stage !== this.stage) {
      this.stage = stage;
      this.stageText.textContent = line;
      document.getElementById('start-status')!.textContent = line;
    }
    if (percent !== this.percent) {
      this.percent = percent;
      this.percentText.textContent = `${percent}%`;
    }
  }

  ready(start: (sound: boolean) => void): void {
    if (!this.enabled) { start(false); return; }
    this.start = () => start(true);
    this.veil.setAttribute('aria-busy', 'false');
    const status = document.getElementById('start-status')!;
    if (status.textContent === 'Loading' || (this.stage && status.textContent === STAGES[this.stage].line)) status.textContent = '';
    this.button.disabled = false;
    this.veil.classList.add('ready');
  }

  /** Called after the first real frames, never over the warm-up render that shows hidden objects. */
  reveal(): void {
    if (this.disposed || !this.started || this.veil.classList.contains('lifted')) return;
    this.veil.classList.add('lifted');
    this.veil.addEventListener('transitionend', e => {
      if (e.target === this.veil && e.propertyName === 'opacity') this.dispose();
    }, { signal: this.events.signal });
    this.cleanupTimer = window.setTimeout(() => this.dispose(), this.reduced.matches ? 500 : 2300);
  }

  /**
   * `permanent`: a fixed hardware/driver limitation, not something a reload can fix (missing WebGL2 render
   * target support). Hides Try again instead of wiring it to reload. A later, ordinary failure cannot
   * un-hide it: once the game is known unplayable here, it stays that way for this page.
   */
  fail(permanent = false): void {
    if (this.disposed || this.failedPermanently) return;
    this.started = false;
    this.veil.querySelector('.chapters-toggle')?.remove();
    if (permanent) {
      this.failedPermanently = true;
      this.veil.setAttribute('aria-busy', 'false');
      document.getElementById('start-status')!.textContent = "The game couldn't start.";
      this.stageText.textContent = "The game couldn't start.";
      this.percentText.textContent = '';
      this.button.hidden = true;
      return;
    }
    this.button.firstElementChild!.textContent = 'Try again';
    document.getElementById('start-status')!.textContent = "The game couldn't start. Try again.";
    this.ready(() => location.reload());
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
    this.disposed = true;
    this.events.abort();
    clearTimeout(this.cleanupTimer);
    this.air?.dispose();
    this.veil.remove();
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
