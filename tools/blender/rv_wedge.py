"""
Tsurugi Wedge (rv_wedge / rv-wedge): 80s twin-turbo wedge GT.
In the spirit of the Countach, Supra A70, and Mitsubishi Starion:
- Folded-paper body with flat panels and sharp creases (no round surfaces)
- Long, low wedge nose rising in a straight line to a steeply raked windshield
- Pop-up headlamps shown UP (raised angular pods with forward-facing emissive lamp lenses at z > 0)
- Slim dark intake slot in the nose under headlamps
- Pushed-back stance over the short rear axle (front axle z = +1.50, rear axle z = -1.05)
- Flat rear deck with integrated lip spoiler, rear window louvers
- Full-width tail lamp panel (red emissive tail lenses at z < 0) with dark band
- Twin chrome exhaust tips under rear bumper
- Sharp beltline crease and angular NACA-style side intakes ahead of rear wheels
- Four viewer wheels (wheel-*, radius 0.32 m at x = +-0.79)
Run after kit.py.

Dimensions (from G5 specification table):
- Length: 4.40 m (nose z = +2.45, tail z = -1.95)
- Width: 1.86 m (wedge flares x = +-0.93, mirrors to +-0.985)
- Height: 1.16 m (roof apex y = 1.160, nose tip ~0.48, deck ~0.88, spoiler lip ~0.92)
- Axles: front z = +1.50, rear z = -1.05 (wheelbase 2.55 m)
- Wheels: radius 0.32 m, width 0.22 m, centers at x = +-0.79, y = 0.32, z = +1.50 and -1.05
- Body budget: at most 1,800 triangles (everything except wheels)
"""

clear()

import bmesh
import math
from mathutils import Vector

# Fixed car dimensions
LENGTH = 4.40
WIDTH = 1.86
TOTAL_HEIGHT = 1.160
ROOF_HEIGHT = 1.160
FRONT_AXLE = 1.50
REAR_AXLE = -1.05
WHEEL_RADIUS = 0.32
WHEEL_WIDTH = 0.22
WHEEL_X = 0.79

# Materials
PAINT = mat('paint', 0xd02818)       # Japanese GT Red (game repaints per car)
ACCENT = mat('accent', 0x141416)     # Dark aerodynamic accents / louvers / spoiler
GLASS = mat('glass', 0x1a2430)       # Automotive glass
TRIM = mat('trim', 0x1c1c1e)         # Window trim, bumper moldings, chin spoiler
UNDER = mat('under', 0x0c0c0c)       # Floor underside, wheel wells, NACA ducts, intake slots
CHROME = mat('chrome', 0x9aa0a8)     # Twin exhaust tips, badges
LAMP = mat('lamp', 0xffffff, emissive=True)   # Pop-up headlamps (z > 0)
TAIL = mat('tail', 0xd01818, emissive=True)   # Rear full-width taillight band (z < 0)
PLATE = mat('plate', 0xe8e6d8)       # License plate
TIRE = mat('tire', 0x151515)         # Viewer wheel tire
RIM = mat('rim', 0x8a9098)           # Viewer wheel rim (80s turbine / star rim)

# Z stations along the car body hull from z = -1.91 to z = +2.41
# Front bumper and nose tip reach exactly +2.450; rear bumper and exhaust reach -1.950.
Z_STATIONS = [
    -1.91, -1.82, -1.70, -1.55, -1.35,
    -1.18, -1.05, -0.92, -0.75, -0.55,
    -0.35, -0.10, 0.15, 0.40, 0.65,
    0.90, 1.15, 1.35, 1.50, 1.65,
    1.85, 2.05, 2.22, 2.33, 2.41
]

