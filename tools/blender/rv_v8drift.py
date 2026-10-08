"""
Halden Drifter (rv_v8drift / rv-v8drift): Big V8 four-door sedan built for drifting.
In the spirit of the Mark II / Chaser JZX100 or Holden Commodore / Falcon:
- Long muscular hood (a third of total length) with power bulge
- Set-back low greenhouse with raked glass and visible B/C pillars
- Short rear deck ending in an aggressive integrated ducktail spoiler lip
- Wide low stance with muscular fender flares (1.92 m wide), deep front lip, side skirts
- Quad exhaust tips (two on each side, chrome with dark bores) under rear bumper
- Slim wide headlights (lamp, z > 0) and full-width tail lamp band (tail, z < 0)
- Four viewer wheels (wheel-*, radius 0.34 m at x = +-0.80)
Run after kit.py.

Dimensions (from G5 specification table):
- Length: 4.78 m (nose z = +2.25, tail z = -2.53)
- Width: 1.92 m (fender flares x = +-0.96, mirrors to +-1.02)
- Height: 1.39 m (roof apex y = 1.390, ducktail y = 1.05, hood ~0.94, nose ~0.74)
- Axles: front z = +1.30, rear z = -1.42 (wheelbase 2.72 m)
- Wheels: radius 0.34 m, width 0.24 m, centers at x = +-0.80, y = 0.34, z = +1.30 and -1.42
- Body budget: at most 1,800 triangles (everything except wheels)
"""

clear()

import bmesh
import math
from mathutils import Vector

# Fixed car dimensions
LENGTH = 4.78
WIDTH = 1.92
TOTAL_HEIGHT = 1.390
ROOF_HEIGHT = 1.390
FRONT_AXLE = 1.30
REAR_AXLE = -1.42
WHEEL_RADIUS = 0.34
WHEEL_WIDTH = 0.24
WHEEL_X = 0.80

# Materials
PAINT = mat('paint', 0x8a1820)       # Deep Crimson / Maroon (game repaints per car)
ACCENT = mat('accent', 0x141416)     # Dark aerodynamic accents / ducktail lip / grilles
GLASS = mat('glass', 0x1a2430)       # Automotive glass
TRIM = mat('trim', 0x1c1c1e)         # Bumper lips, window trim, mirrors, splitter
UNDER = mat('under', 0x0c0c0c)       # Floor underside, wheel wells, exhaust bores
CHROME = mat('chrome', 0x9aa0a8)     # Quad exhaust tips, badges
LAMP = mat('lamp', 0xffffff, emissive=True)   # Front headlights (z > 0)
TAIL = mat('tail', 0xd01818, emissive=True)   # Rear full-width taillight band (z < 0)
PLATE = mat('plate', 0xe8e6d8)       # License plate
TIRE = mat('tire', 0x151515)         # Viewer wheel tire
RIM = mat('rim', 0x222428)           # Viewer wheel rim (dark gunmetal drift rim)

# Z stations along the car body hull from z = -2.49 to z = +2.21
# Front bumper and front lip reach exactly +2.250; rear bumper and exhaust reach -2.530.
Z_STATIONS = [
    -2.49, -2.42, -2.32, -2.18, -2.00,
    -1.82, -1.68, -1.54, -1.42, -1.30,
    -1.15, -0.85, -0.55, -0.25, 0.05,
    0.35, 0.65, 0.95, 1.15, 1.30,
    1.45, 1.65, 1.85, 2.05, 2.21
]

