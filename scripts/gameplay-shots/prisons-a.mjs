// Five Prisons gameplay shots for the vertical promo trailers (set A): walking with the wrench,
// smashing a camera, a camera watching you, Eliezer and Hinton in their cells, several captives.
// Scouting (stills only) runs only with PA_SCOUT set: PA_SCOUT="x,y,angle[,pitch];..." node
// scripts/capture-gameplay.mjs --shot pa-scout --scout   (PA_PRE="park,x,y;door,880" runs setup netevents first)
import fs from 'node:fs/promises';

const L1 = '?level=five-prisons';
const DUMP = process.env.PA_DUMP || '/private/tmp/claude-501/-Users-jonathanmann-SongADAO-Dropbox-Jonathan-Mann-projects-games-p-doom/6b9647ca-c3fe-4652-a1e5-066e18bc4635/scratchpad/pa/';   // scout stills (any scratch folder)
const CLEAN = `mann-cool-game-shell, #restart, #dev-badge, #touch, #finish, #result, #reticle, #onboarding, #launcher, #story, #intro-video, #game-text, #status-line, #prompt, #message, #people, #threat-warning, #doom-dialogue, #hal-question, #bliss-guide { display:none !important; }
button { display:none !important; }
#stage { position:fixed !important; inset:0 !important; width:1080px !important; height:676px !important; transform:none !important; }
#canvas { position:absolute !important; left:0 !important; top:0 !important; width:1080px !important; height:676px !important; max-width:none !important; max-height:none !important; transform:none !important; image-rendering:pixelated !important; }`;

// PDPlayShot: setup netevents (pdshot_<name>, up to three ints) plus an optional per-tic dolly
// (player position precomputed per program tic; smooth, no bob) and timed hooks.
const ease = u => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
function dollyTics(keys, seconds) {
  const n = Math.ceil(seconds * 35) + 4, xs = [], ys = [];
  for (let t = 0; t < n; t++) {
    const s = t / 35;
    let i = 0; while (i < keys.length - 2 && s >= keys[i + 1].at) i++;
    const a = keys[i], b = keys[i + 1] || a;
    const u = b === a ? 0 : (b.ease === 'linear' ? Math.min(1, Math.max(0, (s - a.at) / (b.at - a.at))) : ease((s - a.at) / (b.at - a.at)));
    xs.push((a.x + (b.x - a.x) * (s < a.at ? 0 : u)).toFixed(2)); ys.push((a.y + (b.y - a.y) * (s < a.at ? 0 : u)).toFixed(2));
  }
  return {xs, ys};
}
function zs({dolly, seconds = 4, tick = ''} = {}) {
  const d = dolly ? dollyTics(dolly, seconds) : null;
  return `
class PDPlayShot : EventHandler
{
	static const int GSTEP[] = { 22, 3, 13, 2, 12 };
	${d ? `static const double DX[] = { ${d.xs.join(', ')} };
	static const double DY[] = { ${d.ys.join(', ')} };` : ''}
	override void NetworkProcess(ConsoleEvent e)
	{
		let game = PDCheckpoint.Get();
		if (!game) return;
		if (e.Name == "pdshot_park" && game.Hunter)          // hold the hunter, idle, at x y (angle)
		{
			let h = game.Hunter;
			Vector2 xy = (e.Args[0], e.Args[1]);
			h.SetOrigin((xy, level.PointInSector(xy).floorplane.ZatPoint(xy)), false); h.Angle = e.Args[2]; h.ClearInterpolation();
			h.StunUntil = level.time + 100000; h.AimTics = 0; h.LockedAim = false; h.Mood = 0; h.SetStateLabel('Spawn');
		}
		else if (e.Name == "pdshot_samopen") game.Sam.CutFeed(game);
		else if (e.Name == "pdshot_door")
		{
			Door_Open(e.Args[0], e.Args[1] ? e.Args[1] : 24);
			if (e.Args[0] == 880) { let plates = ThinkerIterator.Create('PDCheckpointBreach'); Actor plate; while ((plate = Actor(plates.Next())) != null) plate.Destroy(); }
		}
		else if (e.Name == "pdshot_gather")                   // everyone freed and resting in the refuge
		{
			for (int i = 0; i < 5; i++) { game.Cast.People[i].Carded = true; game.OpenCell(i, "capture"); }
			game.Refuge.Known = true; game.Refuge.Introduced = true;
			for (int i = 0; i < 5; i++)
			{
				let p = game.Cast.People[i]; if (!p.Body) continue;
				Vector2 xy = PDRescueRefuge.Slot(i);
				p.Body.SetOrigin((xy, level.PointInSector(xy).floorplane.ZatPoint(xy)), false); p.Body.ClearInterpolation();
				p.Sheltered = true; p.Holding = true; p.RefugeArrival = true; p.HoldGoal = xy; p.Nav.HasWaypoint = false; p.Idling = false;
				if (e.Args[0])                                // stand still, looking roughly west (RescueIdle look = site*71 + step*137 + 50)
				{ p.Idling = true; p.IdleStep = GSTEP[i]; p.IdleGoal = xy; p.IdleUntil = level.time + 100000; p.Body.Angle = 180; }
			}
		}
		else if (e.Name == "pdshot_light") { Light_Stop(e.Args[0]); Light_ChangeToValue(e.Args[0], e.Args[1]); }   // hold a cell's glow steady
		else if (e.Name == "pdshot_stand")                    // captive at site stops pacing and turns to look direction step
		{
			let p = game.Cast.People[e.Args[0]];
			p.Idling = true; p.IdleStep = e.Args[1]; p.IdleGoal = p.Body.Pos.XY; p.IdleUntil = level.time + 100000;
		}
		else if (e.Name == "pdshot_camquiet")                 // camera i stops reporting; its LED is ours to set
		{
			let c = game.Combat.Cameras[e.Args[0]]; c.Turned = true; c.SeenUntil = 0; c.SetStateLabel('Spawn');
		}
	}
	override void WorldTick()
	{
		let cap = PDPlayCap(EventHandler.Find('PDPlayCap'));
		if (!cap || !cap.Active || cap.Done) return;
		let game = PDCheckpoint.Get();
		let pawn = players[0].mo;
		int T = cap.T;
		${d ? `if (T < DX.Size())
		{
			Vector2 xy = (DX[T], DY[T]);
			pawn.SetOrigin((xy, level.PointInSector(xy).floorplane.ZatPoint(xy)), true); pawn.Vel = (0, 0, 0);
		}` : ''}
		${tick}
	}
}
`;
}

