#!/usr/bin/env node
// Capture a smooth camera fly-through of a built p(DOOM) level from the real
// GZDoom WebAssembly engine, for the per-level intro films
// (scripts/build-level-intros.py composites them). Shots live in scripts/level-intros.json.
//
//   node scripts/capture-level-flythrough.mjs --map E1M4                     # landscape 1280x800, 35 fps
//   node scripts/capture-level-flythrough.mjs --map E1M4 --format vertical   # 1080x1920, 30 fps
//   node scripts/capture-level-flythrough.mjs --map E1M4 --shot loop,turret  # re-capture some shots (merged)
//   node scripts/capture-level-flythrough.mjs --map E1M4 --stills poses.json --out /tmp/scout   # scouting stills
//   node scripts/capture-level-flythrough.mjs --map E1M4 --scout             # one still per shot keyframe
//   node scripts/capture-level-flythrough.mjs --map E1M7 --music D_E1M7      # render a WAD music lump (OPL)
//   node scripts/capture-level-flythrough.mjs --map E1M4 --url http://127.0.0.1:5198/   # use a running server
//
// How it works (nothing in the game is modified; everything below is injected
// into this capture browser only):
//  * The game is served read-only from doom-web/ by a throwaway local server on a
//    random port (or --url), and booted in headless Chrome as a player would.
//  * A tiny extra resource file (capture.pk3) is added to the engine's boot
//    arguments. It registers PDCapHandler, a ZScript event handler that, once
//    triggered (a bound key sends `netevent pdcap_go`), moves an invisible camera
//    actor along a precomputed per-tic path (players[0].camera = that actor), can
//    drive the level's guardian (walk / aim / HAL's eye colour) along its own path,
//    can hold prisoners facing the camera, and can wait for a game state (TEABOT's
//    service phase) before a shot. The path is baked into the pk3 as a text lump.
//    The player is made invisible and god-moded; it never moves, so no game logic fires.
//  * The engine worker's clock (performance.now) is virtualised. After boot the
//    clock is frozen and advanced in sub-tic steps, each followed by a render, so the
//    game simulates and renders deterministically however slowly headless Chrome
//    draws: one frame per tic at 35 fps, or engine-interpolated frames at 30 fps.
//    Every frame is a real engine render, grabbed with a page screenshot.
//  * The HTML HUD, status bar, prompts and dialogue are hidden with CSS; the
//    engine runs with screenblocks 12 and no crosshair, and a camera actor has
//    no weapon sprite, so frames are clean. Cuts hold the first pose for two tics so
//    view interpolation never blends two shots; leading black frames are dropped later.
//
// Shot format (level-intros.json, capture.formats.<format>.shots[]):
//   {name, seconds, ease: smooth|gentle|linear|..., fov?, keys: [{at:[x,y,z], look:[x,y,z]} | {at, yaw, pitch}],
//    lookAtGuardian?: z, guardianPitch?: deg, face?: [prisoner sites], wait?: {kind: 'tea'|'delay', arg},
//    guardian?: {keys:[{at:[x,y]}], seconds?, hover?, face?: 'move'|'camera'|deg|[x,y], mode, states:[{at, mode, face?}]}}
//   Doom units, z absolute. Guardian modes: 1 walk, 3 stand, 4 aim (red visor), 2/6/5 HAL cyan/amber/red eye.
//   A vertical format may reuse the landscape shots ("shotsFrom") with per-shot "overrides".
//
// Output: doom-web/local/intro/levels/raw/<map>[-vertical]/<shot>/00000.png ...
//         plus capture.json (size, fps, frames and per-tic camera/guardian poses per shot).
import {chromium} from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {startGame} from './doom-qa-ui.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WEB = path.join(ROOT, 'doom-web');
const DATA = path.join(ROOT, 'scripts', 'level-intros.json');
// New captures go to raw-v2/ so the v1 footage in raw/ (read by other tools) is never overwritten.
const OUT_ROOT = path.join(WEB, 'local', 'intro', 'levels', process.argv.includes('--raw') ? process.argv[process.argv.indexOf('--raw') + 1] : 'raw-v2');
const TIC = 1000 / 35;

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const flag = name => argv.includes('--' + name);
const MAP = (opt('map', 'E1M4')).toUpperCase();
const FORMAT = opt('format', 'landscape');
const SCOUT = flag('scout');
const ONLY = opt('shot', null);
const BASE_URL = opt('url', null);
const HEADED = flag('headed');
const MUSIC = opt('music', null);     // e.g. D_E1M7: render a WAD music lump with the engine's own OPL synth (writewave) instead of capturing
const STILLS = opt('stills', null);   // JSON file: [{name, at:[x,y,z], look:[x,y,z]} | {name, at, yaw, pitch}] -> one still each

const data = JSON.parse(await fs.readFile(DATA, 'utf8'));
const level = data.levels[MAP];
if (!level) throw Error(`No level "${MAP}" in ${DATA}`);
const cap = level.capture;
const fmt = cap.formats[FORMAT];
if (!fmt) throw Error(`Level ${MAP} has no capture format "${FORMAT}"`);
const [W, H] = fmt.size;
const FPS = fmt.fps || 35;   // capture rate: 35 = one frame per tic; other rates step the virtual clock by 1/fps and let the engine interpolate
const OUT = opt('out', null) || (MUSIC ? path.join(WEB, 'local', 'intro', 'levels', 'music', 'log-' + MUSIC.toLowerCase()) : null) || path.join(OUT_ROOT, MAP.toLowerCase() + (FORMAT === 'landscape' ? '' : '-' + FORMAT) + (SCOUT ? '-scout' : STILLS ? '-stills' : ''));

