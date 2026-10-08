"""
Kenro Sakura S (rv_sakura / rv-sakura): late-80s Japanese rear-drive coupe.
In the spirit of the Nissan Silvia S13 / 180SX / 240SX coupe:
- Crisp 3-box notchback coupe architecture: distinct hood, raked greenhouse, flat trunk deck
- Slim projector headlights (lamp, z > 0) with chrome surrounds and horizontal grille slot
- Level beltline with flush side glass and classic JDM protective side moldings
- Notchback rear deck with integrated low trunk lip spoiler wing
- Wide horizontal block taillight clusters (tail, z < 0) across the tail fascia
- Single large-bore chrome cannon sports exhaust on left side (x = -0.48)
- Dimensions: 4.45 x 1.70 x 1.32 m, axles at z = +1.17 and -1.36 m (wheelbase 2.53 m)
- Four viewer wheels (wheel-*, radius 0.31 m at x = +-0.74)
Run after kit.py.

Dimensions (from G5 specification table):
- Length: 4.45 m (nose z = +2.03, tail z = -2.42)
- Width: 1.70 m (body waist x = +-0.850, mirrors to +-0.930)
- Height: 1.32 m (roof crown y = 1.320 m)
- Axles: front z = +1.17, rear z = -1.36 (wheelbase 2.53 m)
- Wheels: radius 0.31 m, width 0.23 m, centers at x = +-0.74, y = 0.31, z = +1.17 and -1.36
- Body budget: at most 2,500 triangles; full <= 3,200
"""

clear()

import bmesh
import math
from mathutils import Vector

# Fixed car dimensions
LENGTH = 4.45
WIDTH = 1.70
TOTAL_HEIGHT = 1.320
ROOF_HEIGHT = 1.315
FRONT_AXLE = 1.17
REAR_AXLE = -1.36
WHEEL_RADIUS = 0.31
WHEEL_WIDTH = 0.23
WHEEL_X = 0.74

# Materials
PAINT = mat('paint', 0x2b4c68)       # Kenro Midnight Blue (game repaints per car)
ACCENT = mat('accent', 0x161618)     # Chin spoiler, deck spoiler, aero lip
GLASS = mat('glass', 0x1a2430)       # Automotive glass
TRIM = mat('trim', 0x1c1c1e)         # Window frames, protective rub strips, grilles
UNDER = mat('under', 0x0c0c0c)       # Floor underside, wheel wells
CHROME = mat('chrome', 0xd0d4dc)     # Exhaust tip, headlight surrounds
LAMP = mat('lamp', 0xffffff, emissive=True)   # Slim projector headlights (z > 0)
TAIL = mat('tail', 0xd01818, emissive=True)   # Block taillights (z < 0)
PLATE = mat('plate', 0xe8e6d8)       # License plate
TIRE = mat('tire', 0x151515)         # Viewer wheel tire
RIM = mat('rim', 0xb8bcc4)           # Silver 5-spoke JDM tuner rims

# Z stations along car body hull from tail (z = -2.42) to nose (z = +2.03)
Z_STATIONS = [
    -2.42, -2.25, -2.05, -1.80, -1.58,
    -1.36, -1.15, -0.90, -0.55, -0.20,
    0.10, 0.40, 0.65, 0.90, 1.17,
    1.42, 1.65, 1.85, 2.03
]

