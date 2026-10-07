"""
Police Rhino (police_rhino): Heavy pursuit SUV in Japanese police two-tone.
A heavy, boxy SUV (Land Cruiser / Patrol mould) with a steel push bar on the nose,
cruiser two-tone livery (white down to door handle height, black lower body),
and a prominent 1.3 m wide roof light bar with 0.12 m tall red (left) and blue (right) lenses.
Run after kit.py.

Dimensions:
- Length: 4.90 m (z from -2.45 to +2.45)
- Width: 2.00 m (x from -1.00 to +1.00, mirrors to +-1.08)
- Height: 1.90 m (y from 0.00 to 1.90, including roof light bar)
- Axles: front z = +1.47, rear z = -1.47 (wheelbase 2.94 m)
- Wheel radius: 0.38 m, width 0.26 m, centers at x = +-0.86, y = 0.38
- Body budget: at most 1,800 triangles (everything except wheels)
"""

clear()

import bmesh
import math
from mathutils import Vector

# Dimensions
LENGTH = 4.90
WIDTH = 2.00
TOTAL_HEIGHT = 1.90
ROOF_HEIGHT = 1.765
FRONT_AXLE = 1.47
REAR_AXLE = -1.47
WHEEL_RADIUS = 0.38
WHEEL_WIDTH = 0.26
WHEEL_X = 0.86

# Materials (G3 specifications)
PAINT = mat('paint', 0xf4f4f2)       # White upper body, roof, hood, upper doors to handle height
ACCENT = mat('accent', 0x14161c)     # Black lower body, lower doors, flared wheel arches, bumpers
GLASS = mat('glass', 0x1a2430)       # Tinted automotive glass
TRIM = mat('trim', 0x1c1c1e)         # Window frames, B/C pillars, push bar, roof rails
UNDER = mat('under', 0x0c0c0c)       # Floor underside, wheel wells, intakes
CHROME = mat('chrome', 0x9aa0a8)     # Grille surround, push bar accents, exhaust
LAMP = mat('lamp', 0xffffff, emissive=True)       # Headlights
TAIL = mat('tail', 0xd01818, emissive=True)       # Tail lamps
LENS_L = mat('lens-l', 0xff2a2a, emissive=True)   # Left red lens (x > 0)
LENS_R = mat('lens-r', 0x2a5aff, emissive=True)   # Right blue lens (x < 0)
PLATE = mat('plate', 0xe8e8e0)       # Japanese license plates
TIRE = mat('tire', 0x18181a)         # Wheels (viewer only)
RIM = mat('rim', 0x889098)           # Wheels (viewer only)

# --- Stations along the car from rear bumper (-2.45) to front bumper (+2.45) ---
Z_STATIONS = [
    -2.45, -2.42, -2.35, -2.25, -2.10,
    -1.92, -1.75, -1.47, -1.20, -0.90,
    -0.55, -0.20, 0.00, 0.25, 0.55,
    0.85, 1.15, 1.28, 1.47, 1.68,
    1.90, 2.10, 2.25, 2.35, 2.42,
    2.45
]

