"""
Kagero Lancer-X (rv_boxer / rv-boxer): Four-door rally sedan in the Evo / Impreza spirit.
Three-box sedan: distinct hood, 4-door cabin (visible B & C pillars, door lines), and trunk.
Features:
- Hood scoop and two dark hood vent slots
- Tall rally rear wing on two uprights over trunk (blade clearance >= 0.12 m over lid)
- Box-flared arches front and rear (wider than doors)
- Rally mud flaps behind all four wheels
- Aggressive front bumper with large mesh air dam intake, splitter, and fog lamps
- Lamps: front headlights (z > 0), rear taillights (z < 0), both standing proud
- 4-door side profile with B-pillar, C-pillar, and door seams
- Single large rally chrome cannon exhaust
Run after kit.py.

Dimensions (from G5 specification table):
- Length: 4.50 m (nose z = +2.05, tail z = -2.45)
- Width: 1.77 m (box flares x = +-0.885, mirrors to +-0.95)
- Height: 1.45 m (wing apex y = 1.450, roof y = 1.385, hood ~0.90, trunk ~0.98)
- Axles: front z = +1.15, rear z = -1.48 (wheelbase 2.63 m)
- Wheels: radius 0.32 m, width 0.22 m, centers at x = +-0.76, y = 0.32, z = +1.15 and -1.48
- Body budget: at most 1,800 triangles (everything except wheels)
"""

clear()

import bmesh
import math
from mathutils import Vector

# Fixed car dimensions
LENGTH = 4.50
WIDTH = 1.77
TOTAL_HEIGHT = 1.450
ROOF_HEIGHT = 1.385
FRONT_AXLE = 1.15
REAR_AXLE = -1.48
WHEEL_RADIUS = 0.32
WHEEL_WIDTH = 0.22
WHEEL_X = 0.76

# Materials
PAINT = mat('paint', 0x1848b0)       # Rally Blue (game repaints per car)
ACCENT = mat('accent', 0x141416)     # Dark aerodynamic accents / wing / vents
GLASS = mat('glass', 0x1a2430)       # Automotive glass
TRIM = mat('trim', 0x1c1c1e)         # Grille mesh, bumper trim, mirrors, splitter, flaps
UNDER = mat('under', 0x0c0c0c)       # Floor underside, wheel wells, intakes, vent slots
CHROME = mat('chrome', 0x9aa0a8)     # Exhaust tip, badges, light trim
LAMP = mat('lamp', 0xffffff, emissive=True)   # Front headlights & fog lamps (z > 0)
TAIL = mat('tail', 0xd01818, emissive=True)   # Rear taillights (z < 0)
PLATE = mat('plate', 0xe8e6d8)       # License plate
TIRE = mat('tire', 0x151515)         # Viewer wheel tire
RIM = mat('rim', 0xd8b030)           # Viewer wheel rim (gold rally rim)

# Z stations along the car body hull from z = -2.41 to z = +2.01
# Front bumper and nose details reach exactly +2.050; rear bumper and exhaust reach -2.450.
Z_STATIONS = [
    -2.41, -2.35, -2.25, -2.10, -1.90,
    -1.70, -1.58, -1.48, -1.38, -1.20,
    -0.95, -0.65, -0.35, -0.05, 0.25,
    0.55, 0.75, 0.95, 1.05, 1.15,
    1.25, 1.45, 1.70, 1.90, 2.01
]