def get_profile(z):
    # Folded-Paper 80s Wedge Plan View:
    # Nose bumper (z=2.45): tapered to ~1.52m (w=0.76)
    # Front axle (z=1.50): angular wedge flares to 1.86m (w=0.93)
    # Doors / waist (z=-0.10 to 0.65): pulled in to ~1.72m (w=0.86)
    # Rear hips (z=-1.05): muscular wide wedge hips to 1.86m (w=0.93)
    # Tail bumper (z=-1.95): tapered to ~1.62m (w=0.81)
    if z > FRONT_AXLE:
        t = (z - FRONT_AXLE) / (2.41 - FRONT_AXLE)
        # Sharp angular taper forward
        w_body = 0.930 - 0.170 * (t ** 1.10)
    elif z > 0.65:
        t = (z - 0.65) / (FRONT_AXLE - 0.65)
        w_body = 0.860 + 0.070 * t
    elif z > -0.10:
        # Waist / doors
        w_body = 0.860
    elif z > REAR_AXLE:
        t = (z - REAR_AXLE) / (-0.10 - REAR_AXLE)
        w_body = 0.930 - 0.070 * t
    else:
        t = (REAR_AXLE - z) / (REAR_AXLE - (-1.91))
        w_body = 0.930 - 0.120 * (t ** 1.10)

    # Rocker & wheel arch cutout (axles at +1.50 and -1.05)
    y_rocker = 0.16
    for axle in (FRONT_AXLE, REAR_AXLE):
        off = abs(z - axle)
        R_arch = 0.38
        if off < R_arch:
            arch_lift = 0.32 + math.sqrt(max(0.0, R_arch * R_arch - off * off)) * 0.88
            y_rocker = max(y_rocker, arch_lift)

    # Folded-paper hood & roof lines:
    # Wedge nose: rises in a straight planar incline from nose tip (z=2.41, y=0.48) to cowl (z=0.65, y=0.78)
    # Cockpit: steeply raked windshield from z=0.65 to z=0.15 (y=1.160)
    # Roof: flat roof from z=0.15 to z=-0.35 (y=1.160)
    # Fastback rear window / louvers: from z=-0.35 (y=1.160) down to deck (z=-1.18, y=0.860)
    # Flat rear deck: from z=-1.18 to z=-1.91 (y=0.860 to 0.880)
    if z > 0.65:
        # Straight wedge incline
        t = (z - 0.65) / (2.41 - 0.65)
        y_fender = 0.780 - 0.300 * t
        y_center = y_fender - 0.015
    elif z > -0.35:
        # Cockpit area beltline
        t = (z - (-0.35)) / (0.65 - (-0.35))
        y_fender = 0.800 + 0.020 * t
        y_center = y_fender
    elif z > -1.18:
        # Rear quarter transition
        t = (z - (-1.18)) / (0.83)
        y_fender = 0.850 - 0.030 * t
        y_center = y_fender
    else:
        # Flat rear deck
        t = (-1.18 - z) / (1.91 - 1.18)
        y_fender = 0.860 + 0.020 * t
        y_center = y_fender

    has_cabin = (-1.18 < z < 0.65)
    if has_cabin:
        if z > 0.15:
            # Steeply raked windshield
            t = (z - 0.15) / (0.65 - 0.15)
            y_roof = 1.160 - 0.380 * t
            w_roof = 0.580 - 0.040 * t
        elif z > -0.35:
            # Flat low roof
            y_roof = 1.160
            w_roof = 0.580
        else:
            # Fastback rear glass
            t = (-0.35 - z) / (1.18 - 0.35)
            y_roof = 1.160 - 0.300 * t
            w_roof = 0.580 - 0.050 * t
    else:
        y_roof = y_center
        w_roof = w_body * 0.72

    return w_body, y_rocker, y_fender, y_center, has_cabin, y_roof, w_roof

