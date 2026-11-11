"""Makes the pictures, sounds and music of the battle sample, from code alone: python3 battle_assets.py <folder>."""
import subprocess
import sys
import wave
from pathlib import Path

import numpy

RATE = 44100
INK = '#2b2233'

# Each creature is drawn facing right, its feet on the line FEET_Y of a 640-wide picture. Below the
# feet the picture is empty: yours stands above the text box, the foe's higher still, far off.
WIDTH = 640
FEET_Y = 470
OWN_SPACE_BELOW = 320
FOE_SPACE_BELOW = 960

POSES = ('normal', 'attack', 'hurt', 'guard', 'fainted')


def eyes(across, down, pose, color=INK):
    """The eyes of a creature looking right, at (across, down), as each pose has them."""
    if pose == 'hurt':
        return (f'<path d="M{across - 26} {down - 10} l18 10 l-18 10" stroke="{color}" stroke-width="8" fill="none" stroke-linecap="round"/>'
                f'<path d="M{across + 30} {down - 10} l-18 10 l18 10" stroke="{color}" stroke-width="8" fill="none" stroke-linecap="round"/>')
    if pose == 'fainted':
        cross = 'stroke="{0}" stroke-width="8" stroke-linecap="round"'.format(color)
        return (f'<path d="M{across - 26} {down - 10} l20 20 M{across - 6} {down - 10} l-20 20" {cross}/>'
                f'<path d="M{across + 12} {down - 10} l20 20 M{across + 32} {down - 10} l-20 20" {cross}/>')
    if pose == 'attack':
        return (f'<path d="M{across - 30} {down - 18} l26 10" stroke="{color}" stroke-width="7" stroke-linecap="round"/>'
                f'<path d="M{across + 10} {down - 8} l26 -10" stroke="{color}" stroke-width="7" stroke-linecap="round"/>'
                f'<circle cx="{across - 14}" cy="{down + 2}" r="11" fill="{color}"/><circle cx="{across + 24}" cy="{down + 2}" r="11" fill="{color}"/>')
    shine = '<circle cx="{0}" cy="{1}" r="4" fill="#fff"/>'
    return (f'<circle cx="{across - 14}" cy="{down}" r="13" fill="{color}"/><circle cx="{across + 24}" cy="{down}" r="13" fill="{color}"/>'
            + shine.format(across - 10, down - 5) + shine.format(across + 28, down - 5))


def pyrrup(pose):
    """The ember fox: orange, a flame for a tail."""
    return (
        '<path d="M150 330 q-120 -40 -110 -170 q40 60 70 40 q-10 -70 40 -110 q0 80 60 120 q20 60 -60 120 z" fill="#ff7a2f" stroke="#c8461a" stroke-width="6"/>'
        '<path d="M140 300 q-70 -40 -60 -120 q40 50 60 30 q0 -40 30 -60 q0 60 30 90 z" fill="#ffd35c"/>'
        '<ellipse cx="300" cy="350" rx="150" ry="100" fill="#ff8a3d" stroke="#c8461a" stroke-width="7"/>'
        '<ellipse cx="320" cy="380" rx="80" ry="55" fill="#fff1df"/>'
        '<rect x="200" y="410" width="34" height="60" rx="14" fill="#ff8a3d" stroke="#c8461a" stroke-width="6"/>'
        '<rect x="370" y="410" width="34" height="60" rx="14" fill="#ff8a3d" stroke="#c8461a" stroke-width="6"/>'
        '<path d="M380 150 l20 -90 l40 80 z M470 160 l40 -80 l14 96 z" fill="#ff8a3d" stroke="#c8461a" stroke-width="6" stroke-linejoin="round"/>'
        '<ellipse cx="450" cy="230" rx="110" ry="90" fill="#ff8a3d" stroke="#c8461a" stroke-width="7"/>'
        '<path d="M520 250 q60 0 70 20 q-10 24 -70 24 z" fill="#fff1df" stroke="#c8461a" stroke-width="5"/>'
        '<circle cx="588" cy="266" r="9" fill="' + INK + '"/>'
        + eyes(470, 215, pose)
    )


