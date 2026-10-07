"""
Police Unmarked (police_unmarked): Unmarked fast Japanese pursuit unit (Chaser / Skyline sedan mould).
A sporty four-door sedan in dark paint (paint 0x14161c), low and aggressive roofline (1.34 m),
no bar on the roof, two emergency strobe lamps behind the front grille (lens-l red, lens-r blue).
Run after kit.py.

Dimensions:
- Length: 4.50 m (z from -2.25 to +2.25)
- Width: 1.85 m (x from -0.925 to +0.925, mirrors to +-1.00)
- Height: 1.34 m (y from 0.00 to 1.34)
- Axles: front z = +1.35, rear z = -1.35 (wheelbase 2.70 m)
- Wheel radius: 0.32 m, width 0.22 m, centers at x = +-0.785, y = 0.32
- Body budget: at most 1,800 triangles (everything except wheels)
"""

clear()

import bmesh
import math
from mathutils import Vector

# Dimensions
LENGTH = 4.50
WIDTH = 1.85
HEIGHT = 1.34
FRONT_AXLE = 1.35
REAR_AXLE = -1.35
WHEEL_RADIUS = 0.32
WHEEL_WIDTH = 0.22
WHEEL_X = 0.785

# Materials (G3 specifications)
PAINT = mat('paint', 0x14161c)       # Dark metallic paint
ACCENT = mat('accent', 0x14161c)     # Dark body trim / skirts
GLASS = mat('glass', 0x1a2430)       # Dark tinted automotive glass
TRIM = mat('trim', 0x1c1c1e)         # Window frames, B-pillar, grille mesh, chin spoiler
UNDER = mat('under', 0x0c0c0c)       # Floor underside, wheel wells, intakes
CHROME = mat('chrome', 0x9aa0a8)     # Exhaust tips, badges, headlight reflectors
LAMP = mat('lamp', 0xffffff, emissive=True)       # Headlights
TAIL = mat('tail', 0xd01818, emissive=True)       # Tail lamps
LENS_L = mat('lens-l', 0xff2a2a, emissive=True)   # Left red grille strobe (x > 0)
LENS_R = mat('lens-r', 0x2a5aff, emissive=True)   # Right blue grille strobe (x < 0)
PLATE = mat('plate', 0xe8e8e0)       # Japanese license plates
TIRE = mat('tire', 0x18181a)         # Wheels (viewer only)
RIM = mat('rim', 0x889098)           # Wheels (viewer only)

# --- Stations along the car from rear bumper (-2.25) to front bumper (+2.25) ---
Z_STATIONS = [
    -2.25, -2.22, -2.15, -2.00, -1.82,
    -1.68, -1.52, -1.35, -1.18, -1.00,
    -0.80, -0.55, -0.30, 0.00, 0.30,
    0.55, 0.80, 0.98, 1.15, 1.35,
    1.52, 1.68, 1.85, 2.05, 2.15,
    2.22, 2.25
]

def get_profile(z):
    # Plan view half-width (max 0.925 -> width 1.85 m)
    if z > 1.35:
        # Front axle to nose: taper to 0.85 m (nose width 1.70 m)
        t = (z - 1.35) / (2.25 - 1.35)
        w_body = 0.925 - 0.075 * (t ** 1.25)
    elif z > -1.35:
        # Doors / waist: full width 1.85 m (w_body = 0.925)
        w_body = 0.925
    else:
        # Rear axle to tail: taper to 0.855 m (tail width 1.71 m)
        t = (-1.35 - z) / (2.25 - 1.35)
        w_body = 0.925 - 0.070 * (t ** 1.20)

    # Rocker & wheel arch cutouts
    y_rocker = 0.20
    for axle in (FRONT_AXLE, REAR_AXLE):
        off = abs(z - axle)
        R_arch = 0.37
        if off < R_arch:
            arch_lift = 0.32 + math.sqrt(max(0.0, R_arch * R_arch - off * off)) * 0.90
            y_rocker = max(y_rocker, arch_lift)

    # Beltline height
    y_belt = 0.82

    # Fender line & Hood / Trunk Deck
    if z > 0.98:
        # Front hood and nose
        if z > 2.15:
            t = (z - 2.15) / (2.25 - 2.15)
            y_fender = 0.68 - 0.12 * t
            y_center = y_fender - 0.015
        else:
            t = (z - 0.98) / (2.15 - 0.98)
            y_fender = 0.82 - 0.14 * (t ** 1.1)
            y_center = y_fender - 0.02 * math.sin(t * math.pi)
    elif z > -1.25:
        # Cabin waist
        y_fender = 0.82
        y_center = 0.82
    else:
        # Rear trunk deck and rear bumper
        if z < -2.15:
            t = (-2.15 - z) / (2.25 - 2.15)
            y_fender = 0.86 - 0.18 * t
            y_center = y_fender
        else:
            t = (-1.25 - z) / (2.15 - 1.25)
            y_fender = 0.88 - 0.02 * t
            y_center = y_fender

    # Greenhouse (Sport Sedan Cabin) - low sleek 1.34 m roof
    has_cabin = (-1.25 < z < 0.98)
    if has_cabin:
        if z > 0.30:
            # Windshield: raked from cowl (z=0.98, y=0.82) to roof header (z=0.30, y=1.335)
            t = (z - 0.30) / (0.98 - 0.30)
            y_roof = 1.335 - 0.515 * (t ** 1.08)
            w_roof = 0.65 + 0.04 * t
        elif z > -0.60:
            # Level roof peak at exactly 1.340 m (roof width 1.30 m)
            t = abs(z - (-0.15)) / 0.45
            y_roof = 1.340 - 0.005 * (t ** 2)
            w_roof = 0.65
        else:
            # Sloping fastback rear window (z=-0.60, y=1.335 to z=-1.25, y=0.88)
            t = (-0.60 - z) / (1.25 - 0.60)
            y_roof = 1.335 - 0.455 * (t ** 1.12)
            w_roof = 0.65 + 0.04 * t
    else:
        y_roof = y_center
        w_roof = w_body * 0.74

    return w_body, y_rocker, y_belt, y_fender, y_center, has_cabin, y_roof, w_roof

