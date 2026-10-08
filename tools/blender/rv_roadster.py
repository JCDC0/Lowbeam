"""
Hoshi Beat (rv_roadster / rv-roadster): Mid-engine kei roadster.
In the spirit of the Honda Beat, Suzuki Cappuccino, and Autozam AZ-1:
- Open top with a low windshield frame and raked glass
- Roll hoops behind two seats (driver and passenger bucket seats)
- Engine deck with dark cooling slots behind cockpit
- Side intakes ahead of rear wheels
- Small round front headlamps (lamp, z > 0)
- Slim horizontal tail lamps (tail, z < 0)
- Compact, low kei proportions: 3.40 x 1.40 x 0.86 m
- Axles at z = +1.20 and -1.08 m (wheelbase 2.28 m)
- Four viewer wheels (wheel-*, radius 0.27 m at x = +-0.61)
Run after kit.py.

Dimensions (from G5 specification table):
- Length: 3.40 m (nose z = +1.75, tail z = -1.65)
- Width: 1.40 m (half-width 0.70 m, wheels at x = +-0.61)
- Height: 0.86 m (roll hoop crown y = 0.860 m, windshield y = 0.855 m)
- Axles: front z = +1.20, rear z = -1.08 (wheelbase 2.28 m)
- Wheels: radius 0.27 m, width 0.18 m, centers at x = +-0.61, y = 0.27, z = +1.20 and -1.08
- Body budget: ideally <= 1,800, never over 2,500; full <= 2,600
"""

clear()

import bmesh
import math
from mathutils import Vector

# Fixed car dimensions
LENGTH = 3.40
WIDTH = 1.40
TOTAL_HEIGHT = 0.860
FRONT_AXLE = 1.20
REAR_AXLE = -1.08
WHEEL_RADIUS = 0.27
WHEEL_WIDTH = 0.18
WHEEL_X = 0.61

# Materials
PAINT = mat('paint', 0xf2d23a)       # Vibrant Carnival Yellow (classic kei roadster color)
ACCENT = mat('accent', 0x1a1a1c)     # Dark aerodynamic accents / side intakes
GLASS = mat('glass', 0x1a2430)       # Windshield glass
TRIM = mat('trim', 0x222224)         # Windshield frame, roll hoops, cockpit interior
UNDER = mat('under', 0x0c0c0c)       # Floor underside, engine deck slots, wheel wells
CHROME = mat('chrome', 0xd0d4dc)     # Exhaust tip, roll hoop details
LAMP = mat('lamp', 0xffffff, emissive=True)   # Small round headlamps (z > 0)
TAIL = mat('tail', 0xd01818, emissive=True)   # Slim taillights (z < 0)
PLATE = mat('plate', 0xe8e6d8)       # License plate
TIRE = mat('tire', 0x151515)         # Viewer wheel tire
RIM = mat('rim', 0xd0d2d6)           # Viewer wheel rim (clean silver sports rim)

# Z stations along the car body hull from z = -1.63 to z = +1.73
# Key transitions:
# - Nose: +1.73 (front bumper lip to +1.75)
# - Front axle: +1.20
# - Cowl / windshield base: +0.45
# - Cockpit opening: +0.45 to -0.55
# - Roll hoops / rear bulkhead: -0.50 to -0.55
# - Rear axle: -1.08
# - Engine deck: -0.55 to -1.45
# - Tail: -1.63 (bumper to -1.65)
Z_STATIONS = [
    -1.63, -1.52, -1.40, -1.25, -1.08,
    -0.92, -0.76, -0.55, -0.35, -0.10,
    0.15, 0.45, 0.70, 0.95, 1.20,
    1.40, 1.55, 1.68, 1.73
]

