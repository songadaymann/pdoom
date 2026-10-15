#!/usr/bin/env node
// Capture real gameplay clips for the promo trailers: the actual player with the status bar,
// held tools and weapons, enemies and companions running their own AI, recorded frame by frame
// from the real GZDoom WebAssembly engine. Shots live in scripts/gameplay-shots/*.mjs (each file
// exports an array of shots; see the header of scripts/gameplay-shots/prologue.mjs for the format).
//
//   node scripts/capture-gameplay.mjs                          # every shot
//   node scripts/capture-gameplay.mjs --shot finale-rockets    # some shots (comma-separated)
//   node scripts/capture-gameplay.mjs --shot x --scout         # setup only: one still per shot, no recording
//   node scripts/capture-gameplay.mjs --shot x --ceo amodei    # one CEO (default: both altman and amodei)
//   node scripts/capture-gameplay.mjs --list
//
// How it works (nothing in the game is modified; everything below is injected into this
// capture browser only, like scripts/capture-level-flythrough.mjs):
//  * The game is served read-only from doom-web/ by a throwaway local server (or --url) and booted
//    in headless Chrome, muted. A shot's setup() runs in real time with the private QA console
//    (warps, god/buddha, gauntlet clears, netevents), exactly like the browser smokes.
//  * Then the engine worker's clock (performance.now) is frozen and advanced 1/30 s per frame in
//    sub-tic steps, each followed by a render, so the game simulates and renders deterministically
//    however slowly headless Chrome screenshots. Every frame is a real engine render plus the real
//    HTML status bar, grabbed with a page screenshot. CSS animations on the page (the held wrench's
//    swing) are paused and set from the same virtual clock.
//  * A small extra resource file (playcap.pk3) adds PDPlayCap, a ZScript event handler that runs a
//    per-tic program: it steers the player's view (absolute keyframes, or tracking the hunter, the
//    nearest machine, a prisoner or a point) and fires timed events (open a cell, place the hunter,
//    ...). Movement, firing and use are real key presses sent to the engine on exact frames.
//
// Output: doom-web/local/promo/gameplay/raw/<ceo>/<shot>/00000.png ... (git-ignored: engine renders of WAD art)
//         plus capture.json per shot (size, fps, frames, the program).
import {chromium} from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {nativeQA} from './native-qa-helpers.mjs';
import {gauntletMeta, gauntletQA} from './gauntlet-qa.mjs';

// 16:10 like the game's own canvas; the engine renders at half size, shown at exactly 2x.
export const SIZE = {w: 1080, h: 676, engine: [540, 338]};
const SHOT_DIR = new URL('./gameplay-shots/', import.meta.url);
const SHOTS = [];
for (const f of (await fs.readdir(SHOT_DIR)).filter(f => f.endsWith('.mjs')).sort())
  for (const s of (await import(new URL(f, SHOT_DIR))).default) SHOTS.push({...s, file: f});

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WEB = path.join(ROOT, 'doom-web');
const OUT_ROOT = path.join(WEB, 'local', 'promo', 'gameplay', 'raw');
const FPS = 30, TIC = 1000 / 35;

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const flag = name => argv.includes('--' + name);
const ONLY = opt('shot', null);
const BASE_URL = opt('url', null);
const HEADED = flag('headed');
const SCOUT = flag('scout');
if (flag('list')) { for (const s of SHOTS) console.log(`${s.file.padEnd(16)} ${s.name.padEnd(24)} ${String(s.seconds).padStart(5)} s  ${s.about || ''}`); process.exit(0); }
// Files starting with _ hold tests: run only when named.
const picked = ONLY ? SHOTS.filter(s => ONLY.split(',').includes(s.name)) : SHOTS.filter(s => !s.file.startsWith('_'));
if (!picked.length) throw Error(`No shot named ${ONLY} (see --list)`);
// Every shot is recorded once per playable CEO (the status-bar face is the trailer's narrator),
// unless it pins one with ceos: [...].
const CEO = opt('ceo', 'both');
const shots = picked.flatMap(s => (s.ceos || ['altman', 'amodei']).filter(c => CEO === 'both' || c === CEO).map(ceo => ({...s, ceo})));

