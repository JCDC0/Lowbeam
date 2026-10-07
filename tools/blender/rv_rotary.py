"""
Mazuma RX-Coupe (rv-rotary): 90s Japanese twin-rotor sports coupe in the spirit of the FD RX-7.
Low, wide and curvy, sloping nose with raised pop-up headlights, Coke-bottle waist, wide rear hips,
bubble rear window, ducktail spoiler in body paint, round tail lamps, and four wheels for the viewer.
Run after kit.py.

Dimensions:
- Origin: Ground at center of gravity (0, 0, 0)
- Front axle: z = +1.15, rear axle: z = -1.28
- Front faces +z, left is +x
- Length: 4.28 m (nose z = +2.03, tail z = -2.25)
- Width: 1.76 m (x from -0.88 to +0.88, mirrors to 0.975)
- Plan widths: nose ~1.50 m at lamps, doors ~1.61 m, hips 1.76 m, tail ~1.60 m, roof ~1.30 m
- Height: roof y = 1.215 (at most 1.22), hood ~0.74 dipped, nose ~0.54, deck ~0.85 to 0.90 ducktail
- Wheels: radius 0.31, width 0.22, centers at x = +-0.74, y = 0.31, z = +1.15 and -1.28
"""

clear()

import bmesh
import math
from mathutils import Vector

# Fixed car dimensions
LENGTH = 4.28
WIDTH = 1.76
ROOF_HEIGHT = 1.215
HOOD_HEIGHT = 0.74
NOSE_HEIGHT = 0.54
DECK_HEIGHT = 0.85
FRONT_AXLE = 1.15
REAR_AXLE = -1.28
WHEEL_RADIUS = 0.31
WHEEL_WIDTH = 0.22
TRACK = 1.48

# Materials
PAINT = mat('paint', 0xc8102e)
ACCENT = mat('accent', 0x141414)
GLASS = mat('glass', 0x1a2430)
TRIM = mat('trim', 0x1c1c1e)
UNDER = mat('under', 0x0c0c0c)
CHROME = mat('chrome', 0x9aa0a8)
LAMP = mat('lamp', 0xffffff, emissive=True)
TAIL = mat('tail', 0xd01818, emissive=True)
PLATE = mat('plate', 0xe8e6d8)
TIRE = mat('tire', 0x151515)
RIM = mat('rim', 0xb8bcc4)

# Z stations along the car from ducktail lip (-2.25) to nose (+2.03)
Z_STATIONS = [
    -2.25, -2.22, -2.15, -2.00, -1.82,
    -1.70, -1.58, -1.48, -1.38, -1.28, -1.18, -1.08, -0.95, -0.85,
    -0.65, -0.45, -0.20, -0.05, 0.15, 0.35, 0.50, 0.68,
    0.78, 0.88, 0.98, 1.07, 1.15, 1.23, 1.32, 1.45, 1.60,
    1.70, 1.82, 1.95, 2.03
]

