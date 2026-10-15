import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attack, blocked, createState, distance, DT, estimate, give, interact, object, step } from '../src/sim.ts';
import type { State } from '../src/sim.ts';

const advance = (s: State, seconds: number, forecast = false) => {
  for (let tick = 0; tick < Math.ceil(seconds / DT); tick++) step(s, DT, {}, forecast);
};
const quiet = () => {
  const s = createState();
  s.hunter.stun = 1000;
  s.humans.forEach(h => h.order = 'hold');
  return s;
};
const place = (s: State, x: number, z: number, id = s.controlled) => {
  Object.assign(s.humans[id], { x, z });
};

test('camera requires reach, breaks through the ordinary attack action, and stays destroyed', () => {
  const s = quiet();
  assert.equal(interact(s, 'cam-supply'), false);
  place(s, 5, 21);
  s.yaw = 0;
  attack(s);
  assert.equal(object(s, 'cam-supply').active, false);
  assert.equal(interact(s, 'cam-supply'), false);
  assert.equal(s.revision, 1);
  assert.equal(s.shots, 0, 'unarmed camera destruction does not invent gun ammunition');
});

test('crate pushing changes route collision and a wall prevents an invalid push', () => {
  const s = quiet();
  assert.equal(blocked(s, 7, 17), true);
  place(s, 7, 19);
  assert.equal(interact(s, 'crate'), true);
  assert.deepEqual({ x: object(s, 'crate').x, z: object(s, 'crate').z }, { x: 7, z: 15 });
  assert.equal(blocked(s, 7, 17), false);
  assert.equal(blocked(s, 7, 15), true);
  const closed = quiet();
  place(closed, 5, 17);
  assert.equal(interact(closed, 'crate'), false);
  assert.equal(object(closed, 'crate').x, 7);
  assert.equal(object(closed, 'crate').active, true);
});

test('player movement collides with the crate and two pushes clear its narrow corridor', () => {
  const s = quiet();
  place(s, 7, 19);
  for (let i = 0; i < 20; i++) step(s, DT, { forward: 1 });
  assert.ok(s.humans[0].z > 18, 'player cannot pass through the initial crate');
  assert.equal(interact(s, 'crate'), true);
  for (let i = 0; i < 20; i++) step(s, DT, { forward: 1 });
  assert.ok(s.humans[0].z < 18 && s.humans[0].z > 16);
  assert.equal(interact(s, 'crate'), true);
  for (let i = 0; i < 20; i++) step(s, DT, { forward: 1 });
  assert.ok(s.humans[0].z < 16, 'second push clears space beyond the wall opening');
  assert.equal(object(s, 'crate').z, 13);
});

test('wall requires a collected charge; fuse consumes inventory, opens route, and hurts nearby humans', () => {
  const s = quiet();
  place(s, 17, 19);
  assert.equal(interact(s, 'cracked'), false);
  assert.equal(blocked(s, 17, 17), true);
  place(s, 5, 22);
  assert.equal(interact(s, 'charge'), true);
  assert.equal(s.inventory.bombs, 1);
  assert.equal(interact(s, 'charge'), false);
  place(s, 17, 19);
  place(s, 18, 18.8, 1);
  assert.equal(interact(s, 'cracked'), true);
  assert.equal(s.inventory.bombs, 0);
  assert.equal(interact(s, 'cracked'), false);
  advance(s, 1.5);
  assert.equal(object(s, 'cracked').active, true);
  advance(s, 0.4);
  assert.equal(object(s, 'cracked').active, false);
  assert.equal(blocked(s, 17, 17), false);
  assert.equal(s.humans[0].alive, false);
  assert.equal(s.humans[1].alive, false);
  assert.equal(s.humans[2].alive, true);
  assert.equal(s.controlled, 2);
  assert.ok(s.blast);
});

test('a picked-up weapon can be given to the nearest eligible companion, who fires autonomously', () => {
  const s = quiet();
  place(s, 9, 22);
  assert.equal(interact(s, 'gun-a'), true);
  assert.equal(s.humans[0].armed, true);
  place(s, 9, 23, 1);
  place(s, 3, 25, 2);
  assert.equal(give(s), true);
  assert.equal(s.humans[0].armed, false);
  assert.equal(s.humans[1].armed, true);
  assert.equal(give(s), false);
  Object.assign(s.hunter, { x: 9, z: 25, stun: 0 });
  step(s, DT);
  assert.equal(s.shots, 1);
  assert.ok(s.hunter.stun > 0);
  assert.ok(s.humans[1].cooldown > 0);
});