def get_profile(z):
    # Plan view widths:
    # 1.70 m over body waist (w = 0.850 m)
    # Tapered nose ~1.44 m (w = 0.720 m) at z = 2.03
    # Front arches ~1.68 m (w = 0.840 m) over front axle (+1.17)
    # Waist ~1.65 m (w = 0.825 m) along doors (z = -0.10)
    # Rear hips ~1.70 m (w = 0.850 m) over rear axle (-1.36)
    # Tapered tail ~1.54 m (w = 0.770 m) at z = -2.42
    if z > FRONT_AXLE:
        t = (z - FRONT_AXLE) / (2.03 - FRONT_AXLE)
        w_body = 0.840 - 0.120 * (t ** 1.15)
    elif z > -0.10:
        t = (z - (-0.10)) / (FRONT_AXLE - (-0.10))
        w_body = 0.825 + 0.015 * math.sin(t * math.pi / 2)
    elif z >= REAR_AXLE:
        t = (-0.10 - z) / (-0.10 - REAR_AXLE)
        w_body = 0.825 + 0.025 * math.sin(t * math.pi / 2)
    else:
        t = (REAR_AXLE - z) / (REAR_AXLE - (-2.42))
        w_body = 0.850 - 0.080 * (t ** 1.10)

    # Rocker & wheel arch cutouts (axles at +1.17 and -1.36, wheel radius 0.31 m)
    y_rocker = 0.16
    for axle in (FRONT_AXLE, REAR_AXLE):
        off = abs(z - axle)
        R_arch = 0.36
        if off < R_arch:
            arch_lift = 0.31 + math.sqrt(max(0.0, R_arch * R_arch - off * off)) * 0.88
            y_rocker = max(y_rocker, arch_lift)

    # Beltline / Hood / Trunk heights:
    # Hood: slopes from cowl (z = 0.90, y = 0.86) to nose (z = 2.03, y = 0.62)
    # Beltline: along cabin z in [-0.90, 0.90], level at y ~ 0.88
    # Rear trunk deck: flat deck z in [-2.42, -0.90], gently sloping from y = 0.92 to y = 0.90 at tail
    if z > 0.90:
        t = (z - 0.90) / (2.03 - 0.90)
        y_fender = 0.86 - 0.24 * (t ** 1.10)
        y_center = y_fender - 0.025 * math.sin(t * math.pi)
    elif z >= -0.90:
        # Cabin waist
        t = (z - (-0.90)) / 1.80
        y_fender = 0.88 + 0.015 * math.sin(t * math.pi)
        y_center = y_fender
    else:
        # Rear trunk deck lid
        t = (-0.90 - z) / (-0.90 - (-2.42))
        y_fender = 0.92 - 0.02 * t
        y_center = 0.915 - 0.02 * t

    # Greenhouse (3-box notchback coupe cabin):
    # Cabin extends from z = -0.90 to z = 0.90
    has_cabin = -0.90 <= z <= 0.90
    if has_cabin:
        if z > 0.25:
            # Raked windshield from cowl (z=0.90, y=0.86) to roof front (z=0.25, y=1.31)
            t = (z - 0.25) / (0.90 - 0.25)
            y_roof = 1.310 - 0.450 * (t ** 1.12)
            w_roof = 0.600 + 0.040 * t
        elif z >= -0.20:
            # Roof panel: crown at y = 1.320 m around z = 0.05
            t = (z - 0.05) / 0.25
            y_roof = 1.320 - 0.010 * (t ** 2)
            w_roof = 0.600
        else:
            # Notchback rear window: slopes from roof rear (z=-0.20, y=1.31) to deck lid (z=-0.90, y=0.92)
            t = (-0.20 - z) / (0.90 - 0.20)
            y_roof = 1.310 - 0.390 * (t ** 1.10)
            w_roof = 0.600 + 0.020 * t
    else:
        y_roof = y_center
        w_roof = w_body * 0.72

    return w_body, y_rocker, y_fender, y_center, has_cabin, y_roof, w_roof