def get_profile(z):
    # Big V8 Drift Sedan Plan View:
    # Nose bumper (z=2.25): tapered to ~1.62m (w=0.81)
    # Front axle (z=1.30): wide flared arches to 1.92m (w=0.96)
    # Doors / waist (z=-0.55 to 0.35): pulled in to ~1.82m (w=0.91)
    # Rear axle (z=-1.42): muscular wide hips to 1.92m (w=0.96)
    # Tail bumper (z=-2.53): tapered to ~1.70m (w=0.85)
    if z > FRONT_AXLE:
        t = (z - FRONT_AXLE) / (2.21 - FRONT_AXLE)
        w_body = 0.960 - 0.150 * (t ** 1.20)
    elif z > 0.35:
        t = (z - 0.35) / (FRONT_AXLE - 0.35)
        w_body = 0.910 + 0.050 * math.sin(t * math.pi / 2)
    elif z > -0.65:
        # Waist / doors
        w_body = 0.910
    elif z > REAR_AXLE:
        t = (z - REAR_AXLE) / (-0.65 - REAR_AXLE)
        w_body = 0.960 - 0.050 * math.sin(t * math.pi / 2)
    else:
        t = (REAR_AXLE - z) / (REAR_AXLE - (-2.49))
        w_body = 0.960 - 0.110 * (t ** 1.15)

    # Rocker & wheel arch cutout
    y_rocker = 0.18
    for axle in (FRONT_AXLE, REAR_AXLE):
        off = abs(z - axle)
        R_arch = 0.40
        if off < R_arch:
            arch_lift = 0.34 + math.sqrt(max(0.0, R_arch * R_arch - off * off)) * 0.88
            y_rocker = max(y_rocker, arch_lift)

    # Beltline / Fender line & Center heights:
    # Profile:
    # Long hood: z in [0.65, 2.21] (~1.56m long, ~1/3 of car length!)
    # Sloping gently from cowl (z=0.65, y=0.94) to low wedge nose (z=2.21, y=0.74)
    # Set-back cabin: z in [-1.75, 0.65]
    # Short deck: z in [-2.49, -1.75] with ducktail lip rising at tail
    if z > 0.65:
        # Long sloping hood
        t = (z - 0.65) / (2.21 - 0.65)
        y_fender = 0.940 - 0.200 * (t ** 1.05)
        # Power bulge center height on hood
        y_center = y_fender + 0.012 * math.sin(t * math.pi)
    elif z > -1.15:
        # Cabin waist
        t = (z - (-1.15)) / 1.80
        y_fender = 0.950 + 0.010 * t
        y_center = y_fender
    elif z > -1.75:
        # Rear window to trunk transition
        t = (z - (-1.75)) / 0.60
        y_fender = 0.980 - 0.020 * t
        y_center = y_fender
    else:
        # Short trunk deck with ducktail kick-up at rear
        t = (-1.75 - z) / (2.49 - 1.75)
        y_fender = 0.985 + 0.040 * (t ** 1.3)
        y_center = y_fender

    # Greenhouse (Cockpit / Cabin):
    # Set back low cabin:
    # Windshield from cowl (z=0.65, y=0.94) to roof header (z=0.05, y=1.390)
    # Roof from z=0.05 to z=-1.15 (y=1.390)
    # Fastback raked rear window from roof header (z=-1.15, y=1.390) down to trunk shelf (z=-1.75, y=0.98)
    has_cabin = (-1.75 < z < 0.65)
    if has_cabin:
        if z > 0.05:
            # Windshield
            t = (z - 0.05) / (0.65 - 0.05)
            y_roof = 1.390 - 0.450 * (t ** 1.05)
            w_roof = 0.660 - 0.030 * t
        elif z > -1.15:
            # Flat low roof
            t = (z - (-0.55)) / 0.60
            y_roof = 1.390 - 0.004 * (t ** 2)
            w_roof = 0.660
        else:
            # Raked rear window
            t = (-1.15 - z) / (1.75 - 1.15)
            y_roof = 1.385 - 0.405 * (t ** 1.08)
            w_roof = 0.660 - 0.045 * t
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
        if 0.05 <= zm <= 0.65:
            return 'glass'   # Windshield
        elif -1.75 <= zm <= -1.15:
            return 'glass'   # Raked rear window
        elif -1.15 < zm < 0.05:
            return 'paint'   # Roof panel
        else:
            return 'paint'   # Hood or short trunk deck
    # Side upper surfaces (pillars and side windows)
    elif k in (4, 5, 12, 13):
        if -1.10 <= zm <= 0.05:
            # B-pillar at z in [-0.60, -0.45]
            if -0.60 <= zm <= -0.45:
                return 'trim'    # Visible black B-pillar
            else:
                return 'glass'   # 4-door side windows
        elif -1.70 <= zm < -1.10:
            return 'paint'       # Muscular C-pillar
        elif 0.05 < zm <= 0.25:
            return 'paint'       # A-pillar
        else:
            return 'paint'       # Fenders / rear quarters
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

