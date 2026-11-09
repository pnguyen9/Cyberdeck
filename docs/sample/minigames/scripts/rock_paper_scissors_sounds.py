"""Makes the sounds of the rock, paper, scissors sample, from code alone: python3 rock_paper_scissors_sounds.py <folder>."""
import subprocess
import sys
import wave
from pathlib import Path

import numpy

RATE = 44100


def seconds(duration):
    return numpy.arange(int(RATE * duration)) / RATE


def envelope(time, attack, decay):
    """Rises in `attack` seconds, then fades exponentially, `decay` being the time to fall to a third."""
    rise = numpy.clip(time / attack, 0, 1)
    return rise * numpy.exp(-numpy.maximum(time - attack, 0) / decay)


def note(frequency, duration, decay=0.15, brightness=0.35):
    """A soft mallet-like tone: a sine with a few quieter harmonics."""
    time = seconds(duration)
    tone = numpy.sin(2 * numpy.pi * frequency * time)
    tone += brightness * numpy.sin(2 * numpy.pi * 2 * frequency * time)
    tone += brightness * 0.4 * numpy.sin(2 * numpy.pi * 3 * frequency * time)
    return tone * envelope(time, 0.004, decay)


def sequence(pieces):
    """Notes placed at their start times: (start, samples)."""
    length = max(int(start * RATE) + len(samples) for start, samples in pieces)
    out = numpy.zeros(length)
    for start, samples in pieces:
        offset = int(start * RATE)
        out[offset:offset + len(samples)] += samples
    return out


def noise_burst(duration, decay, low, high, generator):
    """Filtered noise: a click, a swish."""
    time = seconds(duration)
    spectrum = numpy.fft.rfft(generator.standard_normal(len(time)))
    frequencies = numpy.fft.rfftfreq(len(time), 1 / RATE)
    spectrum[(frequencies < low) | (frequencies > high)] = 0
    return numpy.fft.irfft(spectrum, len(time)) * envelope(time, 0.002, decay)


def write(folder, name, samples, loudness=0.6):
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
    generator = numpy.random.default_rng(7)
    C5, E5, G5, C6, A4, F4, D4 = 523.25, 659.25, 783.99, 1046.5, 440.0, 349.23, 293.66

    # A hand shaken: two soft swishes, then the hand landing.
    write(folder, 'pick', sequence([
        (0.00, noise_burst(0.12, 0.03, 1500, 6000, generator) * 0.5),
        (0.13, noise_burst(0.12, 0.03, 1500, 6000, generator) * 0.5),
        (0.26, noise_burst(0.08, 0.015, 200, 1500, generator)),
    ]), loudness=0.5)
    # Hands shown: a quick rising flourish.
    write(folder, 'reveal', sequence([(index * 0.05, note(frequency, 0.3, 0.08)) for index, frequency in enumerate([C5, E5, G5, C6])]), loudness=0.45)
    # A win: a bright arpeggio ending on a held chord.
    write(folder, 'win', sequence([
        (0.00, note(C5, 0.3, 0.1)), (0.09, note(E5, 0.3, 0.1)), (0.18, note(G5, 0.3, 0.1)),
        (0.27, note(C6, 0.9, 0.35)), (0.27, note(G5, 0.9, 0.35) * 0.5), (0.27, note(E5, 0.9, 0.35) * 0.4),
    ]), loudness=0.55)
    # A loss: two notes falling, the second low and soft.
    write(folder, 'lose', sequence([
        (0.00, note(A4, 0.4, 0.15, 0.2)), (0.22, note(F4, 0.5, 0.2, 0.2)), (0.44, note(D4, 0.9, 0.35, 0.15)),
    ]), loudness=0.5)
    # A draw: the same note twice, neither up nor down.
    write(folder, 'draw', sequence([(0.00, note(G5, 0.3, 0.1, 0.2)), (0.18, note(G5, 0.6, 0.2, 0.2))]), loudness=0.45)


main()
