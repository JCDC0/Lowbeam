"""
Roadblock barrier (police_barrier). Run in Blender:
  exec(open(r'C:/GitHub/Lowbeam/tools/blender/kit.py').read()); exec(open(r'C:/GitHub/Lowbeam/tools/blender/police_barrier.py').read())

A 2.4 m wide, 1.1 m tall folding sawhorse barrier for police roadblocks:
- Two A-frame folding legs (steel/composite)
- Two horizontal boards striped red and white with diagonal chevrons
- Flashing amber warning lamp on top (emissive lamp material)
- One collider box
- At most 300 triangles
Exported as assets/models/police_barrier.json.
"""

import math
import os

clear()

DARK = mat('frame-dark', 0x222428, '', tile=1)
STEEL = mat('steel', 0x5a5e64, 'metal', tile=1)
WHITE = mat('stripe-white', 0xf0f2f5, '', tile=1)
RED = mat('stripe-red', 0xd42418, '', tile=1)
AMBER = mat('lamp', 0xff9c14, '', emissive=True)

WIDTH = 2.4
HEIGHT = 1.1
LEG_X = 0.95
SPREAD_Z = 0.25

# 1. Two A-frame folding legs at x = -LEG_X and x = +LEG_X
for sgn in (-1, 1):
    lx = sgn * LEG_X
    # Front angled leg
    pts_f = [
        (lx - 0.025, 0.0, SPREAD_Z - 0.025), (lx + 0.025, 0.0, SPREAD_Z - 0.025),
        (lx + 0.025, 0.0, SPREAD_Z + 0.025), (lx - 0.025, 0.0, SPREAD_Z + 0.025),
        (lx - 0.025, 0.94, 0.0), (lx + 0.025, 0.94, 0.0),
        (lx + 0.025, 0.94, 0.05), (lx - 0.025, 0.94, 0.05)
    ]
    # Simple angled box for front and rear legs
    # We can use thin boxes slightly rotated or polygon lofts
    # Front leg:
    poly(f'leg_f_{sgn}', DARK, [
        # Outside face
        [(lx + 0.02, 0.0, SPREAD_Z), (lx + 0.02, 0.95, 0.02), (lx - 0.02, 0.95, 0.02), (lx - 0.02, 0.0, SPREAD_Z)],
        # Inside face
        [(lx - 0.02, 0.0, SPREAD_Z - 0.04), (lx - 0.02, 0.95, -0.02), (lx + 0.02, 0.95, -0.02), (lx + 0.02, 0.0, SPREAD_Z - 0.04)],
        # Left side
        [(lx - 0.02, 0.0, SPREAD_Z), (lx - 0.02, 0.95, 0.02), (lx - 0.02, 0.95, -0.02), (lx - 0.02, 0.0, SPREAD_Z - 0.04)],
        # Right side
        [(lx + 0.02, 0.0, SPREAD_Z - 0.04), (lx + 0.02, 0.95, -0.02), (lx + 0.02, 0.95, 0.02), (lx + 0.02, 0.0, SPREAD_Z)],
    ])
    # Rear leg:
    poly(f'leg_r_{sgn}', DARK, [
        # Outside face
        [(lx - 0.02, 0.0, -SPREAD_Z), (lx - 0.02, 0.95, -0.02), (lx + 0.02, 0.95, -0.02), (lx + 0.02, 0.0, -SPREAD_Z)],
        # Inside face
        [(lx + 0.02, 0.0, -SPREAD_Z + 0.04), (lx + 0.02, 0.95, 0.02), (lx - 0.02, 0.95, 0.02), (lx - 0.02, 0.0, -SPREAD_Z + 0.04)],
        # Left side
        [(lx - 0.02, 0.0, -SPREAD_Z + 0.04), (lx - 0.02, 0.95, 0.02), (lx - 0.02, 0.95, -0.02), (lx - 0.02, 0.0, -SPREAD_Z)],
        # Right side
        [(lx + 0.02, 0.0, -SPREAD_Z), (lx + 0.02, 0.95, -0.02), (lx + 0.02, 0.95, 0.02), (lx + 0.02, 0.0, -SPREAD_Z + 0.04)],
    ])
    # Horizontal cross-brace between legs at y = 0.32
    box(f'brace_{sgn}', STEEL, lx, 0.30, 0, 0.03, 0.03, SPREAD_Z * 1.3)
    # Top hinge block
    box(f'hinge_{sgn}', STEEL, lx, 0.93, 0, 0.05, 0.05, 0.08)