def fernling(pose):
    """The moss turtle: a green shell, a sprout on top."""
    return (
        '<rect x="180" y="400" width="50" height="70" rx="20" fill="#8fbf5a" stroke="#4e7a2a" stroke-width="6"/>'
        '<rect x="380" y="400" width="50" height="70" rx="20" fill="#8fbf5a" stroke="#4e7a2a" stroke-width="6"/>'
        '<path d="M110 410 q10 -250 210 -260 q200 10 210 260 z" fill="#4f9a45" stroke="#2f6a2a" stroke-width="8"/>'
        '<path d="M200 400 q20 -140 120 -160 q100 20 120 160 M320 240 v160 M250 320 h140" stroke="#2f6a2a" stroke-width="6" fill="none"/>'
        '<path d="M300 150 q-10 -60 -60 -80 q50 0 66 50 q10 -60 70 -70 q-40 30 -60 100 z" fill="#7ed957" stroke="#2f6a2a" stroke-width="5"/>'
        '<path d="M100 410 h440" stroke="#2f6a2a" stroke-width="10" stroke-linecap="round"/>'
        '<ellipse cx="540" cy="330" rx="80" ry="66" fill="#8fbf5a" stroke="#4e7a2a" stroke-width="7"/>'
        '<path d="M570 360 q20 6 34 -4" stroke="' + INK + '" stroke-width="6" fill="none" stroke-linecap="round"/>'
        + eyes(550, 315, pose)
    )


def ripplet(pose):
    """The river axolotl: pale blue, pink frills, a finned tail."""
    return (
        '<g transform="translate(-30 0)">'
        '<path d="M190 360 q-140 -10 -170 -90 q90 10 170 40 z" fill="#9fd8f5" stroke="#4d8fb8" stroke-width="6"/>'
        '<ellipse cx="300" cy="370" rx="160" ry="85" fill="#a8e0fb" stroke="#4d8fb8" stroke-width="7"/>'
        '<path d="M200 300 q100 -40 200 0" stroke="#4d8fb8" stroke-width="5" fill="none" stroke-dasharray="16 14"/>'
        '<rect x="200" y="420" width="34" height="50" rx="14" fill="#a8e0fb" stroke="#4d8fb8" stroke-width="6"/>'
        '<rect x="370" y="420" width="34" height="50" rx="14" fill="#a8e0fb" stroke="#4d8fb8" stroke-width="6"/>'
        '<path d="M410 190 q-50 -40 -40 -90 q30 30 54 50 M420 220 q-70 -10 -90 -50 q40 10 76 20 M430 250 q-70 20 -100 0 q40 -10 84 -16" stroke="#ff8fb8" stroke-width="16" fill="none" stroke-linecap="round"/>'
        '<path d="M540 190 q30 -40 20 -90 q-26 30 -44 50 M540 220 q60 -10 80 -50 q-36 10 -70 20" stroke="#ff8fb8" stroke-width="16" fill="none" stroke-linecap="round"/>'
        '<ellipse cx="480" cy="260" rx="110" ry="88" fill="#a8e0fb" stroke="#4d8fb8" stroke-width="7"/>'
        '<path d="M520 300 q30 16 60 0" stroke="' + INK + '" stroke-width="6" fill="none" stroke-linecap="round"/>'
        '<circle cx="456" cy="296" r="12" fill="#ff8fb8" opacity="0.6"/>'
        + eyes(500, 245, pose)
        + '</g>'
    )


def posed(body, pose):
    """The pose around the creature: leaning in to attack, knocked back, behind a shield, lying down."""
    shadow = f'<ellipse cx="320" cy="{FEET_Y}" rx="230" ry="26" fill="#000" opacity="0.2"/>'
    if pose == 'attack':
        return (shadow + f'<g transform="translate(36 0) rotate(6 320 {FEET_Y})">{body}</g>'
                '<path d="M20 230 h90 M0 290 h110 M30 350 h80" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity="0.8"/>')
    if pose == 'hurt':
        return (shadow + f'<g transform="translate(-40 0) rotate(-10 320 {FEET_Y})">{body}</g>'
                '<path d="M560 90 l14 30 l30 -14 l-14 30 l30 14 l-30 14 l14 30 l-30 -14 l-14 30 l-14 -30 l-30 14 l14 -30 l-30 -14 l30 -14 l-14 -30 l30 14 z" fill="#fff36b" stroke="#e0a800" stroke-width="4"/>')
    if pose == 'guard':
        return (shadow + body
                + f'<ellipse cx="330" cy="300" rx="300" ry="200" fill="#bfe8ff" opacity="0.35" stroke="#ffffff" stroke-width="10"/>')
    if pose == 'fainted':
        # Flattened on the ground and tipped over, as if it had sat down hard.
        return (f'<ellipse cx="320" cy="{FEET_Y}" rx="260" ry="22" fill="#000" opacity="0.2"/>'
                f'<g transform="translate(0 {FEET_Y}) scale(1.05 0.55) translate(0 -{FEET_Y}) rotate(-14 320 {FEET_Y})" opacity="0.85">{body}</g>')
    return shadow + body