// ---------------------------------------------------------------- camera paths
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = u => u * u * (3 - 2 * u);
const smoother = u => u * u * u * (u * (u * 6 - 15) + 10);
function ease(kind, u) {
  u = Math.min(1, Math.max(0, u));
  if (kind === 'linear') return u;
  if (kind === 'in') return u * u;
  if (kind === 'out') return 1 - (1 - u) * (1 - u);
  if (kind === 'smoother') return smoother(u);
  if (kind === 'gentle') return 0.5 * u + 0.5 * smooth(u);   // moves from the first frame, settles softly
  return smooth(u);
}
// Centripetal Catmull-Rom through points (arrays), sampled by arc length.
function catmull(P) {
  if (P.length === 1) return () => P[0].slice();
  const pts = [P[0].map((v, i) => 2 * v - P[1][i]), ...P, P[P.length - 1].map((v, i) => 2 * v - P[P.length - 2][i])];
  const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  const segs = [];
  for (let i = 1; i < pts.length - 2; i++) segs.push([pts[i - 1], pts[i], pts[i + 1], pts[i + 2]]);
  function seg([p0, p1, p2, p3], u) {
    const a = 0.5, t0 = 0, t1 = t0 + Math.max(1e-3, dist(p0, p1) ** a), t2 = t1 + Math.max(1e-3, dist(p1, p2) ** a), t3 = t2 + Math.max(1e-3, dist(p2, p3) ** a);
    const t = lerp(t1, t2, u);
    const A1 = p0.map((v, i) => (t1 - t) / (t1 - t0) * v + (t - t0) / (t1 - t0) * p1[i]);
    const A2 = p1.map((v, i) => (t2 - t) / (t2 - t1) * v + (t - t1) / (t2 - t1) * p2[i]);
    const A3 = p2.map((v, i) => (t3 - t) / (t3 - t2) * v + (t - t2) / (t3 - t2) * p3[i]);
    const B1 = A1.map((v, i) => (t2 - t) / (t2 - t0) * v + (t - t0) / (t2 - t0) * A2[i]);
    const B2 = A2.map((v, i) => (t3 - t) / (t3 - t1) * v + (t - t1) / (t3 - t1) * A3[i]);
    return B1.map((v, i) => (t2 - t) / (t2 - t1) * v + (t - t1) / (t2 - t1) * B2[i]);
  }
  // arc-length table
  const N = 200, table = [[0, 0, 0]];
  let L = 0, prev = seg(segs[0], 0);
  for (let s = 0; s < segs.length; s++) for (let k = 1; k <= N; k++) {
    const p = seg(segs[s], k / N); L += dist(p, prev); prev = p; table.push([L, s, k / N]);
  }
  return u => {
    const target = u * L;
    let lo = 0, hi = table.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (table[m][0] < target) lo = m; else hi = m; }
    const [l0, s0, u0] = table[lo], [l1, s1, u1] = table[hi];
    const f = l1 > l0 ? (target - l0) / (l1 - l0) : 0;
    if (s0 !== s1) return seg(segs[s1], u1 * f);
    return seg(segs[s0], lerp(u0, u1, f));
  };
}
function unwrapDeg(list) {
  const out = [list[0]];
  for (let i = 1; i < list.length; i++) {
    let d = list[i] - out[i - 1];
    d = ((d + 540) % 360) - 180;
    out.push(out[i - 1] + d);
  }
  return out;
}
function lookAngles(from, to) {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  return [Math.atan2(dy, dx) * 180 / Math.PI, -Math.atan2(dz, Math.hypot(dx, dy)) * 180 / Math.PI];
}
// A shot: {name, seconds, ease, keys:[{at:[x,y,z], look:[x,y,z]} | {at, yaw, pitch}], guardian?}
function shotPoses(shot) {
  const n = Math.max(2, Math.round(shot.seconds * 35) + 1);   // per tic; one extra so a 30 fps capture can reach the end
  if (shot.player) {
    // relative to the player's eye: [back, 0, raise, dyaw, dpitch]; an optional push-in ends on the exact start view
    const push = shot.player.push || 0, pn = Math.max(1, Math.round((shot.player.pushSeconds || 0) * 35));
    const poses = [];
    for (let f = 0; f < n; f++) {
      const u = 1 - ease(shot.ease || 'out', Math.min(1, f / pn));
      poses.push([push * u, 0, (shot.player.raise || 0) * u, 0, 0]);
    }
    return {n, poses, g: null};
  }
  const at = catmull(shot.keys.map(k => k.at));
  // guardian path (optional): keys [{at:[x,y]}], hover (z above floor), face: 'move' | 'camera' | deg | [x,y],
  // mode (1 walk, 3 stand, 4 aim, 2/5/6 HAL cyan/red/amber), states [{at: seconds, mode}], seconds (path duration)
  let g = null, gxy = null;
  if (shot.guardian) {
    const gs = shot.guardian;
    const gp = catmull(gs.keys.map(k => k.at));
    const gn = gs.seconds ? Math.round(gs.seconds * 35) : n - 1;   // the guardian may finish its path early and hold
    g = []; gxy = [];
    for (let f = 0; f < n; f++) {
      const u = ease(gs.ease || 'linear', Math.min(1, f / gn));
      const p = gp(u);
      gxy.push(p);
      g.push([1, p[0], p[1], gs.hover ?? 0, 0, 0, u]);
    }
    for (let f = 0; f < n; f++) {
      const p = gxy[f], u = g[f][6];
      let ang = typeof gs.face === 'number' ? gs.face : 0;
      if (gs.face === undefined || gs.face === 'move') {
        const uu = Math.min(0.99, u), q = gp(Math.min(1, uu + 0.01)), r = gp(Math.max(0, uu - 0.01));
        ang = Math.atan2(q[1] - r[1], q[0] - r[0]) * 180 / Math.PI;
      }
      if (Array.isArray(gs.face)) ang = Math.atan2(gs.face[1] - p[1], gs.face[0] - p[0]) * 180 / Math.PI;
      let mode = gs.mode ?? 1, faceCam = gs.face === 'camera';
      for (const st of gs.states || []) if (f / 35 >= st.at) { mode = st.mode; if (st.face) faceCam = st.face === 'camera'; }
      if (faceCam) {
        const c = at(ease(shot.ease || 'smooth', f / (n - 1)));
        ang = Math.atan2(c[1] - p[1], c[0] - p[0]) * 180 / Math.PI;
      }
      g[f] = [1, p[0], p[1], gs.hover ?? 0, ang, mode];
    }
  }
  // look targets are splined too (so the aim glides), then converted to angles per frame;
  // lookAtGuardian: z  aims at the guardian instead (lookMix blends key looks into it)
  const hasLook = shot.keys.every(k => k.look);
  const look = hasLook ? catmull(shot.keys.map(k => k.look)) : null;
  const yawK = hasLook ? null : unwrapDeg(shot.keys.map(k => k.yaw));
  const yawS = yawK ? catmull(yawK.map((y, i) => [y, shot.keys[i].pitch ?? 0])) : null;
  const poses = [];
  for (let f = 0; f < n; f++) {
    const u = ease(shot.ease || 'smooth', f / (n - 1));
    const p = at(u);
    let yaw, pitch;
    if (shot.lookAtGuardian !== undefined && gxy) {
      let tgt = [gxy[f][0], gxy[f][1], shot.lookAtGuardian];
      if (look && shot.lookMix !== undefined) { const l = look(u); tgt = tgt.map((v, i) => lerp(v, l[i], shot.lookMix)); }
      [yaw, pitch] = lookAngles(p, tgt);
      pitch += shot.guardianPitch || 0;     // frame the guardian above centre (vertical cut: captions own the bottom)
    } else if (look) [yaw, pitch] = lookAngles(p, look(ease(shot.lookEase || shot.ease || 'smooth', f / (n - 1))));
    else [yaw, pitch] = yawS(u);
    poses.push([p[0], p[1], p[2], yaw, pitch]);
  }
  // keep yaw continuous so the engine never interpolates the long way round
  const uw = unwrapDeg(poses.map(q => q[3]));
  poses.forEach((q, i) => { q[3] = uw[i]; });
  return {n, poses, g};
}

