"""
Police Cruiser (police_cruiser): Japanese patrol car in the Crown mould.
A big four-door sedan, white upper body and roof, black lower body and doors,
a low roof light bar with red lens on the left (x > 0) and blue lens on the right (x < 0).
Run after kit.py.

Dimensions:
- Length: 4.70 m (z from -2.35 to +2.35)
- Width: 1.80 m (x from -0.90 to +0.90, mirrors to +-0.98)
- Height: 1.45 m (y from 0.00 to 1.45, including roof light bar)
- Axles: front z = +1.40, rear z = -1.40 (wheelbase 2.80 m)
- Wheel radius: 0.32 m, width 0.22 m, centers at x = +-0.76, y = 0.32
- Body budget: at most 1,800 triangles (everything except wheels)
"""

clear()

import bmesh
import math
from mathutils import Vector

# Fixed car dimensions
LENGTH = 4.70
WIDTH = 1.80
TOTAL_HEIGHT = 1.45
ROOF_HEIGHT = 1.368
FRONT_AXLE = 1.40
REAR_AXLE = -1.40
WHEEL_RADIUS = 0.32
WHEEL_WIDTH = 0.22
WHEEL_X = 0.76

# Materials (G3 specifications)
PAINT = mat('paint', 0xf4f4f2)       # White upper body, roof, hood, trunk
ACCENT = mat('accent', 0x14161c)     # Black lower body, doors, bumpers
GLASS = mat('glass', 0x1a2430)       # Tinted automotive glass
TRIM = mat('trim', 0x1c1c1e)         # Window frames, B-pillar, grille slats
UNDER = mat('under', 0x0c0c0c)       # Floor underside, wheel wells, intakes
CHROME = mat('chrome', 0x9aa0a8)     # Grille surround, light bar bracket, exhaust
LAMP = mat('lamp', 0xffffff, emissive=True)       # Headlights
TAIL = mat('tail', 0xd01818, emissive=True)       # Tail lamps
LENS_L = mat('lens-l', 0xff2a2a, emissive=True)   # Left red lens (x > 0)
LENS_R = mat('lens-r', 0x2a5aff, emissive=True)   # Right blue lens (x < 0)
PLATE = mat('plate', 0xe8e8e0)       # Japanese license plates
TIRE = mat('tire', 0x18181a)         # Wheels (viewer only)
RIM = mat('rim', 0x889098)           # Wheels (viewer only)

# --- Stations along the car from rear bumper (-2.35) to front bumper (+2.35) ---
Z_STATIONS = [
    -2.35, -2.32, -2.25, -2.15, -2.00,
    -1.85, -1.73, -1.58, -1.40, -1.22,
    -1.07, -0.90, -0.65, -0.40, -0.15,
    0.00, 0.15, 0.35, 0.65, 0.90, 1.05,
    1.22, 1.40, 1.58, 1.73, 1.95,
    2.15, 2.25, 2.32, 2.35
]

