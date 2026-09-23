import { params } from './params';
import { readProgress } from './story/progress';
import { tuning } from './tuning';
import { VeilWind } from './input/veil-wind';

const T = tuning.veil;
interface Point { x: number; y: number }

/** The opening uses only DOM/SVG, so it can be drawn before the game and its graphics context exist. */
class StartScreen {
  readonly enabled = !params.shot || new URLSearchParams(location.search).get('start') === '1';
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

  constructor() {
    if (params.shot) document.body.classList.add('shot');
    if (!this.enabled) {
      this.dispose();
      return;
    }
    const saved = params.progress ? readProgress() : null;
    this.button.firstElementChild!.textContent = saved ? 'Continue' : 'Begin';
    const chapter = saved?.chapter ?? params.chapter;
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
  }

  ready(start: (sound: boolean) => void): void {
    if (!this.enabled) { start(false); return; }
    this.start = () => start(true);
    this.veil.setAttribute('aria-busy', 'false');
    if (document.getElementById('start-status')!.textContent === 'Loading') document.getElementById('start-status')!.textContent = '';
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
    if (permanent) {
      this.failedPermanently = true;
      this.veil.setAttribute('aria-busy', 'false');
      document.getElementById('start-status')!.textContent = "The game couldn't start.";
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

export const startScreen = new StartScreen();