def creature(draw, pose, space_below):
    height = FEET_Y + 20 + space_below
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{height}" viewBox="0 0 {WIDTH} {height}">'
            f'<g transform="translate(320 {FEET_Y}) scale(0.88) translate(-320 -{FEET_Y})">{posed(draw(pose), pose)}</g></svg>')


def arena():
    """Sky, hills, and the trodden ground of the arena: a near ring and a far one."""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">'
        '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#e3f4ff"/></linearGradient>'
        '<linearGradient id="grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ad46a"/><stop offset="1" stop-color="#5fa34a"/></linearGradient></defs>'
        '<rect width="1920" height="1080" fill="url(#sky)"/>'
        '<circle cx="1650" cy="150" r="70" fill="#fff6c2"/>'
        '<ellipse cx="380" cy="160" rx="140" ry="40" fill="#fff" opacity="0.85"/><ellipse cx="470" cy="140" rx="90" ry="40" fill="#fff" opacity="0.85"/>'
        '<path d="M0 350 q300 -120 620 -20 q340 -140 700 -10 q300 -80 600 10 v120 h-1920 z" fill="#7fb7a0"/>'
        '<rect y="360" width="1920" height="720" fill="url(#grass)"/>'
        '<path d="M0 400 h1920" stroke="#7cae58" stroke-width="6"/>'
        + ''.join(f'<rect x="{post}" y="310" width="14" height="70" fill="#8b6a48"/><rect x="{post - 30}" y="320" width="74" height="10" fill="#a07c55"/>' for post in range(80, 1920, 220))
        + '<ellipse cx="1560" cy="588" rx="250" ry="46" fill="#d8c79a" stroke="#b7a170" stroke-width="8"/>'
        '<ellipse cx="400" cy="665" rx="380" ry="80" fill="#d8c79a" stroke="#b7a170" stroke-width="8"/>'
        + '</svg>'
    )


def cover():
    """The three creatures together, for the game's card in the library."""
    pieces = [(pyrrup, 120, 260), (fernling, 680, 300), (ripplet, 1220, 260)]
    drawn = ''.join(f'<g transform="translate({left} {top}) scale(0.95)">{posed(draw("normal"), "normal")}</g>' for draw, left, top in pieces)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">'
        '<defs><linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a6b"/><stop offset="1" stop-color="#ff9a6b"/></linearGradient></defs>'
        '<rect width="1920" height="1080" fill="url(#dusk)"/>'
        '<ellipse cx="960" cy="900" rx="900" ry="140" fill="#d8c79a" opacity="0.9"/>'
        + drawn
        + '<text x="960" y="200" text-anchor="middle" font-family="Georgia, serif" font-size="140" font-weight="bold" fill="#fff6e0" stroke="#3a2a6b" stroke-width="6" paint-order="stroke">Arena</text>'
        '</svg>'
    )


def seconds(duration):
    return numpy.arange(int(RATE * duration)) / RATE


def envelope(time, attack, decay):
    return numpy.clip(time / attack, 0, 1) * numpy.exp(-numpy.maximum(time - attack, 0) / decay)


def tone(frequency, duration, decay, harmonics=(1, 0.3, 0.12)):
    time = seconds(duration)
    wave_ = sum(weight * numpy.sin(2 * numpy.pi * frequency * (index + 1) * time) for index, weight in enumerate(harmonics))
    return wave_ * envelope(time, 0.005, decay)


def glide(start, end, duration, decay):
    time = seconds(duration)
    frequency = numpy.linspace(start, end, len(time))
    phase = 2 * numpy.pi * numpy.cumsum(frequency) / RATE
    return (numpy.sin(phase) + 0.3 * numpy.sin(2 * phase)) * envelope(time, 0.005, decay)


