#!/usr/bin/env python3
"""Original, deterministic crunchy metal SFX for the native Doom sound mixer."""
from pathlib import Path
import math
import random
import struct
import wave

ROOT = Path(__file__).resolve().parents[1]
RATE = 22050


def render(name, lump, seconds, sample, seed):
    rng = random.Random(seed)
    values = [sample(i / RATE, rng) for i in range(round(RATE * seconds))]
    peak = max(abs(v) for v in values)
    pcm = []
    for i, value in enumerate(values):
        # Short fades prevent a digital click; modest quantization supplies
        # the grit without long loops, runtime synthesis or frame stalls.
        fade = min(1, i / 45, (len(values) - 1 - i) / 150)
        value = round(max(-1, min(1, value / peak * .9)) * 255) / 255
        pcm.append(round(value * fade * 32767))
    path = ROOT / 'art' / 'audio' / name
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(struct.pack('<' + 'h' * len(pcm), *pcm))
    # Use Doom's native unsigned8-bit sound format in the mod. This needs no
    # optional general-purpose WAV decoder in the small WebAssembly runtime.
    payload = bytes([128]) * 16 + bytes(max(0, min(255, round(v / 256) + 128)) for v in pcm) + bytes([128]) * 16
    native = ROOT / 'doom-mod' / 'sounds' / 'pdoom' / (lump.lower() + '.lmp')
    native.parent.mkdir(parents=True, exist_ok=True)
    native.write_bytes(struct.pack('<HHI', 3, RATE, len(payload)) + payload)


def pickup(t, rng):
    strike = rng.uniform(-1, 1) * math.exp(-t * 110) * .7
    ring = sum(math.sin(math.tau * f * t) * a * math.exp(-t * decay)
               for f, a, decay in [(740, .45, 18), (1193, .3, 22), (2037, .19, 27)])
    click = 0
    if t > .11:
        u = t - .11
        click = (rng.uniform(-1, 1) * .25 + math.sin(math.tau * 920 * u) * .3) * math.exp(-u * 55)
    return strike + ring + click


def camera(t, rng):
    noise = rng.uniform(-1, 1)
    # Hard casing fracture, descending low burst, electrical crackle, then
    # three small metal impacts as pieces hit the floor.
    crack = math.tanh(noise * 3) * math.exp(-t * 27) * .85
    boom = math.sin(math.tau * (110 * t - 44 * t * t)) * math.exp(-t * 8) * .9
    fizz = noise * math.exp(-t * 7) * .28
    bits = 0
    for when, frequency, weight in [(.13, 1680, .35), (.27, 1230, .24), (.42, 2210, .17)]:
        if t > when:
            u = t - when
            bits += (math.sin(math.tau * frequency * u) + noise * .6) * math.exp(-u * 45) * weight
    return crack + boom + fizz + bits


render('wrench-pickup.wav', 'PDPICKUP', .34, pickup, 6091)
render('camera-break.wav', 'PDCAMBRK', .78, camera, 6092)
print('Built original wrench pickup and camera destruction sounds.')

for name,lump,freq in [('gathered','PDGATH',440),('release','PDREL',550),('contact','PDCONT',110),('seen','PDSEEN',880),('charge','PDCHRG',360),('loss','PDLOSS',130),('discovery','PDDISC',660)]:
    render(name+'.wav',lump,.22,lambda t,r,f=freq: math.sin(math.tau*f*t)*math.exp(-t*12),6093)

render("tea-clink.wav", "PDTEAC", .19, pickup, 6094)


def valve(t, rng):
    # A hand-driven metal wheel: uneven ratchet teeth, low bearing friction,
    # then a solid end-stop. Short and dry so it reads as work, not an alarm.
    noise = rng.uniform(-1, 1)
    friction = noise * .06 * math.sin(math.pi * min(1, t / .62))
    teeth = 0
    for when in [0, .095, .205, .33, .475]:
        if t >= when:
            u = t - when
            teeth += (noise * .28 + math.sin(math.tau * 430 * u) * .2
                      + math.sin(math.tau * 1270 * u) * .1) * math.exp(-u * 75)
    stop = 0
    if t >= .62:
        u = t - .62
        stop = (noise * .3 + math.sin(math.tau * 180 * u) * .42) * math.exp(-u * 32)
    return friction + teeth + stop