test('a nearby companion cannot receive a weapon through a wall but can after the route is open', () => {
  const s = quiet();
  place(s, 17, 18.2);
  place(s, 17, 15.8, 1);
  s.humans[0].armed = true;
  assert.ok(distance(s.humans[0], s.humans[1]) < 3);
  assert.equal(give(s), false, 'reach alone does not permit passing equipment through masonry');
  assert.equal(s.humans[0].armed, true);
  assert.equal(s.humans[1].armed, false);
  object(s, 'cracked').active = false;
  s.revision++;
  assert.equal(give(s), true, 'the same handoff works after the physical obstruction is removed');
  assert.equal(s.humans[0].armed, false);
  assert.equal(s.humans[1].armed, true);
});

test('wall explosion stuns a hunter within four metres and does not stun a distant hunter', () => {
  for (const separation of [3.9, 4, 12]) {
    const s = quiet();
    object(s, 'cracked').fuse = DT;
    Object.assign(s.hunter, { x: 17, z: 17 + separation, stun: 0 });
    step(s, DT);
    assert.equal(object(s, 'cracked').active, false);
    if (separation < 4) assert.ok(s.hunter.stun > 1.5, 'nearby explosion supplies the intended escape window');
    else assert.equal(s.hunter.stun, 0, 'remote explosions do not freeze the hunter');
  }
});

test('live bots follow, hold, and execute escape without forecast mode or player movement', () => {
  const s = quiet();
  place(s, 7, 23);
  place(s, 7, 27, 1);
  s.humans[1].order = 'follow';
  const before = distance(s.humans[0], s.humans[1]);
  advance(s, 1);
  assert.ok(distance(s.humans[0], s.humans[1]) < before - 1);
  s.humans[1].order = 'hold';
  const held = { x: s.humans[1].x, z: s.humans[1].z };
  advance(s, 0.5);
  assert.deepEqual({ x: s.humans[1].x, z: s.humans[1].z }, held);
  s.humans[1].order = 'escape';
  advance(s, 60);
  assert.equal(s.humans[1].safe, true);
  assert.equal(object(s, 'relay').open, true);
  assert.deepEqual({ x: s.humans[0].x, z: s.humans[0].z }, { x: 7, z: 23 });
});

test('hunter uses telegraphed aim followed by one-hit death and control transfers once', () => {
  const s = quiet();
  place(s, 27, 23);
  Object.assign(s.hunter, { x: 27, z: 25, stun: 0, aim: 0, target: 0 });
  step(s, DT);
  assert.equal(s.humans[0].alive, true, 'seeing the hunter is not an immediate unavoidable death');
  s.hunter.aim = 2;
  s.rng = 4729;
  step(s, DT);
  assert.equal(s.humans[0].alive, false);
  assert.equal(s.controlled, 2);
  assert.equal(s.humans.filter(h => h.controlled).length, 1);
  assert.equal(s.humans[2].controlled, true);
  assert.equal(s.mode, 'playing');
});

test('outside reveal does not win; relay enables rescue hatch and final safety, then transfers control', () => {
  const s = quiet();
  place(s, 7, 3);
  assert.equal(interact(s, 'rescue'), false);
  place(s, 17, 3);
  assert.equal(interact(s, 'hatch'), true);
  assert.equal(blocked(s, 17, 1), false);
  place(s, 17, -1);
  step(s, DT);
  assert.equal(s.firstOutside, true);
  assert.equal(s.humans[0].safe, false);
  assert.equal(s.mode, 'playing');
  assert.equal(blocked(s, 17, -32), true);
  place(s, 22, -9);
  assert.equal(interact(s, 'relay'), true);
  assert.equal(object(s, 'rescue').open, true);
  assert.equal(object(s, 'gate').open, true);
  assert.equal(s.objects.filter(o => o.kind === 'camera' && o.active).length, 0);
  assert.equal(blocked(s, 17, -32), false);
  place(s, 17, -35);
  step(s, DT);
  assert.equal(s.humans[0].safe, true);
  assert.equal(s.controlled, 2);
  assert.equal(s.mode, 'playing');
  assert.deepEqual(estimate(s, 48), { p: 0, failures: 0, samples: 48, terminal: true, horizon: 45 });
});

