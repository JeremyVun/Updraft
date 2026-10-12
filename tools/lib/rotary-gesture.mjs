export async function releaseRotary(page, index, touch = null, capture = async () => {}) {
  const { width, height } = page.viewportSize();
  let caughtCaptured = false;
  for (let stroke = 0; stroke < 10; stroke++) {
    const at = await page.evaluate(index => {
      const p = __game.rotaryWashing.rotors[index].snagTarget;
      if (!p) return null;
      const v = p.clone().project(__game.rig.camera);
      return [(v.x + 1) / 2, (1 - v.y) / 2];
    }, index);
    if (!at) return;
    const span = Math.min(width, height) * .065;
    const a = { x: at[0] * width + span, y: at[1] * height - span * .2 };
    const b = { x: at[0] * width - span, y: at[1] * height + span * .2 };
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    else { await page.mouse.move(-10, -10); await page.mouse.move(a.x, a.y); }
    for (let step = 1; step <= 45; step++) {
      const x = a.x + (b.x - a.x) * step / 45, y = a.y + (b.y - a.y) * step / 45;
      if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
      else await page.mouse.move(x, y);
      await page.waitForTimeout(20);
      const work = await page.evaluate(index => __game.rotaryWashing.rotors[index].unhook, index);
      if (!caughtCaptured && work > .25 && work < .8) { await capture('rotary-caught-under-tension'); caughtCaptured = true; }
      if (work === 1) {
        if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        else await page.mouse.move(-10, -10);
        await capture('rotary-release');
        await page.waitForTimeout(700);
        return;
      }
    }
    if (touch) await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await page.mouse.move(-10, -10);
    await page.waitForTimeout(250);
    if (process.env.DEBUG_ROTARY) console.log('snag', stroke, await page.evaluate(index => {
      const r = __game.rotaryWashing.rotors[index]; return { work: r.unhook, gust: r.snagWind };
    }, index));
  }
  throw new Error(`Rotary ${index} did not release`);
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
    const direction = r.preferredDirection * (reverse ? -1 : 1);
    const a = best.clone().addScaledVector(tangent, -2.6 * direction).project(cam);
    const b = best.clone().addScaledVector(tangent, 2.6 * direction).project(cam);
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
      await page.waitForFunction(() => __game.story.current.beat === 'rotarySnag', null, { timeout: 30000 });
      await page.waitForTimeout(5500);
      await capture('rotary-inside');
      for (let i = 0; i < 3; i++) await turnRotary(page, reverse, touch, index);
      await capture('rotary-snagged');
    }
    if (index === 1) { await releaseRotary(page, index, touch, capture); await capture('rotary-freed'); }
    if (reverse) await turnRotary(page, true, touch, index);
    for (let stroke = 0; stroke < 35; stroke++) {
      await turnRotary(page, false, touch, index);
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
