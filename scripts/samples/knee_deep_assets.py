"""Makes the pictures and sounds of Knee-Deep, from code alone: python3 knee_deep_assets.py <folder> [--png name…].

The style is the glossy, rounded mascot look of 2000s desktop software: soft gradients, a white shine on
every round thing, chubby shapes facing the viewer, dark outlines only where shapes meet. Pictures are
written as SVG, which the stage draws sharp at any size; --png also renders the named ones through
Chromium, to look at them.
"""
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy

INK = '#2a2230'

# Sprites are 600 wide; feet on FEET_Y. The empty space below lifts them above the text box.
SPRITE_W = 600
FEET_Y = 860
SPACE_BELOW = 360


# ------------------------------------------------------------------------------------- helpers

class Defs:
    """Gradients of one picture, each named once."""

    def __init__(self):
        self.items = {}

    def radial(self, name, light, dark, cx=0.35, cy=0.3, r=0.75):
        self.items[name] = (f'<radialGradient id="{name}" cx="{cx}" cy="{cy}" r="{r}">'
                            f'<stop offset="0" stop-color="{light}"/><stop offset="1" stop-color="{dark}"/></radialGradient>')
        return f'url(#{name})'

    def linear(self, name, top, bottom, x2=0, y2=1):
        self.items[name] = (f'<linearGradient id="{name}" x1="0" y1="0" x2="{x2}" y2="{y2}">'
                            f'<stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bottom}"/></linearGradient>')
        return f'url(#{name})'

    def svg(self):
        return '<defs>' + ''.join(self.items.values()) + '</defs>'


def shine(cx, cy, rx, ry, rotate=-25, opacity=0.75):
    """The white gloss on a round thing."""
    return (f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#fff" opacity="{opacity}" '
            f'transform="rotate({rotate} {cx} {cy})"/>')


def picture(width, height, body, defs):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
            f'{defs.svg()}{body}</svg>')


def sprite(body, defs, width=SPRITE_W):
    return picture(width, FEET_Y + 30 + SPACE_BELOW, body, defs)


def shadow(cx=300, rx=190):
    return f'<ellipse cx="{cx}" cy="{FEET_Y}" rx="{rx}" ry="26" fill="#000" opacity="0.22"/>'


