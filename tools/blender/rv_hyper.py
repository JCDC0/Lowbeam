"""
Vespera Zero (rv_hyper / rv-hyper): exotic mid-engine hypercar.
In the spirit of Pagani Zonda / Koenigsegg / McLaren F1 / Vespera GT exotic lineage:
- Cab-forward aerodynamic teardrop canopy with narrow greenhouse (1.04 m wide) over wide stance
- Massive 2.04 m wide rear hips (x = +-1.02 m) with sculpted mid-engine radiator side scoops
- Low sleek aerodynamic roofline (crown y = 1.130 m, roof y = 1.120 m)
- Dipped aerodynamic front hood between muscular arched front fenders
- Low nose with front carbon splitter, side canards, and slim LED headlights (lamp, z > 0)
- Long rear tail with louvered engine deck, twin swan-neck aero wing, and full-width rear tail lamp bar (tail, z < 0)
- Deep aerodynamic rear under-diffuser with 4 vertical fins and central twin sports exhaust tips
- Dimensions: 4.65 x 2.04 x 1.13 m, axles at z = +1.55 and -1.15 m (wheelbase 2.70 m)
- Four viewer wheels (wheel-*, radius 0.34 m at x = +-0.85)
Run after kit.py.

Dimensions (from G5 specification table):
- Length: 4.65 m (nose z = +2.60, tail z = -2.05)
- Width: 2.04 m (rear hips x = +-1.020, body waist x = +-0.910, mirrors to +-1.060)
- Height: 1.13 m (roof crown y = 1.130 m)
- Axles: front z = +1.55, rear z = -1.15 (wheelbase 2.70 m)
- Wheels: radius 0.34 m, width 0.28 m, centers at x = +-0.85, y = 0.34, z = +1.55 and -1.15
- Body budget: at most 2,500 triangles; full <= 3,200
"""

clear()

import bmesh
import math
from mathutils import Vector

# Fixed car dimensions
LENGTH = 4.65
WIDTH = 2.04
TOTAL_HEIGHT = 1.130
ROOF_HEIGHT = 1.125
FRONT_AXLE = 1.55
REAR_AXLE = -1.15
WHEEL_RADIUS = 0.34
WHEEL_WIDTH = 0.28
WHEEL_X = 0.85

# Materials
PAINT = mat('paint', 0xd88a10)       # Vespera Pearl Orange (game repaints per car)
ACCENT = mat('accent', 0x141416)     # Exposed carbon fiber (splitter, diffuser, wing, vents)
GLASS = mat('glass', 0x1a2430)       # Automotive tinted glass
TRIM = mat('trim', 0x1e1e20)         # Window frames, louvers, grille trim
UNDER = mat('under', 0x0c0c0c)       # Floor underside, engine bay, wheel wells
CHROME = mat('chrome', 0xd0d4dc)     # Exhaust tips
LAMP = mat('lamp', 0xffffff, emissive=True)   # Slim LED headlights (z > 0)
TAIL = mat('tail', 0xd01818, emissive=True)   # Full-width rear lamp bar (z < 0)
PLATE = mat('plate', 0xe8e6d8)       # License plate
TIRE = mat('tire', 0x151515)         # Viewer wheel tire
RIM = mat('rim', 0x282a2e)           # Gunmetal exotic hypercar rims

# Z stations along car body hull from tail (z = -2.05) to nose (z = +2.60)
Z_STATIONS = [
    -2.05, -1.90, -1.72, -1.50, -1.30,
    -1.15, -0.98, -0.75, -0.45, -0.15,
    0.15, 0.45, 0.75, 1.05, 1.30,
    1.55, 1.82, 2.08, 2.34, 2.60
]

