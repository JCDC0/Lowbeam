"""
Kurogane police headquarters on Hanazaki Cape. Run in Blender:
  exec(open(r'C:/GitHub/Lowbeam/tools/blender/kit.py').read()); exec(open(r'C:/GitHub/Lowbeam/tools/blender/police_hq.py').read())

The lot is 140 m by 110 m, its front (the gate) toward +z. The main block holds the offices and
carries the helipad on its roof; the motor pool beside it has five bays for the patrol cars; the
radio tower and its mast mark it from across the bay. The positions the police logic needs later
(the helipad, the bays, the gate) are read from this script's coordinates when that logic lands.
"""

clear()

WALL = mat('wall', 0xdfe2e4, 'window', tile=24)
TRIM = mat('trim', 0x1d4fa6, '', tile=4)
CONC = mat('concrete', 0x9a9894, 'concrete', tile=4)
DARK = mat('dark', 0x3a3d42, '', tile=4)
ROOF = mat('roof', 0x55585d, 'concrete', tile=6)
PAD = mat('helipad', 0x34383e, 'concrete', tile=6)
PAINT = mat('paint', 0xf2c230, '', tile=4)
GLASS = mat('glass', 0xbfe0ff, '', emissive=True)
RED = mat('red-lamp', 0xff2418, '', emissive=True)
GREEN = mat('pad-lamp', 0x3dff7a, '', emissive=True)
WHITE = mat('white-lamp', 0xfff4dc, '', emissive=True)
SHUT = mat('shutter', 0xc9ccd0, 'shutter', tile=4)
STEEL = mat('steel', 0x8c9196, '', tile=4)
SIGN = mat('sign-police', 0xffffff, 'sign:police', emissive=True)
ASPH = mat('apron', 0x56575a, 'concrete', tile=5)

# The apron: the paved lot inside the fence.
poly('apron', ASPH, [[(-70, 0.04, 55), (70, 0.04, 55), (70, 0.04, -55), (-70, 0.04, -55)]])

# Main block: 56 by 22, four floors, blue band at every floor line and a parapet.
MX, MZ, MW, MD, MH = -14, -24, 56, 22, 12.4
box('main', WALL, MX, 0, MZ, MW, MH, MD)
for y in (3.0, 6.0, 9.0):
    box(f'band{y}', TRIM, MX, y - 0.15, MZ, MW + 0.3, 0.3, MD + 0.3, top=False)
box('parapet', TRIM, MX, MH, MZ, MW + 0.4, 1.1, MD + 0.4, top=False)
box('roofdeck', ROOF, MX, MH - 0.05, MZ, MW, 0.1, MD)

# Entrance: a portico on two columns, glass doors, the red lamp of a Japanese police station.
box('portico', CONC, MX, 3.6, MZ + MD / 2 + 3.5, 14, 0.6, 7)
for sx in (-6, 6):
    box(f'column{sx}', CONC, MX + sx, 0, MZ + MD / 2 + 6.2, 0.8, 3.6, 0.8)
poly('doors', GLASS, [[(MX - 4, 0.1, MZ + MD / 2 + 0.05), (MX + 4, 0.1, MZ + MD / 2 + 0.05), (MX + 4, 2.8, MZ + MD / 2 + 0.05), (MX - 4, 2.8, MZ + MD / 2 + 0.05)]])
box('redlamp', RED, MX, 4.2, MZ + MD / 2 + 6.6, 0.7, 0.7, 0.7)
light(MX, 4.5, MZ + MD / 2 + 7.2, (2.6, 0.25, 0.15), 14)
light(MX, 3.2, MZ + MD / 2 + 3.5, (1.6, 1.7, 1.9), 13, 1)
# Name board over the portico.
box('nameboard', DARK, MX, 4.25, MZ + MD / 2 + 7.0, 12, 1.4, 0.2)
poly('nameboard-face', SIGN, [[(MX - 5.8, 4.35, MZ + MD / 2 + 7.12), (MX + 5.8, 4.35, MZ + MD / 2 + 7.12), (MX + 5.8, 5.55, MZ + MD / 2 + 7.12), (MX - 5.8, 5.55, MZ + MD / 2 + 7.12)]])

