"""Makes the pictures, sounds and music of the blackjack sample, from code alone: python3 blackjack_assets.py <folder>.

Cards are drawn with shapes only, ranks and suits included, so that they look the same on every computer.
Two sets of the same cards: `card-*` low on a tall picture, for the player's row; `dcard-*` high, for the
dealer's. Characters are shown standing on the bottom of the stage: where a card sits on its picture is
where it sits on the table.
"""
import subprocess
import sys
import wave
from pathlib import Path

import numpy

RATE = 44100
CARD_WIDTH, CARD_HEIGHT = 180, 252
RANKS = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king']
SUITS = ['spades', 'hearts', 'diamonds', 'clubs']
RED = '#c8102e'
BLACK = '#1b1b1f'

# Each rank's mark as strokes on a 10 × 14 grid: a font of a few lines, the same everywhere.
GLYPHS = {
    'ace': ['M1 14 L5 0 L9 14', 'M2.6 9 H7.4'],
    'two': ['M1 3 Q1 0 5 0 Q9 0 9 4 Q9 7 1 14 H9'],
    'three': ['M1 1 Q5 -1 8 2 Q9 6 4 7 Q9 8 8.5 11.5 Q6 15 1 13'],
    'four': ['M7 14 V0 L0 10 H10'],
    'five': ['M9 0 H2 L1 6 Q7 4 8.6 8 Q9 14 1 13'],
    'six': ['M8 1 Q3 -1 1.5 6 Q0 14 5 14 Q9 14 9 10 Q9 6 5 6 Q2 6 1.5 9'],
    'seven': ['M0 0 H10 L3 14'],
    'eight': ['M5 7 Q1 6 1.5 3 Q2 0 5 0 Q8 0 8.5 3 Q9 6 5 7 Q0 8 0.8 11.5 Q2 14 5 14 Q8 14 9.2 11.5 Q10 8 5 7'],
    'nine': ['M8.5 5 Q8 8 5 8 Q1 8 1 4 Q1 0 5 0 Q9 0 9 6 Q9 14 2 13'],
    'ten': ['M0 2 L2 0 V14', 'M7 0 Q4 0 4 7 Q4 14 7 14 Q10 14 10 7 Q10 0 7 0'],
    'jack': ['M3 0 H9', 'M7 0 V10 Q7 14 3.5 14 Q0.5 14 0.5 10.5'],
    'queen': ['M5 0 Q0 0 0 7 Q0 14 5 14 Q10 14 10 7 Q10 0 5 0', 'M6 9.5 L10 14.5'],
    'king': ['M1 0 V14', 'M9 0 L1 8', 'M3.5 5.5 L9 14'],
}
SHORT = {'ace': 'A', 'jack': 'J', 'queen': 'Q', 'king': 'K'}

# Each suit as a path on a 100 × 100 grid.
SUIT_PATHS = {
    'hearts': 'M50 92 C20 70 2 52 2 30 C2 13 15 2 29 2 C40 2 47 9 50 18 C53 9 60 2 71 2 C85 2 98 13 98 30 C98 52 80 70 50 92 Z',
    'diamonds': 'M50 2 L88 50 L50 98 L12 50 Z',
    'spades': 'M50 2 C35 25 2 42 2 63 C2 78 14 87 27 87 C37 87 44 82 47 76 C46 86 41 93 33 98 H67 C59 93 54 86 53 76 C56 82 63 87 73 87 C86 87 98 78 98 63 C98 42 65 25 50 2 Z',
    'clubs': 'M50 2 C38 2 30 11 30 22 C30 29 33 34 37 38 C33 36 29 35 25 35 C13 35 2 44 2 57 C2 70 13 79 25 79 C35 79 43 73 47 66 C46 80 41 90 33 98 H67 C59 90 54 80 53 66 C57 73 65 79 75 79 C87 79 98 70 98 57 C98 44 87 35 75 35 C71 35 67 36 63 38 C67 34 70 29 70 22 C70 11 62 2 50 2 Z',
}


