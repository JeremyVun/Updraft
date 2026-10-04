/** A soft ring that replaces the system cursor; it tightens and glows while an updraft charges. */
export class Cursor {
  private readonly el: HTMLDivElement;
  private x = -100;
  private y = -100;
  private visible = false;
  private mouse = false;
  private transform = '';
  private opacity = '';
  private glow = '';

  constructor(canvas: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'cursor';
    document.body.appendChild(this.el);
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.x = e.clientX;
      this.y = e.clientY;
      this.visible = true;
      this.mouse = true;
    });
    canvas.addEventListener('pointerleave', () => {
      this.visible = false;
    });
  }

  update(gust: number, charge: number, down: boolean): void {
    if (!this.mouse) return;
    const stretch = 1 + Math.min(gust, 26) / 40;
    const scale = (down ? 0.8 : 1) * (1 - charge * 0.35) * stretch;
    const transform = `translate(${this.x}px, ${this.y}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
    if (transform !== this.transform) this.el.style.transform = this.transform = transform;
    const opacity = this.visible ? (0.5 + charge * 0.5).toFixed(2) : '0';
    if (opacity !== this.opacity) this.el.style.opacity = this.opacity = opacity;
    const glow = charge.toFixed(3);
    if (glow !== this.glow) this.el.style.setProperty('--charge', this.glow = glow);
  }
}
