"""
Police Interceptor (police_interceptor): Japanese police mid-engine supercar interceptor (NSX mould).
Low, ultra-wide supercar stance (2.00 m wide, 1.24 m total height), forward canopy greenhouse,
mid-engine deck, integrated rear wing, cruiser two-tone livery with white carried down to door handle height,
and an aerodynamic 1.3 m wide roof light bar with 0.12 m tall red (left) and blue (right) lenses.
Run after kit.py.

Dimensions:
- Length: 4.60 m (z from -2.30 to +2.30)
- Width: 2.00 m (x from -1.00 to +1.00, mirrors to +-1.08)
- Height: 1.24 m (y from 0.00 to 1.24, including roof light bar)
- Axles: front z = +1.38, rear z = -1.38 (wheelbase 2.76 m)
- Wheel radius: 0.33 m, width 0.24 m, centers at x = +-0.86, y = 0.33
- Body budget: at most 1,800 triangles (everything except wheels)
"""

clear()

import bmesh
import math
from mathutils import Vector

# Dimensions
LENGTH = 4.60
WIDTH = 2.00
TOTAL_HEIGHT = 1.24
ROOF_HEIGHT = 1.115
FRONT_AXLE = 1.38
REAR_AXLE = -1.38
WHEEL_RADIUS = 0.33
WHEEL_WIDTH = 0.24
WHEEL_X = 0.86

# Materials (G3 specifications)
PAINT = mat('paint', 0xf4f4f2)       # White upper body, hood, roof, engine deck, upper doors
ACCENT = mat('accent', 0x14161c)     # Black lower body, lower doors, skirts, splitter, diffuser
GLASS = mat('glass', 0x1a2430)       # Tinted canopy glass
TRIM = mat('trim', 0x1c1c1e)         # Window frames, B-pillar, intakes, aero fins
UNDER = mat('under', 0x0c0c0c)       # Floor underside, wheel wells, radiator
CHROME = mat('chrome', 0x9aa0a8)     # Exhaust tips, badges, light bar bracket
LAMP = mat('lamp', 0xffffff, emissive=True)       # Headlights
TAIL = mat('tail', 0xd01818, emissive=True)       # Full-width tail light bar
LENS_L = mat('lens-l', 0xff2a2a, emissive=True)   # Left red lens (x > 0)
LENS_R = mat('lens-r', 0x2a5aff, emissive=True)   # Right blue lens (x < 0)
PLATE = mat('plate', 0xe8e8e0)       # Japanese license plates
TIRE = mat('tire', 0x18181a)         # Wheels (viewer only)
RIM = mat('rim', 0x889098)           # Wheels (viewer only)

# --- Stations along the car from rear bumper (-2.30) to front bumper (+2.30) ---
Z_STATIONS = [
    -2.30, -2.27, -2.20, -2.05, -1.88,
    -1.70, -1.52, -1.38, -1.20, -0.95,
    -0.65, -0.35, 0.00, 0.25, 0.55,
    0.80, 1.05, 1.22, 1.38, 1.55,
    1.75, 1.95, 2.12, 2.22, 2.27,
    2.30
]