def glyph(rank, x, y, size, color):
    """A rank's mark, `size` pixels high, its top left at x, y."""
    scale = size / 14
    strokes = ''.join('<path d="{0}"/>'.format(stroke) for stroke in GLYPHS[rank])
    return ('<g transform="translate({x} {y}) scale({s})" fill="none" stroke="{c}" stroke-width="{w}" '
            'stroke-linecap="round" stroke-linejoin="round">{strokes}</g>').format(x=x, y=y, s=scale, c=color, w=1.6, strokes=strokes)


def suit(name, x, y, size, color, flip=False):
    scale = size / 100
    turn = ' rotate(180 50 50)' if flip else ''
    return '<path transform="translate({x} {y}) scale({s}){t}" d="{d}" fill="{c}"/>'.format(x=x, y=y, s=scale, t=turn, d=SUIT_PATHS[name], c=color)


def face(rank, suit_name):
    """A card's face, CARD_WIDTH × CARD_HEIGHT: the rank and suit in two corners, a large suit in the middle, a letter for the court."""
    color = RED if suit_name in ('hearts', 'diamonds') else BLACK
    corner = glyph(rank, 12, 12, 26, color) + suit(suit_name, 13, 44, 20, color)
    corner_turned = '<g transform="rotate(180 {0} {1})">{2}</g>'.format(CARD_WIDTH / 2, CARD_HEIGHT / 2, corner)
    if rank in ('jack', 'queen', 'king'):
        middle = ('<rect x="38" y="52" width="104" height="148" rx="10" fill="none" stroke="{c}" stroke-width="3"/>'.format(c=color)
                  + glyph(rank, 66, 80, 64, color) + suit(suit_name, 72, 150, 36, color))
    elif rank == 'ace':
        middle = suit(suit_name, 45, 81, 90, color)
    else:
        middle = suit(suit_name, 55, 91, 70, color)
    return ('<rect x="1.5" y="1.5" width="{w}" height="{h}" rx="14" fill="#fffdf7" stroke="#bdb6a8" stroke-width="3"/>'
            '{corner}{turned}{middle}').format(w=CARD_WIDTH - 3, h=CARD_HEIGHT - 3, corner=corner, turned=corner_turned, middle=middle)


def back():
    return ('<rect x="1.5" y="1.5" width="{w}" height="{h}" rx="14" fill="#fffdf7" stroke="#bdb6a8" stroke-width="3"/>'
            '<rect x="12" y="12" width="{iw}" height="{ih}" rx="8" fill="#1d4f91"/>'
            '<path d="M12 12 L{x2} {y2} M{x2} 12 L12 {y2}" stroke="#2e6bc0" stroke-width="2"/>'
            '<g stroke="#5b8fd6" stroke-width="2" fill="none">'
            + ''.join('<path d="M{0} 12 L{1} {2}"/>'.format(12 + step, 12 + step + 228, 240) for step in range(-228, 156, 18))
            + '</g><circle cx="90" cy="126" r="30" fill="#1d4f91" stroke="#f2c94c" stroke-width="5"/>'
            '<path d="M90 106 L102 126 L90 146 L78 126 Z" fill="#f2c94c"/>').format(
        w=CARD_WIDTH - 3, h=CARD_HEIGHT - 3, iw=CARD_WIDTH - 24, ih=CARD_HEIGHT - 24, x2=CARD_WIDTH - 12, y2=CARD_HEIGHT - 12)


# The player's row stands with its cards' tops at y 410 of the stage, clear of the menu, the dealer's at y 90.
PLAYER_PICTURE_HEIGHT = 1080 - 410
DEALER_PICTURE_HEIGHT = 1080 - 90


def tall(card, height):
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
            '<rect x="6" y="8" width="{cw}" height="{ch}" rx="14" fill="#000" opacity="0.25"/>{card}</svg>').format(
        w=CARD_WIDTH + 8, h=height, cw=CARD_WIDTH, ch=CARD_HEIGHT, card=card)


