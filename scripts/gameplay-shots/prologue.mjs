// Last Stand prologue gameplay for the promo trailers (scripts/capture-gameplay.mjs; format in
// scripts/gameplay-shots/_test.mjs).
//   node scripts/capture-gameplay.mjs --shot finale-rockets,finale-chaingun,finale-overrun,battle-room

// Shot fixture (capture-only ZScript, never shipped). With no console commands at all (typing into
// the console is fragile when the machine is busy), once setup arms it (Q) it:
//  * jumps straight into gauntlet section `section` (0-based; 6 = THE LAST GROUND) through the
//    real airlock crossing (PDLastStand.CrossAirlock), instead of clearing and crossing every
//    section in real time (g.toFinale, ~60 s). Earlier sections' machines and soldiers are removed,
//    as the crossing itself does for the section just left;
//  * sets god or buddha, gives `give` weapons with full ammo and raises `weapon`;
//  * `spring: [x, y, angle]`: once the door ahead has opened, steps the player out of the finale
//    airlock to that spot in the yard: the trap springs there, so the barrage lands in that view
//    (PDLastStand.Reinforce prefers pads in front of the player). `pose: [x, y, angle]` does the
//    same in any other section;
//  * makes the player's rockets fly through the soldiers beside us (as his bullets already do, via
//    the player's +THRUSPECIES) instead of bursting on the first marine in the way;
//  * holds back our rockets' smoke trail until they are 260 units out (puffs spawned right at the
//    camera are a grey veil over the whole view for a few frames after every launch);
//  * `heavy`: blast and bolt knockback barely move the player (god mode stops the damage, not the
//    push, which otherwise shoves him back across the yard);
//  * `shield`: machine bolts and rockets that are about to hit the player vanish a few units short
//    (in god mode they would only splash a blinding plasma burst over the middle of the view); true
//    in the finale yard, or a ZScript condition;
//  * runs `tick` (extra ZScript, per tic; `b` is the PDLastStand handler, `t` the program tic or -1
//    before recording, `p` the player pawn).
const fixture = ({section = 6, god = false, buddha = false, give = [], weapon = '', spring = null, pose = null, heavy = false, shield = false, tick = '', members = ''} = {}) => `
class PDPlayShot : EventHandler
{
	bool Armed, Jumped, Placed;
	Array<Actor> Trails;   // our rockets, smoke trail held back until they are clear of the camera
	// Q (netevent pdoom_order, unused in the prologue) arms the fixture from setup.
	override void NetworkProcess(ConsoleEvent e) { if (e.Name == "pdoom_order") Armed = true; }
	${members}
	void Jump(PDLastStand b, int j)
	{
		int k = j - 1;
		if (k < 0 || k >= b.XX.Size()) return;
		Array<Actor> gone; Actor a;
		let it = ThinkerIterator.Create('Actor');
		while (a = Actor(it.Next()))
		{
			if (!(a is 'PDWarWalker') && !(a is 'PDWarAlly')) continue;
			int s = b.SectionOf(a.CurSector);
			if (s >= 0 && s < k) gone.Push(a);
		}
		for (int i = 0; i < gone.Size(); i++) gone[i].Destroy();
		let p = players[0].mo;
		b.Section = k; b.Secured = true; b.Transit = 1; b.TransitClock = 0;
		p.SetOrigin((b.XX[k], b.XY[k], b.XZ[k]), false); p.Angle = b.XA[k]; p.Vel = (0, 0, 0); p.ClearInterpolation();
		b.CrossAirlock();
	}
	void Kit()
	{
		let p = players[0].mo;
		${god ? 'players[0].cheats |= CF_GODMODE;' : ''}
		${buddha ? 'players[0].cheats |= CF_BUDDHA;' : ''}
		${give.map(w => `p.GiveInventory('${w}', 1);`).join(' ')}
		p.GiveInventory('Clip', 200); p.GiveInventory('Shell', 50); p.GiveInventory('RocketAmmo', 50);
		${weapon ? `let w = Weapon(p.FindInventory('${weapon}')); if (w) players[0].PendingWeapon = w;` : ''}
		${heavy ? 'p.Mass = 1000000;' : ''}
	}
	static double Floor(Vector2 xy) { return level.PointInSector(xy).floorplane.ZatPoint(xy); }
	void Place(double x, double y, double angle)
	{
		let p = players[0].mo;
		p.SetOrigin(((x, y), Floor((x, y))), false); p.Angle = angle; p.Pitch = 0; p.Vel = (0, 0, 0); p.ClearInterpolation();
	}
	override void WorldTick()
	{
		let b = PDLastStand.Get();
		if (!b || !b.Active || b.BootHolding) return;
		let p = players[0].mo;
		if (!Jumped && Armed) { Jumped = true; ${section > 0 ? `Jump(b, ${section});` : ''} Kit(); }
		${spring ? `if (Jumped && !Placed && b.Section == b.Finale && b.Arrive == 1 && b.ArriveClock > 20) { Placed = true; Place(${spring.join(', ')}); }` : ''}
		${pose ? `if (Jumped && !Placed && b.Arrive == 1 && b.ArriveClock > 20) { Placed = true; Place(${pose.join(', ')}); }` : ''}
		let cap = PDPlayCap(EventHandler.Find('PDPlayCap'));
		int t = cap && cap.Active ? cap.T : -1;
		for (int i = Trails.Size() - 1; i >= 0; i--)
		{
			if (!Trails[i] || !Trails[i].bMissile) { Trails.Delete(i); continue; }
			if (p.Distance3D(Trails[i]) > 260) { Trails[i].bRocketTrail = true; Trails.Delete(i); }
		}
		${shield ? `if (${shield === true ? 'b.Stage == 2' : shield})
		{
			Array<Actor> near; Actor m;
			let it = ThinkerIterator.Create('Actor');
			while (m = Actor(it.Next())) if (m.bMissile && m.target && m.target is 'PDWarWalker' && p.Distance3D(m) < 72) near.Push(m);
			for (int i = 0; i < near.Size(); i++) near[i].Destroy();
		}` : ''}
		${tick}
	}
	override void WorldThingSpawned(WorldEvent e)
	{
		let m = e.Thing;
		if (!m) return;
		if (m.bMissile && m.target && m.target.player)
		{
			m.Species = 'PDHuman'; m.bThruSpecies = true;
			if (m.bRocketTrail) { m.bRocketTrail = false; Trails.Push(m); }
		}
	}
}
`;