def get_profile(z):
    # Rally sedan plan view with box flares:
    # Nose bumper (z=2.05): tapered to ~1.50m (w=0.75)
    # Front box flares (z=1.15): wide square blister arches to 1.77m (w=0.885)
    # Doors / waist (z=-0.05 to 0.55): pulled in to ~1.68m (w=0.84)
    # Rear box flares (z=-1.48): wide square blister arches to 1.77m (w=0.885)
    # Tail bumper (z=-2.45): tapered to ~1.56m (w=0.78)
    if z > FRONT_AXLE:
        t = (z - FRONT_AXLE) / (2.01 - FRONT_AXLE)
        # Box flare holds width forward then tapers into bumper
        w_body = 0.885 - 0.135 * (t ** 1.25)
    elif z > 0.35:
        # Front flare transition to door
        t = (z - 0.35) / (FRONT_AXLE - 0.35)
        w_body = 0.840 + 0.045 * math.sin(t * math.pi / 2)
    elif z > -0.75:
        # Doors / waist
        w_body = 0.840
    elif z > REAR_AXLE:
        # Rear door transition to rear box flare
        t = (z - REAR_AXLE) / (-0.75 - REAR_AXLE)
        w_body = 0.885 - 0.045 * math.sin(t * math.pi / 2)
    else:
        # Rear box flare to rear bumper taper
        t = (REAR_AXLE - z) / (REAR_AXLE - (-2.41))
        w_body = 0.885 - 0.105 * (t ** 1.20)

    # Rocker & wheel arch cutout
    y_rocker = 0.20
    for axle in (FRONT_AXLE, REAR_AXLE):
        off = abs(z - axle)
        R_arch = 0.38
        if off < R_arch:
            arch_lift = 0.32 + math.sqrt(max(0.0, R_arch * R_arch - off * off)) * 0.88
            y_rocker = max(y_rocker, arch_lift)

    # Beltline / Fender line & Center heights:
    # Three-box sedan profile:
    # 1. Hood: z in [0.95, 2.01], sloping down from cowl (y=0.90) to nose (y=0.70)
    # 2. Cabin beltline: z in [-0.95, 0.95], y ~ 0.90
    # 3. Trunk deck: z in [-2.41, -0.95], trunk lid sits high at y ~ 0.98, tapering slightly at tail lip (y=0.95)
    if z > 0.95:
        # Hood
        t = (z - 0.95) / (2.01 - 0.95)
        y_fender = 0.900 - 0.200 * (t ** 1.08)
        y_center = y_fender - 0.018 * math.sin(t * math.pi)
    elif z > -0.95:
        # Cabin waist / beltline
        t = (z - (-0.95)) / 1.90
        y_fender = 0.910 + 0.010 * t
        y_center = y_fender
    elif z > -1.50:
        # Rear window to trunk transition
        t = (z - (-1.50)) / 0.55
        y_fender = 0.950 - 0.035 * t
        y_center = y_fender
    else:
        # Distinct high three-box trunk deck
        t = (-1.50 - z) / (2.41 - 1.50)
        y_fender = 0.975 - 0.025 * (t ** 1.1)
        y_center = y_fender

    # Greenhouse (Cockpit / Cabin):
    # Raked windshield from cowl (z=0.95, y=0.90) to roof header (z=0.35, y=1.385)
    # Roof from z=0.35 to z=-0.95 (y=1.385)
    # Raked rear window from roof header (z=-0.95, y=1.385) down to trunk shelf (z=-1.50, y=0.97)
    has_cabin = (-1.50 < z < 0.95)
    if has_cabin:
        if z > 0.35:
            # Windshield
            t = (z - 0.35) / (0.95 - 0.35)
            y_roof = 1.385 - 0.485 * (t ** 1.05)
            w_roof = 0.660 - 0.030 * t
        elif z > -0.95:
            # Roof panel
            t = (z - (-0.30)) / 0.65
            y_roof = 1.385 - 0.005 * (t ** 2)
            w_roof = 0.660
        else:
            # Rear window
            t = (-0.95 - z) / (1.50 - 0.95)
            y_roof = 1.380 - 0.410 * (t ** 1.05)
            w_roof = 0.660 - 0.040 * t
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
        if 0.35 <= zm <= 0.95:
            return 'glass'   # Windshield
        elif -1.50 <= zm <= -0.95:
            return 'glass'   # Rear window
        elif -0.95 < zm < 0.35:
            return 'paint'   # Roof panel
        else:
            return 'paint'   # Hood or trunk deck
    # Side upper surfaces (pillars and side windows)
    elif k in (4, 5, 12, 13):
        # 4-door sedan greenhouse side
        if -0.90 <= zm <= 0.35:
            # B-pillar at z in [-0.40, -0.25]
            if -0.40 <= zm <= -0.25:
                return 'trim'    # Visible black B-pillar
            else:
                return 'glass'   # Front / rear door side glass
        elif -1.45 <= zm < -0.90:
            return 'paint'       # Solid C-pillar
        elif 0.35 < zm <= 0.55:
            return 'paint'       # Solid A-pillar
        else:
            return 'paint'       # Fenders / rear quarter panels
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

