"""
Kagero Aristo VIP (rv_vip / rv-vip): late-90s Japanese luxury VIP sedan.
In the spirit of the Toyota Aristo JZS161 / Lexus GS300 / Toyota Celsior UCF20 / Nissan Cedric Y33 VIP style:
- Long, slammed VIP luxury sedan architecture: formal long hood, raked luxury greenhouse, high executive trunk deck
- Prestigious chrome front grille with vertical slats and hood chrome garnish
- Quad flush projector headlights (lamp, z > 0) set cleanly into the front fascia
- Level beltline with chrome waist rub strips along doors
- Long 4-door cabin with formal C-pillars, black B-pillar door divider, and tinted luxury glass
- High executive rear trunk deck with subtle VIP lip spoiler
- Wide horizontal luxury taillight clusters (tail, z < 0) with chrome accents and trunk garnish
- Dual large-bore chrome exhaust tips (x = +-0.55 m) ending flush at the tail (z = -2.75 m)
- Slammed stance with low rocker sills and deep-dish VIP luxury dish rims
- Dimensions: 4.95 x 1.82 x 1.45 m, axles at z = +1.25 and -1.67 m (wheelbase 2.92 m)
- Four viewer wheels (wheel-*, radius 0.34 m at x = +-0.78 m)
Run after kit.py.

Dimensions (from G5 specification table):
- Length: 4.95 m (nose z = +2.20, tail z = -2.75)
- Width: 1.82 m (body waist x = +-0.910, mirrors to +-0.950)
- Height: 1.45 m (roof crown y = 1.450 m)
- Axles: front z = +1.25, rear z = -1.67 (wheelbase 2.92 m)
- Wheels: radius 0.34 m, width 0.26 m, centers at x = +-0.78, y = 0.34, z = +1.25 and -1.67
- Body budget: at most 2,500 triangles; full <= 3,200
"""

clear()

import bmesh
import math
from mathutils import Vector

# Fixed car dimensions
LENGTH = 4.95
WIDTH = 1.82
TOTAL_HEIGHT = 1.450
ROOF_HEIGHT = 1.440
FRONT_AXLE = 1.25
REAR_AXLE = -1.67
WHEEL_RADIUS = 0.34
WHEEL_WIDTH = 0.26
WHEEL_X = 0.78

# Materials
PAINT = mat('paint', 0xf0efe8)       # VIP Platinum Pearl White (game repaints per car)
ACCENT = mat('accent', 0x141416)     # Front lip, rear valance, subtle aero spoilers
GLASS = mat('glass', 0x1a2430)       # Automotive tinted glass
TRIM = mat('trim', 0x1c1c1e)         # Window B-pillars, matte gaskets, grilles
UNDER = mat('under', 0x0c0c0c)       # Floor underside, wheel wells
CHROME = mat('chrome', 0xd8dce4)     # Front grille, waist rub strips, trunk garnish, exhaust tips
LAMP = mat('lamp', 0xffffff, emissive=True)   # Flush quad projector headlights (z > 0)
TAIL = mat('tail', 0xd01818, emissive=True)   # Wide luxury taillights (z < 0)
PLATE = mat('plate', 0xe8e6d8)       # Japanese license plate
TIRE = mat('tire', 0x151515)         # Viewer wheel tire
RIM = mat('rim', 0xd0d4dc)           # Polished deep-dish VIP luxury dish rims

# Z stations along car body hull from tail (z = -2.735) to nose (z = +2.185)
# Bumper lips and lamps extend to exact bounds z = -2.750 and z = +2.200
Z_STATIONS = [
    -2.735, -2.55, -2.35, -2.10, -1.90,
    -1.70, -1.50, -1.30, -1.10, -0.80,
    -0.50, -0.20, 0.10, 0.30, 0.60,
    0.85, 1.05, 1.25, 1.50, 1.75, 1.98, 2.185
]