const KEY = {ctrl: ['ControlLeft', 'Control', 17], q: ['KeyQ', 'q', 81]};
// Hold or release a key from setup (the recording's own keys/press take over from frame 0).
const key = (page, k, down) => page.evaluate(([c, ev]) => window.__pdcapKey(...c, ev), [KEY[k], down ? 'keydown' : 'keyup']);
// Wait n game tics (the prologue clock stops while paused).
async function tics(q, n) { const c0 = (await q.read()).prologue.clock; await q.wait(s => s.prologue.clock >= c0 + n, `${n} tics`, 30000); }
// Arm the fixture (jump, kit, spring) with Q, then wait for the finale trap to spring.
const arm = async page => { await key(page, 'q', true); await page.waitForTimeout(80); await key(page, 'q', false); };
const sprung = async (q, page) => {
  await arm(page);
  const s = await q.wait(s => s.prologue.section === 7 && s.prologue.stage === 'yard', 'Trap springs', 30000);
  if (process.env.PDEBUG) console.log('[prologue] sprung', s.world.x, s.world.y, s.world.health, s.prologue.stage_clock, s.prologue.robots.length);
  return s;
};
const dbg = async (q, tag) => { if (!process.env.PDEBUG) return; const s = await q.read(); console.log('[prologue]', tag, Math.round(s.world.x), Math.round(s.world.y), 'z', Math.round(s.world.z), 'ang', Math.round(s.world.angle), 'hp', s.world.health, 'rk', s.prologue.rockets, 'yard', s.prologue.stage_clock, 'bots', s.prologue.robots.length, 'allies', s.prologue.allies, 'pdoom', s.prologue.pdoom); };

