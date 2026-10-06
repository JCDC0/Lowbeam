"""
Mazuma RX-Coupe (rv-rotary): 90s Japanese twin-rotor sports coupe in the spirit of the FD RX-7.
Low, wide and curvy, sloping nose with raised pop-up headlights, smooth flowing waist, bubble
rear window, ducktail spoiler, round tail lamps, and four wheels for the viewer. Run after kit.py.

Dimensions:
- Origin: Ground at center of gravity (0, 0, 0)
- Front axle: z = +1.15, rear axle: z = -1.28
- Front faces +z, left is +x
- Length: 4.28 m (nose z = +2.03, tail z = -2.25)
- Width: 1.76 m (x from -0.88 to +0.88, mirrors to 0.98)
- Height: roof y = 1.22, hood ~0.82, nose ~0.56, deck ~0.86
- Wheels: radius 0.31, width 0.22, centers at x = +-0.74, y = 0.31, z = +1.15 and -1.28
"""

clear()

import bmesh
import math
from mathutils import Vector

# Fixed car dimensions
LENGTH = 4.28
WIDTH = 1.76
ROOF_HEIGHT = 1.22
HOOD_HEIGHT = 0.82
NOSE_HEIGHT = 0.56
DECK_HEIGHT = 0.86
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

# Pure loft mathematics
def monotone(xs, ys):
    n = len(xs)
    if n < 2: return lambda x: ys[0]
    d = [(ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) for i in range(n - 1)]
    m = [0.0] * n
    m[0] = d[0]
    m[n - 1] = d[n - 2]
    for i in range(1, n - 1):
        m[i] = 0.0 if d[i - 1] * d[i] <= 0 else (d[i - 1] + d[i]) / 2.0
    for i in range(n - 1):
        if d[i] == 0:
            m[i] = 0.0
            m[i + 1] = 0.0
            continue
        a = m[i] / d[i]
        b = m[i + 1] / d[i]
        s = a * a + b * b
        if s > 9:
            t = 3.0 / math.sqrt(s)
            m[i] = t * a * d[i]
            m[i + 1] = t * b * d[i]
    def fn(x):
        if x <= xs[0]: return ys[0]
        if x >= xs[n - 1]: return ys[n - 1]
        i = 0
        while x > xs[i + 1]: i += 1
        h = xs[i + 1] - xs[i]
        t = (x - xs[i]) / h
        t2 = t * t
        t3 = t2 * t
        return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]
    return fn

def station_curve(st_list):
    zs = [s[0] for s in st_list]
    fns = [monotone(zs, [s[j] for s in st_list]) for j in range(1, 9)]
    return lambda z: [z] + [f(z) for f in fns]

def arch_station(st, off, wheel_radius, flare):
    out = list(st)
    R = wheel_radius + 0.08
    if abs(off) < R:
        out[1] = max(out[1], wheel_radius + math.sqrt(R * R - off * off))
    if out[3] < out[1] + 0.05: out[3] = out[1] + 0.05
    if out[5] < out[3] + 0.04: out[5] = out[3] + 0.04
    if out[7] < out[5] + 0.01: out[7] = out[5] + 0.01
    f = flare * max(0.0, 1.0 - (off / 0.55) ** 2)
    out[2] += f
    out[4] += f
    return out

def loft_zs(st_list, axles, arch, max_gap):
    lo = st_list[0][0]
    hi = st_list[-1][0]
    arch_z = [a + o for a in axles for o in arch if lo + 0.02 < a + o < hi - 0.02]
    zs = sorted(list(set([s[0] for s in st_list if not any(abs(a - s[0]) < 0.03 for a in arch_z)] + arch_z)))
    out = [zs[0]]
    for i in range(1, len(zs)):
        gap = zs[i] - zs[i - 1]
        n = math.ceil(gap / max_gap - 1e-9)
        for k in range(1, n):
            out.append(zs[i - 1] + (gap * k) / n)
        out.append(zs[i])
    return out

def crown_of(st):
    return 0.045 * min(1.0, max(0.0, st[8]) / 0.75)