def get_profile(z):
    # Plan view widths:
    # 1.82 m over rear hips / body waist (w = 0.910 m)
    # Tapered nose ~1.54 m (w = 0.770 m) at z = 2.185
    # Front arches ~1.79 m (w = 0.895 m) over front axle (+1.25)
    # Sleek waist ~1.77 m (w = 0.885 m) along doors (z = -0.20)
    # Rear hips 1.82 m (w = 0.910 m) over rear axle (-1.67)
    # Tapered tail ~1.68 m (w = 0.840 m) at z = -2.735
    if z > FRONT_AXLE:
        t = (z - FRONT_AXLE) / (2.185 - FRONT_AXLE)
        w_body = 0.895 - 0.125 * (t ** 1.15)
    elif z > -0.20:
        t = (z - (-0.20)) / (FRONT_AXLE - (-0.20))
        w_body = 0.885 + 0.010 * math.sin(t * math.pi / 2)
    elif z >= REAR_AXLE:
        t = (-0.20 - z) / (-0.20 - REAR_AXLE)
        w_body = 0.885 + 0.025 * math.sin(t * math.pi / 2)
    else:
        t = (REAR_AXLE - z) / (REAR_AXLE - (-2.735))
        w_body = 0.910 - 0.070 * (t ** 1.10)

    # Rocker & wheel arch cutouts (axles at +1.25 and -1.67, wheel radius 0.34 m)
    y_rocker = 0.17
    for axle in (FRONT_AXLE, REAR_AXLE):
        off = abs(z - axle)
        R_arch = 0.395
        if off < R_arch:
            arch_lift = 0.34 + math.sqrt(max(0.0, R_arch * R_arch - off * off)) * 0.88
            y_rocker = max(y_rocker, arch_lift)

    # Beltline / Hood / Trunk heights:
    # Hood: slopes from cowl (z = 1.05, y = 0.92) to nose (z = 2.185, y = 0.72)
    # Beltline: along cabin z in [-1.70, 1.05], formal level at y ~ 0.93
    # Rear trunk deck: flat deck z in [-2.735, -1.70], high executive deck from y = 0.98 to y = 0.955 at tail
    if z > 1.05:
        t = (z - 1.05) / (2.185 - 1.05)
        y_fender = 0.92 - 0.20 * (t ** 1.10)
        y_center = y_fender - 0.025 * math.sin(t * math.pi)
    elif z >= -1.70:
        t = (z - (-1.70)) / 2.75
        y_fender = 0.93 + 0.015 * math.sin(t * math.pi)
        y_center = y_fender
    else:
        t = (-1.70 - z) / (-1.70 - (-2.735))
        y_fender = 0.98 - 0.025 * t
        y_center = 0.975 - 0.025 * t

    # Greenhouse (Formal 4-door luxury sedan cabin):
    # Cabin extends from z = -1.70 (rear deck / axle) to z = 1.05 (cowl)
    has_cabin = -1.70 <= z <= 1.05
    if has_cabin:
        if z > 0.30:
            # Raked windshield from cowl (z=1.05, y=0.92) to roof front (z=0.30, y=1.44)
            t = (z - 0.30) / (1.05 - 0.30)
            y_roof = 1.440 - 0.520 * (t ** 1.12)
            w_roof = 0.640 + 0.040 * t
        elif z >= -1.10:
            # Long luxury roof panel: crown at y = 1.450 m around z = -0.40
            t = (z - (-0.40)) / 0.70
            y_roof = 1.450 - 0.012 * (t ** 2)
            w_roof = 0.640
        else:
            # Formal C-pillar & rear window: slopes from roof rear (z=-1.10, y=1.44) to deck lid (z=-1.70, y=0.98)
            t = (-1.10 - z) / (1.70 - 1.10)
            y_roof = 1.440 - 0.460 * (t ** 1.10)
            w_roof = 0.640 + 0.035 * t
    else:
        y_roof = y_center
        w_roof = w_body * 0.74

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
        if 0.30 <= zm <= 1.05:
            # Windshield: center panels glass, outer A-pillars paint
            if k in (6, 11):
                return 'paint'
            return 'glass'
        elif -1.70 <= zm <= -1.10:
            # Rear window: center panels glass, outer C-pillars paint
            if k in (6, 11):
                return 'paint'
            return 'glass'
        elif -1.10 < zm < 0.30:
            return 'paint'   # Long roof panel
        else:
            return 'paint'   # Hood or rear trunk deck

    # Side upper greenhouse glass & pillars (k = 5 and k = 12)
    if k in (5, 12):
        if zm > 0.80:
            return 'paint'   # A-pillar base
        elif 0.10 <= zm <= 0.80:
            return 'glass'   # Front door window
        elif -0.10 <= zm < 0.10:
            return 'trim'    # Black B-pillar vertical door divider
        elif -0.95 <= zm < -0.10:
            return 'glass'   # Rear door window
        elif -1.70 <= zm < -0.95:
            return 'paint'   # Formal luxury C-pillar / quarter sail panel
        return 'paint'

    # Lower sills / rocker (k = 0 and k = 17)
    if k in (0, 17):
        return 'accent'

    # All door and fender surfaces in body paint
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