def get_profile(z):
    # Plan view body half-width (max 1.00 -> width 2.00 m)
    if z > 1.47:
        # Front axle to nose bumper: taper to 0.93 m (nose width 1.86 m)
        t = (z - 1.47) / (2.45 - 1.47)
        w_body = 1.00 - 0.070 * (t ** 1.25)
    elif z > -1.47:
        # Wheelbase / doors: full width 2.00 m (w_body = 1.00)
        w_body = 1.00
    else:
        # Rear axle to tail bumper: taper to 0.94 m (tail width 1.88 m)
        t = (-1.47 - z) / (2.45 - 1.47)
        w_body = 1.00 - 0.060 * (t ** 1.20)

    # Rocker & wheel arch cutouts (high SUV clearance)
    y_rocker = 0.32
    for axle in (FRONT_AXLE, REAR_AXLE):
        off = abs(z - axle)
        R_arch = 0.44
        if off < R_arch:
            arch_lift = 0.38 + math.sqrt(max(0.0, R_arch * R_arch - off * off)) * 0.92
            y_rocker = max(y_rocker, arch_lift)

    # Door handle / waist height (Review note: white carried down to handle height ~1.08 m)
    y_handle = 1.08
    y_belt = 1.20  # Window sill beltline

    # Hood & Tailgate heights
    if z > 1.15:
        # Hood & front nose
        if z > 2.35:
            t = (z - 2.35) / (2.45 - 2.35)
            y_fender = 1.08 - 0.12 * t
            y_center = y_fender - 0.01
        else:
            t = (z - 1.15) / (2.35 - 1.15)
            y_fender = 1.20 - 0.12 * (t ** 1.1)
            y_center = y_fender - 0.02 * math.sin(t * math.pi)
    elif z > -2.10:
        # Cabin waist
        y_fender = 1.20
        y_center = 1.20
    else:
        # Rear bumper
        t = (-2.10 - z) / (2.45 - 2.10)
        y_fender = 1.20 - 0.40 * t
        y_center = y_fender

    # Greenhouse (Boxy SUV Cabin) - 2-box design
    has_cabin = (-2.10 < z < 1.15)
    if has_cabin:
        if z > 0.55:
            # Steep upright windshield (z=1.15, y=1.20 to z=0.55, y=1.760)
            t = (z - 0.55) / (1.15 - 0.55)
            y_roof = 1.760 - 0.560 * (t ** 1.08)
            w_roof = 0.74 + 0.05 * t
        elif z > -1.75:
            # Long level SUV roof (roof height 1.765 m, roof width 1.48 m)
            t = abs(z - (-0.60)) / 1.15
            y_roof = 1.765 - 0.005 * (t ** 2)
            w_roof = 0.74
        else:
            # Near-vertical rear tailgate window (z=-1.75, y=1.760 to z=-2.10, y=1.20)
            t = (-1.75 - z) / (2.10 - 1.75)
            y_roof = 1.760 - 0.560 * (t ** 1.12)
            w_roof = 0.74 + 0.05 * t
    else:
        y_roof = y_center
        w_roof = w_body * 0.78

    return w_body, y_rocker, y_handle, y_belt, y_fender, y_center, has_cabin, y_roof, w_roof