# Cap front at z = 2.21 and rear at z = -2.49 cleanly with outward normals
cap_ring_fan(mat_bms['paint'], rings[-1]['pts'], 2.21, is_front=True)
cap_ring_fan(mat_bms['paint'], rings[0]['pts'], -2.49, is_front=False)

# Inner wheel arch liners
bm_u = mat_bms['under']
for axle in (FRONT_AXLE, REAR_AXLE):
    xs_list = (WHEEL_X, -WHEEL_X)
    for xs in xs_list:
        arch_steps = 6
        R_arch = 0.40
        for i in range(arch_steps):
            a0 = math.pi * i / arch_steps
            a1 = math.pi * (i + 1) / arch_steps
            z0 = axle - R_arch * math.cos(a0)
            z1 = axle - R_arch * math.cos(a1)
            y0 = 0.34 + R_arch * math.sin(a0) * 0.88
            y1 = 0.34 + R_arch * math.sin(a1) * 0.88
            x_out = xs * 1.12
            x_in = xs * 0.88
            add_quad(bm_u, (x_out, y0, z0), (x_in, y0, z0), (x_in, y1, z1), (x_out, y1, z1))

for key, bm in mat_bms.items():
    mat_obj = PAINT if key == 'paint' else ACCENT if key == 'accent' else GLASS if key == 'glass' else TRIM if key == 'trim' else UNDER
    _obj(f'body_{key}', bm, mat_obj)

# --- Muscular Hood Power Bulge (V8 Induction Bulge) ---
box('power_bulge', PAINT, 0, 0.900, 1.45, 0.46, 0.034, 1.20)
# Dark cowl heat extractor vent at rear of hood bulge
box('hood_cowl_vent', UNDER, 0, 0.932, 0.82, 0.40, 0.014, 0.06)

# --- 4-Door Sedan Flank Cut Lines, Skirts & Door Handles ---
for s in (1, -1):
    # Front door front cut line
    box(f'door_seam_f_{s}', TRIM, s * 0.912, 0.55, 0.35, 0.006, 0.65, 0.012)
    # B-pillar / door divider seam
    box(f'door_seam_mid_{s}', TRIM, s * 0.912, 0.55, -0.52, 0.006, 0.65, 0.012)
    # Rear door back cut line
    box(f'door_seam_r_{s}', TRIM, s * 0.912, 0.58, -1.20, 0.006, 0.65, 0.012)
    # Door handles
    box(f'handle_f_{s}', TRIM, s * 0.916, 0.90, -0.05, 0.014, 0.03, 0.10)
    box(f'handle_r_{s}', TRIM, s * 0.916, 0.90, -0.85, 0.014, 0.03, 0.10)

    # Wide sports side skirts
    box(f'skirt_{s}', ACCENT, s * 0.915, 0.17, -0.06, 0.045, 0.045, 2.20)

# --- Integrated Ducktail Lip Spoiler on Short Rear Deck ---
# Sits at z ~ -2.48, kicking up to y = 1.050 m
box('ducktail_lip', ACCENT, 0, 1.025, -2.480, 1.28, 0.032, 0.08)

# --- Front Nose Bumper, Deep Chin Lip, Sports Grille & Headlights ---
box('front_bumper_base', PAINT, 0, 0.28, 2.228, 1.56, 0.36, 0.036)
box('front_bumper_center', PAINT, 0, 0.32, 2.238, 1.00, 0.28, 0.022)

# Deep aggressive front drift chin lip splitter in trim
box('front_chin_lip', TRIM, 0, 0.18, 2.230, 1.62, 0.045, 0.036)

