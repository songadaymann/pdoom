#!/usr/bin/env python3
"""Swap the B-roll under the presenter in a finished promo, and lay the text on top of him.

Jonathan's finished trailers (GADtrailers/pdoom/pdoom-samwise-othermale.mov, pdoom-mario-scaldi.mov)
are his keyed, edited AI-presenter over one of scripts/build-promo.py's timed B-roll films. Wherever the
presenter is off screen the finished frame equals that B-roll, so the difference between the two is
the presenter's matte. With F the finished frame, B the old B-roll and N a new B-roll of the same
timing, the presenter composite F = a*P + (1-a)*B becomes a*P + (1-a)*N = F + (1-a)(N - B), which keeps
his exact edit, placement and edges. Then an optional text layer (ProRes 4444 alpha from
build-promo.py) goes over everything, so slams are never hidden behind him.

    python3 scripts/promo-presenter-swap.py FINISHED OLD_BROLL NEW_BROLL OUT.mp4 [--text TEXT.mov] [--audio MIX.wav]
            [--matte-preview MATTE.mp4]
    python3 scripts/promo-presenter-swap.py FINISHED OLD_BROLL - - --presence ON.json   # when he is on screen

The old B-roll frame is matched per frame among f-1, f, f+1 (an edit can slip a frame).
Without --audio the finished film's own soundtrack is kept.
"""
from __future__ import annotations

import argparse
import subprocess
from collections import deque

import numpy as np
from scipy import ndimage

W, H, FPS = 1080, 1920, 30


def reader(path, fmt='rgb24', ch=3):
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'rawvideo', '-pix_fmt', fmt, '-'],
                         stdout=subprocess.PIPE, bufsize=W * H * ch * 2)
    n = W * H * ch
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            break
        yield np.frombuffer(b, np.uint8).reshape(H, W, ch)
    p.stdout.close()
    p.wait()


def probe(path, entry):
    return subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', entry, '-of', 'csv=p=0', str(path)],
                          capture_output=True, text=True).stdout.strip()


def matte(F, B, keep=None):
    """Presenter alpha (float32, HxW) from the finished frame and the B-roll under it.  keep: (y0, y1) rows
    where anything that differs from the B-roll belongs to the edit too (a text plate copied in by hand)."""
    d = np.abs(F.astype(np.int16) - B.astype(np.int16)).max(2).astype(np.float32)
    band = None
    if keep:
        y0, y1 = keep
        band = np.zeros(d.shape, bool)
        band[y0:y1] = d[y0:y1] > 12
        band = ndimage.binary_dilation(ndimage.binary_closing(band, iterations=2), iterations=2)
    small = d[::2, ::2]
    hard = small > 26
    hard = ndimage.binary_opening(hard, iterations=1)
    lab, n = ndimage.label(hard)
    sizes = ndimage.sum(hard, lab, range(1, n + 1)) if n else np.zeros(0)
    body = np.isin(lab, 1 + np.nonzero(sizes >= 1500)[0])     # the presenter is one big blob (plus a hand, a mic)
    if not body.any():
        return band.astype(np.float32) if band is not None and band.any() else None
    body = ndimage.binary_closing(body, iterations=3)
    body = ndimage.binary_fill_holes(body)                     # inside him, where his colours match the B-roll
    core = ndimage.binary_erosion(body, iterations=2)
    zone = ndimage.binary_dilation(body, iterations=3)
    core = np.repeat(np.repeat(core, 2, 0), 2, 1)
    zone = np.repeat(np.repeat(zone, 2, 0), 2, 1)
    if band is not None:                                       # the hand-added overlay, whole
        core |= band
    soft = np.clip((d - 8.0) / 34.0, 0, 1)                     # hair and motion blur: partial
    a = np.where(core, 1.0, np.where(zone, soft, 0.0)).astype(np.float32)
    return ndimage.uniform_filter(a, 3)


