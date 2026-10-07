"""
Hoshi Kei-S (rv_kei / rv-kei): tiny front-engine kei sports car with hard top and round lamps.
In the spirit of the Suzuki Cappuccino / Beat / Copen: tiny roadster coupe, round headlights,
round tail lamps, tapered nose and tail, Coke-bottle waist, wide rear hips, and real wheel arches.
Run after kit.py.

Dimensions (from G5 specification table):
- Length: 3.30 m (nose z = +1.61, tail z = -1.69)
- Width: 1.48 m (x from -0.74 to +0.74, mirrors to +-0.795)
- Height: 1.18 m (roof y = 1.18, hood ~0.74, nose ~0.58, deck ~0.78)
- Axles: front z = +1.06, rear z = -1.18 (wheelbase 2.24 m)
- Wheels: radius 0.27 m, width 0.18 m, centers at x = +-0.65, y = 0.27, z = +1.06 and -1.18
- Body budget: at most 1,800 triangles (everything except wheels)
"""

clear()

import bmesh
import math
from mathutils import Vector

# Fixed car dimensions
LENGTH = 3.30
WIDTH = 1.48
ROOF_HEIGHT = 1.18
FRONT_AXLE = 1.06
REAR_AXLE = -1.18
WHEEL_RADIUS = 0.27
WHEEL_WIDTH = 0.18
WHEEL_X = 0.65

# Materials
PAINT = mat('paint', 0xc42028)       # Bright sports red (game repaints per car)
ACCENT = mat('accent', 0x16161a)     # Dark hardtop / aerodynamic accents
GLASS = mat('glass', 0x1a2430)       # Automotive glass
TRIM = mat('trim', 0x1c1c1e)         # Grille, seals, mirrors, diffuser
UNDER = mat('under', 0x0c0c0c)       # Floor underside, wheel wells, intakes
CHROME = mat('chrome', 0x9aa0a8)     # Exhaust tip, badges, light trim
LAMP = mat('lamp', 0xffffff, emissive=True)   # Front headlights (z > 0)
TAIL = mat('tail', 0xd01818, emissive=True)   # Rear taillights (z < 0)
PLATE = mat('plate', 0xe8e6d8)       # License plate
TIRE = mat('tire', 0x151515)         # Viewer wheel tire
RIM = mat('rim', 0xb0b4bc)           # Viewer wheel rim

# Z stations along the car body hull from z = -1.65 to z = +1.58
# Front bumper and nose details reach exactly +1.610; rear bumper and exhaust reach -1.690.
Z_STATIONS = [
    -1.65, -1.58, -1.48, -1.34, -1.22,
    -1.18, -1.10, -0.98, -0.80, -0.55,
    -0.30, -0.05, 0.20, 0.45, 0.65,
    0.85, 1.00, 1.06, 1.14, 1.26,
    1.38, 1.48, 1.54, 1.58
]