def table():
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">'
        '<defs><radialGradient id="felt" cx="0.5" cy="0.35" r="0.75"><stop offset="0" stop-color="#2f8f5b"/><stop offset="1" stop-color="#14502f"/></radialGradient>'
        '<radialGradient id="wood" cx="0.5" cy="0" r="1"><stop offset="0" stop-color="#7a4a24"/><stop offset="1" stop-color="#3b2210"/></radialGradient></defs>'
        '<rect width="1920" height="1080" fill="url(#wood)"/>'
        '<path d="M0 0 H1920 V880 Q960 1040 0 880 Z" fill="url(#felt)"/>'
        '<path d="M0 880 Q960 1040 1920 880" stroke="#c9a14a" stroke-width="10" fill="none"/>'
        '<path d="M300 362 Q960 402 1620 362" stroke="#f2c94c" stroke-width="5" fill="none" opacity="0.8"/>'
        '<path d="M300 382 Q960 422 1620 382" stroke="#f2c94c" stroke-width="2" fill="none" opacity="0.6"/>'
        '<g fill="none" stroke="#f2c94c" stroke-width="3" opacity="0.55">'
        # Five places, 200 pixels apart, where the story deals the player's cards: 29.2 %, 39.6 %, 50 %, 60.4 %, 70.8 %.
        + ''.join('<rect x="{0}" y="406" width="196" height="264" rx="16"/>'.format(x) for x in (462, 662, 862, 1062, 1262))
        + '</g>'
        '<circle cx="1720" cy="250" r="70" fill="#c8102e" stroke="#fff" stroke-width="10" stroke-dasharray="22 14"/>'
        '<circle cx="1720" cy="250" r="44" fill="none" stroke="#fff" stroke-width="3"/>'
        '<circle cx="1700" cy="232" r="70" fill="#1d4f91" stroke="#fff" stroke-width="10" stroke-dasharray="22 14"/>'
        '<circle cx="1700" cy="232" r="44" fill="none" stroke="#fff" stroke-width="3"/>'
        '</svg>')


def cover():
    cards = ''.join(
        '<g transform="translate({x} {y}) rotate({r} 90 126)">{card}</g>'.format(x=x, y=y, r=r, card=face(rank, suit_name))
        for x, y, r, rank, suit_name in ((560, 300, -12, 'ace', 'spades'), (760, 280, 10, 'king', 'hearts')))
    svg = table().replace('width="1920" height="1080"', 'width="1600" height="900"')
    return svg.replace('</svg>', cards + '</svg>')


# Sounds: signals shaped by hand.

def seconds(duration):
    return numpy.arange(int(RATE * duration)) / RATE


def envelope(time, attack, decay):
    return numpy.clip(time / attack, 0, 1) * numpy.exp(-numpy.maximum(time - attack, 0) / decay)


def noise(duration, decay, low, high, generator):
    time = seconds(duration)
    spectrum = numpy.fft.rfft(generator.standard_normal(len(time)))
    frequencies = numpy.fft.rfftfreq(len(time), 1 / RATE)
    spectrum[(frequencies < low) | (frequencies > high)] = 0
    return numpy.fft.irfft(spectrum, len(time)) * envelope(time, 0.002, decay)


def ring(frequency, duration, decay):
    """A short ringing tone, a clay chip's click."""
    time = seconds(duration)
    return (numpy.sin(2 * numpy.pi * frequency * time) + 0.5 * numpy.sin(2 * numpy.pi * frequency * 2.7 * time)) * envelope(time, 0.001, decay)


def note(frequency, duration, decay, brightness=0.3):
    time = seconds(duration)
    tone = numpy.sin(2 * numpy.pi * frequency * time) + brightness * numpy.sin(4 * numpy.pi * frequency * time) + brightness * 0.3 * numpy.sin(6 * numpy.pi * frequency * time)
    return tone * envelope(time, 0.005, decay)