def mascot_eyes(left, right, top, pose, size=1.0):
    """Two tall white ovals with black pupils: the mascot's eyes, by pose."""
    w, h = 26 * size, 36 * size
    out = ''
    for index, cx in enumerate((left, right)):
        inward = 1 if index == 0 else -1
        if pose in ('hurt',):
            out += (f'<path d="M{cx - w} {top - 10} l{w * 1.6 * inward if inward > 0 else w * 1.6} 12 '
                    f'l{-w * 1.6 if inward > 0 else -w * 1.6} 12" stroke="{INK}" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round" '
                    f'transform="{"" if inward > 0 else f"translate({2 * cx} 0) scale(-1 1)"}"/>')
            continue
        if pose == 'ko':
            out += (f'<path d="M{cx - 18} {top - 16} l36 32 M{cx + 18} {top - 16} l-36 32" stroke="{INK}" stroke-width="9" stroke-linecap="round"/>')
            continue
        if pose == 'happy':
            out += f'<path d="M{cx - 22} {top + 6} q22 -30 44 0" stroke="{INK}" stroke-width="9" fill="none" stroke-linecap="round"/>'
            continue
        scale = 1.25 if pose == 'scared' else 1
        out += (f'<ellipse cx="{cx}" cy="{top}" rx="{w * scale}" ry="{h * scale}" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        pupil_dx = {'think': 8 * -inward + 6, 'attack': 6 * inward}.get(pose, 5 * inward)
        pupil_dy = {'think': -12}.get(pose, 4)
        pr = 9 if pose == 'scared' else 13 * size
        out += f'<ellipse cx="{cx + pupil_dx}" cy="{top + pupil_dy}" rx="{pr}" ry="{pr * 1.2}" fill="{INK}"/>'
        out += f'<circle cx="{cx + pupil_dx + 4}" cy="{top + pupil_dy - 6}" r="{4 * size}" fill="#fff"/>'
        if pose == 'attack':
            out += (f'<path d="M{cx - 34 * inward} {top - 44} L{cx + 26 * inward} {top - 26}" stroke="{INK}" stroke-width="11" stroke-linecap="round"/>')
        elif pose == 'think':
            lift = -54 if index == 0 else -40
            out += f'<path d="M{cx - 24} {top + lift + 6} q24 -14 48 0" stroke="{INK}" stroke-width="9" fill="none" stroke-linecap="round"/>'
    return out


# ------------------------------------------------------------------------------------- the dwarf

DWARF_POSES = ('normal', 'attack', 'hurt', 'happy', 'think', 'scared', 'drink', 'ko')


def axe(defs, x, y, angle, scale=1.0):
    """A stubby hand axe, its grip at (x, y), turned by angle."""
    blade = defs.linear('blade', '#f4f7fb', '#8e9aab', 1, 1)
    return (f'<g transform="translate({x} {y}) rotate({angle}) scale({scale})">'
            f'<rect x="-9" y="-170" width="18" height="200" rx="9" fill="#8a5a33" stroke="{INK}" stroke-width="4"/>'
            f'<path d="M0 -165 q70 -30 92 -10 q14 40 0 80 q-22 20 -92 -10 z" fill="{blade}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
            f'<path d="M78 -168 q14 40 0 80" stroke="#fff" stroke-width="6" fill="none" opacity="0.8"/>'
            '</g>')


def potion_bottle(x, y, color='#ff4f7a', scale=1.0):
    return (f'<g transform="translate({x} {y}) scale({scale})">'
            f'<rect x="-12" y="-74" width="24" height="26" rx="4" fill="#c8a07a" stroke="{INK}" stroke-width="4"/>'
            f'<path d="M-14 -50 h28 v12 q30 14 30 44 a44 44 0 0 1 -88 0 q0 -30 30 -44 z" fill="#e8f4ff" stroke="{INK}" stroke-width="5" opacity="0.95"/>'
            f'<path d="M-38 6 a38 34 0 0 0 76 0 q-38 -14 -76 0 z" fill="{color}"/>'
            + shine(-18, -12, 7, 14, 20, 0.85) + '</g>')


def dwarf(pose):
    d = Defs()
    tunic = d.radial('tunic', '#6fb3ff', '#1f4f9a')
    skin = d.radial('skin', '#ffe2c6', '#e59a6e', 0.4, 0.35)
    beard = d.radial('beard', '#ffb35a', '#b8471d', 0.4, 0.25, 0.85)
    helm = d.radial('helm', '#ffffff', '#6d7889', 0.35, 0.25, 0.9)
    boot = d.radial('boot', '#a8754a', '#4b2c18', 0.35, 0.3)
    nose = d.radial('nose', '#ffb0a0', '#d9534f', 0.35, 0.3)
    gold = d.radial('gold', '#fff6b0', '#d49a12', 0.35, 0.3)
    hand = d.radial('hand', '#ffe2c6', '#e59a6e', 0.35, 0.3)

    body_y = 640
    parts = []
    # Boots: two big round toes pointing at the viewer, as a mascot stands.
    for bx, turn in ((215, -12), (385, 12)):
        parts.append(f'<ellipse cx="{bx}" cy="{FEET_Y - 16}" rx="86" ry="44" fill="{boot}" stroke="{INK}" stroke-width="5" transform="rotate({turn} {bx} {FEET_Y - 16})"/>')
        parts.append(shine(bx - 26, FEET_Y - 34, 26, 10, turn, 0.5))
    # Body: an egg.
    parts.append(f'<ellipse cx="300" cy="{body_y}" rx="190" ry="200" fill="{tunic}" stroke="{INK}" stroke-width="6"/>')
    parts.append(shine(200, body_y - 110, 44, 70, 30, 0.35))
    # Belt and buckle.
    parts.append(f'<path d="M118 {body_y + 70} q182 60 364 0 l-4 44 q-178 58 -356 0 z" fill="#5a3418" stroke="{INK}" stroke-width="5"/>')
    parts.append(f'<rect x="262" y="{body_y + 82}" width="76" height="58" rx="12" fill="{gold}" stroke="{INK}" stroke-width="5"/>')
    parts.append(f'<rect x="284" y="{body_y + 100}" width="32" height="22" rx="6" fill="#5a3418"/>')

    # Arms, by pose, behind or before the beard.
    arms_back, arms_front = [], []
    hands = lambda x, y: f'<circle cx="{x}" cy="{y}" r="34" fill="{hand}" stroke="{INK}" stroke-width="5"/>' + shine(x - 10, y - 12, 9, 6, -20, 0.7)
    sleeve = lambda x1, y1, x2, y2: f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{INK}" stroke-width="66" stroke-linecap="round"/><path d="M{x1} {y1} L{x2} {y2}" stroke="#2c66b8" stroke-width="56" stroke-linecap="round"/>'
    if pose == 'normal':
        arms_back.append(axe(d, 486, 650, 8))
        arms_front += [sleeve(150, 560, 110, 700), hands(108, 712), sleeve(450, 560, 495, 650), hands(500, 655)]
    elif pose == 'attack':
        arms_back.append(axe(d, 450, 430, 12, 1.1))
        arms_front += [sleeve(150, 560, 100, 640), hands(96, 650), sleeve(450, 560, 452, 440), hands(452, 430)]
    elif pose == 'hurt':
        arms_front += [sleeve(150, 560, 80, 470), hands(74, 456), sleeve(450, 560, 520, 470), hands(526, 456)]
    elif pose == 'happy':
        arms_front += [sleeve(150, 540, 70, 380), hands(66, 366), sleeve(450, 540, 530, 380), hands(534, 366)]
    elif pose == 'think':
        arms_front += [sleeve(150, 560, 110, 700), hands(108, 712), sleeve(450, 560, 360, 560), hands(350, 556)]
    elif pose == 'scared':
        arms_front += [sleeve(150, 560, 190, 440), hands(196, 430), sleeve(450, 560, 410, 440), hands(404, 430)]
    elif pose == 'drink':
        arms_front += [sleeve(150, 560, 110, 700), hands(108, 712), sleeve(450, 560, 400, 500), f'<g transform="rotate(-60 360 470)">{potion_bottle(360, 470, scale=0.9)}</g>', hands(404, 500)]
    elif pose == 'ko':
        pass

    # Head: helmet over a round face, a beard covering the front of the body.
    head_y = 360
    face = f'<ellipse cx="300" cy="{head_y}" rx="150" ry="140" fill="{skin}" stroke="{INK}" stroke-width="6"/>'
    ears = (f'<ellipse cx="148" cy="{head_y + 10}" rx="26" ry="36" fill="{skin}" stroke="{INK}" stroke-width="5"/>'
            f'<ellipse cx="452" cy="{head_y + 10}" rx="26" ry="36" fill="{skin}" stroke="{INK}" stroke-width="5"/>')
    beard_shape = (f'<path d="M150 {head_y + 20} q-30 200 70 330 q40 40 80 50 q40 -10 80 -50 q100 -130 70 -330 '
                   f'q-60 80 -150 80 q-90 0 -150 -80 z" fill="{beard}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>')
    beard_lines = (f'<path d="M230 {head_y + 150} q10 90 40 160 M370 {head_y + 150} q-10 90 -40 160 M300 {head_y + 170} v170" '
                   'stroke="#a1401b" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.6"/>'
                   + shine(220, head_y + 140, 18, 60, 15, 0.45))
    moustache = (f'<path d="M300 {head_y + 74} q-70 -24 -120 30 q50 -6 70 10 q30 0 50 -26 q20 26 50 26 q20 -16 70 -10 q-50 -54 -120 -30 z" '
                 f'fill="#e8752c" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>')
    mouth = ''
    if pose == 'happy':
        mouth = f'<path d="M262 {head_y + 112} q38 50 76 0 z" fill="#7a1f2a" stroke="{INK}" stroke-width="5"/><path d="M278 {head_y + 128} q22 18 44 0" fill="#ff8a8a"/>'
    elif pose in ('scared', 'hurt'):
        mouth = f'<ellipse cx="300" cy="{head_y + 124}" rx="22" ry="{26 if pose == "scared" else 14}" fill="#7a1f2a" stroke="{INK}" stroke-width="5"/>'
    elif pose == 'attack':
        mouth = f'<rect x="266" y="{head_y + 108}" width="68" height="28" rx="10" fill="#fff" stroke="{INK}" stroke-width="5"/><path d="M266 {head_y + 122} h68" stroke="{INK}" stroke-width="3"/>'
    nose_part = f'<ellipse cx="300" cy="{head_y + 50}" rx="42" ry="36" fill="{nose}" stroke="{INK}" stroke-width="5"/>' + shine(288, head_y + 38, 12, 8, -20, 0.8)
    hy = head_y - 48
    helmet = (f'<path d="M140 {hy - 30} q0 -170 160 -170 q160 0 160 170 z" fill="{helm}" stroke="{INK}" stroke-width="6"/>'
              f'<rect x="128" y="{hy - 50}" width="344" height="40" rx="20" fill="{helm}" stroke="{INK}" stroke-width="6"/>'
              + ''.join(f'<circle cx="{x}" cy="{hy - 30}" r="7" fill="#596273"/>' for x in (170, 235, 300, 365, 430))
              + f'<path d="M300 {hy - 200} v-30" stroke="{INK}" stroke-width="6"/><circle cx="300" cy="{hy - 236}" r="14" fill="{gold}" stroke="{INK}" stroke-width="4"/>'
              + shine(220, hy - 140, 40, 22, -30, 0.8))
    eyes = mascot_eyes(250, 350, head_y - 4, pose)
    sweat = ''
    if pose == 'scared':
        sweat = f'<path d="M462 {head_y - 60} q-18 30 0 40 q18 -10 0 -40 z" fill="#8fd3ff" stroke="{INK}" stroke-width="3"/>'
    stars = ''
    if pose in ('hurt', 'ko'):
        for sx, sy in ((150, head_y - 190), (450, head_y - 170), (300, head_y - 270)):
            stars += (f'<path d="M{sx} {sy - 22} l7 15 l16 2 l-12 11 l3 16 l-14 -8 l-14 8 l3 -16 l-12 -11 l16 -2 z" '
                      f'fill="#ffe14d" stroke="{INK}" stroke-width="3"/>')

    figure = (''.join(arms_back) + ''.join(parts) + ears + face + beard_shape + beard_lines + moustache + mouth
              + nose_part + eyes + helmet + ''.join(arms_front) + sweat)
    if pose == 'ko':
        # Flat on his back, boots up: the whole dwarf tipped over, stars circling.
        figure = f'<g transform="translate(300 {FEET_Y - 120}) scale(0.68) rotate(-90) translate(-300 -560)">{figure}</g>'
        return sprite(scaled(shadow(300, 260) + figure + stars, DWARF_SCALE), d)
    if pose == 'hurt':
        figure = f'<g transform="rotate(-6 300 {FEET_Y})">{figure}</g>'
    return sprite(scaled(shadow() + figure + stars, DWARF_SCALE), d)


# Every sprite shares one height, so that sizes compare on stage: the dwarf is drawn small in his.
DWARF_SCALE = 0.64


def scaled(body, factor, cx=300):
    """Shrinks or grows a drawing around the middle of its feet."""
    return f'<g transform="translate({cx} {FEET_Y}) scale({factor}) translate({-cx} {-FEET_Y})">{body}</g>'


# ------------------------------------------------------------------------------------- shared parts

def blob(d, name, cx, cy, rx, ry, light, dark, width=6, gloss=True, extra=''):
    """A round glossy shape: gradient, outline, shine at the top left."""
    fill = d.radial(name, light, dark)
    out = f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{INK}" stroke-width="{width}" {extra}/>'
    if gloss:
        out += shine(cx - rx * 0.4, cy - ry * 0.5, rx * 0.22, ry * 0.14, -30, 0.55)
    return out


def shape(d, name, path, light, dark, width=6, cx=0.35, cy=0.3):
    return f'<path d="{path}" fill="{d.radial(name, light, dark, cx, cy)}" stroke="{INK}" stroke-width="{width}" stroke-linejoin="round"/>'


def mouth(cx, cy, kind, w=40):
    if kind == 'smile':
        return f'<path d="M{cx - w} {cy} q{w} {w * 0.8} {2 * w} 0" stroke="{INK}" stroke-width="7" fill="none" stroke-linecap="round"/>'
    if kind == 'grin':
        return (f'<path d="M{cx - w} {cy} q{w} {w * 1.1} {2 * w} 0 z" fill="#7a1f2a" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>'
                f'<path d="M{cx - w * 0.8} {cy + 3} h{w * 1.6} l-6 12 h-{w * 1.6 - 12} z" fill="#fff"/>')
    if kind == 'frown':
        return f'<path d="M{cx - w} {cy + w * 0.4} q{w} -{w * 0.8} {2 * w} 0" stroke="{INK}" stroke-width="7" fill="none" stroke-linecap="round"/>'
    if kind == 'open':
        return f'<ellipse cx="{cx}" cy="{cy + 10}" rx="{w * 0.55}" ry="{w * 0.6}" fill="#7a1f2a" stroke="{INK}" stroke-width="6"/>'
    if kind == 'teeth':
        return (f'<rect x="{cx - w}" y="{cy - 10}" width="{2 * w}" height="34" rx="12" fill="#fff" stroke="{INK}" stroke-width="6"/>'
                f'<path d="M{cx - w} {cy + 7} h{2 * w}" stroke="{INK}" stroke-width="3"/>')
    return f'<path d="M{cx - w * 0.7} {cy + 8} h{w * 1.4}" stroke="{INK}" stroke-width="7" stroke-linecap="round"/>'


def brows(cx, cy, gap, kind):
    """Eyebrows over mascot eyes: cross slants them in, worried lifts them in the middle."""
    if kind == 'cross':
        return (f'<path d="M{cx - gap - 30} {cy - 20} L{cx - gap + 26} {cy}" stroke="{INK}" stroke-width="10" stroke-linecap="round"/>'
                f'<path d="M{cx + gap + 30} {cy - 20} L{cx + gap - 26} {cy}" stroke="{INK}" stroke-width="10" stroke-linecap="round"/>')
    if kind == 'worried':
        return (f'<path d="M{cx - gap - 26} {cy} L{cx - gap + 24} {cy - 18}" stroke="{INK}" stroke-width="9" stroke-linecap="round"/>'
                f'<path d="M{cx + gap + 26} {cy} L{cx + gap - 24} {cy - 18}" stroke="{INK}" stroke-width="9" stroke-linecap="round"/>')
    return ''


def closed_eyes(cx, cy, gap):
    return ''.join(f'<path d="M{x - 22} {cy} q22 16 44 0" stroke="{INK}" stroke-width="8" fill="none" stroke-linecap="round"/>' for x in (cx - gap, cx + gap))


def zzz(x, y):
    return ''.join(f'<text x="{x + i * 34}" y="{y - i * 40}" font-family="Arial Black, sans-serif" font-weight="900" font-size="{40 + i * 12}" '
                   f'fill="#fff" stroke="{INK}" stroke-width="4" paint-order="stroke">z</text>' for i in range(3))


def legs(d, name, xs, color_light, color_dark, top=FEET_Y - 90, rx=48):
    out = ''
    for x in xs:
        out += f'<rect x="{x - 26}" y="{top}" width="52" height="{FEET_Y - top - 10}" rx="20" fill="{color_dark}" stroke="{INK}" stroke-width="5"/>'
        out += blob(d, f'{name}{x}', x, FEET_Y - 16, rx, 26, color_light, color_dark, 5)
    return out


# ------------------------------------------------------------------------------------- the people of Mossbottom

def mayor(expression='normal'):
    d = Defs()
    body = (legs(d, 'shoe', (240, 360), '#4a4a5a', '#15151d')
            + blob(d, 'coat', 300, 600, 175, 230, '#b57ae8', '#4b1f7a')
            + f'<path d="M300 400 l-60 120 l60 260 l60 -260 z" fill="#fff" stroke="{INK}" stroke-width="5"/>'
            + ''.join(f'<circle cx="300" cy="{y}" r="9" fill="#d4a017" stroke="{INK}" stroke-width="3"/>' for y in (560, 620, 680))
            + f'<path d="M190 420 q110 140 220 0" stroke="#d4a017" stroke-width="14" fill="none"/>'
            + blob(d, 'medal', 300, 530, 34, 34, '#fff6b0', '#c88a0a', 5)
            + blob(d, 'arm1', 120, 600, 46, 90, '#b57ae8', '#4b1f7a', 6, False) + blob(d, 'arm2', 480, 600, 46, 90, '#b57ae8', '#4b1f7a', 6, False)
            + blob(d, 'face', 300, 300, 130, 120, '#ffe0c8', '#e29a74')
            + shape(d, 'chop1', 'M172 300 q-20 90 50 120 q10 -60 -10 -110 z', '#f0f0f0', '#9a9aa8', 5)
            + shape(d, 'chop2', 'M428 300 q20 90 -50 120 q-10 -60 10 -110 z', '#f0f0f0', '#9a9aa8', 5)
            + mascot_eyes(255, 345, 285, 'normal', 0.85)
            + f'<circle cx="255" cy="285" r="40" fill="none" stroke="#d4a017" stroke-width="6"/><circle cx="345" cy="285" r="40" fill="none" stroke="#d4a017" stroke-width="6"/><path d="M295 285 h10" stroke="#d4a017" stroke-width="6"/>'
            + blob(d, 'mnose', 300, 330, 22, 18, '#ffb8a0', '#d9735a', 4)
            + mouth(300, 368, 'grin', 36)
            + f'<rect x="200" y="30" width="200" height="170" rx="14" fill="{d.linear("hat", "#4a4a5a", "#0d0d12", 1, 0)}" stroke="{INK}" stroke-width="6"/>'
            + f'<rect x="200" y="150" width="200" height="30" fill="#c0392b"/>'
            + f'<ellipse cx="300" cy="200" rx="160" ry="26" fill="#1c1c24" stroke="{INK}" stroke-width="6"/>'
            + shine(240, 70, 14, 50, 0, 0.35))
    return sprite(shadow(300, 210) + body, d)


def grizelda(expression='normal'):
    d = Defs()
    cross = expression == 'cross'
    body = (legs(d, 'gshoe', (250, 350), '#7a4a2a', '#3a1f10', rx=40)
            + blob(d, 'dress', 300, 680, 150, 180, '#d06a9a', '#6a1f45')
            + f'<path d="M210 600 q90 40 180 0 l-10 220 q-80 30 -160 0 z" fill="#fff8ec" stroke="{INK}" stroke-width="5"/>'
            + f'<path d="M150 560 q150 -80 300 0 q-30 60 -150 70 q-120 -10 -150 -70 z" fill="{d.radial("shawl", "#9ad0ff", "#3a6aa8")}" stroke="{INK}" stroke-width="6"/>'
            + shape(d, 'ear1', 'M180 360 q-150 -60 -160 -40 q40 80 170 100 z', '#a8e07a', '#4f8a2a', 5)
            + shape(d, 'ear2', 'M420 360 q150 -60 160 -40 q-40 80 -170 100 z', '#a8e07a', '#4f8a2a', 5)
            + blob(d, 'gface', 300, 380, 130, 125, '#b8ec8a', '#4f8a2a')
            + blob(d, 'bun', 300, 220, 90, 70, '#ffffff', '#a0a0b0', 6)
            + f'<path d="M180 330 q120 -110 240 0" fill="#e8e8ef" stroke="{INK}" stroke-width="5"/>'
            + mascot_eyes(255, 345, 370, 'normal', 0.8)
            + brows(300, 320, 45, 'cross' if cross else '')
            + f'<circle cx="255" cy="370" r="38" fill="none" stroke="{INK}" stroke-width="5"/><circle cx="345" cy="370" r="38" fill="none" stroke="{INK}" stroke-width="5"/><path d="M293 370 h14" stroke="{INK}" stroke-width="5"/>'
            + shape(d, 'gnose', 'M300 395 q20 30 40 60 q-30 10 -50 -10 z', '#b8ec8a', '#4f8a2a', 5)
            + mouth(300, 465, 'frown' if cross else 'smile', 34)
            + f'<path d="M282 466 v14" stroke="#fff" stroke-width="8"/>'
            + blob(d, 'gh1', 160, 640, 32, 32, '#b8ec8a', '#4f8a2a', 5, False) + blob(d, 'gh2', 440, 640, 32, 32, '#b8ec8a', '#4f8a2a', 5, False))
    return sprite(shadow(300, 170) + scaled(body, 0.82), d)


def barnaby(expression='normal'):
    d = Defs()
    body = (legs(d, 'bshoe', (230, 370), '#5a3a20', '#24140a')
            + blob(d, 'shirt', 300, 600, 200, 240, '#ff7a6a', '#8a1f1f')
            + f'<path d="M160 520 q140 -40 280 0 l-20 310 q-120 40 -240 0 z" fill="#fffaf0" stroke="{INK}" stroke-width="6"/>'
            + f'<path d="M430 440 q30 80 10 160" stroke="#fff" stroke-width="40" fill="none"/><path d="M430 440 q30 80 10 160" stroke="#8ad0ff" stroke-width="10" fill="none" stroke-dasharray="12 12"/>'
            + blob(d, 'barm1', 110, 600, 54, 100, '#ff7a6a', '#8a1f1f', 6, False)
            + blob(d, 'bface', 300, 300, 140, 130, '#ffd9bf', '#d88a64')
            + shine(250, 210, 50, 22, -20, 0.9)
            + mascot_eyes(255, 345, 285, 'happy', 0.9)
            + blob(d, 'bnose', 300, 330, 34, 28, '#ffb0a0', '#d9534f', 5)
            + shape(d, 'mous', 'M300 350 q-80 -20 -150 40 q60 0 80 10 q40 0 70 -30 q30 30 70 30 q20 -10 80 -10 q-70 -60 -150 -40 z', '#9a5a2a', '#4a2410', 5)
            + mouth(300, 400, 'smile', 26)
            + f'<g transform="translate(470 560)"><rect x="-50" y="-70" width="100" height="130" rx="16" fill="{d.linear("mug", "#ffd76a", "#c87a0a")}" stroke="{INK}" stroke-width="6"/>'
            f'<path d="M50 -40 q50 0 50 40 q0 40 -50 40" stroke="{INK}" stroke-width="12" fill="none"/>'
            f'<path d="M-56 -70 q20 -40 50 -20 q30 -40 60 0 q20 0 0 20 h-110 z" fill="#fff" stroke="{INK}" stroke-width="5"/></g>'
            + blob(d, 'bh2', 440, 590, 36, 36, '#ffd9bf', '#d88a64', 5, False))
    return sprite(shadow(300, 220) + body, d)


def fizzwick(expression='normal'):
    d = Defs()
    body = (legs(d, 'fshoe', (250, 350), '#3a2a1a', '#120a04', rx=40)
            + blob(d, 'fcoat', 300, 680, 140, 170, '#6ac0ff', '#1a4a8a')
            + blob(d, 'fface', 300, 450, 110, 100, '#ffe0c8', '#e29a74')
            + shape(d, 'fbeard', 'M200 470 q0 170 100 210 q100 -40 100 -210 q-50 50 -100 50 q-50 0 -100 -50 z', '#ffffff', '#a8a8b8', 5)
            + mascot_eyes(262, 338, 430, 'normal', 0.75)
            + blob(d, 'fnose', 300, 475, 26, 22, '#ffb8a0', '#d9735a', 4)
            + shape(d, 'fhat', 'M180 400 q30 -150 160 -360 q30 -10 30 20 q-20 200 60 340 z', '#ff6a5a', '#8a1010', 6)
            + f'<g transform="translate(430 650) rotate(10)"><rect x="-60" y="-80" width="120" height="160" rx="10" fill="#c89a5a" stroke="{INK}" stroke-width="6"/>'
            f'<rect x="-46" y="-62" width="92" height="128" fill="#fff"/><rect x="-24" y="-92" width="48" height="24" rx="6" fill="#bbb" stroke="{INK}" stroke-width="4"/>'
            + ''.join(f'<circle cx="{-20 + i * 20}" cy="-10" r="8" fill="none" stroke="#c0392b" stroke-width="4"/>' for i in range(3))
            + '</g>'
            + blob(d, 'fh', 400, 680, 30, 30, '#ffe0c8', '#e29a74', 5, False))
    return sprite(shadow(300, 150) + scaled(body, 0.75), d)


def sneak(expression='normal'):
    d = Defs()
    body = (legs(d, 'sshoe', (250, 350), '#3a3020', '#14100a', rx=40)
            + shape(d, 'cloak', 'M300 360 q-200 60 -210 480 h420 q-10 -420 -210 -480 z', '#9a8a6a', '#3a3020')
            + shape(d, 'lining', 'M300 520 q-90 60 -100 320 h200 q-10 -260 -100 -320 z', '#c0392b', '#5a0f0f', 4)
            + ''.join(potion_bottle(x, y, c, 0.55) for x, y, c in ((260, 700, '#7ad957'), (340, 720, '#5ab0ff'), (300, 800, '#ffcc33')))
            + shape(d, 'sear1', 'M190 330 q-130 -90 -150 -60 q40 90 160 110 z', '#a8e07a', '#4f8a2a', 5)
            + shape(d, 'sear2', 'M410 330 q130 -90 150 -60 q-40 90 -160 110 z', '#a8e07a', '#4f8a2a', 5)
            + blob(d, 'sface', 300, 350, 120, 110, '#b8ec8a', '#4f8a2a')
            + mascot_eyes(255, 345, 330, 'normal', 0.75).replace('cy="334"', 'cy="334"')
            + f'<path d="M220 300 l70 18 M380 300 l-70 18" stroke="{INK}" stroke-width="9" stroke-linecap="round"/>'
            + shape(d, 'snose', 'M300 350 l50 40 l-50 6 z', '#b8ec8a', '#4f8a2a', 4)
            + f'<path d="M240 420 q60 30 120 -10" stroke="{INK}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M330 418 v18 l10 -4 z" fill="#fff" stroke="{INK}" stroke-width="3"/>'
            + shape(d, 'hood', 'M170 340 q-10 -210 130 -230 q140 20 130 230 q-40 -130 -130 -140 q-90 10 -130 140 z', '#9a8a6a', '#3a3020'))
    return sprite(shadow(300, 200) + scaled(body, 0.85), d)


def melody(expression='normal'):
    d = Defs()
    body = (legs(d, 'mshoe', (255, 345), '#6a3a1a', '#2a1408', rx=38)
            + blob(d, 'tunic', 300, 640, 140, 190, '#7ad0a0', '#1f6a4a')
            + f'<path d="M180 640 h240" stroke="#8a5a2a" stroke-width="22"/>'
            + blob(d, 'hair', 300, 330, 150, 140, '#c87a3a', '#5a2a0a')
            + blob(d, 'mface', 300, 360, 115, 110, '#ffe6d0', '#e8a07a')
            + mascot_eyes(258, 342, 350, 'happy', 0.8)
            + ''.join(f'<circle cx="{x}" cy="395" r="5" fill="#c8704a"/>' for x in (230, 245, 355, 370))
            + mouth(300, 415, 'open', 30)
            + shape(d, 'cap', 'M170 290 q130 -160 260 0 q-130 -40 -260 0 z', '#ff6a8a', '#8a1f3a', 6)
            + f'<path d="M400 250 q90 -100 140 -150 q-30 90 -120 170 z" fill="#fff36b" stroke="{INK}" stroke-width="4"/>'
            + f'<g transform="translate(300 640) rotate(-30)">'
            f'<ellipse cx="0" cy="40" rx="100" ry="80" fill="{d.radial("lute", "#ffcf8a", "#a0581a")}" stroke="{INK}" stroke-width="6"/>'
            f'<circle cx="0" cy="40" r="24" fill="#3a1a08"/><rect x="-14" y="-200" width="28" height="200" fill="#8a4a1a" stroke="{INK}" stroke-width="5"/>'
            f'<path d="M-6 -200 v260 M6 -200 v260" stroke="#fff" stroke-width="2"/></g>'
            + f'<text x="470" y="420" font-size="70" fill="#fff" stroke="{INK}" stroke-width="3" paint-order="stroke">♪</text>'
            + f'<text x="90" y="360" font-size="56" fill="#fff" stroke="{INK}" stroke-width="3" paint-order="stroke">♫</text>')
    return sprite(shadow(300, 170) + scaled(body, 0.82), d)


def lorimer(expression='normal'):
    d = Defs()
    steel = ('#f4f8ff', '#6a7890')
    body = (legs(d, 'lshoe', (250, 350), *steel, top=FEET_Y - 330, rx=50)
            + blob(d, 'chest', 300, 400, 140, 180, *steel)
            + f'<path d="M190 520 h220 l-20 50 h-180 z" fill="#3a5a9a" stroke="{INK}" stroke-width="5"/>'
            + f'<path d="M230 300 h140 v170 l-70 40 l-70 -40 z" fill="#3a5a9a" stroke="{INK}" stroke-width="5"/><path d="M300 320 v160 M250 380 h100" stroke="#ffd34d" stroke-width="16"/>'
            + blob(d, 'larm1', 130, 420, 40, 110, *steel, 6, False) + blob(d, 'larm2', 470, 420, 40, 110, *steel, 6, False)
            + blob(d, 'helm', 300, 150, 110, 120, *steel)
            + f'<rect x="220" y="110" width="160" height="80" rx="20" fill="#ffe0c8" stroke="{INK}" stroke-width="5"/>'
            + mascot_eyes(265, 335, 145, 'normal', 0.6)
            + brows(300, 112, 35, 'worried')
            + mouth(300, 175, 'grin', 24)
            + f'<path d="M210 100 q90 -60 180 0" stroke="{INK}" stroke-width="6" fill="none"/>'
            + f'<path d="M300 30 q80 -40 120 30 q-60 -20 -120 0 z" fill="#ff5a5a" stroke="{INK}" stroke-width="4"/>')
    return sprite(shadow(300, 170) + body, d)


def troll(expression='normal'):
    d = Defs()
    awake = expression == 'awake'
    body = (blob(d, 'sack', 820, 760, 120, 110, '#d8b07a', '#7a5020')
            + f'<path d="M760 660 q60 30 120 0" stroke="{INK}" stroke-width="8" fill="none"/>'
            + ''.join(f'<circle cx="{x}" cy="{y}" r="16" fill="#ffd34d" stroke="{INK}" stroke-width="3"/>' for x, y in ((760, 860), (800, 875), (850, 870)))
            + blob(d, 'tbody', 450, 620, 330, 260, '#a8b8a0', '#4a5a44')
            + blob(d, 'tleg1', 280, 820, 110, 60, '#a8b8a0', '#4a5a44') + blob(d, 'tleg2', 620, 820, 110, 60, '#a8b8a0', '#4a5a44')
            + blob(d, 'thead', 450, 380, 190, 160, '#b8c8b0', '#5a6a54')
            + blob(d, 'tnose', 450, 420, 60, 50, '#c8d8c0', '#6a7a64', 5)
            + (mascot_eyes(385, 515, 335, 'normal', 0.9) if awake else closed_eyes(450, 340, 65))
            + mouth(450, 490, 'smile' if awake else 'flat', 60)
            + f'<path d="M405 488 l10 -26 l10 26 M475 488 l10 -26 l10 26" fill="#fff" stroke="{INK}" stroke-width="3"/>'
            + ('' if awake else zzz(640, 260))
            + ''.join(f'<path d="M{x} {y} l14 -24 l14 24" fill="#6a7a64" stroke="{INK}" stroke-width="4"/>' for x, y in ((360, 240), (430, 226), (500, 236))))
    return sprite(shadow(450, 380) + body, d, 960)


# ------------------------------------------------------------------------------------- the monsters

def gloop():
    d = Defs()
    jelly = d.radial('jelly', '#bfe9ff', '#2a7ad0', 0.35, 0.25)
    return sprite(shadow(300, 200) + scaled(
        f'<path d="M110 {FEET_Y} q-30 -300 190 -380 q220 80 190 380 z" fill="{jelly}" stroke="{INK}" stroke-width="7" opacity="0.93"/>'
        + shine(200, FEET_Y - 280, 30, 60, 25, 0.7) + shine(380, FEET_Y - 120, 14, 24, 0, 0.4)
        + mascot_eyes(250, 350, FEET_Y - 230, 'normal', 1.1)
        + f'<path d="M240 {FEET_Y - 130} q60 50 120 0" fill="#1a3a6a" stroke="{INK}" stroke-width="6"/>'
        + f'<path d="M290 {FEET_Y - 112} q30 70 90 60 l10 -30 q-50 0 -70 -40 z" fill="#fff" stroke="{INK}" stroke-width="4"/>'
        + f'<path d="M352 {FEET_Y - 66} l40 -2 M356 {FEET_Y - 80} l36 -4" stroke="#e0473a" stroke-width="7"/>', 0.8), d)


def rat():
    d = Defs()
    fur = ('#c8c8d4', '#5a5a6a')
    return sprite(shadow(300, 220) + scaled(
        f'<path d="M420 {FEET_Y - 40} q180 0 140 -200 q-20 -80 40 -120" stroke="#e8a0b0" stroke-width="18" fill="none" stroke-linecap="round"/>'
        + blob(d, 'rbody', 300, FEET_Y - 190, 170, 190, *fur)
        + blob(d, 'rbelly', 300, FEET_Y - 160, 100, 120, '#ffffff', '#c8c0c8', 4, False)
        + blob(d, 'rear1', 170, FEET_Y - 520, 70, 70, '#ffc8d8', '#c06080') + blob(d, 'rear2', 430, FEET_Y - 520, 70, 70, '#ffc8d8', '#c06080')
        + blob(d, 'rhead', 300, FEET_Y - 420, 140, 120, *fur)
        + mascot_eyes(250, 350, FEET_Y - 450, 'attack', 0.8)
        + blob(d, 'rnose', 300, FEET_Y - 370, 26, 20, '#ff9ab0', '#c04060', 4)
        + f'<rect x="282" y="{FEET_Y - 345}" width="36" height="40" rx="6" fill="#fff" stroke="{INK}" stroke-width="4"/><path d="M300 {FEET_Y - 345} v40" stroke="{INK}" stroke-width="3"/>'
        + f'<path d="M230 {FEET_Y - 370} l-90 -10 M230 {FEET_Y - 360} l-90 14 M370 {FEET_Y - 370} l90 -10 M370 {FEET_Y - 360} l90 14" stroke="{INK}" stroke-width="3"/>'
        + f'<g transform="translate(300 {FEET_Y - 210}) rotate(-12)"><rect x="-130" y="-50" width="260" height="100" rx="50" fill="{d.radial("loaf", "#ffd890", "#b06a1a")}" stroke="{INK}" stroke-width="6"/>'
        + ''.join(f'<path d="M{x} -40 q14 40 0 80" stroke="#8a4a10" stroke-width="5" fill="none"/>' for x in (-60, 0, 60)) + '</g>'
        + blob(d, 'rp1', 175, FEET_Y - 210, 32, 28, '#ffc8d8', '#c06080', 4, False) + blob(d, 'rp2', 425, FEET_Y - 210, 32, 28, '#ffc8d8', '#c06080', 4, False), 0.85), d)


def goblin(d, extra_body='', hat='', eyes_pose='normal', mouth_kind='grin', specs=False, scale=0.78, shirt=('#ffffff', '#b8b8c8')):
    """A small goblin: the intern, the accountant and the foreman are all built on him."""
    body = (legs(d, 'gl', (255, 345), '#5a4030', '#24180c', top=FEET_Y - 120, rx=42)
            + blob(d, 'gbody', 300, FEET_Y - 230, 130, 150, *shirt)
            + extra_body
            + shape(d, 'gear1', 'M200 400 q-150 -70 -170 -40 q50 90 180 100 z', '#a8e07a', '#4f8a2a', 5)
            + shape(d, 'gear2', 'M400 400 q150 -70 170 -40 q-50 90 -180 100 z', '#a8e07a', '#4f8a2a', 5)
            + blob(d, 'ghead', 300, 420, 130, 120, '#b8ec8a', '#4f8a2a')
            + mascot_eyes(255, 345, 400, eyes_pose, 0.85)
            + (f'<circle cx="255" cy="400" r="42" fill="none" stroke="{INK}" stroke-width="6"/><circle cx="345" cy="400" r="42" fill="none" stroke="{INK}" stroke-width="6"/><path d="M297 400 h6" stroke="{INK}" stroke-width="6"/>' if specs else '')
            + shape(d, 'gnose2', 'M300 420 q30 20 40 46 q-34 6 -50 -10 z', '#b8ec8a', '#4f8a2a', 4)
            + mouth(300, 485, mouth_kind, 36)
            + hat)
    return scaled(body, scale)


def intern():
    d = Defs()
    extra = (f'<path d="M300 {FEET_Y - 370} l-20 30 l20 140 l20 -140 z" fill="#c0392b" stroke="{INK}" stroke-width="4"/>'
             f'<path d="M240 {FEET_Y - 370} q60 120 120 0" stroke="#3a6ad0" stroke-width="8" fill="none"/>'
             f'<rect x="270" y="{FEET_Y - 270}" width="60" height="76" rx="6" fill="#fff" stroke="{INK}" stroke-width="4"/><rect x="280" y="{FEET_Y - 258}" width="40" height="30" fill="#8ad0ff"/>'
             f'<g transform="translate(460 {FEET_Y - 260})"><rect x="-38" y="-50" width="76" height="90" rx="10" fill="#fff" stroke="{INK}" stroke-width="5"/>'
             f'<path d="M38 -30 q36 0 36 30 q0 30 -36 30" stroke="{INK}" stroke-width="9" fill="none"/><text x="0" y="10" text-anchor="middle" font-size="26" font-family="Arial" font-weight="bold" fill="#c0392b">#1</text></g>'
             + blob(d, 'ih', 430, FEET_Y - 250, 30, 30, '#b8ec8a', '#4f8a2a', 5, False))
    return sprite(shadow(300, 140) + goblin(d, extra, eyes_pose='scared', mouth_kind='open', scale=0.7), d)


def clerk():
    d = Defs()
    extra = (f'<path d="M190 {FEET_Y - 330} q110 60 220 0 l-10 200 q-100 30 -200 0 z" fill="#7a3a9a" stroke="{INK}" stroke-width="5"/>'
             + ''.join(f'<circle cx="300" cy="{FEET_Y - y}" r="7" fill="#ffd34d"/>' for y in (300, 250, 200))
             + f'<g transform="translate(150 {FEET_Y - 230}) rotate(-10)"><rect x="-70" y="-90" width="140" height="180" rx="8" fill="{d.radial("ledger", "#7a9aff", "#1a2a7a")}" stroke="{INK}" stroke-width="6"/>'
             f'<path d="M-50 -90 v180" stroke="#ffd34d" stroke-width="8"/></g>'
             + blob(d, 'ch', 170, FEET_Y - 210, 30, 30, '#b8ec8a', '#4f8a2a', 5, False))
    hat = f'<path d="M386 380 l90 -80" stroke="#fff" stroke-width="10"/><path d="M466 300 q40 -60 30 -100 q-30 50 -50 90 z" fill="#fff" stroke="{INK}" stroke-width="3"/>'
    return sprite(shadow(300, 150) + goblin(d, extra, hat, 'think', 'smile', True, 0.76, ('#fffaf0', '#c8c0b0')), d)


def foreman():
    d = Defs()
    extra = (f'<path d="M180 {FEET_Y - 320} q120 50 240 0 l-10 210 q-110 30 -220 0 z" fill="{d.radial("vest", "#fff36b", "#e0a000")}" stroke="{INK}" stroke-width="5"/>'
             f'<path d="M190 {FEET_Y - 240} q110 30 220 0" stroke="#c0c0c8" stroke-width="18" fill="none"/>'
             f'<g transform="translate(470 {FEET_Y - 280}) rotate(25)"><rect x="-14" y="-40" width="28" height="200" rx="10" fill="#9aa0aa" stroke="{INK}" stroke-width="5"/>'
             f'<path d="M-50 -40 a50 50 0 1 1 100 0 l-24 0 l0 -30 l-52 0 l0 30 z" fill="#b8c0c8" stroke="{INK}" stroke-width="5"/></g>'
             + blob(d, 'fh2', 440, FEET_Y - 220, 32, 32, '#b8ec8a', '#4f8a2a', 5, False))
    hat = (f'<path d="M160 350 q0 -150 140 -150 q140 0 140 150 z" fill="{d.radial("hard", "#fff6a0", "#e0a000")}" stroke="{INK}" stroke-width="6"/>'
           f'<rect x="140" y="336" width="320" height="28" rx="14" fill="#f0c020" stroke="{INK}" stroke-width="6"/>' + shine(230, 250, 30, 14, -30, 0.8)
           + f'<rect x="330" y="470" width="70" height="20" rx="8" fill="#c0c0c8" stroke="{INK}" stroke-width="4"/>')
    return sprite(shadow(300, 160) + goblin(d, extra, hat, 'attack', 'flat', False, 0.8, ('#6ab0ff', '#1a4a8a')), d)


def shroom():
    d = Defs()
    return sprite(shadow(300, 200) + scaled(
        legs(d, 'sl', (240, 360), '#f0e0c8', '#a08060', top=FEET_Y - 80, rx=50)
        + shape(d, 'stem', f'M200 {FEET_Y - 60} q-20 -280 30 -420 h140 q50 140 30 420 z', '#fff8ec', '#c8b090')
        + mascot_eyes(255, 345, FEET_Y - 330, 'normal', 0.9) + brows(300, FEET_Y - 380, 45, 'cross')
        + mouth(300, FEET_Y - 230, 'frown', 40)
        + f'<path d="M190 {FEET_Y - 220} q-60 30 -30 80 q60 -30 100 -40 M410 {FEET_Y - 220} q60 30 30 80 q-60 -30 -100 -40" fill="#fff8ec" stroke="{INK}" stroke-width="6"/>'
        + shape(d, 'cap', f'M40 {FEET_Y - 470} q0 -330 260 -340 q260 10 260 340 q-260 60 -520 0 z', '#ff7a6a', '#a01010', 7)
        + ''.join(f'<ellipse cx="{x}" cy="{FEET_Y - y}" rx="{r}" ry="{r * 0.8}" fill="#fff" stroke="{INK}" stroke-width="3"/>'
                  for x, y, r in ((160, 600, 40), (300, 700, 50), (430, 580, 44), (230, 520, 26), (390, 690, 24), (500, 500, 20)))
        + shine(160, FEET_Y - 720, 40, 20, -30, 0.6), 0.95), d)


def bats():
    d = Defs()

    def bat(x, y, s, name):
        return (f'<g transform="translate({x} {y}) scale({s})">'
                + shape(d, f'w{name}', 'M0 0 q-60 -60 -150 -40 q30 20 20 50 q30 -10 40 20 q30 -20 90 -30 z M0 0 q60 -60 150 -40 q-30 20 -20 50 q-30 -10 -40 20 q-30 -20 -90 -30 z', '#9a7ad0', '#3a1a6a', 5)
                + blob(d, f'b{name}', 0, 0, 60, 54, '#b89ae8', '#4a2a8a', 5)
                + f'<path d="M-40 -40 l10 -40 l20 30 M40 -40 l-10 -40 l-20 30" fill="#b89ae8" stroke="{INK}" stroke-width="4"/>'
                + mascot_eyes(-20, 20, -10, 'normal', 0.45)
                + f'<ellipse cx="0" cy="26" rx="14" ry="16" fill="#7a1f2a" stroke="{INK}" stroke-width="3"/></g>')
    notes = ''.join(f'<text x="{x}" y="{y}" font-size="60" fill="#fff" stroke="{INK}" stroke-width="3" paint-order="stroke">{n}</text>'
                    for x, y, n in ((70, 300, '♪'), (480, 260, '♫'), (520, 560, '♪')))
    return sprite(bat(300, 380, 1.0, 1) + bat(150, 560, 0.8, 2) + bat(450, 600, 0.85, 3) + bat(240, 760, 0.7, 4) + bat(390, 790, 0.65, 5) + notes, d)


def boney():
    d = Defs()
    bone = ('#ffffff', '#b8b4a0')
    ribs = ''.join(f'<path d="M{300 - w} {y} q{w} 30 {2 * w} 0" stroke="{INK}" stroke-width="18" fill="none" stroke-linecap="round"/>'
                   f'<path d="M{300 - w} {y} q{w} 30 {2 * w} 0" stroke="#f4f0e0" stroke-width="10" fill="none" stroke-linecap="round"/>'
                   for w, y in ((90, 470), (100, 520), (95, 570), (80, 620)))
    return sprite(shadow(300, 170) + scaled(
        legs(d, 'bl', (250, 350), *bone, top=FEET_Y - 200, rx=46)
        + f'<rect x="288" y="420" width="24" height="260" rx="10" fill="#f4f0e0" stroke="{INK}" stroke-width="5"/>' + ribs
        + blob(d, 'pelvis', 300, 690, 90, 44, *bone, 5)
        + f'<path d="M190 440 l-60 160 M410 440 l60 120" stroke="{INK}" stroke-width="26" stroke-linecap="round"/><path d="M190 440 l-60 160 M410 440 l60 120" stroke="#f4f0e0" stroke-width="16" stroke-linecap="round"/>'
        + f'<g transform="translate(480 560) rotate(30)"><rect x="-10" y="-260" width="20" height="240" fill="{d.linear("sword", "#ffffff", "#8a98b0", 1, 0)}" stroke="{INK}" stroke-width="5"/><rect x="-50" y="-24" width="100" height="20" rx="8" fill="#8a5a2a" stroke="{INK}" stroke-width="5"/></g>'
        + blob(d, 'skull', 300, 300, 140, 130, *bone)
        + f'<rect x="230" y="380" width="140" height="56" rx="20" fill="#fff" stroke="{INK}" stroke-width="6"/>'
        + ''.join(f'<path d="M{x} 384 v48" stroke="{INK}" stroke-width="4"/>' for x in (265, 300, 335))
        + f'<ellipse cx="250" cy="300" rx="44" ry="50" fill="{INK}"/><ellipse cx="350" cy="300" rx="44" ry="50" fill="{INK}"/>'
        + '<circle cx="258" cy="300" r="13" fill="#fff"/><circle cx="342" cy="300" r="13" fill="#fff"/>'
        + f'<path d="M290 350 l10 -20 l10 20 z" fill="{INK}"/>', 0.9), d)


def ghost():
    d = Defs()
    sheet = d.radial('sheet', '#ffffff', '#a8c0e8', 0.35, 0.25)
    return sprite(f'<ellipse cx="300" cy="{FEET_Y}" rx="120" ry="18" fill="#000" opacity="0.12"/>'
                  + f'<path d="M120 {FEET_Y - 160} q-20 -480 180 -500 q200 20 180 500 q-40 -40 -60 10 q-30 -50 -60 0 q-30 -50 -60 0 q-30 -50 -60 0 q-20 -50 -60 -10 z" '
                    f'fill="{sheet}" stroke="{INK}" stroke-width="7" opacity="0.92"/>'
                  + shine(210, FEET_Y - 560, 26, 50, 25, 0.8)
                  + mascot_eyes(250, 350, FEET_Y - 470, 'normal', 0.9) + brows(300, FEET_Y - 525, 50, 'worried')
                  + mouth(300, FEET_Y - 360, 'frown', 34)
                  + f'<path d="M140 {FEET_Y - 330} q-60 20 -80 -40 M460 {FEET_Y - 330} q60 20 80 -40" stroke="{INK}" stroke-width="8" fill="none" stroke-linecap="round"/>'
                  + f'<path d="M420 {FEET_Y - 520} q60 -10 70 -60" stroke="#8ad0ff" stroke-width="6" fill="none" stroke-dasharray="10 12"/>', d)


def mummy():
    d = Defs()
    wraps = ''.join(f'<path d="M{150 + (i % 2) * 10} {y} q150 {30 if i % 2 else -20} 300 {10 if i % 2 else -10}" stroke="#a89a70" stroke-width="5" fill="none"/>'
                    for i, y in enumerate(range(300, 820, 46)))
    return sprite(shadow(300, 190) + scaled(
        legs(d, 'ml', (240, 360), '#f4ecd0', '#a89a70', top=FEET_Y - 120, rx=50)
        + f'<path d="M190 420 L40 380 M410 420 L560 380" stroke="{INK}" stroke-width="72" stroke-linecap="round"/><path d="M190 420 L40 380 M410 420 L560 380" stroke="#f0e6c4" stroke-width="60" stroke-linecap="round"/>'
        + blob(d, 'wrap', 300, 520, 170, 330, '#fffaf0', '#b8aa80') + wraps
        + f'<rect x="200" y="300" width="200" height="70" rx="30" fill="#2a2018"/>'
        + mascot_eyes(255, 345, 335, 'normal', 0.7)
        + f'<path d="M420 560 q90 60 60 200" stroke="#f0e6c4" stroke-width="22" fill="none" stroke-linecap="round"/>', 0.9), d)


def imp():
    d = Defs()
    return sprite(shadow(300, 150) + scaled(
        f'<path d="M380 {FEET_Y - 100} q140 20 120 -140 l30 -10 l-10 40" stroke="#c0201a" stroke-width="14" fill="none" stroke-linecap="round"/>'
        + legs(d, 'il', (255, 345), '#ff7a5a', '#a01010', top=FEET_Y - 110, rx=40)
        + blob(d, 'ibody', 300, FEET_Y - 220, 120, 130, '#ff7a5a', '#a01010')
        + shape(d, 'flame', 'M150 420 q-20 -200 60 -260 q0 80 40 80 q-10 -120 60 -170 q10 110 60 130 q40 -60 30 -110 q100 120 50 330 z', '#fff36b', '#ff6a00', 5)
        + blob(d, 'ihead', 300, 450, 140, 125, '#ff8a6a', '#b01a10')
        + f'<path d="M190 380 q-40 -70 -10 -120 q20 60 60 80 z M410 380 q40 -70 10 -120 q-20 60 -60 80 z" fill="#3a1a1a" stroke="{INK}" stroke-width="4"/>'
        + mascot_eyes(255, 345, 440, 'attack', 0.85) + mouth(300, 505, 'grin', 50)
        + blob(d, 'coal', 470, FEET_Y - 260, 40, 34, '#ffd36b', '#c02000', 5), 0.75), d)


def golem():
    d = Defs()
    rock = ('#c8c0b8', '#5a5048')
    return sprite(shadow(400, 330) + scaled(
        blob(d, 'gl1', 290, FEET_Y - 80, 100, 80, *rock) + blob(d, 'gl2', 510, FEET_Y - 80, 100, 80, *rock)
        + blob(d, 'gb', 400, FEET_Y - 360, 250, 230, *rock)
        + ''.join(f'<path d="{p}" stroke="#4a4038" stroke-width="5" fill="none"/>' for p in (f'M300 {FEET_Y - 460} l60 60 l-20 50', f'M480 {FEET_Y - 300} l50 30', f'M360 {FEET_Y - 220} l-30 50'))
        + blob(d, 'ga1', 110, FEET_Y - 300, 90, 160, *rock) + blob(d, 'ga2', 690, FEET_Y - 300, 90, 160, *rock)
        + blob(d, 'gf1', 110, FEET_Y - 120, 80, 60, *rock) + blob(d, 'gf2', 690, FEET_Y - 120, 80, 60, *rock)
        + blob(d, 'ghd', 400, FEET_Y - 690, 150, 120, *rock)
        + f'<ellipse cx="345" cy="{FEET_Y - 700}" rx="30" ry="22" fill="#5af0ff" stroke="{INK}" stroke-width="5"/><ellipse cx="455" cy="{FEET_Y - 700}" rx="30" ry="22" fill="#5af0ff" stroke="{INK}" stroke-width="5"/>'
        + f'<circle cx="345" cy="{FEET_Y - 700}" r="9" fill="#fff"/><circle cx="455" cy="{FEET_Y - 700}" r="9" fill="#fff"/>'
        + f'<path d="M360 {FEET_Y - 630} h80" stroke="{INK}" stroke-width="8" stroke-linecap="round"/>'
        + f'<path d="M330 {FEET_Y - 800} q20 -20 40 0 q20 -30 50 0" stroke="#6ab04a" stroke-width="12" fill="none" stroke-linecap="round"/>', 1.05, 400), d, 800)


def mimic():
    d = Defs()
    wood = d.linear('wood', '#c8864a', '#6a3a14')
    return sprite(shadow(300, 230) + scaled(
        f'<path d="M100 {FEET_Y - 20} v-230 h400 v230 z" fill="{wood}" stroke="{INK}" stroke-width="7"/>'
        + f'<path d="M100 {FEET_Y - 250} h400" stroke="#d4a017" stroke-width="16"/><path d="M130 {FEET_Y - 20} v-230 M470 {FEET_Y - 20} v-230" stroke="#d4a017" stroke-width="14"/>'
        + f'<path d="M110 {FEET_Y - 250} q190 -40 380 0 l-30 -10 l-20 30 l-20 -30 l-20 30 l-20 -30 l-20 30 l-20 -30 l-20 30 l-20 -30 l-20 30 l-20 -30 l-20 30 l-20 -30 l-20 30 l-20 -30 l-20 30 z" fill="#7a1f2a" stroke="{INK}" stroke-width="5"/>'
        + f'<path d="M250 {FEET_Y - 260} q-20 140 60 200 q60 30 40 -40 q-20 -60 -40 -160 z" fill="#ff7a9a" stroke="{INK}" stroke-width="5"/>'
        + f'<g transform="rotate(-28 110 {FEET_Y - 270})"><path d="M100 {FEET_Y - 270} v-170 q200 -80 400 0 v170 z" fill="{wood}" stroke="{INK}" stroke-width="7"/>'
        + f'<path d="M100 {FEET_Y - 440} q200 -80 400 0" stroke="#d4a017" stroke-width="16" fill="none"/>'
        + ''.join(f'<path d="M{x} {FEET_Y - 270} l20 40 l20 -40 z" fill="#fff" stroke="{INK}" stroke-width="4"/>' for x in range(120, 480, 40))
        + mascot_eyes(250, 350, FEET_Y - 370, 'attack', 0.8) + '</g>', 0.95), d)


def whelp():
    d = Defs()
    scale_ = ('#ffb86a', '#c0500a')
    return sprite(shadow(300, 190) + scaled(
        f'<path d="M400 {FEET_Y - 90} q160 -10 150 -160 q40 30 40 70" stroke="#e07a2a" stroke-width="26" fill="none" stroke-linecap="round"/>'
        + shape(d, 'wing1', f'M190 {FEET_Y - 330} q-140 -120 -150 -40 q30 10 30 40 q40 -10 60 30 z', '#ffd36b', '#c07a0a', 5)
        + shape(d, 'wing2', f'M410 {FEET_Y - 330} q140 -120 150 -40 q-30 10 -30 40 q-40 -10 -60 30 z', '#ffd36b', '#c07a0a', 5)
        + legs(d, 'wl', (240, 360), *scale_, top=FEET_Y - 100, rx=46)
        + blob(d, 'wbody', 300, FEET_Y - 210, 140, 150, *scale_)
        + blob(d, 'wbelly', 300, FEET_Y - 180, 80, 100, '#fff2c8', '#e0b060', 4, False)
        + f'<path d="M210 360 l-20 -90 l60 60 M390 360 l20 -90 l-60 60" fill="#fff2c8" stroke="{INK}" stroke-width="5"/>'
        + blob(d, 'whead', 300, 440, 150, 130, *scale_)
        + mascot_eyes(250, 350, 420, 'normal', 1.0)
        + blob(d, 'wsnout', 300, 500, 70, 44, '#ffc88a', '#d06a1a', 5, False)
        + '<circle cx="280" cy="492" r="7" fill="#2a2230"/><circle cx="320" cy="492" r="7" fill="#2a2230"/>'
        + mouth(300, 520, 'smile', 30)
        + f'<path d="M370 540 q40 -20 50 -60 q10 30 -10 50 q30 -10 30 -40 q20 40 -30 70 z" fill="#fff36b" stroke="#ff6a00" stroke-width="4"/>', 0.8), d)


def ember(expression='normal'):
    """Auntie Ember: a big red grandmother of a dragon, in a knitted shawl and spectacles."""
    d = Defs()
    hide = ('#ff8a5a', '#a0200a')
    eyes_part = {
        'sleepy': closed_eyes(560, 330, 70) + zzz(760, 200),
        'happy': mascot_eyes(490, 630, 330, 'happy', 1.1) + '<ellipse cx="460" cy="400" rx="30" ry="16" fill="#ff5a7a" opacity="0.6"/><ellipse cx="660" cy="400" rx="30" ry="16" fill="#ff5a7a" opacity="0.6"/>',
        'angry': mascot_eyes(490, 630, 330, 'attack', 1.1),
    }.get(expression, mascot_eyes(490, 630, 330, 'normal', 1.1))
    mouth_part = {'sleepy': mouth(560, 470, 'flat', 40), 'happy': mouth(560, 455, 'grin', 70),
                  'angry': mouth(560, 470, 'teeth', 70)}.get(expression, mouth(560, 455, 'smile', 60))
    smoke = ''
    if expression == 'angry':
        smoke = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#9a9aa8" opacity="0.7"/>' for x, y, r in ((500, 300 - 140, 22), (480, 300 - 190, 30), (620, 300 - 140, 22), (640, 300 - 190, 30)))
    body = (f'<path d="M760 {FEET_Y - 60} q260 40 220 -260 q-10 -80 -80 -100 q60 80 20 200 q-30 100 -170 80 z" fill="{d.radial("tail", *hide)}" stroke="{INK}" stroke-width="7"/>'
            + shape(d, 'dwing1', 'M300 520 q-260 -320 -280 -120 q60 0 60 60 q70 -20 80 60 q80 -30 140 0 z', '#ffb86a', '#a0400a', 6)
            + shape(d, 'dwing2', 'M820 520 q260 -320 280 -120 q-60 0 -60 60 q-70 -20 -80 60 q-80 -30 -140 0 z', '#ffb86a', '#a0400a', 6)
            + legs(d, 'dl', (420, 700), *hide, top=FEET_Y - 120, rx=80)
            + blob(d, 'dbody', 560, FEET_Y - 300, 300, 300, *hide)
            + blob(d, 'dbelly', 560, FEET_Y - 250, 180, 220, '#fff2c8', '#e0b060', 5, False)
            + ''.join(f'<path d="M{400} {FEET_Y - y} q160 30 320 0" stroke="#e0b060" stroke-width="5" fill="none"/>' for y in (160, 240, 320, 400))
            + f'<path d="M280 {FEET_Y - 470} q280 160 560 0 l-40 160 q-240 100 -480 0 z" fill="{d.radial("shawl2", "#c89aff", "#5a2a9a")}" stroke="{INK}" stroke-width="6"/>'
            + ''.join(f'<path d="M{x} {FEET_Y - 330} l10 50 M{x + 20} {FEET_Y - 330} l-6 50" stroke="#5a2a9a" stroke-width="6"/>' for x in range(340, 780, 60))
            + ''.join(f'<circle cx="{x}" cy="{FEET_Y - 410}" r="12" fill="#ffd36b" stroke="{INK}" stroke-width="3"/>' for x in (460, 560, 660))
            + f'<path d="M430 250 q-40 -120 -10 -200 q30 90 70 140 z M690 250 q40 -120 10 -200 q-30 90 -70 140 z" fill="#fff2c8" stroke="{INK}" stroke-width="5"/>'
            + blob(d, 'dhead', 560, 350, 230, 190, *hide)
            + blob(d, 'dsnout', 560, 440, 150, 90, '#ffa07a', '#c0401a', 6, False)
            + '<ellipse cx="520" cy="410" rx="14" ry="10" fill="#4a1a10"/><ellipse cx="600" cy="410" rx="14" ry="10" fill="#4a1a10"/>'
            + eyes_part
            + f'<circle cx="490" cy="330" r="62" fill="none" stroke="#d4a017" stroke-width="7"/><circle cx="630" cy="330" r="62" fill="none" stroke="#d4a017" stroke-width="7"/><path d="M552 330 h16" stroke="#d4a017" stroke-width="7"/>'
            + mouth_part + smoke)
    return sprite(shadow(560, 420) + body, d, 1120)


def crown(d, cx, base, w, name):
    """A gold crown, its band on base, w wide."""
    h = w * 0.6
    points = f'M{cx - w / 2} {base} l0 {-h} l{w / 6} {h * 0.5} l{w / 6} {-h * 0.7} l{w / 6} {h * 0.7} l{w / 6} {-h * 0.7} l{w / 6} {h * 0.7} l{w / 6} {-h * 0.5} l0 {h} z'
    return (shape(d, name, points, '#fff6a0', '#d09000', 6)
            + f'<rect x="{cx - w / 2 - 6}" y="{base - 22}" width="{w + 12}" height="30" rx="10" fill="#f0c020" stroke="{INK}" stroke-width="6"/>'
            + ''.join(f'<circle cx="{cx + dx * w}" cy="{base - 7}" r="9" fill="{c}" stroke="{INK}" stroke-width="3"/>' for dx, c in ((-0.3, '#e0304a'), (0, '#3a8ad0'), (0.3, '#30b060'))))


def fungus():
    """King Fungus the Fourth: a royal mushroom, purple cap, gold spots, a crown and a sceptre."""
    d = Defs()
    return sprite(shadow(300, 220) + scaled(
        legs(d, 'kl', (240, 360), '#f0e0c8', '#a08060', top=FEET_Y - 80, rx=50)
        + shape(d, 'cape', f'M150 {FEET_Y - 380} q-80 200 -40 370 h380 q40 -170 -40 -370 z', '#e04050', '#7a1020', 6)
        + ''.join(f'<circle cx="{x}" cy="{FEET_Y - 30}" r="12" fill="#fff" stroke="{INK}" stroke-width="3"/><circle cx="{x}" cy="{FEET_Y - 30}" r="4" fill="{INK}"/>' for x in range(130, 480, 50))
        + shape(d, 'kstem', f'M200 {FEET_Y - 60} q-20 -280 30 -420 h140 q50 140 30 420 z', '#fff8ec', '#c8b090')
        + mascot_eyes(255, 345, FEET_Y - 330, 'normal', 0.9) + brows(300, FEET_Y - 380, 45, 'cross')
        + mouth(300, FEET_Y - 230, 'grin', 40)
        + f'<path d="M230 {FEET_Y - 250} q30 40 70 20 q40 20 70 -20 q-20 60 -70 60 q-50 0 -70 -60 z" fill="#f4f0e8" stroke="{INK}" stroke-width="4"/>'
        + f'<g transform="translate(490 {FEET_Y - 230}) rotate(12)"><rect x="-10" y="-160" width="20" height="230" rx="8" fill="{d.linear("sc", "#fff6a0", "#c08000", 1, 0)}" stroke="{INK}" stroke-width="5"/>'
        + blob(d, 'orb', 0, -180, 36, 36, '#ffe0f0', '#c03080', 5) + '</g>'
        + blob(d, 'kh', 470, FEET_Y - 230, 30, 30, '#fff8ec', '#c8b090', 5, False)
        + shape(d, 'kcap', f'M40 {FEET_Y - 470} q0 -330 260 -340 q260 10 260 340 q-260 60 -520 0 z', '#c88af0', '#4a1a8a', 7)
        + ''.join(f'<ellipse cx="{x}" cy="{FEET_Y - y}" rx="{r}" ry="{r * 0.8}" fill="{d.radial("gs", "#fff6a0", "#d09000")}" stroke="{INK}" stroke-width="3"/>'
                  for x, y, r in ((160, 600, 40), (430, 580, 44), (230, 520, 26), (390, 690, 24), (500, 500, 20)))
        + shine(160, FEET_Y - 720, 40, 20, -30, 0.6)
        + crown(d, 300, FEET_Y - 790, 170, 'kcrown'), 0.85), d)


def rattlebones():
    """Sir Rattlebones the Undefeated: Boney, but a knight, with a plumed helm and a dented shield."""
    d = Defs()
    bone = ('#ffffff', '#b8b4a0')
    ribs = ''.join(f'<path d="M{300 - w} {y} q{w} 30 {2 * w} 0" stroke="{INK}" stroke-width="18" fill="none" stroke-linecap="round"/>'
                   f'<path d="M{300 - w} {y} q{w} 30 {2 * w} 0" stroke="#f4f0e0" stroke-width="10" fill="none" stroke-linecap="round"/>'
                   for w, y in ((90, 470), (100, 520), (95, 570), (80, 620)))
    return sprite(shadow(300, 200) + scaled(
        legs(d, 'rl', (250, 350), *bone, top=FEET_Y - 200, rx=46)
        + f'<rect x="288" y="420" width="24" height="260" rx="10" fill="#f4f0e0" stroke="{INK}" stroke-width="5"/>' + ribs
        + f'<path d="M200 430 q100 -30 200 0 l-6 70 q-94 -24 -188 0 z" fill="{d.linear("pauld", "#e8eef8", "#7a88a0")}" stroke="{INK}" stroke-width="5"/>'
        + blob(d, 'rpelvis', 300, 690, 90, 44, *bone, 5)
        + f'<path d="M410 440 l60 120" stroke="{INK}" stroke-width="26" stroke-linecap="round"/><path d="M410 440 l60 120" stroke="#f4f0e0" stroke-width="16" stroke-linecap="round"/>'
        + f'<g transform="translate(480 560) rotate(20)"><rect x="-12" y="-330" width="24" height="310" fill="{d.linear("rsword", "#ffffff", "#8a98b0", 1, 0)}" stroke="{INK}" stroke-width="5"/><rect x="-60" y="-24" width="120" height="22" rx="8" fill="#c08a2a" stroke="{INK}" stroke-width="5"/></g>'
        + f'<g transform="translate(150 590)">' + shape(d, 'shield', 'M-110 -130 h220 q0 170 -110 240 q-110 -70 -110 -240 z', '#ff8a6a', '#a02010', 7)
        + f'<path d="M0 -130 v240 M-110 -40 h220" stroke="#ffd34d" stroke-width="16"/><path d="M40 -60 l18 14 l-10 20" stroke="{INK}" stroke-width="4" fill="none"/></g>'
        + f'<path d="M300 140 q-60 -120 30 -130 q-10 50 60 60 q-60 10 -90 70 z" fill="{d.radial("plume", "#ff8ad0", "#a01060")}" stroke="{INK}" stroke-width="5"/>'
        + f'<path d="M160 310 q0 -160 140 -170 q140 10 140 170 l0 60 q-140 30 -280 0 z" fill="{d.linear("helm", "#f4f8ff", "#6a7890")}" stroke="{INK}" stroke-width="7"/>'
        + shine(220, 210, 34, 16, -30, 0.8)
        + f'<rect x="190" y="270" width="220" height="40" rx="16" fill="{INK}"/>'
        + '<circle cx="250" cy="290" r="11" fill="#fff"/><circle cx="350" cy="290" r="11" fill="#fff"/>'
        + ''.join(f'<path d="M{x} 330 v34" stroke="{INK}" stroke-width="5"/>' for x in (240, 270, 300, 330, 360))
        + f'<rect x="230" y="385" width="140" height="44" rx="18" fill="#fff" stroke="{INK}" stroke-width="6"/>'
        + ''.join(f'<path d="M{x} 389 v36" stroke="{INK}" stroke-width="4"/>' for x in (265, 300, 335)), 0.95), d)


def goldgrin():
    """Gristle Goldgrin, Chief Executive Goblin: a goblin in a pinstripe suit, top hat, monocle, gold everywhere."""
    d = Defs()
    extra = (f'<path d="M175 {FEET_Y - 330} q125 50 250 0 l-10 215 q-115 30 -230 0 z" fill="{d.radial("suit", "#5a5a7a", "#1a1a2a")}" stroke="{INK}" stroke-width="5"/>'
             + ''.join(f'<path d="M{x} {FEET_Y - 320} v200" stroke="#8a8aaa" stroke-width="2"/>' for x in range(205, 400, 30))
             + f'<path d="M260 {FEET_Y - 335} l40 70 l40 -70 z" fill="#fff" stroke="{INK}" stroke-width="4"/>'
             + f'<path d="M300 {FEET_Y - 300} l-16 20 l16 100 l16 -100 z" fill="#ffd34d" stroke="{INK}" stroke-width="4"/>'
             + f'<path d="M210 {FEET_Y - 280} q90 90 180 0" stroke="#ffd34d" stroke-width="8" fill="none"/>'
             + blob(d, 'medal', 300, FEET_Y - 190, 22, 22, '#fff6a0', '#d09000', 4, False)
             + f'<g transform="translate(470 {FEET_Y - 220})">' + blob(d, 'sack', 0, 0, 70, 80, '#e8c890', '#8a6020', 6)
             + f'<path d="M-30 -70 q30 -30 60 0" stroke="{INK}" stroke-width="6" fill="none"/><text x="0" y="22" text-anchor="middle" font-size="64" font-family="Arial Black, sans-serif" font-weight="900" fill="#ffd34d" stroke="{INK}" stroke-width="3" paint-order="stroke">G</text></g>'
             + blob(d, 'gh2', 420, FEET_Y - 250, 30, 30, '#b8ec8a', '#4f8a2a', 5, False))
    hat = (f'<rect x="200" y="140" width="200" height="190" rx="14" fill="{d.linear("tophat", "#4a4a5a", "#101018")}" stroke="{INK}" stroke-width="6"/>'
           + f'<rect x="200" y="280" width="200" height="34" fill="#ffd34d" stroke="{INK}" stroke-width="4"/>'
           + f'<rect x="150" y="314" width="300" height="30" rx="14" fill="#2a2a3a" stroke="{INK}" stroke-width="6"/>' + shine(240, 180, 20, 30, 0, 0.5)
           + f'<circle cx="345" cy="400" r="44" fill="none" stroke="#ffd34d" stroke-width="8"/><path d="M386 414 q20 60 -10 120" stroke="#ffd34d" stroke-width="4" fill="none"/>'
           + f'<path d="M250 446 q-20 -20 -50 -6 M350 446 q20 -20 50 -6" stroke="{INK}" stroke-width="5" fill="none"/>')
    return sprite(shadow(300, 170) + goblin(d, extra, hat, 'normal', 'grin', False, 0.9, ('#5a5a7a', '#1a1a2a')), d)


def heap():
    """The Lost Property: a lumbering mound of everything ever dropped down the Delve, two lost marbles for eyes."""
    d = Defs()
    junk = (
        # an open umbrella sticking out on the left, a boot on the right, a clock face, keys, a rocking horse's head
        f'<g transform="translate(150 {FEET_Y - 470}) rotate(-35)"><path d="M-110 0 q110 -130 220 0 q-27 -20 -55 0 q-27 -20 -55 0 q-27 -20 -55 0 q-27 -20 -55 0 z" fill="{d.radial("umb", "#ff8ad0", "#a01060")}" stroke="{INK}" stroke-width="6"/>'
        f'<path d="M0 -60 v170 q0 24 -22 24" stroke="{INK}" stroke-width="8" fill="none" stroke-linecap="round"/></g>'
        + f'<g transform="translate(590 {FEET_Y - 290}) rotate(20)"><path d="M-40 -110 h70 v120 h70 q20 0 20 30 v20 h-160 z" fill="{d.radial("boot", "#c8864a", "#5a2a0a")}" stroke="{INK}" stroke-width="6"/></g>'
        + f'<g transform="translate(110 {FEET_Y - 200}) rotate(-10)"><path d="M0 0 q-20 -90 50 -110 q40 -10 60 30 l-20 20 q-20 -20 -40 0 l10 70 z" fill="{d.radial("horse", "#fff2c8", "#c0904a")}" stroke="{INK}" stroke-width="6"/><circle cx="60" cy="-80" r="8" fill="{INK}"/>'
        f'<path d="M30 -110 q-30 -20 -40 20" stroke="#c0392b" stroke-width="10" fill="none" stroke-linecap="round"/></g>'
    )
    keys = ''.join(f'<g transform="translate({x} {y}) rotate({a})"><circle cx="0" cy="0" r="16" fill="none" stroke="#d4a017" stroke-width="7"/><path d="M16 0 h44 v12 M48 0 v10" stroke="#d4a017" stroke-width="7" fill="none"/></g>'
                   for x, y, a in ((250, FEET_Y - 150, 20), (520, FEET_Y - 120, -30), (430, FEET_Y - 520, 60), (300, FEET_Y - 330, 140)))
    socks = ''.join(f'<g transform="rotate(-15 {x} {y})"><path d="M{x} {y} v56 q0 30 30 30 h26 q14 0 14 -14 q0 -14 -14 -14 h-26 v-58 z" fill="{c}" stroke="{INK}" stroke-width="5"/>'
                    f'<path d="M{x} {y + 14} h30" stroke="#fff" stroke-width="8"/></g>' for x, y, c in ((380, FEET_Y - 200, '#6ad0ff'), (560, FEET_Y - 440, '#a0ff8a'), (190, FEET_Y - 380, '#ffd34d')))
    clock = (f'<g transform="translate(560 {FEET_Y - 600})"><rect x="-50" y="-120" width="100" height="220" rx="16" fill="{d.linear("clk", "#c8864a", "#5a2a0a", 1, 0)}" stroke="{INK}" stroke-width="6"/>'
             f'<circle cx="0" cy="-60" r="38" fill="#fff8e0" stroke="{INK}" stroke-width="5"/><path d="M0 -60 v-26 M0 -60 l18 10" stroke="{INK}" stroke-width="5" stroke-linecap="round"/></g>')
    cake = (f'<g transform="translate(350 {FEET_Y - 670})"><rect x="-90" y="-40" width="180" height="70" rx="10" fill="{d.linear("cake", "#fff8f0", "#f0c8d8")}" stroke="{INK}" stroke-width="5"/>'
            f'<rect x="-55" y="-90" width="110" height="55" rx="10" fill="{d.linear("cake2", "#fff8f0", "#f0c8d8")}" stroke="{INK}" stroke-width="5"/>'
            f'<path d="M-90 -10 q22 18 45 0 q22 18 45 0 q22 18 45 0 q22 18 45 0" stroke="#ff8ad0" stroke-width="6" fill="none"/>'
            + shine(-30, -70, 20, 8, -10, 0.8) + '</g>')
    body = (blob(d, 'pile', 360, FEET_Y - 330, 300, 320, '#b8b0c8', '#4a4458')
            + ''.join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{c}" stroke="{INK}" stroke-width="4" opacity="0.9"/>'
                      for x, y, rx, ry, c in ((230, FEET_Y - 250, 60, 40, '#8a7aa8'), (480, FEET_Y - 220, 70, 46, '#7a8aa8'), (360, FEET_Y - 470, 80, 50, '#9a8ab0'), (230, FEET_Y - 560, 50, 36, '#8a9ab8')))
            + junk + socks + keys + clock + cake
            # two lost marbles for eyes, glaring
            + f'<circle cx="300" cy="{FEET_Y - 380}" r="44" fill="{d.radial("marb1", "#bff0ff", "#1a6ab0")}" stroke="{INK}" stroke-width="6"/>'
            + f'<circle cx="430" cy="{FEET_Y - 380}" r="44" fill="{d.radial("marb2", "#ffd0f0", "#a01a8a")}" stroke="{INK}" stroke-width="6"/>'
            + f'<circle cx="310" cy="{FEET_Y - 375}" r="16" fill="{INK}"/><circle cx="420" cy="{FEET_Y - 375}" r="16" fill="{INK}"/>'
            + shine(288, FEET_Y - 398, 14, 8, -30, 0.9) + shine(418, FEET_Y - 398, 14, 8, -30, 0.9)
            + brows(365, FEET_Y - 440, 65, 'cross')
            + f'<path d="M290 {FEET_Y - 280} q75 -40 150 0" stroke="{INK}" stroke-width="9" fill="none" stroke-linecap="round"/>'
            + f'<path d="M300 {FEET_Y - 284} l20 22 l18 -26 l20 22 l18 -26 l20 22 l20 -20" fill="#fff" stroke="{INK}" stroke-width="4"/>')
    return sprite(shadow(360, 330) + scaled(body, 1.05, 360), d, 760)


