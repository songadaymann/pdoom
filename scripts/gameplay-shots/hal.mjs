// Computer Station (HAL) + meadow gameplay shots for the vertical promo trailers.
//   hal-eye   HAL3000's drone hovering in the red-lit server corridor, looking at you; its eye goes cyan -> amber -> red
//   teabot    TEABOT's endless tea service: press green, fill, carry, toss the cup onto the pile
//   meadow    level 1's escape: crawl the duct, the meadow reveal, turn back to watch the survivors come out
//   hal-room  the server corridor with HAL drifting through it (atmosphere)
// Each shot brings its own PDPlayShot handler (see capture-gameplay.mjs): HAL is held on a mark and
// its mood set from the program clock, the tea service is staged at a fixed phase on the first
// recorded tic, the escapees are staged in the duct. Everything else is the game's own simulation.
import fs from 'node:fs/promises';

const L1 = '?level=five-prisons';
const L2 = '?level=hal-station';
const DUMP = '/private/tmp/claude-501/-Users-jonathanmann-SongADAO-Dropbox-Jonathan-Mann-projects-games-p-doom/6b9647ca-c3fe-4652-a1e5-066e18bc4635/scratchpad/hal/';
const SCOUT = (process.env.HAL_SCOUT || '').split(';').filter(Boolean).map(s => s.split(',').map(Number));

// Shared ZScript helpers (static, so each shot's PDPlayShot can call them).
const HELPERS = `
class PDShotUtil : Object play
{
	static double Smooth(double u) { u = clamp(u, 0., 1.); return u * u * (3 - 2 * u); }
	static double Floor(Vector2 xy) { return level.PointInSector(xy).floorplane.ZatPoint(xy); }
	static PDPlayCap Cap() { return PDPlayCap(EventHandler.Find('PDPlayCap')); }
	// Exact view at a point (no smoothing).
	static void Aim(PlayerPawn pawn, Vector3 at)
	{
		Vector3 d = at - (pawn.Pos.XY, pawn.Pos.Z + pawn.player.viewheight);
		pawn.A_SetAngle(atan2(d.Y, d.X), SPF_INTERPOLATE);
		pawn.A_SetPitch(-atan2(d.Z, d.XY.Length()), SPF_INTERPOLATE);
	}
	static void Place(PlayerPawn pawn, Vector2 xy)
	{
		pawn.SetOrigin((xy, Floor(xy)), true); pawn.Vel = (0, 0, 0);
	}
}
`;

// ---------------------------------------------------------------- hal-eye
// Server corridor south of memory module 0 (32,-736): racks both sides, red ceiling lights.
const EYE = {cam0: [32, -955], cam1: [32, -912], hal0: [32, -822], hal1: [32, -836], amber: 1.0, red: 1.7, z: 30};
const EYE_Z = `${HELPERS}
class PDPlayShot : EventHandler
{
	bool Staged;
	override void WorldTick()
	{
		let g = PDCheckpoint.Get();
		if (!g || !g.Hunter || !g.Hal) return;
		let h = g.Hunter; let pawn = players[0].mo;
		let cap = PDShotUtil.Cap();
		bool rec = cap && cap.Active;
		double t = rec ? cap.T / 35. : 0;
		if (!Staged) { Staged = true; h.SetStateLabel('HAL'); }
		// HAL holds its mark (stunned = no patrol, no hostility); it bobs like the native drone.
		h.StunUntil = level.time + 1000; h.AimTics = 0; h.LockedAim = false; h.Vel = (0, 0, 0);
		double u = PDShotUtil.Smooth((t - ${EYE.red}) / 1.3);
		Vector2 hp = (${EYE.hal0[0]}, ${EYE.hal0[1]}) + ((${EYE.hal1[0]}, ${EYE.hal1[1]}) - (${EYE.hal0[0]}, ${EYE.hal0[1]})) * u;
		h.SetOrigin((hp, PDShotUtil.Floor(hp) + 8 + sin(level.time * 4) * 2), true);
		h.Angle = h.AngleTo(pawn);
		g.Hal.Personality.Disposition = t < ${EYE.amber} ? 0 : t < ${EYE.red} ? 1 : 2;
		if (!rec || cap.Done) return;
		// Slow push-in, view locked on the drone (not on its bob).
		double v = PDShotUtil.Smooth(t / (cap.NT / 35.));
		PDShotUtil.Place(pawn, (${EYE.cam0[0]}, ${EYE.cam0[1]}) + ((${EYE.cam1[0]}, ${EYE.cam1[1]}) - (${EYE.cam0[0]}, ${EYE.cam0[1]})) * v);
		PDShotUtil.Aim(pawn, (hp, PDShotUtil.Floor(hp) + ${EYE.z}));
	}
}
`;