test('wide field permits roaming, while the fence forces movement through the unlocked gate', () => {
  const s = quiet();
  assert.equal(blocked(s, -70, -15), false);
  assert.equal(blocked(s, 100, -15), false);
  assert.equal(blocked(s, -81, -15), true);
  assert.equal(blocked(s, 111, -15), true);
  assert.equal(blocked(s, 17, -71), true);
  place(s, 17, -30);
  for (let i = 0; i < 20; i++) step(s, DT, { forward: 1 });
  assert.ok(s.humans[0].z > -31, 'closed gate stops the moving player');
  assert.equal(s.humans[0].safe, false);
  place(s, 22, -9);
  assert.equal(interact(s, 'relay'), true);
  assert.equal(blocked(s, 14, -32), true);
  assert.equal(blocked(s, 20, -32), true);
  assert.equal(blocked(s, 17, -32), false);
  assert.equal(blocked(s, 14, -30), false);
  assert.equal(blocked(s, 14, -34), false);
  place(s, 17, -30);
  for (let i = 0; i < 20 && !s.humans[0].safe; i++) step(s, DT, { forward: 1 });
  assert.equal(s.humans[0].safe, true);
  assert.ok(s.humans[0].z < -34);
});

test('followers and hunter pursue visible outdoor goals beyond the dungeon navigation grid', () => {
  const s = quiet();
  place(s, 60, -20);
  place(s, 55, -20, 1);
  s.humans[1].order = 'follow';
  advance(s, 1);
  assert.ok(s.humans[1].x > 56, 'distant field follower must not stop at a clamped grid boundary');
  assert.equal(s.humans[0].x, 60);
  const chase = quiet();
  place(chase, 65, -20);
  Object.assign(chase.hunter, { x: 60, z: -20, stun: 0, aim: 0, target: -1 });
  advance(chase, 0.3);
  assert.ok(chase.hunter.x > 60.3, 'hunter remains a threat beyond the old navigation grid');
  assert.equal(chase.humans[0].alive, true);
});

test('relay-open evacuation can use the rescue hatch when the main route is obstructed', () => {
  const s = quiet();
  place(s, 22, -9);
  assert.equal(interact(s, 'relay'), true);
  s.map[0] = s.map[0].slice(0, 8) + '#' + s.map[0].slice(9);
  s.revision++;
  place(s, 7, 26);
  place(s, 7, 3, 1);
  s.humans[1].order = 'escape';
  let crossingX: number | undefined;
  for (let i = 0; i < Math.ceil(60 / DT) && !s.humans[1].safe; i++) {
    const wasInside = s.humans[1].z >= 0;
    step(s, DT);
    if (wasInside && s.humans[1].z < 0) crossingX = s.humans[1].x;
  }
  assert.ok(crossingX !== undefined && crossingX > 6 && crossingX < 8, 'bot exits through the west rescue hatch');
  assert.equal(s.humans[1].safe, true);
});

test('all-dead loses and a fresh restart clears damaged world, equipment, death, and terminal state', () => {
  const s = quiet();
  object(s, 'cam-supply').active = false;
  object(s, 'cracked').active = false;
  s.inventory.bombs = 1;
  s.humans.forEach(h => h.alive = false);
  step(s, DT);
  assert.equal(s.mode, 'lost');
  assert.equal(estimate(s, 48).p, 1);
  const lost = structuredClone(s);
  step(s, DT, { forward: 1, attack: true, interact: true });
  assert.deepEqual(s, lost, 'terminal simulation does not continue processing input');
  const restarted = createState();
  assert.equal(restarted.mode, 'playing');
  assert.equal(restarted.time, 0);
  assert.equal(restarted.humans.filter(h => h.alive).length, 6);
  assert.equal(restarted.inventory.bombs, 0);
  assert.equal(object(restarted, 'cam-supply').active, true);
  assert.equal(object(restarted, 'cracked').active, true);
  assert.equal(object(restarted, 'gate').open, false);
});

