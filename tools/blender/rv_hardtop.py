"""
Kenro Hardtop (rv_hardtop / rv-hardtop): 70s two-door pillarless hardtop.
In the spirit of the Nissan Skyline GT-R "Hakosuka" KPGC10, Celica 1600GT, and Laurel:
- Pillarless greenhouse: no B-pillar, continuous side glass from A-pillar to notched C-pillar
- Long hood, notched C-pillar fastback, short rear trunk deck
- Chrome bumpers front and rear standing proud of the body, front chin spoiler
- Bolt-on works over-fenders on all four arches with visible rivet heads
- Round twin headlamps per side set in a dark grille panel (lamp, z > 0)
- Round twin tail lamps per side set in the rear fascia (tail, z < 0)
- Twin chrome exhaust tips under the rear bumper
- Four viewer wheels with deep-dish rims (wheel-*, radius 0.30 m at x = +-0.70)
Run after kit.py.

Dimensions (from G5 specification table):
- Length: 4.40 m (nose z = +1.97, tail z = -2.43)
- Width: 1.66 m (over-fenders x = +-0.83, mirrors to +-0.885)
- Height: 1.41 m (roof apex y = 1.410, hood ~0.86, nose ~0.76, trunk ~0.90)
- Axles: front z = +1.15, rear z = -1.42 (wheelbase 2.57 m)
- Wheels: radius 0.30 m, width 0.22 m, centers at x = +-0.70, y = 0.30, z = +1.15 and -1.42
- Body budget: at most 1,800 triangles (everything except wheels)
"""

clear()

import bmesh
import math
from mathutils import Vector

# Fixed car dimensions
LENGTH = 4.40
WIDTH = 1.66
TOTAL_HEIGHT = 1.410
ROOF_HEIGHT = 1.410
FRONT_AXLE = 1.15
REAR_AXLE = -1.42
WHEEL_RADIUS = 0.30
WHEEL_WIDTH = 0.22
WHEEL_X = 0.70

# Materials
PAINT = mat('paint', 0xc8c8c4)       # Vintage Silver / Metallic (game repaints per car)
ACCENT = mat('accent', 0x18181a)     # Dark over-fenders / chin spoiler / grille
GLASS = mat('glass', 0x1a2430)       # Automotive glass
TRIM = mat('trim', 0x222224)         # Window trim, rubber seals, mirror stalks
UNDER = mat('under', 0x0c0c0c)       # Floor underside, wheel wells, grille mesh
CHROME = mat('chrome', 0xd0d4dc)     # Front/rear chrome bumpers, lamp bezels, exhaust
LAMP = mat('lamp', 0xffffff, emissive=True)   # Twin round headlights (z > 0)
TAIL = mat('tail', 0xd01818, emissive=True)   # Twin round taillights (z < 0)
PLATE = mat('plate', 0xe8e6d8)       # License plate
TIRE = mat('tire', 0x151515)         # Viewer wheel tire
RIM = mat('rim', 0x2a2c30)           # Viewer wheel rim (dark deep-dish Watanabe style rim)

# Z stations along the car body hull from z = -2.39 to z = +1.93
# Front chrome bumper and chin lip reach exactly +1.970; rear chrome bumper reaches -2.430.
Z_STATIONS = [
    -2.39, -2.32, -2.22, -2.08, -1.90,
    -1.70, -1.55, -1.42, -1.30, -1.15,
    -0.95, -0.65, -0.35, -0.05, 0.25,
    0.55, 0.85, 1.05, 1.15, 1.28,
    1.45, 1.62, 1.78, 1.88, 1.93
]

