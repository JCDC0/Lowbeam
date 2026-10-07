"""
Kagero Hot-GT (rv_hothatch / rv-hothatch): 90s Japanese three-door hot hatch with wide arches and roof spoiler.
In the spirit of the Civic Type R (EK9) / Pulsar GTi-R: 3-door hatchback, flared blister arches,
aggressive roof spoiler wing, slim headlights, block taillights, tapered nose and tail,
Coke-bottle waist, and four viewer wheels.
Run after kit.py.

Dimensions (from G5 specification table):
- Length: 4.00 m (nose z = +1.82, tail z = -2.18)
- Width: 1.70 m (x from -0.85 to +0.85, mirrors to +-0.895)
- Height: 1.37 m (roof spoiler y = 1.37, roof y = 1.340, hood ~0.83, nose ~0.60, tail ~0.52 - 0.65)
- Axles: front z = +1.00, rear z = -1.62 (wheelbase 2.62 m)
- Wheels: radius 0.30 m, width 0.20 m, centers at x = +-0.73, y = 0.30, z = +1.00 and -1.62
- Body budget: at most 1,800 triangles (everything except wheels)
"""

clear()

import bmesh
import math
from mathutils import Vector

# Fixed car dimensions
LENGTH = 4.00
WIDTH = 1.70
TOTAL_HEIGHT = 1.37
ROOF_HEIGHT = 1.340
FRONT_AXLE = 1.00
REAR_AXLE = -1.62
WHEEL_RADIUS = 0.30
WHEEL_WIDTH = 0.20
WHEEL_X = 0.73

# Materials
PAINT = mat('paint', 0xf0f0ec)       # Championship White (game repaints per car)
ACCENT = mat('accent', 0x18181c)     # Dark aerodynamic accents / spoiler wing
GLASS = mat('glass', 0x1a2430)       # Automotive glass
TRIM = mat('trim', 0x1c1c1e)         # Grille mesh, bumper trim, mirrors, splitter
UNDER = mat('under', 0x0c0c0c)       # Floor underside, wheel wells, intakes
CHROME = mat('chrome', 0x9aa0a8)     # Exhaust tip, badges, light trim
LAMP = mat('lamp', 0xffffff, emissive=True)   # Front headlights (z > 0)
TAIL = mat('tail', 0xd01818, emissive=True)   # Rear taillights (z < 0)
PLATE = mat('plate', 0xe8e6d8)       # License plate
TIRE = mat('tire', 0x151515)         # Viewer wheel tire
RIM = mat('rim', 0xd0d2d8)           # Viewer wheel rim (white/silver rally rim)

# Z stations along the car body hull from z = -2.14 to z = +1.78
# Front bumper and nose details reach exactly +1.820; rear bumper and exhaust reach -2.180.
Z_STATIONS = [
    -2.14, -2.08, -2.00, -1.90, -1.78,
    -1.68, -1.62, -1.54, -1.40, -1.20,
    -0.90, -0.60, -0.30, 0.00, 0.25,
    0.50, 0.70, 0.90, 1.00, 1.12,
    1.28, 1.48, 1.66, 1.78
]

