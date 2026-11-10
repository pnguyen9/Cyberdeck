"""Makes the pictures and sounds of the Minesweeper sample, from code alone: python3 minesweeper_assets.py <folder>.

Tiles for the grid, `tile-hidden.svg`, `tile-0.svg` (opened, nothing near) to `tile-8.svg`, `tile-mine.svg` and
`tile-boom.svg` (the mine opened), numbers drawn as strokes so that they look the same everywhere; a
background, a cover, and three sounds.
"""
import subprocess
import sys
import wave
from pathlib import Path

import numpy

RATE = 44100
# The colours numbers have had since the first Minesweeper.
NUMBER_COLORS = {1: '#1565c0', 2: '#2e7d32', 3: '#c62828', 4: '#283593', 5: '#6d1b1b', 6: '#00838f', 7: '#212121', 8: '#616161'}
# Each digit as strokes on a 10 × 14 grid.
DIGITS = {
    1: ['M3 3 L6 0 V14', 'M2.5 14 H9.5'],
    2: ['M1 3 Q1 0 5 0 Q9 0 9 4 Q9 7 1 14 H9'],
    3: ['M1 1 Q5 -1 8 2 Q9 6 4 7 Q9 8 8.5 11.5 Q6 15 1 13'],
    4: ['M7 14 V0 L0 10 H10'],
    5: ['M9 0 H2 L1 6 Q7 4 8.6 8 Q9 14 1 13'],
    6: ['M8 1 Q3 -1 1.5 6 Q0 14 5 14 Q9 14 9 10 Q9 6 5 6 Q2 6 1.5 9'],
    7: ['M0 0 H10 L3 14'],
    8: ['M5 7 Q1 6 1.5 3 Q2 0 5 0 Q8 0 8.5 3 Q9 6 5 7 Q0 8 0.8 11.5 Q2 14 5 14 Q8 14 9.2 11.5 Q10 8 5 7'],
}


def svg(content):
    return '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">{0}</svg>'.format(content)


def opened(content=''):
    return svg('<rect width="96" height="96" fill="#d6d9de"/><rect x="0.5" y="0.5" width="95" height="95" fill="none" stroke="#9aa1ab" stroke-width="2"/>' + content)


def hidden():
    return svg('<rect width="96" height="96" fill="#b8c0cc"/>'
               '<path d="M0 0 H96 L84 12 H12 V84 L0 96 Z" fill="#eef1f5"/>'
               '<path d="M96 96 H0 L12 84 H84 V12 L96 0 Z" fill="#7d8796"/>'
               '<rect x="12" y="12" width="72" height="72" fill="#b8c0cc"/>')


def number(value):
    strokes = ''.join('<path d="{0}"/>'.format(stroke) for stroke in DIGITS[value])
    return opened('<g transform="translate(30 18) scale(3.6)" fill="none" stroke="{0}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">{1}</g>'.format(NUMBER_COLORS[value], strokes))


def mine(background):
    spikes = ''.join('<path d="M48 48 L{0:.1f} {1:.1f}" stroke="#111" stroke-width="7" stroke-linecap="round"/>'.format(48 + 34 * numpy.cos(angle), 48 + 34 * numpy.sin(angle)) for angle in numpy.linspace(0, 2 * numpy.pi, 8, endpoint=False))
    return svg('<rect width="96" height="96" fill="{0}"/><rect x="0.5" y="0.5" width="95" height="95" fill="none" stroke="#9aa1ab" stroke-width="2"/>'.format(background)
               + spikes + '<circle cx="48" cy="48" r="22" fill="#111"/><circle cx="40" cy="40" r="6" fill="#fff" opacity="0.8"/>')


def background(width=1920, height=1080):
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 1920 1080">'
            '<defs><linearGradient id="field" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26313f"/><stop offset="1" stop-color="#11161e"/></linearGradient></defs>'
            '<rect width="1920" height="1080" fill="url(#field)"/>'
            + ''.join('<path d="M{0} 0 V1080" stroke="#ffffff" stroke-opacity="0.03" stroke-width="2"/>'.format(x) for x in range(0, 1920, 64))
            + ''.join('<path d="M0 {0} H1920" stroke="#ffffff" stroke-opacity="0.03" stroke-width="2"/>'.format(y) for y in range(0, 1080, 64))
            + '</svg>').format(w=width, h=height)


def cover():
    tiles = [hidden(), number(1), number(2), mine('#d6d9de'), number(3), hidden(), number(1), hidden(), number(1)]
    placed = ''.join('<g transform="translate({0} {1}) scale(1.4)">{2}</g>'.format(1000 + (index % 3) * 140, 260 + (index // 3) * 140, tile[tile.index('>') + 1:-len('</svg>')])
                     for index, tile in enumerate(tiles))
    title = '<text x="520" y="480" text-anchor="middle" font-family="Georgia, serif" font-size="120" font-weight="bold" fill="#e6e9ef">Minesweeper</text>'
    return background(1600, 900).replace('</svg>', title + placed + '</svg>')


def seconds(duration):
    return numpy.arange(int(RATE * duration)) / RATE


def envelope(time, attack, decay):
    return numpy.clip(time / attack, 0, 1) * numpy.exp(-numpy.maximum(time - attack, 0) / decay)


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
    (folder / 'field.svg').write_text(background())
    (folder / 'cover.svg').write_text(cover())
    (folder / 'tile-hidden.svg').write_text(hidden())
    (folder / 'tile-0.svg').write_text(opened())
    for value in range(1, 9):
        (folder / f'tile-{value}.svg').write_text(number(value))
    (folder / 'tile-mine.svg').write_text(mine('#d6d9de'))
    (folder / 'tile-boom.svg').write_text(mine('#e53935'))
    generator = numpy.random.default_rng(9)
    time = seconds(0.08)
    write_sound(folder, 'click', numpy.sin(2 * numpy.pi * 1800 * time) * envelope(time, 0.001, 0.012), loudness=0.35)
    time = seconds(1.2)
    rumble = numpy.convolve(generator.standard_normal(len(time)), numpy.ones(40) / 40, mode='same')
    write_sound(folder, 'boom', rumble * envelope(time, 0.005, 0.35), loudness=0.6)
    time = seconds(0.9)
    write_sound(folder, 'cleared', sum(numpy.sin(2 * numpy.pi * frequency * time) * envelope(time - start, 0.01, 0.25) * (time >= start)
                                       for start, frequency in ((0.0, 523.25), (0.1, 659.25), (0.2, 783.99), (0.3, 1046.5))), loudness=0.5)


main()