def get_profile(z):
    # Plan view widths:
    # 2.04 m rear hips (w = 1.020 m) over rear axle (-1.15)
    # 1.82 m waist (w = 0.910 m) at cabin center (0.15)
    # 1.96 m front fenders (w = 0.980 m) over front axle (+1.55)
    # Tapered nose ~1.50 m (w = 0.750 m) at z = 2.60
    # Tapered tail ~1.72 m (w = 0.860 m) at z = -2.05
    if z > FRONT_AXLE:
        t = (z - FRONT_AXLE) / (2.60 - FRONT_AXLE)
        w_body = 0.980 - 0.230 * (t ** 1.15)
    elif z > 0.15:
        t = (z - 0.15) / (FRONT_AXLE - 0.15)
        w_body = 0.910 + 0.070 * math.sin(t * math.pi / 2)
    elif z >= REAR_AXLE:
        t = (0.15 - z) / (0.15 - REAR_AXLE)
        w_body = 0.910 + 0.110 * math.sin(t * math.pi / 2)
    else:
        t = (REAR_AXLE - z) / (REAR_AXLE - (-2.05))
        w_body = 1.020 - 0.160 * (t ** 1.10)

    # Rocker & wheel arch cutouts (axles at +1.55 and -1.15, wheel radius 0.34 m)
    y_rocker = 0.14
    for axle in (FRONT_AXLE, REAR_AXLE):
        off = abs(z - axle)
        R_arch = 0.40
        if off < R_arch:
            arch_lift = 0.34 + math.sqrt(max(0.0, R_arch * R_arch - off * off)) * 0.88
            y_rocker = max(y_rocker, arch_lift)

    # Beltline / Hood / Deck heights:
    # Front: nose at y = 0.46, front fender crest at y = 0.74 (z = 1.55), cowl at y = 0.72 (z = 1.30)
    # Dipped hood center (5.5 cm below fender brow)
    if z > 1.30:
        t = (z - 1.30) / (2.60 - 1.30)
        y_fender = 0.74 - 0.28 * (t ** 1.15)
        y_center = y_fender - 0.055 * math.sin(t * math.pi)
    elif z > 0.45:
        # Front transition to cowl
        t = (z - 0.45) / (1.30 - 0.45)
        y_fender = 0.75 - 0.01 * t
        y_center = 0.72 - 0.01 * t
    elif z >= -0.45:
        # Cabin waist beltline
        t = (z - (-0.45)) / 0.90
        y_fender = 0.77 + 0.03 * math.sin(t * math.pi)
        y_center = y_fender - 0.02
    elif z >= -1.50:
        # Mid-engine deck: rear fender crest rises to hips at y = 0.86, deck center y = 0.82
        t = (-0.45 - z) / 1.05
        y_fender = 0.80 + 0.06 * math.sin(t * math.pi / 2)
        y_center = 0.78 + 0.04 * math.sin(t * math.pi / 2)
    else:
        # Rear deck lid to tail: slopes down to tail panel y = 0.76
        t = (-1.50 - z) / (-1.50 - (-2.05))
        y_fender = 0.86 - 0.10 * (t ** 1.05)
        y_center = 0.82 - 0.06 * (t ** 1.05)

    # Greenhouse / Canopy:
    # Cab-forward teardrop canopy extending from z = -0.75 to z = 1.10
    has_cabin = -0.75 <= z <= 1.10
    if has_cabin:
        if z > 0.45:
            # Steep raked cab-forward windshield from cowl (z=1.10, y=0.74) to roof (z=0.45, y=1.11)
            t = (z - 0.45) / (1.10 - 0.45)
            y_roof = 1.110 - 0.370 * (t ** 1.15)
            w_roof = 0.520 + 0.040 * t
        elif z >= -0.20:
            # Cabin roof: peak crown at y = 1.130 m around z = 0.15
            t = (z - 0.15) / 0.35
            y_roof = 1.130 - 0.020 * (t ** 2)
            w_roof = 0.520
        else:
            # Fastback engine glass canopy sloping to rear firewall (z = -0.75, y = 0.85)
            t = (-0.20 - z) / (0.75 - 0.20)
            y_roof = 1.110 - 0.260 * (t ** 1.10)
            w_roof = 0.520 - 0.050 * t
    else:
        y_roof = y_center
        w_roof = w_body * 0.70

    return w_body, y_rocker, y_fender, y_center, has_cabin, y_roof, w_roof