def get_profile(z):
    # Plan view widths (max width 1.40 m, w_body <= 0.70 m):
    # Nose (z=1.73): tapered to ~1.16m (w=0.58)
    # Front axle (z=1.20): flares over front wheels to 1.38m (w=0.69)
    # Cockpit doors (z in [-0.55, 0.45]): pulled in slightly to 1.35m (w=0.675)
    # Rear hips / axle (z=-1.08): muscular flares over rear wheels to 1.40m (w=0.70)
    # Tail (z=-1.63): tapered to ~1.22m (w=0.61)
    if z > FRONT_AXLE:
        t = (z - FRONT_AXLE) / (1.73 - FRONT_AXLE)
        w_body = 0.690 - 0.110 * (t ** 1.15)
    elif z > 0.45:
        t = (z - 0.45) / (FRONT_AXLE - 0.45)
        w_body = 0.675 + 0.015 * math.sin(t * math.pi / 2)
    elif z >= -0.55:
        # Cockpit waist
        w_body = 0.675
    elif z >= REAR_AXLE:
        t = (z - REAR_AXLE) / (-0.55 - REAR_AXLE)
        w_body = 0.700 - 0.025 * math.sin(t * math.pi / 2)
    else:
        t = (REAR_AXLE - z) / (REAR_AXLE - (-1.63))
        w_body = 0.700 - 0.090 * (t ** 1.10)

    # Rocker & wheel arch cutouts (axles at +1.20 and -1.08, wheel radius 0.27 m)
    y_rocker = 0.16
    for axle in (FRONT_AXLE, REAR_AXLE):
        off = abs(z - axle)
        R_arch = 0.32
        if off < R_arch:
            arch_lift = 0.27 + math.sqrt(max(0.0, R_arch * R_arch - off * off)) * 0.88
            y_rocker = max(y_rocker, arch_lift)

    # Beltline / Hood / Engine Deck heights:
    # Nose: y ~ 0.54
    # Hood slopes from nose to cowl (z=0.45, y=0.68)
    # Cockpit beltline (z in [-0.55, 0.45]): level at y ~ 0.685
    # Engine deck (z in [-1.45, -0.55]): level rear deck at y ~ 0.705
    # Tail: slopes gently to y ~ 0.65 at z = -1.63
    if z > 0.45:
        t = (z - 0.45) / (1.73 - 0.45)
        y_fender = 0.685 - 0.145 * (t ** 1.10)
        y_center = y_fender - 0.015 * math.sin(t * math.pi)
    elif z >= -0.55:
        # Open cockpit area
        y_fender = 0.685
        y_center = 0.260  # interior tub floor
    elif z >= -1.45:
        # Mid-engine deck
        t = (-0.55 - z) / (1.45 - 0.55)
        y_fender = 0.705 - 0.015 * t
        y_center = y_fender
    else:
        t = (-1.45 - z) / (1.63 - 1.45)
        y_fender = 0.690 - 0.040 * t
        y_center = y_fender

    is_cockpit = (-0.55 <= z <= 0.45)
    return w_body, y_rocker, y_fender, y_center, is_cockpit

def make_ring_pts(z):
    w_body, y_rocker, y_fender, y_center, is_cockpit = get_profile(z)
    y_shoulder = y_rocker + (y_fender - y_rocker) * 0.55
    w_shoulder = w_body

    if is_cockpit:
        # Open cockpit section: side sills and inner tub well
        w_sill = w_body * 0.82
        side_r = [
            (-w_body * 0.92, y_rocker),
            (-w_body * 0.96, y_rocker + (y_shoulder - y_rocker) * 0.5),
            (-w_shoulder, y_shoulder),
            (-w_body * 0.96, y_shoulder + (y_fender - y_shoulder) * 0.5),
            (-w_body * 0.92, y_fender),
            (-w_sill, y_fender),
            (-w_sill * 0.92, y_fender - 0.08),
        ]
        # Cockpit floor tub points
        top_pts = []
        for f in (-0.75, -0.38, 0.0, 0.38, 0.75):
            x = f * (w_sill * 0.85)
            y = y_center
            top_pts.append((x, y))
    else:
        # Solid hood or engine deck section
        side_r = [
            (-w_body * 0.92, y_rocker),
            (-w_body * 0.96, y_rocker + (y_shoulder - y_rocker) * 0.5),
            (-w_shoulder, y_shoulder),
            (-w_body * 0.96, y_shoulder + (y_fender - y_shoulder) * 0.5),
            (-w_body * 0.92, y_fender),
            (-w_body * 0.80, y_fender),
            (-w_body * 0.68, y_fender - 0.005),
        ]
        top_pts = []
        for f in (-0.75, -0.38, 0.0, 0.38, 0.75):
            x = f * (w_body * 0.68)
            af = abs(f) / 0.75
            y = y_center + (y_fender - y_center) * (af ** 1.3)
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
    'trim': bmesh.new(),
}

def add_quad(bm, v0, v1, v2, v3):
    vs = [bm.verts.new(g2b(*p)) for p in [v0, v1, v2, v3]]
    bm.faces.new(vs)

def add_tri(bm, v0, v1, v2):
    vs = [bm.verts.new(g2b(*p)) for p in [v0, v1, v2]]
    bm.faces.new(vs)

def get_segment_material(zm, k):
    # Cockpit tub interior
    if -0.55 <= zm <= 0.45:
        if 5 <= k <= 12:
            return 'trim'  # Interior tub floor and sills
        return 'paint'
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

    # Underside floor closing strictly at y = 0.16
    bm_u = mat_bms['under']
    pA_r = (A['pts'][0]['x'], 0.16, A['z'])
    pA_l = (A['pts'][18]['x'], 0.16, A['z'])
    pB_r = (B['pts'][0]['x'], 0.16, B['z'])
    pB_l = (B['pts'][18]['x'], 0.16, B['z'])
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

