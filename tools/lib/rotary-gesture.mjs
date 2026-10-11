export async function liftRotary(page, index, touch = null) {
  const { width, height } = page.viewportSize();
  for (let circle = 0; circle < 14; circle++) {
    const at = await page.evaluate(index => {
      const p = __game.rotaryWashing.rotors[index].liftTarget;
      if (!p) return null;
      const v = p.clone().project(__game.rig.camera);
      return [(v.x + 1) / 2, (1 - v.y) / 2];
    }, index);
    if (!at) return;
    const radius = Math.min(width, height) * 0.07;
    for (let step = 0; step <= 36; step++) {
      const angle = step / 36 * Math.PI * 2;
      const x = at[0] * width + Math.cos(angle) * radius, y = at[1] * height + Math.sin(angle) * radius;
      if (touch) await touch.send('Input.dispatchTouchEvent', { type: circle === 0 && step === 0 ? 'touchStart' : 'touchMove', touchPoints: [{ x, y }] });
      else await page.mouse.move(x, y);
      await page.waitForTimeout(28);
    }
    if (await page.evaluate(index => !__game.rotaryWashing.rotors[index].liftTarget, index)) {
      if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      else await page.mouse.move(-10, -10);
      await page.waitForTimeout(700);
      return;
    }
  }
  throw new Error(`Rotary ${index} did not lift`);
}

export async function turnRotary(page, reverse = false, touch = null, index = 0) {
  const { width, height } = page.viewportSize();
  const { a, b } = await page.evaluate(({ reverse, index }) => {
    const r = __game.rotaryWashing.rotors[index], cam = __game.rig.camera;
    const p = r.top.clone(), best = p.clone();
    let nearest = Infinity;
    for (const side of [-1, 1]) for (const fraction of [0.24, 0.5, 0.76]) {
      r.clothPoint(side, fraction, 2.5, p);
      const screen = p.clone().project(cam);
      if (Math.abs(screen.x) > 0.83 || Math.abs(screen.y) > 0.8) continue;
      const distance = p.distanceToSquared(cam.position);
      if (distance < nearest) { nearest = distance; best.copy(p); }
    }
    if (!Number.isFinite(nearest)) throw new Error('No visible rotary sheet');
    const tangent = p.set(best.z - r.foot.z, 0, r.foot.x - best.x).normalize();
    const a = best.clone().addScaledVector(tangent, reverse ? 2.6 : -2.6).project(cam);
    const b = best.clone().addScaledVector(tangent, reverse ? -2.6 : 2.6).project(cam);
    return { a: [(a.x + 1) / 2, (1 - a.y) / 2], b: [(b.x + 1) / 2, (1 - b.y) / 2] };
  }, { reverse, index });
  if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a[0] * width, y: a[1] * height }] });
  else {
    await page.mouse.move(-10, -10); await page.waitForTimeout(50);
    await page.mouse.move(a[0] * width, a[1] * height); await page.waitForTimeout(30);
  }
  for (let i = 1; i <= 45; i++) {
    const x = (a[0] + (b[0] - a[0]) * i / 45) * width, y = (a[1] + (b[1] - a[1]) * i / 45) * height;
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    else await page.mouse.move(x, y);
    await page.waitForTimeout(20);
  }
  if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

export async function openRotary(page, touch = null, reverse = false, capture = async () => {}) {
  if (await page.evaluate(() => __game.rotaryWashing.open)) return;
  await page.waitForFunction(() => __game.story.current.beat === 'rotary', null, { timeout: 120000 });
  for (const index of [0, 1]) {
    if (index === 1) {
      for (let i = 0; i < 3; i++) await turnRotary(page, reverse, touch, index);
      await capture('rotary-snagged');
    }
    if (index === 1) { await liftRotary(page, index, touch); await capture('rotary-freed'); }
    for (let stroke = 0; stroke < 35; stroke++) {
      await turnRotary(page, reverse, touch, index);
      if (process.env.DEBUG_ROTARY) console.log(await page.evaluate(index => {
        const r = __game.rotaryWashing.rotors[index];
        return { index, angle:r.angle, speed:r.speed, direction:r.direction, gust:__game.input.gust, aligned:r.aligned };
      }, index));
      if (await page.evaluate(index => __game.rotaryWashing.rotors[index].aligned, index)) break;
    }
    await page.waitForFunction(index => __game.rotaryWashing.rotors[index].open, index, { timeout: 15000 });
    await capture(index ? 'rotary-open' : 'rotary-first-aligned');
  }
}