// ---------------------------------------------------------------- the per-tic program
// look: keyframes [{at, yaw?, pitch?, dyaw?, ease?} | {at, track: 'hunter'|'monster'|'person'|'point', rate?, dyaw?, dpitch?, i?, x?, y?, z?} | {at, free: true}]
//   yaw/pitch are absolute degrees; dyaw is relative to the view when recording starts. A key holds
//   until the next one; consecutive yaw keys glide (ease: smooth|linear|in|out).
// events: [{at, name, args: [..]}]  -> PDPlayCap.Run(name, args) on that tic.
const ease = (k, u) => { u = Math.min(1, Math.max(0, u)); return k === 'linear' ? u : k === 'in' ? u * u : k === 'out' ? 1 - (1 - u) * (1 - u) : u * u * (3 - 2 * u); };
const TRACK = {hunter: 2, monster: 3, person: 4, point: 5};
function program(shot) {
  const nt = Math.ceil(shot.seconds * 35) + 4;
  const keys = (shot.look || []).slice().sort((a, b) => a.at - b.at);
  let lump = '';
  for (let t = 0; t < nt; t++) {
    const sec = t / 35;
    let cur = null, ci = -1;
    keys.forEach((k, i) => { if (k.at <= sec + 1e-9) { cur = k; ci = i; } });
    if (!cur || cur.free) { lump += 'T 0 0 0 0 0\n'; continue; }
    if (cur.track) { lump += `T ${TRACK[cur.track]} ${cur.rate ?? 0.18} ${cur.dyaw ?? 0} ${cur.dpitch ?? 0} ${cur.i ?? cur.x ?? 0} ${cur.y ?? 0} ${cur.z ?? 0}\n`; continue; }
    const next = keys[ci + 1];
    const rel = cur.dyaw !== undefined;
    let yaw = rel ? cur.dyaw : cur.yaw, pitch = cur.pitch ?? 0;
    if (next && !next.track && !next.free && (next.yaw !== undefined || next.dyaw !== undefined)) {
      const u = ease(next.ease || 'smooth', (sec - cur.at) / (next.at - cur.at));
      const ny = next.dyaw !== undefined ? next.dyaw : next.yaw;
      yaw = yaw + (ny - yaw) * u;
      pitch = pitch + ((next.pitch ?? 0) - pitch) * u;
    }
    lump += `T ${rel ? 6 : 1} ${yaw.toFixed(3)} ${pitch.toFixed(3)} 0 0 0 0\n`;
  }
  for (const e of shot.events || []) lump += `E ${Math.round(e.at * 35)} ${e.name} ${(e.args || []).join(' ')}\n`;
  return lump;
}