def flint():
    """Great-Uncle Flint: a dragon so old he has gone half to stone; bushy white brows, ear trumpet, cardigan, walking stick."""
    d = Defs()
    stone = ('#d8d0c4', '#5a5248')
    cracks = ''.join(f'<path d="{p}" stroke="#4a4038" stroke-width="5" fill="none" stroke-linecap="round"/>'
                     for p in ('M420 300 l30 40 l-10 40', 'M700 520 l-40 30 l10 50', 'M380 620 l50 20', 'M760 300 l-30 30'))
    moss = ''.join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="#7ab04a" stroke="{INK}" stroke-width="3" opacity="0.9"/>' for x, y, rx, ry in ((470, 200, 40, 16), (650, 210, 34, 14), (330, 560, 30, 12)))
    body = (f'<path d="M760 {FEET_Y - 60} q260 40 220 -240 q-10 -80 -80 -100 q60 80 20 190 q-30 100 -170 80 z" fill="{d.radial("ftail", *stone)}" stroke="{INK}" stroke-width="7"/>'
            + shape(d, 'fwing1', 'M300 520 q-200 -240 -240 -100 q50 0 50 50 q60 -10 70 50 q70 -20 120 0 z', '#c8c0b4', '#6a6258', 6)
            + shape(d, 'fwing2', 'M820 520 q200 -240 240 -100 q-50 0 -50 50 q-60 -10 -70 50 q-70 -20 -120 0 z', '#c8c0b4', '#6a6258', 6)
            + f'<path d="M1010 470 l20 40 M1000 520 l30 10" stroke="#4a4038" stroke-width="5"/>'
            + legs(d, 'fl', (430, 690), *stone, top=FEET_Y - 120, rx=80)
            + blob(d, 'fbody', 560, FEET_Y - 300, 300, 290, *stone)
            # a knitted cardigan, buttoned wrong
            + f'<path d="M290 {FEET_Y - 480} q270 120 540 0 l-30 330 q-240 70 -480 0 z" fill="{d.radial("cardi", "#9ad0a0", "#2a6a3a")}" stroke="{INK}" stroke-width="6"/>'
            + f'<path d="M560 {FEET_Y - 420} v300" stroke="{INK}" stroke-width="5"/>'
            + ''.join(f'<circle cx="{530 if i % 2 else 590}" cy="{FEET_Y - 390 + i * 70}" r="14" fill="#c8864a" stroke="{INK}" stroke-width="4"/>' for i in range(4))
            + ''.join(f'<path d="M{x} {FEET_Y - 460} v300" stroke="#2a6a3a" stroke-width="4" opacity="0.6"/>' for x in range(330, 800, 40))
            # horns worn down to stubs
            + f'<path d="M430 230 q-20 -70 10 -110 q20 60 50 90 z M690 230 q20 -70 -10 -110 q-20 60 -50 90 z" fill="#efe6d0" stroke="{INK}" stroke-width="5"/>'
            + blob(d, 'fhead', 560, 340, 220, 180, *stone)
            + blob(d, 'fsnout', 560, 440, 150, 86, '#e0d8cc', '#6a6258', 6, False)
            + '<ellipse cx="520" cy="412" rx="14" ry="9" fill="#3a3028"/><ellipse cx="600" cy="412" rx="14" ry="9" fill="#3a3028"/>'
            + mascot_eyes(490, 630, 340, 'normal', 0.9)
            # bushy white eyebrows, cross
            + f'<path d="M420 280 q40 -50 110 -10 q-30 -40 -80 -30 q-10 -20 -40 0 z M700 280 q-40 -50 -110 -10 q30 -40 80 -30 q10 -20 40 0 z" fill="#fff" stroke="{INK}" stroke-width="5"/>'
            + mouth(560, 470, 'frown', 50)
            # a long white moustache-beard
            + f'<path d="M470 470 q-60 40 -40 140 q40 -60 80 -100 z M650 470 q60 40 40 140 q-40 -60 -80 -100 z" fill="#fff" stroke="{INK}" stroke-width="5"/>'
            # an ear trumpet
            + f'<g transform="translate(352 360) rotate(-15)"><path d="M0 0 l-110 -50 q-30 50 0 100 z" fill="{d.radial("trumpet", "#fff6a0", "#b07a0a")}" stroke="{INK}" stroke-width="6"/><rect x="-6" y="-10" width="60" height="20" rx="8" fill="#d4a017" stroke="{INK}" stroke-width="5"/></g>'
            # the walking stick
            + f'<path d="M900 {FEET_Y} v-430 q0 -60 50 -60 q50 0 50 50" stroke="#5a2a0a" stroke-width="26" fill="none" stroke-linecap="round"/>'
            + f'<path d="M900 {FEET_Y} v-430 q0 -60 50 -60 q50 0 50 50" stroke="#a0602a" stroke-width="14" fill="none" stroke-linecap="round"/>'
            + blob(d, 'fhand', 880, FEET_Y - 330, 46, 40, *stone, 5, False)
            + cracks + moss)
    return sprite(shadow(560, 420) + body, d, 1120)


