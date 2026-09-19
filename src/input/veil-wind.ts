import { tuning } from '../tuning';

const T = tuning.veil;
const NS = 'http://www.w3.org/2000/svg';
interface Point { x: number; y: number }
interface Ribbon {
  points: Point[];
  head: Point;
  angle: number;
  direction: number;
  curl: number;
  speed: number;
  velocity: Point;
  width: number;
  age: number;
  life: number;
  group: SVGGElement;
  body: SVGPathElement;
  halo: SVGPathElement;
}

/** A small screen-space version of WindLines: flowing heads, tapered tails and a curl before they die. */
export class VeilWind {
  private ribbons: Ribbon[] = [];
  private push = { x: 0, y: 0 };
  private offset = { x: 0, y: 0 };
  private clock = 0;
  private nextAmbient = T.ambientEvery;
  private last = 0;
  private raf = 0;
  private sequence = 0;
  private finishing = false;
  private disposed = false;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private readonly svg: SVGSVGElement, private readonly colour: HTMLElement, signal: AbortSignal) {
    const options = { signal };
    document.addEventListener('visibilitychange', () => this.schedule(), options);
    this.reduced.addEventListener('change', () => {
      this.clear();
      this.colour.style.transform = '';
      if (!this.reduced.matches) this.seed();
      this.schedule();
    }, options);
    window.addEventListener('resize', () => {
      this.clear();
      if (!this.reduced.matches) this.seed();
    }, options);
    if (!this.reduced.matches) this.seed();
    this.schedule();
  }

  private get scale(): number { return Math.max(.55, Math.min(1.2, innerWidth / 1200)); }

  move(dx: number, dy: number): void {
    if (this.finishing || this.reduced.matches) return;
    this.push.x = Math.max(-T.colourTravel, Math.min(T.colourTravel, this.push.x + dx * .12));
    this.push.y = Math.max(-T.colourTravel, Math.min(T.colourTravel, this.push.y + dy * .12));
  }

  finish(): void { this.finishing = true; }

  private seed(): void {
    // Two passages at different depths and ages, never a fixed central loading emblem.
    const a = this.spawn(innerWidth * .23, innerHeight * .38, -.15);
    const b = this.spawn(innerWidth * .65, innerHeight * .72, -.36);
    for (let i = 0; i < 96; i++) this.advance(a, 1 / 60);
    for (let i = 0; i < 44; i++) this.advance(b, 1 / 60);
    this.draw(a); this.draw(b);
  }

  private spawn(x: number, y: number, angle: number, speed = T.drift * this.scale * .8): Ribbon {
    const group = document.createElementNS(NS, 'g');
    group.dataset.source = 'ambient';
    const halo = document.createElementNS(NS, 'path'); halo.classList.add('wind-halo');
    const body = document.createElementNS(NS, 'path'); body.classList.add('wind-body');
    group.append(halo, body); this.svg.append(group);
    const ribbon: Ribbon = {
      points: [], head: { x, y }, angle, direction: angle,
      curl: this.sequence++ % 3 === 0 ? -1 : 1,
      speed, velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      width: 5.6 * this.scale,
      age: 0, life: T.ambientLife, group, body, halo,
    };
    // Start slender, with a tapered tail already following the head.
    for (let j = 28; j >= 0; j--) {
      const distance = j * 3.5 * this.scale;
      ribbon.points.push({ x: x - Math.cos(angle) * distance, y: y - Math.sin(angle) * distance });
    }
    this.ribbons.push(ribbon);
    if (this.ribbons.length > T.maxRibbons) this.ribbons.shift()!.group.remove();
    return ribbon;
  }

  private advance(r: Ribbon, dt: number): void {
    r.age += dt;
    const drag = Math.exp(-dt * .06);
    r.velocity.x *= drag; r.velocity.y *= drag;
    const tail = Math.max(0, (r.age / r.life - .56) / .44);
    if (tail > 0) {
      r.angle += r.curl * dt * (.3 + tail * tail * 4.5);
    } else {
      const bend = Math.sin(r.head.y * .004 + this.clock * .48) * .32 + Math.sin(r.head.x * .003 - this.clock * .31) * .2;
      const target = r.direction + bend;
      r.angle += Math.atan2(Math.sin(target - r.angle), Math.cos(target - r.angle)) * dt * .8;
    }
    const travelX = r.velocity.x * dt, travelY = r.velocity.y * dt;
    // A little curl develops within the drifting ribbon.
    const growth = Math.min(r.speed, Math.hypot(r.velocity.x, r.velocity.y)) * .22;
    r.head.x += travelX + Math.cos(r.angle) * growth * dt;
    r.head.y += travelY + Math.sin(r.angle) * growth * dt;
    // Carry the tail with the head, adding a slight flutter.
    for (const p of r.points) {
      const flutter = Math.sin((p.x + p.y) * .005 + this.clock * .5) * 3 * this.scale * dt;
      p.x += travelX - Math.sin(r.direction) * flutter;
      p.y += travelY + Math.cos(r.direction) * flutter;
    }
    const last = r.points.at(-1)!;
    if (Math.hypot(last.x - r.head.x, last.y - r.head.y) >= T.pointSpacing * this.scale) r.points.push({ ...r.head });
    if (r.points.length > T.maxPoints) r.points.shift();
  }

  private draw(r: Ribbon): void {
    const left: string[] = [], right: string[] = [];
    const points = r.points;
    for (let j = 0; j < points.length; j++) {
      const p = points[j], a = points[Math.max(0, j - 1)], b = points[Math.min(points.length - 1, j + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
      // Same asymmetric taper as the game's RibbonBatch, with a softer edge in CSS.
      const width = r.width * .5 * Math.sin(Math.PI * Math.pow(j / (points.length - 1), .7));
      left.push(`${(p.x - dy / length * width).toFixed(1)},${(p.y + dx / length * width).toFixed(1)}`);
      right.push(`${(p.x + dy / length * width).toFixed(1)},${(p.y - dx / length * width).toFixed(1)}`);
    }
    const d = `M${left.join(' L')} L${right.reverse().join(' L')}Z`;
    r.body.setAttribute('d', d); r.halo.setAttribute('d', d);
    const alpha = Math.min(1, r.age / .45) * Math.min(1, (r.life - r.age) / 1.2) * .29;
    r.group.setAttribute('opacity', Math.max(0, alpha).toFixed(3));
  }

  private schedule(): void {
    cancelAnimationFrame(this.raf);
    this.last = 0;
    if (!this.disposed && !document.hidden && !this.reduced.matches) this.raf = requestAnimationFrame(now => this.animate(now));
  }

  private animate(now: number): void {
    this.raf = requestAnimationFrame(next => this.animate(next));
    if (now - this.last < 1000 / 60) return;
    const dt = this.last ? Math.min((now - this.last) / 1000, .05) : 1 / 60;
    this.last = now;
    this.clock += dt;
    this.push.x *= Math.exp(-dt * .8); this.push.y *= Math.exp(-dt * .8);
    this.offset.x += (this.push.x - this.offset.x) * (1 - Math.exp(-dt * 2));
    this.offset.y += (this.push.y - this.offset.y) * (1 - Math.exp(-dt * 2));
    this.colour.style.transform = `translate(${this.offset.x.toFixed(2)}px, ${this.offset.y.toFixed(2)}px)`;
    if (!this.finishing && this.clock >= this.nextAmbient) {
      const lanes = [.28, .49, .76, .36, .21];
      this.spawn(innerWidth * (.1 + (this.sequence % 4) * .16), innerHeight * lanes[this.sequence % lanes.length], -.24);
      this.nextAmbient = this.clock + T.ambientEvery + Math.sin(this.sequence * 2.3) * .65;
    }
    for (let i = this.ribbons.length - 1; i >= 0; i--) {
      const r = this.ribbons[i];
      this.advance(r, dt);
      if (r.age >= r.life) { r.group.remove(); this.ribbons.splice(i, 1); }
      else this.draw(r);
    }
  }

  private clear(): void {
    this.svg.replaceChildren();
    this.ribbons = [];
    this.push.x = this.push.y = this.offset.x = this.offset.y = 0;
    this.nextAmbient = this.clock + T.ambientEvery;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.clear();
  }
}