// ---------------------------------------------------------------- teabot
// Close on the dispenser while the cup fills, then backing away north as the bot carries the
// cup toward you and tosses it onto the pile. Camera keys: [t, x, y].
const TEA = {cam: [[0, -397, -68], [2.3, -397, -60], [4.7, -384, 16], [6.6, -386, 20]]};
// Eased keyframe path for a shot's PDPlayShot: Vector2 Path(double t) over keys [[t, x, y], ...].
const PATH = keys => `
	Vector2 Path(double t)
	{
		static const double KT[] = { ${keys.map(k => k[0]).join(', ')} };
		static const double KX[] = { ${keys.map(k => k[1]).join(', ')} };
		static const double KY[] = { ${keys.map(k => k[2]).join(', ')} };
		int i = 0; while (i < ${keys.length - 2} && t >= KT[i + 1]) i++;
		double u = PDShotUtil.Smooth((t - KT[i]) / (KT[i + 1] - KT[i]));
		return (KX[i] + (KX[i + 1] - KX[i]) * u, KY[i] + (KY[i + 1] - KY[i]) * u);
	}
`;
const TEA_Z = `${HELPERS}
class PDPlayShot : EventHandler
{
	bool Staged; Vector3 Look;
${PATH(TEA.cam)}	override void WorldTick()
	{
		let g = PDCheckpoint.Get();
		if (!g || !g.Hal || !g.Hal.Service || !g.Hal.Service.Bot) return;
		if (g.Hunter) g.Hunter.StunUntil = level.time + 1000;   // HAL stays at its far spawn
		let sv = g.Hal.Service; let bot = sv.Bot; let pawn = players[0].mo;
		let cap = PDShotUtil.Cap();
		if (!cap || !cap.Active || cap.Done) return;
		if (!Staged)
		{
			// Fixed start: bot at the green button, just pressing it; no cups in flight.
			Staged = true;
			Array<Actor> old; Actor mo;
			let it = ThinkerIterator.Create('PDTeaCup'); while (mo = Actor(it.Next())) old.Push(mo);
			let it2 = ThinkerIterator.Create('PDTeaDrop'); while (mo = Actor(it2.Next())) old.Push(mo);
			for (int i = 0; i < old.Size(); i++) old[i].Destroy();
			sv.FillingCup = null; sv.Carrying = false; sv.Pressed = 1;
			sv.Phase = 1; sv.PhaseAt = level.time + 22;
			bot.SetOrigin((-410, -134, bot.Pos.Z), false); bot.Angle = 345; bot.Frame = 2; bot.ClearInterpolation();
		}
		double t = cap.T / 35.;
		PDShotUtil.Place(pawn, Path(t));
		// Frame the bot with what it is working on: the dispenser cup, then the pile.
		Vector3 at = bot.Pos + (0, 0, 24);
		if (sv.Phase == 1 || sv.Phase == 2) at = at * .62 + (-368, -142, 30) * .38;
		else if (sv.Phase >= 4) at = at * .6 + (-464, -16, 14) * .4;
		if (cap.T <= 1) Look = at; else Look += (at - Look) * .07;
		PDShotUtil.Aim(pawn, Look);
	}
}
`;

