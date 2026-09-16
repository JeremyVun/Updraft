/**
 * `?stats`: a small on-screen readout for devices without a debugger (phones). QA only; the game itself shows
 * no text. Feed it one line per fact about twice a second.
 */
export function createReadout(): (lines: string[]) => void {
  const box = document.createElement('pre');
  box.style.cssText =
    'position:fixed;left:8px;top:8px;z-index:10;margin:0;padding:6px 8px;font:12px/1.35 ui-monospace,monospace;' +
    'color:#fff;background:rgba(0,0,0,0.55);border-radius:6px;pointer-events:none;white-space:pre;';
  document.body.appendChild(box);
  return (lines) => {
    box.textContent = lines.join('\n');
  };
}

/** Percentile of an array of numbers (0..1), or 0 when empty. */
export function percentile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}
