// Prints the step list for a whole automated playthrough, for tools/play.mjs.
// Usage: node tools/play.mjs /tmp/updraft-run "$(node tools/playthrough.mjs)"
// It gusts over the island until life returns, then follows the story: the crossing (pushing the sail
// now and then) and the long walk inland, logging the chapter, beat and frame rate as it goes.
// The whole run takes 10-15 minutes of wall time and holds the browser lock, so do not start one while
// another agent is capturing.

const log = {
  eval: `(() => {
    const g = window.__game;
    const c = g.story.current;
    return {
      t: Math.round(performance.now() / 1000),
      chapter: g.story.name,
      beat: c.beat ?? null,
      life: Math.round(g.story.worldLife * 100) / 100,
      child: [Math.round(g.child.position.x), Math.round(g.child.position.z)],
      fps: window.__stats && window.__stats.fps,
    };
  })()`,
};

const steps = [{ wait: 3000 }, { shot: 'start' }];

// Wake the island: sweep the meadow until life has come back.
for (let i = 0; i < 70; i++) {
  const y = 0.45 + (i % 7) * 0.045;
  const dir = i % 2 ? 1 : -1;
  steps.push({ swipe: [[0.5 - 0.32 * dir, y], [0.5, y - 0.03], [0.5 + 0.32 * dir, y]], ms: 900 }, { wait: 450 });
  if (i % 10 === 9) steps.push(log);
}
steps.push({ shot: 'island' });

// The crossing: a push into the sail now and then.
for (let k = 0; k < 40; k++) {
  steps.push({ wait: 6000 }, log);
  if (k % 3 === 0) steps.push({ swipe: [[0.5, 0.85], [0.5, 0.55], [0.52, 0.3]], ms: 800 });
  if (k % 5 === 4) steps.push({ shot: `crossing-${k}` });
}

// The hills, the last hill and the night.
for (let k = 0; k < 70; k++) {
  steps.push({ wait: 8000 }, log);
  if (k === 2) steps.push({ swipe: [[0.35, 0.7], [0.5, 0.62], [0.65, 0.7]], ms: 800 });
  if (k % 4 === 3) steps.push({ shot: `hills-${k}` });
}

process.stdout.write(JSON.stringify(steps));