# Front end cap (nose at z = +2.185)
# Painted clean bumper face with set-in lamps
rf = rings[-1]
zf = rf['z']
pts_f = rf['pts']
bm_paint = mat_bms['paint']
bm_under = mat_bms['under']
bm_accent = mat_bms['accent']
v_nose_center = (0.0, 0.64, zf)

for k in range(len(pts_f) - 1):
    p0 = (pts_f[k]['x'], pts_f[k]['y'], zf)
    p1 = (pts_f[k + 1]['x'], pts_f[k + 1]['y'], zf)
    if 2 <= k <= 15:
        add_tri(bm_paint, p0, p1, v_nose_center)
    elif k in (0, 1, 16, 17):
        add_tri(bm_accent, p0, p1, v_nose_center)
    else:
        add_tri(bm_under, p0, p1, v_nose_center)

# Rear end cap (tail at z = -2.735)
rr = rings[0]
zr = rr['z']
pts_r = rr['pts']
v_tail_center = (0.0, 0.68, zr)

for k in range(len(pts_r) - 1):
    p0 = (pts_r[k]['x'], pts_r[k]['y'], zr)
    p1 = (pts_r[k + 1]['x'], pts_r[k + 1]['y'], zr)
    if 2 <= k <= 15:
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
    R_well = 0.395
    y_center_hub = 0.34
    for sgn in (-1, 1):
        x_outer = sgn * (WHEEL_X + 0.08)
        x_inner = sgn * (WHEEL_X - 0.22)
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

# 1. Prestigious VIP Chrome Front Grille (chrome frame & vertical slats)
# Frame at z = 2.188, depth 0.022 -> front face at 2.199 <= 2.200
box('front_grille_frame', CHROME, 0.0, 0.58, 2.188, 0.52, 0.18, 0.022)
box('front_grille_mesh', TRIM, 0.0, 0.59, 2.190, 0.48, 0.15, 0.012)
# Hood chrome brow garnish
box('front_hood_chrome_garnish', CHROME, 0.0, 0.76, 2.185, 0.56, 0.025, 0.025)

# 2. Flush Quad Projector Headlights (lamp, white emissive, strictly z > 0)
# Clean flush set-in lamps on bumper fascia (no dark housings standing proud)
for sgn in (-1, 1):
    # Outer main beam projector
    box(f'headlight_outer_{sgn}', LAMP, sgn * 0.58, 0.68, 2.184, 0.18, 0.09, 0.016, yaw=-sgn*0.06)
    # Inner high beam projector
    box(f'headlight_inner_{sgn}', LAMP, sgn * 0.38, 0.68, 2.185, 0.14, 0.09, 0.016, yaw=-sgn*0.04)
    # Thin flush chrome surround rim
    box(f'headlight_rim_outer_{sgn}', CHROME, sgn * 0.58, 0.68, 2.178, 0.20, 0.105, 0.016, yaw=-sgn*0.06)
    box(f'headlight_rim_inner_{sgn}', CHROME, sgn * 0.38, 0.68, 2.180, 0.16, 0.105, 0.016, yaw=-sgn*0.04)
    # Corner amber indicator slot
    box(f'headlight_indicator_{sgn}', TRIM, sgn * 0.73, 0.67, 2.170, 0.07, 0.08, 0.040, yaw=-sgn*0.12)

