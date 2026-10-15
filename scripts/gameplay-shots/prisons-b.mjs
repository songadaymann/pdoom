// Five Prisons gameplay shots for the vertical promo trailers (set B): a cell release, an escort,
// the hunter's laser, Stuart's turret gallery, Hinton's demolition charge and the crawlspace.
//   node scripts/capture-gameplay.mjs --shot cell-release,escort,hunter-laser,turret,charge-blast,crawl
import fs from 'node:fs/promises';

const L1 = '?level=five-prisons';
const DUMP = '/private/tmp/claude-501/-Users-jonathanmann-SongADAO-Dropbox-Jonathan-Mann-projects-games-p-doom/6b9647ca-c3fe-4652-a1e5-066e18bc4635/scratchpad/pb/';
const CLEAN = `mann-cool-game-shell, #restart, #dev-badge, #touch, #finish, #result, #reticle, #onboarding, #launcher, #story, #intro-video, #game-text, #status-line, #prompt, #message, #people, #threat-warning, #doom-dialogue, #hal-question, #bliss-guide { display:none !important; }
button { display:none !important; }
#stage { position:fixed !important; inset:0 !important; width:1080px !important; height:676px !important; transform:none !important; }
#canvas { position:absolute !important; left:0 !important; top:0 !important; width:1080px !important; height:676px !important; max-width:none !important; max-height:none !important; transform:none !important; image-rendering:pixelated !important; }`;

// Scouting (only when PB_SCOUT is set): PB_POSES="x,y,angle[,pitch];..." -> one still each in DUMP.
const SCOUT = process.env.PB_SCOUT ? [{
  name: 'pb-scout', about: 'scouting stills', url: L1, seconds: 1, ceos: ['altman'],
  setup: async ({q, page, net}) => {
    await fs.mkdir(DUMP, {recursive: true});
    await q.command('god');
    await net('quiet');
    await page.addStyleTag({content: CLEAN});
    if (process.env.PB_PRE) for (const c of process.env.PB_PRE.split(';')) await q.command(c);
    for (const [x, y, a, pitch, hx, hy, ha] of (process.env.PB_POSES || '').split(';').filter(Boolean).map(s => s.split(',').map(Number))) {
      await net('pose', x, y, a);
      if (pitch) await net('look', a, pitch);
      if (hx !== undefined) { await net('hunter', hx, hy, ha); await net('quiet'); }
      await page.waitForTimeout(500);
      await page.screenshot({path: `${DUMP}scout_${x}_${y}_${a}.png`});
    }
    await fs.writeFile(DUMP + 'state.json', JSON.stringify(await q.read(), null, 1));
  },
}] : [];