# 2. Two horizontal boards striped red and white
# Upper board: y = 0.68 to 0.90 (height 0.22, thickness 0.03)
# Lower board: y = 0.22 to 0.44 (height 0.22, thickness 0.03)
BOARD_THICK = 0.026
Z_F = BOARD_THICK / 2
Z_R = -BOARD_THICK / 2

for b_idx, (y0, y1) in enumerate([(0.22, 0.44), (0.68, 0.90)]):
    # Core frame / edge boxes
    ymid = (y0 + y1) / 2
    h = y1 - y0
    box(f'board_core_{b_idx}', WHITE, 0, y0, 0, WIDTH, h, BOARD_THICK, bottom=False)

    # Diagonal red and white stripes across front and rear faces
    # 8 chevron segments across 2.4 m width
    N_STRIPES = 10
    dx = WIDTH / N_STRIPES
    slant = 0.12  # horizontal displacement for 45 deg diagonal

    front_red = []
    back_red = []

    for i in range(N_STRIPES):
        if i % 2 == 1:
            continue  # White is provided by the core box; only red stripes needed
        x_left = -WIDTH / 2 + i * dx
        x_right = x_left + dx

        # Front face (+z): wound CCW viewed from +z
        # Bottom left, bottom right, top right, top left
        p0 = (max(-WIDTH / 2, x_left - slant), y0, Z_F + 0.001)
        p1 = (min(WIDTH / 2, x_right - slant), y0, Z_F + 0.001)
        p2 = (min(WIDTH / 2, x_right + slant), y1, Z_F + 0.001)
        p3 = (max(-WIDTH / 2, x_left + slant), y1, Z_F + 0.001)
        front_red.append([p0, p1, p2, p3])

        # Back face (-z): wound CCW viewed from -z
        # Bottom right, bottom left, top left, top right
        q0 = (min(WIDTH / 2, x_right + slant), y0, Z_R - 0.001)
        q1 = (max(-WIDTH / 2, x_left + slant), y0, Z_R - 0.001)
        q2 = (max(-WIDTH / 2, x_left - slant), y1, Z_R - 0.001)
        q3 = (min(WIDTH / 2, x_right - slant), y1, Z_R - 0.001)
        back_red.append([q0, q1, q2, q3])

    poly(f'stripes_front_{b_idx}', RED, front_red)
    poly(f'stripes_back_{b_idx}', RED, back_red)

# 3. Flashing warning lamp on top (centered at x = 0, y = 0.90 to 1.10)
# Mounting bracket
box('lamp_bracket', DARK, 0, 0.90, 0, 0.14, 0.05, 0.10)
# Amber circular / cylindrical flashing lens
cylinder('lamp_lens', AMBER, 0, 0.95, 0, 0.08, 0.12, sides=8, axis='y')
# Dark protective hood/cap
box('lamp_cap', DARK, 0, 1.07, 0, 0.18, 0.03, 0.12)

# Flashing lamp light point
light(0, 1.05, 0, (2.4, 1.5, 0.2), 6)

# 4. One collider box: 2.4 m wide, 0.55 m deep, 1.10 m tall
collider(0, 0, WIDTH, SPREAD_Z * 2 + 0.06, 0.0, HEIGHT)

frame_view()

OUT_PATH = os.path.join(r'C:/GitHub/Lowbeam/assets/models/police_barrier.json')
export_res = export('police_barrier', OUT_PATH)
result = f"police_barrier built: {export_res['verts'] // 3} triangles, {export_res['materials']} materials, {export_res['colliders']} colliders, {export_res['lights']} lights"
print(result)