def cr(p0, p1, p2, p3):
    return 0.5 * (2 * p1 + 0.5 * (p2 - p0) + 0.25 * (2 * p0 - 5 * p1 + 4 * p2 - p3) + 0.125 * (-p0 + 3 * p1 - 3 * p2 + p3))

def mid(a, b, c, d):
    return [max(0.0, cr(a[0], b[0], c[0], d[0])), cr(a[1], b[1], c[1], d[1])]

BAND_UNDER = 0
BAND_LOWER = 1
BAND_UPPER = 2
BAND_GREEN = 3
BAND_ROOF = 4

def ring_of(st):
    P = [[st[2], st[1]], [st[4], st[3]], [st[6], st[5]], [st[8], st[7]]]
    side = [P[0], mid(P[0], P[0], P[1], P[2]), P[1], mid(P[0], P[1], P[2], P[3]), P[2], mid(P[1], P[2], P[3], P[3]), P[3]]
    side_band = [BAND_LOWER, BAND_LOWER, BAND_UPPER, BAND_UPPER, BAND_GREEN, BAND_GREEN, BAND_ROOF]
    crown = crown_of(st)
    w3 = st[8]
    def roof_at(f): return st[7] + crown * (1.0 - f * f)
    pts = []
    for i in range(7):
        pts.append({'x': -side[i][0], 'y': side[i][1], 'band': side_band[i]})
    for f in [0.75, 0.38, 0.0, -0.38, -0.75]:
        pts.append({'x': 0.0 if f == 0 else -f * w3, 'y': roof_at(f), 'band': BAND_ROOF})
    left_band = [BAND_UNDER, BAND_LOWER, BAND_LOWER, BAND_UPPER, BAND_UPPER, BAND_GREEN, BAND_GREEN]
    for i in range(6, -1, -1):
        pts.append({'x': side[i][0], 'y': side[i][1], 'band': left_band[i]})
    return pts

def inset_ring(pts, d):
    cx = sum(p['x'] for p in pts) / len(pts)
    cy = sum(p['y'] for p in pts) / len(pts)
    out = []
    for p in pts:
        dx = cx - p['x']
        dy = cy - p['y']
        l = math.hypot(dx, dy)
        t = min(1.0, d / l) if l > 1e-6 else 0.0
        out.append({'x': p['x'] + dx * t, 'y': p['y'] + dy * t, 'band': p['band']})
    return out

# Authored cross sections [z, y0, w0, y1, w1, y2, w2, y3, w3]
STATIONS = [
    [-2.25, 0.28, 0.76, 0.52, 0.84, 0.80, 0.83, 0.84, 0.74],
    [-2.18, 0.24, 0.81, 0.58, 0.86, 0.82, 0.86, 0.86, 0.78],
    [-1.75, 0.21, 0.85, 0.60, 0.87, 0.85, 0.87, 0.87, 0.80],
    [-1.45, 0.21, 0.86, 0.62, 0.88, 0.86, 0.87, 0.94, 0.74],
    [-0.85, 0.20, 0.85, 0.62, 0.86, 0.85, 0.86, 1.14, 0.64],
    [-0.20, 0.19, 0.84, 0.61, 0.85, 0.84, 0.84, 1.22, 0.60],
    [ 0.25, 0.19, 0.84, 0.61, 0.85, 0.83, 0.84, 1.20, 0.60],
    [ 0.70, 0.20, 0.85, 0.62, 0.86, 0.81, 0.85, 0.84, 0.75],
    [ 1.45, 0.21, 0.85, 0.58, 0.86, 0.75, 0.84, 0.76, 0.76],
    [ 1.85, 0.24, 0.80, 0.50, 0.83, 0.64, 0.78, 0.65, 0.70],
    [ 2.03, 0.28, 0.70, 0.44, 0.76, 0.55, 0.72, 0.56, 0.64],
]

GLASS_RANGES = {
    'side': [-0.85, 0.70],
    'front': [0.25, 0.70],
    'rear': [-1.55, -0.20],
}