// Capture-only ZScript fixtures (class PDPlayShot; never shipped). Netevents used in setup:
//   pdshot_hunter x y angle   park the hunter standing at a spot (held until recording starts)
//   pdshot_place site x y     move a person (captive or freed) there; it becomes their idle anchor
//   pdshot_face site angle    turn a person
//   pdshot_carded site        skip that person's name card (its UI block would also release held keys)
//   pdshot_charge             give the demolition charge
//   pdshot_god                god mode until recording starts (no damage flash left over from setup)
//   pdshot_escort lead        free all five (no cards, no first-guide, no brownout) and stand them in a
//                             wedge in front of you; while recording they walk to keep that wedge
// While recording: the hunter is released into its real AI (walk toward you, aim, lock, fire) with
// its first reload delay and aim charge shortened (hunterWalk tics of walking, aim starts aimHead
// tics in); captives in FACE stand still looking at you until freed; the first guide's 140-tic
// "let me finish my line" pause is cut to guideWait; a planted charge's fuse is cut to fuse tics.
const FIX = ({hunterWalk = 0, aimHead = 0, face = [], guideWait = 140, escort = null, fuse = 0} = {}) => `
class PDPlayShot : EventHandler
{
	bool Released, Bumped, Fixed, Fused, Ungod;
	double A0; int Lead;
	static const int FACE[] = { ${[...face, -1].join(', ')} };
	static const int EDX[] = { ${(escort?.dx || [0, 0, 0, 0, 0]).join(', ')} };
	static const int EDY[] = { ${(escort?.dy || [0, 0, 0, 0, 0]).join(', ')} };
	Vector2 Slot(int i, double lead)
	{
		Vector2 f = (cos(A0), sin(A0)), r = (sin(A0), -cos(A0));
		return players[0].mo.Pos.XY + f * (EDY[i] - lead) + r * EDX[i];
	}
	override void NetworkProcess(ConsoleEvent e)
	{
		let game = PDCheckpoint.Get();
		if (!game || !game.Cast || e.Name.Left(7) != "pdshot_") return;
		let pawn = players[0].mo;
		if (e.Name == "pdshot_hunter" && game.Hunter)
		{
			let h = game.Hunter;
			Vector2 at = (e.Args[0], e.Args[1]);
			h.SetOrigin((at, PDPlayCap.Floor(at)), false); h.Angle = e.Args[2]; h.ClearInterpolation();
			h.StunUntil = level.time + 100000; h.AimTics = 0; h.LockedAim = false; h.Mood = 0; h.SetStateLabel('Spawn');
			game.Awake = true; game.WakeAt = level.time - 175;
			// Forget the route it was walking before the jump, or it heads back toward that waypoint.
			game.HunterNav.HasWaypoint = false; game.HunterNav.Ready = false;
		}
		else if (e.Name == "pdshot_place")
		{
			let p = game.Cast.People[e.Args[0]];
			if (!p.Body) return;
			Vector2 at = (e.Args[1], e.Args[2]);
			p.Body.SetOrigin((at, PDPlayCap.Floor(at)), false); p.Body.ClearInterpolation();
			p.HoldGoal = at; p.Idling = false; p.Nav.HasWaypoint = false;
		}
		else if (e.Name == "pdshot_face") { let p = game.Cast.People[e.Args[0]]; if (p.Body) p.Body.Angle = e.Args[1]; }
		else if (e.Name == "pdshot_carded") game.Cast.People[e.Args[0]].Carded = true;
		else if (e.Name == "pdshot_charge") game.HasCharge = true;
		else if (e.Name == "pdshot_god") { players[0].cheats |= CF_GODMODE; Ungod = true; }
		else if (e.Name == "pdshot_escort")
		{
			A0 = pawn.Angle; Lead = e.Args[0];
			game.Refuge.Introduced = true; game.Polish.BrownoutUntil = 1;
			for (int i = 0; i < 5; i++)
			{
				let p = game.Cast.People[i];
				p.Carded = true;
				game.OpenCell(i, "development");
				if (!p.Body) continue;
				Vector2 at = Slot(i, 0);
				p.Body.SetOrigin((at, PDPlayCap.Floor(at)), false); p.Body.ClearInterpolation();
				p.Body.Angle = p.Body.AngleTo(pawn);
				p.Holding = true; p.HoldGoal = at; p.Idling = false; p.Nav.HasWaypoint = false; p.Complete = true;
			}
		}
	}
	override void WorldTick()
	{
		let cap = PDPlayCap(EventHandler.Find('PDPlayCap'));
		let game = PDCheckpoint.Get();
		if (!game || !game.Cast) return;
		let pawn = players[0].mo;
		for (int k = 0; k < FACE.Size(); k++)
		{
			int i = FACE[k]; if (i < 0) continue;
			let p = game.Cast.People[i];
			if (p.Released || !p.Body) continue;
			p.Idling = true; p.IdleGoal = p.Body.Pos.XY; p.IdleUntil = level.time + 35;
			p.Body.Angle = p.Body.AngleTo(pawn);
		}
		int g = game.Refuge.Guide;
		if (!Fixed && g >= 0 && game.Cast.People[g].Released) { Fixed = true; game.Cast.People[g].ReleasedAt = level.time - 140 + ${guideWait}; }
		if (!cap || !cap.Active)
		{
			// Before recording: the escort stands still facing you.
			if (Lead > 0)
				for (int i = 0; i < 5; i++)
				{
					let p = game.Cast.People[i];
					if (!p.Body || !p.Released) continue;
					p.Idling = true; p.IdleGoal = p.Body.Pos.XY; p.IdleUntil = level.time + 35;
					p.Body.Angle = p.Body.AngleTo(pawn);
				}
			return;
		}
		if (Ungod) { Ungod = false; players[0].cheats &= ~CF_GODMODE; }
		let h = game.Hunter;
		if (${hunterWalk} > 0 && h)
		{
			if (!Released) { Released = true; h.StunUntil = 0; h.ReloadUntil = level.time + ${hunterWalk}; game.LastKnown = pawn.Pos.XY; game.Polish.LastAlert = level.time; }
			if (!Bumped && h.Mood == 2) { Bumped = true; h.AimTics += ${aimHead}; }
		}
		if (Lead > 0)
			for (int i = 0; i < 5; i++)
			{
				let p = game.Cast.People[i];
				if (!p.Body || !p.Released || !p.Alive) continue;
				p.Holding = true; p.HoldGoal = Slot(i, Lead);
				// Their real walk (4.2/tic) is a little slower than yours backing away (4.67/tic);
				// a small extra step keeps the group at the same distance for the clip.
				Vector2 d = p.HoldGoal - p.Body.Pos.XY;
				if (p.Walking && d.Length() > 48) p.Body.TryMove(p.Body.Pos.XY + d / d.Length() * ${escort?.boost ?? 0}, 1);
			}
		if (${fuse} > 0 && !Fused && game.Encounters.FuseUntil > 0)
		{
			Fused = true; game.Encounters.FuseUntil = level.time + ${fuse};
			// The burning charge spawns on the wall plane, where the wall clips its sprite away;
			// stand it a few units out from the wall so the camera can see it burn.
			let f = game.Encounters.FuseVisual;
			if (f) f.SetOrigin(f.Pos + (cos(f.AngleTo(pawn)) * 10, sin(f.AngleTo(pawn)) * 10, 0), false);
		}
	}
}
`;
// Name cards and aim-at name tags are page UI, not part of the game view.
const NO_CARDS = `#discovery-card, #person-label { display:none !important; }`;
// Keep the lock-on's red vignette (it grows with the charge) but not its LOCKED nn% text.
const VIGNETTE = `#threat-warning { display:block !important; color:transparent !important; text-shadow:none !important; }` + NO_CARDS;

