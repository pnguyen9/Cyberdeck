"""Makes the pictures and sounds of the virtual pet sample, from code alone: python3 virtual_pet_assets.py <folder>."""
import subprocess
import sys
import wave
from pathlib import Path

import numpy

RATE = 44100

BODY = '#ffd84d'
OUTLINE = '#c9971c'
BEAK = '#ff9f43'
INK = '#3b2a1a'
BLUSH = '#ff9eb5'


def eyes(kind):
    """The eyes, and what goes with them, for each expression."""
    if kind == 'happy':
        return ('<path d="M232 300 q22 -26 44 0" stroke="{0}" stroke-width="10" fill="none" stroke-linecap="round"/>'
                '<path d="M324 300 q22 -26 44 0" stroke="{0}" stroke-width="10" fill="none" stroke-linecap="round"/>').format(INK)
    if kind in ('asleep', 'eating'):
        return ('<path d="M232 296 q22 20 44 0" stroke="{0}" stroke-width="10" fill="none" stroke-linecap="round"/>'
                '<path d="M324 296 q22 20 44 0" stroke="{0}" stroke-width="10" fill="none" stroke-linecap="round"/>').format(INK)
    if kind == 'sleepy':
        return ('<path d="M230 300 h48" stroke="{0}" stroke-width="10" stroke-linecap="round"/>'
                '<path d="M322 300 h48" stroke="{0}" stroke-width="10" stroke-linecap="round"/>'
                '<circle cx="254" cy="306" r="9" fill="{0}"/><circle cx="346" cy="306" r="9" fill="{0}"/>').format(INK)
    if kind == 'sad':
        return ('<circle cx="254" cy="300" r="14" fill="{0}"/><circle cx="346" cy="300" r="14" fill="{0}"/>'
                '<path d="M226 282 l40 -14" stroke="{0}" stroke-width="8" stroke-linecap="round"/>'
                '<path d="M374 282 l-40 -14" stroke="{0}" stroke-width="8" stroke-linecap="round"/>'
                '<path d="M262 322 q-8 22 0 34 q8 -12 0 -34" fill="#7cc8ff"/>').format(INK)
    if kind == 'hungry':
        return ('<circle cx="254" cy="296" r="16" fill="{0}"/><circle cx="346" cy="296" r="16" fill="{0}"/>'
                '<circle cx="259" cy="289" r="5" fill="#fff"/><circle cx="351" cy="289" r="5" fill="#fff"/>'
                '<path d="M226 262 l40 -10" stroke="{0}" stroke-width="8" stroke-linecap="round"/>'
                '<path d="M374 262 l-40 -10" stroke="{0}" stroke-width="8" stroke-linecap="round"/>').format(INK)
    if kind == 'playing':
        return ('<circle cx="254" cy="296" r="20" fill="{0}"/><circle cx="346" cy="296" r="20" fill="{0}"/>'
                '<circle cx="261" cy="288" r="7" fill="#fff"/><circle cx="353" cy="288" r="7" fill="#fff"/>').format(INK)
    return ('<circle cx="254" cy="298" r="15" fill="{0}"/><circle cx="346" cy="298" r="15" fill="{0}"/>'
            '<circle cx="259" cy="292" r="5" fill="#fff"/><circle cx="351" cy="292" r="5" fill="#fff"/>').format(INK)


def beak(kind):
    if kind in ('happy', 'hungry', 'playing', 'eating'):
        return ('<path d="M272 336 L328 336 L300 360 Z" fill="{0}" stroke="#d9772b" stroke-width="4"/>'
                '<path d="M276 344 L324 344 L300 378 Z" fill="#e8742a"/>').format(BEAK)
    if kind == 'sad':
        return '<path d="M276 346 L324 346 L300 366 Z" fill="{0}" stroke="#d9772b" stroke-width="4"/>'.format(BEAK)
    return '<path d="M274 338 L326 338 L300 364 Z" fill="{0}" stroke="#d9772b" stroke-width="4"/>'.format(BEAK)