def get_profile(z):
    # Authentic hot hatch plan view:
    # Nose bumper (z=1.82): width ~1.46m (w=0.73)
    # Front axle (z=1.00): wide blister arches to ~1.66m (w=0.83)
    # Doors / waist (z=0.00 to -0.60): pulled in to ~1.58m (w=0.79)
    # Rear hips (z=-1.62): wide muscular blister arches reaching full width 1.70m (w=0.85)
    # Tail bumper (z=-2.18): tapered to ~1.54m (w=0.77)
    if z > FRONT_AXLE:
        t = (z - FRONT_AXLE) / (1.78 - FRONT_AXLE)
        w_body = 0.830 - 0.090 * (t ** 1.15)
    elif z > 0.0:
        t = z / FRONT_AXLE
        w_body = 0.790 + 0.040 * math.sin(t * math.pi / 2)
    elif z > REAR_AXLE:
        t = (-z) / (-REAR_AXLE)
        w_body = 0.790 + 0.060 * math.sin(t * math.pi / 2)
    else:
        t = (REAR_AXLE - z) / (REAR_AXLE - (-2.14))
        w_body = 0.850 - 0.075 * (t ** 1.10)

    # Rocker & wheel arch cutout
    y_rocker = 0.20
    for axle in (FRONT_AXLE, REAR_AXLE):
        off = abs(z - axle)
        R_arch = 0.36
        if off < R_arch:
            arch_lift = 0.30 + math.sqrt(max(0.0, R_arch * R_arch - off * off)) * 0.90
            y_rocker = max(y_rocker, arch_lift)

    # Fender line & Hood / Tail heights
    if z > 0.70:
        # Sloping hood to front nose
        t = (z - 0.70) / (1.78 - 0.70)
        y_fender = 0.830 - 0.200 * (t ** 1.10)
        # Gentle center dip between front fenders
        y_center = y_fender - 0.020 * math.sin(t * math.pi)
    elif z > -0.50:
        # Front cabin beltline
        y_fender = 0.835
        y_center = 0.835
    elif z > -1.75:
        # Rear quarter beltline
        y_fender = 0.850
        y_center = 0.850
    else:
        # Rear hatch deck line
        t = (-1.75 - z) / (2.14 - 1.75)
        y_fender = 0.860 + 0.020 * t
        y_center = y_fender

    # Greenhouse (Cockpit / Hatchback cabin):
    # Raked windshield from cowl (z=0.70, y=0.83) to roof header (z=0.15, y=1.34)
    # Long flat roof to rear spoiler header (z=-1.75, y=1.34)
    # Raked hatchback rear window from z=-1.75 down to hatch waist (z=-2.04, y=0.88)
    has_cabin = (-2.04 < z < 0.70)
    if has_cabin:
        if z > 0.15:
            # Windshield
            t = (z - 0.15) / (0.70 - 0.15)
            y_roof = 1.340 - 0.510 * (t ** 1.05)
            w_roof = 0.635 - 0.030 * t
        elif z > -1.75:
            # Flat long hatchback roof
            t = (z - (-0.80)) / 0.95
            y_roof = 1.340 - 0.005 * (t ** 2)
            w_roof = 0.640
        else:
            # Sloping rear hatch window down to beltline
            t = (-1.75 - z) / (2.04 - 1.75)
            y_roof = 1.335 - 0.455 * (t ** 1.10)
            w_roof = 0.640 - 0.060 * t
    else:
        # Below hatch window / tailgate
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
        if 0.15 <= zm <= 0.70:
            return 'glass'   # Windshield
        elif -2.04 <= zm <= -1.75:
            return 'glass'   # Rear hatch window
        elif -1.75 < zm < 0.15:
            return 'paint'   # Roof panel
        else:
            return 'paint'   # Hood or lower hatch
    elif k in (4, 5, 12, 13):
        if -1.70 <= zm <= 0.20:
            return 'glass'   # 3-door side windows & rear quarter windows
        elif -1.90 <= zm <= 0.40:
            return 'paint'   # A-pillar & C-pillar
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

    # Underside floor closing strictly at y = 0.20
    bm_u = mat_bms['under']
    pA_r = (A['pts'][0]['x'], 0.20, A['z'])
    pA_l = (A['pts'][18]['x'], 0.20, A['z'])
    pB_r = (B['pts'][0]['x'], 0.20, B['z'])
    pB_l = (B['pts'][18]['x'], 0.20, B['z'])
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

# Cap front at z = 1.78 and rear at z = -2.14 cleanly
cap_ring_fan(mat_bms['paint'], rings[-1]['pts'], 1.78, is_front=True)
cap_ring_fan(mat_bms['paint'], rings[0]['pts'], -2.14, is_front=False)

# Inner wheel arch liners
bm_u = mat_bms['under']
for axle in (FRONT_AXLE, REAR_AXLE):
    xs_list = (WHEEL_X, -WHEEL_X)
    for xs in xs_list:
        arch_steps = 8
        R_arch = 0.36
        for i in range(arch_steps):
            a0 = math.pi * i / arch_steps
            a1 = math.pi * (i + 1) / arch_steps
            z0 = axle - R_arch * math.cos(a0)
            z1 = axle - R_arch * math.cos(a1)
            y0 = 0.30 + R_arch * math.sin(a0) * 0.90
            y1 = 0.30 + R_arch * math.sin(a1) * 0.90
            x_out = xs * 1.10
            x_in = xs * 0.85
            add_quad(bm_u, (x_out, y0, z0), (x_in, y0, z0), (x_in, y1, z1), (x_out, y1, z1))

for key, bm in mat_bms.items():
    mat_obj = PAINT if key == 'paint' else ACCENT if key == 'accent' else GLASS if key == 'glass' else UNDER
    _obj(f'body_{key}', bm, mat_obj)