def make_ring_pts(z):
    w_body, y_rocker, y_fender, y_center, has_cabin, y_roof, w_roof = get_profile(z)
    y_shoulder = y_rocker + (y_fender - y_rocker) * 0.55
    w_shoulder = w_body

    if has_cabin:
        side_r = [
            (-w_body * 0.92, y_rocker),
            (-w_body * 0.96, y_rocker + (y_shoulder - y_rocker) * 0.50),
            (-w_shoulder, y_shoulder),
            (-w_body * 0.96, y_shoulder + (y_fender - y_shoulder) * 0.50),
            (-w_body * 0.92, y_fender),
            (-w_roof - 0.05, y_fender + (y_roof - y_fender) * 0.50),
            (-w_roof, y_roof - 0.010),
        ]
        top_pts = []
        for f in (-0.75, -0.38, 0.0, 0.38, 0.75):
            x = f * w_roof
            y = y_roof - 0.008 * (f ** 2)
            top_pts.append((x, y))
    else:
        side_r = [
            (-w_body * 0.92, y_rocker),
            (-w_body * 0.96, y_rocker + (y_shoulder - y_rocker) * 0.50),
            (-w_shoulder, y_shoulder),
            (-w_body * 0.96, y_shoulder + (y_fender - y_shoulder) * 0.50),
            (-w_body * 0.90, y_fender),
            (-w_body * 0.78, y_fender),
            (-w_roof, y_fender - 0.005),
        ]
        top_pts = []
        for f in (-0.75, -0.38, 0.0, 0.38, 0.75):
            x = f * w_roof
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
    # Top surfaces (k = 6..11)
    if 6 <= k <= 11:
        if 0.25 <= zm <= 0.90:
            # Windshield: center panels glass, outer A-pillars paint
            if k in (6, 11):
                return 'paint'
            return 'glass'
        elif -0.90 <= zm <= -0.20:
            # Notchback rear glass: center panels glass, outer C-pillars paint
            if k in (6, 11):
                return 'paint'
            return 'glass'
        elif -0.20 < zm < 0.25:
            return 'paint'   # Roof panel
        else:
            return 'paint'   # Hood or rear trunk deck

    # Side upper greenhouse glass (k = 5 and k = 12)
    if k in (5, 12):
        if -0.85 <= zm <= 0.80:
            return 'glass'
        return 'paint'

    # Side protective rub strip along waist (k = 2 and k = 15)
    if k in (2, 15):
        if -2.10 <= zm <= 1.70:
            return 'trim'

    # Lower sills / rocker
    if k in (0, 17):
        return 'accent'

    return 'paint'

# Build longitudinal body hull between rings
for i in range(len(rings) - 1):
    r0 = rings[i]
    r1 = rings[i + 1]
    z0 = r0['z']
    z1 = r1['z']
    zm = (z0 + z1) / 2.0
    N = len(r0['pts'])
    for k in range(N - 1):
        p0 = (r0['pts'][k]['x'], r0['pts'][k]['y'], z0)
        p1 = (r0['pts'][k + 1]['x'], r0['pts'][k + 1]['y'], z0)
        p2 = (r1['pts'][k + 1]['x'], r1['pts'][k + 1]['y'], z1)
        p3 = (r1['pts'][k]['x'], r1['pts'][k]['y'], z1)
        mname = get_segment_material(zm, k)
        bm = mat_bms[mname]
        add_quad(bm, p0, p1, p2, p3)

# Front end cap (nose at z = +2.03)
rf = rings[-1]
zf = rf['z']
pts_f = rf['pts']
bm_paint = mat_bms['paint']
bm_under = mat_bms['under']
bm_accent = mat_bms['accent']
v_nose_center = (0.0, 0.58, zf)

for k in range(len(pts_f) - 1):
    p0 = (pts_f[k]['x'], pts_f[k]['y'], zf)
    p1 = (pts_f[k + 1]['x'], pts_f[k + 1]['y'], zf)
    if 5 <= k <= 12:
        add_tri(bm_paint, p0, p1, v_nose_center)
    elif k in (0, 1, 16, 17):
        add_tri(bm_accent, p0, p1, v_nose_center)
    else:
        add_tri(bm_under, p0, p1, v_nose_center)