render('valve-turn.wav', 'PDVALVE', .82, valve, 6095)


# Original Doom has no dedicated rescue fanfare. Reuse its power-up pickup
# cue for the discovery card, outside the paused native mixer. Private IWAD.
blob=(ROOT/'doom-web/local/DOOM.WAD').read_bytes();count,directory=struct.unpack_from('<II',blob,4)
for n in range(count):
    off,size,name=struct.unpack_from('<II8s',blob,directory+n*16)
    if name.rstrip(b'\0')!=b'DSGETPOW':continue
    data=blob[off:off+size];fmt,rate,samples=struct.unpack_from('<HHI',data)
    assert fmt==3 and samples<=len(data)-8
    target=ROOT/'doom-web/local/ui/doom-success.wav'
    target.parent.mkdir(parents=True,exist_ok=True)
    with wave.open(str(target),'wb') as wav:
        wav.setnchannels(1);wav.setsampwidth(1);wav.setframerate(rate);wav.writeframes(data[24:8+samples-16])
    print('Prepared original Doom power-up pickup cue for discovery cards.')
    break
else:raise ValueError('Supplied IWAD is missing DSGETPOW')


def chess(t,rng):
    # Small wooden piece on a board: short, low and dry, not a metal alarm.
    return (rng.uniform(-1,1)*.45+math.sin(math.tau*260*t)*.4)*math.exp(-t*65)
render('chess-piece.wav','PDCHESS',.12,chess,6108)


def sling(t, rng):
    # Slingshot release: the band slaps forward (a dry snap), the rubber twangs
    # low and drops in pitch, and the bearing leaves with a short airy whoosh.
    noise = rng.uniform(-1, 1)
    snap = math.tanh(noise * 4) * math.exp(-t * 160) * .8
    twang = math.sin(math.tau * (190 * t - 120 * t * t) + .8 * math.sin(math.tau * 23 * t)) * math.exp(-t * 14) * .75
    whoosh = noise * math.sin(math.pi * min(1, t / .16)) * math.exp(-t * 9) * .22
    return snap + twang + whoosh


def bearing_hit(t, rng):
    # A steel ball hits something hard and rattles away: a bright tink, then
    # smaller bounces arriving faster and quieter.
    noise = rng.uniform(-1, 1)
    out = 0
    for when, weight in [(0, 1), (.11, .45), (.19, .26), (.245, .15), (.28, .08)]:
        if t > when:
            u = t - when
            out += (math.sin(math.tau * 3150 * u) * .6 + math.sin(math.tau * 4720 * u) * .3 + noise * .35) * math.exp(-u * 70) * weight
    return out


render('sling-fire.wav', 'PDSLING', .36, sling, 6110)
render('sling-hit.wav', 'PDSLHIT', .36, bearing_hit, 6111)


def glass_crack(t, rng):
    # A wrench on HAL's breaker glass: a hard knock, then a bright splintering tick.
    noise = rng.uniform(-1, 1)
    knock = (noise * .5 + math.sin(math.tau * 520 * t) * .5) * math.exp(-t * 60)
    tick = sum(math.sin(math.tau * f * t) * a for f, a in [(3900, .35), (5300, .25), (6900, .15)]) * math.exp(-t * 30)
    split = noise * .3 * math.exp(-(t - .03) * 40) if t > .03 else 0
    return knock + tick + split


def glass_break(t, rng):
    # The pane gives way: a bright burst, a ring, then shards tinkling to the floor.
    noise = rng.uniform(-1, 1)
    burst = noise * math.exp(-t * 18) * .9
    ring = sum(math.sin(math.tau * f * t) * a for f, a in [(2850, .3), (4100, .25), (5600, .2), (7300, .12)]) * math.exp(-t * 9)
    tinkle = 0
    for when, f, w in [(.12, 4800, .3), (.2, 6100, .25), (.27, 3700, .22), (.36, 5400, .18), (.44, 6800, .14), (.55, 4300, .1), (.63, 5900, .08)]:
        if t > when:
            u = t - when
            tinkle += (math.sin(math.tau * f * u) + noise * .3) * math.exp(-u * 60) * w
    return burst + ring + tinkle


render('glass-crack.wav', 'PDGLCRK', .3, glass_crack, 6112)
render('glass-break.wav', 'PDGLBRK', .9, glass_break, 6113)
