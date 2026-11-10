"""Makes the pictures and sounds of the Pairs sample, from code alone: python3 pairs_assets.py <folder>.

Eight animals drawn with simple shapes on square tiles (`tile-cat.svg`…), a tile's back (`tile-back.svg`),
a meadow to play on, a cover, and four short sounds.
"""
import subprocess
import sys
import wave
from pathlib import Path

import numpy

RATE = 44100
SIZE = 220
INK = '#2b2118'


def tile(face, background):
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="{s}" height="{s}" viewBox="0 0 220 220">'
            '<rect x="4" y="4" width="212" height="212" rx="26" fill="{b}" stroke="#ffffff" stroke-width="6"/>{f}</svg>').format(s=SIZE, b=background, f=face)


def eyes(y=112, spread=26, size=9):
    return '<circle cx="{0}" cy="{y}" r="{s}" fill="{i}"/><circle cx="{1}" cy="{y}" r="{s}" fill="{i}"/>'.format(110 - spread, 110 + spread, y=y, s=size, i=INK)


def smile(y=140):
    return '<path d="M96 {0} q14 14 28 0" stroke="{1}" stroke-width="5" fill="none" stroke-linecap="round"/>'.format(y, INK)


ANIMALS = {
    'cat': ('#ffe0b8', '<path d="M52 92 L60 40 L92 70 Z M168 92 L160 40 L128 70 Z" fill="#f4a259"/>'
            '<circle cx="110" cy="120" r="62" fill="#f4a259"/>' + eyes() + '<path d="M104 128 h12 l-6 8 z" fill="#d1495b"/>' + smile(140)
            + '<path d="M60 130 h-26 M60 140 h-24 M160 130 h26 M160 140 h24" stroke="' + INK + '" stroke-width="3"/>'),
    'dog': ('#e3f2fd', '<ellipse cx="54" cy="104" rx="20" ry="40" fill="#8d5524"/><ellipse cx="166" cy="104" rx="20" ry="40" fill="#8d5524"/>'
            '<circle cx="110" cy="116" r="60" fill="#c68642"/><ellipse cx="110" cy="146" rx="30" ry="22" fill="#f1d3b3"/>' + eyes(106)
            + '<ellipse cx="110" cy="134" rx="11" ry="8" fill="' + INK + '"/>' + smile(152)),
    'rabbit': ('#fce4ec', '<ellipse cx="86" cy="54" rx="16" ry="44" fill="#f5f5f5" stroke="#d8d8d8" stroke-width="3"/><ellipse cx="134" cy="54" rx="16" ry="44" fill="#f5f5f5" stroke="#d8d8d8" stroke-width="3"/>'
               '<ellipse cx="86" cy="56" rx="7" ry="30" fill="#f8bbd0"/><ellipse cx="134" cy="56" rx="7" ry="30" fill="#f8bbd0"/>'
               '<circle cx="110" cy="132" r="56" fill="#f5f5f5" stroke="#d8d8d8" stroke-width="3"/>' + eyes(126, 22) + '<path d="M104 140 h12 l-6 7 z" fill="#f06292"/>' + smile(150)),
    'bear': ('#efebe9', '<circle cx="58" cy="66" r="24" fill="#6d4c41"/><circle cx="162" cy="66" r="24" fill="#6d4c41"/>'
             '<circle cx="110" cy="118" r="64" fill="#6d4c41"/><ellipse cx="110" cy="146" rx="30" ry="24" fill="#d7ccc8"/>' + eyes(108)
             + '<ellipse cx="110" cy="136" rx="10" ry="7" fill="' + INK + '"/>' + smile(152)),
    'fox': ('#fff3e0', '<path d="M46 60 L80 74 L58 110 Z M174 60 L140 74 L162 110 Z" fill="#e65100"/>'
            '<path d="M44 92 Q110 40 176 92 Q160 168 110 182 Q60 168 44 92 Z" fill="#ef6c00"/>'
            '<path d="M70 132 Q110 120 150 132 Q130 176 110 180 Q90 176 70 132 Z" fill="#ffffff"/>' + eyes(112, 28, 8)
            + '<ellipse cx="110" cy="164" rx="9" ry="6" fill="' + INK + '"/>'),
    'frog': ('#e8f5e9', '<circle cx="74" cy="70" r="26" fill="#66bb6a"/><circle cx="146" cy="70" r="26" fill="#66bb6a"/>'
             '<circle cx="74" cy="70" r="13" fill="#ffffff"/><circle cx="146" cy="70" r="13" fill="#ffffff"/>'
             '<circle cx="74" cy="72" r="7" fill="' + INK + '"/><circle cx="146" cy="72" r="7" fill="' + INK + '"/>'
             '<ellipse cx="110" cy="132" rx="72" ry="54" fill="#66bb6a"/>'
             '<path d="M70 138 q40 30 80 0" stroke="' + INK + '" stroke-width="5" fill="none" stroke-linecap="round"/>'
             '<circle cx="64" cy="128" r="9" fill="#f48fb1" opacity="0.8"/><circle cx="156" cy="128" r="9" fill="#f48fb1" opacity="0.8"/>'),
    'chick': ('#fffde7', '<path d="M110 50 q-8 -22 10 -30 q-4 16 8 26" fill="#ffd54f"/><circle cx="110" cy="122" r="66" fill="#ffd54f"/>'
              + eyes(112, 24) + '<path d="M96 128 L124 128 L110 146 Z" fill="#ff9800"/>'
              + '<ellipse cx="72" cy="138" rx="12" ry="7" fill="#ff8a80" opacity="0.7"/><ellipse cx="148" cy="138" rx="12" ry="7" fill="#ff8a80" opacity="0.7"/>'),
    'panda': ('#eceff1', '<circle cx="56" cy="62" r="24" fill="#212121"/><circle cx="164" cy="62" r="24" fill="#212121"/>'
              '<circle cx="110" cy="118" r="64" fill="#fafafa" stroke="#cfd8dc" stroke-width="3"/>'
              '<ellipse cx="82" cy="110" rx="18" ry="22" fill="#212121" transform="rotate(-20 82 110)"/><ellipse cx="138" cy="110" rx="18" ry="22" fill="#212121" transform="rotate(20 138 110)"/>'
              '<circle cx="84" cy="110" r="6" fill="#ffffff"/><circle cx="136" cy="110" r="6" fill="#ffffff"/>'
              '<ellipse cx="110" cy="138" rx="10" ry="7" fill="#212121"/>' + smile(150)),
}