// ---------------------------------------------------------------- meadow (level 1 escape)
// The development ending fixture (pdoom_development + pdoom_dev_end, normally granted by the local
// dev server) gathers the five in the refuge with the wrench; the cover is then opened for real
// (Uncover) and on the first recorded tic everyone is staged in the duct: you near the last bend's
// end, the five crawling behind. The engine runs the exit; the browser's own meadow renderer takes
// over. The meadow runs on main-thread time, so it is put on the capture's virtual clock here, and
// the frame grab waits while the meadow loads (otherwise the turned-around engine view would show).
const MEADOW_Z = `${HELPERS}
class PDPlayShot : EventHandler
{
	bool Staged; int Pinned; Vector3 PinAt;
	// Single file behind you, ~31 units (0.45 s of crawling) apart along the duct's waypoints.
	static const double PX[] = { 783, 814, 832, 832, 832 };
	static const double PY[] = { 1024, 1024, 1011, 980, 949 };
	static const int ST[] = { 2, 2, 1, 1, 1 };
	override void NetworkProcess(ConsoleEvent e)
	{
		let g = PDCheckpoint.Get();
		if (g && e.Name == "pdshot_uncover" && !g.Escape.Opened) { g.Escape.Bolts = 15; g.Escape.Uncover(g); }
	}
	override void WorldTick()
	{
		let g = PDCheckpoint.Get(); let cap = PDShotUtil.Cap();
		if (Staged) { Pin(); return; }
		if (!g || !cap || !cap.Active) return;
		Staged = true;
		// Normally done in setup (pdshot_uncover) so the status bar's estimate has settled.
		if (!g.Escape.Opened) { g.Escape.Bolts = 15; g.Escape.Uncover(g); }
		let pawn = players[0].mo;
		pawn.SetOrigin((720, 1128, PDShotUtil.Floor((720, 1128))), false); pawn.Vel = (0, 0, 0); pawn.Angle = 90; pawn.Pitch = 0; pawn.ClearInterpolation();
		int n = 0;
		for (int i = 0; i < 5; i++)
		{
			let p = g.Cast.People[i];
			if (!p.Alive || !p.Released || p.Taken || !p.Body) continue;
			p.Holding = false; p.Sheltered = false; p.Nav.HasWaypoint = false;
			p.Body.Height = 28; p.Body.Vel = (0, 0, 0);
			p.Body.SetOrigin((PX[n], PY[n], PDShotUtil.Floor((PX[n], PY[n]))), false); p.Body.ClearInterpolation();
			p.Body.Angle = ST[n] == 3 ? 90 : 180;
			g.Escape.Steps[i] = ST[n];
			if (n == 4) { Pinned = i + 1; PinAt = p.Body.Pos; }
			n++;
		}
	}
	// The fifth stays at the back of the queue for the whole clip: when the last one is out the run
	// ends and the meadow pops that person straight onto their camp spot (no walk out).
	void Pin()
	{
		let g = PDCheckpoint.Get();
		if (!g || !Pinned) return;
		let b = g.Cast.People[Pinned - 1].Body;
		if (b) { b.SetOrigin(PinAt, false); b.Vel = (0, 0, 0); }
	}
}
`;
// Meadow camera, seconds after the reveal: [t, x, z, yaw, pitch, eye height] keyframes (metres; yaw 0 = looking
// out over the meadow, PI = looking back at the CONTROL.EXE doorway; eased between keys).
const MEADOW_CAM = [
  [0.0, 17.0, -2.9, 0.0, 0.03, 1.72],
  [0.9, 17.0, -4.0, 0.0, 0.07, 1.72],
  [2.6, 16.9, -10.2, Math.PI + 0.04, 0.03, 1.5],
  [7.8, 16.5, -11.0, Math.PI + 0.02, 0.04, 1.45],
];
async function meadowClock(page) {
  await page.evaluate((keys) => {
    // Main-thread virtual clock for the meadow renderer (rAF timestamps + performance.now).
    const realRAF = window.requestAnimationFrame.bind(window), realNow = performance.now.bind(performance);
    const V = window.__hmClock = {frozen: false, base: 0, v: 0, reveal: null, waits: 0};
    const now = () => V.frozen ? V.base + V.v : realNow();
    performance.now = now;
    window.requestAnimationFrame = cb => realRAF(() => cb(now()));
    const ease = u => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
    const cam = t => {
      let i = 0; while (i < keys.length - 1 && t >= keys[i + 1][0]) i++;
      const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
      const u = b === a ? 0 : ease((t - a[0]) / (b[0] - a[0]));
      return a.slice(1).map((v, k) => v + (b[k + 1] - v) * u);
    };
    const orig = window.__pdcapAnimate;
    window.__pdcapAnimate = async v => {
      if (!V.frozen) { V.base = realNow() - v; V.frozen = true; }
      V.v = v;
      orig(v);
      const s = JSON.parse(window.render_game_to_text());
      if (s.mode !== 'outside' && !s.escape?.outside) return;
      const stage = document.querySelector('#stage'), t0 = Date.now();
      while (!(stage.classList.contains('outside') && window.__DOOM_DEBUG__?.outside) && Date.now() - t0 < 30000) { V.waits++; await new Promise(r => setTimeout(r, 50)); }
      const o = window.__DOOM_DEBUG__.outside;
      if (V.reveal === null) V.reveal = v;
      const [x, z, yaw, pitch, eye] = cam((v - V.reveal) / 1000);
      o.debug.setView(x, z, yaw, pitch, eye);
      if (window.__hmDebug) { const os = o.getState(); console.log('HMDBG ' + JSON.stringify({v: Math.round(v), t: +((v - V.reveal) / 1000).toFixed(2), saved: s.escape?.saved_people, ppl: os.people.map(p => [p.id, p.x, p.z, p.arrived ? 1 : 0]), time: +o.debug.getTime().toFixed(2)})); }
    };
    import('./outside/outside.js').catch(() => {});
  }, MEADOW_CAM);
}