FOES = {'gloop': gloop, 'rat': rat, 'intern': intern, 'shroom': shroom, 'bats': bats, 'clerk': clerk, 'boney': boney, 'ghost': ghost,
        'mummy': mummy, 'imp': imp, 'golem': golem, 'foreman': foreman, 'mimic': mimic, 'whelp': whelp,
        'fungus': fungus, 'rattlebones': rattlebones, 'goldgrin': goldgrin, 'heap': heap, 'flint': flint}


# ------------------------------------------------------------------------------------- props of the odd rooms

STONE = ('#d8d4cc', '#6a6460')


def well():
    d = Defs()
    return sprite(shadow(300, 230) + scaled(
        f'<rect x="150" y="300" width="22" height="400" fill="#8a5a2a" stroke="{INK}" stroke-width="5"/><rect x="428" y="300" width="22" height="400" fill="#8a5a2a" stroke="{INK}" stroke-width="5"/>'
        + shape(d, 'roof', 'M110 320 l190 -150 l190 150 z', '#ff8a6a', '#a02a1a')
        + f'<path d="M300 320 v260" stroke="{INK}" stroke-width="4"/><rect x="276" y="560" width="48" height="50" rx="8" fill="#8a5a2a" stroke="{INK}" stroke-width="4"/>'
        + f'<ellipse cx="300" cy="650" rx="200" ry="50" fill="#1a2a3a" stroke="{INK}" stroke-width="6"/>'
        + f'<path d="M100 650 v170 q200 70 400 0 v-170 q-200 70 -400 0 z" fill="{d.radial("wellstone", *STONE)}" stroke="{INK}" stroke-width="6"/>'
        + ''.join(f'<path d="M{x} {y} h70" stroke="#8a8480" stroke-width="4"/>' for x, y in ((130, 720), (260, 740), (390, 720), (190, 790), (330, 800)))
        + f'<rect x="330" y="560" width="200" height="70" rx="8" fill="#fff8e0" stroke="{INK}" stroke-width="4" transform="rotate(8 430 595)"/>'
        f'<text x="430" y="605" text-anchor="middle" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="#5a3010" transform="rotate(8 430 595)">10 GOLD</text>', 0.9), d)