# Cap front at z = 2.01 and rear at z = -2.41 cleanly with outward normals
cap_ring_fan(mat_bms['paint'], rings[-1]['pts'], 2.01, is_front=True)
cap_ring_fan(mat_bms['paint'], rings[0]['pts'], -2.41, is_front=False)

# Inner wheel arch liners
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

# --- 4-Door Sedan Cut Lines & B/C Pillars ---
# Subtle door seam lines cut into the flanks
for s in (1, -1):
    # Front door front cut line (fender seam)
    box(f'door_seam_f_{s}', TRIM, s * 0.842, 0.55, 0.60, 0.006, 0.65, 0.012)
    # B-pillar / door divider seam
    box(f'door_seam_mid_{s}', TRIM, s * 0.842, 0.55, -0.32, 0.006, 0.65, 0.012)
    # Rear door back cut line
    box(f'door_seam_r_{s}', TRIM, s * 0.842, 0.58, -1.05, 0.006, 0.65, 0.012)
    # Door handles
    box(f'handle_f_{s}', TRIM, s * 0.846, 0.86, 0.15, 0.014, 0.03, 0.10)
    box(f'handle_r_{s}', TRIM, s * 0.846, 0.86, -0.65, 0.014, 0.03, 0.10)

# --- Hood Scoop and Dark Hood Vents ---
# Hood scoop (raised intake box / wedge centered on the hood at z ~ 1.48 to 1.72)
box('scoop_body', PAINT, 0, 0.900, 1.58, 0.38, 0.055, 0.28)
box('scoop_opening', UNDER, 0, 0.895, 1.722, 0.32, 0.035, 0.010)
# Two dark hood vent slots flanking the scoop
box('vent_slot_l', UNDER, 0.34, 0.865, 1.50, 0.14, 0.014, 0.22)
box('vent_slot_r', UNDER, -0.34, 0.865, 1.50, 0.14, 0.014, 0.22)
box('vent_grill_l', TRIM, 0.34, 0.868, 1.50, 0.12, 0.010, 0.20)
box('vent_grill_r', TRIM, -0.34, 0.868, 1.50, 0.12, 0.010, 0.20)

# --- Tall Rally Rear Wing on Two Uprights over Trunk ---
# Trunk lid sits at y ~ 0.97. Wing blade sits at y = 1.420 (clear of trunk by 0.44 m > 0.12 m).
# Apex height is exactly 1.450 m!
box('wing_blade', PAINT, 0, 1.420, -2.25, 1.28, 0.026, 0.26)
box('wing_gurney', ACCENT, 0, 1.446, -2.37, 1.24, 0.004, 0.024)
for s in (1, -1):
    # Uprights rising from trunk lid (y=0.97) to wing blade (y=1.42)
    box(f'wing_strut_{s}', ACCENT, s * 0.46, 0.975, -2.22, 0.032, 0.445, 0.16)
    # Aerodynamic endplates
    box(f'wing_endplate_{s}', PAINT, s * 0.64, 1.340, -2.25, 0.024, 0.110, 0.32)

# --- Front Nose Bumper, Big Mesh Air Dam, Splitter & Lamps ---
box('front_bumper_base', PAINT, 0, 0.27, 2.028, 1.44, 0.35, 0.036)
box('front_bumper_center', PAINT, 0, 0.32, 2.038, 0.90, 0.28, 0.022)

# Front license plate at z = 2.048 (max z = 2.050)
box('plate_front', PLATE, 0, 0.38, 2.048, 0.32, 0.14, 0.004)

