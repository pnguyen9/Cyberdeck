"""Makes the pictures of Sakura Week from code alone, in a late-2000s chibi anime look: thin warm
outlines, flat colours with one shadow band, banded irises and a ring of shine on the hair.

    python3 sakura_week_assets.py <folder>

Each picture is written as SVG, which the engine shows as it is: sharp at any size, and a small
download. The sounds and music of the sample are not made here: they stay as they are in
sakura-week-assets.zip.
"""
import math
import random
import sys
from pathlib import Path

LINE = '#5a3438'
SKIN = '#ffe3d0'
SKIN_SHADE = '#f4c4ae'
FONT = "Ubuntu, 'Noto Sans', sans-serif"

# Characters stand in a 300 x 500 box (shown at 600 x 1000), head centred on x = 200, feet near
# y = 530: two heads tall, the chibi proportion.
SPRITE_BOX = '50 40 300 500'


# ---------------------------------------------------------------------------------------- faces

def eye(cx, cy, mirror, kind, iris, scale=1.0, look=0):
    """One eye at (cx, cy); mirror is -1 for the right eye. iris = (dark, mid, light)."""
    m = mirror
    s = scale

    def x(dx):
        return cx + dx * m * s

    def y(dy):
        return cy + dy * s
    lash = f'stroke="#3a2430" stroke-linecap="round" fill="none"'
    if kind == 'happy':
        return (f'<path d="M{x(-24)},{y(8)} Q{x(0)},{y(-20)} {x(24)},{y(6)}" {lash} stroke-width="{5 * s}"/>'
                f'<path d="M{x(-25)},{y(8)} L{x(-31)},{y(5)}" {lash} stroke-width="{4 * s}"/>')
    if kind == 'closed':
        return (f'<path d="M{x(-22)},{y(4)} Q{x(0)},{y(18)} {x(22)},{y(4)}" {lash} stroke-width="{4.5 * s}"/>'
                f'<path d="M{x(-22)},{y(4)} L{x(-28)},{y(0)}" {lash} stroke-width="{3.5 * s}"/>')
    rx, ry, pr = (20, 27, 1.0)
    shift = look * m
    if kind == 'surprised':
        rx, ry, pr = (15, 20, 0.6)
    white = f'<path d="M{x(-28)},{y(-19)} Q{x(-6)},{y(-35)} {x(22)},{y(-27)} L{x(24)},{y(21)} Q{x(-2)},{y(31)} {x(-26)},{y(21)} Z" fill="#fff"/>'
    if kind == 'surprised':
        white = f'<ellipse cx="{cx}" cy="{y(-2)}" rx="{27 * s}" ry="{32 * s}" fill="#fff"/>'
    gid = f'iris{abs(hash((cx, cy, iris))) % 100000}'
    grad = (f'<defs><linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{iris[0]}"/><stop offset="0.42" stop-color="{iris[0]}"/>'
            f'<stop offset="0.42" stop-color="{iris[1]}"/><stop offset="0.8" stop-color="{iris[1]}"/>'
            f'<stop offset="0.8" stop-color="{iris[2]}"/><stop offset="1" stop-color="{iris[2]}"/></linearGradient></defs>')
    ix = cx + shift * s
    out = grad + white
    out += f'<ellipse cx="{ix}" cy="{cy}" rx="{rx * s}" ry="{ry * s}" fill="url(#{gid})"/>'
    out += f'<ellipse cx="{ix}" cy="{y(-3)}" rx="{9 * pr * s}" ry="{13 * pr * s}" fill="#1a0f30"/>'
    out += f'<ellipse cx="{ix - 9 * s}" cy="{y(-13)}" rx="{8 * pr * s}" ry="{10 * pr * s}" fill="#fff"/>'
    out += f'<circle cx="{ix + 9 * s}" cy="{y(15)}" r="{4 * s}" fill="#fff"/>'
    top = -27 if kind != 'surprised' else -36
    if kind == 'shy':
        # a lid lowered over the top of the eye
        out += f'<path d="M{x(-32)},{y(-40)} L{x(28)},{y(-40)} L{x(28)},{y(-14)} Q{x(-2)},{y(-22)} {x(-32)},{y(-12)} Z" fill="{SKIN}"/>'
        out += f'<path d="M{x(-30)},{y(-12)} Q{x(-2)},{y(-22)} {x(28)},{y(-14)}" {lash} stroke-width="{4.5 * s}"/>'
    else:
        out += f'<path d="M{x(-30)},{y(top + 12)} Q{x(-6)},{y(top - 8)} {x(26)},{y(top)}" {lash} stroke-width="{4.5 * s}"/>'
    out += f'<path d="M{x(-29)},{y(top + 13 if kind != "shy" else -12)} L{x(-36)},{y(top + 10 if kind != "shy" else -15)}" {lash} stroke-width="{4 * s}"/>'
    out += f'<path d="M{x(-18)},{y(27)} Q{x(0)},{y(33)} {x(16)},{y(25)}" {lash} stroke-width="{2 * s}"/>'
    return out


def brows(kind, color, lift=0):
    """Two brows above eyes centred on x = 156 and 244."""
    shape = {
        'neutral': ((-18, -6), (0, -12), (18, -8)),
        'happy': ((-18, 0), (0, -9), (18, -3)),
        'surprised': ((-18, -10), (0, -18), (18, -12)),
        'shy': ((-18, -10), (0, -6), (18, 2)),
    }[kind]
    out = ''
    for cx, m in ((156, 1), (244, -1)):
        # shape runs from the outer end of the brow to its inner end
        (ax, ay), (bx, by), (dx, dy) = shape
        out += (f'<path d="M{cx + ax * m},{196 + ay - lift} Q{cx + bx * m},{192 + by - lift} {cx + dx * m},{196 + dy - lift}" '
                f'stroke="{color}" stroke-width="3.5" fill="none" stroke-linecap="round"/>')
    return out


def mouth(kind):
    if kind == 'smile':
        return (f'<path d="M188,280 Q200,300 212,280 Q200,284 188,280 Z" fill="#c0405a" stroke="{LINE}" stroke-width="2.5" stroke-linejoin="round"/>'
                f'<path d="M194,290 Q200,296 206,290 Q200,288 194,290 Z" fill="#f08898"/>')
    if kind == 'surprised':
        return f'<ellipse cx="200" cy="287" rx="7" ry="9" fill="#c0405a" stroke="{LINE}" stroke-width="2.5"/>'
    if kind == 'shy':
        return f'<path d="M190,286 q5,-4 10,0 q5,4 10,0" stroke="{LINE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    if kind == 'cat':
        return f'<path d="M188,282 q6,7 12,0 q6,7 12,0" stroke="{LINE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    return f'<path d="M193,283 Q200,291 207,283" stroke="{LINE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>'


def blush(strong=False):
    opacity = 0.75 if strong else 0.5
    out = (f'<ellipse cx="128" cy="276" rx="22" ry="10" fill="#ffa0b4" fill-opacity="{opacity}"/>'
           f'<ellipse cx="272" cy="276" rx="22" ry="10" fill="#ffa0b4" fill-opacity="{opacity}"/>')
    lines = 'M120,274 l-4,6 M129,274 l-4,6 M138,274 l-4,6 M266,274 l-4,6 M275,274 l-4,6 M284,274 l-4,6'
    out += f'<path d="{lines}" stroke="#e0607a" stroke-width="1.6" stroke-linecap="round"/>'
    if strong:
        out += '<path d="M318,170 q-8,14 0,20 q8,-6 0,-20 Z" fill="#bfe4ff" stroke="#6a9ac0" stroke-width="1.8"/>'
    return out


FACES = {
    #            eyes,       brows,       mouth,       strong blush, look aside
    'neutral': ('open', 'neutral', 'neutral', False, 0),
    'smile': ('happy', 'happy', 'smile', False, 0),
    'shy': ('shy', 'shy', 'shy', True, -7),
    'surprised': ('surprised', 'surprised', 'surprised', False, 0),
}


def face(expression, iris, brow_color, eye_scale=1.0):
    eyes_kind, brow_kind, mouth_kind, strong, look = FACES[expression]
    out = eye(156, 241, 1, eyes_kind, iris, eye_scale, look) + eye(244, 241, -1, eyes_kind, iris, eye_scale, look)
    out += brows(brow_kind, brow_color)
    out += blush(strong) + mouth(mouth_kind)
    out += f'<path d="M199,266 l2,3" stroke="#d09080" stroke-width="2" stroke-linecap="round"/>'
    return out


HEAD = (f'<path d="M186,288 L186,306 Q200,314 214,306 L214,288 Z" fill="{SKIN_SHADE}"/>'
        f'<path d="M100,170 Q100,262 160,290 Q200,306 240,290 Q300,262 300,170 Z" fill="{SKIN}"/>'
        f'<path d="M102,178 Q140,215 165,196 Q200,220 236,196 Q262,215 298,178 L298,170 L102,170 Z" fill="{SKIN_SHADE}" stroke="none"/>')

LONG_BANGS = ('M88,198 Q84,72 200,64 Q316,72 312,198 Q302,176 294,150 Q290,186 282,214 Q272,166 260,130 Q254,172 238,204 '
              'Q230,156 216,120 Q208,162 196,194 Q188,152 180,118 Q172,166 158,204 Q152,164 142,132 Q132,178 116,212 Q112,178 106,150 Q98,172 88,198 Z')
RING = ('M116,118 Q200,84 284,118 L278,132 L270,122 L262,134 L252,120 L242,132 L232,118 L222,130 L212,116 L200,128 L188,116 '
        'L178,130 L168,118 L158,132 L148,120 L138,134 L130,122 L122,132 Z')


def lined(content):
    return f'<g stroke="{LINE}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">{content}</g>'


# ------------------------------------------------------------------------------------ characters