# Cap front at z = 1.73 and rear at z = -1.63
cap_ring_fan(mat_bms['paint'], rings[-1]['pts'], 1.73, is_front=True)
cap_ring_fan(mat_bms['paint'], rings[0]['pts'], -1.63, is_front=False)

# Inner wheel arch liners (axles at +1.20 and -1.08)
bm_u = mat_bms['under']
for axle in (FRONT_AXLE, REAR_AXLE):
    xs_list = (WHEEL_X, -WHEEL_X)
    for xs in xs_list:
        arch_steps = 6
        R_arch = 0.32
        for i in range(arch_steps):
            a0 = math.pi * i / arch_steps
            a1 = math.pi * (i + 1) / arch_steps
            z0 = axle - R_arch * math.cos(a0)
            z1 = axle - R_arch * math.cos(a1)
            y0 = 0.27 + R_arch * math.sin(a0) * 0.88
            y1 = 0.27 + R_arch * math.sin(a1) * 0.88
            x_out = xs * 1.12
            x_in = xs * 0.88
            add_quad(bm_u, (x_out, y0, z0), (x_in, y0, z0), (x_in, y1, z1), (x_out, y1, z1))

for key, bm in mat_bms.items():
    mat_obj = PAINT if key == 'paint' else ACCENT if key == 'accent' else GLASS if key == 'glass' else TRIM if key == 'trim' else UNDER
    _obj(f'body_{key}', bm, mat_obj)

# --- Low Windshield Frame & Glass ---
# Cowl at z = 0.45 (y = 0.685). Windshield rakes back to z = 0.20, y = 0.855 (height 0.86 m)
# Windshield frame top header bar
box('windshield_header', TRIM, 0, 0.840, 0.200, 1.04, 0.020, 0.035)
# A-pillar frame posts
for s in (1, -1):
    poly(f'windshield_post_{s}', TRIM, [
        [
            (s * 0.520, 0.855, 0.200),
            (s * 0.490, 0.855, 0.200),
            (s * 0.525, 0.685, 0.450),
            (s * 0.555, 0.685, 0.450),
        ] if s > 0 else [
            (s * 0.555, 0.685, 0.450),
            (s * 0.525, 0.685, 0.450),
            (s * 0.490, 0.855, 0.200),
            (s * 0.520, 0.855, 0.200),
        ]
    ])

# Windshield glass pane
bm_glass = bmesh.new()
p_g_tl = (-0.490, 0.845, 0.205)
p_g_tr = (0.490, 0.845, 0.205)
p_g_br = (0.525, 0.690, 0.445)
p_g_bl = (-0.525, 0.690, 0.445)
add_quad(bm_glass, p_g_bl, p_g_br, p_g_tr, p_g_tl)
add_quad(bm_glass, p_g_tl, p_g_tr, p_g_br, p_g_bl)
_obj('windshield_glass', bm_glass, GLASS)

# Dashboard top
box('dashboard_top', TRIM, 0, 0.640, 0.320, 1.00, 0.050, 0.22)

# --- Cockpit: Two Bucket Seats and Twin Roll Hoops ---
# Bulkhead behind seats at z = -0.55
box('cockpit_bulkhead', TRIM, 0, 0.260, -0.540, 1.02, 0.440, 0.030)

# Two sports bucket seats (driver at x = 0.28, passenger at x = -0.28)
for s in (1, -1):
    sx = s * 0.28
    # Seat squab (cushion)
    box(f'seat_squab_{s}', TRIM, sx, 0.280, -0.180, 0.36, 0.12, 0.40)
    # Seat backrest angled slightly back
    box(f'seat_back_{s}', TRIM, sx, 0.380, -0.400, 0.34, 0.36, 0.10)
    # Headrest up to y = 0.78
    box(f'seat_headrest_{s}', TRIM, sx, 0.720, -0.460, 0.22, 0.10, 0.08)

# Steering wheel (right-hand drive at x = 0.28)
cylinder('steering_column', TRIM, 0.28, 0.56, 0.22, 0.022, -0.10, sides=8, axis='z')
cylinder('steering_rim', TRIM, 0.28, 0.60, 0.12, 0.13, 0.018, sides=12, axis='z')

# Twin roll hoops behind the two seats arching strictly up to y = 0.860 m!
for s in (1, -1):
    hx = s * 0.28
    # Vertical hoop legs
    cylinder(f'hoop_leg_out_{s}', TRIM, hx + s * 0.14, 0.68, -0.52, 0.020, 0.16, sides=8, axis='y')
    cylinder(f'hoop_leg_in_{s}', TRIM, hx - s * 0.14, 0.68, -0.52, 0.020, 0.16, sides=8, axis='y')
    # Horizontal top hoop bar reaching crown y = 0.860 m
    cylinder(f'hoop_top_{s}', TRIM, hx - s * 0.14, 0.840, -0.52, 0.020, s * 0.28, sides=8, axis='x')