def make_ring_pts(z):
    w_body, y_rocker, y_belt, y_fender, y_center, has_cabin, y_roof, w_roof = get_profile(z)

    if has_cabin:
        side_r = [
            (-w_body * 0.94, y_rocker),
            (-w_body * 0.98, y_rocker + (y_belt - y_rocker) * 0.45),
            (-w_body, y_belt),
            (-w_body * 0.98, y_belt + (y_fender - y_belt) * 0.50),
            (-w_body * 0.94, y_fender),
            (-w_roof - 0.08, y_fender + (y_roof - y_fender) * 0.55),
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
            (-w_body * 0.98, y_rocker + (y_belt - y_rocker) * 0.45),
            (-w_body, y_belt),
            (-w_body * 0.98, y_belt + (y_fender - y_belt) * 0.50),
            (-w_body * 0.94, y_fender),
            (-w_body * 0.88, y_fender - 0.005),
            (-w_roof, y_fender - 0.010),
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
    'trim': bmesh.new(),
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
        # Top surface: hood, windshield, roof, rear window, trunk
        if 0.30 <= zm <= 0.98:
            return 'glass'
        elif -1.25 <= zm <= -0.60:
            return 'glass'
        else:
            return 'paint'
    elif k in (4, 5, 12, 13):
        # Greenhouse sides / window level
        if -1.25 <= zm <= 0.98:
            if zm > 0.60:
                return 'paint'  # A-pillar
            elif zm < -0.95:
                return 'paint'  # C-pillar
            elif -0.22 <= zm <= -0.08:
                return 'trim'   # B-pillar post
            else:
                return 'glass'  # Side door windows
        else:
            return 'paint'
    elif k in (2, 3, 14, 15):
        return 'paint'
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

    # Underside floor closing strictly at y = 0.20
    bm_u = mat_bms['under']
    pA_r = (A['pts'][0]['x'], 0.20, A['z'])
    pA_l = (A['pts'][18]['x'], 0.20, A['z'])
    pB_r = (B['pts'][0]['x'], 0.20, B['z'])
    pB_l = (B['pts'][18]['x'], 0.20, B['z'])
    add_quad(bm_u, pA_l, pA_r, pB_r, pB_l)

# Front nose cap (z = 2.25)
c_front = (0.0, 0.42, 2.25)
front_pts = rings[-1]['pts']
for k in range(18):
    k1 = k + 1
    p = (front_pts[k]['x'], front_pts[k]['y'], 2.25)
    q = (front_pts[k1]['x'], front_pts[k1]['y'], 2.25)
    add_tri(mat_bms['paint'], c_front, q, p)

# Rear tail cap (z = -2.25)
c_rear = (0.0, 0.52, -2.25)
tail_pts = rings[0]['pts']
for k in range(18):
    k1 = k + 1
    p = (tail_pts[k]['x'], tail_pts[k]['y'], -2.25)
    q = (tail_pts[k1]['x'], tail_pts[k1]['y'], -2.25)
    add_tri(mat_bms['paint'], c_rear, p, q)

# --- Wheel Arch Well Liners (Dark under wells) ---
bm_u = mat_bms['under']
for axle in (FRONT_AXLE, REAR_AXLE):
    xs_list = (WHEEL_X, -WHEEL_X)
    for xs in xs_list:
        arch_steps = 8
        R_arch = 0.37
        for i in range(arch_steps):
            a0 = math.pi * i / arch_steps
            a1 = math.pi * (i + 1) / arch_steps
            z0 = axle - R_arch * math.cos(a0)
            z1 = axle - R_arch * math.cos(a1)
            y0 = 0.32 + R_arch * math.sin(a0) * 0.90
            y1 = 0.32 + R_arch * math.sin(a1) * 0.90
            x_out = xs * 1.15
            x_in = xs * 0.85
            add_quad(bm_u, (x_out, y0, z0), (x_in, y0, z0), (x_in, y1, z1), (x_out, y1, z1))

for key, bm in mat_bms.items():
    mat_obj = PAINT if key == 'paint' else ACCENT if key == 'accent' else GLASS if key == 'glass' else TRIM if key == 'trim' else UNDER
    _obj(f'body_{key}', bm, mat_obj)

# --- Sport Sedan Front Grille & Headlights ---
# Black honey-comb sports grille
box('grille_surround', TRIM, 0, 0.52, 2.215, 0.68, 0.16, 0.02)
box('grille_mesh', UNDER, 0, 0.53, 2.222, 0.64, 0.14, 0.015)

# Emergency Flasher Strobes Behind Grille (Review note: 0.12 m tall!)
# Left Red Strobe (x > 0, car's LEFT): 0xff2a2a, emissive, 0.12 m tall
box('grille_lens_l', LENS_L, 0.20, 0.53, 2.228, 0.16, 0.120, 0.012)
# Right Blue Strobe (x < 0, car's RIGHT): 0x2a5aff, emissive, 0.12 m tall
box('grille_lens_r', LENS_R, -0.20, 0.53, 2.228, 0.16, 0.120, 0.012)

# Sleek aerodynamic sports headlights
for s in (1, -1):
    box(f'headlight_bezel_{s}', TRIM, s * 0.62, 0.54, 2.195, 0.38, 0.14, 0.02)
    box(f'headlight_lens_{s}', LAMP, s * 0.58, 0.55, 2.205, 0.28, 0.12, 0.015)
    box(f'turn_lens_{s}', TAIL, s * 0.75, 0.55, 2.185, 0.06, 0.12, 0.015)

# Front sports chin splitter & plate
box('front_splitter', TRIM, 0, 0.20, 2.215, 1.68, 0.03, 0.06)
box('front_intake', UNDER, 0, 0.25, 2.215, 0.76, 0.09, 0.03)
box('plate_front', PLATE, 0, 0.36, 2.248, 0.34, 0.17, 0.004)

# Side Skirts
for s in (1, -1):
    box(f'side_skirt_{s}', TRIM, s * 0.90, 0.19, 0.00, 0.04, 0.03, 1.80)

# --- Rear Taillights, Trunk Panel, Lip Spoiler & Exhaust ---
for s in (1, -1):
    box(f'taillight_bezel_{s}', TRIM, s * 0.60, 0.68, -2.225, 0.42, 0.14, 0.02)
    box(f'taillight_red_{s}', TAIL, s * 0.60, 0.69, -2.235, 0.28, 0.12, 0.015)
    box(f'taillight_rev_{s}', LAMP, s * 0.43, 0.69, -2.235, 0.08, 0.12, 0.015)

box('trunk_spoiler', PAINT, 0, 0.87, -2.220, 1.48, 0.03, 0.05)
box('plate_rear', PLATE, 0, 0.68, -2.235, 0.34, 0.17, 0.004)
box('rear_diffuser', TRIM, 0, 0.24, -2.225, 1.30, 0.06, 0.04)

# Dual chrome sports exhaust tips
for s in (1, 2):
    x_ex = -0.58 + (s - 1) * 0.08
    cylinder(f'exhaust_tip_{s}', CHROME, x_ex, 0.24, -2.210, 0.034, -0.038, sides=12, axis='z')
    cylinder(f'exhaust_bore_{s}', UNDER, x_ex, 0.24, -2.212, 0.028, -0.005, sides=12, axis='z')

# --- Side Mirrors ---
for s in (1, -1):
    box(f'mirror_mount_{s}', TRIM, s * 0.90, 0.84, 0.84, 0.06, 0.03, 0.08)
    box(f'mirror_body_{s}', PAINT, s * 0.96, 0.84, 0.82, 0.08, 0.06, 0.11)
    box(f'mirror_glass_{s}', GLASS, s * 0.96, 0.845, 0.770, 0.065, 0.050, 0.005)

# --- Four Wheels for Viewer (named wheel-*) ---
def make_wheel(name, cx, cz):
    bm_tire = bmesh.new()
    bm_rim = bmesh.new()
    cy = WHEEL_RADIUS
    rw = WHEEL_WIDTH
    R = WHEEL_RADIUS
    rim_r = R * 0.70
    shoulder = min(0.03, rw * 0.15)
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
result = 'police_unmarked built'