def make_ring_pts(z):
    w_body, y_rocker, y_fender, y_center, has_cabin, y_roof, w_roof = get_profile(z)
    # Sharp folded-paper cross section (faceted chamfers, distinct crease lines):
    y_crease = y_rocker + (y_fender - y_rocker) * 0.50
    w_crease = w_body

    if has_cabin:
        side_r = [
            (-w_body * 0.92, y_rocker),
            (-w_body * 0.96, y_rocker + (y_crease - y_rocker) * 0.45),
            (-w_crease, y_crease),                                    # Sharp beltline crease
            (-w_body * 0.95, y_crease + (y_fender - y_crease) * 0.55),
            (-w_body * 0.90, y_fender),
            (-w_roof - 0.04, y_fender + (y_roof - y_fender) * 0.55),
            (-w_roof, y_roof - 0.008),
        ]
        top_pts = []
        for f in (-0.75, -0.38, 0.0, 0.38, 0.75):
            x = f * w_roof
            y = y_roof - 0.008 * (f ** 2)
            top_pts.append((x, y))
    else:
        side_r = [
            (-w_body * 0.92, y_rocker),
            (-w_body * 0.96, y_rocker + (y_crease - y_rocker) * 0.45),
            (-w_crease, y_crease),                                    # Sharp beltline crease
            (-w_body * 0.95, y_crease + (y_fender - y_crease) * 0.55),
            (-w_body * 0.88, y_fender),
            (-w_body * 0.80, y_fender),
            (-w_roof, y_fender - 0.004),
        ]
        top_pts = []
        for f in (-0.75, -0.38, 0.0, 0.38, 0.75):
            x = f * w_roof
            af = abs(f) / 0.75
            y = y_center + (y_fender - y_center) * (af ** 1.2)
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
    # Top surfaces (k = 6..11)
    if 6 <= k <= 11:
        if 0.15 <= zm <= 0.65:
            return 'glass'   # Raked windshield
        elif -1.18 <= zm <= -0.35:
            return 'glass'   # Slatted fastback rear window
        elif -0.35 < zm < 0.15:
            return 'paint'   # Roof panel
        else:
            return 'paint'   # Long wedge hood or flat rear deck
    # Side upper surfaces (pillars and side windows)
    elif k in (4, 5, 12, 13):
        if -0.35 <= zm <= 0.15:
            return 'glass'   # Frameless sports coupe side window
        elif -0.90 <= zm < -0.35:
            return 'paint'   # Angular fastback sail panel
        elif 0.15 < zm <= 0.35:
            return 'paint'   # Raked A-pillar
        else:
            return 'paint'   # Fenders / rear quarters
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

# Cap front at z = 2.41 and rear at z = -1.91 cleanly with outward normals
cap_ring_fan(mat_bms['paint'], rings[-1]['pts'], 2.41, is_front=True)
cap_ring_fan(mat_bms['paint'], rings[0]['pts'], -1.91, is_front=False)

# Inner wheel arch liners (axles at +1.50 and -1.05)
bm_u = mat_bms['under']
for axle in (FRONT_AXLE, REAR_AXLE):
    xs_list = (WHEEL_X, -WHEEL_X)
    for xs in xs_list:
        arch_steps = 6
        R_arch = 0.38
        for i in range(arch_steps):
            a0 = math.pi * i / arch_steps
            a1 = math.pi * (i + 1) / arch_steps
            z0 = axle - R_arch * math.cos(a0)
            z1 = axle - R_arch * math.cos(a1)
            y0 = 0.32 + R_arch * math.sin(a0) * 0.88
            y1 = 0.32 + R_arch * math.sin(a1) * 0.88
            x_out = xs * 1.12
            x_in = xs * 0.88
            add_quad(bm_u, (x_out, y0, z0), (x_in, y0, z0), (x_in, y1, z1), (x_out, y1, z1))

for key, bm in mat_bms.items():
    mat_obj = PAINT if key == 'paint' else ACCENT if key == 'accent' else GLASS if key == 'glass' else TRIM if key == 'trim' else UNDER
    _obj(f'body_{key}', bm, mat_obj)

# --- Pop-Up Headlamps Shown UP (Raised Pods at z > 0) ---
# Situated on the wedge hood at z in [1.70, 1.95], x = +-0.50
for s in (1, -1):
    # Raised pop-up housing pod (angled forward, base at y = 0.61, height 0.12)
    box(f'popup_pod_{s}', PAINT, s * 0.50, 0.61, 1.82, 0.26, 0.12, 0.22)
    # Front black bezel on the raised pod
    box(f'popup_bezel_{s}', TRIM, s * 0.50, 0.62, 1.932, 0.23, 0.10, 0.012)
    # Forward-facing white emissive lamp lens strictly at z > 0
    box(f'popup_lens_{s}', LAMP, s * 0.50, 0.625, 1.940, 0.19, 0.085, 0.010)

# --- Slim Dark Intake Slot in Nose Under Headlamps & Front Lip ---
box('nose_intake_slot', UNDER, 0, 0.44, 2.422, 0.82, 0.05, 0.024)
box('front_chin_splitter', TRIM, 0, 0.18, 2.428, 1.48, 0.040, 0.038)
box('front_nose_beak', PAINT, 0, 0.28, 2.435, 1.44, 0.24, 0.024)