const scoutShots = !process.env.PA_SCOUT ? [] : [{
  name: 'pa-scout', about: 'scouting stills (PA_SCOUT)', url: L1, seconds: 1, ceos: ['altman'], zscript: zs(),
  setup: async ({q, page, net}) => {
    await fs.mkdir(DUMP, {recursive: true});
    await q.command('god');
    await page.addStyleTag({content: CLEAN});
    await page.mouse.move(540, 330);
    for (const pre of (process.env.PA_PRE || '').split(';').filter(Boolean)) { const [n, ...a] = pre.split(','); await q.command(`netevent pdshot_${n} ${a.join(' ')}`); }
    if (process.env.PA_WRENCH) await net('wrench');
    await page.waitForTimeout(+(process.env.PA_WAIT || 0));
    for (const item of process.env.PA_SCOUT.split(';').filter(Boolean)) {
      if (item.startsWith('!')) { const [n, ...a] = item.slice(1).split(','); await q.command(`netevent pdshot_${n} ${a.join(' ')}`); await page.waitForTimeout(1500); continue; }
      const [x, y, a, pitch] = item.split(',').map(Number);
      await net('pose', x, y, a);
      if (pitch) await net('look', a, pitch);
      await page.waitForTimeout(700);
      await page.screenshot({path: `${DUMP}scout_${x}_${y}_${a}${pitch ? '_' + pitch : ''}.png`});
    }
    await fs.writeFile(DUMP + 'state.json', JSON.stringify(await q.read(), null, 1));
  },
}];