test('a safe survivor makes extinction impossible even if every remaining human dies', () => {
  const s = quiet();
  s.humans.forEach(h => h.alive = false);
  s.humans[5].alive = true;
  s.humans[5].safe = true;
  step(s, DT);
  assert.equal(s.mode, 'won');
  assert.equal(estimate(s, 48).p, 0);
});

test('forecasts reproduce with separate seeds and never mutate the live world or RNG sequence', () => {
  const live = createState(123456);
  const pristine = structuredClone(live);
  const predicted = estimate(live, 8, 3);
  assert.deepEqual(live, pristine);
  assert.deepEqual(estimate(live, 8, 3), predicted);
  advance(live, 15);
  advance(pristine, 15);
  assert.deepEqual(live, pristine, 'forecast calls cannot consume the live hunter randomness');
});

test('forecast event is missing the safety deadline even when everyone remains alive', () => {
  const s = quiet();
  const prediction = estimate(s, 4, 1);
  assert.equal(prediction.p, 1);
  assert.equal(prediction.terminal, false);
  assert.equal(s.humans.every(h => h.alive), true);
  assert.equal(s.mode, 'playing');
});

test('paired stochastic futures respond to surveillance, a cleared route, and an armed companion', () => {
  const baseline = createState();
  const cameras = structuredClone(baseline);
  cameras.objects.filter(o => o.kind === 'camera').forEach(o => o.active = false);
  const wall = structuredClone(baseline);
  object(wall, 'cracked').active = false;
  const armed = structuredClone(baseline);
  armed.humans[1].armed = true;
  const crate = structuredClone(baseline);
  object(crate, 'crate').z = 13;
  const results = [baseline, cameras, wall, armed, crate].map(s => estimate(s, 16, 45));
  assert.ok(results[0].p > 0 && results[0].p < 1, 'baseline has nontrivial stochastic variation');
  assert.ok(results[1].p < results[0].p, 'disabled surveillance helps paired evacuation futures');
  assert.ok(results[2].p < results[0].p, 'a breached wall changes the evacuation result');
  assert.ok(results[3].p < results[0].p, 'an armed bot materially changes the evacuation result');
  assert.ok(results[4].p < results[0].p, 'the fully cleared crate route changes the evacuation result');
  console.log(JSON.stringify({ evidence: 'paired-interventions', timestep: DT, openingDelay: baseline.hunter.stun, samples: 16, failures: Object.fromEntries(['baseline', 'cameras-disabled', 'wall-breached', 'one-armed-bot', 'crate-pushed-twice'].map((name, i) => [name, results[i].failures])) }));
});

test('scripted evacuation opens the real hatch, activates relay, and gets all six beyond the gate', () => {
  const s = quiet();
  let ticks = 0;
  while (s.mode === 'playing' && ticks < Math.ceil(60 / DT)) {
    step(s, DT, {}, true);
    ticks++;
  }
  assert.equal(s.mode, 'won');
  assert.equal(s.humans.filter(h => h.safe).length, 6);
  assert.equal(object(s, 'hatch').open, true);
  assert.equal(object(s, 'relay').open, true);
  assert.equal(object(s, 'rescue').open, true);
  assert.ok(s.time < 45);
  console.log(JSON.stringify({ evidence: 'scripted-autonomous-evacuation', seed: 4729, timestep: DT, ticks, simulatedSeconds: s.time, safe: s.humans.filter(h => h.safe).length, mode: s.mode, hunter: 'suppressed to isolate navigation' }));
});

test('full forecast benchmark records the actual default-size cost and empirical failure count', () => {
  const s = createState();
  const started = performance.now();
  const prediction = estimate(s, 48, 45);
  const elapsedMs = performance.now() - started;
  assert.ok(Number.isFinite(prediction.p) && prediction.p >= 0 && prediction.p <= 1);
  assert.equal(prediction.samples, 48);
  assert.equal(prediction.p, prediction.failures / 48);
  console.log(JSON.stringify({ evidence: 'forecast-benchmark', seed: 4729, timestep: DT, openingDelay: s.hunter.stun, elapsedMs: Math.round(elapsedMs), prediction, platform: process.platform, architecture: process.arch, node: process.version }));
});
