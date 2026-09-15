/** A soft ring that replaces the system cursor; it tightens and glows while an updraft charges. */
export class Cursor {
  private readonly el: HTMLDivElement;
  private x = -100;
  private y = -100;
  private visible = false;

  constructor(canvas: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'cursor';
    document.body.appendChild(this.el);
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.x = e.clientX;
      this.y = e.clientY;
      this.visible = true;
    });
    canvas.addEventListener('pointerleave', () => {
      this.visible = false;
    });
  }

  update(gust: number, charge: number, down: boolean): void {
    const stretch = 1 + Math.min(gust, 26) / 40;
    const scale = (down ? 0.8 : 1) * (1 - charge * 0.35) * stretch;
    this.el.style.transform = `translate(${this.x}px, ${this.y}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
    this.el.style.opacity = this.visible ? (0.5 + charge * 0.5).toFixed(2) : '0';
    this.el.style.setProperty('--charge', charge.toFixed(3));
  }
}