ARCH = [-0.46, -0.415, -0.38, -0.3, -0.2, -0.1, 0.0, 0.1, 0.2, 0.3, 0.38, 0.415, 0.46]
MAX_GAP = 0.25
BEVEL = 0.03
FLARE = 0.035
AXLES = [REAR_AXLE, FRONT_AXLE]

# Build loft rings
curve = station_curve(STATIONS)
z_list = loft_zs(STATIONS, AXLES, ARCH, MAX_GAP)
lofted_stations = []
for z in z_list:
    st = curve(z)
    for a in AXLES:
        if abs(z - a) < 0.55:
            st = arch_station(st, z - a, WHEEL_RADIUS, FLARE)
    lofted_stations.append(st)

rings = []
for st in lofted_stations:
    rings.append({'z': st[0], 'st': st, 'pts': ring_of(st)})
rings.insert(0, {'z': STATIONS[0][0] - BEVEL, 'st': rings[0]['st'], 'pts': inset_ring(rings[0]['pts'], BEVEL)})
rings.append({'z': STATIONS[-1][0] + BEVEL, 'st': rings[-1]['st'], 'pts': inset_ring(rings[-1]['pts'], BEVEL)})

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

n = 19
for i in range(len(rings) - 1):
    A = rings[i]
    B = rings[i + 1]
    zm = (A['z'] + B['z']) / 2.0
    for k in range(n):
        k1 = (k + 1) % n
        band = A['pts'][k]['band']
        key = 'paint'
        if band == BAND_UNDER:
            key = 'under'
        elif band == BAND_GREEN and GLASS_RANGES['side'][0] <= zm <= GLASS_RANGES['side'][1]:
            key = 'glass'
        elif band == BAND_ROOF and ((GLASS_RANGES['front'][0] <= zm <= GLASS_RANGES['front'][1]) or (GLASS_RANGES['rear'][0] <= zm <= GLASS_RANGES['rear'][1])):
            key = 'glass'
        
        bm = mat_bms[key]
        pA0 = (A['pts'][k]['x'], A['pts'][k]['y'], A['z'])
        pA1 = (A['pts'][k1]['x'], A['pts'][k1]['y'], A['z'])
        pB0 = (B['pts'][k]['x'], B['pts'][k]['y'], B['z'])
        pB1 = (B['pts'][k1]['x'], B['pts'][k1]['y'], B['z'])
        add_quad(bm, pA0, pB0, pB1, pA1)

# End caps
def add_cap(bm, pts, z, front):
    cx = sum(p['x'] for p in pts) / len(pts)
    cy = sum(p['y'] for p in pts) / len(pts)
    c = (cx, cy, z)
    for k in range(len(pts)):
        k1 = (k + 1) % len(pts)
        p = (pts[k]['x'], pts[k]['y'], z)
        q = (pts[k1]['x'], pts[k1]['y'], z)
        if front:
            add_tri(bm, c, q, p)
        else:
            add_tri(bm, c, p, q)

add_cap(mat_bms['paint'], rings[-1]['pts'], rings[-1]['z'], True)
add_cap(mat_bms['paint'], rings[0]['pts'], rings[0]['z'], False)

# Inner wheel wells
inner_x = TRACK / 2.0 - WHEEL_WIDTH / 2.0 - 0.03
for axle in AXLES:
    bm_u = mat_bms['under']
    st_axle = curve(axle)
    top_y = st_axle[1] + 0.03
    for s in (1, -1):
        xs = s * inner_x
        z0 = axle - 0.46
        z1 = axle + 0.46
        if s > 0:
            add_quad(bm_u, (xs, 0.18, z1), (xs, 0.18, z0), (xs, top_y, z0), (xs, top_y, z1))
        else:
            add_quad(bm_u, (xs, 0.18, z0), (xs, 0.18, z1), (xs, top_y, z1), (xs, top_y, z0))

for key, bm in mat_bms.items():
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mat_obj = PAINT if key == 'paint' else GLASS if key == 'glass' else UNDER
    _obj(f'body_{key}', bm, mat_obj)

