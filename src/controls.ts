import { params } from './params';
import type { QualityMode } from './gl/quality';
import { readQualityMode, saveQualityMode } from './gl/quality-preference';

/** Lightweight controls work before the game bundle loads; engine callbacks attach later. */
class Controls {
  readonly qualityEnabled = !params.shot && !params.lite && params.ratio === null && params.msaa === null && params.grass === null && params.mirror === null;
  qualityMode: QualityMode = this.qualityEnabled ? readQualityMode() : 'auto';
  soundOn = !params.shot;
  onSoundChange: ((on: boolean) => void) | null = null;
  onQualityChange: ((mode: QualityMode) => void) | null = null;
  private readonly sound = document.getElementById('sound') as HTMLButtonElement;
  private readonly quality = document.getElementById('quality') as HTMLButtonElement;
  private renderedQuality: Exclude<QualityMode, 'auto'> | null = null;

  constructor() {
    this.setSound(this.soundOn);
    this.sound.addEventListener('click', () => {
      this.setSound(!this.soundOn);
      this.onSoundChange?.(this.soundOn);
    });
    const quality = document.getElementById('quality') as HTMLButtonElement;
    const menu = document.getElementById('quality-menu')!;
    const dismiss = document.getElementById('quality-dismiss')!;
    const options = Array.from(menu.querySelectorAll<HTMLButtonElement>('[data-mode]'));
    document.getElementById('quality-control')!.hidden = !this.qualityEnabled;
    const syncQuality = () => {
      for (const option of options) option.setAttribute('aria-checked', String(option.dataset.mode === this.qualityMode));
      this.syncQualityIndicator();
    };
    const closeQuality = () => {
      menu.hidden = dismiss.hidden = true;
      quality.setAttribute('aria-expanded', 'false');
      quality.focus({preventScroll:true});
    };
    const openQuality = () => {
      menu.hidden = dismiss.hidden = false;
      quality.setAttribute('aria-expanded', 'true');
      options.find(option => option.dataset.mode === this.qualityMode)!.focus({preventScroll:true});
    };
    syncQuality();
    quality.addEventListener('click', () => menu.hidden ? openQuality() : closeQuality());
    quality.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); openQuality(); }
    });
    dismiss.addEventListener('click', closeQuality);
    for (const option of options) option.addEventListener('click', () => {
      this.qualityMode = option.dataset.mode as QualityMode;
      syncQuality();
      saveQualityMode(this.qualityMode);
      this.onQualityChange?.(this.qualityMode);
      closeQuality();
    });
    menu.addEventListener('keydown', event => {
      event.stopPropagation(); // M selects Medium here; it must not mute the game.
      const index = options.indexOf(document.activeElement as HTMLButtonElement);
      let next = -1;
      if (event.key === 'Escape') { event.preventDefault(); closeQuality(); return; }
      if (event.key === 'Tab') { closeQuality(); return; }
      if (event.key === 'ArrowDown') next = (index + 1) % options.length;
      if (event.key === 'ArrowUp') next = (index + options.length - 1) % options.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = options.length - 1;
      if (/^[ahml]$/i.test(event.key)) next = options.findIndex(option => option.textContent!.toLowerCase().startsWith(event.key.toLowerCase()));
      if (next >= 0) { event.preventDefault(); options[next].focus(); }
    });
    const fullscreen = document.getElementById('fullscreen') as HTMLButtonElement;
    fullscreen.hidden = !document.fullscreenEnabled;
    const syncFullscreen = () => {
      const active = document.fullscreenElement !== null;
      fullscreen.setAttribute('aria-pressed', String(active));
      fullscreen.setAttribute('aria-label', active ? 'Exit full screen' : 'Enter full screen');
    };
    fullscreen.addEventListener('click', () => {
      const change = document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen();
      void change.catch(syncFullscreen);
    });
    document.addEventListener('fullscreenchange', syncFullscreen);
  }

  /** The three bars follow world detail, including automatic governor changes. */
  setQualityDetail(detail: 0 | 1 | 2): void {
    this.renderedQuality = (['low', 'medium', 'high'] as const)[detail];
    this.syncQualityIndicator();
  }

  private syncQualityIndicator(): void {
    const names = { auto: 'Auto', low: 'Low', medium: 'Medium', high: 'High' };
    const current = this.renderedQuality ?? (this.qualityMode === 'auto' ? null : this.qualityMode);
    this.quality.dataset.quality = current ?? 'pending';
    const label = names[this.qualityMode];
    this.quality.title = `Graphics quality: ${label}${this.qualityMode === 'auto' && current ? ` (${names[current]})` : ''}`;
    this.quality.setAttribute('aria-label', this.quality.title);
  }

  /** Updates the preference/icon without starting audio behind the veil. */
  setSound(on: boolean): void {
    this.soundOn = on;
    this.sound.dataset.on = String(on);
    this.sound.setAttribute('aria-pressed', String(on));
  }
}

export const controls = new Controls();