def extras(kind):
    if kind == 'asleep':
        return ('<text x="430" y="170" font-family="Georgia, serif" font-size="64" fill="#9eb7ff">z</text>'
                '<text x="480" y="110" font-family="Georgia, serif" font-size="88" fill="#9eb7ff">Z</text>')
    if kind == 'sleepy':
        return '<text x="440" y="180" font-family="Georgia, serif" font-size="56" fill="#9eb7ff">z</text>'
    if kind == 'eating':
        return ''.join('<ellipse cx="{0}" cy="{1}" rx="9" ry="6" fill="#c08a3e"/>'.format(x, y)
                       for x, y in ((250, 410), (300, 420), (352, 406), (282, 440), (330, 444)))
    if kind == 'playing':
        return ('<circle cx="500" cy="560" r="46" fill="#ff6b6b" stroke="#c94848" stroke-width="5"/>'
                '<path d="M462 540 q38 28 76 0" stroke="#fff" stroke-width="6" fill="none"/>')
    return ''


def pip(kind):
    """Pip, a round chick, sitting on the bottom of a 600 × 700 picture."""
    drop = 24 if kind == 'asleep' else 0
    body = (
        '<ellipse cx="300" cy="664" rx="170" ry="22" fill="#000" opacity="0.18"/>'
        '<path d="M250 640 l-14 30 M250 640 l0 32 M250 640 l14 30 M350 640 l-14 30 M350 640 l0 32 M350 640 l14 30" '
        'stroke="{beak}" stroke-width="9" stroke-linecap="round"/>'
        '<g transform="translate(0 {drop})">'
        '<path d="M300 150 q-10 -50 22 -66 q-6 30 10 48" fill="{body}" stroke="{outline}" stroke-width="6"/>'
        '<ellipse cx="300" cy="400" rx="210" ry="240" fill="{body}" stroke="{outline}" stroke-width="8"/>'
        '<ellipse cx="300" cy="470" rx="130" ry="130" fill="#ffe98c"/>'
        '<path d="M100 420 q-40 60 20 110 q30 -40 20 -110 z" fill="{body}" stroke="{outline}" stroke-width="6"/>'
        '<path d="M500 420 q40 60 -20 110 q-30 -40 -20 -110 z" fill="{body}" stroke="{outline}" stroke-width="6"/>'
        '<ellipse cx="214" cy="350" rx="30" ry="18" fill="{blush}" opacity="{blush_opacity}"/>'
        '<ellipse cx="386" cy="350" rx="30" ry="18" fill="{blush}" opacity="{blush_opacity}"/>'
        '{eyes}{beak_shape}'
        '</g>'
        '{extras}'
    ).format(beak=BEAK, drop=drop, body=BODY, outline=OUTLINE, blush=BLUSH,
             blush_opacity='0.9' if kind in ('happy', 'eating', 'playing') else '0.45',
             eyes=eyes(kind), beak_shape='' if kind == 'asleep' else beak(kind), extras=extras(kind))
    # Drawn on 600 × 700, shown smaller: the options of a choice stay clear of its face.
    return '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="490" viewBox="0 0 600 700">{0}</svg>'.format(body)


def room(width=1920, height=1080, with_pip=False):
    """A cosy room: a window on the sky, a shelf, a basket in the middle of the floor."""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 1920 1080">'
        '<defs><linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe3d0"/><stop offset="1" stop-color="#f4cfb5"/></linearGradient>'
        '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#d9f1ff"/></linearGradient></defs>'
        '<rect width="1920" height="1080" fill="url(#wall)"/>'
        '<rect y="780" width="1920" height="300" fill="#d9a77a"/>'
        '<rect y="780" width="1920" height="14" fill="#b98457"/>'
        '<rect x="1240" y="150" width="460" height="380" rx="16" fill="url(#sky)" stroke="#fff" stroke-width="22"/>'
        '<path d="M1470 150 v380 M1240 340 h460" stroke="#fff" stroke-width="14"/>'
        '<circle cx="1360" cy="250" r="44" fill="#fff3a6"/>'
        '<ellipse cx="1590" cy="420" rx="70" ry="26" fill="#fff" opacity="0.9"/>'
        '<rect x="220" y="300" width="420" height="20" rx="6" fill="#b98457"/>'
        '<rect x="260" y="230" width="60" height="70" rx="8" fill="#ff9eb5"/><rect x="340" y="250" width="44" height="50" rx="8" fill="#9ed9a0"/>'
        '<circle cx="470" cy="270" r="30" fill="#ffd84d"/><rect x="540" y="240" width="56" height="60" rx="8" fill="#8fb8ff"/>'
        '<ellipse cx="960" cy="930" rx="330" ry="70" fill="#a8743f"/>'
        '<ellipse cx="960" cy="900" rx="310" ry="60" fill="#e8c27a"/>'
        '<path d="M650 900 q310 120 620 0" stroke="#c99a52" stroke-width="10" fill="none"/>'
        '{pip}'
        '</svg>'
    ).format(w=width, h=height, pip='<g transform="translate(660 330)">{0}</g>'.format(pip('happy')[pip('happy').index('>') + 1:-len('</svg>')]) if with_pip else '')