export default [
  ...SCOUT,
  {
    name: 'cell-release', about: "inside Liron's cell: the release opens the door behind him, he turns and leads you out (the first guide)",
    url: L1, seconds: 4,
    zscript: FIX({face: [0], guideWait: 32}),
    setup: async ({q, net, page}) => {
      await net('wrench');
      await net('pose', 1928, 914, 90);
      await q.command('netevent pdshot_place 0 1940 1004');
      await q.command('netevent pdshot_carded 0');
      await page.waitForTimeout(700);
    },
    look: [{at: 0, dyaw: 0, pitch: 0}, {at: 1.0, dyaw: 0, pitch: 0}, {at: 1.1, track: 'person', i: 0, rate: 0.08, dpitch: 4}],
    keys: [{key: 'w', from: 1.75, to: 2.6}],
    events: [{at: 0.3, name: 'free', args: [0]}],
    css: NO_CARDS,
  },
  {
    name: 'hunter-laser', about: 'the Inferminator closes in down a grey corridor, visor red, laser locks and fires; you take the hit and back off',
    url: L1, seconds: 4.6,
    zscript: FIX({hunterWalk: 55, aimHead: 40}),
    setup: async ({q, net, page}) => {
      await net('wrench');
      await net('pose', -672, 584, 90);
      await q.command('netevent pdshot_hunter -672 772 270');
      await page.waitForTimeout(600);
    },
    look: [{at: 0, track: 'hunter', rate: 0.15}],
    keys: [{key: 'd', from: 3.2, to: 3.55}, {key: 's', from: 3.3, to: 3.7}],
    events: [{at: 0, name: 'buddha', args: [1]}],
    css: VIGNETTE,
  },
  {
    name: 'escort', about: 'five freed people hurry after you down the east hall (you walk backward, looking at them)',
    url: L1, seconds: 5,
    zscript: FIX({escort: {dx: [-8, -40, 32, -22, 14], dy: [92, 128, 134, 174, 184], boost: 0.55}}),
    setup: async ({q, net, page}) => {
      await net('wrench');
      await net('quiet');
      await net('pose', 1600, 1036, 90);
      await q.command('netevent pdshot_escort 55');
      await page.waitForTimeout(900);
    },
    look: [{at: 0, yaw: 90, pitch: 1}, {at: 5, yaw: 88, pitch: 1}],
    keys: [{key: 's', from: 0.1, to: 4.4}],
    css: NO_CARDS,
  },
  {
    name: 'turret', about: "Stuart Russell's gallery turret firing plasma down the middle of the gallery at you; you sidestep (god mode: plasma splashes, no red damage tint)",
    url: L1, seconds: 3.3,
    setup: async ({q, net, page}) => {
      await net('wrench');
      await net('quiet');
      await q.command('god');
      await net('pose', -76, 1690, 96);
      await page.waitForTimeout(1200);
    },
    look: [{at: 0, track: 'point', x: -112, y: 1952, z: 48, rate: 0.15}],
    keys: [{key: 'a', from: 0.25, to: 0.75}, {key: 'd', from: 1.2, to: 1.85}, {key: 'a', from: 2.3, to: 2.8}],
    css: NO_CARDS,
  },
  {
    name: 'charge-blast', about: "Hinton's demolition charge: plant it on the cracked wall, back off, the blast opens the passage and Hinton steps out",
    url: L1, seconds: 4.4,
    zscript: FIX({fuse: 47, guideWait: 8}),
    setup: async ({q, net, page}) => {
      await net('wrench');
      await net('quiet');
      await q.command('netevent pdshot_charge');
      await q.command('netevent pdshot_carded 3');
      await net('pose', -1384, 1120, 180);
      await page.waitForTimeout(500);
    },
    look: [{at: 0, track: 'point', x: -1462, y: 1120, z: 16, rate: 0.12}, {at: 2.0, track: 'person', i: 3, rate: 0.06, dpitch: 3}],
    press: [{key: 'e', at: 0.15}],
    keys: [{key: 's', from: 0.55, to: 1.1}, {key: 'w', from: 2.4, to: 2.9}],
    css: NO_CARDS,
  },
  {
    name: 'crawl', about: "duck into Liron's crawlspace: the view drops into a low white duct, turns the corner and crawls down its long leg",
    url: L1, seconds: 3.6,
    setup: async ({net, page}) => {
      await net('wrench');
      await net('quiet');
      await net('pose', 1660, 960, 0);
      await page.waitForTimeout(500);
    },
    look: [{at: 0, yaw: 0, pitch: 0}, {at: 1.15, yaw: 0, pitch: 0}, {at: 1.85, yaw: -90, pitch: 0}, {at: 3.6, yaw: -90, pitch: 0}],
    keys: [{key: 'w', from: 0, to: 3.6}],
    css: NO_CARDS,
  },
];
