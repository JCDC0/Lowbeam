"""
District police station (police_station). Run in Blender:
  exec(open(r'C:/GitHub/Lowbeam/tools/blender/kit.py').read()); exec(open(r'C:/GitHub/Lowbeam/tools/blender/police_station.py').read())

A two-storey Japanese district police station (a large koban) on a 36 by 28 m lot, facing +z toward the street:
- Main two-storey block: 22 by 12 m, 7.4 m roof deck height, blue trim bands and parapet
- Entrance: lit canopy on two columns, koban red globe lamp over the entrance, station name sign (sign:police)
- Barred ground-floor security windows on both wings, office windows above
- Roof helipad: exactly centered at x = 0, y = 7.5, z = -6 as helipadOf expects, with painted yellow ring,
  H marking, perimeter green lamps, and edge lights
- Radio mast: steel tower with communications dishes and red aviation beacon up to y = 18 m
- Forecourt: paved apron with three marked police parking bays, floodlight pole, gate posts and boundary fence
- Colliders on building, canopy columns, radio mast, gate posts, bay pole, and boundary walls
- Exported as assets/models/police_station.json
"""

import math
import os

clear()

WALL = mat('wall', 0xdfe2e4, 'window', tile=24)
TRIM = mat('trim', 0x1d4fa6, '', tile=4)
CONC = mat('concrete', 0x9a9894, 'concrete', tile=4)
DARK = mat('dark', 0x3a3d42, '', tile=4)
ROOF = mat('roof', 0x55585d, 'concrete', tile=6)
PAD = mat('helipad', 0x34383e, 'concrete', tile=6)
PAINT_YEL = mat('paint-yellow', 0xf2c230, '', tile=4)
PAINT_WHT = mat('paint-white', 0xe8e6de, '', tile=4)
GLASS = mat('glass', 0xbfe0ff, '', emissive=True)
RED = mat('red-lamp', 0xff2418, '', emissive=True)
GREEN = mat('pad-lamp', 0x3dff7a, '', emissive=True)
WHITE = mat('white-lamp', 0xfff4dc, '', emissive=True)
STEEL = mat('steel', 0x8c9196, '', tile=4)
FENCE = mat('fence', 0x6e7378, '', tile=4)
SIGN = mat('sign-police', 0xffffff, 'sign:police', emissive=True)
ASPH = mat('apron', 0x56575a, 'concrete', tile=5)

# 1. Paved apron (36 m wide x 28 m deep, centered in x, z from -14 to +14)
poly('apron', ASPH, [[(-18, 0.04, 14), (18, 0.04, 14), (18, 0.04, -14), (-18, 0.04, -14)]])

# 2. Main building block (22 m wide, 12 m deep, 7.4 m tall, centered at x=0, z=-6)
BX, BZ = 0, -6
BW, BD, BH = 22.0, 12.0, 7.4
box('main-block', WALL, BX, 0, BZ, BW, BH, BD)

# Trim bands: floor line at y=3.6 and top parapet at y=BH
box('band-floor', TRIM, BX, 3.5, BZ, BW + 0.3, 0.25, BD + 0.3, top=False)
box('parapet', TRIM, BX, BH, BZ, BW + 0.3, 0.5, BD + 0.3, top=False)
box('roofdeck', ROOF, BX, BH - 0.05, BZ, BW, 0.1, BD)

# Roof stairhouse on east wing
box('stairhouse', WALL, BX + 8.5, BH, BZ, 3.6, 2.4, 4.0)
box('stairhouse-trim', TRIM, BX + 8.5, BH + 2.3, BZ, 3.8, 0.2, 4.2)

# 3. Entrance Canopy, Doors, Koban Red Globe, and Police Sign
# Canopy slab over entrance at z = 0
box('canopy-slab', CONC, 0, 3.3, 1.6, 6.0, 0.3, 3.2)
box('canopy-trim', TRIM, 0, 3.25, 1.6, 6.1, 0.35, 3.3, top=False)
box('canopy-col-l', CONC, -2.6, 0, 2.9, 0.5, 3.3, 0.5)
box('canopy-col-r', CONC, 2.6, 0, 2.9, 0.5, 3.3, 0.5)

# Entrance glass doors and frame
box('door-frame', DARK, 0, 0, 0.04, 3.8, 2.9, 0.06)
poly('door-glass', GLASS, [[(-1.8, 0.05, 0.08), (1.8, 0.05, 0.08), (1.8, 2.8, 0.08), (-1.8, 2.8, 0.08)]])

# Koban red globe lamp mounted on the canopy front
box('redglobe-bracket', DARK, 0, 3.7, 3.2, 0.15, 0.15, 0.2)
cylinder('redglobe', RED, 0, 3.85, 3.32, 0.22, 0.35, sides=12, axis='z')