# Helipad on the west half of the roof: a raised deck, yellow ring and H, green edge lamps.
HX, HZ, HS = MX - 12, MZ, 18
HY = MH + 0.6
box('helideck', PAD, HX, MH, HZ, HS, 0.6, HS)
ring = []
for i in range(16):
    a0 = 2 * math.pi * i / 16
    a1 = 2 * math.pi * (i + 1) / 16
    for (r0, r1) in [(6.2, 7.0)]:
        ring.append([(HX + math.cos(a0) * r1, HY + 0.02, HZ + math.sin(a0) * r1), (HX + math.cos(a1) * r1, HY + 0.02, HZ + math.sin(a1) * r1),
                     (HX + math.cos(a1) * r0, HY + 0.02, HZ + math.sin(a1) * r0), (HX + math.cos(a0) * r0, HY + 0.02, HZ + math.sin(a0) * r0)])
poly('helipad-ring', PAINT, ring)
y = HY + 0.03
poly('helipad-h', PAINT, [
    [(HX - 2.6, y, HZ + 3.2), (HX - 1.6, y, HZ + 3.2), (HX - 1.6, y, HZ - 3.2), (HX - 2.6, y, HZ - 3.2)],
    [(HX + 1.6, y, HZ + 3.2), (HX + 2.6, y, HZ + 3.2), (HX + 2.6, y, HZ - 3.2), (HX + 1.6, y, HZ - 3.2)],
    [(HX - 1.6, y, HZ + 0.5), (HX + 1.6, y, HZ + 0.5), (HX + 1.6, y, HZ - 0.5), (HX - 1.6, y, HZ - 0.5)],
])
for i in range(12):
    a = 2 * math.pi * i / 12
    box(f'padlamp{i}', GREEN, HX + math.cos(a) * 8.4, HY, HZ + math.sin(a) * 8.4, 0.3, 0.25, 0.3)
light(HX, HY + 1.5, HZ, (0.5, 1.6, 0.8), 14)
# Stair house and the roof plant on the east half.
box('stairhouse', WALL, MX + 14, MH, MZ - 4, 6, 3.4, 6)
box('plant', STEEL, MX + 22, MH, MZ + 3, 7, 1.8, 4)

# Radio tower at the east end of the block, with a mast and a red aviation lamp.
TX, TZ = MX + MW / 2 + 4, MZ - 6
box('tower', WALL, TX, 0, TZ, 8, 21, 8)
box('tower-band', TRIM, TX, 21, TZ, 8.4, 1.0, 8.4)
box('mast', STEEL, TX, 22, TZ, 0.5, 16, 0.5)
for y in (26, 30, 34):
    box(f'mast-dish{y}', STEEL, TX + 0.6, y, TZ, 0.8, 0.8, 0.3)
box('mast-lamp', RED, TX, 38, TZ, 0.6, 0.5, 0.6)

# Motor pool: five bays for the patrol cars, shutters toward the lot, a lamp over each bay.
GX, GZ, GW, GD, GH = 40, -22, 34, 16, 6.2
box('motorpool', mat('motorpool', 0xd2d5d8, 'metal', tile=6), GX, 0, GZ, GW, GH, GD)
box('motorpool-band', TRIM, GX, GH - 0.8, GZ, GW + 0.3, 0.8, GD + 0.3, top=False)
box('motorpool-roof', ROOF, GX, GH, GZ, GW + 1.2, 0.3, GD + 1.2)
for i in range(5):
    bx = GX - GW / 2 + GW / 5 * (i + 0.5)
    poly(f'bay{i}', SHUT, [[(bx - 2.6, 0.05, GZ + GD / 2 + 0.06), (bx + 2.6, 0.05, GZ + GD / 2 + 0.06), (bx + 2.6, 4.0, GZ + GD / 2 + 0.06), (bx - 2.6, 4.0, GZ + GD / 2 + 0.06)]])
    box(f'baylamp{i}', WHITE, bx, 4.4, GZ + GD / 2 + 0.25, 1.2, 0.15, 0.3)
    light(bx, 4.4, GZ + GD / 2 + 1.5, (1.4, 1.45, 1.6), 10, 1)