const ZSCRIPT = `version "4.10"
// Injected by scripts/capture-gameplay.mjs; never shipped with the game.
class PDPlayCap : EventHandler
{
	Array<double> L;                  // per tic: mode a b c d e f
	Array<int> EvTic; Array<String> EvName; Array<double> EvArgs;
	int NT, T, Start;
	bool Loaded, Active, Done, Buddha;
	double Yaw0;
	static const Name SUMMON[] = { 'PDWarTrooper', 'PDWarAssault', 'PDWarSquid', 'PDWarEnforcer', 'PDWarGunship', 'PDWarAlly' };

	void Load()
	{
		Loaded = true;
		int lump = Wads.CheckNumForFullName("playcap.txt");
		if (lump < 0) { Console.Printf("PDPLAY ERR no program"); return; }
		Array<String> lines; Wads.ReadLump(lump).Split(lines, "\\n", TOK_SKIPEMPTY);
		for (int i = 0; i < lines.Size(); i++)
		{
			Array<String> f; lines[i].Split(f, " ", TOK_SKIPEMPTY);
			if (f.Size() < 2) continue;
			if (f[0] == "T") { for (int k = 1; k <= 7; k++) L.Push(k < f.Size() ? f[k].ToDouble() : 0); }
			else if (f[0] == "E")
			{
				EvTic.Push(f[1].ToInt()); EvName.Push(f[2]);
				for (int k = 3; k < 7; k++) EvArgs.Push(k < f.Size() ? f[k].ToDouble() : 0);
			}
		}
		NT = L.Size() / 7;
		Console.Printf("PDPLAY LOADED %d %d", NT, EvTic.Size());
	}

	static double Floor(Vector2 xy) { return level.PointInSector(xy).floorplane.ZatPoint(xy); }

	void Run(String name, double a, double b, double c, double d)
	{
		let game = PDCheckpoint.Get();
		let pawn = players[0].mo;
		if (name == "pose")
		{
			pawn.SetOrigin(((a, b), Floor((a, b))), false); pawn.Vel = (0, 0, 0);
			pawn.Angle = c; pawn.Pitch = d; pawn.ClearInterpolation();
		}
		else if (name == "look") { pawn.Angle = a; pawn.Pitch = b; pawn.ClearInterpolation(); }
		else if (name == "buddha") { Buddha = a != 0; }
		else if (name == "heal") { pawn.A_SetHealth(int(a)); }
		else if (game && game.Hunter && name == "hunter")       // x y angle mode(0 hunt, 1 hold, 2 aim at you now)
		{
			let h = game.Hunter;
			h.SetOrigin(((a, b), Floor((a, b))), false); h.Angle = c; h.ClearInterpolation();
			game.Awake = true;
			if (d == 1) { h.StunUntil = level.time + 100000; h.AimTics = 0; h.LockedAim = false; h.SetStateLabel('Spawn'); }
			else { h.StunUntil = 0; h.ReloadUntil = 0; }
			if (d == 2) { h.AimTics = int(c) == 0 ? 50 : 50; game.LastKnown = pawn.Pos.XY; }
		}
		else if (game && game.Hunter && name == "hunterwalk")   // release a held hunter
		{ game.Hunter.StunUntil = 0; game.Awake = true; game.LastKnown = pawn.Pos.XY; }
		else if (game && name == "free") { game.OpenCell(int(a), "capture"); }
		else if (game && name == "wrench") { game.HasWrench = true; game.Tool = 0; }
		else if (game && name == "gun") { game.HasGun = true; game.Ammo += int(a); game.Tool = a > 0 ? 1 : game.Tool; }
		else if (game && name == "wake") { game.Awake = true; game.WakeAt = level.time - 175; }
		else if (game && game.Hunter && name == "quiet") { game.Hunter.StunUntil = level.time + 100000; game.Hunter.AimTics = 0; game.Hunter.LockedAim = false; }
		else if (name == "summon")                              // class index, x, y, angle (see SUMMON)
		{
			let mo = Actor.Spawn(SUMMON[int(a)], ((b, c), Floor((b, c))));
			if (mo) mo.Angle = d;
		}
		else Console.Printf("PDPLAY ERR unknown event %s", name);
	}

	override void NetworkProcess(ConsoleEvent e)
	{
		if (e.Name == "pdplay_go" && !Active)
		{
			if (!Loaded) Load();
			Active = true; T = 0; Start = level.time; Yaw0 = players[0].mo.Angle;
			Console.Printf("PDPLAY GO %d", level.time);
			return;
		}
		if (e.Name.Left(7) == "pdplay_") Run(e.Name.Mid(7), e.Args[0], e.Args[1], e.Args[2], 0);   // netevents carry three ints
	}

	Actor Nearest(PlayerPawn pawn)
	{
		Actor best = null; double bd = 1e9;
		let it = ThinkerIterator.Create('Actor');
		Actor mo;
		while (mo = Actor(it.Next()))
		{
			if (!mo.bIsMonster || mo.bFriendly || mo.health <= 0 || mo is 'PDWarAlly') continue;
			double dist = pawn.Distance2D(mo);
			if (dist > 2400) continue;
			double off = abs(Actor.deltaangle(pawn.Angle, pawn.AngleTo(mo)));
			if (off > 55) continue;
			if (!pawn.CheckSight(mo)) continue;
			double score = dist * (1 + off / 30.0);
			if (score < bd) { bd = score; best = mo; }
		}
		return best;
	}

	void Aim(PlayerPawn pawn, Vector3 at, double rate, double dyaw, double dpitch)
	{
		Vector3 eye = (pawn.Pos.XY, players[0].viewz);
		Vector3 d = at - eye;
		double yaw = atan2(d.Y, d.X) + dyaw;
		double pitch = -atan2(d.Z, d.XY.Length()) + dpitch;
		pawn.A_SetAngle(pawn.Angle + Actor.deltaangle(pawn.Angle, yaw) * rate, SPF_INTERPOLATE);
		pawn.A_SetPitch(pawn.Pitch + (pitch - pawn.Pitch) * rate, SPF_INTERPOLATE);
	}

	override void WorldTick()
	{
		let pawn = players[0].mo;
		if (Buddha && pawn && pawn.health < 25) pawn.A_SetHealth(25);
		if (!Active || Done || !pawn) return;
		for (int i = 0; i < EvTic.Size(); i++)
			if (EvTic[i] == T) Run(EvName[i], EvArgs[i * 4], EvArgs[i * 4 + 1], EvArgs[i * 4 + 2], EvArgs[i * 4 + 3]);
		if (T >= NT) { Done = true; Console.Printf("PDPLAY DONE %d", level.time); return; }
		int b = T * 7;
		int mode = int(L[b]);
		let game = PDCheckpoint.Get();
		if (mode == 1 || mode == 6)
		{
			double yaw = mode == 6 ? Yaw0 + L[b + 1] : L[b + 1];
			pawn.A_SetAngle(yaw, SPF_INTERPOLATE);
			pawn.A_SetPitch(L[b + 2], SPF_INTERPOLATE);
		}
		else if (mode == 2 && game && game.Hunter) Aim(pawn, game.Hunter.Pos + (0, 0, game.Hunter.Height * 0.62), L[b + 1], L[b + 2], L[b + 3]);
		else if (mode == 3) { let m = Nearest(pawn); if (m) Aim(pawn, m.Pos + (0, 0, m.Height * 0.55), L[b + 1], L[b + 2], L[b + 3]); }
		else if (mode == 4 && game && game.Cast)
		{
			int i = int(L[b + 4]);
			if (i >= 0 && i < game.Cast.People.Size() && game.Cast.People[i].Body)
			{ let body = game.Cast.People[i].Body; Aim(pawn, body.Pos + (0, 0, body.Height * 0.8), L[b + 1], L[b + 2], L[b + 3]); }
		}
		else if (mode == 5) Aim(pawn, (L[b + 4], L[b + 5], Floor((L[b + 4], L[b + 5])) + L[b + 6]), L[b + 1], L[b + 2], L[b + 3]);
		T++;
	}
}
`;
const MAPINFO = extra => `gameinfo\n{\n    AddEventHandlers = "PDPlayCap"${extra ? ', "PDPlayShot"' : ''}\n}\n`;