# Canopy lights
light(0, 3.2, 1.6, (1.6, 1.7, 1.9), 11, 1)
light(0, 3.85, 3.8, (2.6, 0.25, 0.15), 10)

# Station name sign above the canopy on the 2nd floor facade
box('nameboard', DARK, 0, 4.35, 0.15, 7.6, 1.35, 0.2)
poly('nameboard-face', SIGN, [[(-3.6, 4.45, 0.26), (3.6, 4.45, 0.26), (3.6, 5.55, 0.26), (-3.6, 5.55, 0.26)]])
light(0, 4.95, 0.8, (1.2, 1.35, 1.8), 8)

# 4. Barred Ground-Floor Windows and 2nd Floor Office Windows
# Ground floor barred windows (left wing at x = -7.0, right wing at x = +7.0)
for wx in (-7.0, 7.0):
    box(f'win-frame-{wx}', DARK, wx, 0.95, 0.05, 3.4, 1.9, 0.08)
    poly(f'win-glass-{wx}', GLASS, [[(wx - 1.6, 1.0, 0.08), (wx + 1.6, 1.0, 0.08), (wx + 1.6, 2.8, 0.08), (wx - 1.6, 2.8, 0.08)]])
    # Vertical security bars
    for i, bx in enumerate([-1.3, -0.8, -0.3, 0.3, 0.8, 1.3]):
        box(f'win-bar-{wx}-{i}', STEEL, wx + bx, 1.0, 0.13, 0.04, 1.8, 0.04)
    # Horizontal tie rails
    box(f'win-rail1-{wx}', STEEL, wx, 1.5, 0.13, 3.2, 0.04, 0.04)
    box(f'win-rail2-{wx}', STEEL, wx, 2.3, 0.13, 3.2, 0.04, 0.04)

# 2nd floor office windows
for wx in (-7.0, 7.0):
    box(f'win2-frame-{wx}', DARK, wx, 4.35, 0.05, 4.2, 2.1, 0.08)
    poly(f'win2-glass-{wx}', GLASS, [[(wx - 2.0, 4.4, 0.08), (wx + 2.0, 4.4, 0.08), (wx + 2.0, 6.4, 0.08), (wx - 2.0, 6.4, 0.08)]])

# 5. Roof Helipad (centered at local x = 0, y = 7.5, z = -6)
# Helipad slab: 12 m x 12 m from y = 7.4 to 7.5, top surface at y = 7.50
box('helideck', PAD, 0, 7.4, -6, 12.0, 0.1, 12.0)

# Yellow painted ring on helipad
ring = []
for i in range(16):
    a0 = 2 * math.pi * i / 16
    a1 = 2 * math.pi * (i + 1) / 16
    r0, r1 = 3.8, 4.5
    ring.append([
        (math.cos(a0) * r1, 7.515, -6 + math.sin(a0) * r1),
        (math.cos(a1) * r1, 7.515, -6 + math.sin(a1) * r1),
        (math.cos(a1) * r0, 7.515, -6 + math.sin(a1) * r0),
        (math.cos(a0) * r0, 7.515, -6 + math.sin(a0) * r0),
    ])
poly('helipad-ring', PAINT_YEL, ring)

# Yellow painted H on helipad
poly('helipad-h', PAINT_YEL, [
    [(-1.8, 7.52, -8.3), (-1.1, 7.52, -8.3), (-1.1, 7.52, -3.7), (-1.8, 7.52, -3.7)],
    [(1.1, 7.52, -8.3), (1.8, 7.52, -8.3), (1.8, 7.52, -3.7), (1.1, 7.52, -3.7)],
    [(-1.1, 7.52, -6.35), (1.1, 7.52, -6.35), (1.1, 7.52, -5.65), (-1.1, 7.52, -5.65)],
])

# Helipad perimeter green lamps (emissive boxes)
for i in range(12):
    a = 2 * math.pi * i / 12
    box(f'padlamp{i}', GREEN, math.cos(a) * 5.4, 7.50, -6 + math.sin(a) * 5.4, 0.25, 0.2, 0.25)

# Helipad edge lights and landing wash light
light(0, 8.5, -6.0, (0.4, 1.5, 0.7), 13)
light(0, 7.6, -11.8, (0.35, 1.3, 0.6), 6)
light(0, 7.6, -0.2, (0.35, 1.3, 0.6), 6)
light(-5.8, 7.6, -6.0, (0.35, 1.3, 0.6), 6)
light(5.8, 7.6, -6.0, (0.35, 1.3, 0.6), 6)

# 6. Roof Radio Mast on East Wing
MX, MZ = 8.5, -9.0
box('mast-base', CONC, MX, BH, MZ, 1.2, 0.5, 1.2)
box('mast-core', STEEL, MX, BH + 0.5, MZ, 0.4, 10.1, 0.4)
for my in (BH + 3.0, BH + 5.5, BH + 8.0):
    box(f'mast-cross-{my}', STEEL, MX, my, MZ, 1.4, 0.12, 1.4)