def mika(expression):
    hair, hair_dark, ring = '#9a5a36', '#7a4228', '#c88a5e'
    iris = ('#5a2e1a', '#a0582c', '#e0a060')
    back = lined(
        # side ponytail, behind everything on the right
        '<path d="M292,120 Q348,130 346,220 Q344,290 326,350 Q320,316 314,300 Q310,326 298,344 Q308,280 302,220 Q298,170 280,140 Z" fill="#9a5a36"/>'
        '<path d="M322,180 Q336,240 326,320" fill="none" stroke="#7a4228" stroke-width="2"/>'
        f'<path d="M80,185 Q62,58 200,50 Q338,58 320,185 Q326,240 314,280 L86,280 Q74,240 80,185 Z" fill="{hair_dark}"/>')
    body = lined(
        # legs, socks, loafers
        f'<path d="M172,450 L171,500 L191,500 L192,450 Z" fill="{SKIN}"/><path d="M208,450 L209,500 L229,500 L228,450 Z" fill="{SKIN}"/>'
        '<path d="M171,490 L171,516 L191,516 L191,490 Z M209,490 L209,516 L229,516 L229,490 Z" fill="#fafaff"/>'
        '<path d="M163,512 Q163,530 192,530 L192,514 Z M237,512 Q237,530 208,530 L208,514 Z" fill="#7a4030"/>'
        # skirt with a shadow band
        '<path d="M150,385 L250,385 L274,458 L126,458 Z" fill="#2c3a6e"/>'
        '<path d="M150,385 L168,385 L150,458 L126,458 Z" fill="#1f2a54" stroke="none"/>'
        '<path d="M168,388 L152,456 M186,388 L181,457 M214,388 L219,457 M232,388 L248,456" fill="none" stroke-width="2"/>'
        # arms and hands
        '<path d="M150,320 Q118,352 126,396 Q140,406 150,394 Q148,362 165,338 Z" fill="#fafaff"/>'
        '<path d="M250,320 Q282,352 274,396 Q260,406 250,394 Q252,362 235,338 Z" fill="#fafaff"/>'
        f'<circle cx="136" cy="402" r="10" fill="{SKIN}"/><circle cx="264" cy="402" r="10" fill="{SKIN}"/>'
        # blouse, its shadow, the sailor collar and ribbon
        '<path d="M160,300 L240,300 Q255,340 252,392 L148,392 Q145,340 160,300 Z" fill="#fafaff"/>'
        '<path d="M160,330 L240,330 Q250,360 252,392 L232,392 Q228,350 200,356 Q172,350 168,392 L148,392 Q147,360 160,330 Z" fill="#dcdcf0" stroke="none"/>'
        '<path d="M155,302 L245,302 L232,330 L200,356 L168,330 Z" fill="#2c3a6e"/>'
        '<path d="M166,309 L234,309 M174,322 L200,343 L226,322" fill="none" stroke="#fafaff" stroke-width="2.5"/>'
        '<path d="M200,350 L172,338 L176,368 Z M200,350 L228,338 L224,368 Z" fill="#e0405a"/>'
        '<path d="M200,352 L190,385 L198,380 L200,388 L202,380 L210,385 Z" fill="#e0405a"/>'
        '<circle cx="200" cy="351" r="7" fill="#e0405a"/>'
        + HEAD)
    hair_front = lined(
        f'<path d="M100,165 Q86,230 98,300 Q114,276 118,246 Q122,212 122,178 Z" fill="{hair}"/>'
        f'<path d="M300,165 Q314,230 302,300 Q286,276 282,246 Q278,212 278,178 Z" fill="{hair}"/>'
        f'<path d="{LONG_BANGS}" fill="{hair}"/>'
        f'<path d="{RING}" fill="{ring}" stroke="none"/>'
        # the hair tie of the ponytail, and a red clip in the bangs
        '<circle cx="300" cy="128" r="11" fill="#e0405a"/><circle cx="296" cy="124" r="3.5" fill="#ff9aaa" stroke="none"/>'
        '<path d="M120,128 L150,112 L154,122 L124,138 Z" fill="#e0405a"/>')
    return sprite(back + body + hair_front + face(expression, iris, hair_dark))


def sota(expression):
    hair, ring = '#2a2a3e', '#56607e'
    iris = ('#1e2a40', '#3e5478', '#7c98c0')
    back = lined('<path d="M90,190 Q70,60 200,52 Q330,60 310,190 Q310,212 298,222 L102,222 Q90,212 90,190 Z" fill="#20202e"/>')
    body = lined(
        # trousers and shoes
        '<path d="M156,440 L152,516 L196,516 L198,446 Z M244,440 L248,516 L204,516 L202,446 Z" fill="#262a3a"/>'
        '<path d="M150,510 Q146,530 196,530 L196,512 Z M250,510 Q254,530 204,530 L204,512 Z" fill="#1a1a22"/>'
        # sleeves and hands
        '<path d="M148,318 Q112,356 120,410 Q136,420 148,406 Q146,370 164,340 Z" fill="#1e2440"/>'
        '<path d="M252,318 Q288,356 280,410 Q264,420 252,406 Q254,370 236,340 Z" fill="#1e2440"/>'
        f'<circle cx="132" cy="414" r="11" fill="{SKIN}"/><circle cx="268" cy="414" r="11" fill="{SKIN}"/>'
        # the jacket, its shadow band, standing collar and gold buttons
        '<path d="M156,300 L244,300 Q262,360 256,450 L144,450 Q138,360 156,300 Z" fill="#1e2440"/>'
        '<path d="M156,300 L176,300 Q166,380 170,450 L144,450 Q138,360 156,300 Z" fill="#151a30" stroke="none"/>'
        '<path d="M178,300 L222,300 L222,316 Q200,322 178,316 Z" fill="#1e2440"/>'
        '<path d="M200,322 L200,450" fill="none" stroke="#0e1222" stroke-width="2"/>'
        '<circle cx="200" cy="340" r="4.5" fill="#e8c050"/><circle cx="200" cy="370" r="4.5" fill="#e8c050"/>'
        '<circle cx="200" cy="400" r="4.5" fill="#e8c050"/><circle cx="200" cy="430" r="4.5" fill="#e8c050"/>'
        + HEAD)
    bangs = ('M92,196 Q86,74 200,64 Q314,74 308,196 Q300,178 292,158 Q288,186 280,206 Q268,166 256,138 Q250,172 236,198 '
             'Q226,160 212,128 Q206,164 194,190 Q186,156 176,126 Q168,166 156,198 Q148,168 140,140 Q130,178 118,204 Q112,178 106,160 Q98,180 92,196 Z')
    hair_front = lined(
        f'<path d="M100,168 Q92,206 100,236 Q112,222 118,200 Z" fill="{hair}"/>'
        f'<path d="M300,168 Q308,206 300,236 Q288,222 282,200 Z" fill="{hair}"/>'
        f'<path d="{bangs}" fill="{hair}"/>'
        f'<path d="{RING}" fill="{ring}" stroke="none"/>')
    glasses = ('<g fill="#ffffff" fill-opacity="0.18" stroke="#34344a" stroke-width="3.5">'
               '<circle cx="156" cy="242" r="34"/><circle cx="244" cy="242" r="34"/></g>'
               '<path d="M190,236 Q200,230 210,236 M122,236 L104,228 M278,236 L296,228" stroke="#34344a" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
               '<path d="M134,222 l12,-10 M222,222 l12,-10" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>')
    return sprite(back + body + hair_front + face(expression, iris, hair) + glasses)


def hayashi(expression):
    hair, hair_dark, ring = '#d4d4de', '#a8a8bc', '#f2f2f8'
    iris = ('#3a2a20', '#6a4a36', '#9a7a60')
    drop = 24  # she is a little shorter than the students
    back = lined(f'<circle cx="200" cy="58" r="40" fill="{hair_dark}"/><circle cx="200" cy="58" r="34" fill="{hair}"/>'
                 '<path d="M176,52 Q200,40 224,52" fill="none" stroke-width="2"/>'
                 '<path d="M226,34 L250,22 M232,42 L258,36" stroke="#c88a3a" stroke-width="3.5"/>'
                 f'<path d="M88,190 Q72,74 200,70 Q328,74 312,190 Q316,240 300,260 L100,260 Q84,240 88,190 Z" fill="{hair_dark}"/>')
    body = lined(
        # long skirt and slippers
        '<path d="M146,400 L254,400 L270,512 L130,512 Z" fill="#3a4a7a"/>'
        '<path d="M146,400 L164,400 L150,512 L130,512 Z" fill="#2c3a62" stroke="none"/>'
        '<path d="M148,508 Q148,530 194,530 L194,510 Z M252,508 Q252,530 206,530 L206,510 Z" fill="#b04a50"/>'
        # cardigan sleeves with the hands held in front
        '<path d="M152,318 Q116,350 132,402 Q160,416 188,400 Q166,384 168,346 Z" fill="#7fae8a"/>'
        '<path d="M248,318 Q284,350 268,402 Q240,416 212,400 Q234,384 232,346 Z" fill="#7fae8a"/>'
        # cardigan, then the apron over it
        '<path d="M158,300 L242,300 Q262,350 256,420 L144,420 Q138,350 158,300 Z" fill="#7fae8a"/>'
        '<path d="M158,300 L176,300 Q166,360 168,420 L144,420 Q138,350 158,300 Z" fill="#6a967a" stroke="none"/>'
        '<path d="M172,318 L228,318 L230,350 Q244,420 248,470 L152,470 Q156,420 170,350 Z" fill="#faf4e4"/>'
        '<path d="M160,352 Q200,344 240,352" fill="none" stroke-width="2"/>'
        '<path d="M172,318 L180,300 M228,318 L220,300" fill="none" stroke-width="2"/>'
        '<path d="M172,432 Q200,428 228,432 L228,458 L172,458 Z" fill="#efe4c8"/>'
        f'<circle cx="186" cy="400" r="11" fill="{SKIN}"/><circle cx="214" cy="400" r="11" fill="{SKIN}"/>'
        f'<path d="M186,288 L186,306 Q200,314 214,306 L214,288 Z" fill="{SKIN_SHADE}"/>'
        f'<path d="M100,170 Q100,124 200,122 Q300,124 300,170 Q300,262 240,290 Q200,306 160,290 Q100,262 100,170 Z" fill="{SKIN}"/>')
    swept = ('M92,200 Q84,80 200,72 Q316,80 308,200 Q298,154 252,136 Q222,128 200,142 Q178,128 148,136 Q102,154 92,200 Z')
    hair_front = lined(
        f'<path d="M100,168 Q90,220 102,262 Q114,240 118,200 Z" fill="{hair}"/>'
        f'<path d="M300,168 Q310,220 298,262 Q286,240 282,200 Z" fill="{hair}"/>'
        f'<path d="{swept}" fill="{hair}"/>'
        f'<path d="M126,112 Q200,84 274,112 Q252,98 200,94 Q148,98 126,112 Z" fill="{ring}" stroke="none"/>'
        '<path d="M130,120 Q160,110 196,136 M270,120 Q240,110 204,136" fill="none" stroke-width="2"/>')
    kind = {'neutral': 'neutral', 'smile': 'smile'}[expression]
    eyes = 'open' if kind == 'neutral' else 'happy'
    out = eye(156, 244, 1, eyes, iris, 0.72) + eye(244, 244, -1, eyes, iris, 0.72)
    out += brows('happy', '#9a9aae', -10)
    out += blush() + mouth('smile' if kind == 'smile' else 'neutral')
    # the lines of a long, kind life
    out += '<path d="M118,236 l-8,-4 M118,246 l-8,2 M282,236 l8,-4 M282,246 l8,2 M150,268 q6,3 12,0 M238,268 q6,3 12,0" stroke="#d09a88" stroke-width="2" stroke-linecap="round" fill="none"/>'
    return sprite(f'<g transform="translate(0 {drop})">' + back + body + hair_front + out + '</g>')