// ---------------------------------------------------------------- capture.pk3
const ZSCRIPT = `version "4.10"
// Injected by scripts/capture-level-flythrough.mjs; never shipped with the game.
class PDCapCamera : Actor
{
	Default { +NOINTERACTION +NOGRAVITY +NOBLOCKMAP +DONTSPLASH +NOTELEPORT RenderStyle "None"; Radius 1; Height 2; CameraHeight 0; }
	States { Spawn: TNT1 A -1; Stop; }
}
class PDCapHandler : EventHandler
{
	Array<double> P;      // per frame: x y z yaw pitch
	Array<double> G;      // per frame: on x y hover angle mode
	Array<int> FrameShot, ShotWait, ShotWaitArg, ShotFirst;
	Array<double> ShotFov;
	Array<int> ShotFace;          // per shot: bit mask of prisoner sites that hold still and face the camera
	Array<int> ShotMode;          // per shot: 0 = world path, 1 = relative to the player's own eye (the level's start view)
	Vector3 HoldAt[8];
	int NF, NS, Frame, Waited, TeaPhase;
	bool TeaEdge;
	bool Loaded, Active, Done, Hidden;
	PDCapCamera Cam;

	void LoadPath()
	{
		Loaded = true;
		int lump = Wads.CheckNumForFullName("cappath.txt");
		if (lump < 0) { Console.Printf("PDCAP ERR no path lump"); return; }
		Array<String> lines; Wads.ReadLump(lump).Split(lines, "\\n", TOK_SKIPEMPTY);
		for (int i = 0; i < lines.Size(); i++)
		{
			Array<String> f; lines[i].Split(f, " ", TOK_SKIPEMPTY);
			if (f.Size() < 2) continue;
			if (f[0] == "S") { ShotWait.Push(f[1].ToInt()); ShotWaitArg.Push(f[2].ToInt()); ShotFov.Push(f[3].ToDouble()); ShotFirst.Push(FrameShot.Size()); ShotFace.Push(f.Size() > 4 ? f[4].ToInt() : 0); ShotMode.Push(f.Size() > 5 ? f[5].ToInt() : 0); }
			else if (f[0] == "F")
			{
				FrameShot.Push(ShotWait.Size() - 1);
				for (int k = 1; k <= 5; k++) P.Push(f[k].ToDouble());
				for (int k = 6; k <= 11; k++) G.Push(k < f.Size() ? f[k].ToDouble() : 0);
			}
		}
		NF = FrameShot.Size(); NS = ShotWait.Size();
		Console.Printf("PDCAP LOADED %d %d", NF, NS);
	}

	bool WaitOver(int shot)
	{
		int kind = ShotWait[shot], arg = ShotWaitArg[shot];
		if (kind == 0) return true;
		let game = PDCheckpoint.Get();
		if (kind == 1) return TeaEdge && TeaPhase == arg;                                                // TEABOT service phase just began
		if (kind == 2) return Waited >= arg;                                                              // plain delay in tics
		return true;
	}

	override void NetworkProcess(ConsoleEvent e)
	{
		if (e.Name == "pdcap_go" && !Active)
		{
			if (!Loaded) LoadPath();
			if (NF == 0) return;
			Active = true; Frame = -1; Waited = 0;
			let pawn = players[0].mo;
			Cam = PDCapCamera(Actor.Spawn('PDCapCamera', pawn.Pos));
			players[0].cheats |= CF_GODMODE | CF_NOTARGET;
			pawn.bInvisible = true;
			Console.Printf("PDCAP GO");
			Console.Printf("PDCAP PLAYER %.3f %.3f %.3f %.3f %.3f %.3f %.1f", pawn.Pos.X, pawn.Pos.Y, pawn.Pos.Z, players[0].viewz, pawn.Angle, pawn.Pitch, players[0].FOV);
		}
	}

	int Settle;
	override void WorldTick()
	{
		if (!Active || Done || !Cam) return;
		let game = PDCheckpoint.Get();
		if (game && game.Hal && game.Hal.Service) { TeaEdge = game.Hal.Service.Phase != TeaPhase; TeaPhase = game.Hal.Service.Phase; }
		// A cut: the first pose of a shot is held for two extra tics, so the engine's view
		// interpolation (which blends from the last *rendered* tic) never renders a frame
		// halfway between two shots, even when a 30 fps step runs two tics at once.
		if (Settle > 0)
		{
			Settle--; Apply(game, Frame, false);
			if (Settle == 0) Console.Printf("PDCAP F %d %d %d", FrameShot[Frame], Frame - ShotFirst[FrameShot[Frame]], level.time);
			else Console.Printf("PDCAP S %d %d", FrameShot[Frame], level.time);
			return;
		}
		int next = Frame + 1;
		if (next >= NF) { Done = true; Console.Printf("PDCAP DONE %d", level.time); return; }
		int shot = FrameShot[next];
		if (ShotFirst[shot] == next && !WaitOver(shot)) { Waited++; Console.Printf("PDCAP W %d %d", shot, level.time); HoldGuardian(game, next); return; }
		Frame = next; Waited = 0;
		bool first = ShotFirst[shot] == Frame;
		Apply(game, Frame, first);
		if (first) { Settle = 2; Console.Printf("PDCAP S %d %d", shot, level.time); return; }
		Console.Printf("PDCAP F %d %d %d", shot, Frame - ShotFirst[shot], level.time);
	}

	void Apply(PDCheckpoint game, int frame, bool first)
	{
		int b = frame * 5;
		Vector3 at = (P[b], P[b + 1], P[b + 2]);
		double yaw = P[b + 3], pitch = P[b + 4];
		if (ShotMode[FrameShot[frame]] == 1)
		{
			// the exact view the player gets on spawning: its eye (viewz), facing and pitch,
			// optionally pulled back along the facing by P[b] units and raised by P[b + 2]
			let pawn = players[0].mo;
			double a = pawn.Angle;
			at = (pawn.Pos.X - cos(a) * P[b], pawn.Pos.Y - sin(a) * P[b], players[0].viewz + P[b + 2]);
			yaw = a + P[b + 3]; pitch = pawn.Pitch + P[b + 4];
		}
		Cam.SetOrigin(at, !first);
		Cam.A_SetAngle(yaw, first ? 0 : SPF_INTERPOLATE);
		Cam.A_SetPitch(pitch, first ? 0 : SPF_INTERPOLATE);
		Cam.CameraFOV = ShotFov[FrameShot[frame]];
		if (first) Cam.ClearInterpolation();
		players[0].camera = Cam;
		DriveGuardian(game, frame, first);
		int face = ShotFace[FrameShot[frame]];
		if (face && game && game.Cast)
		{
			for (int i = 0; i < game.Cast.People.Size() && i < 8; i++)
			{
				if (!(face & (1 << i))) continue;
				let body = game.Cast.People[i].Body;
				if (!body) continue;
				if (first) HoldAt[i] = body.Pos;
				body.SetOrigin(HoldAt[i], true);
				body.Vel = (0, 0, 0);
				body.A_SetAngle(atan2(Cam.Pos.Y - body.Pos.Y, Cam.Pos.X - body.Pos.X), first ? 0 : SPF_INTERPOLATE);
			}
		}
	}

	void HoldGuardian(PDCheckpoint game, int frame) { if (game && game.Hunter && G[frame * 6] > 0) game.Hunter.StunUntil = level.time + 10; }

	int LastMode;
	// modes: 1 walk, 3 stand, 4 aim (red visor), 2 HAL float (cyan eye), 5 HAL float red eye, 6 HAL float amber eye
	void DriveGuardian(PDCheckpoint game, int frame, bool first)
	{
		if (!game || !game.Hunter) return;
		int b = frame * 6;
		if (G[b] <= 0) return;
		let h = game.Hunter;
		int mode = int(G[b + 5]);
		h.StunUntil = level.time + 10;
		h.LockedAim = mode == 5; h.AimTics = (mode == 5 || mode == 6) ? 1 : 0;
		Vector2 xy = (G[b + 1], G[b + 2]);
		Sector s = level.PointInSector(xy);
		double z = s.floorplane.ZatPoint(xy) + G[b + 3];
		if (mode == 2 || mode == 5 || mode == 6) z += sin(level.time * 4) * 2;    // HAL's float bob
		h.SetOrigin((xy, z), !first);
		h.A_SetAngle(G[b + 4], first ? 0 : SPF_INTERPOLATE);
		if (first) h.ClearInterpolation();
		if (first || mode != LastMode)
		{
			if (mode == 1) h.SetStateLabel('Walk');
			if (mode == 3) h.SetStateLabel('Spawn');
			if (mode == 4) h.SetStateLabel('Aim');
		}
		LastMode = mode;
	}
}
`;
const MAPINFO = 'gameinfo\n{\n    AddEventHandlers = "PDCapHandler"\n}\n';