def get_profile(z):
    # Authentic plan view:
    # Nose bumper (z=1.61): width ~1.24m (w=0.62)
    # Front axle (z=1.06): width ~1.43m (w=0.715)
    # Doors waist (z=0.00): width ~1.38m (w=0.69)
    # Rear hips (z=-1.18): width 1.48m (w=0.74)
    # Tail bumper (z=-1.69): width ~1.33m (w=0.665)
    if z > FRONT_AXLE:
        t = (z - FRONT_AXLE) / (1.58 - FRONT_AXLE)
        w_body = 0.715 - 0.090 * (t ** 1.15)
    elif z > 0.0:
        t = z / FRONT_AXLE
        w_body = 0.690 + 0.025 * math.sin(t * math.pi / 2)
    elif z > REAR_AXLE:
        t = (-z) / (-REAR_AXLE)
        w_body = 0.690 + 0.050 * math.sin(t * math.pi / 2)
    else:
        t = (REAR_AXLE - z) / (REAR_AXLE - (-1.65))
        w_body = 0.740 - 0.075 * (t ** 1.10)

    # Rocker & wheel arch cutout
    y_rocker = 0.18
    for axle in (FRONT_AXLE, REAR_AXLE):
        off = abs(z - axle)
        R_arch = 0.32
        if off < R_arch:
            arch_lift = 0.27 + math.sqrt(max(0.0, R_arch * R_arch - off * off)) * 0.90
            y_rocker = max(y_rocker, arch_lift)

    # Fender line & Hood / Deck heights
    if z > 0.55:
        # Sloping hood to nose
        t = (z - 0.55) / (1.58 - 0.55)
        y_fender = 0.730 - 0.155 * (t ** 1.10)
        # Gentle center dip between front fenders
        y_center = y_fender - 0.020 * math.sin(t * math.pi)
    elif z > -0.05:
        # Waist section
        y_fender = 0.740
        y_center = 0.740
    elif z > -0.80:
        # Behind waist into rear quarter
        y_fender = 0.755
        y_center = 0.755
    else:
        # Rear deck curving gently to ducktail
        t = (-0.80 - z) / (1.65 - 0.80)
        y_fender = 0.760 + 0.025 * (t ** 1.5)
        y_center = y_fender - 0.010

    # Greenhouse (Cockpit / Hardtop): z from -0.80 to 0.55
    has_cabin = (-0.80 < z < 0.55)
    if has_cabin:
        if z > 0.15:
            # Raked windshield from cowl (z=0.55, y=0.74) to roof header (z=0.15, y=1.17)
            t = (z - 0.15) / (0.55 - 0.15)
            y_roof = 1.170 - 0.430 * (t ** 1.05)
            w_roof = 0.550 - 0.025 * t
        elif z > -0.35:
            # Hardtop crown (apex strictly 1.180 m)
            t = (z - (-0.10)) / 0.25
            y_roof = 1.180 - 0.010 * (t ** 2)
            w_roof = 0.560
        else:
            # Fastback rear coupe glass down to rear deck (z=-0.80, y=0.76)
            t = (-0.35 - z) / (0.80 - 0.35)
            y_roof = 1.170 - 0.410 * (t ** 1.15)
            w_roof = 0.560 - 0.050 * t
    else:
        y_roof = y_center
        w_roof = w_body * 0.70

    return w_body, y_rocker, y_fender, y_center, has_cabin, y_roof, w_roof

def make_ring_pts(z):
    w_body, y_rocker, y_fender, y_center, has_cabin, y_roof, w_roof = get_profile(z)
    y_shoulder = y_rocker + (y_fender - y_rocker) * 0.55
    w_shoulder = w_body

    if has_cabin:
        side_r = [
            (-w_body * 0.94, y_rocker),
            (-w_body * 0.98, y_rocker + (y_shoulder - y_rocker) * 0.5),
            (-w_shoulder, y_shoulder),
            (-w_body * 0.98, y_shoulder + (y_fender - y_shoulder) * 0.5),
            (-w_body * 0.94, y_fender),
            (-w_roof - 0.04, y_fender + (y_roof - y_fender) * 0.5),
            (-w_roof, y_roof - 0.015),
        ]
        top_pts = []
        for f in (-0.75, -0.38, 0.0, 0.38, 0.75):
            x = f * w_roof
            y = y_roof - 0.012 * (f ** 2)
            top_pts.append((x, y))
    else:
        side_r = [
            (-w_body * 0.94, y_rocker),
            (-w_body * 0.98, y_rocker + (y_shoulder - y_rocker) * 0.5),
            (-w_shoulder, y_shoulder),
            (-w_body * 0.98, y_shoulder + (y_fender - y_shoulder) * 0.5),
            (-w_body * 0.94, y_fender),
            (-w_body * 0.86, y_fender),
            (-w_roof, y_fender - 0.005),
        ]
        top_pts = []
        for f in (-0.75, -0.38, 0.0, 0.38, 0.75):
            x = f * w_roof
            af = abs(f) / 0.75
            y = y_center + (y_fender - y_center) * (af ** 1.5)
            top_pts.append((x, y))

    side_l = [(-p[0], p[1]) for p in reversed(side_r)]

    pts = []
    for i in range(7):
        pts.append({'x': side_r[i][0], 'y': side_r[i][1]})
    for i in range(5):
        pts.append({'x': top_pts[i][0], 'y': top_pts[i][1]})
    for i in range(7):
        pts.append({'x': side_l[i][0], 'y': side_l[i][1]})

    return pts