// PWIP=1 while iterating: wip-<name>, so --shot finale-rockets does not also run _test.mjs's draft.
const N = n => process.env.PWIP ? 'wip-' + n : n;

export default [
  {
    name: N('finale-rockets'), about: 'THE LAST GROUND: rockets into the machine swarm (first image of the trailer)',
    url: '?prologue=1', seconds: 6, waitFor: s => s.prologue?.clock > 35,
    zscript: fixture({god: true, give: ['RocketLauncher'], weapon: 'RocketLauncher', spring: [-15584, -28600, 270], heavy: true, shield: true,
      // Once it has landed (1.5 s), the barrage closes into one swarm ahead of us, 200-540 units
      // out within 16 degrees of the view (where it was heading anyway), so the rockets land among them,
      // and 24 more come on behind them, so it lasts the whole shot.
      // Three ED-404s (700 health: the rockets keep bursting on them all shot long) stand in the
      // middle of it. Nothing gets closer than 150 units (Sentinels 230). 1.7 s and 3.4 s in, more
      // teleport in among them.
      members: 'bool Gathered;', tick: GATHER(52, 200, 540, 16, 24) + KEEPOUT(150, 230) +
        REINFORCE('b.StageClock == 52', 3, 330, 470, 7, ['PDWarEnforcer']) +
        REINFORCE('t == 60', 10, 300, 640, 15) + REINFORCE('t == 120', 10, 300, 640, 15) +
        // The soldiers behind us hold their ground (one walking past the lens fills the frame), and
        // no fresh ones run in from the airlock.
        `b.AllyClock = 0; if (b.Stage == 2 && b.StageClock == 52) { Actor a; let it = ThinkerIterator.Create('PDWarAlly'); while (a = Actor(it.Next())) a.Speed = 0; }`}),
    setup: async ({q, page}) => {
      await sprung(q, page);
      await tics(q, 52);
      await dbg(q, 'pre-fire');
      await key(page, 'ctrl', true);
      await tics(q, 25);
      await dbg(q, 'end-setup');
    },
    // A slow sweep across the swarm (rockets fly where we look; autoaim finds the height).
    look: [{at: 0, dyaw: 0, pitch: 2}, {at: 1.9, dyaw: -5, pitch: 2.5}, {at: 3.8, dyaw: 4, pitch: 2}, {at: 6, dyaw: -1, pitch: 1.5}],
    keys: [{key: 'ctrl', from: 0, to: 5.7}, {key: 'd', from: 1.1, to: 1.6}, {key: 'a', from: 3.4, to: 3.9}],
  },
  {
    name: N('finale-chaingun'), about: 'THE LAST GROUND: chaingun beside the soldiers and the other founder',
    url: '?prologue=1', seconds: 6, waitFor: s => s.prologue?.clock > 35,
    zscript: fixture({god: true, give: ['Chaingun'], weapon: 'Chaingun', spring: [-15584, -28600, 270], heavy: true, shield: true,
      members: 'bool Gathered, Formed, AimSet; double AimYaw0; Actor AimAt;',
      // The barrage closes into a swarm ahead (as in finale-rockets), then the soldiers and the
      // founder spread into a firing line just ahead of us; they fight on their own from there,
      // tougher than usual so the line holds for the shot.
      // No fresh soldiers running in from the airlock behind us mid-shot (they would cross the lens).
      tick: GATHER(52, 230, 520, 18, 6) + FORMATION(54, [[170, 55, 'founder'], [150, -110], [175, 150], [240, -170], [120, 250], [215, -290]], 300, 2) + 'b.AllyClock = 0;' + AIM(0.1, 24, 5)}),
    setup: async ({q, page}) => {
      await sprung(q, page);
      await tics(q, 56);
      await dbg(q, 'pre-fire');
      await key(page, 'ctrl', true);
      await tics(q, 16);
      await dbg(q, 'end-setup');
    },
    // Locks onto one machine ahead, cuts it down, swings to the next (AIM: within 24 degrees).
    look: [{at: 0, free: true}],
    keys: [{key: 'ctrl', from: 0, to: 5.8}, {key: 'a', from: 2.2, to: 2.6}],
  },
  {
    name: N('finale-overrun'), about: 'THE LAST GROUND: overwhelmed, P(DOOM) climbing, a near-death flash',
    url: '?prologue=1', seconds: 5, waitFor: s => s.prologue?.clock > 35,
    zscript: fixture({buddha: true, give: ['Chaingun'], weapon: 'Chaingun', spring: [-15584, -28600, 200], heavy: true,
      members: 'bool Gathered, Started; int LastHp, NextHit;',
      // Facing west-south-west this time. The barrage and a second horde close in all across the
      // view (150-480 units, +-32 degrees). Buddha, so real hits land (pain flashes, the face
      // bloodies) but never end it; OVERRUN ramps them (see there).
      tick: GATHER(96, 150, 480, 32, 22) + OVERRUN(5)}),
    setup: async ({q, page}) => {
      await sprung(q, page);
      await tics(q, 98);
      await dbg(q, 'pre-fire');
      await key(page, 'ctrl', true);
      await tics(q, 18);
      await dbg(q, 'end-setup');
    },
    // Scanning left and right: they are everywhere.
    look: [{at: 0, dyaw: 0, pitch: 1}, {at: 1.4, dyaw: 13, pitch: 0}, {at: 2.9, dyaw: -12, pitch: 1}, {at: 4.2, dyaw: 3, pitch: -2}, {at: 5, dyaw: 0, pitch: -3}],
    keys: [{key: 'ctrl', from: 0, to: 5}, {key: 's', from: 2.5, to: 3.0}],
  },
  {
    name: N('battle-room'), about: 'THE BREACH: walking into a room already at war, soldiers and machines trading fire',
    url: '?prologue=1', seconds: 5, waitFor: s => s.prologue?.clock > 35,
    // Section 6 (0-based 5): the hell-sky court of E3M1, mid-battle the moment we arrive. We stand
    // just behind the soldiers who ran in ahead of us, the squads trading fire with them up the court.
    zscript: fixture({section: 5, god: true, give: ['Shotgun'], weapon: 'Shotgun', pose: [-18800, -29700, 92], heavy: true, shield: 'Placed',
      // The soldiers who came in with us spread into a firing line ahead, clear of the middle of the
      // view (tough, and they stand their ground, so it holds for the shot).
      members: 'bool Formed, Cleared, AimSet; double AimYaw0; Actor AimAt;', tick: 'b.AllyClock = 0;' + KEEPOUT(200, 300, 'Placed') + AIM(0.08, 16, 4) +
        FORMATION(0, [[240, -150], [300, 150], [400, -45], [250, 270], [440, 105]], 400, 0.01, 'Placed') +
        // The pickups at our feet (a rocket crate and a medikit) are cleared from the foreground.
        `if (Placed && !Cleared) { Cleared = true; Array<Actor> junk; Actor a; let it = ThinkerIterator.Create('Inventory');
          while (a = Actor(it.Next())) if (!Inventory(a).Owner && p.Distance2D(a) < 360) junk.Push(a);
          for (int i = 0; i < junk.Size(); i++) junk[i].Destroy(); }`}),
    setup: async ({q, page}) => {
      await arm(page);
      await q.wait(s => s.prologue.section === 6 && s.prologue.arrive >= 2, 'In the Breach', 30000);
      await tics(q, 40);
      await dbg(q, 'pre-fire');
      await key(page, 'ctrl', true);
      await tics(q, 12);
      await dbg(q, 'end-setup');
    },
    look: [{at: 0, free: true}],
    keys: [{key: 'ctrl', from: 0, to: 5}, {key: 'd', from: 0.7, to: 1.0}, {key: 'a', from: 2.6, to: 3.0}],
  },
];

