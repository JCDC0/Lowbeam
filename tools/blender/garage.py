"""
A tuning garage: the workshop where the player's cars live. Run after kit.py.

A 26 m workshop with two bays, the left one open and lit with a lift inside, an office with a
glass front, a sign board on the roof edge and a paved forecourt. The lot is 34 m by 32 m, its
front (+z) on the street. The sign texture key is sign:garage; the game paints the shop's name.
"""

clear()

WALL = mat('wall', 0xc8ccd0, 'metal', tile=6)
TRIM = mat('trim', 0xd8382e, '', tile=4)
ROOF = mat('roof', 0x4a4e54, '', tile=6)
CONC = mat('concrete', 0x8e8c88, 'concrete', tile=4)
SHUT = mat('shutter', 0xdcdee0, 'shutter', tile=4)
INSIDE = mat('inside', 0xffe7b0, '', emissive=True)
FLOOR = mat('floor', 0x5a5c60, 'concrete', tile=4)
DARK = mat('dark', 0x2c2e33, '', tile=4)
STEEL = mat('steel', 0x8c9196, '', tile=4)
GLASS = mat('glass', 0xbfe0ff, '', emissive=True)
SIGN = mat('sign-garage', 0xffffff, 'sign:garage', emissive=True)
LAMP = mat('lamp', 0xfff4dc, '', emissive=True)
APRON = mat('apron', 0x5a5b5e, 'concrete', tile=5)

W, D, H = 26, 14, 7.2
Z = -6
poly('apron', APRON, [[(-17, 0.04, 16), (17, 0.04, 16), (17, 0.04, -16), (-17, 0.04, -16)]])

# Walls, leaving the left bay open: a back wall, two sides, the front split round the bays.
FZ = Z + D / 2
box('back', WALL, 0, 0, Z - D / 2 + 0.1, W, H, 0.2)
box('left', WALL, -W / 2 + 0.1, 0, Z, 0.2, H, D)
box('right', WALL, W / 2 - 0.1, 0, Z, 0.2, H, D)
# Front pieces: pier, open bay (5 m), pier, closed bay (5 m), office (glass) to the right.
box('front-a', WALL, -12, 0, FZ, 2, H, 0.2)
box('front-head', WALL, -5.5, 4.6, FZ, 11, H - 4.6, 0.2)
box('front-b', WALL, -5.5, 0, FZ, 2, 4.6, 0.2)
poly('closed-bay', SHUT, [[(-4.5, 0.05, FZ + 0.12), (0.5, 0.05, FZ + 0.12), (0.5, 4.5, FZ + 0.12), (-4.5, 4.5, FZ + 0.12)]])
box('front-c', WALL, 0.5, 0, FZ, 0.4, H, 0.2)
box('office', WALL, 7, 0, FZ - 0.1, 12.4, H, 0.2)
poly('office-glass', GLASS, [[(1.5, 0.6, FZ + 0.02), (11.5, 0.6, FZ + 0.02), (11.5, 3.0, FZ + 0.02), (1.5, 3.0, FZ + 0.02)]])
box('roof', ROOF, 0, H, Z, W + 0.8, 0.3, D + 0.8)
box('roof-trim', TRIM, 0, H - 0.6, Z, W + 0.4, 0.6, D + 0.4, top=False)

# Inside the open bay: a lit back wall, the floor, a two-post lift and a tool wall.
poly('bay-floor', FLOOR, [[(-12, 0.05, FZ), (-6.5, 0.05, FZ), (-6.5, 0.05, Z - D / 2 + 0.2), (-12, 0.05, Z - D / 2 + 0.2)]])
poly('bay-light', INSIDE, [[(-12.6, 0.1, Z - D / 2 + 0.25), (-5.4, 0.1, Z - D / 2 + 0.25), (-5.4, 6.2, Z - D / 2 + 0.25), (-12.6, 6.2, Z - D / 2 + 0.25)]])
for px in (-11, -7.5):
    box(f'lift-post{px}', mat('lift', 0x2f6fd0, ''), px, 0, Z - 1, 0.4, 3.4, 0.4)
box('lift-arm', STEEL, -9.25, 1.2, Z - 1, 3.9, 0.15, 1.6)
box('toolwall', DARK, -12.3, 0.9, Z, 0.25, 2.2, 6)
light(-9, 5.5, Z, (2.2, 2.0, 1.6), 16)

# The sign board over the roof edge and lamps over the forecourt.
box('sign-frame', DARK, 2, H + 0.3, FZ - 0.2, 18, 2.6, 0.4)
poly('sign-face', SIGN, [[(-6.6, H + 0.45, FZ + 0.02), (10.6, H + 0.45, FZ + 0.02), (10.6, H + 2.75, FZ + 0.02), (-6.6, H + 2.75, FZ + 0.02)]])
light(2, H + 1.5, FZ + 2.5, (1.5, 1.2, 1.0), 12)
for lx in (-9, 2, 11):
    box(f'wall-lamp{lx}', LAMP, lx, 5.2, FZ + 0.3, 1.0, 0.2, 0.4)
    light(lx, 5.2, FZ + 1.2, (1.4, 1.4, 1.3), 11, 1)

# A tyre stack and a parts bin by the door.
for i, (tx, tz) in enumerate([(14.5, FZ + 2.5), (15.2, FZ + 4)]):
    cylinder(f'tyres{i}', DARK, tx, 0, tz, 0.35, 1.2, 8)

collider(0, Z - D / 2 + 0.1, W, 0.4, 0, H)
collider(-W / 2 + 0.1, Z, 0.4, D, 0, H)
collider(W / 2 - 0.1, Z, 0.4, D, 0, H)
collider(-12, FZ, 2, 0.4, 0, H)
collider(-2, FZ, 6, 0.4, 0, H)
collider(7, FZ, 12.4, 0.4, 0, H)
collider(-11, Z - 1, 0.5, 0.5, 0, 3.4)
collider(-7.5, Z - 1, 0.5, 0.5, 0, 3.4)
collider(14.8, FZ + 3.2, 1.6, 2.6, 0, 1.2)

frame_view()
result = 'garage built'