// Shared setup steps.
const sn = (q, name, ...a) => q.command(`netevent pdshot_${name} ${a.join(' ')}`);
async function pickWrench({q, net}) {          // the real pickup at the start, like a player would
  await net('pose', 2032, 1120, 90);
  await q.press('KeyE');
  await q.wait(s => s.world.wrench === 1, 'wrench pickup');
}
// The game shows a person's name where the pointer (or crosshair) rests on them. For a portrait the
// pointer rides just under the top of that person's head (same projection as doom-web/person-label.js),
// moved on the capture's virtual clock, so the label sits above the head instead of across the face.
async function labelFollow(page, site, inset = 10) {
  await page.evaluate(([site, inset]) => {
    const stage = document.querySelector('#stage'), orig = window.__pdcapAnimate;
    const move = () => {
      let s; try { s = JSON.parse(window.render_game_to_text()); } catch { return; }
      const w = s.world, person = w?.people?.[site]; if (!person) return;
      const a = w.angle * Math.PI / 180, p = w.pitch * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), cp = Math.cos(p), sp = Math.sin(p);
      const dx = person.x - w.x, dy = person.y - w.y, hd = dx * c + dy * sn, right = dx * sn - dy * c;
      const dz = person.z + person.pose_height - (w.z + (s.escape?.view_height ?? 41)), depth = hd * cp - dz * sp;
      if (depth < 8) return;
      const x = right / depth, y = (hd * sp + dz * cp) / (depth / 1.6);
      const r = document.querySelector('#canvas').getBoundingClientRect();
      const px = r.left + (x + 1) / 2 * r.width, py = r.top + (1 - y) / 2 * r.height + inset;
      stage.dispatchEvent(new PointerEvent('pointermove', {clientX: px, clientY: py, bubbles: true}));
    };
    window.__pdcapAnimate = v => { orig(v); move(); };
    move();
  }, [site, inset]);
}

const CAM0 = {x: 1948, y: 1215.5}, CAM8 = {x: -1245, y: 832.5};

const CAMERA_SEES = {
  name: 'camera-sees', about: 'slow push in on the camera beside the FEEL THE AGI poster; its red light snaps on as it spots you (hunter alerted)', url: L1, seconds: 2.6,
  zscript: zs({seconds: 2.6, dolly: [{at: 0, x: -1244, y: 968}, {at: 2.6, x: -1244, y: 902, ease: 'linear'}],
    tick: `if (T >= 17 && (T - 17) % 14 == 0)
		{
			let c = game.Combat.Cameras[8];
			c.SetStateLabel('Spotted'); c.SeenUntil = level.time + 100000; c.Reports++; game.CameraReports++;
			game.Polish.Seen(game, 8); game.Alert(pawn.Pos.XY);
		}`}),
  setup: async ({q, net, page}) => {
    await q.command('god');
    await sn(q, 'park', 1900, 1500, 0);
    await sn(q, 'camquiet', 8);
    await net('pose', -1244, 968, 270);
    await net('look', 270, -6);
    await page.waitForTimeout(600);
  },
  look: [{at: 0, track: 'point', x: CAM8.x + 2, y: CAM8.y + 2, z: 50, rate: 0.2}],
};