# 3. Clean Front Bumper, Lower Intake & Flush Fog Lamps
# Clean lower center intake
box('front_lower_intake', UNDER, 0.0, 0.28, 2.175, 0.76, 0.12, 0.030)
# Flush fog lamps set cleanly into bumper
for sgn in (-1, 1):
    box(f'front_fog_lens_{sgn}', LAMP, sgn * 0.56, 0.28, 2.188, 0.14, 0.06, 0.016)
# Front VIP chin spoiler lip (accent) to z = +2.200
box('front_chin_lip', ACCENT, 0.0, 0.17, 2.11, 1.54, 0.035, 0.16)
box('front_chin_edge', ACCENT, 0.0, 0.17, 2.190, 1.50, 0.035, 0.020)

# 4. VIP Side Mirrors & Chrome Waist Strip
for sgn in (-1, 1):
    # Mirrors (paint cap, glass face, trim stalk)
    box(f'mirror_stalk_{sgn}', TRIM, sgn * 0.77, 0.94, 0.92, 0.035, 0.06, 0.035)
    box(f'mirror_cap_{sgn}', PAINT, sgn * 0.86, 0.98, 0.92, 0.15, 0.08, 0.10, yaw=sgn*0.08)
    box(f'mirror_glass_{sgn}', GLASS, sgn * 0.86, 0.98, 0.90, 0.13, 0.07, 0.015, yaw=sgn*0.08)

    # Sharp chrome waist protective rub strip along doors
    box(f'waist_chrome_strip_{sgn}', CHROME, sgn * 0.885, 0.54, -0.20, 0.015, 0.025, 2.30)

# 5. Slammed VIP Side Skirts (accent) along lower rocker
for sgn in (-1, 1):
    box(f'side_skirt_{sgn}', ACCENT, sgn * 0.865, 0.17, -0.21, 0.045, 0.060, 2.92)

# 6. Executive Trunk Deck Lip Spoiler (accent)
box('rear_trunk_lip', ACCENT, 0.0, 0.985, -2.55, 1.44, 0.025, 0.22)

# 7. Wide Horizontal Luxury Taillights (tail, red emissive, strictly z < 0)
# Rear bumper face at z = -2.735; taillights at cz = -2.742 with depth 0.014 reach -2.749 >= -2.750
for sgn in (-1, 1):
    # Main outer red tail/brake cluster
    box(f'taillight_outer_{sgn}', TAIL, sgn * 0.54, 0.78, -2.742, 0.48, 0.15, 0.014)
    # Inner trunk tail cluster
    box(f'taillight_inner_{sgn}', TAIL, sgn * 0.24, 0.78, -2.742, 0.24, 0.15, 0.014)
    # Chrome reverse / clear reflector garnish
    box(f'taillight_chrome_strip_{sgn}', CHROME, sgn * 0.42, 0.76, -2.743, 0.20, 0.04, 0.012)
    # Thin flush taillight surround bezel
    box(f'taillight_bezel_{sgn}', TRIM, sgn * 0.44, 0.78, -2.736, 0.72, 0.17, 0.016)

# Center trunk bridge tail bar
box('taillight_center_bridge', TAIL, 0.0, 0.81, -2.742, 0.46, 0.08, 0.014)

# 8. Executive Rear Trunk Chrome License Garnish
box('rear_trunk_chrome_garnish', CHROME, 0.0, 0.86, -2.742, 0.54, 0.035, 0.014)

# 9. Japanese License Plates (plate) 'KG 88-88'
# Front plate at cz = 2.190, d = 0.014 -> front face at 2.197 <= 2.200
box('plate_front', PLATE, 0.0, 0.38, 2.190, 0.33, 0.16, 0.014)
# Rear plate at cz = -2.743, d = 0.012 -> rear face at -2.749 >= -2.750
box('plate_rear', PLATE, 0.0, 0.70, -2.743, 0.33, 0.16, 0.012)