def talkingdoor():
    d = Defs()
    return sprite(shadow(300, 220) + scaled(
        f'<path d="M110 {FEET_Y} v-500 q190 -200 380 0 v500 z" fill="{d.radial("doorstone", *STONE)}" stroke="{INK}" stroke-width="7"/>'
        + f'<path d="M150 {FEET_Y} v-470 q150 -160 300 0 v470 z" fill="{d.linear("plank", "#c8864a", "#6a3a14", 1, 0)}" stroke="{INK}" stroke-width="6"/>'
        + ''.join(f'<path d="M{x} {FEET_Y} v-{h}" stroke="#5a2a0a" stroke-width="4"/>' for x, h in ((225, 560), (300, 600), (375, 560)))
        + mascot_eyes(250, 350, FEET_Y - 420, 'think', 0.9)
        + blob(d, 'knob', 300, FEET_Y - 330, 30, 30, '#fff6b0', '#c88a0a', 5)
        + mouth(300, FEET_Y - 260, 'open', 50)
        + f'<rect x="270" y="{FEET_Y - 170}" width="60" height="24" rx="4" fill="#d4a017" stroke="{INK}" stroke-width="4"/>', 0.9), d)


def fountain():
    d = Defs()
    water = d.radial('water', '#ffd0e8', '#e0508a')
    return sprite(shadow(300, 240) + scaled(
        f'<path d="M80 {FEET_Y - 160} q220 60 440 0 v120 q-220 70 -440 0 z" fill="{d.radial("bowl", *STONE)}" stroke="{INK}" stroke-width="6"/>'
        + f'<ellipse cx="300" cy="{FEET_Y - 160}" rx="220" ry="40" fill="{water}" stroke="{INK}" stroke-width="6"/>'
        + f'<rect x="270" y="{FEET_Y - 420}" width="60" height="260" fill="{d.linear("pillar", "#eeeae2", "#8a8480", 1, 0)}" stroke="{INK}" stroke-width="5"/>'
        + f'<ellipse cx="300" cy="{FEET_Y - 420}" rx="110" ry="26" fill="{water}" stroke="{INK}" stroke-width="5"/>'
        + f'<path d="M300 {FEET_Y - 440} q-20 -120 -120 -60 q-40 30 -40 230 M300 {FEET_Y - 440} q20 -120 120 -60 q40 30 40 230" stroke="#ff8ab8" stroke-width="12" fill="none" opacity="0.8"/>'
        + shine(220, FEET_Y - 172, 40, 8, 0, 0.7), 0.95), d)