// ZScript for finale-overrun (after GATHER; members 'bool Started; int LastHp, NextHit;'). Before the
// shot: full health, no flash, and once gathered the yard clock jumps to 560 tics (P(DOOM) 84, so the
// status bar already reads it on the first frame). During it (t counts from 1): the yard clock runs
// 4x (P(DOOM) from 84 to 99, the waves come
// faster); one machine bolt in every 0.85 s, then every 0.35 s, is let through to hit us (dozens of
// machines fire at once: the rest vanish just short, or the view would be one white plasma burst;
// none before the shot);
// every hit that lands snaps health into a band that falls from 100 to 8 over the shot, so the face
// bloodies step by step, and flashes red, faint at first (Doom's pain blend is steep), stronger
// as it goes; 0.4 s before the end, one heavy hit and a near-death flash.
function OVERRUN(seconds) {
  const T = Math.round(seconds * 35);
  return `
		if (b.Stage == 2)
		{
			if (t <= ${T})
			{
				Array<Actor> near; Actor m;
				let it = ThinkerIterator.Create('Actor');
				while (m = Actor(it.Next())) if (m.bMissile && m.special2 == 0 && m.target && m.target is 'PDWarWalker' && p.Distance3D(m) < 80) near.Push(m);
				for (int i = 0; i < near.Size(); i++)
				{
					if (t >= 0 && t >= NextHit) { near[i].special2 = 1; NextHit = t + int(30 - 18 * t / ${T}.); }
					else near[i].Destroy();
				}
			}
			if (t < 0)
			{
				if (p.Health < 100) p.A_SetHealth(100); players[0].damagecount = 0; LastHp = 100; NextHit = 12;
				if (Gathered && !Started) { Started = true; if (b.StageClock < 560) b.StageClock = 560; }
			}
			else if (t <= ${T})
			{
				double u = t / ${T}.;
				b.StageClock += 3;
				int hi = int(100 - 92 * u), lo = max(4, hi - 12);
				int cap = t >= ${T - 14} ? 56 : int(4 + 30 * u * u * u);
				if (p.Health < LastHp) { p.A_SetHealth(clamp(p.Health, lo, hi)); players[0].damagecount = cap; }
				if (t == ${T - 14})
				{
					Actor near = null; double nd = 1e9; Actor a;
					let it = ThinkerIterator.Create('PDWarWalker');
					while (a = Actor(it.Next())) if (a.Health > 0 && p.Distance2D(a) < nd) { nd = p.Distance2D(a); near = a; }
					p.DamageMobj(near, near, 30, 'None');
					p.A_SetHealth(max(3, lo - 6));
					players[0].damagecount = 56;
				}
				if (players[0].damagecount > cap) players[0].damagecount = cap;
				LastHp = p.Health;
			}
		}`;
}