rings = []
for z in Z_STATIONS:
    rings.append({'z': z, 'pts': make_ring_pts(z)})

mat_bms = {
    'paint': bmesh.new(),
    'accent': bmesh.new(),
    'glass': bmesh.new(),
    'under': bmesh.new(),
}

def add_quad(bm, v0, v1, v2, v3):
    vs = [bm.verts.new(g2b(*p)) for p in [v0, v1, v2, v3]]
    bm.faces.new(vs)

def add_tri(bm, v0, v1, v2):
    vs = [bm.verts.new(g2b(*p)) for p in [v0, v1, v2]]
    bm.faces.new(vs)

def get_segment_material(zm, k):
    if 6 <= k <= 11:
        if 0.15 <= zm <= 0.55:
            return 'glass'   # Windshield
        elif -0.80 <= zm <= -0.35:
            return 'glass'   # Rear coupe glass
        elif -0.35 < zm < 0.15:
            return 'accent'  # Hardtop roof panel in accent
        else:
            return 'paint'   # Hood or rear deck
    elif k in (4, 5, 12, 13):
        if -0.70 <= zm <= 0.20:
            return 'glass'   # Side windows
        elif -0.80 <= zm <= 0.35:
            return 'accent'  # A-pillar & C-pillar in accent hardtop
        else:
            return 'paint'   # Fenders
    else:
        return 'paint'

# Quads between rings for all 18 segments
for i in range(len(rings) - 1):
    A = rings[i]
    B = rings[i + 1]
    zm = (A['z'] + B['z']) / 2.0
    for k in range(18):
        k1 = k + 1
        key = get_segment_material(zm, k)
        bm = mat_bms[key]
        pA0 = (A['pts'][k]['x'], A['pts'][k]['y'], A['z'])
        pA1 = (A['pts'][k1]['x'], A['pts'][k1]['y'], A['z'])
        pB0 = (B['pts'][k]['x'], B['pts'][k]['y'], B['z'])
        pB1 = (B['pts'][k1]['x'], B['pts'][k1]['y'], B['z'])
        add_quad(bm, pA0, pB0, pB1, pA1)

    # Underside floor closing strictly at y = 0.18
    bm_u = mat_bms['under']
    pA_r = (A['pts'][0]['x'], 0.18, A['z'])
    pA_l = (A['pts'][18]['x'], 0.18, A['z'])
    pB_r = (B['pts'][0]['x'], 0.18, B['z'])
    pB_l = (B['pts'][18]['x'], 0.18, B['z'])
    add_quad(bm_u, pA_l, pA_r, pB_r, pB_l)

def cap_ring_fan(bm, pts, z, is_front=True):
    cy = (pts[0]['y'] + pts[9]['y']) / 2.0
    c = (0.0, cy, z)
    n = len(pts) - 1
    for k in range(n):
        p = (pts[k]['x'], pts[k]['y'], z)
        q = (pts[k + 1]['x'], pts[k + 1]['y'], z)
        if is_front:
            add_tri(bm, c, q, p)
        else:
            add_tri(bm, c, p, q)
    p_bot = (pts[18]['x'], pts[18]['y'], z)
    q_bot = (pts[0]['x'], pts[0]['y'], z)
    if is_front:
        add_tri(bm, c, q_bot, p_bot)
    else:
        add_tri(bm, c, p_bot, q_bot)

# Cap front at z = 1.58 and rear at z = -1.65 cleanly
cap_ring_fan(mat_bms['paint'], rings[-1]['pts'], 1.58, is_front=True)
cap_ring_fan(mat_bms['paint'], rings[0]['pts'], -1.65, is_front=False)