# Rearview mirror mounted on windshield header
box('rearview_mirror', TRIM, 0, 0.820, 0.210, 0.12, 0.040, 0.020)

# Exterior side mirrors
for s in (1, -1):
    box(f'mirror_stalk_{s}', TRIM, s * 0.620, 0.680, 0.380, 0.08, 0.025, 0.025)
    box(f'mirror_body_{s}', PAINT, s * 0.680, 0.670, 0.380, 0.05, 0.070, 0.12)
    box(f'mirror_glass_{s}', GLASS, s * 0.685, 0.670, 0.380, 0.005, 0.060, 0.10)

# --- Engine Deck with Dark Louver Slots ---
# Mid-engine deck runs from z = -0.55 to -1.45
# 5 dark horizontal cooling slots behind the seats in the center deck
slot_zs = [-0.68, -0.84, -1.00, -1.16, -1.32]
for idx, sz in enumerate(slot_zs):
    box(f'engine_slot_{idx}', UNDER, 0, 0.706, sz, 0.64, 0.010, 0.048)

# --- Side Intakes Ahead of Rear Wheels ---
# Rear axle is at z = -1.08. Intakes positioned between z = -0.82 and -0.58
for s in (1, -1):
    # Sculpted intake scoop panel
    box(f'side_scoop_body_{s}', ACCENT, s * 0.665, 0.380, -0.70, 0.035, 0.18, 0.26)
    # Dark intake inlet vent facing forward
    box(f'side_intake_vent_{s}', UNDER, s * 0.668, 0.390, -0.58, 0.025, 0.15, 0.015)

# --- Front Fascia: Small Round Headlamps, Chin Lip, Lower Grille, Plate ---
# Front chin spoiler reaching exactly z = +1.750
box('front_chin_lip', ACCENT, 0, 0.180, 1.720, 1.16, 0.040, 0.030)
box('front_air_dam', UNDER, 0, 0.240, 1.710, 0.72, 0.100, 0.020)

# Small round headlights per side (lamp, z in [1.730, 1.745] > 0)
headlamp_x = [0.44]
for s in (1, -1):
    cylinder(f'headlight_ring_{s}', TRIM, s * 0.44, 0.520, 1.716, 0.056, 0.022, sides=12, axis='z')
    cylinder(f'headlight_lens_{s}', LAMP, s * 0.44, 0.520, 1.734, 0.048, 0.010, sides=12, axis='z')

# Front license plate
box('plate_front', PLATE, 0, 0.280, 1.748, 0.28, 0.120, 0.004)

# --- Rear Fascia: Slim Taillights, Bumper, Plate, Exhaust ---
# Slim horizontal taillights (tail, z in [-1.645, -1.632] < 0)
for s in (1, -1):
    box(f'tail_housing_{s}', TRIM, s * 0.440, 0.540, -1.624, 0.26, 0.065, 0.012)
    box(f'tail_lens_{s}', TAIL, s * 0.440, 0.540, -1.638, 0.24, 0.045, 0.008)

# Rear license plate tub and plate
box('rear_plate_tub', TRIM, 0, 0.460, -1.626, 0.32, 0.130, 0.012)
box('plate_rear', PLATE, 0, 0.460, -1.642, 0.28, 0.120, 0.004)

# Single sports chrome exhaust tip on right side extending to z = -1.650
cylinder('exhaust_pipe', CHROME, 0.24, 0.240, -1.55, 0.032, -0.098, sides=8, axis='z')
cylinder('exhaust_bore', UNDER, 0.24, 0.240, -1.648, 0.025, -0.004, sides=8, axis='z')

# --- Four Wheels for Viewer (named wheel-*) ---
def make_wheel(name, cx, cz):
    bm_tire = bmesh.new()
    bm_rim = bmesh.new()
    cy = WHEEL_RADIUS
    rw = WHEEL_WIDTH
    R = WHEEL_RADIUS
    rim_r = R * 0.68
    shoulder = min(0.024, rw * 0.15)
    sides = 16

    sgn = 1 if cx > 0 else -1
    x_in_side = cx - sgn * (rw / 2.0)
    x_in_tread = cx - sgn * (rw / 2.0 - shoulder)
    x_out_tread = cx + sgn * (rw / 2.0 - shoulder)
    x_out_side = cx + sgn * (rw / 2.0)
    x_seat = cx + sgn * (rw / 2.0 - 0.025)
    x_hub = cx + sgn * (rw / 2.0 - 0.050)

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
result = 'rv_roadster built'