export default [
  ...scoutShots,
  {
    name: 'play-walk', about: 'wrench in hand: down the bright start corridor, through the door, glide right to the SMILE poster and its camera', url: L1, seconds: 4.2,
    zscript: zs(),
    setup: async ctx => {
      const {q, net, page} = ctx;
      await q.command('god');
      await pickWrench(ctx);
      await sn(q, 'park', -900, 600, 0);
      await sn(q, 'door', 1074, 64);
      await net('pose', 2085, 1150, 180);
      await page.waitForTimeout(1800);
    },
    look: [{at: 0, dyaw: -7, pitch: 1}, {at: 1.3, dyaw: 3, pitch: 0}, {at: 2.0, dyaw: 2, pitch: 0}, {at: 3.2, dyaw: -44, pitch: -4}, {at: 4.2, dyaw: -48, pitch: -4}],
    keys: [{key: 'w', from: 0.05, to: 2.3}, {key: 'w', from: 3.4, to: 3.8}],
  },
  {
    name: 'camera-smash', about: 'step up to the start-corridor camera and smash it with the wrench: flash, sparks, debris, CAMS 1', url: L1, seconds: 3.5,
    // The burst's translucent smoke appears ~0.17 s late so the fireball reads (otherwise it is often
    // hidden behind four 75%-alpha puffs spawned in front of it, depending on the random spawn offsets).
    zscript: zs({seconds: 3.5, dolly: [{at: 0, x: 2052, y: 1130}, {at: 1.05, x: 1950, y: 1142}],
      tick: `let it = ThinkerIterator.Create('PDRescueSmoke'); PDRescueSmoke puff;
		while ((puff = PDRescueSmoke(it.Next())) != null)
			if ((puff.Pos.XY - (${CAM0.x}, ${CAM0.y})).Length() < 64) puff.bInvisible = puff.Age < 6;`}),
    setup: async ctx => {
      const {q, net, page} = ctx;
      await q.command('god');
      await pickWrench(ctx);
      await sn(q, 'park', -900, 600, 0);
      await net('pose', 2052, 1130, 146);
      await net('look', 146, -4);
      await page.waitForTimeout(600);
    },
    look: [{at: 0, track: 'point', x: CAM0.x + 10, y: CAM0.y, z: 41, rate: 0.12}],
    press: [{key: 'ctrl', at: 1.3}],
    css: '.checkpoint #held-wrench.swinging { animation-delay: -0.1s !important; }',
  },
  CAMERA_SEES,
  {
    ...CAMERA_SEES, name: 'camera-sees-warning', about: 'camera-sees plus the game\'s red SEEN warning (top centre) while the camera reports you',
    css: '#stage #threat-warning:not([hidden]) { display: block !important; }',
  },
  {
    name: 'prisoner-eliezer', about: 'Eliezer Yudkowsky pacing in his southwest cell, seen through the opened rear shutter, name label', url: L1, seconds: 3.2,
    keep: ['labels'],
    zscript: zs({seconds: 3.2, dolly: [{at: 0, x: -1104, y: -288}, {at: 3.2, x: -1046, y: -288}]}),
    setup: async ({q, net, page}) => {
      await q.command('god');
      await sn(q, 'park', 1900, 1500, 0);
      await sn(q, 'samopen');
      await sn(q, 'light', 902, 144);
      await net('pose', -1104, -288, 356);
      await labelFollow(page, 2);
      await page.waitForTimeout(2500);
    },
    look: [{at: 0, track: 'person', i: 2, rate: 0.1, dpitch: 3}],
  },
  {
    name: 'prisoner-hinton', about: 'Geoffrey Hinton standing in his cell behind the opened west bulkhead, breathing, facing you, name label', url: L1, seconds: 3.2,
    keep: ['labels'],
    zscript: zs({seconds: 3.2, dolly: [{at: 0, x: -1415, y: 1120}, {at: 3.2, x: -1540, y: 1120}]}),
    setup: async ({q, net, page}) => {
      await q.command('god');
      await sn(q, 'park', 1900, 1500, 0);
      await sn(q, 'door', 880, 64);
      await sn(q, 'light', 903, 144);
      await sn(q, 'stand', 3, 6);
      await net('pose', -1415, 1120, 180);
      await labelFollow(page, 3);
      await page.waitForTimeout(2500);
    },
    look: [{at: 0, track: 'person', i: 3, rate: 0.1, dpitch: 2}],
  },
  {
    name: 'prisoners-pan', about: 'the five survivors resting in the refuge; slow pan across them, names popping up', url: L1, seconds: 3.4,
    keep: ['labels'],
    zscript: zs({seconds: 3.4, dolly: [{at: 0, x: 905, y: 846}, {at: 3.4, x: 925, y: 836}]}),
    setup: async ({q, net, page}) => {
      await q.command('god');
      await sn(q, 'park', -900, 600, 0);
      await net('pose', 905, 846, 30);
      await sn(q, 'gather', 1);
      await page.mouse.move(540, 330);
      await page.waitForTimeout(2500);
    },
    look: [{at: 0, yaw: 30, pitch: 3}, {at: 3.4, yaw: -28, pitch: 3}],
  },
];
