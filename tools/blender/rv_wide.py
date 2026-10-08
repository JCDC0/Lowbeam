"""
Kagero RS-Wide (rv_wide / rv-wide): Widebody tuner coupe.
In the spirit of Rocket Bunny / Pandem / Liberty Walk GT coupes (GT-R, Supra, Silvia):
- Widebody stance: 1.95 m wide over riveted bolt-on over-fenders standing out from a 1.78 m body
- Visible rivet heads along flare attachment seams
- Deep front splitter on metallic stays, dual front bumper canards per side
- Fastback coupe greenhouse: raked windshield, sleek fastback roof sweeping to rear deck
- Integrated rear ducktail spoiler lip on deck lid
- Big GT wing on swan-neck mounts arching above the roof line (top crown y = 1.390 m)
- Finned rear under-diffuser with 4 vertical aerodynamic diffuser fins
- Quad large-bore tuner exhaust tips through diffuser cutouts
- Aggressive headlights (lamp, z > 0) and round taillights (tail, z < 0)
- Dimensions: 4.60 x 1.95 x 1.39 m, axles at z = +1.25 and -1.42 m (wheelbase 2.67 m)
- Four viewer wheels (wheel-*, radius 0.33 m at x = +-0.80)
Run after kit.py.

Dimensions (from G5 specification table):
- Length: 4.60 m (nose z = +2.17, tail z = -2.43)
- Width: 1.95 m (flares x = +-0.975, body waist x = +-0.890)
- Height: 1.39 m (swan-neck wing crown y = 1.390 m, roof y = 1.360 m)
- Axles: front z = +1.25, rear z = -1.42 (wheelbase 2.67 m)
- Wheels: radius 0.33 m, width 0.26 m, centers at x = +-0.80, y = 0.33, z = +1.25 and -1.42
- Body budget: ideally <= 1,800, never over 2,500; full <= 2,600
"""

clear()

import bmesh
import math
from mathutils import Vector

# Fixed car dimensions
LENGTH = 4.60
WIDTH = 1.95
TOTAL_HEIGHT = 1.390
ROOF_HEIGHT = 1.360
FRONT_AXLE = 1.25
REAR_AXLE = -1.42
WHEEL_RADIUS = 0.33
WHEEL_WIDTH = 0.26
WHEEL_X = 0.80

# Materials
PAINT = mat('paint', 0xc23a2a)       # Crimson / Tuner Red (game repaints per car)
ACCENT = mat('accent', 0x18181a)     # Carbon / black aerodynamic parts (splitter, wing, flares)
GLASS = mat('glass', 0x1a2430)       # Automotive tinted glass
TRIM = mat('trim', 0x222224)         # Window trim, seals, diffuser
UNDER = mat('under', 0x0c0c0c)       # Floor underside, engine vents, wheel wells
CHROME = mat('chrome', 0xd0d4dc)     # Exhaust tips, splitter stays
LAMP = mat('lamp', 0xffffff, emissive=True)   # Aggressive headlights (z > 0)
TAIL = mat('tail', 0xd01818, emissive=True)   # Round sports taillights (z < 0)
PLATE = mat('plate', 0xe8e6d8)       # License plate
TIRE = mat('tire', 0x151515)         # Viewer wheel tire
RIM = mat('rim', 0x2a2c30)           # Gunmetal deep-dish tuner rims

# Z stations along the car body hull from z = -2.39 to z = +2.13
# Splitter reaches +2.170, rear bumper/diffuser reaches -2.430
Z_STATIONS = [
    -2.39, -2.20, -1.95, -1.72, -1.52,
    -1.42, -1.25, -1.02, -0.70, -0.38,
    -0.05, 0.25, 0.55, 0.85, 1.05,
    1.25, 1.50, 1.75, 1.95, 2.13
]