def get_profile(z):
    # Plan view body half-width (max 1.00 -> width 2.00 m)
    if z > 1.38:
        # Front axle to nose: tapered wedge down to 0.86 m (nose width 1.72 m)
        t = (z - 1.38) / (2.30 - 1.38)
        w_body = 1.00 - 0.140 * (t ** 1.15)
    elif z > 0.00:
        # Waist / cabin: Coke-bottle curve
        t = z / 1.38
        w_body = 0.96 + 0.04 * math.sin(t * math.pi / 2)
    elif z > -1.38:
        # Mid-engine hip swell: flares out to full 1.00 m at rear axle
        t = (-z) / 1.38
        w_body = 0.96 + 0.04 * math.sin(t * math.pi / 2)
    else:
        # Rear axle to tail: taper to 0.88 m (tail width 1.76 m)
        t = (-1.38 - z) / (2.30 - 1.38)
        w_body = 1.00 - 0.120 * (t ** 1.10)

    # Rocker & wheel arch cutouts
    y_rocker = 0.18
    for axle in (FRONT_AXLE, REAR_AXLE):
        off = abs(z - axle)
        R_arch = 0.39
        if off < R_arch:
            arch_lift = 0.33 + math.sqrt(max(0.0, R_arch * R_arch - off * off)) * 0.90
            y_rocker = max(y_rocker, arch_lift)

    # Door handle height (Review note: white carried down to handle height ~0.76 m)
    y_handle = 0.76
    y_fender_base = 0.82

    # Hood & Engine Deck heights
    if z > 0.80:
        # Low sloping supercar wedge nose
        if z > 2.22:
            t = (z - 2.22) / (2.30 - 2.22)
            y_fender = 0.54 - 0.14 * t
            y_center = y_fender - 0.02
        else:
            t = (z - 0.80) / (2.22 - 0.80)
            y_fender = 0.78 - 0.24 * (t ** 1.15)
            y_center = y_fender - 0.03 * math.sin(t * math.pi)
    elif z > -0.40:
        # Cockpit beltline
        y_fender = 0.80
        y_center = 0.80
    elif z > -1.80:
        # Mid-engine deck (sloping back from canopy)
        t = (-0.40 - z) / (1.80 - 0.40)
        y_fender = 0.82 + 0.04 * math.sin(t * math.pi)
        y_center = 0.80 - 0.02 * t
    else:
        # Rear deck & spoiler base
        t = (-1.80 - z) / (2.30 - 1.80)
        y_fender = 0.84 - 0.04 * t
        y_center = y_fender - 0.01

    # Greenhouse (Fighter-jet forward canopy)
    has_cabin = (-0.40 < z < 0.80)
    if has_cabin:
        if z > 0.25:
            # Steep forward windshield (z=0.80, y=0.78 to z=0.25, y=1.110)
            t = (z - 0.25) / (0.80 - 0.25)
            y_roof = 1.110 - 0.330 * (t ** 1.08)
            w_roof = 0.65 + 0.03 * t
        elif z > -0.15:
            # Canopy roof apex at 1.115 m (roof width 1.30 m)
            t = abs(z - 0.05) / 0.20
            y_roof = 1.115 - 0.005 * (t ** 2)
            w_roof = 0.65
        else:
            # Rear canopy glass (z=-0.15, y=1.110 to z=-0.40, y=0.84)
            t = (-0.15 - z) / (0.40 - 0.15)
            y_roof = 1.110 - 0.270 * (t ** 1.10)
            w_roof = 0.65 + 0.04 * t
    else:
        y_roof = y_center
        w_roof = w_body * 0.76

    return w_body, y_rocker, y_handle, y_fender, y_center, has_cabin, y_roof, w_roof

