// Push the nearest visible rotary sheet in the chosen direction with real pointer motion.
export async function turnRotary(page, reverse = false, touch = null) {
  const { width, height } = page.viewportSize();
  const { a, b } = await page.evaluate(reverse => {
    const g = __game, r = g.rotaryWashing, cam = g.rig.camera;
    const p = g.child.position.clone(), best = p.clone();
    let nearest = Infinity;
    for (const side of [-1, 1]) for (const fraction of [0.24, 0.5, 0.76]) {
      r.clothPoint(side, fraction, 2, p);
      const screen = p.clone().project(cam);
      if (Math.abs(screen.x) > 0.83 || Math.abs(screen.y) > 0.8) continue;
      const distance = p.distanceToSquared(cam.position);
      if (distance < nearest) { nearest = distance; best.copy(p); }
    }
    if (!Number.isFinite(nearest)) throw new Error('No visible rotary sheet');
    const k = g.tuning.rotaryWashing;
    const tangent = p.set(best.z - k.z, 0, k.x - best.x).normalize();
    const a = best.clone().addScaledVector(tangent, reverse ? 2.7 : -2.7).project(cam);
    const b = best.clone().addScaledVector(tangent, reverse ? -2.7 : 2.7).project(cam);
    return { a: [(a.x + 1) / 2, (1 - a.y) / 2], b: [(b.x + 1) / 2, (1 - b.y) / 2] };
  }, reverse);
  if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a[0] * width, y: a[1] * height }] });
  else { await page.mouse.move(-10, -10); await page.mouse.move(a[0] * width, a[1] * height); }
  for (let i = 1; i <= 45; i++) {
    const x = (a[0] + (b[0] - a[0]) * i / 45) * width, y = (a[1] + (b[1] - a[1]) * i / 45) * height;
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    else await page.mouse.move(x, y);
    await page.waitForTimeout(20);
  }
  if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

export async function openRotary(page, touch = null) {
  if (await page.evaluate(() => __game.rotaryWashing.open)) return;
  await page.waitForFunction(() => __game.story.current.beat === 'rotary', null, { timeout: 120000 });
  for (let stroke = 0; stroke < 35; stroke++) {
    await turnRotary(page, false, touch);
    if (await page.evaluate(() => __game.rotaryWashing.caught)) break;
  }
  await page.waitForFunction(() => __game.rotaryWashing.open, null, { timeout: 15000 });
}