function zipStore(files) {
  const parts = [], central = [];
  let off = 0;
  for (const [name, content] of files) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const nm = Buffer.from(name, 'utf8'), crc = zlib.crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nm.length, 26);
    parts.push(local, nm, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, nm);
    off += 30 + nm.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}

// ---------------------------------------------------------------- static server
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.mp4': 'video/mp4', '.png': 'image/png', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg'};
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
// [playcap] virtual clock: real time until frozen, then advanced in steps.
(() => {
  const realNow = performance.now.bind(performance);
  const clock = {frozen: false, base: 0, off: 0};
  clock.now = () => clock.frozen ? clock.base + clock.off : realNow();
  self.__pdcapClock = clock;
  performance.now = clock.now;
})();
`;
const WORKER_SUFFIX = `
(() => {
  const orig = self.onmessage;
  self.onmessage = (e) => {
    const m = e.data, clock = self.__pdcapClock;
    if (m && m.type === 'pdcap-freeze') { if (!clock.frozen) { clock.base = clock.now(); clock.off = 0; clock.frozen = true; } self.postMessage({type: 'pdcap-ack', frames: fg.total, id: m.id}); return; }
    if (m && m.type === 'pdcap-thaw') { clock.frozen = false; self.postMessage({type: 'pdcap-ack', frames: fg.total, id: m.id}); return; }
    if (m && m.type === 'pdcap-step') {
      const start = fg.total, t0 = Date.now();
      clock.off += m.ms;
      const poll = () => {
        if (fg.total >= start + (m.minFrames || 1) || Date.now() - t0 > (m.timeout || 4000)) { setTimeout(() => self.postMessage({type: 'pdcap-ack', frames: fg.total, rendered: fg.total - start, vnow: clock.off, id: m.id}), m.settle || 0); return; }
        setTimeout(poll, 1);
      };
      poll();
      return;
    }
    return orig(e);
  };
})();
`;
const INIT = ({EW, EH}) => {
  try { localStorage.setItem('pdoom.opening-seen.v1', '1'); } catch {}
  window.__PDCAP__ = {lines: [], acks: new Map(), go: false, done: false, logs: [], frozen: false};
  const pk3 = fetch('/__playcap/playcap.pk3').then(r => r.arrayBuffer());
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
          const i = m.msg.indexOf('PDPLAY ');
          if (i >= 0) { const line = m.msg.slice(i).trim(); C.lines.push(line); if (C.lines.length > 40) C.lines.shift(); if (line.startsWith('PDPLAY GO')) C.go = true; if (line.startsWith('PDPLAY DONE')) C.done = true; }
          if (/error|Script|abort/i.test(m.msg)) { C.logs.push(m.msg); if (C.logs.length > 80) C.logs.shift(); }
        }
      });
      const post = this.postMessage.bind(this);
      this.postMessage = (msg, transfer) => {
        if (msg && msg.type === 'boot') {
          pk3.then(buf => {
            msg.pinW = EW; msg.pinH = EH;
            msg.files['/playcap.pk3'] = new Uint8Array(buf);
            const args = msg.args.slice();
            args.splice(args.indexOf('pdoom.pk3') + 1, 0, 'playcap.pk3');
            for (let i = 0; i < args.length; i++) {
              if (args[i] === '+vid_defwidth' || args[i] === '+win_w') args[i + 1] = String(EW);
              if (args[i] === '+vid_defheight' || args[i] === '+win_h') args[i + 1] = String(EH);
            }
            args.push('+set', 'crosshair', '0', '+set', 'con_notifylines', '0', '+set', 'vid_maxfps', '0', '+set', 'con_centernotify', '0');
            msg.args = args;
            post(msg, [...(transfer || []), msg.files['/playcap.pk3'].buffer]);
          });
          return;
        }
        if (msg && msg.type === 'visibility') return post({type: 'visibility', state: 'visible'});
        if (C.frozen && msg && msg.type === 'input' && /^F1[01]$/.test(msg.init?.code || '')) return;
        return post(msg, transfer);
      };
    }
  };
  window.__pdcapCall = (msg) => new Promise(res => { const id = Math.random().toString(36).slice(2); window.__PDCAP__.acks.set(id, res); window.__QA_WORKER__.postMessage({...msg, id}); });
  window.__pdcapKey = (code, key, keyCode, evType) => window.__QA_WORKER__.postMessage({type: 'input', target: 'window', evType, init: {code, key, keyCode, which: keyCode, charCode: 0, bubbles: true, cancelable: true}});
  // CSS animations follow the virtual clock: paused, and set from it each frame.
  window.__pdcapAnimate = (vnow) => {
    for (const a of document.getAnimations()) {
      if (a.__v0 === undefined) a.__v0 = vnow;
      a.pause();
      a.currentTime = Math.max(0, vnow - a.__v0);
    }
  };
};
// Everything but the game view and its status bar / held tool. Shots can keep more (keep: [...]):
// 'text', 'dialogue', 'prologue-hud', 'labels' (the name over a person you aim at).
const CLEAN_CSS = (W, H, keep) => `
html, body { margin:0 !important; padding:0 !important; background:#000 !important; overflow:hidden !important; cursor:none !important; }
mann-cool-game-shell, #restart, #dev-badge, #touch, #finish, #result, #reticle, #onboarding, #launcher, #story, #intro-video,
.iv-skip, #prologue-transition, #prologue-upload-label${keep.includes('text') ? '' : ', #game-text, #status-line, #prompt, #message, #people, #threat-warning'}${keep.includes('dialogue') ? '' : ', #doom-dialogue, #hal-question, #bliss-guide'}${keep.includes('prologue-hud') ? '' : ', #prologue-hud'}${keep.includes('labels') ? '' : ', #person-label'}, #discovery-card
  { display:none !important; }
button { display:none !important; }
#stage { position:fixed !important; inset:0 !important; width:${W}px !important; height:${H}px !important; transform:none !important; }
#canvas { position:absolute !important; left:0 !important; top:0 !important; width:${W}px !important; height:${H}px !important; max-width:none !important; max-height:none !important;
  transform:none !important; image-rendering:pixelated !important; }