function crc32(buf) { return zlib.crc32(buf) >>> 0; }
function zipStore(files) {
  const parts = [], central = [];
  let off = 0;
  for (const [name, content] of files) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const nm = Buffer.from(name, 'utf8'), crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nm.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, nm, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0, 8); c.writeUInt16LE(0, 10);
    c.writeUInt32LE(0, 12); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(0, 30); c.writeUInt32LE(0, 34); c.writeUInt32LE(0, 38); c.writeUInt32LE(off, 42);
    central.push(c, nm);
    off += 30 + nm.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}

// shots for this run
const WAITS = {none: 0, tea: 1, delay: 2};
const baseShots = fmt.shotsFrom ? cap.formats[fmt.shotsFrom].shots : fmt.shots;
let shots = baseShots.map(s => ({...s, ...((fmt.overrides || {})[s.name] || {}), fov: ((fmt.overrides || {})[s.name] || {}).fov ?? (fmt.shotsFrom ? fmt.fov : s.fov)}));
const park = fmt.guardianPark || cap.guardianPark;
if (park) shots = shots.map(s => s.guardian ? s : {...s, guardian: {keys: [{at: park.at}, {at: park.at}], hover: park.hover ?? 0, face: park.face ?? 0, mode: park.mode ?? 3}});
if (ONLY) shots = shots.filter(s => ONLY.split(',').includes(s.name));
if (SCOUT) {
  // one 2-tic hold per keyframe so the whole route can be checked at a glance
  shots = shots.flatMap(s => s.keys.map((k, i) => ({...s, name: `${s.name}-k${i}`, seconds: 2 / 35, keys: [k, k], wait: undefined, guardian: s.guardian ? {...s.guardian, keys: [s.guardian.keys[Math.min(i, s.guardian.keys.length - 1)], s.guardian.keys[Math.min(i, s.guardian.keys.length - 1)]]} : undefined})));
}
if (STILLS) {
  const list = JSON.parse(await fs.readFile(STILLS, 'utf8'));
  shots = list.map(st => ({name: st.name, seconds: 2 / 35, fov: st.fov, keys: [st, st], guardian: st.guardian}));
}
const plan = shots.map(s => ({shot: s, ...shotPoses(s)}));
let lump = '';
for (const {shot, n, poses, g} of plan) {
  const w = shot.wait || {};
  lump += `S ${WAITS[w.kind || 'none']} ${w.arg ?? 0} ${shot.fov ?? fmt.fov ?? 90} ${(shot.face || []).reduce((m, i) => m | (1 << i), 0)} ${shot.player ? 1 : 0}\n`;
  for (let f = 0; f < n; f++) {
    const gg = g ? g[f] : [0, 0, 0, 0, 0, 0];
    lump += 'F ' + poses[f].map(v => v.toFixed(3)).join(' ') + ' ' + gg.map(v => (+v).toFixed(3)).join(' ') + '\n';
  }
}
const PK3 = zipStore([['MAPINFO', MAPINFO], ['ZSCRIPT', ZSCRIPT], ['cappath.txt', lump]]);