def get_profile(z):
    # Authentic FD plan view: nose ~1.50m at lamps (z=1.70), front axle ~1.71m (z=1.15),
    # doors waist ~1.61m (z=0.0), rear hips 1.76m (z=-1.28), tail ~1.60m (z=-2.25)
    if z > 1.15:
        t = (z - 1.15) / (2.03 - 1.15)
        # At z = 1.70: t = 0.625 -> w_body = 0.750 (width 1.50 m at lamps)
        w_body = 0.855 - 0.180 * (t ** 1.15)
    elif z > 0.0:
        # Waist to front axle
        t = z / 1.15
        w_body = 0.805 + 0.050 * math.sin(t * math.pi / 2)
    elif z > -1.28:
        # Waist to rear axle (wide hips)
        t = (-z) / 1.28
        w_body = 0.805 + 0.075 * math.sin(t * math.pi / 2)
    else:
        # Rear axle to tail
        t = (-1.28 - z) / (2.25 - 1.28)
        # At z = -2.25: w_body = 0.800 (width 1.60 m at tail)
        w_body = 0.880 - 0.080 * (t ** 1.1)

    # Rocker & wheel arch cutout
    y_rocker = 0.20
    for axle in (1.15, -1.28):
        off = abs(z - axle)
        R_arch = 0.38
        if off < R_arch:
            arch_lift = 0.31 + math.sqrt(max(0.0, R_arch * R_arch - off * off))
            y_rocker = max(y_rocker, arch_lift)

    # Fender crest & Hood / Deck
    if z > 0.68:
        t = (z - 0.68) / (2.03 - 0.68)
        y_fender = 0.80 - 0.26 * (t ** 1.15)
        # Dipped hood center (5.5 cm below fender brow)
        y_center = y_fender - 0.055 * math.sin(t * math.pi)
    elif z > -0.20:
        t = (0.68 - z) / 0.88
        y_fender = 0.80 + 0.030 * math.sin(t * math.pi)
        y_center = y_fender
    elif z > -1.55:
        t = (-0.20 - z) / 1.35
        y_fender = 0.83 + 0.030 * math.sin(t * math.pi)
        y_center = y_fender
    else:
        # Rear deck curving into ducktail
        t = (-1.55 - z) / (2.25 - 1.55)
        # Ducktail sweeps up at trailing edge to 0.90 m
        y_fender = 0.85 + 0.050 * (t ** 1.8)
        y_center = y_fender - 0.010

    # Greenhouse (Cabin) - pulled in to ~1.30m at roof
    has_cabin = (-1.55 < z < 0.68)
    if has_cabin:
        if z > 0.15:
            # Windshield flowing continuously from cowl (z=0.68) into roof header (z=0.15)
            t = (z - 0.15) / (0.68 - 0.15)
            y_roof = 1.210 - 0.410 * (t ** 1.1)
            w_roof = 0.65 - 0.03 * t
        elif z > -0.30:
            # Roof peak (apex strictly 1.215 <= 1.22, width 1.30 m)
            t = (z - (-0.05)) / 0.25
            y_roof = 1.215 - 0.005 * (t ** 2)
            w_roof = 0.65
        else:
            # Bubble rear glass down to rear deck (z=-1.55)
            t = (-0.30 - z) / (1.55 - 0.30)
            y_roof = 1.210 - 0.350 * (t ** 1.25)
            w_roof = 0.65 - 0.07 * t
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
            (-w_body * 0.96, y_rocker),
            (-w_body * 0.99, y_rocker + (y_shoulder - y_rocker) * 0.5),
            (-w_shoulder, y_shoulder),
            (-w_body * 0.98, y_shoulder + (y_fender - y_shoulder) * 0.5),
            (-w_body * 0.94, y_fender),
            (-w_roof - 0.05, y_fender + (y_roof - y_fender) * 0.5),
            (-w_roof, y_roof - 0.015),
        ]
        top_pts = []
        for f in (-0.75, -0.38, 0.0, 0.38, 0.75):
            x = f * w_roof
            y = y_roof - 0.015 * (f ** 2)
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
    # 7 points along right flank (rocker to roof edge)
    for i in range(7):
        pts.append({'x': side_r[i][0], 'y': side_r[i][1]})
    # 5 points across crowned top
    for i in range(5):
        pts.append({'x': top_pts[i][0], 'y': top_pts[i][1]})
    # 7 points down left flank (roof edge to rocker)
    for i in range(7):
        pts.append({'x': side_l[i][0], 'y': side_l[i][1]})
    
    return pts

rings = []
for z in Z_STATIONS:
    rings.append({'z': z, 'pts': make_ring_pts(z)})