# Front license plate at z = 2.448 (max z = 2.450)
box('plate_front', PLATE, 0, 0.32, 2.448, 0.30, 0.13, 0.004)

# --- Side Crease & Angular NACA-Style Intake Ahead of Rear Wheels ---
for s in (1, -1):
    # Angular NACA intake recess cut into flank ahead of rear wheel (z ~ -0.72)
    box(f'naca_duct_{s}', UNDER, s * 0.865, 0.44, -0.72, 0.036, 0.14, 0.32)
    box(f'naca_trim_{s}', TRIM, s * 0.880, 0.44, -0.72, 0.012, 0.16, 0.34)

    # Sharp sports side skirts
    box(f'skirt_{s}', TRIM, s * 0.865, 0.16, 0.22, 0.035, 0.040, 1.80)

    # Side mirrors (angular 80s GT style)
    box(f'mirror_stalk_{s}', TRIM, s * 0.84, 0.80, 0.52, 0.03, 0.03, 0.03)
    box(f'mirror_body_{s}', PAINT, s * 0.925, 0.81, 0.52, 0.08, 0.055, 0.09)
    box(f'mirror_glass_{s}', GLASS, s * 0.925, 0.815, 0.47, 0.065, 0.040, 0.004)

# --- Rear Window Slatted Louvers (80s Louvers) ---
# Four horizontal dark slats stacked across fastback rear glass from z = -0.45 to z = -1.05
louvers_z_y = [
    (-0.50, 1.12),
    (-0.68, 1.05),
    (-0.86, 0.98),
    (-1.04, 0.91)
]
for i, (lz, ly) in enumerate(louvers_z_y):
    box(f'louver_{i}', ACCENT, 0, ly, lz, 0.92 - i * 0.04, 0.018, 0.08)

# --- Flat Rear Deck Lip Spoiler & Full-Width Taillight Band ---
# Integrated lip spoiler kicking up on rear deck at z ~ -1.86 to y = 0.920
box('rear_spoiler_lip', ACCENT, 0, 0.885, -1.86, 1.20, 0.035, 0.08)

# Full-width tail lamp panel with dark band (strictly z < 0)
box('taillight_housing', TRIM, 0, 0.70, -1.922, 1.44, 0.14, 0.020)
# Red emissive taillight band across the tail
box('taillight_band', TAIL, 0, 0.705, -1.934, 1.34, 0.11, 0.010)
# Reverse inserts on the tail band
for s in (1, -1):
    box(f'tail_rev_{s}', CHROME, s * 0.24, 0.705, -1.936, 0.08, 0.10, 0.008)

# Rear bumper fascia
box('rear_bumper', PAINT, 0, 0.28, -1.928, 1.50, 0.34, 0.030)
box('rear_diffuser', TRIM, 0, 0.22, -1.920, 1.10, 0.06, 0.016)

# Rear license plate at z = -1.946
box('plate_rear', PLATE, 0, 0.52, -1.946, 0.30, 0.13, 0.004)

# Twin chrome exhaust tips under rear bumper (x = +-0.22) extending to strictly z = -1.950
for s in (1, -1):
    cylinder(f'exhaust_tip_{s}', CHROME, s * 0.22, 0.26, -1.84, 0.042, -0.110, sides=8, axis='z')
    cylinder(f'exhaust_bore_{s}', UNDER, s * 0.22, 0.26, -1.946, 0.034, -0.004, sides=8, axis='z')

# --- Four Wheels for Viewer (named wheel-*) ---
def make_wheel(name, cx, cz):
    bm_tire = bmesh.new()
    bm_rim = bmesh.new()
    cy = WHEEL_RADIUS
    rw = WHEEL_WIDTH
    R = WHEEL_RADIUS
    rim_r = R * 0.68
    shoulder = min(0.028, rw * 0.15)
    sides = 16

    sgn = 1 if cx > 0 else -1
    x_in_side = cx - sgn * (rw / 2.0)
    x_in_tread = cx - sgn * (rw / 2.0 - shoulder)
    x_out_tread = cx + sgn * (rw / 2.0 - shoulder)
    x_out_side = cx + sgn * (rw / 2.0)
    x_seat = cx + sgn * (rw / 2.0 - 0.024)
    x_hub = cx + sgn * (rw / 2.0 - 0.048)

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
result = 'rv_wedge built'