def make_ring_pts(z):
    w_body, y_rocker, y_handle, y_fender, y_center, has_cabin, y_roof, w_roof = get_profile(z)

    # 7 points along right flank:
    # 0: rocker bottom
    # 1: lower door / skirt (accent black)
    # 2: handle line (accent/paint boundary at 0.76 m)
    # 3: upper door / hip crease (paint white)
    # 4: fender crest (paint white)
    # 5: canopy glass lower edge
    # 6: roof edge
    if has_cabin:
        side_r = [
            (-w_body * 0.94, y_rocker),
            (-w_body * 0.98, y_rocker + (y_handle - y_rocker) * 0.50),
            (-w_body, y_handle),
            (-w_body * 0.98, y_handle + (y_fender - y_handle) * 0.50),
            (-w_body * 0.94, y_fender),
            (-w_roof - 0.08, y_fender + (y_roof - y_fender) * 0.50),
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
            (-w_body * 0.98, y_rocker + (y_handle - y_rocker) * 0.50),
            (-w_body, y_handle),
            (-w_body * 0.98, y_handle + (y_fender - y_handle) * 0.50),
            (-w_body * 0.94, y_fender),
            (-w_body * 0.88, y_fender - 0.005),
            (-w_roof, y_fender - 0.010),
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
    'trim': bmesh.new(),
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
        # Top surface: hood, windshield, roof, rear engine glass, rear deck
        if 0.25 <= zm <= 0.80:
            return 'glass'   # Windshield
        elif -0.40 <= zm <= -0.15:
            return 'glass'   # Rear canopy glass
        elif -1.20 <= zm <= -0.40:
            return 'glass'   # Mid-engine glass inspection cover
        else:
            return 'paint'   # Hood, Roof, Rear deck
    elif k in (4, 5, 12, 13):
        # Window / pillar band
        if -0.40 <= zm <= 0.80:
            if zm > 0.55:
                return 'paint'  # A-pillar
            elif zm < -0.25:
                return 'paint'  # B-pillar / canopy arch
            else:
                return 'glass'  # Side canopy windows
        else:
            return 'paint'      # Front & rear fenders
    elif k in (2, 3, 14, 15):
        # Upper door band (handle to window): WHITE! (Review note: white carried down to handle height)
        return 'paint'
    else:
        # k in (0, 1, 16, 17): Lower door and rocker below handle height: BLACK!
        return 'accent'

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

# Front nose cap (z = 2.30)
c_front = (0.0, 0.38, 2.30)
front_pts = rings[-1]['pts']
for k in range(18):
    k1 = k + 1
    p = (front_pts[k]['x'], front_pts[k]['y'], 2.30)
    q = (front_pts[k1]['x'], front_pts[k1]['y'], 2.30)
    mat_key = 'paint' if 6 <= k <= 11 and p[1] > 0.45 else 'accent'
    add_tri(mat_bms[mat_key], c_front, q, p)

# Rear tail cap (z = -2.30)
c_rear = (0.0, 0.50, -2.30)
tail_pts = rings[0]['pts']
for k in range(18):
    k1 = k + 1
    p = (tail_pts[k]['x'], tail_pts[k]['y'], -2.30)
    q = (tail_pts[k1]['x'], tail_pts[k1]['y'], -2.30)
    mat_key = 'paint' if 6 <= k <= 11 and p[1] > 0.70 else 'accent'
    add_tri(mat_bms[mat_key], c_rear, p, q)

# --- Wheel Arch Well Liners (Dark under wells) ---
bm_u = mat_bms['under']
for axle in (FRONT_AXLE, REAR_AXLE):
    xs_list = (WHEEL_X, -WHEEL_X)
    for xs in xs_list:
        arch_steps = 8
        R_arch = 0.39
        for i in range(arch_steps):
            a0 = math.pi * i / arch_steps
            a1 = math.pi * (i + 1) / arch_steps
            z0 = axle - R_arch * math.cos(a0)
            z1 = axle - R_arch * math.cos(a1)
            y0 = 0.33 + R_arch * math.sin(a0) * 0.90
            y1 = 0.33 + R_arch * math.sin(a1) * 0.90
            x_out = xs * 1.15
            x_in = xs * 0.85
            add_quad(bm_u, (x_out, y0, z0), (x_in, y0, z0), (x_in, y1, z1), (x_out, y1, z1))

for key, bm in mat_bms.items():
    mat_obj = PAINT if key == 'paint' else ACCENT if key == 'accent' else GLASS if key == 'glass' else TRIM if key == 'trim' else UNDER
    _obj(f'body_{key}', bm, mat_obj)

# --- Supercar Front Nose, Splitter & Pop-Up / Slender Headlights ---
# Front intake mouth & splitter
box('front_splitter', TRIM, 0, 0.17, 2.27, 1.72, 0.03, 0.05)
box('front_center_intake', UNDER, 0, 0.22, 2.28, 0.84, 0.14, 0.04)

# Slender aerodynamic dual projector headlights
for s in (1, -1):
    box(f'headlight_housing_{s}', TRIM, s * 0.60, 0.44, 2.24, 0.36, 0.10, 0.04)
    box(f'headlight_lens_{s}', LAMP, s * 0.58, 0.45, 2.26, 0.26, 0.08, 0.015)
    box(f'turn_lens_{s}', TAIL, s * 0.74, 0.45, 2.235, 0.05, 0.08, 0.015)

# Japanese police star crest on front nose
box('police_crest', CHROME, 0, 0.51, 2.285, 0.07, 0.07, 0.01)
box('plate_front', PLATE, 0, 0.26, 2.298, 0.34, 0.17, 0.004)

# Mid-engine side air intake scoops behind doors
for s in (1, -1):
    box(f'side_scoop_{s}', UNDER, s * 0.94, 0.55, -0.65, 0.08, 0.22, 0.40)
    box(f'side_scoop_fin_{s}', TRIM, s * 0.97, 0.55, -0.65, 0.02, 0.20, 0.36)

# --- Integrated Supercar Rear Wing & Full-Width Taillight Bar ---
# Rear wing pedestal uprights
box('wing_strut_l', PAINT, 0.70, 0.82, -2.18, 0.05, 0.12, 0.18)
box('wing_strut_r', PAINT, -0.70, 0.82, -2.18, 0.05, 0.12, 0.18)
# Rear wing airfoil blade across the rear deck
box('wing_blade', PAINT, 0, 0.92, -2.18, 1.70, 0.035, 0.20)

# Full-width horizontal NSX-style taillight band
box('taillight_bar', TAIL, 0, 0.70, -2.285, 1.62, 0.10, 0.015)
for s in (1, -1):
    box(f'taillight_rev_{s}', LAMP, s * 0.38, 0.70, -2.288, 0.10, 0.08, 0.01)

box('plate_rear', PLATE, 0, 0.56, -2.290, 0.34, 0.17, 0.004)
# Rear aerodynamic diffuser
box('rear_diffuser', TRIM, 0, 0.20, -2.28, 1.40, 0.08, 0.04)

# Quad chrome exhaust tips
for s in (-1, 1):
    for i in (0, 1):
        x_ex = s * (0.50 + i * 0.08)
        cylinder(f'exhaust_{s}_{i}', CHROME, x_ex, 0.26, -2.260, 0.032, -0.038, sides=12, axis='z')
        cylinder(f'exhaust_bore_{s}_{i}', UNDER, x_ex, 0.26, -2.262, 0.026, -0.005, sides=12, axis='z')

# --- Side Mirrors ---
for s in (1, -1):
    box(f'mirror_mount_{s}', TRIM, s * 0.90, 0.80, 0.45, 0.06, 0.03, 0.08)
    box(f'mirror_body_{s}', PAINT, s * 0.96, 0.80, 0.43, 0.08, 0.06, 0.11)
    box(f'mirror_glass_{s}', GLASS, s * 0.96, 0.805, 0.380, 0.065, 0.050, 0.005)

# --- ROOF LIGHT BAR (Review notes: 1.3 m wide, 0.12 m tall lenses, top strictly 1.24 m) ---
# Total height must be 1.24 m. Roof apex is at 1.115 m.
# Mounting legs on roof
box('lightbar_leg_l', TRIM, 0.42, 1.110, 0.00, 0.05, 0.015, 0.18)
box('lightbar_leg_r', TRIM, -0.42, 1.110, 0.00, 0.05, 0.015, 0.18)
box('lightbar_base', CHROME, 0, 1.120, 0.00, 1.30, 0.010, 0.24)

# Central siren speaker housing
box('lightbar_speaker', PAINT, 0, 1.120, 0.00, 0.22, 0.115, 0.22)
box('lightbar_speaker_mesh', TRIM, 0, 1.160, 0.108, 0.16, 0.060, 0.005)

# Left Red Lens (x > 0, car's LEFT): 0xff2a2a, emissive, strictly 0.12 m tall (1.12 to 1.24 m)
# Width 0.52 m (x from 0.11 to 0.63 m), depth 0.20 m
box('lightbar_lens_l', LENS_L, 0.37, 1.120, 0.00, 0.52, 0.120, 0.20)
box('lightbar_cap_l', LENS_L, 0.64, 1.125, 0.00, 0.04, 0.105, 0.16)

# Right Blue Lens (x < 0, car's RIGHT): 0x2a5aff, emissive, strictly 0.12 m tall (1.12 to 1.24 m)
# Width 0.52 m (x from -0.63 to -0.11 m), depth 0.20 m
box('lightbar_lens_r', LENS_R, -0.37, 1.120, 0.00, 0.52, 0.120, 0.20)
box('lightbar_cap_r', LENS_R, -0.64, 1.125, 0.00, 0.04, 0.105, 0.16)

# Top aerodynamic center spine / cover
box('lightbar_top_bar', TRIM, 0, 1.236, 0.00, 1.30, 0.004, 0.09)

# --- Four Wheels for Viewer (named wheel-*) ---
def make_wheel(name, cx, cz):
    bm_tire = bmesh.new()
    bm_rim = bmesh.new()
    cy = WHEEL_RADIUS
    rw = WHEEL_WIDTH
    R = WHEEL_RADIUS
    rim_r = R * 0.72
    shoulder = min(0.03, rw * 0.15)
    sides = 16

    sgn = 1 if cx > 0 else -1
    x_in_side = cx - sgn * (rw / 2.0)
    x_in_tread = cx - sgn * (rw / 2.0 - shoulder)
    x_out_tread = cx + sgn * (rw / 2.0 - shoulder)
    x_out_side = cx + sgn * (rw / 2.0)
    x_seat = cx + sgn * (rw / 2.0 - 0.025)
    x_hub = cx + sgn * (rw / 2.0 - 0.050)

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
result = 'police_interceptor built'