def get_profile(z):
    # Plan view body half-width (max 0.90 -> width 1.80 m)
    if z > 1.40:
        # Front axle to nose bumper: taper to 0.825 m (nose width 1.65 m)
        t = (z - 1.40) / (2.35 - 1.40)
        w_body = 0.90 - 0.075 * (t ** 1.25)
    elif z > -1.40:
        # Wheelbase / doors: full width 1.80 m (w_body = 0.90)
        w_body = 0.90
    else:
        # Rear axle to tail bumper: taper to 0.835 m (tail width 1.67 m)
        t = (-1.40 - z) / (2.35 - 1.40)
        w_body = 0.90 - 0.065 * (t ** 1.20)

    # Rocker & wheel arch cutouts
    y_rocker = 0.22
    for axle in (FRONT_AXLE, REAR_AXLE):
        off = abs(z - axle)
        R_arch = 0.38
        if off < R_arch:
            arch_lift = 0.32 + math.sqrt(max(0.0, R_arch * R_arch - off * off)) * 0.92
            y_rocker = max(y_rocker, arch_lift)

    # Beltline height (divider between black lower body and upper surfaces)
    y_belt = 0.86

    # Fender line & Hood / Trunk Deck
    if z > 1.05:
        # Front hood and nose
        if z > 2.25:
            # Front bumper nose tip
            t = (z - 2.25) / (2.35 - 2.25)
            y_fender = 0.72 - 0.12 * t
            y_center = y_fender - 0.01
        else:
            # Sloping hood from cowl (z=1.05, y=0.86) to front grille (z=2.25, y=0.72)
            t = (z - 1.05) / (2.25 - 1.05)
            y_fender = 0.86 - 0.14 * (t ** 1.1)
            y_center = y_fender - 0.015 * math.sin(t * math.pi)
    elif z > -1.35:
        # Cabin area: waist / window sill
        y_fender = 0.86
        y_center = 0.86
    else:
        # Rear trunk deck and rear bumper
        if z < -2.25:
            # Rear bumper drop
            t = (-2.25 - z) / (2.35 - 2.25)
            y_fender = 0.88 - 0.18 * t
            y_center = y_fender
        else:
            # Trunk deck from rear window (z=-1.35, y=0.91) to trunk lip (z=-2.25, y=0.88)
            t = (-1.35 - z) / (2.25 - 1.35)
            y_fender = 0.91 - 0.03 * t
            y_center = y_fender

    # Greenhouse (Sedan Cabin) - upright 4-door sedan
    has_cabin = (-1.35 < z < 1.05)
    if has_cabin:
        if z > 0.35:
            # Windshield: raked from cowl (z=1.05, y=0.86) to roof header (z=0.35, y=1.365)
            t = (z - 0.35) / (1.05 - 0.35)
            y_roof = 1.365 - 0.505 * (t ** 1.08)
            w_roof = 0.64 + 0.04 * t
        elif z > -0.65:
            # Level roof with gentle crown (peak 1.368 m, width 1.28 m)
            t = abs(z - (-0.15)) / 0.50
            y_roof = 1.368 - 0.005 * (t ** 2)
            w_roof = 0.64
        else:
            # Rear window: sloping from roof header (z=-0.65, y=1.365) to trunk (z=-1.35, y=0.91)
            t = (-0.65 - z) / (1.35 - 0.65)
            y_roof = 1.365 - 0.455 * (t ** 1.12)
            w_roof = 0.64 + 0.04 * t
    else:
        y_roof = y_center
        w_roof = w_body * 0.74

    return w_body, y_rocker, y_belt, y_fender, y_center, has_cabin, y_roof, w_roof