# 10. Rear Bumper Lower Valance & Dual Chrome Exhaust Tips (x = +-0.55 m, ending flush at z = -2.750 m)
box('rear_lower_valance', ACCENT, 0.0, 0.28, -2.68, 1.48, 0.07, 0.12)
for sgn in (-1, 1):
    cylinder(f'exhaust_tip_{sgn}', CHROME, sgn * 0.55, 0.25, -2.62, 0.048, -0.13, sides=12, axis='z')
    cylinder(f'exhaust_bore_{sgn}', UNDER, sgn * 0.55, 0.25, -2.72, 0.038, -0.03, sides=12, axis='z')

# ----------------- VIEWER WHEELS -----------------
def make_wheel(name, cx, cz):
    bm_tire = bmesh.new()
    bm_rim = bmesh.new()
    cy = WHEEL_RADIUS
    rw = WHEEL_WIDTH
    R = WHEEL_RADIUS
    rim_r = R * 0.70
    shoulder = min(0.028, rw * 0.15)
    sides = 16

    sgn = 1 if cx > 0 else -1
    x_in_side = cx - sgn * (rw / 2.0)
    x_in_tread = cx - sgn * (rw / 2.0 - shoulder)
    x_out_tread = cx + sgn * (rw / 2.0 - shoulder)
    x_out_side = cx + sgn * (rw / 2.0)
    # VIP deep-dish rim: stepped outer lip with deep inset dish face
    x_dish_lip = cx + sgn * (rw / 2.0 - 0.020)
    x_dish_face = cx + sgn * (rw / 2.0 - 0.080)
    x_hub = cx + sgn * (rw / 2.0 - 0.100)

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
    r_dish_lip = make_ring(bm_rim, x_dish_lip, rim_r * 0.94)
    r_dish_face = make_ring(bm_rim, x_dish_face, rim_r * 0.85)
    v_hub = bm_rim.verts.new(g2b(x_hub, cy, cz))

    for i in range(sides):
        j = (i + 1) % sides
        if sgn > 0:
            bm_tire.faces.new([t_in_side[i], t_in_side[j], t_in_tread[j], t_in_tread[i]])
            bm_tire.faces.new([t_in_tread[i], t_in_tread[j], t_out_tread[j], t_out_tread[i]])
            bm_tire.faces.new([t_out_tread[i], t_out_tread[j], t_out_side[j], t_out_side[i]])
            bm_tire.faces.new([t_out_side[i], t_out_side[j], t_lip[j], t_lip[i]])
            bm_rim.faces.new([r_lip[i], r_lip[j], r_dish_lip[j], r_dish_lip[i]])
            bm_rim.faces.new([r_dish_lip[i], r_dish_lip[j], r_dish_face[j], r_dish_face[i]])
            bm_rim.faces.new([r_dish_face[i], r_dish_face[j], v_hub])
        else:
            bm_tire.faces.new([t_in_side[j], t_in_side[i], t_in_tread[i], t_in_tread[j]])
            bm_tire.faces.new([t_in_tread[j], t_in_tread[i], t_out_tread[i], t_out_tread[j]])
            bm_tire.faces.new([t_out_tread[j], t_out_tread[i], t_out_side[i], t_out_side[j]])
            bm_tire.faces.new([t_out_side[j], t_out_side[i], t_lip[i], t_lip[j]])
            bm_rim.faces.new([r_lip[j], r_lip[i], r_dish_lip[i], r_dish_lip[j]])
            bm_rim.faces.new([r_dish_lip[j], r_dish_lip[i], r_dish_face[i], r_dish_face[j]])
            bm_rim.faces.new([r_dish_face[j], r_dish_face[i], v_hub])

    bmesh.ops.recalc_face_normals(bm_tire, faces=bm_tire.faces)
    bmesh.ops.recalc_face_normals(bm_rim, faces=bm_rim.faces)

    _obj(f'{name}_tire', bm_tire, TIRE)
    _obj(f'{name}_rim', bm_rim, RIM)

make_wheel('wheel-fl', WHEEL_X, FRONT_AXLE)
make_wheel('wheel-fr', -WHEEL_X, FRONT_AXLE)
make_wheel('wheel-rl', WHEEL_X, REAR_AXLE)
make_wheel('wheel-rr', -WHEEL_X, REAR_AXLE)

frame_view()
result = 'rv_vip built'