def make_ring_pts(z):
    w_body, y_rocker, y_fender, y_center, has_cabin, y_roof, w_roof = get_profile(z)
    y_shoulder = y_rocker + (y_fender - y_rocker) * 0.52
    w_shoulder = w_body

    if has_cabin:
        side_r = [
            (-w_body * 0.92, y_rocker),
            (-w_body * 0.96, y_rocker + (y_shoulder - y_rocker) * 0.50),
            (-w_shoulder, y_shoulder),
            (-w_body * 0.96, y_shoulder + (y_fender - y_shoulder) * 0.50),
            (-w_body * 0.91, y_fender),
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
            (-w_body * 0.88, y_fender),
            (-w_body * 0.76, y_fender),
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
        if 0.45 <= zm <= 1.05:
            # Cab-forward windshield: center 3 panels glass, outer A-pillars paint
            if k in (6, 11):
                return 'paint'
            return 'glass'
        elif -0.75 <= zm <= -0.20:
            # Fastback rear engine glass canopy: center panels glass, outer C-pillars paint
            if k in (6, 11):
                return 'paint'
            return 'glass'
        elif -0.20 < zm < 0.45:
            return 'paint'   # Roof panel
        elif -1.50 <= zm < -0.75:
            # Mid-engine deck cooling louver insert in center
            if k in (8, 9):
                return 'accent'
            return 'paint'
        else:
            return 'paint'   # Hood or rear deck

    # Side upper greenhouse glass (k = 5 and k = 12)
    if k in (5, 12):
        if -0.65 <= zm <= 0.85:
            return 'glass'
        return 'paint'

    # Side lower body waist / door air scoops
    if k in (2, 3, 14, 15):
        if -0.75 <= zm <= -0.15:
            # Side radiator air scoop recess
            if k in (3, 14):
                return 'accent'
        return 'paint'

    # Lower rocker / sills
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

# Front end cap (nose at z = +2.60)
rf = rings[-1]
zf = rf['z']
pts_f = rf['pts']
bm_paint = mat_bms['paint']
bm_under = mat_bms['under']
bm_accent = mat_bms['accent']

v_nose_center = (0.0, 0.46, zf)
for k in range(len(pts_f) - 1):
    p0 = (pts_f[k]['x'], pts_f[k]['y'], zf)
    p1 = (pts_f[k + 1]['x'], pts_f[k + 1]['y'], zf)
    if 5 <= k <= 12:
        add_tri(bm_paint, p0, p1, v_nose_center)
    elif k in (0, 1, 16, 17):
        add_tri(bm_accent, p0, p1, v_nose_center)
    else:
        add_tri(bm_under, p0, p1, v_nose_center)

# Rear end cap (tail at z = -2.05)
rr = rings[0]
zr = rr['z']
pts_r = rr['pts']
v_tail_center = (0.0, 0.52, zr)
for k in range(len(pts_r) - 1):
    p0 = (pts_r[k]['x'], pts_r[k]['y'], zr)
    p1 = (pts_r[k + 1]['x'], pts_r[k + 1]['y'], zr)
    if 6 <= k <= 11:
        add_tri(bm_paint, p1, p0, v_tail_center)
    elif k in (0, 1, 16, 17):
        add_tri(bm_accent, p1, p0, v_tail_center)
    else:
        add_tri(bm_paint, p1, p0, v_tail_center)

# Underbody flat floor (in under)
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

# Inner wheel well liners (dark under wells)
for axle in (FRONT_AXLE, REAR_AXLE):
    R_well = 0.38
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

# Instantiate body objects
for mname, bm in mat_bms.items():
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mat_obj = globals()[mname.upper()]
    _obj(f'body_{mname}', bm, mat_obj)

# ----------------- DETAILS & ACCESSORIES -----------------

# 1. Front carbon splitter (accent)
# Reaching to z = +2.60 m at y = 0.14 m, with front aero lip and endplates
box('front_splitter', ACCENT, 0.0, 0.11, 2.38, 1.64, 0.035, 0.44)
box('splitter_lip', ACCENT, 0.0, 0.11, 2.58, 1.48, 0.035, 0.04)
# Splitter vertical side winglet endplates
for sgn in (-1, 1):
    box(f'splitter_winglet_{sgn}', ACCENT, sgn * 0.81, 0.11, 2.38, 0.025, 0.12, 0.40)
    # Dual front aerodynamic canards on bumper corners
    box(f'canard_low_{sgn}', ACCENT, sgn * 0.84, 0.28, 2.45, 0.18, 0.018, 0.16, yaw=-sgn*0.25)
    box(f'canard_high_{sgn}', ACCENT, sgn * 0.86, 0.38, 2.38, 0.16, 0.018, 0.14, yaw=-sgn*0.25)

# 2. Front lower central intake mouth & side radiator grilles (under & accent)
box('front_intake_center', UNDER, 0.0, 0.17, 2.53, 0.76, 0.18, 0.08)
for sgn in (-1, 1):
    box(f'front_intake_side_{sgn}', UNDER, sgn * 0.60, 0.20, 2.50, 0.32, 0.16, 0.08)

# 3. Slim LED headlights (lamp, white emissive, strictly z > 0)
# Sleek dual horizontal light elements on each front fender brow
for sgn in (-1, 1):
    # Main projector slit
    box(f'headlight_main_{sgn}', LAMP, sgn * 0.65, 0.58, 2.52, 0.18, 0.035, 0.06, yaw=-sgn*0.18)
    # Inner accent DRL slit
    box(f'headlight_drl_{sgn}', LAMP, sgn * 0.50, 0.57, 2.54, 0.10, 0.022, 0.05, yaw=-sgn*0.22)
    # Headlight dark carbon surround housing
    box(f'headlight_trim_{sgn}', TRIM, sgn * 0.59, 0.575, 2.51, 0.32, 0.055, 0.04, yaw=-sgn*0.18)

# 4. Aerodynamic side mirrors (paint cap, glass face, accent stalk)
for sgn in (-1, 1):
    # Stalk mounted on door / cowl
    box(f'mirror_stalk_{sgn}', ACCENT, sgn * 0.72, 0.75, 0.82, 0.035, 0.07, 0.035)
    # Mirror aerodynamic shell
    box(f'mirror_shell_{sgn}', PAINT, sgn * 0.82, 0.80, 0.82, 0.15, 0.075, 0.10, yaw=sgn*0.12)
    # Mirror reflective face
    box(f'mirror_glass_{sgn}', GLASS, sgn * 0.82, 0.80, 0.80, 0.13, 0.065, 0.015, yaw=sgn*0.12)

# 5. Side radiator cooling intakes (sculpted pods ahead of rear wheels)
for sgn in (-1, 1):
    # Dark radiator cavity inside intake
    box(f'side_intake_bore_{sgn}', UNDER, sgn * 0.86, 0.44, -0.45, 0.06, 0.24, 0.32)
    # Carbon aero splitter blade inside side intake
    box(f'side_intake_blade_{sgn}', ACCENT, sgn * 0.88, 0.44, -0.45, 0.03, 0.22, 0.28)

# 6. Mid-engine deck heat extraction louvers (accent / trim across rear deck)
# Six aerodynamic cooling slats behind the rear canopy
for idx, lz in enumerate([-0.90, -1.02, -1.14, -1.26, -1.38, -1.50]):
    lw = 0.52 - 0.04 * idx
    box(f'engine_louver_{idx}', ACCENT, 0.0, 0.825 + 0.01 * (1 - idx * 0.1), lz, lw, 0.020, 0.045)

# 7. Rear active aero GT wing (accent)
# Carbon wing blade spanning x in [-0.85, +0.85], with curved endplates and twin swan-neck pylons
box('rear_wing_blade', ACCENT, 0.0, 0.88, -1.86, 1.54, 0.030, 0.24)
for sgn in (-1, 1):
    # Wing vertical endplates
    box(f'wing_endplate_{sgn}', ACCENT, sgn * 0.77, 0.88, -1.86, 0.020, 0.14, 0.28)
    # Swan-neck top mounting pylons
    box(f'wing_pylon_{sgn}', ACCENT, sgn * 0.32, 0.84, -1.82, 0.028, 0.10, 0.16)

# 8. Full-width rear tail lamp bar (tail, red emissive, strictly z < 0)
# Continuous sleek neon light bar across the tail fascia
box('taillight_bar', TAIL, 0.0, 0.71, -2.035, 1.62, 0.038, 0.025)
# Dark carbon surround backing panel for tail bar
box('tail_backing', TRIM, 0.0, 0.71, -2.025, 1.66, 0.060, 0.020)

# 9. Rear aero diffuser with 4 vertical fins (accent & under)
box('rear_diffuser_tray', ACCENT, 0.0, 0.20, -1.85, 1.48, 0.040, 0.38)
for sgn, fx in [(-1, -0.52), (-1, -0.18), (1, 0.18), (1, 0.52)]:
    box(f'diffuser_fin_{fx}', ACCENT, fx, 0.18, -1.86, 0.022, 0.14, 0.36)

# 10. Central twin sports exhaust tips (chrome with under bore)
for sgn in (-1, 1):
    cylinder(f'exhaust_tip_{sgn}', CHROME, sgn * 0.10, 0.56, -1.95, 0.052, -0.10, sides=12, axis='z')
    cylinder(f'exhaust_bore_{sgn}', UNDER, sgn * 0.10, 0.56, -2.02, 0.040, -0.03, sides=12, axis='z')

# 11. Japanese license plates (plate)
box('plate_front', PLATE, 0.0, 0.24, 2.585, 0.33, 0.16, 0.015)
box('plate_rear', PLATE, 0.0, 0.56, -2.038, 0.33, 0.16, 0.015)

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
    x_seat = cx + sgn * (rw / 2.0 - 0.055)
    x_hub = cx + sgn * (rw / 2.0 - 0.088)

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
result = 'rv_hyper built'