// ---------------------------------------------------------------- static server
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.mp4': 'video/mp4', '.png': 'image/png', '.wav': 'audio/wav', '.ogg': 'audio/ogg'};
async function serve() {
  const server = http.createServer(async (req, res) => {
    try {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/dev-config.json') { res.writeHead(200, {'Content-Type': 'application/json'}); res.end('{"enabled":false}'); return; }
      const file = path.resolve(WEB, '.' + (p === '/' ? '/index.html' : p));
      if (!file.startsWith(WEB)) { res.writeHead(403); res.end(); return; }
      const st = await fs.stat(file); if (!st.isFile()) throw Error('dir');
      res.writeHead(200, {'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-store'});
      createReadStream(file).pipe(res);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return {server, url: `http://127.0.0.1:${server.address().port}/`};
}

// ---------------------------------------------------------------- injected browser code
const WORKER_PREFIX = `
// [pdcap] virtual clock: real time until frozen, then advanced one tic at a time.
(() => {
  const realNow = performance.now.bind(performance);
  const clock = {frozen: false, base: 0, off: 0};
  clock.now = () => clock.frozen ? clock.base + clock.off : realNow();
  self.__pdcapClock = clock;
  performance.now = clock.now;
})();
`;
const WORKER_SUFFIX = `
// [pdcap] control messages; everything else goes to the original handler.
(() => {
  const orig = self.onmessage;
  self.onmessage = (e) => {
    const m = e.data, clock = self.__pdcapClock;
    if (m && m.type === 'pdcap-freeze') { if (!clock.frozen) { clock.base = clock.now(); clock.off = 0; clock.frozen = true; } self.postMessage({type: 'pdcap-ack', frames: fg.total, id: m.id}); return; }
    if (m && m.type === 'pdcap-readfile') {
      let data = null, size = 0;
      try { const all = self.Module.FS.readFile(m.path); size = all.length; data = all.slice(m.offset || 0, (m.offset || 0) + (m.length || all.length)); } catch (e) {}
      self.postMessage({type: 'pdcap-ack', id: m.id, data, size}, data ? [data.buffer] : []); return;
    }
    if (m && m.type === 'pdcap-thaw') { clock.frozen = false; self.postMessage({type: 'pdcap-ack', frames: fg.total, id: m.id}); return; }
    if (m && m.type === 'pdcap-step') {
      const start = fg.total, t0 = Date.now();
      clock.off += m.ms;
      const poll = () => {
        if (fg.total >= start + (m.minFrames || 1) || Date.now() - t0 > (m.timeout || 4000)) { setTimeout(() => self.postMessage({type: 'pdcap-ack', frames: fg.total, rendered: fg.total - start, id: m.id}), m.settle || 0); return; }
        setTimeout(poll, 1);
      };
      poll();
      return;
    }
    return orig(e);
  };
})();
`;
const INIT = ({W, H, pk3Url}) => {
  const MUSIC_MODE = !!window.MUSIC_MODE;
  try { localStorage.setItem('pdoom.opening-seen.v1', '1'); } catch {}
  window.__PDCAP__ = {pdcap: [], acks: new Map(), lastF: null, done: false, logs: []};
  const pk3 = fetch(pk3Url).then(r => r.arrayBuffer());
  const Orig = window.Worker;
  window.Worker = class extends Orig {
    constructor(...a) {
      super(...a);
      window.__QA_WORKER__ = this;
      const C = window.__PDCAP__;
      this.addEventListener('message', e => {
        const m = e.data;
        if (m && m.type === 'pdcap-ack') { const r = C.acks.get(m.id); if (r) { C.acks.delete(m.id); r(m); } return; }
        if (m && m.type === 'log' && typeof m.msg === 'string') {
          const i = m.msg.indexOf('PDCAP ');
          if (i >= 0) { const line = m.msg.slice(i).trim(); if (line.startsWith('PDCAP PLAYER')) C.player = line; C.pdcap.push(line); if (C.pdcap.length > 50) C.pdcap.shift(); if (line.startsWith('PDCAP F ')) C.lastF = line; if (line.startsWith('PDCAP DONE')) C.done = true; }
          if (/error|Script|abort/i.test(m.msg)) { C.logs.push(m.msg); if (C.logs.length > 80) C.logs.shift(); }
        }
      });
      const post = this.postMessage.bind(this);
      this.postMessage = (msg, transfer) => {
        if (msg && msg.type === 'boot') {
          pk3.then(buf => {
            msg.pinW = W; msg.pinH = H;
            msg.files['/capture.pk3'] = new Uint8Array(buf);
            const args = msg.args.slice();
            const fi = args.indexOf('pdoom.pk3');
            args.splice(fi + 1, 0, 'capture.pk3');
            for (let i = 0; i < args.length; i++) {
              if (args[i] === '+vid_defwidth' || args[i] === '+win_w') args[i + 1] = String(W);
              if (args[i] === '+vid_defheight' || args[i] === '+win_h') args[i + 1] = String(H);
            }
            if (MUSIC_MODE) args.push('+set', 'opl_core', '1');
            args.push('+set', 'crosshair', '0', '+set', 'con_notifylines', '0', '+set', 'vid_maxfps', '0', '+set', 'r_drawplayersprites', '0', '+set', 'con_centernotify', '0');
            msg.args = args;
            post(msg, [...(transfer || []), msg.files['/capture.pk3'].buffer]);
          });
          return;
        }
        // keep the engine running while the (hidden) HTML panels open and close
        if (msg && msg.type === 'visibility') return post({type: 'visibility', state: 'visible'});
        if (C.frozen && msg && msg.type === 'input' && /^F1[01]$/.test(msg.init?.code || '')) return;
        return post(msg, transfer);
      };
    }
  };
  window.__pdcapCall = (msg) => new Promise(res => { const id = Math.random().toString(36).slice(2); window.__PDCAP__.acks.set(id, res); window.__QA_WORKER__.postMessage({...msg, id}); });
  window.__pdcapKey = (code, key, keyCode) => { for (const evType of ['keydown', 'keyup']) window.__QA_WORKER__.postMessage({type: 'input', target: 'window', evType, init: {code, key, keyCode, which: keyCode, charCode: 0, bubbles: true, cancelable: true}}); };
};
const CLEAN_CSS = (W, H) => `
html, body { margin:0 !important; padding:0 !important; background:#000 !important; overflow:hidden !important; }
body > *:not(#stage), mann-cool-game-shell { display:none !important; }
#stage { position:fixed !important; inset:0 !important; width:${W}px !important; height:${H}px !important; padding:0 !important; margin:0 !important; background:#000 !important; transform:none !important; }
#stage > *:not(#canvas) { display:none !important; visibility:hidden !important; }
#canvas { position:fixed !important; left:0 !important; top:0 !important; width:${W}px !important; height:${H}px !important; max-width:none !important; max-height:none !important;
  transform:none !important; filter:none !important; image-rendering:pixelated !important; border:0 !important; outline:none !important; box-shadow:none !important; clip-path:none !important; opacity:1 !important; visibility:visible !important; display:block !important; }
body::before, body::after, #stage::before, #stage::after { display:none !important; content:none !important; }
`;

// ---------------------------------------------------------------- run
const {server, url} = BASE_URL ? {server: null, url: BASE_URL} : await serve();
console.log(`[pdcap] ${MAP} ${FORMAT} ${W}x${H}, ${plan.length} shots, ${plan.reduce((a, p) => a + p.n, 0)} frames; game at ${url}`);
await fs.mkdir(OUT, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: !HEADED, args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']});
const page = await browser.newPage({viewport: {width: W, height: H}, deviceScaleFactor: 1});
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
const pk3Url = '/__pdcap/capture.pk3';
await page.route(u => !/^http:\/\/(127\.0\.0\.1|localhost)/.test(u.href), r => r.abort());   // no third-party shell / network
await page.route('**/__pdcap/capture.pk3', r => r.fulfill({status: 200, contentType: 'application/octet-stream', body: PK3}));
await page.route('**/engine/engine.worker.js', async r => {
  const resp = await r.fetch();
  const body = WORKER_PREFIX + await resp.text() + WORKER_SUFFIX;
  await r.fulfill({response: resp, body, headers: {...resp.headers(), 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store'}});
});
await page.route('**/controls.cfg', async r => {
  const resp = await r.fetch();
  await r.fulfill({response: resp, body: (await resp.text()) + '\nbind o "netevent pdcap_go"\n' + (MUSIC ? `bind m "writewave ${MUSIC} /pdcap-music.wav 0 44100 OPL 1"\n` : ''), headers: {...resp.headers(), 'cache-control': 'no-store'}});
});
if (MUSIC) await page.addInitScript(() => { window.MUSIC_MODE = true; });
await page.addInitScript(INIT, {W, H, pk3Url});
const read = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));
const report = {map: MAP, format: FORMAT, width: W, height: H, fps: FPS, shots: [], errors};
try {
  await page.goto(`${url}?level=${level.levelId}&ceo=${cap.ceo || 'altman'}`);
  await startGame(page, {console: false});
  const t0 = Date.now();
  while (true) {
    const s = await read();
    if (s.mode === 'error') throw Error('Engine error: ' + s.error);
    if (s.mode === 'playing' && s.world?.ticks > 35) break;
    if (Date.now() - t0 > 90000) throw Error('Boot timeout: ' + JSON.stringify({mode: s.mode, logs: await page.evaluate(() => window.__PDCAP__.logs)}));
    await page.waitForTimeout(250);
  }
  const pdlog = await page.evaluate(() => window.__DOOM_DEBUG__.logs.filter(l => /PDCAP|capture\.pk3|Script error|ZSCRIPT/i.test(l)).slice(-10));
  console.log('[pdcap] engine up', pdlog);
  if (MUSIC) {
    const dir = path.join(WEB, 'local', 'intro', 'levels', 'music');
    await fs.mkdir(dir, {recursive: true});
    await page.evaluate(() => window.__pdcapKey('KeyM', 'm', 77));
    let size = 0, last = -1;
    for (let i = 0; i < 90; i++) {   // writewave renders the whole song; wait until the file stops growing
      await page.waitForTimeout(1000);
      size = await page.evaluate(async () => (await window.__pdcapCall({type: 'pdcap-readfile', path: '/pdcap-music.wav', offset: 0, length: 1})).size);
      if (size > 44 && size === last) break;
      last = size;
    }
    if (!(size > 44)) throw Error('writewave produced no file');
    const parts = [];
    for (let off = 0; off < size; off += 1 << 21) {
      const b64 = await page.evaluate(async ({off}) => {
        const r = await window.__pdcapCall({type: 'pdcap-readfile', path: '/pdcap-music.wav', offset: off, length: 1 << 21});
        let s = ''; const u = r.data; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
        return btoa(s);
      }, {off});
      parts.push(Buffer.from(b64, 'base64'));
    }
    const data = Buffer.concat(parts);
    const wav = path.join(dir, MUSIC.toLowerCase() + '.wav');
    await fs.writeFile(wav, data);
    const {execFileSync} = await import('node:child_process');
    const ogg = path.join(dir, MUSIC.toLowerCase() + '.ogg');
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', '6', ogg]);
    await fs.rm(wav);
    await fs.writeFile(path.join(dir, MUSIC.toLowerCase() + '.json'), JSON.stringify({source: 'DOOM.WAD: ' + MUSIC, renderer: 'GZDoom writewave, OPL core 1, 44.1 kHz', file: path.basename(ogg)}, null, 1) + '\n');
    report.music = ogg; report.passed = true;
    throw {done: true};
  }
  await page.waitForTimeout((cap.settleSeconds ?? 2) * 1000);
  await page.addStyleTag({content: CLEAN_CSS(W, H)});
  await page.evaluate(() => { window.__PDCAP__.frozen = true; });
  await page.evaluate(() => window.__pdcapCall({type: 'pdcap-freeze'}));
  await page.evaluate(() => window.__pdcapKey('KeyO', 'o', 79));
  // pre-roll: let the camera handler start (and any wait conditions resolve)
  let frames = 0, lastLabel = null, waits = 0, stepMs = 0, shotMs = 0;
  const shotDirs = new Set();
  for (let guard = 0; guard < 200000; guard++) {
    const t1 = Date.now();
    // Sub-steps of under one tic each, each followed by a render: the engine's view interpolation
    // blends from the last *rendered* tic, so every tic must be rendered once or a 30 fps capture
    // lags by a tic now and then.  At 35 fps this is exactly one step per tic.
    const nSub = Math.ceil((1000 / FPS) / (TIC * 0.95));
    for (let k = 0; k < nSub; k++)
      await page.evaluate(ms => window.__pdcapCall({type: 'pdcap-step', ms, minFrames: 2, settle: 0}), 1000 / FPS / nSub);
    stepMs += Date.now() - t1;
    const st = await page.evaluate(() => ({f: window.__PDCAP__.lastF, done: window.__PDCAP__.done, last: window.__PDCAP__.pdcap.at(-1)}));
    if (st.done) break;
    if (!st.f || st.f === lastLabel) { if (st.last?.startsWith('PDCAP W')) waits++; continue; }
    lastLabel = st.f;
    const [, , shotIdx, frame] = st.f.split(' ');
    const shot = plan[+shotIdx].shot;
    const dir = path.join(OUT, shot.name);
    if (!shotDirs.has(dir)) { await fs.rm(dir, {recursive: true, force: true}); await fs.mkdir(dir, {recursive: true}); shotDirs.add(dir); report.shots.push({name: shot.name, frames: 0, tics: []}); }
    const seq = report.shots.at(-1).frames;
    report.shots.at(-1).tics.push(+frame);
    // let the compositor pick up the committed OffscreenCanvas frame
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const t2 = Date.now();
    await page.screenshot({path: path.join(dir, String(seq).padStart(5, '0') + '.png'), clip: {x: 0, y: 0, width: W, height: H}, animations: 'allow', caret: 'initial'});
    shotMs += Date.now() - t2;
    report.shots.at(-1).frames++;
    frames++;
    if (frames % 70 === 0) console.log(`[pdcap] ${frames} frames (${shot.name} ${frame}); step ${(stepMs / frames).toFixed(0)} ms, shot ${(shotMs / frames).toFixed(0)} ms, waits ${waits}`);
  }
  report.frames = frames;
  const r2 = a => a.map(v => Math.round(v * 100) / 100);
  const pl = await page.evaluate(() => window.__PDCAP__.player);
  if (pl) { const v = pl.split(' ').slice(2).map(Number); report.player = {x: v[0], y: v[1], z: v[2], viewz: v[3], angle: v[4], pitch: v[5], fov: v[6]}; }
  report.plan = plan.map(p => ({name: p.shot.name, tics: p.n, seconds: p.shot.seconds, fov: p.shot.fov ?? fmt.fov ?? 90,
    poses: p.poses.map(r2), guardian: p.g ? p.g.map(r2) : null}));
  report.passed = true;
} catch (e) {
  if (e && e.done) { /* music mode finished */ } else {
  report.failure = String(e && e.stack || e);
  report.logs = await page.evaluate(() => ({pd: window.__PDCAP__?.pdcap, logs: window.__PDCAP__?.logs, debug: window.__DOOM_DEBUG__?.logs.slice(-40)})).catch(() => null);
  await page.screenshot({path: path.join(OUT, 'failure.png')}).catch(() => {});
  }
} finally {
  if (ONLY && report.passed) {   // re-captured some shots: merge into the existing record
    try {
      const prev = JSON.parse(await fs.readFile(path.join(OUT, 'capture.json'), 'utf8'));
      const order = baseShots.map(s => s.name);
      const merge = (a, b) => order.map(n => b.find(x => x.name === n) || a.find(x => x.name === n)).filter(Boolean);
      report.shots = merge(prev.shots || [], report.shots);
      report.plan = merge(prev.plan || [], report.plan || []);
      report.frames = report.shots.reduce((n, x) => n + x.frames, 0);
    } catch {}
  }
  await fs.writeFile(path.join(OUT, 'capture.json'), JSON.stringify(report, null, 1));
  await Promise.race([browser.close(), new Promise(r => setTimeout(r, 3000))]);
  server?.close();
}
console.log(JSON.stringify({passed: report.passed, frames: report.frames, shots: report.shots, failure: report.failure, errors}, null, 1));
if (!report.passed) console.log(JSON.stringify(report.logs, null, 1));
process.exit(report.passed ? 0 : 1);