def back():
    dots = ''.join('<circle cx="{0}" cy="{1}" r="7" fill="#ffffff" opacity="0.35"/>'.format(x, y) for x in range(40, 200, 36) for y in range(40, 200, 36))
    return tile('<rect x="20" y="20" width="180" height="180" rx="18" fill="#7e57c2"/>' + dots
                + '<path d="M110 72 L122 98 L150 100 L128 118 L136 146 L110 130 L84 146 L92 118 L70 100 L98 98 Z" fill="#ffd54f"/>', '#5e35b1')


def meadow(width=1920, height=1080):
    flowers = ''.join('<g transform="translate({0} {1})"><circle r="9" fill="{2}"/><circle r="4" fill="#fff59d"/></g>'.format(x, y, color)
                      for x, y, color in ((120, 900, '#f48fb1'), (300, 980, '#ffffff'), (1620, 940, '#f48fb1'), (1800, 1000, '#ce93d8'), (1500, 1020, '#ffffff'), (220, 1040, '#ce93d8')))
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 1920 1080">'
            '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#81d4fa"/><stop offset="1" stop-color="#e1f5fe"/></linearGradient></defs>'
            '<rect width="1920" height="1080" fill="url(#sky)"/>'
            '<path d="M0 700 Q480 600 960 700 T1920 680 V1080 H0 Z" fill="#9ccc65"/>'
            '<path d="M0 820 Q600 740 1200 820 T1920 800 V1080 H0 Z" fill="#7cb342"/>'
            '<circle cx="1700" cy="160" r="70" fill="#fff59d"/>'
            '<ellipse cx="300" cy="180" rx="110" ry="40" fill="#ffffff" opacity="0.9"/><ellipse cx="1150" cy="120" rx="90" ry="32" fill="#ffffff" opacity="0.9"/>'
            '{flowers}</svg>').format(w=width, h=height, flowers=flowers)


def cover():
    tiles = ''.join('<g transform="translate({0} {1}) scale(0.9)">{2}</g>'.format(x, y, tile(face, color)[tile(face, color).index('>') + 1:-len('</svg>')])
                    for (x, y), (face_name, (color, face)) in zip(((560, 360), (780, 360), (1000, 360)), [(name, ANIMALS[name]) for name in ('cat', 'panda', 'fox')]))
    title = '<text x="960" y="250" text-anchor="middle" font-family="Georgia, serif" font-size="160" font-weight="bold" fill="#5e35b1">Pairs</text>'
    return meadow(1600, 900).replace('</svg>', title + tiles + '</svg>')


def seconds(duration):
    return numpy.arange(int(RATE * duration)) / RATE


def envelope(time, attack, decay):
    return numpy.clip(time / attack, 0, 1) * numpy.exp(-numpy.maximum(time - attack, 0) / decay)


def note(frequency, duration, decay):
    time = seconds(duration)
    return (numpy.sin(2 * numpy.pi * frequency * time) + 0.3 * numpy.sin(4 * numpy.pi * frequency * time)) * envelope(time, 0.005, decay)


def mix(pieces):
    end = max(int(start * RATE) + len(samples) for start, samples in pieces)
    out = numpy.zeros(end)
    for start, samples in pieces:
        out[int(start * RATE):int(start * RATE) + len(samples)] += samples
    return out


def swish(generator):
    time = seconds(0.12)
    spectrum = numpy.fft.rfft(generator.standard_normal(len(time)))
    frequencies = numpy.fft.rfftfreq(len(time), 1 / RATE)
    spectrum[(frequencies < 2000) | (frequencies > 8000)] = 0
    return numpy.fft.irfft(spectrum, len(time)) * envelope(time, 0.01, 0.04)


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
    (folder / 'meadow.svg').write_text(meadow())
    (folder / 'cover.svg').write_text(cover())
    (folder / 'tile-back.svg').write_text(back())
    for name, (color, face) in ANIMALS.items():
        (folder / f'tile-{name}.svg').write_text(tile(face, color))
    generator = numpy.random.default_rng(5)
    write_sound(folder, 'turn', swish(generator), loudness=0.4)
    write_sound(folder, 'match', mix([(0.0, note(880, 0.25, 0.08)), (0.09, note(1318.5, 0.4, 0.15))]), loudness=0.45)
    write_sound(folder, 'miss', mix([(0.0, note(330, 0.25, 0.08)), (0.12, note(262, 0.35, 0.12))]), loudness=0.4)
    write_sound(folder, 'cheer', mix([(index * 0.1, note(frequency, 0.5, 0.2)) for index, frequency in enumerate((523.25, 659.25, 783.99, 1046.5))]), loudness=0.5)


main()