def make_ring_pts(z):
    w_body, y_rocker, y_belt, y_fender, y_center, has_cabin, y_roof, w_roof = get_profile(z)
    
    # 7 points up right flank (rocker to roof rail/hood edge)
    # 0: rocker bottom
    # 1: lower door/flank
    # 2: beltline (door crease)
    # 3: upper door
    # 4: window sill / fender line
    # 5: window tumblehome / pillar mid
    # 6: roof rail / top side edge
    if has_cabin:
        side_r = [
            (-w_body * 0.94, y_rocker),
            (-w_body * 0.98, y_rocker + (y_belt - y_rocker) * 0.45),
            (-w_body, y_belt),
            (-w_body * 0.98, y_belt + (y_fender - y_belt) * 0.50),
            (-w_body * 0.94, y_fender),
            (-w_roof - 0.08, y_fender + (y_roof - y_fender) * 0.55),
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
            (-w_body * 0.98, y_rocker + (y_belt - y_rocker) * 0.45),
            (-w_body, y_belt),
            (-w_body * 0.98, y_belt + (y_fender - y_belt) * 0.50),
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
    # k in 0..17 across the bilateral ring
    if 6 <= k <= 11:
        # Top surface: hood, windshield, roof, rear window, trunk
        if 0.35 <= zm <= 1.05:
            return 'glass'   # Windshield
        elif -1.35 <= zm <= -0.65:
            return 'glass'   # Rear window
        else:
            return 'paint'   # Hood (zm > 1.05), Roof (-0.65 <= zm <= 0.35), Trunk (zm < -1.35)
    elif k in (4, 5, 12, 13):
        # Greenhouse sides / window level
        if -1.35 <= zm <= 1.05:
            # Inside cabin: side windows vs pillars
            if zm > 0.65:
                return 'paint'  # White A-pillar
            elif zm < -1.05:
                return 'paint'  # White C-pillar
            elif -0.22 <= zm <= -0.08:
                return 'trim'   # Black B-pillar center post
            else:
                return 'glass'  # Front and rear door side windows
        else:
            # Outside cabin: upper fenders
            return 'paint'      # White upper fender tops
    elif k in (2, 3, 14, 15):
        # Upper door / upper flank
        if -1.35 <= zm <= 1.05:
            return 'accent'     # Black doors (Japanese police livery)
        else:
            return 'paint'      # White upper fenders
    else:
        # k in (0, 1, 16, 17): Lower body, rocker, lower doors, bumpers
        return 'accent'         # Black lower body and bumpers

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

    # Underside floor closing strictly at y = 0.22 (never rising)
    bm_u = mat_bms['under']
    pA_r = (A['pts'][0]['x'], 0.22, A['z'])
    pA_l = (A['pts'][18]['x'], 0.22, A['z'])
    pB_r = (B['pts'][0]['x'], 0.22, B['z'])
    pB_l = (B['pts'][18]['x'], 0.22, B['z'])
    add_quad(bm_u, pA_l, pA_r, pB_r, pB_l)

# Front nose cap (z = 2.35)
c_front = (0.0, 0.45, 2.35)
front_pts = rings[-1]['pts']
for k in range(18):
    k1 = k + 1
    p = (front_pts[k]['x'], front_pts[k]['y'], 2.35)
    q = (front_pts[k1]['x'], front_pts[k1]['y'], 2.35)
    # Center grill area paint/accent
    mat_key = 'paint' if 6 <= k <= 11 and p[1] > 0.60 else 'accent'
    add_tri(mat_bms[mat_key], c_front, q, p)

# Rear tail cap (z = -2.35)
c_rear = (0.0, 0.55, -2.35)
tail_pts = rings[0]['pts']
for k in range(18):
    k1 = k + 1
    p = (tail_pts[k]['x'], tail_pts[k]['y'], -2.35)
    q = (tail_pts[k1]['x'], tail_pts[k1]['y'], -2.35)
    mat_key = 'paint' if 6 <= k <= 11 and p[1] > 0.70 else 'accent'
    add_tri(mat_bms[mat_key], c_rear, p, q)

# --- Wheel Arch Well Liners (Dark under wells) ---
bm_u = mat_bms['under']
for axle in (FRONT_AXLE, REAR_AXLE):
    xs_list = (0.76, -0.76)
    for xs in xs_list:
        arch_steps = 8
        R_arch = 0.38
        for i in range(arch_steps):
            a0 = math.pi * i / arch_steps
            a1 = math.pi * (i + 1) / arch_steps
            z0 = axle - R_arch * math.cos(a0)
            z1 = axle - R_arch * math.cos(a1)
            y0 = 0.32 + R_arch * math.sin(a0) * 0.92
            y1 = 0.32 + R_arch * math.sin(a1) * 0.92
            x_out = xs * 1.15
            x_in = xs * 0.85
            add_quad(bm_u, (x_out, y0, z0), (x_in, y0, z0), (x_in, y1, z1), (x_out, y1, z1))

for key, bm in mat_bms.items():
    mat_obj = PAINT if key == 'paint' else ACCENT if key == 'accent' else GLASS if key == 'glass' else TRIM if key == 'trim' else UNDER
    _obj(f'body_{key}', bm, mat_obj)

# --- Crown Sedan Front Grille & Headlights ---
# Chrome grille frame
box('grille_chrome', CHROME, 0, 0.58, 2.315, 0.64, 0.14, 0.02)
box('grille_mesh', TRIM, 0, 0.59, 2.325, 0.60, 0.12, 0.015)
# Japanese police sunburst crest in grille center
box('police_crest', CHROME, 0, 0.64, 2.336, 0.07, 0.07, 0.01)

# Crown sedan rectangular headlights (chrome bezel + white emissive lamp lens)
for s in (1, -1):
    box(f'headlight_bezel_{s}', CHROME, s * 0.60, 0.58, 2.295, 0.38, 0.14, 0.02)
    box(f'headlight_lens_{s}', LAMP, s * 0.57, 0.59, 2.305, 0.28, 0.12, 0.015)
    # Amber indicator lens at outer corner
    box(f'turn_lens_{s}', TAIL, s * 0.74, 0.59, 2.285, 0.06, 0.12, 0.015)

# Front bumper intake and front license plate
box('front_bumper_rub', TRIM, 0, 0.44, 2.335, 1.62, 0.04, 0.015)
box('front_intake', UNDER, 0, 0.26, 2.315, 0.70, 0.10, 0.035)
# Front plate at z=2.348, depth 0.004 -> max z = 2.350
box('plate_front', PLATE, 0, 0.38, 2.348, 0.34, 0.17, 0.004)

# --- Rear Taillights, Trunk Panel & License Plate ---
for s in (1, -1):
    box(f'taillight_bezel_{s}', TRIM, s * 0.58, 0.70, -2.325, 0.42, 0.15, 0.02)
    box(f'taillight_red_{s}', TAIL, s * 0.58, 0.71, -2.335, 0.28, 0.13, 0.015)
    box(f'taillight_rev_{s}', LAMP, s * 0.41, 0.71, -2.335, 0.08, 0.13, 0.015)

# Rear plate at z=-2.335
box('plate_rear', PLATE, 0, 0.70, -2.335, 0.34, 0.17, 0.004)
box('rear_bumper_rub', TRIM, 0, 0.48, -2.335, 1.62, 0.04, 0.015)
# Exhaust tip strictly within z >= -2.350 (starts at -2.310, negative h = -0.038 -> end at -2.348)
cylinder('exhaust_tip', CHROME, -0.55, 0.28, -2.310, 0.040, -0.038, sides=12, axis='z')
cylinder('exhaust_bore', UNDER, -0.55, 0.28, -2.312, 0.033, -0.005, sides=12, axis='z')

# --- Side Mirrors ---
for s in (1, -1):
    # Mirror mount
    box(f'mirror_mount_{s}', TRIM, s * 0.88, 0.88, 0.90, 0.06, 0.03, 0.08)
    # Mirror housing
    box(f'mirror_body_{s}', ACCENT, s * 0.94, 0.88, 0.88, 0.08, 0.07, 0.12)
    # Mirror reflective face
    box(f'mirror_glass_{s}', GLASS, s * 0.94, 0.885, 0.825, 0.065, 0.055, 0.005)

# --- ROOF LIGHT BAR (G3 specification: red lens on LEFT x > 0, blue lens on RIGHT x < 0) ---
# Total car height strictly 1.450 m. Roof is at ~1.368 m.
# Mounting legs on roof
box('lightbar_leg_l', TRIM, 0.35, 1.365, -0.15, 0.04, 0.025, 0.16)
box('lightbar_leg_r', TRIM, -0.35, 1.365, -0.15, 0.04, 0.025, 0.16)
box('lightbar_base', CHROME, 0, 1.380, -0.15, 1.16, 0.015, 0.22)

# Central siren speaker housing (white paint box with front speaker grille)
box('lightbar_speaker', PAINT, 0, 1.390, -0.15, 0.20, 0.055, 0.20)
box('lightbar_speaker_mesh', TRIM, 0, 1.405, -0.048, 0.14, 0.030, 0.005)

# Left Red Lens (x > 0, the car's LEFT): 0xff2a2a, emissive, top strictly at 1.450 m
# Sits from x = 0.10 to 0.56 (width 0.46), y from 1.390 to 1.450 (height 0.060), z from -0.24 to -0.06 (depth 0.18)
box('lightbar_lens_l', LENS_L, 0.33, 1.390, -0.15, 0.46, 0.060, 0.18)
# Left outer aerodynamic end cap
box('lightbar_cap_l', LENS_L, 0.57, 1.395, -0.15, 0.04, 0.048, 0.14)

# Right Blue Lens (x < 0, the car's RIGHT): 0x2a5aff, emissive, top strictly at 1.450 m
# Sits from x = -0.56 to -0.10 (width 0.46), y from 1.390 to 1.450 (height 0.060), z from -0.24 to -0.06 (depth 0.18)
box('lightbar_lens_r', LENS_R, -0.33, 1.390, -0.15, 0.46, 0.060, 0.18)
# Right outer aerodynamic end cap
box('lightbar_cap_r', LENS_R, -0.57, 1.395, -0.15, 0.04, 0.048, 0.14)

# Top aerodynamic center spine / cover
box('lightbar_top_bar', TRIM, 0, 1.446, -0.15, 1.14, 0.004, 0.08)

# --- Four Wheels for Viewer (named wheel-*) ---
def make_wheel(name, cx, cz):
    bm_tire = bmesh.new()
    bm_rim = bmesh.new()
    cy = WHEEL_RADIUS
    rw = WHEEL_WIDTH
    R = WHEEL_RADIUS
    rim_r = R * 0.68
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
result = 'police_cruiser built'