// ZScript (members 'bool AimSet; double AimYaw0; Actor AimAt;'), with look [{at: 0, free: true}]:
// during the shot, aim at one machine at a time, staying within +-cone degrees of where the shot
// started: keep the target until it is down (or out of sight or the cone), then take the one
// nearest to the current view, so the camera moves in small swings instead of wandering off.
// Pitch is kept within +-maxPitch (gunships overhead would tip the view to the sky).
function AIM(rate, cone, maxPitch) {
  return `
		if (t >= 0)
		{
			if (!AimSet) { AimSet = true; AimYaw0 = p.Angle; }
			if (!AimAt || AimAt.Health <= 0 || abs(Actor.deltaangle(AimYaw0, p.AngleTo(AimAt))) > ${cone} || !p.CheckSight(AimAt))
			{
				AimAt = null; double best = 1e9; Actor a;
				let it = ThinkerIterator.Create('PDWarWalker');
				while (a = Actor(it.Next()))
				{
					if (a.Health <= 0) continue;
					double d = p.Distance2D(a);
					if (d > 1400 || d < 64 || abs(Actor.deltaangle(AimYaw0, p.AngleTo(a))) > ${cone} || !p.CheckSight(a)) continue;
					double score = d * (1 + abs(Actor.deltaangle(p.Angle, p.AngleTo(a))) / 12.);
					if (score < best) { best = score; AimAt = a; }
				}
			}
			if (AimAt)
			{
				Vector3 dd = AimAt.Pos + (0, 0, AimAt.Height * 0.55) - (p.Pos.XY, players[0].viewz);
				double yaw = atan2(dd.Y, dd.X), pitch = clamp(-atan2(dd.Z, dd.XY.Length()), -${maxPitch}, ${maxPitch});
				p.A_SetAngle(p.Angle + Actor.deltaangle(p.Angle, yaw) * ${rate}, SPF_INTERPOLATE);
				p.A_SetPitch(p.Pitch + (pitch - p.Pitch) * ${rate}, SPF_INTERPOLATE);
			}
		}`;
}