cylinder('mast-dish1', STEEL, MX + 0.5, BH + 6.0, MZ, 0.5, 0.2, sides=8, axis='x')
cylinder('mast-dish2', STEEL, MX, BH + 8.5, MZ - 0.5, 0.4, 0.2, sides=8, axis='z')
box('mast-beacon', RED, MX, 18.0, MZ, 0.4, 0.4, 0.4)
light(MX, 18.2, MZ, (2.0, 0.2, 0.1), 8)

# 7. Forecourt Police Parking Bays and Floodlight
# Three bays on left forecourt from x = -13.0 to -4.6 (bays centered at -11.6, -8.8, -6.0)
bay_lines = []
for lx in (-13.0, -10.2, -7.4, -4.6):
    bay_lines.append([
        (lx - 0.07, 0.05, 4.0), (lx + 0.07, 0.05, 4.0),
        (lx + 0.07, 0.05, 10.0), (lx - 0.07, 0.05, 10.0)
    ])
# Back stop lines
for bx in (-11.6, -8.8, -6.0):
    bay_lines.append([
        (bx - 1.2, 0.05, 4.0), (bx + 1.2, 0.05, 4.0),
        (bx + 1.2, 0.05, 4.15), (bx - 1.2, 0.05, 4.15)
    ])
    # Concrete wheel stops
    box(f'wheelstop-{bx}', CONC, bx, 0.04, 4.4, 2.0, 0.12, 0.2)
poly('bay-markings', PAINT_WHT, bay_lines)

# Forecourt floodlight pole
box('floodpole', STEEL, -15.0, 0, 7.0, 0.25, 6.0, 0.25)
box('floodhead', WHITE, -15.0, 6.0, 7.2, 0.8, 0.25, 0.4)
light(-15.0, 6.0, 7.5, (1.4, 1.45, 1.6), 14, 1)

# 8. Boundary Walls, Gate Posts and Fence
# Gate posts at x = -4.5 and +4.5, z = 13.5
box('gatepost-l', CONC, -4.5, 0, 13.5, 0.9, 2.4, 0.9)
box('gatepost-r', CONC, 4.5, 0, 13.5, 0.9, 2.4, 0.9)
box('gate-cap-l', DARK, -4.5, 2.4, 13.5, 1.0, 0.15, 1.0)
box('gate-cap-r', DARK, 4.5, 2.4, 13.5, 1.0, 0.15, 1.0)

# Perimeter walls (low concrete base + fence, 1.8 m total height)
# Back wall at z = -13.8 (x: -17.8 to 17.8)
box('wall-back', FENCE, 0, 0, -13.8, 35.6, 1.8, 0.3)
# Left wall at x = -17.8 (z: -13.8 to 13.5)
box('wall-left', FENCE, -17.8, 0, -0.15, 0.3, 1.8, 27.3)
# Right wall at x = 17.8 (z: -13.8 to 13.5)
box('wall-right', FENCE, 17.8, 0, -0.15, 0.3, 1.8, 27.3)
# Front left wall at z = 13.5 (x: -17.8 to -4.5)
box('wall-front-l', FENCE, -11.15, 0, 13.5, 12.4, 1.8, 0.3)
# Front right wall at z = 13.5 (x: 4.5 to 17.8)
box('wall-front-r', FENCE, 11.15, 0, 13.5, 12.4, 1.8, 0.3)

# 9. Colliders
collider(BX, BZ, BW, BD, 0, BH + 0.5)
collider(-2.6, 2.9, 0.6, 0.6, 0, 3.3)
collider(2.6, 2.9, 0.6, 0.6, 0, 3.3)
collider(MX, MZ, 1.2, 1.2, BH, 18.2)
collider(-4.5, 13.5, 0.9, 0.9, 0, 2.5)
collider(4.5, 13.5, 0.9, 0.9, 0, 2.5)
collider(-15.0, 7.0, 0.35, 0.35, 0, 6.0)
collider(0, -13.8, 35.6, 0.4, 0, 1.8)
collider(-17.8, -0.15, 0.4, 27.3, 0, 1.8)
collider(17.8, -0.15, 0.4, 27.3, 0, 1.8)
collider(-11.15, 13.5, 12.4, 0.4, 0, 1.8)
collider(11.15, 13.5, 12.4, 0.4, 0, 1.8)

frame_view()

# 10. Export model
OUT_PATH = os.path.join(r'C:/GitHub/Lowbeam/assets/models/police_station.json')
export_res = export('police_station', OUT_PATH)
result = f"police_station built: {export_res['verts'] // 3} triangles, {export_res['materials']} materials, {export_res['colliders']} colliders, {export_res['lights']} lights"
print(result)