`;

// ---------------------------------------------------------------- run
const KEYS = {
  w: ['KeyW', 'w', 87], a: ['KeyA', 'a', 65], s: ['KeyS', 's', 83], d: ['KeyD', 'd', 68], ctrl: ['ControlLeft', 'Control', 17],
  space: ['Space', ' ', 32], e: ['KeyE', 'e', 69], shift: ['ShiftLeft', 'Shift', 16], c: ['KeyC', 'c', 67], t: ['KeyT', 't', 84],
  left: ['ArrowLeft', 'ArrowLeft', 37], right: ['ArrowRight', 'ArrowRight', 39], up: ['ArrowUp', 'ArrowUp', 38],
  '1': ['Digit1', '1', 49], '2': ['Digit2', '2', 50], '3': ['Digit3', '3', 51], '4': ['Digit4', '4', 52], '5': ['Digit5', '5', 53],
};
const {w: W, h: H, engine: [EW, EH]} = SIZE;
const {server, url} = BASE_URL ? {server: null, url: BASE_URL} : await serve();
const consoleCfg = await fs.readFile(path.join(WEB, 'controls.cfg'), 'utf8');
const meta = await gauntletMeta().catch(() => null);
const browser = await chromium.launch({channel: 'chrome', headless: !HEADED, args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']});
const summary = [];
for (const shot of shots) {
  const out = path.join(OUT_ROOT, shot.ceo, shot.name);
  const lump = program(shot);
  // A shot may bring its own handler (class PDPlayShot : EventHandler) for custom setup or timed actions;
  // PDPlayShot can read the program clock from PDPlayCap(EventHandler.Find('PDPlayCap')).T.
  const PK3 = zipStore([['MAPINFO', MAPINFO(!!shot.zscript)], ['ZSCRIPT', ZSCRIPT + (shot.zscript || '')], ['playcap.txt', lump]]);
  const page = await browser.newPage({viewport: {width: W, height: H}, deviceScaleFactor: 1});
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route(u => !/^http:\/\/(127\.0\.0\.1|localhost)/.test(u.href), r => r.abort());
  await page.route('**/__playcap/playcap.pk3', r => r.fulfill({status: 200, contentType: 'application/octet-stream', body: PK3}));
  await page.route('**/engine/engine.worker.js', async r => {
    const resp = await r.fetch();
    const body = WORKER_PREFIX + await resp.text() + WORKER_SUFFIX;
    await r.fulfill({response: resp, body, headers: {...resp.headers(), 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store'}});
  });
  await page.route('**/controls.cfg', r => r.fulfill({contentType: 'text/plain', body: consoleCfg + '\nbind ` "toggleconsole"\nbind o "netevent pdplay_go"\n'}));
  await page.addInitScript(INIT, {EW, EH});
  const report = {shot: shot.name, width: W, height: H, engine: [EW, EH], fps: FPS, frames: 0, errors};
  const t0 = Date.now();
  console.log(`[playcap] ${shot.name} (${shot.ceo})`);
  try {
    const q = nativeQA(page);
    const g = meta ? gauntletQA(page, q, meta) : null;
    const target = new URL(shot.url, url);
    target.searchParams.set('ceo', shot.ceo);
    await page.goto(target.href);
    await startPlaying(page, shot);
    console.log(`[playcap] ${shot.name}: playing after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    const ctx = {page, q, g, meta, net: (name, ...args) => q.command(`netevent pdplay_${name} ${args.map(v => Math.round(v)).join(' ')}`), read: q.read};
    if (shot.setup) await shot.setup(ctx);
    report.setupState = summarize(await q.read());
    await page.addStyleTag({content: CLEAN_CSS(W, H, shot.keep || [])});
    if (shot.css) await page.addStyleTag({content: shot.css});
    if (SCOUT) {
      await page.waitForTimeout(300);
      await fs.mkdir(path.dirname(out), {recursive: true});
      await page.screenshot({path: out + '-scout.png'});
      report.scout = out + '-scout.png';
      throw {scouted: true};
    }
    // freeze, start the program, then record
    await page.evaluate(() => { window.__PDCAP__.frozen = true; });
    await page.evaluate(() => window.__pdcapCall({type: 'pdcap-freeze'}));
    await page.evaluate(k => window.__pdcapKey(...k, 'keydown'), ['KeyO', 'o', 79]);
    await page.evaluate(k => window.__pdcapKey(...k, 'keyup'), ['KeyO', 'o', 79]);
    let vnow = 0;
    const step = async ms => { const r = await page.evaluate(ms => window.__pdcapCall({type: 'pdcap-step', ms, minFrames: 2, settle: 0}), ms); vnow = r.vnow; return r; };
    for (let k = 0; k < 40 && !(await page.evaluate(() => window.__PDCAP__.go)); k++) await step(TIC * 0.9);
    if (!(await page.evaluate(() => window.__PDCAP__.go))) throw Error('PDPlayCap never started: ' + JSON.stringify(await page.evaluate(() => window.__PDCAP__)));
    await fs.rm(out, {recursive: true, force: true});
    await fs.mkdir(out, {recursive: true});
    const nFrames = Math.round(shot.seconds * FPS);
    const holds = (shot.keys || []).map(k => ({...k, down: false}));
    const presses = (shot.press || []).map(p => ({...p, done: false}));
    const nSub = Math.ceil((1000 / FPS) / (TIC * 0.95));
    const v0 = vnow;
    for (let f = 0; f < nFrames; f++) {
      const t = f / FPS;
      for (const h of holds) {
        const want = t >= h.from && t < h.to;
        if (want !== h.down) { await page.evaluate(([k, ev]) => window.__pdcapKey(...k, ev), [KEYS[h.key], want ? 'keydown' : 'keyup']); h.down = want; }
      }
      for (const p of presses) if (!p.done && t >= p.at) {
        await page.evaluate(k => { window.__pdcapKey(...k, 'keydown'); }, KEYS[p.key]);
        p.done = true; p.upAt = t + (p.hold ?? 0.12);
      }
      for (const p of presses) if (p.done && p.upAt !== undefined && t >= p.upAt) { await page.evaluate(k => window.__pdcapKey(...k, 'keyup'), KEYS[p.key]); p.upAt = undefined; }
      for (let k = 0; k < nSub; k++) await step(1000 / FPS / nSub);
      await page.evaluate(v => window.__pdcapAnimate(v), vnow - v0);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.screenshot({path: path.join(out, String(f).padStart(5, '0') + '.png'), animations: 'allow', caret: 'initial'});
      report.frames++;
      if (f % 60 === 0) console.log(`[playcap] ${shot.name}: frame ${f}/${nFrames} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    for (const h of holds) if (h.down) await page.evaluate(k => window.__pdcapKey(...k, 'keyup'), KEYS[h.key]);
    report.endState = summarize(await page.evaluate(() => JSON.parse(window.render_game_to_text())));
    report.lines = await page.evaluate(() => window.__PDCAP__.lines.slice(-6));
    report.passed = true;
  } catch (e) {
    if (e && e.scouted) report.passed = true;
    else {
      report.failure = String(e && e.stack || e);
      report.logs = await page.evaluate(() => ({pd: window.__PDCAP__?.lines, logs: window.__PDCAP__?.logs, debug: window.__DOOM_DEBUG__?.logs.slice(-30)})).catch(() => null);
      await fs.mkdir(OUT_ROOT, {recursive: true});
      await page.screenshot({path: path.join(OUT_ROOT, `${shot.ceo}-${shot.name}-failure.png`)}).catch(() => {});
    }
  }
  report.seconds = (Date.now() - t0) / 1000;
  report.program = lump.split('\n').length;
  if (!SCOUT && report.passed) await fs.writeFile(path.join(out, 'capture.json'), JSON.stringify({...report, look: shot.look, keys: shot.keys, press: shot.press, events: shot.events}, null, 1));
  summary.push({shot: shot.name, ceo: shot.ceo, passed: !!report.passed, frames: report.frames, seconds: Math.round(report.seconds), failure: report.failure?.slice(0, 400), end: report.endState, scout: report.scout});
  console.log(JSON.stringify(summary.at(-1)));
  if (report.logs) console.log(JSON.stringify(report.logs, null, 1).slice(0, 3000));
  await page.close();
}
await Promise.race([browser.close(), new Promise(r => setTimeout(r, 3000))]);
server?.close();
process.exit(summary.every(s => s.passed) ? 0 : 1);