def make_ring_pts(z):
    w_body, y_rocker, y_handle, y_belt, y_fender, y_center, has_cabin, y_roof, w_roof = get_profile(z)

    # 7 points along right flank:
    # 0: rocker bottom
    # 1: lower door (accent black)
    # 2: handle line (accent/paint boundary at 1.08 m)
    # 3: upper door (paint white)
    # 4: window sill / fender line (paint white)
    # 5: window tumblehome / pillar mid
    # 6: roof rail
    if has_cabin:
        side_r = [
            (-w_body * 0.94, y_rocker),
            (-w_body * 0.98, y_rocker + (y_handle - y_rocker) * 0.50),
            (-w_body, y_handle),
            (-w_body * 0.98, y_handle + (y_fender - y_handle) * 0.50),
            (-w_body * 0.95, y_fender),
            (-w_roof - 0.10, y_fender + (y_roof - y_fender) * 0.50),
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
            (-w_body * 0.95, y_fender),
            (-w_body * 0.90, y_fender - 0.005),
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
    # Bilateral ring quads k in 0..17:
    if 6 <= k <= 11:
        # Top surface: hood, windshield, roof, rear window, tailgate
        if 0.55 <= zm <= 1.15:
            return 'glass'   # Windshield
        elif -2.10 <= zm <= -1.75:
            return 'glass'   # Rear tailgate glass
        else:
            return 'paint'   # Hood, Roof, Tailgate bottom
    elif k in (4, 5, 12, 13):
        # Window band
        if -2.10 <= zm <= 1.15:
            if zm > 0.85:
                return 'paint'  # White A-pillar
            elif zm < -1.85:
                return 'paint'  # White D-pillar
            elif -0.15 <= zm <= -0.05:
                return 'trim'   # Black B-pillar
            elif -1.15 <= zm <= -1.05:
                return 'trim'   # Black C-pillar
            else:
                return 'glass'  # Side windows
        else:
            return 'paint'      # Upper fenders
    elif k in (2, 3, 14, 15):
        # Upper door band (handle to window sill): WHITE! (Review note: white carried down to handle height)
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

    # Underside floor closing strictly at y = 0.30
    bm_u = mat_bms['under']
    pA_r = (A['pts'][0]['x'], 0.30, A['z'])
    pA_l = (A['pts'][18]['x'], 0.30, A['z'])
    pB_r = (B['pts'][0]['x'], 0.30, B['z'])
    pB_l = (B['pts'][18]['x'], 0.30, B['z'])
    add_quad(bm_u, pA_l, pA_r, pB_r, pB_l)

# Front nose cap (z = 2.45)
c_front = (0.0, 0.65, 2.45)
front_pts = rings[-1]['pts']
for k in range(18):
    k1 = k + 1
    p = (front_pts[k]['x'], front_pts[k]['y'], 2.45)
    q = (front_pts[k1]['x'], front_pts[k1]['y'], 2.45)
    mat_key = 'paint' if 6 <= k <= 11 and p[1] > 0.95 else 'accent'
    add_tri(mat_bms[mat_key], c_front, q, p)

# Rear tail cap (z = -2.45)
c_rear = (0.0, 0.75, -2.45)
tail_pts = rings[0]['pts']
for k in range(18):
    k1 = k + 1
    p = (tail_pts[k]['x'], tail_pts[k]['y'], -2.45)
    q = (tail_pts[k1]['x'], tail_pts[k1]['y'], -2.45)
    mat_key = 'paint' if 6 <= k <= 11 and p[1] > 1.00 else 'accent'
    add_tri(mat_bms[mat_key], c_rear, p, q)

# --- Wheel Arch Well Liners (Dark under wells) ---
bm_u = mat_bms['under']
for axle in (FRONT_AXLE, REAR_AXLE):
    xs_list = (WHEEL_X, -WHEEL_X)
    for xs in xs_list:
        arch_steps = 8
        R_arch = 0.44
        for i in range(arch_steps):
            a0 = math.pi * i / arch_steps
            a1 = math.pi * (i + 1) / arch_steps
            z0 = axle - R_arch * math.cos(a0)
            z1 = axle - R_arch * math.cos(a1)
            y0 = 0.38 + R_arch * math.sin(a0) * 0.92
            y1 = 0.38 + R_arch * math.sin(a1) * 0.92
            x_out = xs * 1.15
            x_in = xs * 0.85
            add_quad(bm_u, (x_out, y0, z0), (x_in, y0, z0), (x_in, y1, z1), (x_out, y1, z1))

for key, bm in mat_bms.items():
    mat_obj = PAINT if key == 'paint' else ACCENT if key == 'accent' else GLASS if key == 'glass' else TRIM if key == 'trim' else UNDER
    _obj(f'body_{key}', bm, mat_obj)

# --- SUV Front Grille & Headlights ---
box('grille_frame', CHROME, 0, 0.78, 2.41, 0.76, 0.22, 0.02)
box('grille_mesh', TRIM, 0, 0.79, 2.42, 0.72, 0.20, 0.015)
box('police_crest', CHROME, 0, 0.87, 2.435, 0.09, 0.09, 0.01)

# Large heavy SUV rectangular headlights
for s in (1, -1):
    box(f'headlight_bezel_{s}', CHROME, s * 0.68, 0.78, 2.39, 0.44, 0.22, 0.02)
    box(f'headlight_lens_{s}', LAMP, s * 0.64, 0.79, 2.40, 0.32, 0.20, 0.015)
    box(f'turn_lens_{s}', TAIL, s * 0.84, 0.79, 2.38, 0.07, 0.20, 0.015)

# --- Steel Push Bar on the Nose (The Rhino signature feature) ---
# Main lower push bar tube wrapping across front bumper
box('pushbar_main', TRIM, 0, 0.52, 2.435, 1.40, 0.07, 0.03)
# Two heavy vertical bumper push pads with rubberized faces
for s in (1, -1):
    box(f'pushpad_{s}', TRIM, s * 0.38, 0.42, 2.435, 0.10, 0.58, 0.03)
    box(f'pushpad_rubber_{s}', UNDER, s * 0.38, 0.44, 2.445, 0.08, 0.54, 0.01)
# Upper push bar cross tube protecting grille
box('pushbar_top', TRIM, 0, 0.94, 2.425, 0.84, 0.05, 0.03)
# Headlight protector loop tubes
for s in (1, -1):
    box(f'pushbar_wing_{s}', TRIM, s * 0.68, 0.92, 2.405, 0.42, 0.04, 0.03)

# Front plate mounted on push bar
box('plate_front', PLATE, 0, 0.50, 2.448, 0.34, 0.17, 0.004)

# --- Rear Tailgate & Vertical Taillights ---
for s in (1, -1):
    # Tall vertical SUV taillight clusters
    box(f'taillight_bezel_{s}', TRIM, s * 0.78, 1.05, -2.43, 0.18, 0.48, 0.02)
    box(f'taillight_red_{s}', TAIL, s * 0.78, 1.15, -2.44, 0.14, 0.26, 0.015)
    box(f'taillight_rev_{s}', LAMP, s * 0.78, 0.92, -2.44, 0.14, 0.12, 0.015)

box('plate_rear', PLATE, 0, 0.88, -2.435, 0.34, 0.17, 0.004)
box('rear_step_bumper', TRIM, 0, 0.48, -2.435, 1.84, 0.10, 0.03)
# Heavy towing hitch strictly within z >= -2.450
box('tow_hitch', CHROME, 0, 0.40, -2.435, 0.12, 0.08, 0.03)

# Chrome exhaust
cylinder('exhaust_tip', CHROME, -0.65, 0.36, -2.410, 0.045, -0.038, sides=12, axis='z')
cylinder('exhaust_bore', UNDER, -0.65, 0.36, -2.412, 0.038, -0.005, sides=12, axis='z')

# --- Side Mirrors ---
for s in (1, -1):
    box(f'mirror_mount_{s}', TRIM, s * 0.95, 1.20, 1.00, 0.08, 0.04, 0.10)
    box(f'mirror_body_{s}', ACCENT, s * 1.03, 1.20, 0.98, 0.10, 0.12, 0.14)
    box(f'mirror_glass_{s}', GLASS, s * 1.03, 1.205, 0.915, 0.08, 0.10, 0.005)

# --- Roof Rails ---
for s in (1, -1):
    box(f'roof_rail_{s}', TRIM, s * 0.72, 1.770, -0.60, 0.04, 0.03, 2.20)

# --- ROOF LIGHT BAR (Review notes: 1.3 m wide, 0.12 m tall lenses, top strictly 1.90 m) ---
# Mounting brackets on roof
box('lightbar_leg_l', TRIM, 0.42, 1.765, -0.15, 0.05, 0.025, 0.20)
box('lightbar_leg_r', TRIM, -0.42, 1.765, -0.15, 0.05, 0.025, 0.20)
box('lightbar_base', CHROME, 0, 1.775, -0.15, 1.30, 0.015, 0.26)

# Central siren speaker housing
box('lightbar_speaker', PAINT, 0, 1.780, -0.15, 0.22, 0.115, 0.24)
box('lightbar_speaker_mesh', TRIM, 0, 1.820, -0.028, 0.16, 0.060, 0.005)

# Left Red Lens (x > 0, car's LEFT): 0xff2a2a, emissive, strictly 0.12 m tall (1.78 to 1.90 m)
# Width 0.52 m (x from 0.11 to 0.63 m), depth 0.22 m
box('lightbar_lens_l', LENS_L, 0.37, 1.780, -0.15, 0.52, 0.120, 0.22)
box('lightbar_cap_l', LENS_L, 0.64, 1.785, -0.15, 0.04, 0.105, 0.18)

# Right Blue Lens (x < 0, car's RIGHT): 0x2a5aff, emissive, strictly 0.12 m tall (1.78 to 1.90 m)
# Width 0.52 m (x from -0.63 to -0.11 m), depth 0.22 m
box('lightbar_lens_r', LENS_R, -0.37, 1.780, -0.15, 0.52, 0.120, 0.22)
box('lightbar_cap_r', LENS_R, -0.64, 1.785, -0.15, 0.04, 0.105, 0.18)

# Top aerodynamic center bar / roof cap
box('lightbar_top_bar', TRIM, 0, 1.896, -0.15, 1.30, 0.004, 0.10)

# --- Four Wheels for Viewer (named wheel-*) ---
def make_wheel(name, cx, cz):
    bm_tire = bmesh.new()
    bm_rim = bmesh.new()
    cy = WHEEL_RADIUS
    rw = WHEEL_WIDTH
    R = WHEEL_RADIUS
    rim_r = R * 0.65
    shoulder = min(0.04, rw * 0.18)
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
result = 'police_rhino built'