def get_profile(z):
    # 70s Japanese GT Hardtop Plan View:
    # Nose bumper (z=1.97): tapered to ~1.48m (w=0.74)
    # Front axle (z=1.15): over-fenders to 1.66m (w=0.83)
    # Doors / waist (z=-0.65 to 0.55): pulled in to ~1.54m (w=0.77)
    # Rear hips (z=-1.42): muscular over-fenders to 1.66m (w=0.83)
    # Tail bumper (z=-2.43): tapered to ~1.52m (w=0.76)
    if z > FRONT_AXLE:
        t = (z - FRONT_AXLE) / (1.93 - FRONT_AXLE)
        w_body = 0.830 - 0.090 * (t ** 1.15)
    elif z > 0.55:
        t = (z - 0.55) / (FRONT_AXLE - 0.55)
        w_body = 0.770 + 0.060 * math.sin(t * math.pi / 2)
    elif z > -0.65:
        # Waist / doors
        w_body = 0.770
    elif z > REAR_AXLE:
        t = (z - REAR_AXLE) / (-0.65 - REAR_AXLE)
        w_body = 0.830 - 0.060 * math.sin(t * math.pi / 2)
    else:
        t = (REAR_AXLE - z) / (REAR_AXLE - (-2.39))
        w_body = 0.830 - 0.070 * (t ** 1.10)

    # Rocker & wheel arch cutout (axles at +1.15 and -1.42)
    y_rocker = 0.18
    for axle in (FRONT_AXLE, REAR_AXLE):
        off = abs(z - axle)
        R_arch = 0.36
        if off < R_arch:
            arch_lift = 0.30 + math.sqrt(max(0.0, R_arch * R_arch - off * off)) * 0.88
            y_rocker = max(y_rocker, arch_lift)

    # Beltline / Hood / Trunk heights:
    # Long hood: z in [0.25, 1.93] (~1.68m long) sloping from cowl (y=0.86) to nose (y=0.76)
    # Low greenhouse: z in [-1.42, 0.25]
    # Short notched trunk: z in [-2.39, -1.42], deck sitting at y=0.90 to 0.88
    if z > 0.25:
        # Long hood
        t = (z - 0.25) / (1.93 - 0.25)
        y_fender = 0.860 - 0.100 * (t ** 1.05)
        y_center = y_fender - 0.012 * math.sin(t * math.pi)
    elif z > -0.95:
        # Cabin waist
        t = (z - (-0.95)) / 1.20
        y_fender = 0.870 + 0.010 * t
        y_center = y_fender
    elif z > -1.42:
        # Notched C-pillar transition
        t = (z - (-1.42)) / 0.47
        y_fender = 0.895 - 0.025 * t
        y_center = y_fender
    else:
        # Short trunk deck
        t = (-1.42 - z) / (2.39 - 1.42)
        y_fender = 0.900 - 0.020 * t
        y_center = y_fender

    has_cabin = (-1.42 < z < 0.25)
    if has_cabin:
        if z > -0.05:
            # Windshield
            t = (z - (-0.05)) / (0.25 - (-0.05))
            y_roof = 1.410 - 0.540 * (t ** 1.05)
            w_roof = 0.630 - 0.030 * t
        elif z > -0.95:
            # Flat roof
            t = (z - (-0.50)) / 0.45
            y_roof = 1.410 - 0.005 * (t ** 2)
            w_roof = 0.630
        else:
            # Notched fastback-leaning rear glass
            t = (-0.95 - z) / (1.42 - 0.95)
            y_roof = 1.405 - 0.505 * (t ** 1.08)
            w_roof = 0.630 - 0.040 * t
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
            (-w_body * 0.82, y_fender),
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
        if -0.05 <= zm <= 0.25:
            return 'glass'   # Windshield
        elif -1.42 <= zm <= -0.95:
            return 'glass'   # Notched rear window
        elif -0.95 < zm < -0.05:
            return 'paint'   # Roof panel
        else:
            return 'paint'   # Long hood or trunk deck
    # Side upper surfaces (pillars and side windows)
    elif k in (4, 5, 12, 13):
        # PILLARLESS HARDTOP: no B-pillar! One continuous glass opening!
        if -0.95 <= zm <= -0.05:
            return 'glass'   # Continuous pillarless side window
        elif -1.40 <= zm < -0.95:
            return 'paint'   # Classic notched C-pillar
        elif -0.05 < zm <= 0.15:
            return 'paint'   # Slender A-pillar
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

# Cap front at z = 1.93 and rear at z = -2.39 cleanly with outward normals
cap_ring_fan(mat_bms['paint'], rings[-1]['pts'], 1.93, is_front=True)
cap_ring_fan(mat_bms['paint'], rings[0]['pts'], -2.39, is_front=False)

# Inner wheel arch liners (axles at +1.15 and -1.42)
bm_u = mat_bms['under']
for axle in (FRONT_AXLE, REAR_AXLE):
    xs_list = (WHEEL_X, -WHEEL_X)
    for xs in xs_list:
        arch_steps = 6
        R_arch = 0.36
        for i in range(arch_steps):
            a0 = math.pi * i / arch_steps
            a1 = math.pi * (i + 1) / arch_steps
            z0 = axle - R_arch * math.cos(a0)
            z1 = axle - R_arch * math.cos(a1)
            y0 = 0.30 + R_arch * math.sin(a0) * 0.88
            y1 = 0.30 + R_arch * math.sin(a1) * 0.88
            x_out = xs * 1.14
            x_in = xs * 0.90
            add_quad(bm_u, (x_out, y0, z0), (x_in, y0, z0), (x_in, y1, z1), (x_out, y1, z1))

for key, bm in mat_bms.items():
    mat_obj = PAINT if key == 'paint' else ACCENT if key == 'accent' else GLASS if key == 'glass' else TRIM if key == 'trim' else UNDER
    _obj(f'body_{key}', bm, mat_obj)

# --- Bolt-On Over-Fenders with Visible Rivet Heads ---
# Flared over-fender arch lips on all four wheels
bm_rivets = bmesh.new()
for axle in (FRONT_AXLE, REAR_AXLE):
    for s in (1, -1):
        # 5 visible rivet heads per arch as quad studs on the flare
        rivet_angles = [math.pi * 0.20, math.pi * 0.35, math.pi * 0.50, math.pi * 0.65, math.pi * 0.80]
        R_rivet = 0.375
        for idx, ang in enumerate(rivet_angles):
            rz = axle - R_rivet * math.cos(ang)
            ry = 0.30 + R_rivet * math.sin(ang) * 0.88
            rx = s * 0.835
            # Small dark square rivet face
            rw_sz = 0.008
            p0 = (rx, ry - rw_sz, rz - rw_sz)
            p1 = (rx, ry + rw_sz, rz - rw_sz)
            p2 = (rx, ry + rw_sz, rz + rw_sz)
            p3 = (rx, ry - rw_sz, rz + rw_sz)
            if s > 0:
                add_quad(bm_rivets, p0, p3, p2, p1)
            else:
                add_quad(bm_rivets, p0, p1, p2, p3)

        # Over-fender flare arch band
        box(f'flare_band_{axle}_{s}', ACCENT, s * 0.825, 0.30, axle, 0.020, 0.32, 0.72)