def cover():
    svg = room(1600, 900, with_pip=True)
    title = ('<text x="330" y="960" text-anchor="middle" font-family="Georgia, serif" font-size="150" font-weight="bold" fill="#e0567a">Pip</text>'
             '<text x="330" y="1030" text-anchor="middle" font-family="Georgia, serif" font-size="46" fill="#7a4a2a">a little friend to look after</text>')
    return svg.replace('</svg>', title + '</svg>')


def seconds(duration):
    return numpy.arange(int(RATE * duration)) / RATE


def envelope(time, attack, decay):
    return numpy.clip(time / attack, 0, 1) * numpy.exp(-numpy.maximum(time - attack, 0) / decay)


def glide(start, end, duration, decay):
    """A tone sliding from one pitch to another: a chirp, a yawn."""
    time = seconds(duration)
    frequency = numpy.linspace(start, end, len(time))
    phase = 2 * numpy.pi * numpy.cumsum(frequency) / RATE
    return (numpy.sin(phase) + 0.25 * numpy.sin(2 * phase)) * envelope(time, 0.01, decay)


def sequence(pieces):
    length = max(int(start * RATE) + len(samples) for start, samples in pieces)
    out = numpy.zeros(length)
    for start, samples in pieces:
        offset = int(start * RATE)
        out[offset:offset + len(samples)] += samples
    return out


def crunch(duration, generator):
    time = seconds(duration)
    spectrum = numpy.fft.rfft(generator.standard_normal(len(time)))
    frequencies = numpy.fft.rfftfreq(len(time), 1 / RATE)
    spectrum[(frequencies < 800) | (frequencies > 5000)] = 0
    return numpy.fft.irfft(spectrum, len(time)) * envelope(time, 0.002, 0.02)


def write_sound(folder, name, samples, loudness=0.5):
    samples = samples / numpy.max(numpy.abs(samples)) * loudness
    fade = min(len(samples), int(0.01 * RATE))
    samples[-fade:] *= numpy.linspace(1, 0, fade)
    path = folder / f'{name}.wav'
    with wave.open(str(path), 'wb') as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(RATE)
        file.writeframes((samples * 32767).astype(numpy.int16).tobytes())
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(path), '-c:a', 'libvorbis', '-q:a', '4', str(folder / f'{name}.ogg')], check=True)
    path.unlink()


def main():
    folder = Path(sys.argv[1])
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'room.svg').write_text(room())
    (folder / 'cover.svg').write_text(cover())
    (folder / 'pip.svg').write_text(pip('normal'))
    for kind in ('happy', 'hungry', 'sad', 'sleepy', 'asleep', 'eating', 'playing'):
        (folder / f'pip-{kind}.svg').write_text(pip(kind))
    generator = numpy.random.default_rng(11)
    write_sound(folder, 'chirp', sequence([(0.0, glide(1800, 2600, 0.09, 0.04)), (0.12, glide(1900, 2900, 0.11, 0.05))]))
    write_sound(folder, 'munch', sequence([(index * 0.13, crunch(0.08, generator)) for index in range(4)]), loudness=0.4)
    write_sound(folder, 'giggle', sequence([(index * 0.07, glide(1400 + index * 180, 1700 + index * 180, 0.06, 0.03)) for index in range(6)]), loudness=0.45)
    write_sound(folder, 'yawn', glide(900, 380, 0.9, 0.5), loudness=0.4)


main()
