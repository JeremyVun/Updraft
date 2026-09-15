/** A smooth curve through (x, y) keys, Catmull-Rom between them and flat beyond the ends. */
export function curve(keys: readonly (readonly [number, number])[]): (x: number) => number {
  const n = keys.length;
  return (x) => {
    if (x <= keys[0][0]) return keys[0][1];
    if (x >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (keys[i + 1][0] < x) i++;
    const [x1, y1] = keys[i];
    const [x2, y2] = keys[i + 1];
    const [x0, y0] = keys[Math.max(0, i - 1)];
    const [x3, y3] = keys[Math.min(n - 1, i + 2)];
    const t = (x - x1) / (x2 - x1);
    const m1 = i > 0 ? ((y2 - y0) / (x2 - x0)) * (x2 - x1) : y2 - y1;
    const m2 = i + 2 < n ? ((y3 - y1) / (x3 - x1)) * (x2 - x1) : y2 - y1;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * y2 + (t3 - t2) * m2;
  };
}