_obj('overfender_rivets', bm_rivets, ACCENT)

# --- Front Fascia: Chrome Bumper, Chin Spoiler, Dark Grille & Round Twin Headlamps ---
# Front chrome bumper standing proud at z ~ 1.950 to 1.968
box('front_bumper_chrome', CHROME, 0, 0.44, 1.952, 1.54, 0.08, 0.030)
# Front bumper guards / overriders
for s in (1, -1):
    box(f'bumper_guard_f_{s}', CHROME, s * 0.32, 0.42, 1.956, 0.035, 0.12, 0.022)

# Front chin spoiler under chrome bumper (in accent black)
box('front_chin_spoiler', ACCENT, 0, 0.20, 1.948, 1.52, 0.06, 0.036)

# Front license plate at z = 1.968 (max z = 1.970)
box('plate_front', PLATE, 0, 0.28, 1.968, 0.32, 0.13, 0.004)

# Dark front grille surround & mesh panel
box('grille_surround', CHROME, 0, 0.64, 1.936, 1.44, 0.16, 0.012)
box('grille_mesh', UNDER, 0, 0.64, 1.938, 1.40, 0.14, 0.008)

# Round twin headlamps per side (4 lamps total) with chrome bezels and emissive lamp lenses (z > 0)
headlamp_x = [0.42, 0.58]
for s in (1, -1):
    for idx, hx in enumerate(headlamp_x):
        cylinder(f'headlight_ring_{s}_{idx}', CHROME, s * hx, 0.64, 1.936, 0.070, 0.018, sides=8, axis='z')
        cylinder(f'headlight_lens_{s}_{idx}', LAMP, s * hx, 0.64, 1.950, 0.060, 0.010, sides=8, axis='z')

# Fender mirrors (classic Japanese fender mirrors mounted on front fenders at z ~ 1.35)
for s in (1, -1):
    box(f'fender_stalk_{s}', CHROME, s * 0.72, 0.84, 1.35, 0.02, 0.07, 0.02)
    cylinder(f'fender_mirror_{s}', CHROME, s * 0.72, 0.91, 1.35, 0.045, 0.014, sides=8, axis='z')
    cylinder(f'fender_glass_{s}', GLASS, s * 0.72, 0.91, 1.346, 0.040, 0.004, sides=8, axis='z')

# Door handles
for s in (1, -1):
    box(f'handle_{s}', CHROME, s * 0.774, 0.86, -0.30, 0.012, 0.025, 0.10)

# --- Rear Fascia: Chrome Bumper, Round Twin Taillights & Twin Exhausts ---
# Rear chrome bumper standing proud at z ~ -2.408 to -2.430
box('rear_bumper_chrome', CHROME, 0, 0.46, -2.415, 1.56, 0.08, 0.030)
for s in (1, -1):
    box(f'bumper_guard_r_{s}', CHROME, s * 0.32, 0.44, -2.418, 0.035, 0.12, 0.022)

# Rear license plate at z = -2.426 (tub at -2.405)
box('tailgate_tub', TRIM, 0, 0.64, -2.405, 0.36, 0.16, 0.016)
box('plate_rear', PLATE, 0, 0.64, -2.426, 0.32, 0.14, 0.004)

# Dark rear taillight backplate panel
box('taillight_panel', TRIM, 0, 0.72, -2.400, 1.44, 0.15, 0.014)

# Round twin tail lamps per side (4 lamps total) with chrome bezels and red emissive tail lenses (z < 0)
taillamp_x = [0.42, 0.58]
for s in (1, -1):
    for idx, tx in enumerate(taillamp_x):
        cylinder(f'taillight_ring_{s}_{idx}', CHROME, s * tx, 0.72, -2.398, 0.068, -0.018, sides=8, axis='z')
        cylinder(f'taillight_lens_{s}_{idx}', TAIL, s * tx, 0.72, -2.412, 0.058, -0.010, sides=8, axis='z')

# Twin chrome sports exhaust tips on the right side under rear bumper (x = 0.45, 0.55) extending to z = -2.430
for ex in (0.46, 0.56):
    cylinder(f'exhaust_tip_{ex}', CHROME, ex, 0.26, -2.31, 0.036, -0.120, sides=8, axis='z')
    cylinder(f'exhaust_bore_{ex}', UNDER, ex, 0.26, -2.426, 0.029, -0.004, sides=8, axis='z')

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
    # Deep-dish rim configuration: step in deep to the hub
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
result = 'rv_hardtop built'