def mix(pieces, length=None):
    end = max(int(start * RATE) + len(samples) for start, samples in pieces)
    out = numpy.zeros(max(end, int((length or 0) * RATE)))
    for start, samples in pieces:
        offset = int(start * RATE)
        out[offset:offset + len(samples)] += samples
    return out


def write_sound(folder, name, samples, loudness=0.5, loop_length=None):
    if loop_length is not None:
        # A loop folds what rings past its end back onto its start, so that it joins without a gap.
        frames = int(loop_length * RATE)
        folded = samples[:frames].copy()
        tail = samples[frames:]
        folded[:len(tail)] += tail[:frames]
        samples = folded
    samples = samples / numpy.max(numpy.abs(samples)) * loudness
    if loop_length is None:
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


def lounge(generator):
    """Eight bars of soft lounge jazz at 96 beats a minute: piano chords on the off-beats, a walking bass, brushes."""
    beat = 60 / 96
    hz = lambda midi: 440 * 2 ** ((midi - 69) / 12)
    # ii–V–I–vi in C, twice: Dm7, G7, Cmaj7, A7.
    chords = [[62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71], [57, 61, 64, 67]] * 2
    walks = [[38, 41, 45, 43], [43, 47, 50, 49], [48, 52, 55, 52], [45, 49, 52, 50]] * 2
    pieces = []
    for bar, (chord, walk) in enumerate(zip(chords, walks)):
        start = bar * 4 * beat
        for index, midi in enumerate(walk):
            pieces.append((start + index * beat, note(hz(midi), beat * 1.1, 0.35, 0.15) * 0.9))
        for offbeat in (1.66, 3.66):
            pieces += [(start + offbeat * beat, note(hz(midi), beat * 1.2, 0.5, 0.35) * 0.28) for midi in chord]
        for index in range(4):
            pieces.append((start + index * beat, noise(0.18, 0.06, 2000, 9000, generator) * 0.25))
            pieces.append((start + (index + 0.66) * beat, noise(0.1, 0.03, 3000, 9000, generator) * 0.15))
    return mix(pieces), 8 * 4 * beat


def main():
    folder = Path(sys.argv[1])
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'table.svg').write_text(table())
    (folder / 'cover.svg').write_text(cover())
    for lender, height in (('card', PLAYER_PICTURE_HEIGHT), ('dcard', DEALER_PICTURE_HEIGHT)):
        for rank in RANKS:
            for suit_name in SUITS:
                (folder / f'{lender}-{rank}-{suit_name}.svg').write_text(tall(face(rank, suit_name), height))
        # Only the dealer's hidden card is ever face down: `flip` turns it over.
        if lender == 'dcard':
            (folder / f'{lender}-back.svg').write_text(tall(back(), height))
    generator = numpy.random.default_rng(21)
    write_sound(folder, 'chips', mix([(index * 0.07, ring(2600 + index * 230, 0.12, 0.03)) for index in range(4)]), loudness=0.45)
    write_sound(folder, 'deal', noise(0.22, 0.07, 1200, 7000, generator), loudness=0.4)
    write_sound(folder, 'flip', mix([(0.0, noise(0.06, 0.02, 2500, 8000, generator)), (0.07, noise(0.08, 0.03, 1500, 6000, generator))]), loudness=0.4)
    write_sound(folder, 'shuffle', mix([(index * 0.045, noise(0.06, 0.02, 1500 + index * 40, 7000, generator)) for index in range(22)]), loudness=0.4)
    write_sound(folder, 'win', mix([(0.0, note(523.25, 0.3, 0.1)), (0.1, note(659.25, 0.3, 0.1)), (0.2, note(783.99, 0.8, 0.3)), (0.2, note(1046.5, 0.8, 0.3) * 0.5)]), loudness=0.5)
    write_sound(folder, 'lose', mix([(0.0, note(392.0, 0.4, 0.15, 0.2)), (0.25, note(311.13, 0.9, 0.35, 0.15))]), loudness=0.45)
    music, length = lounge(generator)
    write_sound(folder, 'lounge', music, loudness=0.4, loop_length=length)


main()