function summarize(s) {
  if (!s) return null;
  const w = s.world || {};
  return {mode: s.mode, level: s.levelId, x: w.x, y: w.y, angle: w.angle, health: w.health, section: s.prologue?.section, stage: s.prologue?.stage, robots: s.prologue?.robots?.length};
}

// Boot the way the smokes do: a level straight from the launcher, or New Game -> prologue.
async function startPlaying(page, shot) {
  const playing = () => page.evaluate(() => { try { const s = JSON.parse(window.render_game_to_text()); return s.mode === 'playing' && !s.uiBlocked; } catch { return false; } });
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function', {}, {timeout: 30000});
  const deadline = Date.now() + 90000;
  let clicked = false;
  while (Date.now() < deadline) {
    if (await playing()) {
      if (!shot.waitFor) return;
      const ok = await page.evaluate(src => { const s = JSON.parse(window.render_game_to_text()); return (0, eval)(src)(s); }, shot.waitFor.toString()).catch(() => false);
      if (ok) return;
    }
    if (!clicked) {
      if (await page.locator('#title-enter').isVisible().catch(() => false)) {
        await page.evaluate(() => { localStorage.setItem('pdoom.level-intros.v1', JSON.stringify(['five-prisons', 'hal-station'])); localStorage.setItem('pdoom.level-select', '1'); });
        await page.click('#title-enter');
        const id = await page.evaluate(() => JSON.parse(window.render_game_to_text()).levelId);
        await page.click('#menu-new'); await page.click('#hero-next'); await page.click('#level-' + id);
        clicked = true;
      } else if (await page.locator('#start').isVisible().catch(() => false)) { await page.click('#start'); clicked = true; }
    }
    if (await page.locator('#intro-video .iv-skip').count()) await page.click('#intro-video .iv-skip').catch(() => {});
    await page.waitForTimeout(250);
  }
  throw Error('not playing after 90 s: ' + JSON.stringify(summarize(JSON.parse(await page.evaluate(() => window.render_game_to_text())))));
}