# Inner wheel arch liners
bm_u = mat_bms['under']
for axle in (FRONT_AXLE, REAR_AXLE):
    xs_list = (WHEEL_X, -WHEEL_X)
    for xs in xs_list:
        arch_steps = 8
        R_arch = 0.32
        for i in range(arch_steps):
            a0 = math.pi * i / arch_steps
            a1 = math.pi * (i + 1) / arch_steps
            z0 = axle - R_arch * math.cos(a0)
            z1 = axle - R_arch * math.cos(a1)
            y0 = 0.27 + R_arch * math.sin(a0) * 0.90
            y1 = 0.27 + R_arch * math.sin(a1) * 0.90
            x_out = xs * 1.10
            x_in = xs * 0.85
            add_quad(bm_u, (x_out, y0, z0), (x_in, y0, z0), (x_in, y1, z1), (x_out, y1, z1))

for key, bm in mat_bms.items():
    mat_obj = PAINT if key == 'paint' else ACCENT if key == 'accent' else GLASS if key == 'glass' else UNDER
    _obj(f'body_{key}', bm, mat_obj)

# --- Front Nose Bumper & Front Details ---
box('front_bumper_nose', PAINT, 0, 0.22, 1.595, 1.16, 0.28, 0.028)
box('front_bumper_center', PAINT, 0, 0.25, 1.602, 0.65, 0.22, 0.014)

# Front license plate mounted on nose at z = 1.608 (max z = 1.610)
box('plate_front', PLATE, 0, 0.32, 1.608, 0.28, 0.12, 0.004)

# Front smile grille opening & dark intake mesh
box('front_grille_mesh', TRIM, 0, 0.27, 1.592, 0.46, 0.11, 0.020)
box('front_intake_under', UNDER, 0, 0.28, 1.590, 0.42, 0.09, 0.016)

# Front chin splitter lip
box('front_lip', TRIM, 0, 0.18, 1.588, 1.12, 0.03, 0.020)

# --- Round Headlights (Cappuccino style round lamps with chrome rings) ---
for s in (1, -1):
    cx = s * 0.44
    cy = 0.54
    cz = 1.582
    cylinder(f'headlight_ring_{s}', CHROME, cx, cy, cz, 0.080, 0.024, sides=12, axis='z')
    cylinder(f'headlight_lens_{s}', LAMP, cx, cy, cz + 0.002, 0.068, 0.023, sides=12, axis='z')

# --- Side Mirrors ---
for s in (1, -1):
    box(f'mirror_stalk_{s}', TRIM, s * 0.70, 0.75, 0.42, 0.025, 0.025, 0.025)
    box(f'mirror_body_{s}', PAINT, s * 0.755, 0.76, 0.42, 0.075, 0.055, 0.09)
    box(f'mirror_glass_{s}', GLASS, s * 0.755, 0.765, 0.375, 0.060, 0.042, 0.004)

# --- Side Skirts ---
for s in (1, -1):
    box(f'skirt_{s}', TRIM, s * 0.69, 0.175, -0.06, 0.025, 0.035, 1.35)

# --- Rear Fascia, Taillights, Bumper & Diffuser ---
box('ducktail_lip', PAINT, 0, 0.755, -1.663, 1.08, 0.035, 0.022)

# Rear bumper extending from z = -1.652 back to strictly z = -1.690
box('rear_bumper', PAINT, 0, 0.22, -1.671, 1.25, 0.30, 0.038)
box('rear_bumper_center', PAINT, 0, 0.24, -1.679, 0.75, 0.24, 0.020)

# Tail trim recess panel behind the lamps
for s in (1, -1):
    box(f'tail_recess_{s}', TRIM, s * 0.45, 0.63, -1.657, 0.34, 0.14, 0.010)

# Dual round taillights per side: cylinder facing backward (-z)
for s in (1, -1):
    cylinder(f'tail_outer_{s}', TAIL, s * 0.52, 0.63, -1.660, 0.052, -0.017, sides=12, axis='z')
    cylinder(f'tail_inner_{s}', TAIL, s * 0.38, 0.63, -1.660, 0.046, -0.017, sides=12, axis='z')

# Rear license plate mounted in bumper recess at z = -1.685
box('plate_rear', PLATE, 0, 0.38, -1.685, 0.28, 0.12, 0.004)

# Rear diffuser below bumper
box('rear_diffuser', TRIM, 0, 0.19, -1.656, 0.95, 0.05, 0.012)