mat_bms = {
    'paint': bmesh.new(),
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
        # Top surface: hood, windshield, roof, rear glass, rear deck
        if 0.15 <= zm <= 0.68:
            return 'glass' # Windshield
        elif -1.55 <= zm <= -0.30:
            return 'glass' # Rear bubble glass
        else:
            return 'paint' # Hood (zm > 0.68), Roof (-0.30 <= zm <= 0.15), Rear deck (zm < -1.55)
    elif k in (4, 5, 12, 13):
        # Greenhouse sides: side windows or painted pillars/fenders
        if -1.35 <= zm <= 0.25:
            return 'glass' # Side windows
        else:
            return 'paint' # A-pillar, C-pillar, fenders
    else:
        # Lower body and flanks
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
    
    # Underside floor closing strictly at y = 0.20 (never rising into hood)
    bm_u = mat_bms['under']
    pA_r = (A['pts'][0]['x'], 0.20, A['z'])
    pA_l = (A['pts'][18]['x'], 0.20, A['z'])
    pB_r = (B['pts'][0]['x'], 0.20, B['z'])
    pB_l = (B['pts'][18]['x'], 0.20, B['z'])
    add_quad(bm_u, pA_l, pA_r, pB_r, pB_l)

# Front nose cap (z = 2.03)
cx = 0.0
cy = 0.38
c = (cx, cy, 2.03)
front_pts = rings[-1]['pts']
for k in range(18):
    k1 = k + 1
    p = (front_pts[k]['x'], front_pts[k]['y'], 2.03)
    q = (front_pts[k1]['x'], front_pts[k1]['y'], 2.03)
    add_tri(mat_bms['paint'], c, q, p)

# Rear ducktail lip underside transition to tucked fascia:
tail_pts = rings[0]['pts']
for k in range(6, 12):
    p0 = (tail_pts[k]['x'], tail_pts[k]['y'], -2.25)
    p1 = (tail_pts[k + 1]['x'], tail_pts[k + 1]['y'], -2.25)
    q0 = (tail_pts[k]['x'], 0.77, -2.215)
    q1 = (tail_pts[k + 1]['x'], 0.77, -2.215)
    add_quad(mat_bms['paint'], p0, q0, q1, p1)

for k in list(range(0, 6)) + list(range(12, 18)):
    k1 = k + 1
    p0 = (tail_pts[k]['x'], tail_pts[k]['y'], -2.25)
    p1 = (tail_pts[k1]['x'], tail_pts[k1]['y'], -2.25)
    q0 = (tail_pts[k]['x'] * 0.96, tail_pts[k]['y'], -2.215)
    q1 = (tail_pts[k1]['x'] * 0.96, tail_pts[k1]['y'], -2.215)
    add_quad(mat_bms['paint'], p0, q0, q1, p1)

# Inner wheel wells
for axle in (1.15, -1.28):
    bm_u = mat_bms['under']
    top_y = 0.31 + 0.38 + 0.02
    inner_x = 0.60
    for s in (1, -1):
        xs = s * inner_x
        z0 = axle - 0.38
        z1 = axle + 0.38
        if s > 0:
            add_quad(bm_u, (xs, 0.20, z1), (xs, 0.20, z0), (xs, top_y, z0), (xs, top_y, z1))
        else:
            add_quad(bm_u, (xs, 0.20, z0), (xs, 0.20, z1), (xs, top_y, z1), (xs, top_y, z0))

for key, bm in mat_bms.items():
    mat_obj = PAINT if key == 'paint' else GLASS if key == 'glass' else UNDER
    _obj(f'body_{key}', bm, mat_obj)

# --- Pop-up Headlights (raised) ---
for s in (1, -1):
    cx = s * 0.48
    box(f'headlight_pod_{s}', PAINT, cx, 0.68, 1.61, 0.26, 0.11, 0.24, bottom=False)
    box(f'headlight_lens_{s}', LAMP, cx, 0.69, 1.732, 0.22, 0.08, 0.005)
    box(f'headlight_bezel_{s}', TRIM, cx, 0.68, 1.731, 0.24, 0.10, 0.005)

# --- Front Intake & Splitter Lip ---
box('front_intake', UNDER, 0, 0.27, 1.99, 0.70, 0.12, 0.06)
box('front_lip', TRIM, 0, 0.19, 1.96, 1.30, 0.03, 0.12)
box('plate_front', PLATE, 0, 0.32, 2.028, 0.34, 0.10, 0.004)

# --- Side Skirts (tucked under Coke-bottle waist) ---
for s in (1, -1):
    box(f'skirt_{s}', TRIM, s * 0.79, 0.18, -0.075, 0.035, 0.04, 1.45)

# --- Side Mirrors ---
for s in (1, -1):
    box(f'mirror_stalk_{s}', TRIM, s * 0.86, 0.84, 0.52, 0.03, 0.03, 0.03)
    box(f'mirror_body_{s}', PAINT, s * 0.93, 0.85, 0.52, 0.09, 0.06, 0.10)
    box(f'mirror_glass_{s}', GLASS, s * 0.93, 0.855, 0.468, 0.07, 0.045, 0.004)

# --- Rear Tucked Tail Panel & Round Tail Lamps ---
box('tail_panel', TRIM, 0, 0.65, -2.215, 1.44, 0.16, 0.015)

def make_tail_lamp(name, cx, cy, cz, r, depth=0.014):
    bm = bmesh.new()
    sides = 16
    front_vs = []
    back_vs = []
    for i in range(sides):
        a = 2 * math.pi * i / sides
        x = cx + math.sin(a) * r
        y = cy + math.cos(a) * r
        back_vs.append(bm.verts.new(g2b(x, y, cz - depth)))
        front_vs.append(bm.verts.new(g2b(x, y, cz)))
    bm.faces.new(back_vs)
    for i in range(sides):
        j = (i + 1) % sides
        bm.faces.new([back_vs[i], back_vs[j], front_vs[j], front_vs[i]])
    bm.faces.ensure_lookup_table()
    bm.normal_update()
    return _obj(name, bm, TAIL)

for s in (1, -1):
    make_tail_lamp(f'tail_outer_{s}', s * 0.54, 0.70, -2.215, 0.058, depth=0.014)
    make_tail_lamp(f'tail_inner_{s}', s * 0.38, 0.70, -2.215, 0.058, depth=0.014)

box('plate_rear', PLATE, 0, 0.54, -2.220, 0.34, 0.10, 0.005)

# --- Rear Diffuser ---
box('rear_diffuser', TRIM, 0, 0.22, -2.15, 1.20, 0.07, 0.18)
for dx in (-0.42, -0.16, 0.16, 0.42):
    box(f'diffuser_fin_{dx}', TRIM, dx, 0.20, -2.15, 0.02, 0.08, 0.19)

# --- Twin Exhaust Tips (ending strictly at z = -2.25) ---
for s in (1, -1):
    cylinder(f'exhaust_tip_{s}', CHROME, s * 0.28, 0.25, -2.13, 0.045, -0.12, sides=12, axis='z')
    cylinder(f'exhaust_bore_{s}', UNDER, s * 0.28, 0.25, -2.248, 0.038, -0.002, sides=12, axis='z')

# --- Four Wheels for Viewer (named wheel-*) ---
def make_wheel(name, cx, cz):
    bm_tire = bmesh.new()
    bm_rim = bmesh.new()
    cy = 0.31
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
    x_hub = cx + sgn * (rw / 2.0 - 0.055)
    
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

make_wheel('wheel-fl', 0.74, 1.15)
make_wheel('wheel-fr', -0.74, 1.15)
make_wheel('wheel-rl', 0.74, -1.28)
make_wheel('wheel-rr', -0.74, -1.28)

frame_view()
result = 'rv_rotary built'