# Parking bays in front of the motor pool: white lines.
lines = []
for i in range(9):
    lx = GX - GW / 2 + i * (GW / 8)
    lines.append([(lx - 0.08, 0.06, GZ + GD / 2 + 4), (lx + 0.08, 0.06, GZ + GD / 2 + 4), (lx + 0.08, 0.06, GZ + GD / 2 + 9.5), (lx - 0.08, 0.06, GZ + GD / 2 + 9.5)])
poly('bay-lines', mat('lines', 0xe8e6de, ''), lines)

# Fence round the lot with a gate gap at the front, gate posts and a barrier arm.
FENCE = mat('fence', 0x6e7378, '', tile=4)
for (x0, z0, x1, z1) in [(-70, -55, 70, -55), (-70, -55, -70, 55), (70, -55, 70, 55), (-70, 55, -9, 55), (9, 55, 70, 55)]:
    w = abs(x1 - x0) or 0.25
    d = abs(z1 - z0) or 0.25
    box('fence', FENCE, (x0 + x1) / 2, 0, (z0 + z1) / 2, w, 1.8, d)
    collider((x0 + x1) / 2, (z0 + z1) / 2, w + 0.2, d + 0.2, 0, 1.8)
for sx in (-9, 9):
    box(f'gatepost{sx}', CONC, sx, 0, 55, 1.2, 2.6, 1.2)
    collider(sx, 55, 1.2, 1.2, 0, 2.6)
box('barrier', mat('barrier', 0xf2f2f2, ''), 0, 1.0, 55.6, 16, 0.18, 0.18)
box('gatehouse', WALL, 13, 0, 49, 4, 3.2, 4)
box('gatehouse-roof', TRIM, 13, 3.2, 49, 4.6, 0.3, 4.6)
collider(13, 49, 4, 4, 0, 3.5)

# The sign by the gate and three flagpoles.
box('sign-base', CONC, -18, 0, 52, 9, 0.8, 1.6)
box('sign-board', DARK, -18, 0.8, 52, 8.4, 2.2, 0.6)
poly('sign-face', SIGN, [[(-21.9, 1.0, 52.32), (-14.1, 1.0, 52.32), (-14.1, 2.8, 52.32), (-21.9, 2.8, 52.32)]])
light(-18, 2.0, 54, (1.2, 1.35, 1.8), 8)
collider(-18, 52, 9, 1.6, 0, 3)
for fx in (-34, -30, -26):
    cylinder(f'flagpole{fx}', STEEL, fx, 0, 45, 0.08, 11, 6)

# Floodlights over the lot.
for (fx, fz) in [(-55, 30), (0, 25), (55, 30), (55, -40)]:
    box(f'floodpole{fx}{fz}', STEEL, fx, 0, fz, 0.35, 12, 0.35)
    box(f'floodhead{fx}{fz}', WHITE, fx, 12, fz + 0.4, 1.6, 0.4, 0.8)
    light(fx, 12, fz + 1.5, (1.5, 1.55, 1.7), 30, 1)
    collider(fx, fz, 0.4, 0.4, 0, 12)

collider(MX, MZ, MW, MD, 0, MH + 1.2)
collider(MX, MZ + MD / 2 + 6.2, 13, 1.2, 0, 3.6)
collider(TX, TZ, 8, 8, 0, 22)
collider(GX, GZ, GW, GD, 0, GH)

frame_view()
result = 'police hq built'