# Angular rally headlights (z > 0, chrome reflector + emissive lamp)
for s in (1, -1):
    box(f'headlight_housing_{s}', TRIM, s * 0.58, 0.70, 2.020, 0.30, 0.13, 0.016)
    box(f'headlight_lens_{s}', LAMP, s * 0.57, 0.705, 2.032, 0.24, 0.11, 0.012)
    box(f'turn_lens_{s}', TRIM, s * 0.71, 0.705, 2.026, 0.04, 0.11, 0.012)

# Large circular rally fog lamps set into front bumper
for s in (1, -1):
    cylinder(f'fog_bezel_{s}', TRIM, s * 0.36, 0.40, 2.024, 0.09, 0.018, sides=8, axis='z')
    cylinder(f'fog_lens_{s}', LAMP, s * 0.36, 0.40, 2.038, 0.08, 0.010, sides=8, axis='z')

# Central sports grille with Kagero mesh
box('grille_frame', TRIM, 0, 0.70, 2.020, 0.46, 0.11, 0.016)
box('grille_mesh', UNDER, 0, 0.70, 2.018, 0.42, 0.09, 0.010)

# Big front lower air dam intake with intercooler mesh
box('lower_airdam', UNDER, 0, 0.34, 2.022, 0.72, 0.16, 0.020)
box('intercooler_mesh', CHROME, 0, 0.34, 2.024, 0.60, 0.12, 0.008)

# Rally front chin spoiler splitter lip
box('front_splitter', TRIM, 0, 0.20, 2.020, 1.48, 0.035, 0.024)

# --- Side Mirrors, Skirts & Rally Mud Flaps ---
for s in (1, -1):
    box(f'mirror_stalk_{s}', TRIM, s * 0.81, 0.92, 0.82, 0.03, 0.03, 0.03)
    box(f'mirror_body_{s}', PAINT, s * 0.895, 0.93, 0.82, 0.08, 0.06, 0.10)
    box(f'mirror_glass_{s}', GLASS, s * 0.895, 0.935, 0.77, 0.065, 0.045, 0.004)
    box(f'skirt_{s}', TRIM, s * 0.84, 0.19, -0.16, 0.03, 0.04, 1.90)

    # Rally mud flaps behind wheels:
    # Front mud flaps behind front arch (z ~ 0.72)
    box(f'mudflap_f_{s}', TRIM, s * 0.81, 0.22, 0.72, 0.04, 0.18, 0.010)
    # Rear mud flaps behind rear arch (z ~ -1.90)
    box(f'mudflap_r_{s}', TRIM, s * 0.82, 0.22, -1.90, 0.04, 0.18, 0.010)

# --- Rear Fascia: Bumper, Block Taillights & Sports Exhaust ---
box('rear_bumper_base', PAINT, 0, 0.28, -2.430, 1.50, 0.35, 0.038)
box('rear_bumper_center', PAINT, 0, 0.32, -2.440, 0.96, 0.28, 0.020)

# Rear license plate at z = -2.446
box('tailgate_tub', TRIM, 0, 0.66, -2.420, 0.38, 0.17, 0.016)
box('plate_rear', PLATE, 0, 0.66, -2.446, 0.32, 0.14, 0.004)

# Block taillight clusters flanking trunk (strictly z < 0)
for s in (1, -1):
    box(f'taillight_housing_{s}', TRIM, s * 0.62, 0.82, -2.420, 0.28, 0.14, 0.016)
    box(f'taillight_lens_{s}', TAIL, s * 0.63, 0.825, -2.432, 0.20, 0.12, 0.010)
    box(f'taillight_rev_{s}', CHROME, s * 0.51, 0.825, -2.432, 0.04, 0.12, 0.010)

# Rear lower bumper diffuser / skid plate
box('rear_diffuser', TRIM, 0, 0.23, -2.420, 1.15, 0.06, 0.016)

# Single large rally chrome cannon exhaust on left side (x = -0.50) ending at strictly z = -2.450
cylinder('exhaust_tip', CHROME, -0.50, 0.27, -2.31, 0.052, -0.140, sides=10, axis='z')
cylinder('exhaust_bore', UNDER, -0.50, 0.27, -2.446, 0.044, -0.004, sides=10, axis='z')

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
result = 'rv_boxer built'