# --- Pop-up Headlights (raised) ---
for s in (1, -1):
    cx = s * 0.48
    # Pod shell: paint
    box(f'headlight_pod_{s}', PAINT, cx, 0.72, 1.68, 0.28, 0.12, 0.24, bottom=False)
    # Headlight lens: white emissive
    box(f'headlight_lens_{s}', LAMP, cx, 0.73, 1.802, 0.24, 0.09, 0.01)
    # Trim bezel around lens
    box(f'headlight_bezel_{s}', TRIM, cx, 0.72, 1.801, 0.26, 0.11, 0.01)

# --- Front Intake & Splitter Lip ---
box('front_intake', UNDER, 0, 0.28, 2.025, 0.80, 0.12, 0.08)
box('front_lip', TRIM, 0, 0.20, 1.98, 1.52, 0.04, 0.18)

# --- Front License Plate ---
box('plate_front', PLATE, 0, 0.34, 2.045, 0.36, 0.11, 0.01)

# --- Side Skirts ---
for s in (1, -1):
    box(f'skirt_{s}', TRIM, s * 0.84, 0.18, -0.075, 0.04, 0.05, 1.45)

# --- Side Mirrors ---
for s in (1, -1):
    # Stalk
    box(f'mirror_stalk_{s}', TRIM, s * 0.86, 0.82, 0.55, 0.04, 0.04, 0.04)
    # Housing
    box(f'mirror_body_{s}', PAINT, s * 0.93, 0.84, 0.55, 0.10, 0.07, 0.12)
    # Mirror glass
    box(f'mirror_glass_{s}', GLASS, s * 0.93, 0.845, 0.488, 0.08, 0.05, 0.005)

# --- Ducktail Spoiler (accent) ---
box('ducktail', ACCENT, 0, 0.85, -2.18, 1.48, 0.07, 0.16)
box('ducktail_lip', ACCENT, 0, 0.89, -2.25, 1.44, 0.06, 0.04)

# --- Round Tail Lamps (two each side) & Rear Fascia ---
box('tail_panel', TRIM, 0, 0.65, -2.251, 1.54, 0.16, 0.02)
for s in (1, -1):
    cylinder(f'tail_outer_{s}', TAIL, s * 0.60, 0.72, -2.255, 0.055, 0.015, sides=10)
    cylinder(f'tail_inner_{s}', TAIL, s * 0.44, 0.72, -2.255, 0.055, 0.015, sides=10)

# --- Rear License Plate ---
box('plate_rear', PLATE, 0, 0.54, -2.256, 0.36, 0.11, 0.01)

# --- Rear Diffuser ---
box('rear_diffuser', TRIM, 0, 0.23, -2.15, 1.30, 0.08, 0.20)
for dx in (-0.45, -0.18, 0.18, 0.45):
    box(f'diffuser_fin_{dx}', TRIM, dx, 0.20, -2.15, 0.02, 0.09, 0.22)

# --- Twin Exhaust Tips ---
for s in (1, -1):
    cylinder(f'exhaust_tip_{s}', CHROME, s * 0.32, 0.27, -2.22, 0.045, 0.12, sides=10)
    cylinder(f'exhaust_bore_{s}', UNDER, s * 0.32, 0.27, -2.339, 0.038, 0.005, sides=10)

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
    
    # Outer vs inner direction along x
    sgn = 1 if cx > 0 else -1
    x_in_side = cx - sgn * (rw / 2.0)
    x_in_tread = cx - sgn * (rw / 2.0 - shoulder)
    x_out_tread = cx + sgn * (rw / 2.0 - shoulder)
    x_out_side = cx + sgn * (rw / 2.0)
    x_seat = cx + sgn * (rw / 2.0 - 0.025)
    x_hub = cx + sgn * (rw / 2.0 - 0.055)
    
    # Create rings of vertices
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
    
    # Connect bands with outward-facing faces
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

make_wheel('wheel-fl', 0.74, FRONT_AXLE)
make_wheel('wheel-fr', -0.74, FRONT_AXLE)
make_wheel('wheel-rl', 0.74, REAR_AXLE)
make_wheel('wheel-rr', -0.74, REAR_AXLE)

frame_view()
result = 'rv_rotary built'
