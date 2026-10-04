"""
The Kurogane police helicopter, after the Japanese prefectural police's light twins: a white body
with a blue band, a glass bubble nose, skids, a slim tail boom with a fin and a stabilizer, a
four-blade main rotor and a two-blade tail rotor, a searchlight under the nose. Run after kit.py.

Three models come out of one script so the game can spin the rotors: `heli` (the body),
`heli_rotor` (built around its hub at the origin; the game puts it at MAST) and `heli_tail`
(around its hub at the origin, spinning about x; the game puts it at TAIL). The nose faces +z.
"""

clear()

WHITE = mat('body', 0xe8ecef, '', tile=4)
BLUE = mat('band', 0x1d4fa6, '', tile=4)
GLASS = mat('glass', 0x1b2b3a, '', tile=4)
DARK = mat('dark', 0x2a2d31, '', tile=4)
METAL = mat('skid', 0x9aa0a4, '', tile=4)
BLADE = mat('blade', 0x26292d, '', tile=4)
LAMP = mat('searchlight', 0xfff6e0, '', emissive=True)
RED = mat('nav-red', 0xff2a1a, '', emissive=True)
GREEN = mat('nav-green', 0x2aff6a, '', emissive=True)
BEACON = mat('beacon', 0xff3020, '', emissive=True)

MAST = (0.0, 2.95, 0.15)
TAIL = (0.3, 2.05, -6.15)

# Fuselage: (z, center height, half width, half height), nose to tail.
BODY = [
    (3.15, 1.12, 0.10, 0.14),
    (2.95, 1.12, 0.50, 0.50),
    (2.45, 1.18, 0.76, 0.74),
    (1.60, 1.25, 0.86, 0.85),
    (0.40, 1.30, 0.86, 0.86),
    (-0.60, 1.42, 0.76, 0.76),
    (-1.40, 1.62, 0.46, 0.46),
    (-2.50, 1.78, 0.28, 0.28),
    (-5.80, 1.88, 0.17, 0.19),
    (-6.45, 1.92, 0.10, 0.12),
]


def is_glass(z, a):
    if a < 0:
        return False
    up = math.sin(a)
    # The bubble: the whole nose down to the chin, the upper cabin back to the doors.
    return (z > 2.2 and up > -0.55) or (0.35 < z < 2.95 and up > 0.2)


def is_band(z, a):
    if a < 0:
        return False
    up = math.sin(a)
    return -1.6 < z < 2.2 and -0.62 < up < -0.12


loft('body-glass', GLASS, BODY, 16, is_glass)
loft('body-band', BLUE, BODY, 16, is_band)
loft('body-white', WHITE, BODY, 16, lambda z, a: not is_glass(z, a) and not is_band(z, a))

# Engine cowling and the mast fairing on the cabin roof.
box('body-cowl', WHITE, 0, 2.02, -0.55, 1.05, 0.48, 2.3)
box('body-intake', DARK, 0, 2.18, 0.62, 0.8, 0.24, 0.12)
box('body-exhaust', DARK, 0, 2.12, -1.72, 0.62, 0.3, 0.12)
cylinder('body-mast', DARK, MAST[0], 2.5, MAST[2], 0.16, 0.45, 8)

# Tail: the fin, the stabilizer with its end plates, the tail rotor's gearbox.
poly('body-fin', BLUE, [
    [(0, 1.95, -5.7), (0, 1.95, -6.55), (0, 3.05, -6.75), (0, 3.05, -6.3)],
    [(0, 1.95, -6.55), (0, 1.95, -5.7), (0, 3.05, -6.3), (0, 3.05, -6.75)],
])
poly('body-ventral', BLUE, [
    [(0, 1.8, -5.9), (0, 1.8, -6.45), (0, 1.25, -6.55), (0, 1.25, -6.3)],
    [(0, 1.8, -6.45), (0, 1.8, -5.9), (0, 1.25, -6.3), (0, 1.25, -6.55)],
])
box('body-stab', WHITE, 0, 1.86, -5.1, 2.0, 0.06, 0.55)
for sx in (-1, 1):
    box(f'body-plate{sx}', BLUE, sx * 1.0, 1.7, -5.1, 0.05, 0.38, 0.6)
cylinder('body-gearbox', DARK, 0.12, 1.95, -6.15, 0.14, 0.22, 8)

# Skids on two cross tubes.
for sx in (-1, 1):
    box(f'body-skid{sx}', METAL, sx * 1.05, 0.0, 0.45, 0.09, 0.09, 3.6)
    box(f'body-skidtip{sx}', METAL, sx * 1.05, 0.04, 2.35, 0.09, 0.09, 0.35)
for z in (1.45, -0.55):
    box(f'body-cross{z}', METAL, 0, 0.08, z, 2.2, 0.08, 0.09)
    for sx in (-1, 1):
        box(f'body-strut{sx}{z}', METAL, sx * 0.72, 0.1, z, 0.08, 0.42, 0.08)

# Searchlight pod under the nose, nav lights on the stabilizer, the beacon on the boom.
box('body-lightpod', DARK, 0, 0.36, 2.1, 0.42, 0.22, 0.42)
box('body-searchlight', LAMP, 0, 0.3, 2.1, 0.32, 0.08, 0.32)
box('body-nav-l', RED, 1.03, 1.86, -5.1, 0.08, 0.1, 0.12)
box('body-nav-r', GREEN, -1.03, 1.86, -5.1, 0.08, 0.1, 0.12)
box('body-beacon', BEACON, 0, 2.08, -2.6, 0.16, 0.12, 0.2)

# Main rotor around its hub at the origin: four blades with a little twist read as a flat chord.
cylinder('rotor-hub', DARK, 0, -0.08, 0, 0.24, 0.2, 8)
for i in range(4):
    yaw = math.pi / 2 * i
    box(f'rotor-blade{i}', BLADE, math.sin(yaw) * 2.65, 0.0, math.cos(yaw) * 2.65, 0.32, 0.05, 5.0, yaw=yaw)

# Tail rotor around its hub at the origin, in the y-z plane (it spins about x).
box('tail-hub', DARK, 0, -0.08, 0, 0.1, 0.16, 0.16)
box('tail-blade0', BLADE, 0, -0.78, 0, 0.04, 1.56, 0.16)
box('tail-blade1', BLADE, 0, -0.08, 0, 0.04, 0.16, 1.56)

import os
OUT = r'C:/GitHub/Lowbeam/assets/models'
res = [
    export('heli', os.path.join(OUT, 'heli.json'), only=lambda n: n.startswith('body-')),
    export('heli_rotor', os.path.join(OUT, 'heli_rotor.json'), only=lambda n: n.startswith('rotor-')),
    export('heli_tail', os.path.join(OUT, 'heli_tail.json'), only=lambda n: n.startswith('tail-')),
]

# For the viewport only: put the rotors where they sit on the body.
for ob in bpy.context.scene.objects:
    if ob.name.startswith('rotor-'):
        ob.location = g2b(*MAST)
    elif ob.name.startswith('tail-'):
        ob.location = g2b(*TAIL)
frame_view()
result = res