// ZScript: no machine comes closer than r units (rSquid for the lunging Sentinels): one that walks
// right up fills the view, and a rocket bursting on it at point blank whites out the frame. Any that
// does is set back onto the ring, so they bunch up at that distance instead.
function KEEPOUT(r, rSquid = r, when = 'b.Stage == 2') {
  return `
		if (${when})
		{
			Actor a; let it = ThinkerIterator.Create('PDWarWalker');
			while (a = Actor(it.Next()))
			{
				if (a.Health <= 0) continue;
				Vector2 d = a.Pos.XY - p.Pos.XY; double l = d.Length(), r = a is 'PDWarSquid' ? ${rSquid} : ${r};
				if (l >= r || l < 1) continue;
				Vector2 to = p.Pos.XY + d / l * r;
				a.SetOrigin((to, max(a.Pos.Z, Floor(to))), true); a.Vel = (0, 0, 0);
			}
		}`;
}

// ZScript: when `when` first holds (e.g. 't == 70' for program tic 70, or 'b.StageClock == 52'),
// n more machines (cycling through kinds) teleport in ahead of the player, rmin..rmax units out and
// within +-spread degrees of his view, with Doom's teleport flash, and come for him.
function REINFORCE(when, n, rmin, rmax, spread, kinds = ['PDWarTrooper', 'PDWarAssault', 'PDWarGunship', 'PDWarTrooper', 'PDWarEnforcer', 'PDWarAssault', 'PDWarSquid', 'PDWarTrooper']) {
  const id = REINFORCE.n = (REINFORCE.n || 0) + 1;
  return `
		if (b.Stage == 2 && (${when}))
		{
			static const Name KINDS_${id}[] = { ${kinds.map(k => `'${k}'`).join(', ')} };
			for (int i = 0; i < ${n}; i++)
			{
				Name kind = KINDS_${id}[i % ${kinds.length}];
				for (int k = 0; k < 8; k++)
				{
					double r = frandom(${rmin}, ${rmax}), ang = p.Angle + frandom(-${spread}, ${spread});
					Vector2 to = p.Pos.XY + (cos(ang), sin(ang)) * r;
					let bot = Actor.Spawn(kind, (to, Floor(to) + (kind == 'PDWarGunship' ? 72 : 0)));
					if (!bot) break;
					if (!bot.TestMobjLocation() || b.SectionOf(bot.CurSector) != b.Finale) { bot.Destroy(); continue; }
					Actor.Spawn('TeleportFog', (to, Floor(to)));
					bot.Angle = bot.AngleTo(p); bot.Target = p; bot.SetStateLabel('See');
					break;
				}
			}
		}`;
}

