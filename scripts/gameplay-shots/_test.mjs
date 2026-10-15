// Gameplay shots for the promo trailers, recorded by scripts/capture-gameplay.mjs.
//
// Each shot: {name, about, url, seconds, setup(ctx), look, keys, press, events, keep, waitFor}
//   url      the game URL (relative to the served doom-web/), e.g. '?level=five-prisons&ceo=altman'
//   setup    real-time positioning before recording: ctx = {page, q (native QA), g (gauntlet QA),
//            meta (gauntlet map), net(name, ...args) -> netevent pdplay_<name>, read()}
//   look     view program keyframes (see capture-gameplay.mjs program()); times in seconds from record start
//   keys     held keys [{key, from, to}]   (w a s d shift ctrl space e c t 1-5 left right)
//   press    taps [{key, at, hold?}]
//   events   PDPlayCap events [{at, name, args}]: pose x y angle pitch | hunter x y angle mode | hunterwalk |
//            free site | buddha 1 | heal n | summon kind x y angle
//   keep     extra page UI to keep: 'text' (status line / prompts), 'dialogue', 'prologue-hud'


const altman = '?level=five-prisons';

export default [
  {
    name: 'walk-test', about: 'pipeline check: walk the opening corridor', url: altman, seconds: 3,
    setup: async ({q}) => { await q.command('god'); },
    look: [{at: 0, dyaw: 0}, {at: 3, dyaw: 25}],
    keys: [{key: 'w', from: 0.2, to: 2.8}],
    press: [{key: 'ctrl', at: 1.5}],
  },
  {
    name: 'finale-rockets-draft', about: 'first rough finale test (superseded by prologue.mjs)', url: '?prologue=1', seconds: 6,
    waitFor: s => s.prologue?.clock > 35,
    setup: async ({q, g, page}) => {
      await q.command('god');
      await g.toFinale();
      await g.stepOut();
      await q.command('give rocketlauncher');
      await q.command('give ammo');
      await page.waitForTimeout(2500);
      await q.command('god');
      await q.command('buddha');
      await page.evaluate(() => { for (const evType of ['keydown', 'keyup']) window.__QA_WORKER__.postMessage({type: 'input', target: 'window', evType, init: {code: 'Digit5', key: '5', keyCode: 53, which: 53, bubbles: true, cancelable: true}}); });
      await page.waitForTimeout(800);
    },
    look: [{at: 0, track: 'monster', rate: 0.12}],
    keys: [{key: 'ctrl', from: 0.3, to: 5.6}, {key: 'd', from: 1.0, to: 2.4}, {key: 'a', from: 3.2, to: 4.6}],
    keep: ['prologue-hud'],
  },
];