# Rear end cap (tail at z = -2.42)
rr = rings[0]
zr = rr['z']
pts_r = rr['pts']
v_tail_center = (0.0, 0.62, zr)

for k in range(len(pts_r) - 1):
    p0 = (pts_r[k]['x'], pts_r[k]['y'], zr)
    p1 = (pts_r[k + 1]['x'], pts_r[k + 1]['y'], zr)
    if 5 <= k <= 12:
        add_tri(bm_paint, p1, p0, v_tail_center)
    elif k in (0, 1, 16, 17):
        add_tri(bm_accent, p1, p0, v_tail_center)
    else:
        add_tri(bm_paint, p1, p0, v_tail_center)

# Underbody floor (under)
bm_floor = mat_bms['under']
for i in range(len(rings) - 1):
    r0 = rings[i]
    r1 = rings[i + 1]
    z0 = r0['z']
    z1 = r1['z']
    p_bl0 = (r0['pts'][0]['x'], r0['pts'][0]['y'], z0)
    p_br0 = (r0['pts'][-1]['x'], r0['pts'][-1]['y'], z0)
    p_bl1 = (r1['pts'][0]['x'], r1['pts'][0]['y'], z1)
    p_br1 = (r1['pts'][-1]['x'], r1['pts'][-1]['y'], z1)
    add_quad(bm_floor, p_bl0, p_bl1, p_br1, p_br0)

# Inner wheel well liners (under)
for axle in (FRONT_AXLE, REAR_AXLE):
    R_well = 0.35
    y_center_hub = 0.31
    for sgn in (-1, 1):
        x_outer = sgn * (WHEEL_X + 0.08)
        x_inner = sgn * (WHEEL_X - 0.20)
        n_seg = 6
        for seg in range(n_seg):
            a0 = math.pi * seg / n_seg
            a1 = math.pi * (seg + 1) / n_seg
            za0 = axle - R_well * math.cos(a0)
            ya0 = y_center_hub + R_well * math.sin(a0)
            za1 = axle - R_well * math.cos(a1)
            ya1 = y_center_hub + R_well * math.sin(a1)
            v0 = (x_outer, ya0, za0)
            v1 = (x_inner, ya0, za0)
            v2 = (x_inner, ya1, za1)
            v3 = (x_outer, ya1, za1)
            if sgn > 0:
                add_quad(bm_floor, v0, v1, v2, v3)
            else:
                add_quad(bm_floor, v3, v2, v1, v0)

# Instantiate body meshes
for mname, bm in mat_bms.items():
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mat_obj = globals()[mname.upper()]
    _obj(f'body_{mname}', bm, mat_obj)

# ----------------- DETAILS & ACCESSORIES -----------------

# 1. Front chin spoiler / lip (accent) to z = +2.030
box('front_chin_lip', ACCENT, 0.0, 0.16, 1.94, 1.44, 0.040, 0.18)
box('front_chin_edge', ACCENT, 0.0, 0.16, 2.02, 1.40, 0.040, 0.02)

# 2. Front lower intake & fog lamp recesses (under & trim)
box('front_intake_center', UNDER, 0.0, 0.26, 1.99, 0.72, 0.14, 0.08)
for sgn in (-1, 1):
    box(f'front_fog_housing_{sgn}', TRIM, sgn * 0.54, 0.27, 1.98, 0.22, 0.10, 0.06)
    box(f'front_fog_lens_{sgn}', LAMP, sgn * 0.54, 0.27, 2.015, 0.16, 0.06, 0.02)