# --- Aerodynamic Roof Spoiler Wing (Signature Hot Hatch Wing) ---
box('wing_blade', PAINT, 0, 1.340, -1.92, 1.18, 0.028, 0.30)
box('wing_gurney', ACCENT, 0, 1.362, -2.06, 1.16, 0.008, 0.02)
for s in (1, -1):
    box(f'wing_endplate_{s}', ACCENT, s * 0.59, 1.315, -1.94, 0.025, 0.055, 0.30)
    box(f'wing_mount_{s}', PAINT, s * 0.42, 1.320, -1.82, 0.040, 0.035, 0.12)

# --- Front Nose Bumper & Front Fascia Details (Layered to avoid z-fighting) ---
box('front_bumper_nose', PAINT, 0, 0.25, 1.796, 1.34, 0.32, 0.030)
box('front_bumper_center', PAINT, 0, 0.28, 1.808, 0.80, 0.26, 0.020)

# Front license plate at z = 1.818 (max z = 1.820)
box('plate_front', PLATE, 0, 0.36, 1.818, 0.30, 0.13, 0.004)

# Slim rectangular headlights (z > 0, chrome housing + emissive lamp)
for s in (1, -1):
    box(f'headlight_bezel_{s}', TRIM, s * 0.54, 0.62, 1.788, 0.32, 0.11, 0.014)
    box(f'headlight_lens_{s}', LAMP, s * 0.52, 0.625, 1.798, 0.24, 0.09, 0.012)
    box(f'turn_lens_{s}', TRIM, s * 0.66, 0.625, 1.792, 0.04, 0.09, 0.012)

# Central sports grille with Kagero mesh
box('grille_frame', TRIM, 0, 0.62, 1.788, 0.44, 0.10, 0.014)
box('grille_mesh', UNDER, 0, 0.62, 1.786, 0.40, 0.08, 0.008)

# Large lower bumper air dam intake
box('lower_intake', UNDER, 0, 0.32, 1.790, 0.65, 0.14, 0.018)
# Sports front chin spoiler splitter lip
box('front_splitter', TRIM, 0, 0.20, 1.786, 1.38, 0.035, 0.018)

# --- Side Mirrors & Skirts ---
for s in (1, -1):
    box(f'mirror_stalk_{s}', TRIM, s * 0.78, 0.85, 0.55, 0.03, 0.03, 0.03)
    box(f'mirror_body_{s}', PAINT, s * 0.855, 0.86, 0.55, 0.08, 0.06, 0.10)
    box(f'mirror_glass_{s}', GLASS, s * 0.855, 0.865, 0.50, 0.065, 0.045, 0.004)
    box(f'skirt_{s}', TRIM, s * 0.79, 0.19, -0.31, 0.03, 0.04, 1.60)

# --- Rear Fascia: Tailgate, Block Taillights, Bumper & Diffuser (Layered to avoid z-fighting) ---
box('rear_bumper', PAINT, 0, 0.25, -2.161, 1.45, 0.32, 0.038)
box('rear_bumper_center', PAINT, 0, 0.27, -2.170, 0.90, 0.26, 0.018)

# Tailgate license plate recess tub & plate at z = -2.156
box('tailgate_tub', TRIM, 0, 0.60, -2.148, 0.36, 0.16, 0.014)
box('plate_rear', PLATE, 0, 0.60, -2.156, 0.30, 0.13, 0.004)

# Block taillight clusters flanking tailgate (strictly z < 0)
for s in (1, -1):
    box(f'taillight_housing_{s}', TRIM, s * 0.58, 0.74, -2.148, 0.28, 0.14, 0.014)
    box(f'taillight_lens_{s}', TAIL, s * 0.59, 0.745, -2.157, 0.20, 0.12, 0.008)
    box(f'taillight_rev_{s}', CHROME, s * 0.47, 0.745, -2.157, 0.04, 0.12, 0.008)

# Rear diffuser below bumper
box('rear_diffuser', TRIM, 0, 0.22, -2.148, 1.10, 0.06, 0.014)

# Single large cannon sports exhaust on left side (x = -0.45) ending at strictly z = -2.180
cylinder('exhaust_tip', CHROME, -0.45, 0.26, -2.04, 0.046, -0.140, sides=12, axis='z')
cylinder('exhaust_bore', UNDER, -0.45, 0.26, -2.176, 0.038, -0.004, sides=12, axis='z')

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
result = 'rv_hothatch built'