def mochi_cat(expression):
    """A calico cat sitting, its head big as a chibi's."""
    white, orange, black = '#fdfaf4', '#f0963a', '#2e2a30'
    body = lined(
        # tail, curling up on the right
        f'<path d="M262,500 Q330,500 334,440 Q336,400 312,390 Q300,392 306,404 Q320,416 316,444 Q310,480 256,484 Z" fill="{orange}"/>'
        '<path d="M318,412 l10,-4 M322,434 l12,0 M314,460 l12,6" fill="none" stroke="#c06a20" stroke-width="3"/>'
        # body and its patches
        f'<path d="M140,530 Q120,420 170,362 L230,362 Q280,420 260,530 Z" fill="{white}"/>'
        f'<path d="M232,370 Q280,420 262,526 L226,526 Q248,470 232,370 Z" fill="{black}"/>'
        f'<path d="M148,440 Q160,400 186,392 Q182,430 160,470 Z" fill="{orange}"/>'
        # front paws
        f'<path d="M168,496 Q160,530 176,532 L196,532 Q204,520 196,492 Z M204,492 Q196,520 204,532 L224,532 Q240,530 232,496 Z" fill="{white}"/>'
        '<path d="M182,532 l0,-8 M188,532 l0,-8 M210,532 l0,-8 M216,532 l0,-8" fill="none" stroke-width="1.8"/>')
    return body + mochi_head(expression)


def mochi_head(expression):
    """Mochi's head with its ears, patches, collar and face, centred on (200, 250); also drawn in Catnap."""
    white, orange, black = '#fdfaf4', '#f0963a', '#2e2a30'
    head = lined(
        f'<path d="M108,214 L118,120 L170,170 Z" fill="{orange}"/><path d="M292,214 L282,120 L230,170 Z" fill="{black}"/>'
        '<path d="M122,190 L126,142 L156,172 Z M278,190 L274,142 L244,172 Z" fill="#ffb0c0"/>'
        f'<path d="M96,250 Q96,150 200,150 Q304,150 304,250 Q304,350 200,350 Q96,350 96,250 Z" fill="{white}"/>'
        f'<path d="M100,224 Q110,160 186,154 Q176,200 150,220 Q126,236 100,224 Z" fill="{orange}"/>'
        f'<path d="M300,224 Q290,160 222,154 Q232,196 256,212 Q284,230 300,224 Z" fill="{black}"/>'
        # collar and bell
        '<path d="M136,330 Q200,362 264,330 L262,346 Q200,378 138,346 Z" fill="#e0405a"/>'
        '<circle cx="200" cy="364" r="12" fill="#f2c94c"/><path d="M190,364 L210,364 M200,364 L200,374" stroke="#a07820" stroke-width="2"/>')
    iris = ('#3a6a2a', '#6aaa3a', '#b8e070')
    if expression == 'neutral':
        eyes = eye(156, 258, 1, 'open', iris, 0.9) + eye(244, 258, -1, 'open', iris, 0.9)
        mouth_part = mouth('cat')
    elif expression == 'happy':
        eyes = eye(156, 262, 1, 'happy', iris, 0.9) + eye(244, 262, -1, 'happy', iris, 0.9)
        mouth_part = mouth('cat') + f'<path d="M192,288 Q200,302 208,288 Z" fill="#e05a70" stroke="{LINE}" stroke-width="2"/>'
    else:
        eyes = eye(156, 256, 1, 'closed', iris, 0.9) + eye(244, 256, -1, 'closed', iris, 0.9)
        mouth_part = mouth('cat') + (f'<g fill="none" stroke="#7a88b8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'
                                     '<path d="M300,140 h14 l-14,16 h14"/><path d="M322,108 h18 l-18,20 h18"/></g>')
    whiskers = ('<path d="M108,282 L66,274 M108,292 L64,296 M292,282 L334,274 M292,292 L336,296" '
                'stroke="#8a7a7a" stroke-width="2" stroke-linecap="round"/>')
    nose = '<path d="M194,272 L206,272 L200,279 Z" fill="#ff8aa0" stroke="#c05a70" stroke-width="1.5" stroke-linejoin="round"/>'
    cheeks = (f'<ellipse cx="128" cy="290" rx="18" ry="8" fill="#ffa0b4" fill-opacity="0.5"/>'
              f'<ellipse cx="272" cy="290" rx="18" ry="8" fill="#ffa0b4" fill-opacity="0.5"/>')
    return head + eyes + cheeks + nose + mouth_part + whiskers


def mochi(expression):
    # a cat is small: drawn in the lower half of the picture, half size
    return sprite(f'<g transform="translate(100 270) scale(0.5)">{mochi_cat(expression)}</g>')


def sprite(content):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{SPRITE_BOX}" width="600" height="1000">{content}</svg>'


def inner(svg_text):
    """The drawing inside a sprite, to place it in a scene."""
    return svg_text[svg_text.index('>') + 1:svg_text.rindex('</svg>')]


# ---------------------------------------------------------------------------------------- scenes

_ids = [0]


def uid(prefix):
    _ids[0] += 1
    return f'{prefix}{_ids[0]}'


def scene(content):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">{content}</svg>'


def linear(stops, x2=0, y2=1):
    """A gradient and the fill that uses it: returns (defs, 'url(#id)')."""
    gid = uid('g')
    parts = ''.join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return f'<defs><linearGradient id="{gid}" x1="0" y1="0" x2="{x2}" y2="{y2}">{parts}</linearGradient></defs>', f'url(#{gid})'


def glow(cx, cy, r, color, opacity=0.6):
    gid = uid('r')
    return (f'<defs><radialGradient id="{gid}"><stop offset="0" stop-color="{color}" stop-opacity="{opacity}"/>'
            f'<stop offset="1" stop-color="{color}" stop-opacity="0"/></radialGradient></defs>'
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#{gid})"/>')


def rect(x, y, w, h, fill, line=LINE, width=3, extra=''):
    stroke = f' stroke="{line}" stroke-width="{width}"' if line else ''
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}"{stroke} stroke-linejoin="round" {extra}/>'


def sky(top, bottom, height=900):
    defs, fill = linear([(0, top), (1, bottom)])
    return defs + f'<rect width="1600" height="{height}" fill="{fill}"/>'