# 3. Slim projector headlights (lamp, white emissive, strictly z > 0)
# Silvia S13 triple projector style housings per side
for sgn in (-1, 1):
    # Headlight chrome backing bezel
    box(f'headlight_housing_{sgn}', CHROME, sgn * 0.52, 0.63, 1.97, 0.36, 0.09, 0.06, yaw=-sgn*0.08)
    # Outer main beam
    box(f'headlight_main_{sgn}', LAMP, sgn * 0.60, 0.63, 2.010, 0.14, 0.07, 0.015, yaw=-sgn*0.08)
    # Inner high beam
    box(f'headlight_inner_{sgn}', LAMP, sgn * 0.44, 0.63, 2.010, 0.12, 0.07, 0.015, yaw=-sgn*0.08)
    # Corner amber indicator
    box(f'headlight_corner_{sgn}', TRIM, sgn * 0.71, 0.625, 1.96, 0.08, 0.08, 0.08, yaw=-sgn*0.14)

# 4. Narrow horizontal front grille slot (trim)
box('front_grille_slot', TRIM, 0.0, 0.63, 2.00, 0.48, 0.06, 0.05)

# 5. Aero side mirrors (paint cap, glass face, trim stalk)
for sgn in (-1, 1):
    box(f'mirror_stalk_{sgn}', TRIM, sgn * 0.72, 0.88, 0.75, 0.035, 0.06, 0.035)
    box(f'mirror_cap_{sgn}', PAINT, sgn * 0.80, 0.92, 0.75, 0.14, 0.07, 0.09, yaw=sgn*0.10)
    box(f'mirror_glass_{sgn}', GLASS, sgn * 0.80, 0.92, 0.73, 0.12, 0.06, 0.015, yaw=sgn*0.10)

# 6. Sports side skirts (accent) along lower rocker
for sgn in (-1, 1):
    box(f'side_skirt_{sgn}', ACCENT, sgn * 0.79, 0.16, -0.10, 0.05, 0.06, 2.10)

# 7. Rear trunk lip spoiler wing (accent)
# Low aerodynamic wing on trunk deck lid at z = -2.20
box('rear_spoiler_blade', ACCENT, 0.0, 0.965, -2.22, 1.34, 0.025, 0.20)
for sgn in (-1, 1):
    box(f'rear_spoiler_stand_{sgn}', ACCENT, sgn * 0.46, 0.935, -2.20, 0.040, 0.045, 0.14)

# 8. Wide block taillights (tail, red emissive, strictly z < 0)
# Classic S13 dual-tier horizontal rectangular block tail lamp assemblies
for sgn in (-1, 1):
    # Main red brake / tail lamp block
    box(f'taillight_block_{sgn}', TAIL, sgn * 0.54, 0.78, -2.408, 0.46, 0.14, 0.014)
    # Dark surround bezel
    box(f'taillight_trim_{sgn}', TRIM, sgn * 0.54, 0.78, -2.398, 0.48, 0.16, 0.022)
    # Center reverse / indicator insert in trim
    box(f'taillight_insert_{sgn}', CHROME, sgn * 0.40, 0.78, -2.408, 0.12, 0.06, 0.012)

# 9. Rear bumper lower valance & single chrome cannon exhaust on left side (x = -0.48)
box('rear_lower_valance', ACCENT, 0.0, 0.28, -2.36, 1.38, 0.06, 0.12)
# Single cannon sports exhaust
cylinder('exhaust_cannon', CHROME, -0.48, 0.26, -2.31, 0.048, -0.11, sides=12, axis='z')
cylinder('exhaust_bore', UNDER, -0.48, 0.26, -2.39, 0.038, -0.03, sides=12, axis='z')

# 10. Japanese license plates (plate)
box('plate_front', PLATE, 0.0, 0.36, 2.022, 0.33, 0.16, 0.014)
box('plate_rear', PLATE, 0.0, 0.75, -2.410, 0.33, 0.16, 0.014)

# ----------------- VIEWER WHEELS -----------------
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
    x_seat = cx + sgn * (rw / 2.0 - 0.045)
    x_hub = cx + sgn * (rw / 2.0 - 0.075)

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
    r_seat = make_ring(bm_rim, x_seat, rim_r * 0.90)
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
result = 'rv_sakura built'