// ---------------------------------------------------------------- hal-room
// The server corridor with HAL drifting toward you down it, cyan and polite (atmosphere / "it hears you").
const ROOM = {cam0: [26, -770], cam1: [40, -800], hal0: [40, -935], hal1: [36, -880]};
const ROOM_Z = `${HELPERS}
class PDPlayShot : EventHandler
{
	bool Staged;
	override void WorldTick()
	{
		let g = PDCheckpoint.Get();
		if (!g || !g.Hunter || !g.Hal) return;
		let h = g.Hunter; let pawn = players[0].mo;
		let cap = PDShotUtil.Cap();
		bool rec = cap && cap.Active;
		double t = 0, len = 3.4;
		if (cap && cap.NT > 0) len = cap.NT / 35.;
		if (rec) t = cap.T / 35.;
		if (!Staged) { Staged = true; h.SetStateLabel('HAL'); }
		h.StunUntil = level.time + 1000; h.AimTics = 0; h.LockedAim = false; h.Vel = (0, 0, 0);
		Vector2 hp = (${ROOM.hal0[0]}, ${ROOM.hal0[1]}) + ((${ROOM.hal1[0]}, ${ROOM.hal1[1]}) - (${ROOM.hal0[0]}, ${ROOM.hal0[1]})) * PDShotUtil.Smooth(t / len);
		h.SetOrigin((hp, PDShotUtil.Floor(hp) + 8 + sin(level.time * 4) * 2), true);
		h.Angle = h.AngleTo(pawn);
		g.Hal.Personality.Disposition = 0;
		if (!rec || cap.Done) return;
		PDShotUtil.Place(pawn, (${ROOM.cam0[0]}, ${ROOM.cam0[1]}) + ((${ROOM.cam1[0]}, ${ROOM.cam1[1]}) - (${ROOM.cam0[0]}, ${ROOM.cam0[1]})) * PDShotUtil.Smooth(t / len));
		PDShotUtil.Aim(pawn, (hp, PDShotUtil.Floor(hp) + 40));
	}
}
`;

const DUMPZ = `
class PDPlayShot : EventHandler
{
	override void NetworkProcess(ConsoleEvent e)
	{
		if (e.Name == "pdshot_hal")
		{
			let g = PDCheckpoint.Get(); if (!g || !g.Hunter) return;
			Vector2 xy = (e.Args[0], e.Args[1]);
			g.Hunter.SetOrigin((xy, level.PointInSector(xy).floorplane.ZatPoint(xy) + 8), false);
			g.Hunter.StunUntil = level.time + 100000; g.Hunter.Angle = g.Hunter.AngleTo(players[0].mo); g.Hunter.SetStateLabel('HAL');
			return;
		}
		if (e.Name != "pdshot_dump") return;
		let it = ThinkerIterator.Create('Actor'); Actor mo;
		while (mo = Actor(it.Next()))
		{
			String c = mo.GetClassName();
			if (c.Left(5) == "PDTea" || c == "PDCheckpointHunter" || c == "PDHalPod" || (c == "PDHalTerminal" && e.Args[0]) || (c == "PDCheckpointCamera" && e.Args[1]))
				Console.Printf("PDPLAY DUMP %s %.0f %.0f %.0f a%.0f k%d", c, mo.Pos.X, mo.Pos.Y, mo.Pos.Z, mo.Angle, mo is 'PDCheckpointProp' ? PDCheckpointProp(mo).Kind : -1);
		}
	}
}
`;

const angleTo = (a, b) => Math.round(Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI);