# Front license plate at z = 2.248 (max z = 2.250)
box('plate_front', PLATE, 0, 0.40, 2.248, 0.32, 0.14, 0.004)

# Slim wide headlights (z > 0, chrome housing + emissive lamp)
for s in (1, -1):
    box(f'headlight_housing_{s}', TRIM, s * 0.62, 0.72, 2.220, 0.32, 0.10, 0.016)
    box(f'headlight_lens_{s}', LAMP, s * 0.61, 0.725, 2.234, 0.26, 0.085, 0.012)
    box(f'turn_lens_{s}', TRIM, s * 0.76, 0.725, 2.228, 0.04, 0.085, 0.012)

# Sports grille with dark mesh
box('grille_frame', TRIM, 0, 0.72, 2.220, 0.52, 0.10, 0.016)
box('grille_mesh', UNDER, 0, 0.72, 2.218, 0.48, 0.08, 0.010)

# Wide lower bumper air dam
box('lower_airdam', UNDER, 0, 0.34, 2.222, 0.88, 0.16, 0.020)
box('intercooler_mesh', CHROME, 0, 0.34, 2.224, 0.78, 0.12, 0.008)

# --- Side Mirrors ---
for s in (1, -1):
    box(f'mirror_stalk_{s}', TRIM, s * 0.88, 0.94, 0.52, 0.03, 0.03, 0.03)
    box(f'mirror_body_{s}', PAINT, s * 0.965, 0.95, 0.52, 0.08, 0.06, 0.10)
    box(f'mirror_glass_{s}', GLASS, s * 0.965, 0.955, 0.47, 0.065, 0.045, 0.004)

# --- Rear Fascia: Bumper, Diffuser & Full-Width Taillight Band ---
box('rear_bumper_base', PAINT, 0, 0.28, -2.510, 1.62, 0.36, 0.038)
box('rear_bumper_center', PAINT, 0, 0.32, -2.520, 1.04, 0.28, 0.020)

# Rear license plate in tub at z = -2.526
box('tailgate_tub', TRIM, 0, 0.66, -2.505, 0.38, 0.16, 0.016)
box('plate_rear', PLATE, 0, 0.66, -2.526, 0.32, 0.14, 0.004)

# Full-width tail lamp band across the tail (strictly z < 0)
# Dark trim backplate housing across the entire tail width
box('taillight_bar_housing', TRIM, 0, 0.84, -2.502, 1.48, 0.13, 0.016)
# Left and right wide red emissive tail lenses joined across the center
for s in (1, -1):
    box(f'taillight_lens_{s}', TAIL, s * 0.52, 0.845, -2.516, 0.42, 0.11, 0.010)
    box(f'taillight_rev_{s}', CHROME, s * 0.27, 0.845, -2.516, 0.06, 0.11, 0.010)
# Center connecting red reflector strip
box('taillight_center_strip', TAIL, 0, 0.875, -2.516, 0.46, 0.04, 0.010)

# Rear lower bumper diffuser with dual exhaust tunnel recesses
box('rear_diffuser', TRIM, 0, 0.22, -2.500, 1.30, 0.06, 0.016)

# Quad exhaust tips: two on the left (x = -0.58, -0.68) and two on the right (x = 0.58, 0.68)
# Ending at strictly z = -2.530 with dark bores
for s in (1, -1):
    cylinder(f'exhaust_tip_in_{s}', CHROME, s * 0.58, 0.25, -2.40, 0.040, -0.130, sides=8, axis='z')
    cylinder(f'exhaust_bore_in_{s}', UNDER, s * 0.58, 0.25, -2.526, 0.033, -0.004, sides=8, axis='z')

    cylinder(f'exhaust_tip_out_{s}', CHROME, s * 0.68, 0.25, -2.40, 0.040, -0.130, sides=8, axis='z')
    cylinder(f'exhaust_bore_out_{s}', UNDER, s * 0.68, 0.25, -2.526, 0.033, -0.004, sides=8, axis='z')

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
result = 'rv_v8drift built'