def mushrooms():
    d = Defs()

    def one(x, s, color, name):
        return (f'<g transform="translate({x} {FEET_Y}) scale({s})">'
                + f'<rect x="-28" y="-150" width="56" height="150" rx="20" fill="#fff8ec" stroke="{INK}" stroke-width="5"/>'
                + shape(d, name, 'M-100 -140 q0 -110 100 -110 q100 0 100 110 q-100 30 -200 0 z', *color, 6)
                + ''.join(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff"/>' for cx, cy, r in ((-50, -190, 16), (20, -220, 20), (60, -170, 12)))
                + closed_eyes(0, -90, 14).replace('stroke-width="8"', 'stroke-width="5"')
                + '</g>')
    notes = f'<text x="100" y="{FEET_Y - 420}" font-size="70" fill="#fff" stroke="{INK}" stroke-width="3" paint-order="stroke">♪</text>'
    return sprite(shadow(300, 270) + one(90, 0.7, ('#c89aff', '#5a2a9a'), 'm1') + one(510, 0.75, ('#8ad0ff', '#1a5a9a'), 'm2')
                  + one(200, 1.0, ('#ff8a6a', '#a01010'), 'm3') + one(400, 1.05, ('#ffd36b', '#b07000'), 'm4') + one(300, 0.6, ('#9aff8a', '#1a8a2a'), 'm5') + notes, d)


def shrine():
    d = Defs()
    return sprite(shadow(300, 220) + scaled(
        f'<path d="M120 {FEET_Y} v-120 h360 v120 z" fill="{d.radial("plinth", *STONE)}" stroke="{INK}" stroke-width="6"/>'
        + f'<path d="M150 {FEET_Y - 120} v-80 h300 v80 z" fill="{d.radial("plinth2", *STONE)}" stroke="{INK}" stroke-width="6"/>'
        + f'<g transform="translate(300 {FEET_Y - 200}) scale(0.5) translate(-300 -{FEET_Y})">'
        + blob(d, 'sbody', 300, 640, 150, 180, '#f4f0e8', '#8a8478')
        + shape(d, 'sbeard', 'M180 420 q-20 220 120 330 q140 -110 120 -330 q-60 70 -120 70 q-60 0 -120 -70 z', '#ffffff', '#a8a49a', 6)
        + blob(d, 'shead', 300, 380, 130, 120, '#f4f0e8', '#8a8478')
        + closed_eyes(300, 370, 45) + blob(d, 'snose', 300, 410, 30, 26, '#ffffff', '#a8a49a', 5)
        + f'<ellipse cx="300" cy="240" rx="150" ry="30" fill="none" stroke="#ffd34d" stroke-width="16"/>'
        + '</g>'
        + ''.join(f'<rect x="{x}" y="{FEET_Y - 170}" width="22" height="50" fill="#fff8e0" stroke="{INK}" stroke-width="3"/><path d="M{x + 11} {FEET_Y - 175} q-10 -16 0 -30 q10 14 0 30 z" fill="#ffb020"/>' for x in (130, 450)), 0.95), d)


def rubble():
    d = Defs()
    rocks = ''.join(blob(d, f'r{i}', x, FEET_Y - y, rx, ry, *STONE, 6) for i, (x, y, rx, ry) in enumerate(
        ((150, 80, 110, 80), (420, 90, 130, 90), (290, 120, 120, 100), (200, 250, 90, 70), (380, 260, 100, 80), (300, 380, 80, 60))))
    gem = f'<path d="M260 {FEET_Y - 200} l20 -24 h30 l20 24 l-35 40 z" fill="#5af0ff" stroke="{INK}" stroke-width="4"/>' + shine(285, FEET_Y - 212, 6, 4, 0, 0.9)
    return sprite(shadow(300, 270) + rocks + gem, d)


def campfire():
    d = Defs()
    return sprite(shadow(300, 200) + scaled(
        ''.join(f'<rect x="150" y="{FEET_Y - 60}" width="300" height="44" rx="22" fill="#8a5a2a" stroke="{INK}" stroke-width="5" transform="rotate({a} 300 {FEET_Y - 38})"/>' for a in (-15, 15))
        + shape(d, 'fire', f'M210 {FEET_Y - 60} q-40 -160 40 -260 q0 80 40 80 q-10 -100 50 -160 q20 110 60 140 q40 -50 30 -100 q70 110 10 300 z', '#fff36b', '#ff4a00', 5)
        + shape(d, 'fire2', f'M260 {FEET_Y - 70} q-20 -90 30 -140 q10 60 30 60 q10 -40 30 -60 q30 80 -10 140 z', '#ffffff', '#ffd000', 0)
        + f'<path d="M420 {FEET_Y - 210} v-80" stroke="#6a6a6a" stroke-width="8"/>'
        + f'<g transform="translate(470 {FEET_Y - 70})"><path d="M-60 0 q0 -90 60 -90 q60 0 60 90 z" fill="{d.radial("kettle", "#b8c8d8", "#3a4a5a")}" stroke="{INK}" stroke-width="5"/><path d="M50 -50 l40 -20" stroke="{INK}" stroke-width="10"/></g>', 0.95), d)


def sign():
    d = Defs()
    return sprite(shadow(300, 140) + scaled(
        f'<rect x="285" y="{FEET_Y - 430}" width="30" height="430" fill="#8a5a2a" stroke="{INK}" stroke-width="5"/>'
        + f'<rect x="70" y="{FEET_Y - 600}" width="460" height="230" rx="16" fill="{d.linear("board", "#ffe0a8", "#c08a4a")}" stroke="{INK}" stroke-width="7" transform="rotate(-4 300 {FEET_Y - 485})"/>'
        + ''.join(f'<text x="300" y="{FEET_Y - y}" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900" font-size="{fs}" fill="#5a2a0a" transform="rotate(-4 300 {FEET_Y - 485})">{t}</text>'
                  for t, y, fs in (('DEFINITELY', 530, 46), ('NO TREASURE', 470, 46), ('BEHIND THIS', 410, 40))), 0.9), d)


def levers():
    d = Defs()
    out = f'<rect x="60" y="{FEET_Y - 520}" width="480" height="380" rx="20" fill="{d.radial("panel", *STONE)}" stroke="{INK}" stroke-width="7"/>'
    for x, label, color, angle in ((160, 'GOOD', '#5ad07a', -20), (300, 'BAD', '#ff5a5a', 10), (440, '???', '#c89aff', -5)):
        out += (f'<rect x="{x - 30}" y="{FEET_Y - 260}" width="60" height="40" rx="8" fill="#5a5a6a" stroke="{INK}" stroke-width="4"/>'
                f'<g transform="rotate({angle} {x} {FEET_Y - 240})"><rect x="{x - 8}" y="{FEET_Y - 420}" width="16" height="180" fill="#9aa0aa" stroke="{INK}" stroke-width="4"/></g>'
                + f'<g transform="rotate({angle} {x} {FEET_Y - 240})">' + blob(d, f'lk{x}', x, FEET_Y - 430, 28, 28, '#ffffff', color, 5) + '</g>'
                + f'<text x="{x}" y="{FEET_Y - 170}" text-anchor="middle" font-family="Arial Black, sans-serif" font-weight="900" font-size="34" fill="#3a3030">{label}</text>')
    return sprite(shadow(300, 220) + out, d)


def mirror():
    d = Defs()
    return sprite(shadow(300, 170) + scaled(
        f'<rect x="200" y="{FEET_Y - 80}" width="200" height="80" rx="10" fill="#8a5a2a" stroke="{INK}" stroke-width="5"/>'
        + f'<ellipse cx="300" cy="{FEET_Y - 420}" rx="190" ry="270" fill="{d.radial("frame", "#fff6b0", "#b07800")}" stroke="{INK}" stroke-width="7"/>'
        + f'<ellipse cx="300" cy="{FEET_Y - 420}" rx="150" ry="230" fill="{d.radial("glass", "#e8f4ff", "#6a8ab0", 0.3, 0.2)}" stroke="{INK}" stroke-width="5"/>'
        + f'<path d="M190 {FEET_Y - 580} l60 -60 M200 {FEET_Y - 520} l100 -100" stroke="#fff" stroke-width="12" opacity="0.7"/>'
        + mascot_eyes(250, 350, FEET_Y - 460, 'think', 0.9) + mouth(300, FEET_Y - 330, 'grin', 56), 0.9), d)


def bookshelf():
    d = Defs()
    books = ''
    colours = ('#c0392b', '#2a7ad0', '#5ad07a', '#d4a017', '#8a4ad0', '#e07a2a')
    for shelf, y in enumerate((FEET_Y - 600, FEET_Y - 420, FEET_Y - 240)):
        x = 110
        for i in range(8):
            w = 36 + (i * 7 + shelf * 5) % 22
            h = 130 + (i * 13 + shelf * 7) % 30
            books += f'<rect x="{x}" y="{y + 160 - h}" width="{w}" height="{h}" rx="4" fill="{colours[(i + shelf) % 6]}" stroke="{INK}" stroke-width="4"/>'
            books += f'<path d="M{x + 6} {y + 180 - h} h{w - 12}" stroke="#fff" stroke-width="4" opacity="0.6"/>'
            x += w + 6
    return sprite(shadow(300, 230) + scaled(
        f'<rect x="80" y="{FEET_Y - 640}" width="440" height="640" rx="10" fill="{d.linear("shelfwood", "#b0703a", "#5a2a0a", 1, 0)}" stroke="{INK}" stroke-width="7"/>'
        + f'<rect x="100" y="{FEET_Y - 620}" width="400" height="600" fill="#3a1a08"/>'
        + ''.join(f'<rect x="90" y="{y + 160}" width="420" height="20" fill="#8a5a2a" stroke="{INK}" stroke-width="4"/>' for y in (FEET_Y - 600, FEET_Y - 420, FEET_Y - 240))
        + books, 0.95), d)


PROPS = {'well': well, 'talkingdoor': talkingdoor, 'fountain': fountain, 'mushrooms': mushrooms, 'shrine': shrine, 'rubble': rubble,
         'campfire': campfire, 'sign': sign, 'levers': levers, 'mirror': mirror, 'bookshelf': bookshelf}


# ------------------------------------------------------------------------------------- the grid's tiles

def tile(kind):
    d = Defs()
    plate = (f'<rect x="8" y="8" width="184" height="184" rx="30" fill="{d.radial("plate", "#5a4a6a", "#1e1828", 0.4, 0.3)}" stroke="#0e0a14" stroke-width="6"/>')
    if kind == 'chest':
        icon = (f'<rect x="36" y="86" width="128" height="80" rx="8" fill="{d.linear("cw", "#d8965a", "#6a3a14")}" stroke="{INK}" stroke-width="5"/>'
                f'<path d="M36 90 q64 -70 128 0 z" fill="{d.linear("cl", "#e8a66a", "#8a4a1a")}" stroke="{INK}" stroke-width="5"/>'
                f'<path d="M36 92 h128 M60 166 v-74 M140 166 v-74" stroke="#d4a017" stroke-width="8"/>'
                + blob(d, 'lock', 100, 104, 14, 16, '#fff6b0', '#c88a0a', 4, False))
    elif kind == 'gold':
        icon = ''.join(blob(d, f'c{i}', x, y, 34, 22, '#fff6b0', '#c88a0a', 4) for i, (x, y) in enumerate(((70, 140), (130, 140), (100, 116), (80, 92), (122, 88), (100, 64))))
    elif kind == 'potion':
        icon = potion_bottle(100, 130, '#ff4f7a', 1.1)
    elif kind == 'bomb':
        icon = (blob(d, 'bomb', 96, 118, 52, 52, '#6a6a7a', '#101018', 5)
                + f'<path d="M130 76 q20 -30 40 -20" stroke="#8a5a2a" stroke-width="7" fill="none"/>'
                + f'<path d="M170 50 l8 -14 l4 16 l14 -4 l-12 10 l10 10 l-14 -2 l-4 14 l-4 -16 z" fill="#ffd34d" stroke="#ff6a00" stroke-width="3"/>')
    elif kind == 'gem':
        icon = (f'<path d="M50 80 l30 -34 h40 l30 34 l-50 80 z" fill="{d.linear("gem", "#bfffff", "#1a9ad0", 1, 1)}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
                f'<path d="M50 80 h100 M80 46 l20 114 l20 -114" stroke="#0a5a8a" stroke-width="3" fill="none"/>' + shine(84, 64, 8, 5, 0, 0.9))
    elif kind == 'rope':
        icon = ''.join(f'<ellipse cx="100" cy="{110 + i * 4}" rx="{62 - i * 10}" ry="{40 - i * 6}" fill="none" stroke="{INK}" stroke-width="14"/><ellipse cx="100" cy="{110 + i * 4}" rx="{62 - i * 10}" ry="{40 - i * 6}" fill="none" stroke="#d8b07a" stroke-width="9"/>' for i in range(4)) \
            + f'<path d="M150 120 q30 30 10 60" stroke="#d8b07a" stroke-width="9" fill="none"/>'
    elif kind == 'scroll':
        icon = (f'<rect x="50" y="56" width="100" height="100" fill="#fff4d0" stroke="{INK}" stroke-width="5"/>'
                + blob(d, 'roll1', 100, 54, 62, 14, '#fff8e0', '#c8a060', 5, False) + blob(d, 'roll2', 100, 158, 62, 14, '#fff8e0', '#c8a060', 5, False)
                + ''.join(f'<path d="M66 {y} h68" stroke="#8a7a5a" stroke-width="4"/>' for y in (86, 104, 122, 140))
                + '<circle cx="128" cy="140" r="12" fill="#c0392b"/>')
    elif kind == 'sock':
        icon = (f'<path d="M80 40 h50 v80 q0 30 -30 40 l-40 14 q-30 6 -36 -20 q-4 -24 24 -32 l32 -10 z" fill="{d.linear("sock", "#ff8ab8", "#c0306a")}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
                f'<path d="M80 60 h50 M80 80 h50" stroke="#fff" stroke-width="8"/><circle cx="60" cy="150" r="7" fill="{INK}" opacity="0.5"/>')
    else:
        icon = (f'<path d="M100 100 q-50 -60 -70 -20 q10 40 70 30 z M100 100 q50 -60 70 -20 q-10 40 -70 30 z" fill="#d8ccb0" stroke="{INK}" stroke-width="4"/>'
                f'<path d="M100 100 q-40 40 -50 30 q0 -20 50 -30 z M100 100 q40 40 50 30 q0 -20 -50 -30 z" fill="#c8bca0" stroke="{INK}" stroke-width="4"/>'
                f'<ellipse cx="100" cy="104" rx="8" ry="26" fill="#8a7a6a" stroke="{INK}" stroke-width="3"/>'
                f'<path d="M96 80 q-10 -20 -20 -24 M104 80 q10 -20 20 -24" stroke="{INK}" stroke-width="3" fill="none"/>'
                f'<text x="140" y="170" font-family="Arial Black" font-size="28" fill="#fff" opacity="0.7">...</text>')
    return picture(200, 200, plate + icon, d)


TILES = ('chest', 'gold', 'potion', 'bomb', 'gem', 'rope', 'scroll', 'sock', 'moth')


# ------------------------------------------------------------------------------------- backgrounds

W, H = 1920, 1080


def scene(body, defs):
    return picture(W, H, body, defs)


def house(d, x, y, s, wall, roof, name):
    """A Mossbottom house: round door, round window, a roof like a tea cosy."""
    return (f'<g transform="translate({x} {y}) scale({s})">'
            f'<rect x="-150" y="-220" width="300" height="220" rx="30" fill="{d.radial(name + "w", *wall)}" stroke="{INK}" stroke-width="6"/>'
            + shape(d, name + 'r', 'M-190 -200 q0 -200 190 -220 q190 20 190 220 z', *roof, 6)
            + f'<path d="M-50 0 v-90 a50 50 0 0 1 100 0 v90 z" fill="#3a8a4a" stroke="{INK}" stroke-width="5"/><circle cx="30" cy="-50" r="7" fill="#ffd34d"/>'
            + f'<circle cx="-95" cy="-130" r="34" fill="#fff6c0" stroke="{INK}" stroke-width="5"/><path d="M-95 -164 v68 M-129 -130 h68" stroke="{INK}" stroke-width="4"/>'
            + f'<rect x="80" y="-420" width="40" height="80" fill="#a05a3a" stroke="{INK}" stroke-width="5"/></g>')


def bunting(y, x0=0, x1=W):
    colours = ('#ff5a5a', '#ffd34d', '#5ab0ff', '#7ad957')
    flags = ''.join(f'<path d="M{x} {y + 30 * ((x // 80) % 2)} l40 0 l-20 46 z" fill="{colours[(x // 80) % 4]}" stroke="{INK}" stroke-width="3"/>' for x in range(x0, x1, 80))
    return f'<path d="M{x0} {y} q{(x1 - x0) / 2} 60 {x1 - x0} 0" stroke="{INK}" stroke-width="3" fill="none"/>' + flags


def town():
    d = Defs()
    sky = d.linear('sky', '#6ac4ff', '#e8f6ff')
    return scene(
        f'<rect width="{W}" height="{H}" fill="{sky}"/>'
        + f'<circle cx="1660" cy="170" r="90" fill="#fff6b0"/>' + shine(1640, 150, 40, 30, 0, 0.6)
        + ''.join(f'<g opacity="0.95"><ellipse cx="{x}" cy="{y}" rx="120" ry="40" fill="#fff"/><ellipse cx="{x + 70}" cy="{y - 24}" rx="80" ry="40" fill="#fff"/></g>' for x, y in ((300, 160), (900, 110), (1300, 220)))
        + f'<path d="M0 470 q300 -200 640 -60 q360 -220 760 -40 q300 -110 520 20 v200 h-1920 z" fill="{d.linear("hill", "#9ad46a", "#4f9a3a")}"/>'
        + house(d, 260, 640, 1.0, ('#fff4d8', '#d8b88a'), ('#ff8a5a', '#a03a1a'), 'h1')
        + house(d, 700, 600, 0.8, ('#e8f0ff', '#a8b8d8'), ('#7ab0ff', '#1a4a9a'), 'h2')
        + house(d, 1250, 610, 0.85, ('#fff0f0', '#d8a8a8'), ('#ffb0d0', '#a03a6a'), 'h3')
        + house(d, 1700, 650, 1.05, ('#f4ffe8', '#b8d8a0'), ('#ffd36b', '#a07000'), 'h4')
        + f'<rect y="640" width="{W}" height="440" fill="{d.linear("square", "#e8d8b8", "#b89a70")}"/>'
        + ''.join(f'<ellipse cx="{x + (y % 2) * 60}" cy="{680 + y * 60}" rx="50" ry="16" fill="#c8b088" opacity="0.6"/>' for y in range(7) for x in range(40, W, 140))
        + f'<path d="M860 760 v-90 h200 v90 z" fill="{d.radial("plinthT", *STONE)}" stroke="{INK}" stroke-width="6"/>'
        + f'<ellipse cx="960" cy="670" rx="110" ry="20" fill="#8a8480" stroke="{INK}" stroke-width="5"/>'
        + f'<text x="960" y="730" text-anchor="middle" font-family="Georgia, serif" font-size="28" font-weight="bold" fill="#5a4a3a">CHEESE</text>'
        + f'<text x="960" y="620" text-anchor="middle" font-family="Georgia, serif" font-size="60" fill="#5a4a3a">?</text>'
        + bunting(330, 0, W), d)


def interior(d, wall, floor):
    return (f'<rect width="{W}" height="{H}" fill="{d.linear("wall", *wall)}"/>'
            + ''.join(f'<path d="M{x} 0 v720" stroke="#000" stroke-width="4" opacity="0.15"/>' for x in range(0, W, 160))
            + f'<rect y="720" width="{W}" height="360" fill="{d.linear("floor", *floor)}"/>'
            + ''.join(f'<path d="M0 {y} h{W}" stroke="#000" stroke-width="3" opacity="0.15"/>' for y in range(760, H, 60)))


def shelf_row(d, y, x0, x1, seed):
    out = f'<rect x="{x0}" y="{y}" width="{x1 - x0}" height="24" fill="#8a5a2a" stroke="{INK}" stroke-width="5"/>'
    colours = ('#ff4f7a', '#5ab0ff', '#7ad957', '#ffd34d', '#c89aff')
    x = x0 + 40
    i = seed
    while x < x1 - 60:
        kind = i % 3
        if kind == 0:
            out += potion_bottle(x, y - 6, colours[i % 5], 0.7)
        elif kind == 1:
            out += f'<rect x="{x - 30}" y="{y - 110}" width="60" height="110" rx="6" fill="{colours[(i + 2) % 5]}" stroke="{INK}" stroke-width="4"/>'
        else:
            out += blob(d, f'jar{y}{x}', x, y - 40, 40, 40, '#ffffff', colours[(i + 1) % 5], 4)
        x += 110
        i += 1
    return out


def shop():
    d = Defs()
    cat = (f'<g transform="translate(1500 640)"><ellipse cx="0" cy="0" rx="110" ry="60" fill="{d.radial("cat", "#ffb86a", "#c0600a")}" stroke="{INK}" stroke-width="5"/>'
           f'<circle cx="-90" cy="-40" r="56" fill="{d.radial("cathead", "#ffb86a", "#c0600a")}" stroke="{INK}" stroke-width="5"/>'
           f'<path d="M-130 -80 l0 -40 l30 24 M-60 -84 l10 -40 l-34 20" fill="#ffb86a" stroke="{INK}" stroke-width="5"/>'
           + closed_eyes(-90, -40, 20).replace('stroke-width="8"', 'stroke-width="5"')
           + f'<path d="M100 0 q60 -10 50 -60" stroke="#c0600a" stroke-width="22" fill="none" stroke-linecap="round"/></g>'
           + f'<rect x="1360" y="520" width="240" height="60" rx="8" fill="#fff8e0" stroke="{INK}" stroke-width="4"/><text x="1480" y="560" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="28" fill="#5a2a0a">NOT FOR SALE</text>')
    return scene(
        interior(d, ('#c8a0d8', '#7a5090'), ('#b07a4a', '#6a3a14'))
        + f'<rect x="100" y="80" width="1720" height="560" fill="#5a2a0a" stroke="{INK}" stroke-width="8"/>'
        + shelf_row(d, 240, 120, 1800, 0) + shelf_row(d, 420, 120, 1800, 1) + shelf_row(d, 600, 120, 1800, 2)
        + f'<path d="M0 700 h{W} v140 h-{W} z" fill="{d.linear("counter", "#c8864a", "#6a3a14")}" stroke="{INK}" stroke-width="7"/>'
        + cat
        + f'<rect x="680" y="20" width="560" height="90" rx="14" fill="#fff6c0" stroke="{INK}" stroke-width="6"/>'
        f'<text x="960" y="80" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="40" fill="#7a2a5a">EVERYTHING SHOP</text>', d)


def tavern():
    d = Defs()
    return scene(
        interior(d, ('#d88a4a', '#7a3a14'), ('#8a5a2a', '#3a1a08'))
        + f'<rect x="1300" y="260" width="460" height="460" rx="20" fill="{d.radial("hearth", *STONE)}" stroke="{INK}" stroke-width="7"/>'
        + f'<path d="M1380 720 v-220 a150 150 0 0 1 300 0 v220 z" fill="#2a1408" stroke="{INK}" stroke-width="6"/>'
        + shape(d, 'hfire', 'M1420 720 q-20 -120 40 -180 q0 60 30 60 q0 -90 50 -120 q10 80 40 100 q30 -40 20 -80 q60 100 20 220 z', '#fff36b', '#ff4a00', 4)
        + ''.join(f'<g transform="translate({x} 720)"><ellipse cx="0" cy="-90" rx="90" ry="110" fill="{d.linear(f"barrel{x}", "#c8864a", "#6a3a14", 1, 0)}" stroke="{INK}" stroke-width="6"/>'
                  f'<path d="M-86 -140 h172 M-86 -40 h172" stroke="#5a5a6a" stroke-width="10"/></g>' for x in (140, 330))
        + f'<rect x="600" y="560" width="560" height="40" rx="10" fill="#8a5a2a" stroke="{INK}" stroke-width="6"/><rect x="640" y="600" width="30" height="140" fill="#6a3a14"/><rect x="1090" y="600" width="30" height="140" fill="#6a3a14"/>'
        + ''.join(f'<g transform="translate({x} 560)"><rect x="-26" y="-60" width="52" height="60" rx="8" fill="#ffd76a" stroke="{INK}" stroke-width="4"/><path d="M-30 -60 q14 -20 30 -8 q16 -18 30 8 z" fill="#fff" stroke="{INK}" stroke-width="3"/></g>' for x in (720, 880, 1040))
        + f'<path d="M760 60 v80 M1160 60 v80" stroke="{INK}" stroke-width="6"/>'
        + f'<path d="M700 140 h520 l-60 70 h-60 v60 h-280 v-60 h-60 z" fill="{d.linear("anvil", "#b8c0d0", "#3a4050")}" stroke="{INK}" stroke-width="6"/>'
        + f'<text x="960" y="196" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="40" fill="#fff6c0">TIPSY ANVIL</text>', d)


def gate():
    d = Defs()
    return scene(
        f'<rect width="{W}" height="{H}" fill="{d.linear("dusk", "#ffb07a", "#7a6ac8")}"/>'
        + f'<path d="M0 1080 v-700 q200 -300 500 -340 q300 -60 500 60 q300 -120 560 20 q300 120 360 360 v600 z" fill="{d.linear("cliff", "#a8988a", "#4a3e36")}" stroke="{INK}" stroke-width="8"/>'
        + f'<path d="M640 760 v-300 q320 -300 640 0 v300 z" fill="{d.radial("arch", *STONE)}" stroke="{INK}" stroke-width="8"/>'
        + f'<path d="M720 760 v-270 q240 -230 480 0 v270 z" fill="{d.radial("dark", "#3a2a2a", "#000000", 0.5, 0.8)}" stroke="{INK}" stroke-width="6"/>'
        + ''.join(f'<rect x="{x - 70}" y="{y}" width="140" height="60" rx="10" fill="#b8b0a8" stroke="{INK}" stroke-width="5" transform="rotate({a} {x} {y + 30})"/>' for x, y, a in ((760, 380, -50), (960, 270, 0), (1160, 380, 50)))
        + f'<rect x="760" y="140" width="400" height="90" rx="14" fill="#fff6c0" stroke="{INK}" stroke-width="6"/><text x="960" y="205" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="54" fill="#5a2a0a">THE DELVE</text>'
        + f'<path d="M1400 0 v540" stroke="#5a5a6a" stroke-width="10" stroke-dasharray="20 8"/>'
        + f'<path d="M1330 540 h140 l-20 130 h-100 z" fill="{d.linear("bucket", "#c8864a", "#6a3a14", 1, 0)}" stroke="{INK}" stroke-width="6"/><path d="M1330 560 h140 M1340 640 h120" stroke="#5a5a6a" stroke-width="8"/>'
        + f'<rect y="760" width="{W}" height="320" fill="{d.linear("path", "#c8b090", "#7a6040")}"/>'
        + f'<g transform="translate(1600 720)"><rect x="-6" y="0" width="12" height="80" fill="#8a5a2a"/><rect x="-90" y="-50" width="180" height="60" rx="6" fill="#fff8e0" stroke="{INK}" stroke-width="4"/>'
          f'<text x="0" y="-12" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="22" fill="#5a2a0a">BUCKET LIFT</text></g>', d)


def dungeon(d, wall, floor, extra=''):
    bricks = ''.join(f'<rect x="{x + (row % 2) * 80}" y="{row * 70}" width="150" height="62" rx="12" fill="{wall[0]}" opacity="0.35"/>' for row in range(11) for x in range(-80, W, 160))
    return (f'<rect width="{W}" height="{H}" fill="{d.linear("dwall", wall[1], wall[2])}"/>' + bricks
            + f'<path d="M0 720 q960 -60 1920 0 v360 h-1920 z" fill="{d.linear("dfloor", *floor)}"/>' + extra
            + f'<rect width="{W}" height="{H}" fill="{d.radial("vignette", "#000000", "#000000", 0.5, 0.5, 0.75)}" opacity="0"/>')


def torch(x, y):
    return (f'<rect x="{x - 10}" y="{y}" width="20" height="80" fill="#8a5a2a" stroke="{INK}" stroke-width="4"/>'
            f'<path d="M{x} {y - 70} q-36 40 -20 70 h40 q16 -30 -20 -70 z" fill="#ffb020" stroke="#ff6a00" stroke-width="4"/>'
            f'<circle cx="{x}" cy="{y - 20}" r="160" fill="#ffd36b" opacity="0.12"/>')


def cellars():
    d = Defs()
    barrels = ''.join(f'<g transform="translate({x} {y}) scale({s})"><ellipse cx="0" cy="-110" rx="100" ry="120" fill="{d.linear(f"cb{x}", "#c8864a", "#5a2a0a", 1, 0)}" stroke="{INK}" stroke-width="6"/>'
                      f'<path d="M-96 -170 h192 M-96 -50 h192" stroke="#4a4a5a" stroke-width="10"/></g>' for x, y, s in ((140, 760, 1), (330, 780, 0.9), (1760, 770, 1.05), (1600, 790, 0.8)))
    webs = ''.join(f'<path d="M{x} 0 q{s * 60} 80 {s * 160} 120 M{x} 0 q{s * 30} 100 {s * 70} 170 M{x} 0 l{s * 120} 60" stroke="#fff" stroke-width="2" opacity="0.6" fill="none"/>' for x, s in ((0, 1), (W, -1)))
    return scene(dungeon(d, ('#8a7a6a', '#5a4a3e', '#2a221c'), ('#6a5a4a', '#2a1e14'), torch(600, 300) + torch(1320, 300) + barrels + webs), d)


def grotto():
    d = Defs()
    glows = ''.join(f'<g transform="translate({x} {y}) scale({s})"><rect x="-30" y="-300" width="60" height="300" rx="20" fill="#d8f0e8" opacity="0.8"/>'
                    f'<path d="M-200 -280 q0 -180 200 -190 q200 10 200 190 q-200 40 -400 0 z" fill="{d.radial(f"g{x}", c[0], c[1])}" stroke="{INK}" stroke-width="6"/>'
                    f'<circle cx="0" cy="-330" r="260" fill="{c[0]}" opacity="0.12"/></g>'
                    for x, y, s, c in ((200, 760, 1.1, ('#8afff0', '#1a8a9a')), (620, 720, 0.6, ('#c8a0ff', '#4a2a9a')), (1320, 730, 0.7, ('#a0ff8a', '#2a8a1a')), (1750, 780, 1.2, ('#8ac8ff', '#1a4a9a'))))
    spores = ''.join(f'<circle cx="{(i * 397) % W}" cy="{(i * 211) % 700}" r="{3 + i % 4}" fill="#cfffef" opacity="0.7"/>' for i in range(40))
    return scene(dungeon(d, ('#2a4a5a', '#1a3a4a', '#08141e'), ('#2a4a3a', '#0a1a14'), glows + spores), d)


def crypt():
    d = Defs()
    tombs = ''.join(f'<g transform="translate({x} 740)"><path d="M-110 0 v-220 q110 -100 220 0 v220 z" fill="{d.radial(f"t{x}", "#d8d0e8", "#5a5070")}" stroke="{INK}" stroke-width="6"/>'
                    f'<text x="0" y="-120" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="40" fill="#4a4060">RIP</text></g>' for x in (220, 520, 1400, 1700))
    candles = ''.join(f'<rect x="{x}" y="680" width="22" height="60" fill="#fff8e0" stroke="{INK}" stroke-width="3"/><path d="M{x + 11} 676 q-10 -18 0 -34 q10 16 0 34 z" fill="#ffb020"/><circle cx="{x + 11}" cy="660" r="60" fill="#ffd36b" opacity="0.15"/>' for x in (380, 680, 1240, 1560))
    return scene(dungeon(d, ('#7a6a9a', '#3e3458', '#140f22'), ('#4a4060', '#140f22'), tombs + candles
                         + f'<rect x="740" y="80" width="440" height="80" rx="10" fill="#e8e0f0" stroke="{INK}" stroke-width="5"/><text x="960" y="132" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="bold" fill="#4a4060">PLEASE DO NOT WAKE</text>'), d)


def forge():
    d = Defs()
    lava = d.linear('lava', '#fff36b', '#ff3a00')
    anvils = ''.join(f'<path d="M{x - 160} 600 h320 l-60 60 h-50 v80 h-100 v-80 h-50 z" fill="{d.linear(f"an{x}", "#8a90a0", "#2a2e3a")}" stroke="{INK}" stroke-width="6"/>' for x in (300, 1650))
    return scene(dungeon(d, ('#8a4a3a', '#4a1e14', '#1a0806'), ('#4a2a20', '#1a0a06'),
                         f'<path d="M0 860 q480 -60 960 0 q480 60 960 0 v80 q-480 60 -960 0 q-480 -60 -960 0 z" fill="{lava}" stroke="#a02000" stroke-width="5"/>'
                         + f'<rect y="0" width="{W}" height="{H}" fill="#ff6a00" opacity="0.08"/>' + anvils
                         + ''.join(f'<circle cx="{(i * 331) % W}" cy="{200 + (i * 173) % 500}" r="{2 + i % 3}" fill="#ffd36b"/>' for i in range(30))), d)


def hoard():
    d = Defs()
    gold = ''.join(f'<path d="M{x - w} 760 q{w} -{h * 2} {2 * w} 0 z" fill="{d.radial(f"pile{x}", "#fff6b0", "#c88a0a", 0.4, 0.3)}" stroke="#8a5a00" stroke-width="5"/>' for x, w, h in ((180, 320, 160), (700, 260, 120), (1250, 300, 140), (1760, 300, 170)))
    coins = ''.join(f'<ellipse cx="{(i * 271) % W}" cy="{780 + (i * 97) % 280}" rx="18" ry="8" fill="#ffd34d" stroke="#8a5a00" stroke-width="2"/>' for i in range(60))
    cheese = (f'<g transform="translate(1500 520)"><ellipse cx="0" cy="110" rx="260" ry="70" fill="#d8a020" stroke="{INK}" stroke-width="7"/>'
              f'<rect x="-260" y="-10" width="520" height="120" fill="{d.linear("rind", "#ffe07a", "#d8a020")}"/>'
              f'<path d="M-260 -10 v120 M260 -10 v120" stroke="{INK}" stroke-width="7"/>'
              f'<ellipse cx="0" cy="-10" rx="260" ry="70" fill="{d.radial("cheese", "#fff6c0", "#ffd34d")}" stroke="{INK}" stroke-width="7"/>'
              + ''.join(f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r * 0.6}" fill="#e8b830"/>' for x, y, r in ((-120, -20, 26), (40, 10, 18), (130, -30, 22), (-40, -50, 14)))
              + '</g>')
    crowns = ''.join(f'<path d="M{x} 700 l10 -50 l25 30 l25 -40 l25 40 l25 -30 l10 50 z" fill="#ffd34d" stroke="{INK}" stroke-width="4"/>' for x in (420, 980))
    return scene(dungeon(d, ('#8a6a3a', '#4a3010', '#1a1004'), ('#8a6a20', '#3a2a08'), gold + cheese + crowns + coins
                         + f'<rect y="0" width="{W}" height="{H}" fill="#ffd34d" opacity="0.06"/>'), d)


def bedrock():
    """Floor 6, under the Hoard: grey, ancient, dusty; fossils in the walls, an armchair cut from the rock, a ledger."""
    d = Defs()
    fossils = ''.join(f'<g transform="translate({x} {y}) scale({s})"><path d="M0 0 a40 40 0 1 1 30 -20 a26 26 0 1 0 -18 14 a14 14 0 1 1 10 -8" stroke="#8a8274" stroke-width="7" fill="none"/></g>'
                      for x, y, s in ((220, 240, 1.2), (760, 140, 0.9), (1500, 260, 1.3), (1780, 520, 0.8), (420, 520, 0.7)))
    bones = ''.join(f'<path d="M{x} {y} q60 -30 120 0 q60 30 120 0" stroke="#d8d0c0" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.7"/>' for x, y in ((980, 330), (1240, 420)))
    dust = ''.join(f'<circle cx="{(i * 389) % W}" cy="{(i * 157) % 720}" r="{2 + i % 3}" fill="#f4eee0" opacity="0.5"/>' for i in range(50))
    chair = (f'<g transform="translate(1380 760)"><path d="M-260 0 v-300 q0 -120 120 -120 h280 q120 0 120 120 v300 z" fill="{d.linear("chair", "#a8a094", "#4a4238")}" stroke="{INK}" stroke-width="7"/>'
             f'<rect x="-300" y="-160" width="80" height="160" rx="30" fill="#8a8274" stroke="{INK}" stroke-width="6"/><rect x="220" y="-160" width="80" height="160" rx="30" fill="#8a8274" stroke="{INK}" stroke-width="6"/></g>')
    ledger = (f'<g transform="translate(460 760)"><path d="M-220 0 l20 -300 h200 l20 300 z M0 0 l20 -300 h200 l20 300 z" fill="#f4ecd4" stroke="{INK}" stroke-width="6"/>'
              + ''.join(f'<path d="M{x} {-260 + i * 40} h{140}" stroke="#a09070" stroke-width="4"/>' for i in range(6) for x in (-180, 40))
              + f'<text x="-100" y="-40" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="34" fill="#c0392b" transform="rotate(-8 -100 -40)">OVERDUE</text>'
              f'<text x="120" y="-40" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="34" fill="#c0392b" transform="rotate(-8 120 -40)">OVERDUE</text></g>')
    return scene(dungeon(d, ('#9a948a', '#5a564e', '#16140f'), ('#7a746a', '#24201a'), fossils + bones + ledger + chair + dust
                         + f'<rect width="{W}" height="{H}" fill="#e8e0d0" opacity="0.06"/>'), d)


BACKGROUNDS = {'town': town, 'shop': shop, 'tavern': tavern, 'gate': gate, 'cellars': cellars, 'grotto': grotto, 'crypt': crypt, 'forge': forge, 'hoard': hoard, 'bedrock': bedrock}


# ------------------------------------------------------------------------------------- illustrations of the endings, and the cover

def embed(svg, x, y, height, prefix, flip=False):
    """A whole picture of this file placed inside another, its gradients renamed so that they cannot clash."""
    width = int(svg.split('width="')[1].split('"')[0])
    full = int(svg.split('height="')[1].split('"')[0])
    inner = svg.split('>', 1)[1].rsplit('</svg>', 1)[0].replace('id="', f'id="{prefix}').replace('url(#', f'url(#{prefix}')
    w = height * width / full
    flipping = f' transform="translate({2 * x + w} 0) scale(-1 1)"' if flip else ''
    return f'<g{flipping}><svg x="{x}" y="{y}" width="{w:.0f}" height="{height}" viewBox="0 0 {width} {full}">{inner}</svg></g>'


def feet_at(svg_height_px, ground_y):
    """The top at which a sprite drawn this tall stands with its feet on ground_y."""
    return ground_y - svg_height_px * FEET_Y / (FEET_Y + 30 + SPACE_BELOW)


def stand(svg, x, ground, height, prefix, flip=False):
    return embed(svg, x, feet_at(height, ground), height, prefix, flip)


def caption(text, y=1010):
    return (f'<text x="960" y="{y}" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="64" '
            f'fill="#fff6e0" stroke="{INK}" stroke-width="8" paint-order="stroke">{text}</text>')


def stairs_cg():
    d = Defs()
    steps = ''.join(f'<rect x="{-100 + i * 220}" y="{900 - i * 110}" width="{2200 - i * 220}" height="120" fill="{d.linear(f"st{i}", "#c8c0b8", "#6a6460")}" stroke="{INK}" stroke-width="5"/>' for i in range(7))
    wheel = (f'<g transform="translate(980 560) rotate(-10)"><ellipse cx="0" cy="0" rx="150" ry="250" fill="#d8a020" stroke="{INK}" stroke-width="7"/>'
             f'<ellipse cx="40" cy="0" rx="150" ry="250" fill="{d.radial("wheelface", "#fff6c0", "#ffc830")}" stroke="{INK}" stroke-width="7"/>'
             + ''.join(f'<ellipse cx="{40 + x}" cy="{y}" rx="{r}" ry="{r}" fill="#e8b830"/>' for x, y, r in ((-40, -80, 30), (50, 40, 22), (-10, 140, 26), (70, -150, 16)))
             + '</g>')
    return scene(f'<rect width="{W}" height="{H}" fill="{d.linear("light", "#fff6c0", "#ffb06a")}"/>' + steps + wheel
                 + stand(dwarf('attack'), 1050, 790, 720, 'a')
                 + stand(foe_pictures()['foe-intern'], 300, 1000, 520, 'b') + stand(FOES['gloop'](), 1500, 1000, 520, 'c')
                 + stand(FOES['boney'](), 1680, 1000, 560, 'e')
                 + bunting(60) + caption('A Grate Victory'), d)


def crackers_cg():
    d = Defs()
    box = (f'<g transform="translate(980 860) rotate(-6)"><rect x="-110" y="-70" width="220" height="140" rx="10" fill="#c0392b" stroke="{INK}" stroke-width="6"/>'
           f'<text x="0" y="10" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="40" fill="#fff6c0">FANCY</text>'
           + ''.join(f'<rect x="{-80 + i * 60}" y="-110" width="50" height="50" rx="6" fill="#f0c070" stroke="{INK}" stroke-width="4"/>' for i in range(3)) + '</g>')
    fireworks = ''.join(f'<g transform="translate({x} {y})">' + ''.join(f'<path d="M0 0 l{80 * __import__("math").cos(a / 6 * 3.1416):.0f} {80 * __import__("math").sin(a / 6 * 3.1416):.0f}" stroke="{c}" stroke-width="8" stroke-linecap="round"/>' for a in range(12)) + '</g>'
                        for x, y, c in ((300, 160, '#ffd34d'), (1600, 140, '#ff6a9a'), (950, 90, '#6ad0ff')))
    return scene(hoard_body(d) + fireworks
                 + stand(ember('happy'), 900, 960, 900, 'a') + stand(dwarf('happy'), 200, 1000, 720, 'b')
                 + stand(FOES['bats'](), 1450, 640, 480, 'c') + box + caption('Cheese and Crackers'), d)


def hoard_body(d):
    return hoard().split('>', 1)[1].rsplit('</svg>', 1)[0].replace('id="', 'id="h').replace('url(#', 'url(#h')


def tuesdays_cg():
    d = Defs()
    table = (f'<ellipse cx="960" cy="860" rx="360" ry="80" fill="{d.radial("table", "#fff8ec", "#c8b090")}" stroke="{INK}" stroke-width="6"/>'
             f'<rect x="930" y="900" width="60" height="140" fill="#8a5a2a"/>'
             f'<g transform="translate(960 780)"><path d="M-70 60 q-20 -120 70 -120 q90 0 70 120 z" fill="{d.radial("pot", "#ffffff", "#7ab0ff")}" stroke="{INK}" stroke-width="6"/>'
             f'<path d="M70 0 q60 -30 70 -70" stroke="{INK}" stroke-width="12" fill="none"/><circle cx="0" cy="-70" r="16" fill="#7ab0ff" stroke="{INK}" stroke-width="5"/></g>'
             + ''.join(f'<g transform="translate({x} 840)"><path d="M-36 -40 h72 l-10 50 h-52 z" fill="#fff" stroke="{INK}" stroke-width="5"/><path d="M36 -30 q24 0 20 20" stroke="{INK}" stroke-width="6" fill="none"/></g>' for x in (760, 1160))
             + f'<g transform="translate(1260 830)"><path d="M-70 20 v-60 h140 v60 z" fill="#8a4a1a" stroke="{INK}" stroke-width="5"/><path d="M-70 -40 h140" stroke="#fff6c0" stroke-width="12"/></g>')
    return scene(hoard_body(d) + f'<rect width="{W}" height="{H}" fill="#3a1a4a" opacity="0.25"/>'
                 + stand(ember('happy'), 1000, 900, 840, 'a') + stand(dwarf('happy'), 330, 960, 700, 'b') + table + caption('Tea on Tuesdays'), d)


def bribe_cg():
    d = Defs()
    bags = ''.join(f'<g transform="translate({x} {y})"><path d="M-90 0 q-30 -150 60 -160 l-20 -30 h100 l-20 30 q90 10 60 160 z" fill="{d.radial(f"bag{x}", "#e8c890", "#8a6030")}" stroke="{INK}" stroke-width="6"/>'
                   f'<text x="0" y="-50" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="60" fill="#5a3a10">G</text></g>' for x, y in ((1250, 960), (1450, 980), (1350, 900)))
    frame = (f'<rect x="760" y="140" width="400" height="300" rx="10" fill="#d4a017" stroke="{INK}" stroke-width="6"/><rect x="790" y="170" width="340" height="240" fill="#3a2a2a"/>'
             f'<ellipse cx="960" cy="290" rx="110" ry="60" fill="none" stroke="#fff6c0" stroke-width="5" stroke-dasharray="14 10"/>'
             f'<text x="960" y="470" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#5a3a10" font-style="italic">The cheese (missing)</text>')
    return scene(interior(d, ('#7ab07a', '#2a5a3a'), ('#c88a5a', '#6a3a14')) + frame + bags
                 + stand(dwarf('think'), 330, 1000, 760, 'a') + caption('Rich and Cheeseless'), d)


def policy_cg():
    d = Defs()
    card = (f'<g transform="translate(960 300) rotate(-4)"><rect x="-300" y="-150" width="600" height="300" rx="20" fill="#fff8e0" stroke="{INK}" stroke-width="7"/>'
            f'<text x="0" y="-70" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="46" fill="#c0392b">LOYALTY CARD</text>'
            + ''.join(f'<circle cx="{-150 + i * 150}" cy="30" r="50" fill="none" stroke="#c0392b" stroke-width="6"/><path d="M{-180 + i * 150} 0 l60 60 M{-120 + i * 150} 0 l-60 60" stroke="#c0392b" stroke-width="8"/>' for i in range(3))
            + f'<text x="0" y="120" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="30" fill="#5a3a10">We have a policy. Sorry!</text></g>')
    return scene(f'<rect width="{W}" height="{H}" fill="{d.linear("rain", "#8a9ab0", "#3a4a60")}"/>'
                 + f'<rect y="760" width="{W}" height="320" fill="#5a5048"/>'
                 + stand(fizzwick(), 250, 1000, 780, 'a') + stand(fizzwick(), 520, 1000, 720, 'b') + stand(fizzwick(), 1400, 1000, 760, 'c', True)
                 + stand(dwarf('hurt'), 820, 1010, 720, 'e') + card + caption('The Gnomes Have a Policy'), d)


def bakery_cg():
    d = Defs()
    breads = ''.join(f'<g transform="translate({x} {y})"><ellipse cx="0" cy="0" rx="{rx}" ry="{ry}" fill="{d.radial(f"br{x}{y}", "#ffd890", "#b06a1a")}" stroke="{INK}" stroke-width="5"/>'
                     + ''.join(f'<path d="M{k} -{ry * 0.6} q10 {ry * 0.6} 0 {ry * 1.2}" stroke="#8a4a10" stroke-width="4" fill="none"/>' for k in (-rx * 0.4, 0, rx * 0.4)) + '</g>'
                     for x, y, rx, ry in ((260, 330, 110, 50), (520, 320, 90, 45), (1400, 330, 110, 50), (1660, 320, 90, 45), (400, 520, 100, 46), (1540, 520, 100, 46)))
    hat = f'<g transform="translate(1024 360) scale(0.9)"><path d="M-90 40 q-80 -60 -20 -110 q20 -60 110 -40 q90 -20 110 40 q60 50 -20 110 z" fill="#fff" stroke="{INK}" stroke-width="6"/><rect x="-90" y="30" width="180" height="40" fill="#fff" stroke="{INK}" stroke-width="6"/></g>'
    return scene(interior(d, ('#ffe0b0', '#c8905a'), ('#c88a5a', '#6a3a14'))
                 + ''.join(f'<rect x="{x}" y="{y + 50}" width="300" height="20" fill="#8a5a2a" stroke="{INK}" stroke-width="4"/>' for x, y in ((110, 320), (1250, 320), (250, 520), (1390, 520)))
                 + breads + stand(dwarf('happy'), 760, 820, 1100, 'a') + hat
                 + f'<path d="M0 780 h{W} v200 h-{W} z" fill="{d.linear("bcounter", "#c8864a", "#6a3a14")}" stroke="{INK}" stroke-width="7"/>'
                 + caption('Rolls, Not Dice'), d)


def cover():
    d = Defs()
    return scene(hoard_body(d) + f'<rect width="{W}" height="{H}" fill="#1a0a2a" opacity="0.35"/>'
                 + stand(ember('normal'), 860, 900, 860, 'a') + stand(dwarf('normal'), 180, 1040, 900, 'b')
                 + f'<text x="1300" y="230" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="190" fill="#ffd34d" stroke="{INK}" stroke-width="12" paint-order="stroke">Knee-Deep</text>'
                 + f'<text x="1300" y="320" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="54" fill="#fff6e0" stroke="{INK}" stroke-width="6" paint-order="stroke">a small dwarf, a big cheese</text>', d)


def overdue_cg():
    d = Defs()
    # On the curved side of the wheel, inside its band, barely tilted: a stamp that sits on the rind.
    stamp = (f'<g transform="translate(1000 755) rotate(-3) scale(0.75)"><rect x="-210" y="-60" width="420" height="120" rx="14" fill="none" stroke="#c0392b" stroke-width="12"/>'
             f'<text x="0" y="25" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="70" fill="#c0392b">RENEWED</text></g>')
    wheel = (f'<g transform="translate(1000 640)"><ellipse cx="0" cy="110" rx="300" ry="80" fill="#d8a020" stroke="{INK}" stroke-width="7"/>'
             f'<rect x="-300" y="-20" width="600" height="130" fill="{d.linear("orind", "#ffe07a", "#d8a020")}"/>'
             f'<path d="M-300 -20 v130 M300 -20 v130" stroke="{INK}" stroke-width="7"/>'
             f'<ellipse cx="0" cy="-20" rx="300" ry="80" fill="{d.radial("ocheese", "#fff6c0", "#ffd34d")}" stroke="{INK}" stroke-width="7"/></g>')
    return scene(bedrock().split('>', 1)[1].rsplit('</svg>', 1)[0].replace('id="', 'id="r').replace('url(#', 'url(#r')
                 + f'<rect width="{W}" height="{H}" fill="#ffd34d" opacity="0.12"/>'
                 + stand(flint(), 1180, 760, 760, 'a') + wheel + stamp
                 + stand(ember('happy'), -60, 1000, 700, 'b') + stand(dwarf('happy'), 520, 1000, 760, 'c')
                 + caption('Long Overdue'), d)


ILLUSTRATIONS = {'victory': stairs_cg, 'crackers': crackers_cg, 'tuesdays': tuesdays_cg, 'bribe': bribe_cg, 'policy': policy_cg, 'bakery': bakery_cg, 'overdue': overdue_cg, 'cover': cover}


# ------------------------------------------------------------------------------------- sounds and music

RATE = 44100


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


def sequence(pieces, length=None):
    end = max(int(start * RATE) + len(samples) for start, samples in pieces)
    out = numpy.zeros(max(end, length or 0))
    for start, samples in pieces:
        offset = int(start * RATE)
        out[offset:offset + len(samples)] += samples
    return out[:length] if length else out


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


NOTE = {name: 440 * 2 ** ((index - 9) / 12) for index, name in enumerate(('C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'))}


def chord(root, minor=False):
    base = NOTE[root]
    return (base / 2, (base, base * 2 ** ((3 if minor else 4) / 12), base * 2 ** (7 / 12)))


def music(tempo, chords, beats=4, arpeggio=(0, 1, 2, 1), lead=(1, 0.25), bass=(1, 0.5, 0.25), bars=8, swing=False, bass_every=1):
    """Loops of a few bars: a bass on the beats, an arpeggio over the chord, as a 16-bit cartridge would."""
    beat = 60 / tempo
    pieces = []
    for bar in range(bars):
        low, notes = chords[bar % len(chords)]
        start = bar * beats * beat
        for step in range(0, beats, bass_every):
            pieces.append((start + step * beat, 0.9 * tone(low, beat * 0.9, 0.2, bass)))
        steps = beats * 2
        for step in range(steps):
            offset = step * beat / 2 + (beat * 0.12 if swing and step % 2 else 0)
            pitch = notes[arpeggio[step % len(arpeggio)]] * (2 if step >= steps - 2 else 1)
            pieces.append((start + offset, 0.4 * tone(pitch, beat * 0.45, 0.09, lead)))
    return sequence(pieces, int(bars * beats * beat * RATE))


def sounds(folder):
    generator = numpy.random.default_rng(7)
    rattle = [(i * 0.05 + generator.uniform(0, 0.02), noise(0.05, 1500, 6000, 0.015, generator)) for i in range(7)]
    write_sound(folder, 'dice', sequence(rattle + [(0.4, tone(1200, 0.1, 0.03))]), 0.45)
    write_sound(folder, 'coin', sequence([(0, tone(1568, 0.12, 0.05, (1, 0.5))), (0.08, tone(2093, 0.4, 0.15, (1, 0.5)))]), 0.4)
    write_sound(folder, 'hit', sequence([(0, noise(0.15, 150, 2500, 0.05, generator)), (0, tone(90, 0.2, 0.06))]), 0.55)
    write_sound(folder, 'crit', sequence([(0, noise(0.3, 100, 4000, 0.1, generator)), (0, tone(70, 0.4, 0.15)), (0.05, glide(400, 1600, 0.4, 0.2))]), 0.6)
    write_sound(folder, 'miss', noise(0.3, 600, 3000, 0.12, generator) * numpy.linspace(0.2, 1, int(RATE * 0.3)), 0.4)
    write_sound(folder, 'fumble', sequence([(0, glide(900, 300, 0.6, 0.5)), (0.6, glide(300, 900, 0.25, 0.2))]), 0.4)
    write_sound(folder, 'ouch', sequence([(0, noise(0.12, 100, 1500, 0.05, generator)), (0.02, glide(500, 200, 0.25, 0.1))]), 0.5)
    write_sound(folder, 'guard', sequence([(0, tone(660, 0.5, 0.25, (1, 0.6, 0.4, 0.2))), (0, tone(990, 0.4, 0.2))]), 0.4)
    write_sound(folder, 'bomb', sequence([(0, glide(1200, 1100, 0.4, 1.0) * 0.15), (0.4, noise(1.2, 30, 1200, 0.4, generator)), (0.4, tone(50, 1.0, 0.4))]), 0.65)
    write_sound(folder, 'run', sequence([(i * 0.07, tone(300 + i * 40, 0.06, 0.03)) for i in range(10)]), 0.4)
    write_sound(folder, 'faint', glide(700, 110, 1.0, 0.5), 0.45)
    write_sound(folder, 'roar', sequence([(0, noise(1.4, 60, 900, 0.6, generator)), (0, glide(120, 70, 1.2, 0.6))]), 0.6)
    write_sound(folder, 'drink', sequence([(i * 0.18, glide(300 + i * 60, 500 + i * 60, 0.12, 0.05)) for i in range(3)] + [(0.65, tone(1800, 0.08, 0.03))]), 0.45)
    write_sound(folder, 'heal', sequence([(i * 0.09, tone(f, 0.3, 0.15)) for i, f in enumerate((659.25, 783.99, 987.77, 1318.51))]), 0.4)
    write_sound(folder, 'magic', sequence([(i * 0.06, tone(f, 0.5, 0.25, (1, 0.2))) for i, f in enumerate((1046.5, 1318.5, 1568.0, 2093.0, 1568.0, 2637.0))]), 0.35)
    write_sound(folder, 'levelup', sequence([(i * 0.11, tone(f, 0.6 if i == 4 else 0.18, 0.2)) for i, f in enumerate((523.25, 659.25, 783.99, 1046.5, 1318.5))]), 0.45)
    write_sound(folder, 'chest', sequence([(0, glide(180, 260, 0.4, 0.3) * 0.6), (0.35, tone(1046.5, 0.5, 0.25)), (0.42, tone(1318.5, 0.5, 0.25))]), 0.45)
    write_sound(folder, 'door', sequence([(0, glide(220, 160, 0.7, 0.5) * (1 + 0.5 * numpy.sin(2 * numpy.pi * 30 * seconds(0.7)))), (0.7, noise(0.15, 60, 600, 0.05, generator))]), 0.4)

    major = lambda *roots: [chord(r) for r in roots]
    write_sound(folder, 'town', music(118, major('C', 'F', 'G', 'C', 'A', 'F', 'G', 'G'), arpeggio=(0, 1, 2, 1, 0, 2, 1, 2)), 0.35)
    write_sound(folder, 'tavern', music(150, major('D', 'G', 'A', 'D'), beats=3, arpeggio=(0, 1, 2, 2, 1, 0), lead=(1, 0.5, 0.1), swing=True), 0.35)
    write_sound(folder, 'delve', music(84, [chord('A', True), chord('F'), chord('G'), chord('E')], arpeggio=(0, 2, 1, 2), lead=(1, 0.1), bass_every=2), 0.35)
    write_sound(folder, 'fight', music(152, [chord('E', True), chord('C'), chord('D'), chord('B')], arpeggio=(0, 1, 2, 1, 2, 1, 0, 2)), 0.38)
    write_sound(folder, 'boss', music(164, [chord('D', True), chord('A#'), chord('C'), chord('A')], arpeggio=(0, 2, 1, 2, 0, 2, 1, 0), bass=(1, 0.8, 0.5, 0.3)), 0.4)
    write_sound(folder, 'win', music(132, major('C', 'G', 'A', 'F', 'C', 'G', 'F', 'C'), arpeggio=(0, 1, 2, 1)), 0.35)
    write_sound(folder, 'sad', music(70, [chord('C', True), chord('G#'), chord('F', True), chord('G')], beats=4, arpeggio=(2, 1, 0, 1), lead=(1, 0.1), bass_every=2, bars=4), 0.3)


# ------------------------------------------------------------------------------------- rendering

CHROMIUM = shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')


def render(svg_text, path, width, height):
    with tempfile.TemporaryDirectory() as work:
        source = Path(work) / 'picture.svg'
        source.write_text(svg_text)
        shot = Path(work) / 'shot.png'
        subprocess.run([CHROMIUM, '--headless', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
                        f'--window-size={width},{height}', f'--screenshot={shot}', source.as_uri()], check=True, capture_output=True)
        shutil.move(shot, path)


def pictures():
    """Every picture of the game, by file name (without .svg)."""
    out = {}
    for pose in DWARF_POSES:
        out['dwarf' if pose == 'normal' else f'dwarf-{pose}'] = dwarf(pose)
    for name, (draw, expressions) in CAST.items():
        for expression in expressions:
            out[name if expression == 'normal' else f'{name}-{expression}'] = draw(expression)
    out.update(foe_pictures())
    out.update({name: draw() for name, draw in PROPS.items()})
    out.update({f'tile-{kind}': tile(kind) for kind in TILES})
    out.update({name: draw() for name, draw in BACKGROUNDS.items()})
    out.update({name: draw() for name, draw in ILLUSTRATIONS.items()})
    return out


def foe_pictures():
    out = {f'foe-{name}': draw() for name, draw in FOES.items()}
    out['foe-ember'] = ember('angry')
    return out


CAST = {
    'mayor': (mayor, ('normal',)), 'grizelda': (grizelda, ('normal', 'cross')), 'barnaby': (barnaby, ('normal',)),
    'fizzwick': (fizzwick, ('normal',)), 'sneak': (sneak, ('normal',)), 'melody': (melody, ('normal',)),
    'lorimer': (lorimer, ('normal',)), 'troll': (troll, ('normal', 'awake')),
    'ember': (lambda expression: ember(expression), ('normal', 'sleepy', 'angry', 'happy')),
}


def main(arguments):
    folder = Path(arguments[0])
    folder.mkdir(parents=True, exist_ok=True)
    png = arguments[arguments.index('--png') + 1:] if '--png' in arguments else []
    if '--no-sounds' not in arguments:
        sounds(folder)
    for name, svg in pictures().items():
        (folder / f'{name}.svg').write_text(svg)
        if png and (name in png or 'all' in png):
            width = int(svg.split('width="')[1].split('"')[0])
            height = int(svg.split('height="')[1].split('"')[0])
            render(svg, folder / f'{name}.png', width, height)


if __name__ == '__main__':
    main(sys.argv[1:])