// ZScript: once, at yard tic `at`, move every live machine in the yard to a random spot ahead of the
// player, rmin..rmax units out and within +-spread degrees of his view (gunships 72 up; the fast
// Sentinels at the back, around rmax, or they are in our face within a second).
function GATHER(at, rmin, rmax, spread, extra = 0) {
  return `
		if (!Gathered && b.Stage == 2 && b.StageClock >= ${at})
		{
			Gathered = true;
			Array<Actor> bots; Actor a;
			let it = ThinkerIterator.Create('PDWarWalker');
			while (a = Actor(it.Next())) if (a.Health > 0 && b.SectionOf(a.CurSector) == b.Finale) bots.Push(a);
			for (int i = 0; i < bots.Size(); i++)
			{
				let bot = bots[i]; Vector3 was = bot.Pos;
				for (int k = 0; k < 8; k++)
				{
					double r = bot is 'PDWarSquid' ? frandom(${rmax} - 150, ${rmax} + 150) : frandom(${rmin}, ${rmax}), ang = p.Angle + frandom(-${spread}, ${spread});
					Vector2 to = p.Pos.XY + (cos(ang), sin(ang)) * r;
					double z = Floor(to) + (bot is 'PDWarGunship' ? 72 : 0);
					bot.SetOrigin((to, z), false);
					if (bot.TestMobjLocation() && b.SectionOf(bot.CurSector) == b.Finale) { bot.Angle = bot.AngleTo(p); bot.ClearInterpolation(); break; }
					bot.SetOrigin(was, false);
				}
			}
			// The next wave already on its way in behind them, so the swarm lasts the whole shot.
			static const Name KINDS[] = { 'PDWarTrooper', 'PDWarAssault', 'PDWarSquid', 'PDWarTrooper', 'PDWarGunship', 'PDWarAssault', 'PDWarTrooper', 'PDWarEnforcer' };
			for (int i = 0; i < ${extra}; i++)
			{
				Name kind = KINDS[i % 8];
				for (int k = 0; k < 8; k++)
				{
					double r = frandom(${rmax}, ${rmax} + 520), ang = p.Angle + frandom(-${spread} - 6, ${spread} + 6);
					Vector2 to = p.Pos.XY + (cos(ang), sin(ang)) * r;
					let bot = Actor.Spawn(kind, (to, Floor(to) + (kind == 'PDWarGunship' ? 72 : 0)));
					if (!bot) break;
					if (!bot.TestMobjLocation() || b.SectionOf(bot.CurSector) != b.Finale) { bot.Destroy(); continue; }
					bot.Angle = bot.AngleTo(p); bot.Target = p; bot.SetStateLabel('See');
					break;
				}
			}
		}`;
}

// ZScript: once, at yard tic `at`, put the founder and the live soldiers at [forward, right] offsets
// from the player (in his view), facing the way he faces, with `hp` health (and walking `speed`:
// slow, so they hold a firing line instead of charging off into the swarm).
function FORMATION(at, spots, hp, speed = 0, when = `b.Stage == 2 && b.StageClock >= ${at}`) {
  return `
		if (!Formed && (${when}))
		{
			Formed = true;
			Vector2 fwd = (cos(p.Angle), sin(p.Angle)), right = (cos(p.Angle - 90), sin(p.Angle - 90));
			Array<Actor> men; Actor a;
			let it = ThinkerIterator.Create('PDWarAlly');
			while (a = Actor(it.Next())) if (a.Health > 0 && !(a is 'PDWarFounder')) men.Push(a);
			int next = 0;
			${spots.map(([f, r, who]) => `{
				Actor m = ${who === 'founder' ? 'b.Founder' : 'next < men.Size() ? men[next++] : null'};
				if (m)
				{
					Vector2 to = p.Pos.XY + fwd * ${f} + right * ${r};
					Vector3 was = m.Pos;
					m.SetOrigin((to, Floor(to)), false);
					if (!m.TestMobjLocation()) m.SetOrigin(was, false);
					else { m.Angle = p.Angle; m.ClearInterpolation(); ${who === 'founder' ? '' : `m.A_SetHealth(${hp});`} ${speed ? `m.Speed = ${speed};` : ''} }
				}
			}`).join('\n')}
		}`;
}
export {fixture, key, tics, sprung, arm};