# Single sports exhaust pipe on left (x = -0.30) ending at strictly z = -1.690
cylinder('exhaust_tip', CHROME, -0.30, 0.22, -1.56, 0.036, -0.130, sides=10, axis='z')
cylinder('exhaust_bore', UNDER, -0.30, 0.22, -1.686, 0.029, -0.003, sides=10, axis='z')

# --- Four Wheels for Viewer (named wheel-*) ---
def make_wheel(name, cx, cz):
    bm_tire = bmesh.new()
    bm_rim = bmesh.new()
    cy = WHEEL_RADIUS
    rw = WHEEL_WIDTH
    R = WHEEL_RADIUS
    rim_r = R * 0.68
    shoulder = min(0.025, rw * 0.15)
    sides = 16

    sgn = 1 if cx > 0 else -1
    x_in_side = cx - sgn * (rw / 2.0)
    x_in_tread = cx - sgn * (rw / 2.0 - shoulder)
    x_out_tread = cx + sgn * (rw / 2.0 - shoulder)
    x_out_side = cx + sgn * (rw / 2.0)
    x_seat = cx + sgn * (rw / 2.0 - 0.022)
    x_hub = cx + sgn * (rw / 2.0 - 0.045)

    def make_ring(bm, x, r):
        vs = []
        for i in range(sides):
            a = 2.0 * math.pi * i / sides
            vs.append(bm.verts.new(g2b(x, cy + math.sin(a) * r, cz + math.cos(a) * r)))
        return vs

    t_in_side = make_ring(bm_tire, x_in_side, R - shoulder)
    t_in_tread = make_ring(bm_tire, x_in_tread, R)
    t_out_tread = make_ring(bm_tire, x_out_tread, R)
    t_out_side = make_ring(bm_tire, x_out_side, R - shoulder)
    t_lip = make_ring(bm_tire, x_out_side, rim_r)

    r_lip = make_ring(bm_rim, x_out_side, rim_r)
    r_seat = make_ring(bm_rim, x_seat, rim_r)
    v_hub = bm_rim.verts.new(g2b(x_hub, cy, cz))

    for i in range(sides):
        j = (i + 1) % sides
        if sgn > 0:
            bm_tire.faces.new([t_in_side[i], t_in_side[j], t_in_tread[j], t_in_tread[i]])
            bm_tire.faces.new([t_in_tread[i], t_in_tread[j], t_out_tread[j], t_out_tread[i]])
            bm_tire.faces.new([t_out_tread[i], t_out_tread[j], t_out_side[j], t_out_side[i]])
            bm_tire.faces.new([t_out_side[i], t_out_side[j], t_lip[j], t_lip[i]])
            bm_rim.faces.new([r_lip[i], r_lip[j], r_seat[j], r_seat[i]])
            bm_rim.faces.new([r_seat[i], r_seat[j], v_hub])
        else:
            bm_tire.faces.new([t_in_side[j], t_in_side[i], t_in_tread[i], t_in_tread[j]])
            bm_tire.faces.new([t_in_tread[j], t_in_tread[i], t_out_tread[i], t_out_tread[j]])
            bm_tire.faces.new([t_out_tread[j], t_out_tread[i], t_out_side[i], t_out_side[j]])
            bm_tire.faces.new([t_out_side[j], t_out_side[i], t_lip[i], t_lip[j]])
            bm_rim.faces.new([r_lip[j], r_lip[i], r_seat[i], r_seat[j]])
            bm_rim.faces.new([r_seat[j], r_seat[i], v_hub])

    bmesh.ops.recalc_face_normals(bm_tire, faces=bm_tire.faces)
    bmesh.ops.recalc_face_normals(bm_rim, faces=bm_rim.faces)

    _obj(f'{name}_tire', bm_tire, TIRE)
    _obj(f'{name}_rim', bm_rim, RIM)

make_wheel('wheel-fl', WHEEL_X, FRONT_AXLE)
make_wheel('wheel-fr', -WHEEL_X, FRONT_AXLE)
make_wheel('wheel-rl', WHEEL_X, REAR_AXLE)
make_wheel('wheel-rr', -WHEEL_X, REAR_AXLE)

frame_view()
result = 'rv_kei built'