// Scouting only runs when HAL_SCOUT is set, so a plain run never executes it.
const scoutShots = !process.env.HAL_SCOUT ? [] : [
  {
    name: 'hal-scout', about: 'scouting (HAL_SCOUT="x,y,angle,pitch;...", HAL_SCOUT_URL)', url: process.env.HAL_SCOUT_URL || L2, seconds: 1, ceos: ['altman'],
    zscript: DUMPZ,
    setup: async ({q, page, net}) => {
      await fs.mkdir(DUMP, {recursive: true});
      await q.command('god');
      await q.command('netevent pdshot_dump 1 0');
      await page.waitForTimeout(400);
      console.log((await page.evaluate(() => window.__PDCAP__.lines)).join('\n'));
      const s = await q.read();
      console.log(JSON.stringify({hal: s.hal, hunter: [s.world.hunter_x, s.world.hunter_y], me: [s.world.x, s.world.y, s.world.angle]}));
      await page.addStyleTag({content: '#game-text,#doom-dialogue,#hal-question,button,mann-cool-game-shell{display:none!important}'});
      for (const [x, y, a, pitch, hx, hy] of SCOUT) {
        await net('pose', x, y, a);
        if (pitch) await net('look', a, pitch);
        if (hx !== undefined) await q.command(`netevent pdshot_hal ${hx} ${hy}`);
        await page.waitForTimeout(700);
        await page.screenshot({path: `${DUMP}scout_${x}_${y}_${a}_${pitch || 0}${hx !== undefined ? `_h${hx}_${hy}` : ''}.png`});
      }
    },
  },
];

export default [
  ...scoutShots,
  {
    name: 'hal-eye', about: 'HAL3000 hovering in the red-lit server corridor, looking at you; eye cyan -> amber -> red', url: L2, seconds: 3.4,
    zscript: EYE_Z,
    setup: async ({q, page, net}) => {
      await q.command('god');
      await net('pose', EYE.cam0[0], EYE.cam0[1], angleTo(EYE.cam0, EYE.hal0));
      await page.waitForTimeout(1500);
    },
  },
  {
    name: 'teabot', about: 'TEABOT serving tea to nobody: press green, fill, carry, toss the cup on the pile', url: L2, seconds: 6.6,
    zscript: TEA_Z,
    setup: async ({q, page, net}) => {
      await q.command('god');
      await net('pose', TEA.cam[0][1], TEA.cam[0][2], angleTo(TEA.cam[0].slice(1), [-394, -137]));
      await page.waitForTimeout(1200);
    },
  },
  {
    name: 'meadow', about: 'level 1 escape: crawl out of the duct into the meadow, turn back as the survivors emerge', url: L1, seconds: 9.2,
    zscript: MEADOW_Z,
    css: '#stage.outside #hud, #hub-ui, #score-dialog, #person-label { display:none !important; }',
    setup: async ({q, page, net}) => {
      await q.command('god');
      await q.command('set pdoom_development 1');
      await q.command('set pdoom_dev_end 1');
      await q.wait(s => s.world?.group_gathered === 1 && s.world.freed === 5, 'development ending fixture', 20000);
      // The four bolts come off for real (Uncover: cover gone, companions released to crawl after you);
      // everyone is re-staged in the duct on the first recorded tic.
      await q.command('netevent pdshot_uncover');
      await q.wait(s => s.escape?.opened === 1, 'cover opened', 8000);
      await net('pose', 720, 1128, 90);
      await page.waitForTimeout(1500);
      await meadowClock(page);
      if (process.env.HAL_DEBUG) {
        await fs.mkdir(DUMP, {recursive: true});
        const log = DUMP + 'meadow-console.log'; await fs.writeFile(log, '');
        page.on('console', m => { if (m.text().startsWith('HMDBG')) fs.appendFile(log, m.text() + '\n'); });
        await page.evaluate(() => { window.__hmDebug = true; });
      }
      const s = await q.read();
      console.log(JSON.stringify({escape: s.escape, me: [s.world.x, s.world.y, s.world.crouch], people: s.world.people.map(p => [p.x, p.y, p.alive, p.released])}));
    },
    keys: [{key: 'w', from: 0.1, to: 1.4}],
  },
  {
    name: 'hal-room', about: 'the server corridor: HAL drifts toward you between the racks, cyan and polite', url: L2, seconds: 3.4,
    zscript: ROOM_Z,
    setup: async ({q, page, net}) => {
      await q.command('god');
      await net('pose', ROOM.cam0[0], ROOM.cam0[1], angleTo(ROOM.cam0, ROOM.hal0));
      await page.waitForTimeout(1500);
    },
  },
];