def get_profile(z):
    # Plan view widths:
    # 1.78 m body waist (w_base = 0.890 m)
    # Riveted bolt-on flares over axles out to 1.95 m (w_body = 0.975 m)
    # Nose (z=2.13): tapered to ~1.64m (w=0.82)
    # Tail (z=-2.39): tapered to ~1.68m (w=0.84)
    if z > FRONT_AXLE:
        t = (z - FRONT_AXLE) / (2.13 - FRONT_AXLE)
        w_body = 0.975 - 0.155 * (t ** 1.15)
    elif z > 0.60:
        t = (z - 0.60) / (FRONT_AXLE - 0.60)
        w_body = 0.890 + 0.085 * math.sin(t * math.pi / 2)
    elif z >= -0.70:
        # Waist / doors: 1.78 m body width (w = 0.890 m)
        w_body = 0.890
    elif z >= REAR_AXLE:
        t = (z - REAR_AXLE) / (-0.70 - REAR_AXLE)
        w_body = 0.975 - 0.085 * math.sin(t * math.pi / 2)
    else:
        t = (REAR_AXLE - z) / (REAR_AXLE - (-2.39))
        w_body = 0.975 - 0.135 * (t ** 1.10)

    # Rocker & wheel arch cutouts (axles at +1.25 and -1.42, wheel radius 0.33 m)
    y_rocker = 0.18
    for axle in (FRONT_AXLE, REAR_AXLE):
        off = abs(z - axle)
        R_arch = 0.39
        if off < R_arch:
            arch_lift = 0.33 + math.sqrt(max(0.0, R_arch * R_arch - off * off)) * 0.88
            y_rocker = max(y_rocker, arch_lift)

    # Beltline / Hood / Trunk heights:
    # Hood: slopes from cowl (z=0.85, y=0.91) to nose (z=2.13, y=0.70)
    # Beltline: along cabin z in [-1.50, 0.85], level at y ~ 0.925
    # Rear deck: z in [-2.39, -1.50], gently sloping at y ~ 0.94
    if z > 0.85:
        t = (z - 0.85) / (2.13 - 0.85)
        y_fender = 0.910 - 0.210 * (t ** 1.05)
        y_center = y_fender - 0.020 * math.sin(t * math.pi)
    elif z >= -1.50:
        y_fender = 0.925
        y_center = 0.925
    else:
        t = (-1.50 - z) / (2.39 - 1.50)
        y_fender = 0.935 - 0.015 * t
        y_center = y_fender

    has_cabin = (-1.50 < z < 0.85)
    if has_cabin:
        if z > 0.25:
            # Raked windshield: base at z = 0.85 (y=0.91), top at z = 0.25 (y=1.355)
            t = (z - 0.25) / (0.85 - 0.25)
            y_roof = 1.355 - 0.445 * (t ** 1.05)
            w_roof = 0.630 - 0.040 * t
        elif z >= -0.30:
            # Roof: crown at y = 1.360 m
            t = (z - (-0.025)) / 0.275
            y_roof = 1.360 - 0.005 * (t ** 2)
            w_roof = 0.630
        else:
            # Sleek fastback rear glass: sloping from z = -0.30 (y=1.36) to z = -1.50 (y=0.94)
            t = (-0.30 - z) / (1.50 - 0.30)
            y_roof = 1.355 - 0.415 * (t ** 1.08)
            w_roof = 0.630 - 0.050 * t
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
            (-w_body * 0.96, y_rocker + (y_shoulder - y_rocker) * 0.5),
            (-w_shoulder, y_shoulder),
            (-w_body * 0.96, y_shoulder + (y_fender - y_shoulder) * 0.5),
            (-w_body * 0.92, y_fender),
            (-w_roof - 0.04, y_fender + (y_roof - y_fender) * 0.5),
            (-w_roof, y_roof - 0.012),
        ]
        top_pts = []
        for f in (-0.75, -0.38, 0.0, 0.38, 0.75):
            x = f * w_roof
            y = y_roof - 0.010 * (f ** 2)
            top_pts.append((x, y))
    else:
        side_r = [
            (-w_body * 0.92, y_rocker),
            (-w_body * 0.96, y_rocker + (y_shoulder - y_rocker) * 0.5),
            (-w_shoulder, y_shoulder),
            (-w_body * 0.96, y_shoulder + (y_fender - y_shoulder) * 0.5),
            (-w_body * 0.90, y_fender),
            (-w_body * 0.80, y_fender),
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
        if 0.25 <= zm <= 0.85:
            # Windshield: center is glass, outer rails are paint (A-pillar)
            if k in (6, 11):
                return 'paint'
            return 'glass'
        elif -1.50 <= zm <= -0.30:
            # Fastback rear glass: center is glass, outer rails are paint (C-pillar)
            if k in (6, 11):
                return 'paint'
            return 'glass'
        elif -0.30 < zm < 0.25:
            return 'paint'   # Roof panel
        else:
            return 'paint'   # Hood or rear deck
    # Side upper surfaces (pillars and side windows: k in 4, 5, 12, 13)
    elif k in (4, 5, 12, 13):
        if -0.70 <= zm <= 0.40:
            return 'glass'   # Coupe side window
        elif -1.45 <= zm < -0.70:
            return 'paint'   # Fastback quarter pillar
        elif 0.40 < zm <= 0.85:
            return 'paint'   # A-pillar base
        else:
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

# Cap front at z = 2.13 and rear at z = -2.39
cap_ring_fan(mat_bms['paint'], rings[-1]['pts'], 2.13, is_front=True)
cap_ring_fan(mat_bms['paint'], rings[0]['pts'], -2.39, is_front=False)

# Inner wheel arch liners (axles at +1.25 and -1.42)
bm_u = mat_bms['under']
for axle in (FRONT_AXLE, REAR_AXLE):
    xs_list = (WHEEL_X, -WHEEL_X)
    for xs in xs_list:
        arch_steps = 6
        R_arch = 0.39
        for i in range(arch_steps):
            a0 = math.pi * i / arch_steps
            a1 = math.pi * (i + 1) / arch_steps
            z0 = axle - R_arch * math.cos(a0)
            z1 = axle - R_arch * math.cos(a1)
            y0 = 0.33 + R_arch * math.sin(a0) * 0.88
            y1 = 0.33 + R_arch * math.sin(a1) * 0.88
            x_out = xs * 1.16
            x_in = xs * 0.90
            add_quad(bm_u, (x_out, y0, z0), (x_in, y0, z0), (x_in, y1, z1), (x_out, y1, z1))

for key, bm in mat_bms.items():
    mat_obj = PAINT if key == 'paint' else ACCENT if key == 'accent' else GLASS if key == 'glass' else TRIM if key == 'trim' else UNDER
    _obj(f'body_{key}', bm, mat_obj)

# --- Riveted Bolt-On Over-Fenders with Visible Rivet Heads ---
# Flares stand out from 1.78 m body (x = +-0.89) to 1.95 m (x = +-0.975)
bm_rivets = bmesh.new()
for axle in (FRONT_AXLE, REAR_AXLE):
    for s in (1, -1):
        rivet_angles = [math.pi * 0.18, math.pi * 0.34, math.pi * 0.50, math.pi * 0.66, math.pi * 0.82]
        R_rivet = 0.405
        for idx, ang in enumerate(rivet_angles):
            rz = axle - R_rivet * math.cos(ang)
            ry = 0.33 + R_rivet * math.sin(ang) * 0.88
            rx = s * 0.975
            rw_sz = 0.009
            p0 = (rx, ry - rw_sz, rz - rw_sz)
            p1 = (rx, ry + rw_sz, rz - rw_sz)
            p2 = (rx, ry + rw_sz, rz + rw_sz)
            p3 = (rx, ry - rw_sz, rz + rw_sz)
            if s > 0:
                add_quad(bm_rivets, p0, p3, p2, p1)
            else:
                add_quad(bm_rivets, p0, p1, p2, p3)

        # Flared arch lip band in accent (black / dark carbon)
        box(f'flare_lip_{axle}_{s}', ACCENT, s * 0.965, 0.33, axle, 0.020, 0.35, 0.80)

_obj('flare_rivets', bm_rivets, CHROME)

# --- Aerodynamic Side Skirts ---
for s in (1, -1):
    box(f'side_skirt_{s}', ACCENT, s * 0.90, 0.19, -0.08, 0.04, 0.04, 2.30)

# --- Deep Front Splitter on Stays, Canards, Grille & Headlamps ---
# Deep front splitter plate reaching exactly z = +2.170
box('front_splitter', ACCENT, 0, 0.140, 2.085, 1.78, 0.025, 0.170)

# Metallic support stays / tie rods connecting splitter to front bumper
for s in (1, -1):
    cylinder(f'splitter_stay_{s}', CHROME, s * 0.36, 0.15, 2.150, 0.008, 0.17, sides=6, axis='y')

# Dual front canards / dive planes per bumper corner in accent
for s in (1, -1):
    # Lower canard
    box(f'canard_lo_{s}', ACCENT, s * 0.840, 0.280, 2.080, 0.16, 0.012, 0.14, yaw=s * 0.25)
    # Upper canard
    box(f'canard_hi_{s}', ACCENT, s * 0.810, 0.440, 2.040, 0.16, 0.012, 0.14, yaw=s * 0.25)

# Front lower air dam and central radiator grille
box('front_air_dam', UNDER, 0, 0.240, 2.110, 1.10, 0.16, 0.030)
box('front_grille', TRIM, 0, 0.480, 2.120, 1.20, 0.14, 0.020)

# Aggressive twin headlights per side (lamp, z in [2.140, 2.155] > 0)
headlamp_x = [0.48, 0.64]
for s in (1, -1):
    for idx, hx in enumerate(headlamp_x):
        cylinder(f'headlight_ring_{s}_{idx}', TRIM, s * hx, 0.58, 2.126, 0.065, 0.022, sides=8, axis='z')
        cylinder(f'headlight_lens_{s}_{idx}', LAMP, s * hx, 0.58, 2.144, 0.055, 0.010, sides=8, axis='z')

# Front license plate
box('plate_front', PLATE, 0, 0.280, 2.166, 0.32, 0.130, 0.004)

# Vented hood scoop / heat extractor
box('hood_vent', UNDER, 0, 0.860, 1.450, 0.48, 0.018, 0.28)

# Aerodynamic door mirrors
for s in (1, -1):
    box(f'mirror_stalk_{s}', TRIM, s * 0.840, 0.920, 0.70, 0.06, 0.03, 0.03)
    box(f'mirror_body_{s}', ACCENT, s * 0.900, 0.910, 0.70, 0.06, 0.08, 0.14)
    box(f'mirror_glass_{s}', GLASS, s * 0.905, 0.910, 0.70, 0.005, 0.07, 0.12)

# --- Rear Deck: Ducktail Spoiler, Swan-Neck Wing, Diffuser, Taillights & Exhaust ---
# Molded rear ducktail spoiler on rear deck lid (z in [-2.15, -2.38])
box('ducktail_spoiler', ACCENT, 0, 0.960, -2.280, 1.36, 0.080, 0.180)

# Big GT Wing on Swan-Neck Mounts above the roof line (top crown y = 1.390 m)
# Swan-neck mounts arching from trunk lid up over the wing blade
for s in (1, -1):
    sx = s * 0.38
    # Lower vertical leg from deck
    cylinder(f'swan_leg_{s}', ACCENT, sx, 0.95, -2.00, 0.016, 0.38, sides=6, axis='y')
    # Upper swan-neck forward-hook arch reaching y = 1.390 m
    cylinder(f'swan_hook_{s}', ACCENT, sx, 1.374, -2.00, 0.016, -0.16, sides=6, axis='z')

# Wide aerodynamic GT wing blade (width 1.70 m, top at 1.370 m)
box('gt_wing_blade', ACCENT, 0, 1.345, -2.140, 1.70, 0.025, 0.220)

# Vertical wing endplates peaking strictly at y = 1.390 m
for s in (1, -1):
    box(f'wing_endplate_{s}', ACCENT, s * 0.850, 1.310, -2.140, 0.012, 0.080, 0.260)

# Finned rear under-diffuser (reaches to -2.420)
box('rear_diffuser_tray', ACCENT, 0, 0.220, -2.220, 1.48, 0.040, 0.360)

# 4 vertical aerodynamic diffuser fins
diffuser_fins_x = [-0.46, -0.15, 0.15, 0.46]
for idx, fx in enumerate(diffuser_fins_x):
    box(f'diffuser_fin_{idx}', ACCENT, fx, 0.180, -2.220, 0.012, 0.100, 0.380)

# Quad large-bore tuner exhaust tips (two per side) to z = -2.430
exhaust_xs = [-0.64, -0.52, 0.52, 0.64]
for ex in exhaust_xs:
    cylinder(f'exhaust_tip_{ex}', CHROME, ex, 0.260, -2.32, 0.040, -0.106, sides=6, axis='z')
    cylinder(f'exhaust_bore_{ex}', UNDER, ex, 0.260, -2.426, 0.032, -0.004, sides=6, axis='z')

# Rear taillights (round twin tuner lenses per side: tail, z in [-2.420, -2.408] < 0)
taillamp_x = [0.46, 0.62]
for s in (1, -1):
    for idx, tx in enumerate(taillamp_x):
        cylinder(f'taillight_ring_{s}_{idx}', TRIM, s * tx, 0.74, -2.396, 0.065, -0.018, sides=8, axis='z')
        cylinder(f'taillight_lens_{s}_{idx}', TAIL, s * tx, 0.74, -2.410, 0.055, -0.010, sides=8, axis='z')

# Rear license plate tub and plate
box('rear_plate_tub', TRIM, 0, 0.680, -2.404, 0.34, 0.150, 0.014)
box('plate_rear', PLATE, 0, 0.680, -2.424, 0.30, 0.130, 0.004)

# --- Four Wheels for Viewer with Deep-Dish Rims (named wheel-*) ---
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
result = 'rv_wide built'