def blobs(circles, base, line, shade=None, light=None, width=4):
    """Round shapes merged into one outlined mass: blossoms, clouds, bushes. With a shade, the base
    colour sits up and inside it, so the shade shows as a band along the bottom."""
    out = ''.join(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r + width:.0f}" fill="{line}"/>' for x, y, r in circles)
    if shade:
        out += ''.join(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="{shade}"/>' for x, y, r in circles)
        out += ''.join(f'<circle cx="{x:.0f}" cy="{y - r * 0.2:.0f}" r="{r * 0.78:.0f}" fill="{base}"/>' for x, y, r in circles)
    else:
        out += ''.join(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="{base}"/>' for x, y, r in circles)
    if light:
        out += ''.join(f'<circle cx="{x - r * 0.25:.0f}" cy="{y - r * 0.4:.0f}" r="{r * 0.32:.0f}" fill="{light}"/>'
                       for x, y, r in circles[::3])
    return out


def cloud(x, y, w, rng, color='#ffffff', line='#a8c4e0', shade='#dceaf8'):
    circles = [(x + rng.uniform(-w / 2, w / 2), y + rng.uniform(-w * 0.08, w * 0.08), rng.uniform(w * 0.12, w * 0.22)) for _ in range(7)]
    circles.sort(key=lambda c: c[1])
    return blobs(circles, color, line, shade, width=3)


BLOSSOM = {'day': ('#f8bfd0', '#c86a8a', '#eea0b8', '#fde0ea'),
           'dusk': ('#f4a8bc', '#a04a6a', '#d8869e', '#ffd0dc'),
           'night': ('#b97aa2', '#4a2848', '#8e5a86', '#d49ac0'),
           'rain': ('#e2b0c0', '#8a6070', '#c896a8', '#f0d0da')}


def canopy(cx, cy, w, h, rng, palette='day', count=None):
    base, line, shade, light = BLOSSOM[palette]
    count = count or int(10 + w * h / 9000)
    circles = []
    for _ in range(count):
        a = rng.uniform(0, 2 * math.pi)
        d = math.sqrt(rng.random())
        circles.append((cx + math.cos(a) * d * w / 2, cy + math.sin(a) * d * h / 2, rng.uniform(0.16, 0.26) * min(w, h * 1.4)))
    circles.sort(key=lambda c: c[1])
    return blobs(circles, base, line, shade, light, width=max(2, int(w / 120)))


def tree(x, ground, size, rng, palette='day'):
    """A cherry tree size pixels tall, its trunk standing on (x, ground)."""
    s = size / 400
    bark = '#6a4038' if palette != 'night' else '#2e1e2c'
    bark_shade = '#4e2e2a' if palette != 'night' else '#22141f'
    line = LINE if palette != 'night' else '#140a14'
    trunk = (f'M{x - 18 * s},{ground} Q{x - 10 * s},{ground - 120 * s} {x - 16 * s},{ground - 210 * s} '
             f'L{x - 90 * s},{ground - 300 * s} L{x - 78 * s},{ground - 310 * s} L{x - 4 * s},{ground - 236 * s} '
             f'L{x + 6 * s},{ground - 330 * s} L{x + 20 * s},{ground - 330 * s} L{x + 16 * s},{ground - 230 * s} '
             f'L{x + 96 * s},{ground - 290 * s} L{x + 104 * s},{ground - 280 * s} L{x + 20 * s},{ground - 196 * s} '
             f'Q{x + 12 * s},{ground - 110 * s} {x + 22 * s},{ground} Z')
    out = f'<path d="{trunk}" fill="{bark}" stroke="{line}" stroke-width="{max(2, 3 * s):.1f}" stroke-linejoin="round"/>'
    out += f'<path d="M{x + 6 * s},{ground} Q{x + 2 * s},{ground - 110 * s} {x + 8 * s},{ground - 200 * s} L{x + 16 * s},{ground - 196 * s} Q{x + 12 * s},{ground - 110 * s} {x + 20 * s},{ground} Z" fill="{bark_shade}"/>'
    out += canopy(x, ground - 300 * s, 360 * s, 190 * s, rng, palette)
    return out


def petal_drift(n, rng, box=(0, 0, 1600, 900), size=(5, 10), color='#f9c6d4', line='#d07090'):
    """Petals in the air, each turned its own way."""
    x0, y0, x1, y1 = box
    out = ''
    for _ in range(n):
        r = rng.uniform(*size)
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        out += (f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{r:.1f}" ry="{r * 0.55:.1f}" transform="rotate({rng.uniform(0, 180):.0f} {x:.0f} {y:.0f})" '
                f'fill="{color}" stroke="{line}" stroke-width="1.2"/>')
    return out


def planks(top, color, line, count=14, vanish=800):
    """A wooden floor from y = top to the bottom, its boards running toward the viewer."""
    out = rect(0, top, 1600, 900 - top, color, None)
    for i in range(count + 1):
        far = vanish - 900 + i * 1800 / count
        near = -1200 + i * 4000 / count
        out += f'<path d="M{far:.0f},{top} L{near:.0f},900" stroke="{line}" stroke-width="2"/>'
    out += f'<path d="M0,{top} L1600,{top}" stroke="{LINE}" stroke-width="3"/>'
    return out


def window(x, y, w, h, rng, palette='day', panes=2, outside=None, curtains=None):
    """A window onto blue sky and cherry trees, with a wooden frame."""
    cid = uid('c')
    if outside is None:
        sky_top, sky_bottom = {'day': ('#7cb6ec', '#d6ecfc'), 'dusk': ('#e88a6a', '#ffd8a8'), 'night': ('#14163a', '#3a2c5a')}[palette]
        outside = sky(sky_top, sky_bottom).replace('width="1600" height="900"', f'x="{x}" y="{y}" width="{w}" height="{h}"')
        outside += canopy(x + w * 0.3, y + h * 0.75, w * 0.8, h * 0.45, rng, palette)
        outside += canopy(x + w * 0.9, y + h * 0.65, w * 0.5, h * 0.4, rng, palette)
    out = f'<defs><clipPath id="{cid}"><rect x="{x}" y="{y}" width="{w}" height="{h}"/></clipPath></defs>'
    out += f'<g clip-path="url(#{cid})">{outside}</g>'
    frame = '#e8e0d0'
    out += rect(x - 14, y - 14, w + 28, 14, frame) + rect(x - 14, y + h, w + 28, 18, frame)
    out += rect(x - 14, y, 14, h, frame) + rect(x + w, y, 14, h, frame)
    for i in range(1, panes):
        out += rect(x + w * i / panes - 6, y, 12, h, frame)
    out += f'<path d="M{x + 20},{y + 20} l60,-0 M{x + 20},{y + 36} l30,0" stroke="#ffffff" stroke-width="5" opacity="0.6" stroke-linecap="round"/>'
    if curtains:
        out += (f'<path d="M{x - 40},{y - 30} L{x + w * 0.22},{y - 30} Q{x + w * 0.12},{y + h * 0.5} {x + w * 0.04},{y + h + 30} L{x - 40},{y + h + 30} Z" fill="{curtains}" stroke="{LINE}" stroke-width="3"/>'
                f'<path d="M{x + w + 40},{y - 30} L{x + w * 0.78},{y - 30} Q{x + w * 0.88},{y + h * 0.5} {x + w * 0.96},{y + h + 30} L{x + w + 40},{y + h + 30} Z" fill="{curtains}" stroke="{LINE}" stroke-width="3"/>')
    return out


def books(x, y, w, h, rng, colors=('#c04a4a', '#3a6aa8', '#e0b040', '#4a8a5a', '#8a5aa0', '#e07a40', '#f0e6d0', '#2e4a6a')):
    """A row of books on a shelf whose top is y, filling w pixels."""
    out = ''
    cx = x
    while cx < x + w - 10:
        bw = rng.uniform(12, 24)
        bh = h * rng.uniform(0.7, 0.98)
        lean = cx + bw > x + w
        if lean:
            break
        c = rng.choice(colors)
        out += rect(round(cx), round(y + h - bh), round(bw), round(bh), c, LINE, 1.5)
        out += f'<path d="M{cx + 3:.0f},{y + h - bh + 8:.0f} l{bw - 6:.0f},0" stroke="#ffffff" stroke-width="2" opacity="0.5"/>'
        cx += bw + rng.uniform(0, 2)
    return out


def bookcase(x, y, w, h, rng, shelves=5, wood='#8a5a3a'):
    out = rect(x, y, w, h, wood)
    step = h / shelves
    for i in range(shelves):
        top = y + 14 + i * step
        out += rect(x + 14, top, w - 28, step - 22, '#4a2e22', None)
        out += books(x + 18, top + 6, w - 36, step - 28, rng)
        out += rect(x + 8, top + step - 22, w - 16, 10, '#a8724a', LINE, 2)
    return out


def text(x, y, words, size, fill, anchor='middle', weight='bold', extra='', family=FONT):
    return (f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" font-weight="{weight}" fill="{fill}" '
            f'text-anchor="{anchor}" {extra}>{words}</text>')


def place(sprite_svg, x, y, height):
    """A sprite drawn with its box top-left at (x, y), height pixels tall."""
    return f'<svg x="{x}" y="{y}" width="{height * 0.6:.0f}" height="{height}" viewBox="{SPRITE_BOX}">{inner(sprite_svg)}</svg>'


def stars(n, rng, height=500):
    return ''.join(f'<circle cx="{rng.uniform(0, 1600):.0f}" cy="{rng.uniform(0, height):.0f}" r="{rng.choice((1, 1.5, 2, 2.5))}" '
                   f'fill="#fff8e0" opacity="{rng.uniform(0.5, 1):.2f}"/>' for _ in range(n))


def lantern(x, y, r, color, lit=False):
    out = glow(x, y, r * 3.2, '#ffcc66', 0.55) if lit else ''
    out += f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r * 1.2}" fill="{color}" stroke="{LINE}" stroke-width="2"/>'
    out += f'<path d="M{x - r * 0.95},{y - r * 0.4} Q{x},{y - r * 0.55} {x + r * 0.95},{y - r * 0.4} M{x - r},{y + r * 0.1} Q{x},{y} {x + r},{y + r * 0.1} M{x - r * 0.9},{y + r * 0.55} Q{x},{y + r * 0.45} {x + r * 0.9},{y + r * 0.55}" stroke="{LINE}" stroke-width="1.2" fill="none" opacity="0.6"/>'
    out += rect(x - r * 0.45, y - r * 1.35, r * 0.9, r * 0.25, '#2e2228', None) + rect(x - r * 0.45, y + r * 1.12, r * 0.9, r * 0.25, '#2e2228', None)
    if lit:
        out += f'<ellipse cx="{x - r * 0.3}" cy="{y - r * 0.3}" rx="{r * 0.35}" ry="{r * 0.5}" fill="#fff4c0" opacity="0.7"/>'
    return out


def string_of(x0, x1, y, sag, n, draw):
    """Things hung along a sagging line from x0 to x1."""
    out = f'<path d="M{x0},{y} Q{(x0 + x1) / 2},{y + sag * 2} {x1},{y}" stroke="#3a2a2a" stroke-width="2" fill="none"/>'
    for i in range(n):
        t = (i + 0.5) / n
        px = x0 + (x1 - x0) * t
        py = y + sag * 4 * t * (1 - t)
        out += draw(px, py, i)
    return out


def bunting(x0, x1, y, sag, n, colors=('#e0405a', '#f2c94c', '#4a90d0', '#6ab04c', '#ffffff', '#f08a3a')):
    def flag(px, py, i):
        return f'<path d="M{px - 16:.0f},{py:.0f} L{px + 16:.0f},{py:.0f} L{px:.0f},{py + 34:.0f} Z" fill="{colors[i % len(colors)]}" stroke="{LINE}" stroke-width="2" stroke-linejoin="round"/>'
    return string_of(x0, x1, y, sag, n, flag)


def stall(x, y, w, h, stripe, lit=False):
    """A festival stall: striped awning, counter, goods."""
    body = '#a8724a' if not lit else '#4a2e26'
    out = rect(x, y, w, h, body)
    inside = '#ffe6a8' if lit else '#f6e8cc'
    out += rect(x + 12, y + 40, w - 24, h * 0.45, inside, LINE, 2)
    if lit:
        out += glow(x + w / 2, y + 40 + h * 0.22, w * 0.6, '#ffc060', 0.5)
    out += rect(x - 6, y + h * 0.62, w + 12, 18, '#d8a070' if not lit else '#6a4030')
    n = 6
    for i in range(n):
        fill = stripe if i % 2 == 0 else '#ffffff'
        if lit and i % 2:
            fill = '#f0e0c8'
        sx = x - 14 + i * (w + 28) / n
        out += f'<path d="M{sx:.0f},{y - 30} L{sx + (w + 28) / n:.0f},{y - 30} L{sx + (w + 28) / n:.0f},{y + 20} Q{sx + (w + 28) / n / 2:.0f},{y + 34} {sx:.0f},{y + 20} Z" fill="{fill}" stroke="{LINE}" stroke-width="2" stroke-linejoin="round"/>'
    return out


# The street, the main road of the town, used in three pictures.

def street(weather='day'):
    rng = random.Random(7)
    rain = weather == 'rain'
    out = sky('#8a98a8', '#c8ccd2') if rain else sky('#6aaee8', '#d8eefa')
    if not rain:
        out += cloud(260, 120, 360, rng) + cloud(1180, 90, 420, rng) + cloud(760, 200, 240, rng)
    # houses at the end of the road
    for i, hx in enumerate(range(380, 1260, 110)):
        hh = 60 + (i * 37) % 50
        wall = '#efe4d4' if not rain else '#c8c4c0'
        roof = ('#5a6a8a', '#8a4a4a', '#4a6a5a')[i % 3]
        out += rect(hx, 470 - hh, 100, hh, wall, LINE, 2)
        out += f'<path d="M{hx - 10},{470 - hh} L{hx + 50},{440 - hh} L{hx + 110},{470 - hh} Z" fill="{roof}" stroke="{LINE}" stroke-width="2" stroke-linejoin="round"/>'
        out += rect(hx + 20, 480 - hh, 22, 18, '#9ac4e0', LINE, 1.5) + rect(hx + 60, 480 - hh, 22, 18, '#9ac4e0', LINE, 1.5)
    # road, kerbs and pavements
    road = '#8a8a96' if not rain else '#6e7280'
    out += f'<path d="M0,470 L1600,470 L1600,900 L0,900 Z" fill="{"#b8b0a4" if not rain else "#8e8a88"}"/>'
    out += f'<path d="M740,470 L860,470 L1460,900 L140,900 Z" fill="{road}" stroke="{LINE}" stroke-width="3"/>'
    out += '<path d="M800,480 L800,520 M800,560 L800,620 M800,670 L800,760 M800,810 L800,900" stroke="#f4f0e4" stroke-width="8" opacity="0.8"/>'
    for t in (0.25, 0.5, 0.75):
        out += f'<path d="M{740 - 740 * t:.0f},{470 + 430 * t:.0f} L{0},{470 + 430 * t:.0f}" stroke="#9a9286" stroke-width="2"/>'
        out += f'<path d="M{860 + 740 * t:.0f},{470 + 430 * t:.0f} L1600,{470 + 430 * t:.0f}" stroke="#9a9286" stroke-width="2"/>'
    if rain:
        for px, py, pw in ((520, 760, 220), (1010, 640, 160), (780, 560, 110), (300, 850, 180)):
            out += f'<ellipse cx="{px}" cy="{py}" rx="{pw}" ry="{pw * 0.14}" fill="#a8b8cc" stroke="#7a8aa0" stroke-width="2" opacity="0.85"/>'
            out += f'<path d="M{px - pw * 0.5},{py} l{pw * 0.4},0" stroke="#fff" stroke-width="3" opacity="0.6"/>'
    # telegraph poles and their wires
    for side in (-1, 1):
        for t in (0.15, 0.55):
            px = 800 + side * (90 + 650 * t)
            out += rect(px - 4 - 6 * t, 260 - 160 * t, 8 + 12 * t, 220 + 340 * t, '#7a7064', LINE, 2)
            out += rect(px - 26 - 20 * t, 280 - 160 * t, 52 + 40 * t, 6 + 4 * t, '#7a7064', LINE, 2)
    out += '<path d="M0,170 Q400,240 820,214 Q1200,236 1600,160 M0,196 Q420,262 790,236 Q1180,262 1600,186" stroke="#3a3440" stroke-width="2" fill="none"/>'
    # cherry trees along both sides, far ones first
    palette = 'rain' if rain else 'day'
    for t in (0.1, 0.3, 0.55, 0.85):
        for side in (-1, 1):
            out += tree(800 + side * (110 + 760 * t), 470 + 380 * t, 180 + 520 * t, rng, palette)
    if rain:
        out += '<rect width="1600" height="900" fill="#506080" opacity="0.18"/>'
        out += ''.join(f'<path d="M{rng.uniform(0, 1700):.0f},{rng.uniform(-50, 900):.0f} l-14,46" stroke="#e8f0ff" stroke-width="2" opacity="0.6"/>' for _ in range(260))
    else:
        out += petal_drift(70, rng)
    return scene(out)


def classroom():
    rng = random.Random(3)
    out = sky('#f6eedc', '#ecdcc0')
    out += rect(0, 0, 1600, 60, '#e4d4b8', None) + '<path d="M0,60 L1600,60" stroke="#5a3438" stroke-width="3"/>'
    # chalkboard
    out += rect(130, 130, 800, 330, '#a8724a') + rect(150, 150, 760, 290, '#2e5a44', LINE, 2)
    out += '<path d="M170,170 l120,-0 M170,184 l60,0" stroke="#ffffff" stroke-width="4" opacity="0.15"/>'
    out += text(530, 300, 'Welcome back!', 76, '#f4f4ec', family="'Comic Sans MS', cursive")
    out += '<path d="M380,330 Q530,350 690,326" stroke="#f4f4ec" stroke-width="4" fill="none" stroke-linecap="round"/>'
    for fx, fy in ((780, 380), (820, 400), (260, 390)):
        out += ''.join(f'<ellipse cx="{fx + 14 * math.cos(a):.0f}" cy="{fy + 14 * math.sin(a):.0f}" rx="9" ry="6" transform="rotate({math.degrees(a):.0f} {fx + 14 * math.cos(a):.0f} {fy + 14 * math.sin(a):.0f})" fill="none" stroke="#f8b8c8" stroke-width="3"/>' for a in [i * 2 * math.pi / 5 for i in range(5)])
    out += rect(140, 460, 780, 14, '#a8724a') + rect(300, 452, 40, 10, '#ffffff', LINE, 1.5) + rect(360, 452, 28, 10, '#f8b8c8', LINE, 1.5)
    # clock
    out += '<circle cx="1000" cy="130" r="40" fill="#ffffff" stroke="#5a3438" stroke-width="5"/><path d="M1000,130 L1000,104 M1000,130 L1018,140" stroke="#3a2a2a" stroke-width="4" stroke-linecap="round"/>'
    # windows
    out += window(1080, 130, 440, 380, rng, panes=2)
    out += rect(1060, 520, 480, 30, '#e8e0d0')
    # floor, desks
    out += planks(620, '#c8925e', '#a87444', count=16)
    for row, (y, s) in enumerate(((560, 0.6), (640, 0.8), (750, 1.05))):
        for col in range(4 + row // 2):
            n = 4 + row // 2
            x = 800 + (col - (n - 1) / 2) * 330 * s
            w, h = 220 * s, 26 * s
            out += rect(x - w / 2 + 20 * s, y + h, 10 * s, 90 * s, '#7a7a84', LINE, 2) + rect(x + w / 2 - 30 * s, y + h, 10 * s, 90 * s, '#7a7a84', LINE, 2)
            out += rect(x - w / 2, y + h, w, 40 * s, '#b07a4a', LINE, 2)
            out += rect(x - w / 2, y, w, h, '#d8a46a', LINE, 2.5)
    out += petal_drift(12, rng, (1080, 130, 1520, 510))
    return scene(out)


def bedroom():
    rng = random.Random(5)
    out = sky('#fbeedd', '#f2dcc2')
    out += window(820, 150, 400, 300, rng, curtains='#f2a8b8')
    # shelf above the bed, a poster
    out += rect(120, 220, 360, 16, '#a8724a') + books(140, 150, 200, 70, rng) + rect(380, 180, 50, 40, '#8ac0a0', LINE, 2)
    out += rect(560, 130, 150, 200, '#bcd8f0') + '<circle cx="635" cy="200" r="34" fill="#f8bfd0" stroke="#5a3438" stroke-width="2"/>' + text(635, 300, 'STAR', 30, '#3a5a8a')
    out += planks(620, '#c8925e', '#a87444')
    out += '<ellipse cx="800" cy="790" rx="380" ry="70" fill="#f4c8d0" stroke="#5a3438" stroke-width="3"/><ellipse cx="800" cy="790" rx="330" ry="52" fill="none" stroke="#e8a4b4" stroke-width="4"/>'
    # bed
    out += rect(60, 400, 40, 300, '#a8724a') + rect(60, 400, 140, 40, '#a8724a')
    out += rect(80, 560, 580, 120, '#a8724a')
    out += rect(90, 500, 560, 80, '#ffffff')
    out += '<path d="M110,500 Q100,450 150,446 L250,446 Q290,450 280,500 Z" fill="#ffffff" stroke="#5a3438" stroke-width="3"/>'
    out += '<path d="M260,500 Q300,460 400,470 L650,480 L660,620 L240,620 Q230,560 260,500 Z" fill="#7aa0d8" stroke="#5a3438" stroke-width="3" stroke-linejoin="round"/>'
    out += '<path d="M240,600 L660,600 L660,620 L240,620 Z" fill="#5a80b8"/>'
    out += '<path d="M300,520 L640,520 M300,560 L640,560" stroke="#a8c4ec" stroke-width="5"/>'
    # desk, chair, lamp
    out += rect(1240, 560, 340, 26, '#d8a46a') + rect(1256, 586, 24, 200, '#a8724a') + rect(1540, 586, 24, 200, '#a8724a') + rect(1400, 586, 140, 90, '#b8824e')
    out += books(1280, 480, 120, 80, rng) + rect(1440, 540, 70, 20, '#ffffff', LINE, 2)
    out += '<path d="M1520,560 L1520,470 L1480,440" stroke="#5a3438" stroke-width="6" fill="none"/><path d="M1450,420 L1500,440 L1480,470 Z" fill="#f2c94c" stroke="#5a3438" stroke-width="2.5"/>'
    out += rect(1300, 640, 110, 22, '#e0405a') + rect(1310, 662, 12, 120, '#7a7a84', LINE, 2) + rect(1388, 662, 12, 120, '#7a7a84', LINE, 2)
    out += '<polygon points="820,450 1220,450 1340,900 700,900" fill="#fff6d8" opacity="0.25"/>'
    return scene(out)


def kitchen():
    rng = random.Random(11)
    out = sky('#fff6e4', '#fcecd0')
    for row in range(8):
        for col in range(34):
            out += rect(col * 48 + (24 if row % 2 else 0) - 24, 380 + row * 32, 48, 32, '#fffaf0' if (row + col) % 3 else '#e8f2f0', '#d8ccb8', 1.5)
    out += window(170, 110, 380, 230, rng, curtains='#f2a8a8')
    out += rect(150, 350, 420, 12, '#e8e0d0')
    # shelf with jars
    out += rect(880, 250, 520, 14, '#a8724a')
    for i, c in enumerate(('#e0405a', '#f2c94c', '#6ab04c', '#4a90d0', '#f08a3a', '#c8a0e0')):
        out += rect(900 + i * 84, 180, 56, 70, c, LINE, 2.5) + rect(904 + i * 84, 170, 48, 14, '#8a5a3a', LINE, 2)
    # pendant lamp
    out += '<path d="M700,0 L700,150" stroke="#3a2a2a" stroke-width="3"/><path d="M640,200 Q700,130 760,200 Z" fill="#f2c94c" stroke="#5a3438" stroke-width="3"/>' + glow(700, 220, 140, '#ffe8a0', 0.5)
    # floor
    for row in range(8):
        for col in range(20):
            out += rect(col * 90, 640 + row * 36, 90, 36, '#e8d8c0' if (row + col) % 2 else '#cdb898', None)
    out += '<path d="M0,640 L1600,640" stroke="#5a3438" stroke-width="3"/>'
    # counter and stove
    out += rect(1000, 470, 600, 30, '#d8d0c4') + rect(1000, 500, 600, 300, '#f0e6d4')
    for i in range(3):
        out += rect(1020 + i * 196, 520, 176, 260, '#e8dcc6', LINE, 2) + rect(1020 + i * 196 + 140, 620, 10, 40, '#8a7a6a', LINE, 1.5)
    out += rect(1180, 440, 200, 30, '#3a3a44') + '<circle cx="1230" cy="440" r="14" fill="#222"/><circle cx="1330" cy="440" r="14" fill="#222"/>'
    out += '<path d="M1290,436 Q1290,390 1330,390 Q1370,390 1370,436 Z" fill="#e0405a" stroke="#5a3438" stroke-width="3"/><path d="M1370,410 L1400,396" stroke="#5a3438" stroke-width="6"/>'
    # table with breakfast
    out += '<path d="M380,600 L1000,600 L1040,640 L340,640 Z" fill="#d8a46a" stroke="#5a3438" stroke-width="3"/>' + rect(340, 640, 700, 24, '#b07a4a')
    out += rect(380, 664, 26, 200, '#a8724a') + rect(974, 664, 26, 200, '#a8724a')
    for px in (520, 820):
        out += f'<ellipse cx="{px}" cy="616" rx="90" ry="20" fill="#ffffff" stroke="#5a3438" stroke-width="2.5"/>'
    out += '<path d="M480,612 Q480,580 520,580 Q560,580 560,612 Z" fill="#e8b060" stroke="#5a3438" stroke-width="2.5"/><path d="M490,604 L550,604" stroke="#c88a3a" stroke-width="3"/>'
    out += '<path d="M780,612 Q780,584 820,582 Q860,584 860,612 Z" fill="#fffaf0" stroke="#5a3438" stroke-width="2.5"/>'
    out += '<path d="M650,560 L650,612 Q670,624 690,612 L690,560 Z" fill="#a8c8e8" stroke="#5a3438" stroke-width="2.5"/>'
    return scene(out)


def clubroom(with_banner=False):
    rng = random.Random(13)
    out = sky('#f8f0e2', '#eee0c8')
    out += window(1000, 120, 480, 340, rng, panes=2, curtains='#e8d8b0')
    out += bookcase(80, 120, 340, 500, rng, shelves=4)
    # easels with paintings
    for ex, art in ((560, 'blossom'), (800, 'river')):
        out += f'<path d="M{ex},300 L{ex - 70},640 M{ex + 140},300 L{ex + 210},640 M{ex + 70},280 L{ex + 70},620" stroke="#8a5a3a" stroke-width="12" stroke-linecap="round"/>'
        out += rect(ex - 20, 250, 180, 220, '#fffaf0', LINE, 4)
        if art == 'blossom':
            out += canopy(ex + 70, 330, 130, 100, rng) + rect(ex + 64, 370, 12, 80, '#6a4038', LINE, 2)
        else:
            out += rect(ex - 14, 370, 168, 94, '#7ab0e0', None) + cloud(ex + 60, 310, 110, rng)
        out += rect(ex - 30, 470, 200, 14, '#8a5a3a')
    out += planks(640, '#c8925e', '#a87444')
    if not with_banner:
        out += '<path d="M200,700 L1400,700 L1480,800 L120,800 Z" fill="#c89060" stroke="#5a3438" stroke-width="3"/>'
        out += '<path d="M300,690 L1300,690 L1340,770 L260,770 Z" fill="#fffaf4" stroke="#5a3438" stroke-width="3"/>'
        out += text(800, 750, 'SAKURA', 64, '#f4a0b4', extra='letter-spacing="20" opacity="0.9"')
        for px, c in ((1320, '#e0405a'), (1380, '#4a90d0'), (1440, '#f2c94c')):
            out += rect(px, 730, 44, 50, c, LINE, 2.5) + rect(px + 4, 722, 36, 12, '#ffffff', LINE, 2)
    return scene(out)


def library(cranes=False):
    rng = random.Random(17)
    out = sky('#6a4a36', '#4a3226')
    # the tall window, light falling in
    out += window(560, 80, 480, 520, rng, panes=3)
    out += bookcase(0, 40, 520, 620, rng, shelves=5, wood='#7a4a30')
    out += bookcase(1080, 40, 520, 620, rng, shelves=5, wood='#7a4a30')
    out += planks(640, '#9a6a44', '#7a4e30')
    out += '<polygon points="560,600 1040,600 1260,900 340,900" fill="#fff4c8" opacity="0.22"/>'
    if cranes:
        return out
    out += '<path d="M260,700 L1340,700 L1400,760 L200,760 Z" fill="#b07a4a" stroke="#5a3438" stroke-width="3"/>' + rect(200, 760, 1200, 26, '#8a5a3a')
    out += rect(260, 786, 30, 120, '#7a4a30') + rect(1310, 786, 30, 120, '#7a4a30')
    out += '<path d="M500,720 L700,700 L700,740 L500,760 Z M700,700 L900,720 L900,760 L700,740 Z" fill="#fffaf0" stroke="#5a3438" stroke-width="2"/>'
    out += '<path d="M1100,700 L1100,600 M1060,600 L1140,600 L1120,560 L1080,560 Z" stroke="#5a3438" stroke-width="5" fill="#4a8a5a"/>' + glow(1100, 620, 140, '#ffe08a', 0.5)
    return scene(out)


def shop():
    rng = random.Random(19)
    out = sky('#ecd8b4', '#dcc296')
    # back shelves of sweets and jars
    for row, y in enumerate((150, 290, 430)):
        out += rect(60, y + 110, 1270, 16, '#8a5a3a')
        for i in range(12):
            x = 90 + i * 104
            c = rng.choice(('#f8bfd0', '#c8e8a8', '#fff0b0', '#a8d0f0', '#f4c098', '#e0c0f0'))
            if (i + row) % 3 == 0:
                out += rect(x, y + 40, 76, 70, c, LINE, 2.5) + rect(x + 6, y + 30, 64, 14, '#e0405a' if i % 2 else '#4a6aa8', LINE, 2)
            else:
                out += f'<path d="M{x},{y + 110} L{x},{y + 50} Q{x},{y + 34} {x + 16},{y + 34} L{x + 60},{y + 34} Q{x + 76},{y + 34} {x + 76},{y + 50} L{x + 76},{y + 110} Z" fill="#e8f4fc" stroke="{LINE}" stroke-width="2.5" opacity="0.95"/>'
                out += ''.join(f'<circle cx="{x + 18 + (k % 3) * 20}" cy="{y + 96 - (k // 3) * 18}" r="9" fill="{c}" stroke="{LINE}" stroke-width="1.5"/>' for k in range(6))
    # the noren curtain over the door
    out += rect(0, 0, 1600, 70, '#2e3a6a', None)
    for i in range(8):
        out += f'<path d="M{i * 200 + 4},40 L{i * 200 + 196},40 L{i * 200 + 196},120 Q{i * 200 + 100},130 {i * 200 + 4},120 Z" fill="#2e3a6a" stroke="{LINE}" stroke-width="2"/>'
    out += '<circle cx="800" cy="70" r="40" fill="#fffaf0"/>' + text(800, 88, '菓', 48, '#2e3a6a', family="'Noto Sans CJK JP', sans-serif")
    # lamps
    for lx in (420, 1180):
        out += f'<path d="M{lx},120 L{lx},170" stroke="#3a2a2a" stroke-width="3"/>' + lantern(lx, 200, 26, '#f2c94c', lit=True)
    out += rect(1360, 140, 110, 120, '#fffaf0', LINE, 2.5) + rect(1360, 140, 110, 30, '#e0405a', LINE, 2.5) + text(1415, 165, 'APR', 22, '#ffffff') + text(1415, 230, '12', 54, '#3a2a2a')
    # the counter with its glass case
    out += rect(0, 620, 1600, 280, '#8a5a3a') + rect(0, 600, 1600, 30, '#b07a4a')
    out += rect(300, 520, 900, 100, '#e8f4fc', LINE, 3, 'fill-opacity="0.6"')
    for i in range(5):
        x = 360 + i * 170
        out += f'<path d="M{x - 10},{596} L{x + 110},{576}" stroke="#8a6a4a" stroke-width="4"/>'
        for k, c in enumerate(('#f8bfd0', '#fffaf0', '#a8d890')):
            out += f'<circle cx="{x + 20 + k * 30}" cy="{590 - k * 5}" r="15" fill="{c}" stroke="{LINE}" stroke-width="2"/>'
    out += '<path d="M310,530 l60,0" stroke="#ffffff" stroke-width="5" opacity="0.7"/>'
    out += rect(1280, 540, 160, 70, '#3a3a44') + rect(1300, 520, 120, 30, '#c8c8d0', LINE, 2)
    for i in range(5):
        out += f'<path d="M{80 + i * 340},680 L{280 + i * 340},680" stroke="#6a4028" stroke-width="3"/>'
    return scene(out)


def riverbank():
    rng = random.Random(23)
    out = sky('#78b4ec', '#e0f0fa')
    out += cloud(300, 130, 380, rng) + cloud(1200, 100, 320, rng)
    out += '<path d="M0,430 Q400,400 800,420 Q1200,400 1600,430 L1600,480 L0,480 Z" fill="#8ab890" stroke="#5a3438" stroke-width="2"/>'
    for i in range(12):
        bx = 60 + i * 130
        out += rect(bx, 400 - (i % 3) * 20, 80, 40 + (i % 3) * 20, '#e8e2d8', LINE, 2)
    # the bridge far off
    out += '<path d="M980,440 Q1150,380 1320,440" stroke="#c84a4a" stroke-width="10" fill="none"/><path d="M1020,428 L1020,470 M1100,404 L1100,470 M1200,404 L1200,470 M1280,428 L1280,470" stroke="#c84a4a" stroke-width="6"/>'
    # river
    river_defs, river = linear([(0, '#5a9ad8'), (1, '#8ac4ec')])
    out += river_defs + f'<rect x="0" y="470" width="1600" height="190" fill="{river}"/>'
    out += ''.join(f'<path d="M{rng.uniform(0, 1600):.0f},{rng.uniform(490, 650):.0f} l{rng.uniform(30, 90):.0f},0" stroke="#e8f6ff" stroke-width="3" stroke-linecap="round" opacity="0.8"/>' for _ in range(40))
    out += petal_drift(40, rng, (0, 480, 1600, 650), (4, 7))
    # near bank: stone edge, path, grass
    out += rect(0, 650, 1600, 34, '#b8b0a4') + ''.join(f'<path d="M{x},650 l0,34" stroke="#8a8278" stroke-width="2"/>' for x in range(0, 1600, 80))
    out += rect(0, 684, 1600, 120, '#d8c8a8') + rect(0, 804, 1600, 96, '#7ab868')
    out += ''.join(f'<path d="M{x},{900 - rng.uniform(0, 80):.0f} l6,-18 l6,18" stroke="#4a8a4a" stroke-width="2.5" fill="none"/>' for x in range(0, 1600, 37))
    for x, g, s in ((180, 760, 600), (1460, 770, 640), (820, 700, 300)):
        out += tree(x, g, s, rng)
    out += petal_drift(50, rng)
    return scene(out)


def rooftop():
    rng = random.Random(29)
    out = sky('#5aa0e8', '#d4ecfc')
    out += cloud(400, 160, 520, rng) + cloud(1250, 110, 440, rng) + cloud(900, 280, 260, rng)
    for i in range(22):
        bx = i * 76 - 20
        bh = 60 + rng.uniform(0, 140)
        out += rect(bx, 600 - bh, 70, bh + 40, rng.choice(('#a8b8cc', '#bcc8d8', '#98a8bc')), '#6a7890', 2)
        out += ''.join(rect(bx + 10 + c * 20, 610 - bh + r * 26, 12, 14, '#e8f2fc', None) for c in range(3) for r in range(int(bh / 26)))
    out += canopy(200, 590, 300, 70, rng) + canopy(1350, 600, 360, 80, rng)
    # concrete floor
    out += rect(0, 660, 1600, 240, '#c4c0b8') + ''.join(f'<path d="M{x},660 L{(x - 800) * 2 + 800},900" stroke="#a8a49c" stroke-width="2"/>' for x in range(-400, 2000, 160))
    out += '<path d="M0,740 L1600,740 M0,830 L1600,830" stroke="#a8a49c" stroke-width="2"/>'
    # the fence
    out += rect(0, 360, 1600, 10, '#6a8a6a', LINE, 2) + rect(0, 650, 1600, 12, '#6a8a6a', LINE, 2)
    for x in range(-300, 1900, 40):
        out += f'<path d="M{x},370 L{x + 280},650 M{x + 280},370 L{x},650" stroke="#4a6a5a" stroke-width="1.6" opacity="0.7"/>'
    for x in range(40, 1600, 220):
        out += rect(x, 340, 14, 330, '#6a8a6a', LINE, 2)
    # stair house and water tank
    out += rect(1180, 380, 420, 420, '#e4e0d8') + rect(1250, 520, 130, 280, '#8a9aa8') + '<circle cx="1360" cy="660" r="7" fill="#e0c050" stroke="#5a3438" stroke-width="2"/>'
    out += rect(1440, 280, 140, 100, '#e8e8f0') + rect(1460, 380, 10, 0, '#888')
    return scene(out)


def hilltop():
    rng = random.Random(31)
    out = sky('#0e1030', '#3a2a5a')
    out += stars(220, rng, 600)
    out += glow(1220, 160, 180, '#fff4d0', 0.35) + '<circle cx="1220" cy="160" r="46" fill="#fff8e4" stroke="#e8d8a8" stroke-width="3"/><circle cx="1206" cy="150" r="9" fill="#efe4c4"/><circle cx="1236" cy="176" r="6" fill="#efe4c4"/>'
    out += '<path d="M0,600 Q400,560 800,590 Q1200,560 1600,600 L1600,760 L0,760 Z" fill="#1e1a36"/>'
    out += ''.join(f'<circle cx="{rng.uniform(0, 1600):.0f}" cy="{rng.uniform(610, 740):.0f}" r="{rng.choice((1.5, 2, 3))}" fill="{rng.choice(("#ffd880", "#ffb060", "#fff4c0"))}"/>' for _ in range(260))
    out += '<path d="M0,760 Q500,690 900,720 Q1300,750 1600,700 L1600,900 L0,900 Z" fill="#14122a" stroke="#000" stroke-width="3"/>'
    out += ''.join(f'<path d="M{x},{900 - rng.uniform(40, 150):.0f} l5,-16 l5,16" stroke="#2a2a4a" stroke-width="2" fill="none"/>' for x in range(0, 1600, 29))
    out += tree(260, 760, 620, rng, 'night')
    out += petal_drift(30, rng, (0, 200, 900, 800), color='#d49ac0', line='#6a3a60')
    return scene(out)


def festival_grounds(night=False):
    rng = random.Random(37)
    out = sky('#14163a', '#4a2c5a') if night else sky('#68acec', '#d8eefa')
    if night:
        out += stars(120, rng, 350)
    else:
        out += cloud(260, 90, 300, rng) + cloud(1340, 110, 340, rng)
    # the school behind
    wall = '#e8e4f0' if not night else '#3a3450'
    out += rect(260, 180, 1080, 300, wall)
    for r in range(3):
        for c in range(12):
            lit = night and (r * 12 + c) % 5 == 0
            out += rect(300 + c * 86, 210 + r * 86, 56, 50, '#ffe0a0' if lit else ('#9ac4e0' if not night else '#22223a'), LINE, 2)
    out += rect(740, 130, 120, 70, wall) + '<circle cx="800" cy="164" r="24" fill="#fffaf0" stroke="#5a3438" stroke-width="3"/>'
    palette = 'night' if night else 'day'
    out += tree(140, 520, 520, rng, palette) + tree(1470, 520, 540, rng, palette)
    ground = '#2e2438' if night else '#e4d0a8'
    out += rect(0, 480, 1600, 420, ground, None)
    out += '<path d="M0,480 L1600,480" stroke="#5a3438" stroke-width="3"/>'
    # the stalls
    for i, c in enumerate(('#e0405a', '#4a90d0', '#f2c94c', '#6ab04c', '#e0405a')):
        out += stall(130 + i * 280, 520, 230, 200, c, lit=night)
    if night:
        def lit_lantern(px, py, i):
            return f'<path d="M{px:.0f},{py:.0f} l0,14" stroke="#3a2a2a" stroke-width="2"/>' + lantern(px, py + 34, 16, ('#e0405a', '#f2c94c', '#fff4e0')[i % 3], True)
        out += string_of(-40, 820, 80, 60, 9, lit_lantern) + string_of(780, 1640, 70, 70, 9, lit_lantern)
        # people walking between the stalls, dark against the light
        for i in range(14):
            px, py, s = 60 + i * 115 + rng.uniform(-20, 20), 880 + rng.uniform(-20, 20), rng.uniform(0.6, 0.75)
            out += f'<circle cx="{px:.0f}" cy="{py - 120 * s:.0f}" r="{30 * s:.0f}" fill="#120e1e"/><path d="M{px - 40 * s:.0f},{py + 40} Q{px - 40 * s:.0f},{py - 90 * s:.0f} {px:.0f},{py - 90 * s:.0f} Q{px + 40 * s:.0f},{py - 90 * s:.0f} {px + 40 * s:.0f},{py + 40} Z" fill="#120e1e"/>'
    else:
        out += bunting(-20, 820, 60, 50, 14) + bunting(780, 1620, 50, 60, 14)
        out += rect(470, 380, 660, 90, '#fffaf4', LINE, 4) + text(800, 442, 'SAKURA FESTIVAL', 54, '#e0405a', extra='letter-spacing="4"')
        out += rect(460, 380, 16, 400, '#c84a4a') + rect(1124, 380, 16, 400, '#c84a4a')
        out += lantern(420, 430, 28, '#e0405a') + lantern(1180, 430, 28, '#e0405a')
        out += petal_drift(60, rng)
    return scene(out)


# ----------------------------------------------------------------------------------- illustrations

def blossoms_cg():
    """Looking up into the cherry trees on the way to school."""
    rng = random.Random(41)
    out = sky('#8ac4f4', '#fff4f6')
    out += glow(1100, 140, 520, '#ffffff', 0.9)
    out += '<g opacity="0.35" fill="#ffffff">' + ''.join(f'<polygon points="1100,140 {1100 + 1400 * math.cos(a):.0f},{140 + 1400 * math.sin(a):.0f} {1100 + 1400 * math.cos(a + 0.06):.0f},{140 + 1400 * math.sin(a + 0.06):.0f}"/>' for a in [0.4 + i * 0.28 for i in range(9)]) + '</g>'
    bark = 'fill="#5a3430" stroke="#2e1a1a" stroke-width="5" stroke-linejoin="round"'
    out += f'<path d="M-60,900 Q60,640 140,420 Q200,260 380,120 L410,150 Q250,300 220,470 Q180,640 140,900 Z" {bark}/>'
    out += f'<path d="M150,520 Q300,440 520,430 L520,462 Q320,470 170,560 Z" {bark}/>'
    out += f'<path d="M1700,900 Q1520,660 1460,480 Q1420,340 1260,220 L1240,250 Q1380,360 1400,500 Q1430,680 1560,900 Z" {bark}/>'
    out += f'<path d="M1440,580 Q1300,560 1120,600 L1124,630 Q1300,596 1450,620 Z" {bark}/>'
    for cx, cy, w, h in ((260, 120, 760, 340), (380, 420, 520, 220), (1360, 160, 720, 360), (1140, 560, 400, 200), (800, 0, 900, 200), (100, 700, 360, 300), (1520, 760, 300, 260)):
        out += canopy(cx, cy, w, h, rng, count=int(14 + w * h / 12000))
    out += petal_drift(90, rng, size=(6, 14))
    out += petal_drift(14, rng, size=(18, 26))
    return scene(out)


def banner_cg():
    """Mika and the hero carrying the finished banner out of the club room."""
    rng = random.Random(43)
    room = clubroom(with_banner=True)
    out = inner(room)
    out += '<rect width="1600" height="900" fill="#fff4e8" opacity="0.25"/>'
    out += place(mika('smile'), 30, 170, 760)
    # the banner, held at Mika's hands on the left and by the hero's off the right edge
    out += '<path d="M260,540 Q800,610 1640,520 L1640,700 Q800,790 260,720 Z" fill="#fffaf4" stroke="#5a3438" stroke-width="4" stroke-linejoin="round"/>'
    out += '<path d="M260,560 Q800,630 1640,540 M260,700 Q800,770 1640,680" stroke="#f4a0b4" stroke-width="6" fill="none"/>'
    out += text(940, 690, 'SAKURA FESTIVAL', 92, '#e0405a', extra='letter-spacing="6" transform="rotate(-2 940 690)"')
    out += ''.join(f'<circle cx="{x}" cy="{y}" r="9" fill="#f8bfd0" stroke="#c86a8a" stroke-width="2"/>' for x, y in ((380, 610), (520, 640), (1460, 600), (1560, 610), (700, 740)))
    out += f'<circle cx="262" cy="590" r="20" fill="{SKIN}" stroke="{LINE}" stroke-width="3"/><circle cx="262" cy="680" r="20" fill="{SKIN}" stroke="{LINE}" stroke-width="3"/>'
    out += f'<path d="M1600,520 L1530,540 Q1510,580 1540,600 L1600,590 Z" fill="#1e2440" stroke="{LINE}" stroke-width="3"/><circle cx="1530" cy="570" r="22" fill="{SKIN}" stroke="{LINE}" stroke-width="3"/>'
    out += petal_drift(20, rng, (0, 0, 1600, 500))
    return scene(out)


def crane(x, y, size, color, rng):
    """A folded paper crane, wings up, seen from the side."""
    s = size / 40
    turn = rng.uniform(-14, 14)
    shade = {'#e0405a': '#a82a40', '#f2c94c': '#c09a28', '#6ab04c': '#4a8a34', '#fffaf0': '#d8d0c0'}[color]
    return (f'<g transform="translate({x:.0f} {y:.0f}) rotate({turn:.0f}) scale({s:.2f})" stroke="{LINE}" stroke-width="1.5" stroke-linejoin="round">'
            f'<path d="M-30,4 L0,10 L30,4 L4,18 Z" fill="{shade}"/>'
            f'<path d="M-4,8 L-22,-26 L6,6 Z" fill="{color}"/><path d="M4,8 L18,-22 L-2,6 Z" fill="{shade}"/>'
            f'<path d="M-30,4 L-38,-12 L-26,6 Z M30,4 L40,-10 L44,-8 L32,6 Z" fill="{color}"/></g>')


def cranes_cg():
    """Strings of paper cranes hanging in the library window."""
    rng = random.Random(47)
    out = library(cranes=True)
    out += glow(800, 340, 520, '#fff6d0', 0.55)
    colors = ('#e0405a', '#f2c94c', '#6ab04c', '#fffaf0')
    for i, x in enumerate(range(180, 1480, 74)):
        top = 20
        length = rng.uniform(560, 820)
        out += f'<path d="M{x},{top} L{x},{top + length:.0f}" stroke="#f4ead8" stroke-width="1.5" opacity="0.9"/>'
        for k in range(int(length / 70)):
            out += crane(x, top + 50 + k * 70, rng.uniform(32, 40), colors[(i + k) % 4], rng)
    out += rect(0, 0, 1600, 22, '#5a3a28')
    return scene(out)


def lanterns_cg():
    """The festival lights up: rows of lanterns against the dusk."""
    rng = random.Random(53)
    out = sky('#1a1a46', '#c86a6a')
    out += stars(80, rng, 300)
    colors = ('#e0405a', '#f2c94c', '#fff4e0')
    for row, (y, r, sag, n) in enumerate(((110, 22, 40, 16), (230, 30, 50, 12), (380, 40, 60, 9), (560, 54, 70, 7))):
        def hang(px, py, i, r=r):
            return f'<path d="M{px:.0f},{py:.0f} l0,{r * 0.5:.0f}" stroke="#2a1a1a" stroke-width="2"/>' + lantern(px, py + r * 1.8, r, colors[(i + row) % 3], True)
        out += string_of(-60, 1660, y, sag, n, hang)
    out += canopy(250, 900, 700, 260, rng, 'night') + canopy(1350, 900, 760, 280, rng, 'night')
    out += petal_drift(30, rng, (0, 600, 1600, 900), color='#d49ac0', line='#6a3a60')
    return scene(out)


def firework(cx, cy, r, color, rng):
    out = glow(cx, cy, r * 1.3, color, 0.35)
    for i in range(28):
        a = i * 2 * math.pi / 28 + rng.uniform(-0.05, 0.05)
        x1, y1 = cx + math.cos(a) * r * 0.25, cy + math.sin(a) * r * 0.25
        x2, y2 = cx + math.cos(a) * r, cy + math.sin(a) * r + r * 0.08
        out += f'<path d="M{x1:.0f},{y1:.0f} L{x2:.0f},{y2:.0f}" stroke="{color}" stroke-width="3" stroke-linecap="round" opacity="0.85"/>'
        out += f'<circle cx="{x2:.0f}" cy="{y2:.0f}" r="5" fill="#fffaf0"/>'
    return out + f'<circle cx="{cx}" cy="{cy}" r="10" fill="#fffaf0"/>'


def fireworks_cg():
    """Fireworks over the town, seen from the hill."""
    rng = random.Random(59)
    out = sky('#0c0c2a', '#3a2450')
    out += stars(140, rng, 600)
    for cx, cy, r, c in ((360, 220, 170, '#f2c94c'), (820, 150, 210, '#ff6a8a'), (1250, 250, 180, '#6ad0a0'), (1020, 420, 110, '#8ab0ff'), (560, 430, 100, '#ffffff')):
        out += firework(cx, cy, r, c, rng)
    out += '<path d="M0,640 Q400,600 800,630 Q1200,600 1600,640 L1600,780 L0,780 Z" fill="#1e1a36"/>'
    out += ''.join(f'<circle cx="{rng.uniform(0, 1600):.0f}" cy="{rng.uniform(650, 770):.0f}" r="{rng.choice((1.5, 2, 3))}" fill="{rng.choice(("#ffd880", "#ffb060"))}"/>' for _ in range(200))
    out += '<path d="M0,800 Q600,720 1000,750 Q1300,770 1600,740 L1600,900 L0,900 Z" fill="#0e0c1c" stroke="#000" stroke-width="3"/>'
    # two friends sitting on the hill, seen from behind
    for px, hair in ((700, '#2a1a14'), (860, '#1a1420')):
        out += f'<path d="M{px - 60},800 Q{px - 66},700 {px},690 Q{px + 66},700 {px + 60},800 Z" fill="#0a0812" stroke="#000" stroke-width="3"/>'
        out += f'<circle cx="{px}" cy="640" r="62" fill="{hair}" stroke="#000" stroke-width="3"/>'
    out += '<path d="M754,604 Q770,560 790,610 Z" fill="#2a1a14"/>'
    out += '<path d="M630,640 Q636,590 680,584 M902,600 Q920,612 920,640" stroke="#ff9ab0" stroke-width="4" fill="none" opacity="0.6"/>'
    return scene(out)


def porch_cg():
    """Tea on Hayashi's porch, fireworks over the rooftops."""
    rng = random.Random(61)
    out = sky('#3a2a5a', '#f0a07a')
    out += stars(40, rng, 200)
    out += firework(1100, 180, 120, '#f2c94c', rng) + firework(500, 140, 90, '#ff8aa8', rng)
    for i in range(9):
        rx = i * 190 - 40
        rh = 380 + (i % 3) * 30
        out += f'<path d="M{rx},{rh} L{rx + 100},{rh - 60} L{rx + 200},{rh} L{rx + 200},560 L{rx},560 Z" fill="#3a2c48" stroke="#1a1424" stroke-width="3" stroke-linejoin="round"/>'
        if i % 2:
            out += rect(rx + 70, rh + 40, 40, 30, '#ffd880', None)
    out += canopy(1400, 470, 400, 200, rng, 'dusk') + canopy(150, 500, 300, 160, rng, 'dusk')
    # porch rail with its lantern, and the boards
    out += rect(0, 540, 1600, 18, '#8a5a3a') + ''.join(rect(x, 540, 16, 120, '#7a4a30', LINE, 2) for x in range(40, 1600, 160))
    out += rect(0, 640, 1600, 16, '#8a5a3a')
    out += f'<path d="M1240,540 L1240,470" stroke="#3a2a2a" stroke-width="4"/>' + lantern(1240, 500, 28, '#e0405a', True)
    out += rect(0, 656, 1600, 244, '#b07a4a', None) + ''.join(f'<path d="M0,{y} L1600,{y}" stroke="#8a5a3a" stroke-width="3"/>' for y in (700, 760, 830))
    # tray: two cups, the kettle, a plate of dango
    out += '<ellipse cx="800" cy="780" rx="420" ry="70" fill="#7a4a30" stroke="#5a3438" stroke-width="3"/>'
    for cx in (560, 1040):
        out += f'<path d="M{cx - 44},730 L{cx - 36},790 Q{cx},806 {cx + 36},790 L{cx + 44},730 Z" fill="#e8e4d8" stroke="{LINE}" stroke-width="3"/><ellipse cx="{cx}" cy="730" rx="44" ry="12" fill="#a8c070" stroke="{LINE}" stroke-width="3"/>'
        out += f'<path d="M{cx - 10},700 q-10,-20 0,-40 q10,-20 0,-40" stroke="#ffffff" stroke-width="4" fill="none" opacity="0.5"/>'
    out += '<path d="M700,770 Q700,680 790,680 Q880,680 880,770 Z" fill="#2e2a2e" stroke="#000" stroke-width="3"/><path d="M880,720 L930,690" stroke="#2e2a2e" stroke-width="10"/><path d="M730,690 Q790,620 850,690" stroke="#2e2a2e" stroke-width="6" fill="none"/>'
    out += '<ellipse cx="800" cy="850" rx="160" ry="34" fill="#fffaf0" stroke="#5a3438" stroke-width="3"/>'
    for k, dx in enumerate((-60, 40)):
        out += f'<path d="M{760 + dx},{870} L{880 + dx},{820}" stroke="#a87a4a" stroke-width="5"/>'
        for j, c in enumerate(('#f8bfd0', '#fffaf0', '#a8d890')):
            out += f'<circle cx="{775 + dx + j * 30}" cy="{858 - j * 13}" r="16" fill="{c}" stroke="{LINE}" stroke-width="2.5"/>'
    return scene(out)


def catnap_cg():
    """Mochi asleep on a cushion, petals settling on the fur."""
    rng = random.Random(67)
    out = sky('#a8d4f4', '#fbe4ea')
    out += canopy(300, 120, 800, 300, rng) + canopy(1350, 100, 700, 280, rng)
    out += rect(0, 520, 1600, 380, '#b07a4a', None) + ''.join(f'<path d="M0,{y} L1600,{y}" stroke="#8a5a3a" stroke-width="3"/>' for y in (520, 600, 700, 820))
    out += '<path d="M220,640 Q200,520 360,500 L1240,500 Q1400,520 1380,640 Q1400,800 1200,820 L400,820 Q200,800 220,640 Z" fill="#3a5a9a" stroke="#5a3438" stroke-width="4"/>'
    out += '<path d="M260,700 Q300,790 420,800 L1180,800 Q1330,790 1350,700 Q1330,770 1200,780 L400,780 Q280,770 260,700 Z" fill="#2c4680"/>'
    out += '<circle cx="800" cy="660" r="14" fill="#e0405a" stroke="#5a3438" stroke-width="2"/>'
    white, orange, black = '#fdfaf4', '#f0963a', '#2e2a30'
    # Mochi lying down, a loaf behind the sprite's own head: same patches, collar and bell
    loaf = lined(
        f'<path d="M540,744 Q520,640 640,560 Q760,476 880,470 Q1120,460 1150,620 Q1160,736 960,744 Z" fill="{white}"/>'
        f'<path d="M760,488 Q860,462 960,470 Q930,560 830,566 Q760,560 760,488 Z" fill="{black}"/>'
        f'<path d="M1040,500 Q1140,540 1150,620 Q1156,690 1090,712 Q1060,620 1040,500 Z" fill="{orange}"/>'
        # the tail, wrapped along the front, striped like the sprite's
        f'<path d="M1120,700 Q1150,770 1000,772 L700,770 Q660,766 676,748 L1000,752 Q1110,746 1100,708 Z" fill="{orange}"/>'
        '<path d="M960,752 l-6,20 M880,752 l-6,19 M800,750 l-6,20" fill="none" stroke="#c06a20" stroke-width="3"/>'
        # front paws tucked under the chin
        f'<path d="M556,712 Q544,744 572,748 L616,748 Q632,736 620,708 Z M636,708 Q626,740 646,748 L690,748 Q714,742 702,708 Z" fill="{white}"/>'
        '<path d="M580,748 l0,-9 M592,748 l0,-9 M656,748 l0,-9 M668,748 l0,-9" fill="none" stroke-width="1.8"/>')
    out += loaf + f'<g transform="translate(400 330)">{mochi_head("sleepy")}</g>'
    out += petal_drift(60, rng, size=(6, 12))
    for x, y in ((760, 520), (900, 600), (1000, 560), (640, 520)):
        out += f'<ellipse cx="{x}" cy="{y}" rx="9" ry="5" transform="rotate(30 {x} {y})" fill="#f9c6d4" stroke="#d07090" stroke-width="1.2"/>'
    return scene(out)


def cover():
    rng = random.Random(71)
    out = inner(blossoms_cg())
    out += '<rect width="1600" height="900" fill="#fff6f8" opacity="0.25"/>'
    out += place(hayashi('smile'), 70, 260, 640)
    out += place(sota('smile'), 1110, 230, 680)
    out += place(mika('smile'), 470, 250, 700)
    out += place(mochi('happy'), 800, 150, 760)
    # the title
    out += text(1010, 170, 'Sakura Week', 132, '#e0405a', extra='stroke="#ffffff" stroke-width="18" paint-order="stroke" stroke-linejoin="round" font-style="italic"')
    out += text(1030, 238, 'A wholesome visual novel', 42, '#5a3438', extra='stroke="#ffffff" stroke-width="10" paint-order="stroke"')
    out += text(1030, 288, 'five days, one festival', 32, '#a04a6a', weight='normal', extra='stroke="#ffffff" stroke-width="8" paint-order="stroke"')
    out += petal_drift(20, rng, (0, 500, 1600, 900), size=(8, 14))
    return scene(out)


SCENES = {
    'bedroom': bedroom, 'kitchen': kitchen, 'street': street, 'streetrain': lambda: street('rain'),
    'classroom': classroom, 'clubroom': clubroom, 'library': library, 'shop': shop, 'riverbank': riverbank,
    'rooftop': rooftop, 'hilltop': hilltop, 'festival': festival_grounds, 'festivalnight': lambda: festival_grounds(True),
    'Blossoms': blossoms_cg, 'Banner': banner_cg, 'Cranes': cranes_cg, 'Lanterns': lanterns_cg,
    'Fireworks': fireworks_cg, 'Porch': porch_cg, 'Catnap': catnap_cg, 'cover': cover,
}


# ------------------------------------------------------------------------------------- rendering

def write(svg_text, path):
    path.write_text(svg_text)


SPRITES = {
    'mika': (mika, ('neutral', 'smile', 'shy', 'surprised')),
    'sota': (sota, ('neutral', 'smile', 'shy', 'surprised')),
    'hayashi': (hayashi, ('neutral', 'smile')),
    'mochi': (mochi, ('neutral', 'happy', 'sleepy')),
}


def main(folder, only=None):
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    for name, (draw, expressions) in SPRITES.items():
        for expression in expressions:
            file = name if expression == 'neutral' else f'{name}-{expression}'
            if only and file not in only:
                continue
            write(draw(expression), folder / f'{file}.svg')
    for file, draw in SCENES.items():
        if only and file not in only:
            continue
        write(draw(), folder / f'{file}.svg')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:])