def presence(finished, old_broll, out_json):
    """When the presenter is on screen (and how high he reaches), at quarter size: the layout guide for a
    new B-roll that should keep its action clear of him.  Writes {fps, frames: [[on, top_px], ...],
    segments: [[t0, t1, top_px], ...]}."""
    import json
    w, h = W // 4, H // 4

    def frames(path):
        p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', str(path), '-vf', 'scale=%d:%d' % (w, h), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                             stdout=subprocess.PIPE)
        while True:
            b = p.stdout.read(w * h * 3)
            if len(b) < w * h * 3:
                break
            yield np.frombuffer(b, np.uint8).reshape(h, w, 3).astype(np.int16)
    old = frames(old_broll)
    window = deque([None, next(old, None), next(old, None)], maxlen=3)
    rows = []
    for F in frames(finished):
        cands = [b for b in window if b is not None]
        B = min(cands, key=lambda b: float(np.mean(np.abs(F - b).max(2))))
        d = ndimage.binary_opening(np.abs(F - B).max(2) > 30, iterations=1)
        lab, n = ndimage.label(d)
        top = None
        if n:
            sizes = ndimage.sum(d, lab, range(1, n + 1))
            k = int(np.argmax(sizes)) + 1
            if sizes[k - 1] > 400:
                top = int(np.nonzero(lab == k)[0].min()) * 4
        rows.append([top is not None, top])
        nxt = next(old, None)
        window.append(nxt if nxt is not None else window[-1])
    # segments: gaps and blips under 0.3 s are noise from cuts
    on = np.array([r[0] for r in rows], bool)
    k = int(0.3 * FPS)
    for val in (True, False):
        i = 0
        while i < len(on):
            if on[i] != val:
                j = i
                while j < len(on) and on[j] != val:
                    j += 1
                if 0 < i and j < len(on) and j - i < k:
                    on[i:j] = val
                i = j
            else:
                i += 1
    segs, i = [], 0
    while i < len(on):
        j = i
        while j < len(on) and on[j] == on[i]:
            j += 1
        if on[i]:
            tops = [r[1] for r in rows[i:j] if r[1] is not None]
            segs.append([round(i / FPS, 3), round(j / FPS, 3), int(np.median(tops)) if tops else None])
        i = j
    json.dump(dict(fps=FPS, frames=rows, segments=segs), open(out_json, 'w'))
    for s_ in segs:
        print('  presenter on %.2f-%.2f s, head top ~%s px' % tuple(s_))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('finished')
    ap.add_argument('old_broll')
    ap.add_argument('new_broll')
    ap.add_argument('out')
    ap.add_argument('--text', help='RGBA overlay (e.g. build-promo.py --layers ...-text-alpha.mov) composited on top')
    ap.add_argument('--audio', help='soundtrack for the output (default: the finished film\'s)')
    ap.add_argument('--matte-preview', help='also write the extracted presenter matte as a greyscale video')
    ap.add_argument('--crf', type=int, default=16)
    ap.add_argument('--until', type=float, help='stop after this many seconds (quick checks)')
    ap.add_argument('--keep', action='append', default=[], metavar='T0,T1,Y0,Y1',
                    help='seconds and rows where an overlay added in the edit (e.g. a copied text plate) is kept as part of it')
    ap.add_argument('--presence', help='instead: write when the presenter is on screen (JSON) and stop; new_broll/out are ignored')
    args = ap.parse_args()
    if args.presence:
        presence(args.finished, args.old_broll, args.presence)
        return

    keeps = [tuple(float(v) if i < 2 else int(v) for i, v in enumerate(k.split(','))) for k in args.keep]
    n = int(probe(args.finished, 'stream=nb_frames') or 0) or int(round(float(probe(args.finished, 'format=duration') or 0) * FPS))
    fin, old, new = reader(args.finished), reader(args.old_broll), reader(args.new_broll)
    txt = reader(args.text, 'rgba', 4) if args.text else None
    audio = args.audio or args.finished
    enc = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-',
                            '-i', str(audio), '-map', '0:v', '-map', '1:a',
                            '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
                            '-c:v', 'libx264', '-preset', 'slow', '-crf', str(args.crf), '-profile:v', 'high', '-level:v', '4.1', '-g', str(FPS * 2),
                            '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
                            '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', str(args.out)], stdin=subprocess.PIPE)
    mp = None
    if args.matte_preview:
        mp = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', '%dx%d' % (W // 2, H // 2), '-r', str(FPS),
                               '-i', '-', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', str(args.matte_preview)], stdin=subprocess.PIPE)
    window = deque(maxlen=3)                     # old B-roll frames f-1, f, f+1
    held = [None]

    def next_old():                              # a B-roll a few frames short of the finished film holds its last frame
        b = next(old, None)
        if b is not None:
            held[0] = b
        return held[0]
    window.append(None)
    window.append(next_old())
    window.append(next_old())
    last_new = None
    slips = 0
    for f, F in enumerate(fin):
        if args.until and f >= args.until * FPS:
            break
        N = next(new, None)
        N = last_new if N is None else N
        last_new = N
        cands = [(k, b) for k, b in enumerate(window) if b is not None]
        if not cands:
            break
        # the matching old frame: the closest on average (the presenter differs from all three alike)
        best = min(cands, key=lambda kb: float(np.mean(np.abs(F[::4, ::4].astype(np.int16) - kb[1][::4, ::4].astype(np.int16)).max(2))))
        slips += best[0] != 1
        B = best[1]
        a = matte(F, B, next(((y0, y1) for (t0, t1, y0, y1) in keeps if t0 <= f / FPS < t1), None))
        if a is None:
            out = N.astype(np.float32)
        else:
            Ff, Bf, Nf = F.astype(np.float32), B.astype(np.float32), N.astype(np.float32)
            k = (1.0 - a)[..., None]
            out = np.where(a[..., None] > 0, Ff + k * (Nf - Bf), Nf)
        if txt is not None:
            T = next(txt, None)
            if T is not None:
                ta = T[..., 3:].astype(np.float32) / 255
                out = out * (1 - ta) + T[..., :3].astype(np.float32) * ta
        enc.stdin.write(np.clip(out + 0.5, 0, 255).astype(np.uint8).tobytes())
        if mp:
            mp.stdin.write(((a if a is not None else np.zeros((H, W), np.float32))[::2, ::2] * 255).astype(np.uint8).tobytes())
        window.append(next_old())
        if f % 150 == 0:
            print('  frame %d/%d (frame slips so far: %d)' % (f, n, slips), flush=True)
    enc.stdin.close()
    if mp:
        mp.stdin.close()
    if enc.wait() != 0 or (mp and mp.wait() != 0):
        raise SystemExit('ffmpeg failed')
    print('wrote', args.out, '(%d frames matched off by one)' % slips)


if __name__ == '__main__':
    main()
