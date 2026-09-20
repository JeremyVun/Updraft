import { readProgress } from '../story/progress';
import { params } from '../params';
import { telemetry } from '../analytics/telemetry';

/** GPU simulation textures and raw readback fences cannot be resumed as ordinary scene resources. */
class ContextRecovery {
  lost = false;
  onPause: (() => void) | null = null;
  constructor() {
    const canvas = document.getElementById('view') as HTMLCanvasElement;
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      if (this.lost) return;
      this.lost = true;
      telemetry.failure('graphics');
      this.onPause?.();
      canvas.inert = true;
      const saved = params.progress && readProgress();
      const panel = document.getElementById('graphics-recovery')!;
      for (const sibling of document.body.children) {
        if (sibling instanceof HTMLElement && sibling !== panel) sibling.inert = true;
      }
      panel.hidden = false;
      panel.querySelector('p')!.textContent = saved ? 'The graphics stopped. Continue from your last checkpoint.' : 'The graphics stopped. Restart the game to try again.';
      document.body.classList.add('graphics-lost');
      const button = panel.querySelector('button')!;
      button.textContent = saved ? 'Continue from checkpoint' : 'Restart game';
      button.onclick = () => { telemetry.recovery(); location.reload(); };
      button.focus();
    });
  }
}
export const contextRecovery = new ContextRecovery();