def noise(duration, low, high, decay, generator):
    time = seconds(duration)
    spectrum = numpy.fft.rfft(generator.standard_normal(len(time)))
    frequencies = numpy.fft.rfftfreq(len(time), 1 / RATE)
    spectrum[(frequencies < low) | (frequencies > high)] = 0
    return numpy.fft.irfft(spectrum, len(time)) * envelope(time, 0.003, decay)


def sequence(pieces):
    length = max(int(start * RATE) + len(samples) for start, samples in pieces)
    out = numpy.zeros(length)
    for start, samples in pieces:
        offset = int(start * RATE)
        out[offset:offset + len(samples)] += samples
    return out


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


def battle_music():
    """Eight bars that loop: a bass on the beat, an arpeggio above it, in A minor, at 150 beats a minute."""
    beat = 60 / 150
    chords = [(220.0, (440.0, 523.25, 659.25)), (174.61, (349.23, 440.0, 523.25)), (196.0, (392.0, 493.88, 587.33)), (164.81, (329.63, 415.30, 493.88))]
    pieces = []
    for bar in range(8):
        bass, notes = chords[bar % 4]
        start = bar * 4 * beat
        for step in range(4):
            pieces.append((start + step * beat, tone(bass, beat * 0.9, 0.18, (1, 0.5, 0.25))))
        for step in range(8):
            pieces.append((start + step * beat / 2, 0.45 * tone(notes[step % 3] * (2 if step >= 6 else 1), beat * 0.45, 0.08, (1, 0.2))))
    length = int(8 * 4 * beat * RATE)
    return sequence(pieces)[:length]


def main():
    folder = Path(sys.argv[1])
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'arena.svg').write_text(arena())
    (folder / 'cover.svg').write_text(cover())
    for name, draw in (('pyrrup', pyrrup), ('fernling', fernling), ('ripplet', ripplet)):
        for pose in POSES:
            suffix = '' if pose == 'normal' else f'-{pose}'
            (folder / f'{name}{suffix}.svg').write_text(creature(draw, pose, OWN_SPACE_BELOW))
            (folder / f'rival-{name}{suffix}.svg').write_text(creature(draw, pose, FOE_SPACE_BELOW))
    generator = numpy.random.default_rng(23)
    write_sound(folder, 'strike', sequence([(0.0, noise(0.12, 200, 2500, 0.04, generator)), (0.0, tone(110, 0.15, 0.05))]), loudness=0.55)
    write_sound(folder, 'ember', sequence([(0.0, noise(0.6, 300, 4000, 0.25, generator)), (0.0, glide(300, 900, 0.5, 0.3))]), loudness=0.5)
    write_sound(folder, 'lash', sequence([(0.0, noise(0.25, 2000, 8000, 0.08, generator)), (0.18, noise(0.2, 2000, 8000, 0.06, generator))]), loudness=0.5)
    write_sound(folder, 'tide', sequence([(0.0, noise(0.9, 100, 1200, 0.4, generator)), (0.1, glide(500, 250, 0.7, 0.35))]), loudness=0.5)
    write_sound(folder, 'guard', sequence([(0.0, tone(880, 0.5, 0.25, (1, 0.6, 0.4, 0.2))), (0.0, tone(1320, 0.4, 0.2))]), loudness=0.45)
    write_sound(folder, 'heal', sequence([(index * 0.09, tone(frequency, 0.3, 0.15)) for index, frequency in enumerate((659.25, 783.99, 987.77, 1318.51))]), loudness=0.45)
    write_sound(folder, 'faint', glide(600, 120, 0.9, 0.5), loudness=0.45)
    write_sound(folder, 'win', sequence([(index * 0.14, tone(frequency, 0.5 if index == 3 else 0.2, 0.2)) for index, frequency in enumerate((523.25, 659.25, 783.99, 1046.5))]), loudness=0.5)
    write_sound(folder, 'lose', sequence([(index * 0.22, tone(frequency, 0.4, 0.25)) for index, frequency in enumerate((392.0, 369.99, 349.23, 293.66))]), loudness=0.45)
    write_sound(folder, 'battle', battle_music(), loudness=0.4)


main()
