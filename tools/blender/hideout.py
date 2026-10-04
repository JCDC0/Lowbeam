"""
An old warehouse on the waterfront, the kind a street racer hides a car in. Run after kit.py.

36 m by 24 m of rusting corrugated metal with a broken clerestory, its main door rolled fully up
so a car can drive straight in and out of sight, one dim lamp inside, oil drums and a stack of
pallets. A lean-to carport on the side covers two more cars. The lot is 48 m by 40 m, its front
(+z) on the street.
"""

clear()

RUST = mat('rust', 0x8a6a52, 'metal', tile=6)
METAL = mat('metal', 0x7d8a8e, 'metal', tile=6)
ROOF = mat('roof', 0x4e4a46, 'metal', tile=8)
DARK = mat('dark', 0x16181b, '', tile=4)
FLOOR = mat('floor', 0x3c3d3f, 'concrete', tile=4)
GLASS = mat('broken-glass', 0x23303a, '', tile=4)
STEEL = mat('steel', 0x6f7478, '', tile=4)
DRUM = mat('drum', 0x2f5f8a, '', tile=4)
WOOD = mat('pallet', 0x7a5c3a, '', tile=4)
LAMP = mat('lamp', 0xffcf7a, '', emissive=True)
APRON = mat('apron', 0x4c4d50, 'concrete', tile=5)

W, D, H = 36, 24, 9.5
Z = -6
FZ = Z + D / 2
poly('apron', APRON, [[(-24, 0.04, 20), (24, 0.04, 20), (24, 0.04, -20), (-24, 0.04, -20)]])
poly('floor', FLOOR, [[(-W / 2, 0.06, FZ), (W / 2, 0.06, FZ), (W / 2, 0.06, Z - D / 2), (-W / 2, 0.06, Z - D / 2)]])

# Shell: back and sides whole, the front with an 8 m opening on the left of centre.
box('back', RUST, 0, 0, Z - D / 2 + 0.1, W, H, 0.2)
box('left', METAL, -W / 2 + 0.1, 0, Z, 0.2, H, D)
box('right', RUST, W / 2 - 0.1, 0, Z, 0.2, H, D)
box('front-l', METAL, -14, 0, FZ, 8, H, 0.2)
box('front-head', RUST, -6, 5.2, FZ, 8, H - 5.2, 0.2)
box('front-r', METAL, 8, 0, FZ, 20, H, 0.2)
# The door rolled up: its drum over the opening. Inside it is dark: a black back panel reads as depth.
box('door-roll', STEEL, -6, 5.25, FZ + 0.25, 8.2, 0.7, 0.5)
poly('inside-dark', DARK, [[(-17.8, 0.1, Z - D / 2 + 0.25), (17.8, 0.1, Z - D / 2 + 0.25), (17.8, H - 0.5, Z - D / 2 + 0.25), (-17.8, H - 0.5, Z - D / 2 + 0.25)]])
# Low-pitched roof with a clerestory strip of broken panes along the front.
box('roof', ROOF, 0, H, Z, W + 0.6, 0.25, D + 0.6)
poly('clerestory', GLASS, [[(-17, 7.4, FZ + 0.12), (17, 7.4, FZ + 0.12), (17, 8.6, FZ + 0.12), (-17, 8.6, FZ + 0.12)]])
poly('clerestory-holes', DARK, [[(x, 7.5, FZ + 0.14), (x + 1.4, 7.5, FZ + 0.14), (x + 1.4, 8.5, FZ + 0.14), (x, 8.5, FZ + 0.14)] for x in (-14, -6.5, 1, 9.5, 13)])

# One dim lamp inside, drums and pallets.
box('inside-lamp', LAMP, -4, H - 1.2, Z - 3, 0.6, 0.2, 0.6)
light(-4, H - 1.5, Z - 3, (1.0, 0.75, 0.4), 16)
for i, (dx, dz) in enumerate([(12, Z - 8), (13, Z - 8.2), (12.5, Z - 7), (14, Z - 7.5)]):
    cylinder(f'drum{i}', DRUM, dx, 0, dz, 0.3, 0.9, 8)
for i in range(3):
    box(f'pallet{i}', WOOD, 15, i * 0.16, Z + 6, 1.2, 0.14, 1.0)

# The carport on the right side: a shed roof on six posts.
CX = W / 2 + 4
for (px, pz) in [(CX + 3.5, Z - 9), (CX + 3.5, Z), (CX + 3.5, Z + 9)]:
    box(f'post{pz}', STEEL, px, 0, pz, 0.25, 3.0, 0.25)
    collider(px, pz, 0.3, 0.3, 0, 3)
poly('carport-roof', METAL, [[(W / 2, 3.6, Z + 10), (CX + 4, 3.0, Z + 10), (CX + 4, 3.0, Z - 10), (W / 2, 3.6, Z - 10)],
                              [(W / 2, 3.58, Z - 10), (CX + 4, 2.98, Z - 10), (CX + 4, 2.98, Z + 10), (W / 2, 3.58, Z + 10)]])
light(CX + 1, 2.8, Z, (0.9, 0.85, 0.7), 9)

# A floodlight over the yard, mostly dead.
box('yard-pole', STEEL, -20, 0, 14, 0.3, 8, 0.3)
box('yard-head', LAMP, -20, 8, 14.4, 1.0, 0.3, 0.6)
light(-20, 8, 15.5, (1.1, 0.9, 0.6), 20, 1)
collider(-20, 14, 0.4, 0.4, 0, 8)

collider(0, Z - D / 2 + 0.1, W, 0.4, 0, H)
collider(-W / 2 + 0.1, Z, 0.4, D, 0, H)
collider(W / 2 - 0.1, Z, 0.4, D, 0, H)
collider(-14, FZ, 8, 0.4, 0, H)
collider(8, FZ, 20, 0.4, 0, H)
collider(13, Z - 7.6, 3, 2, 0, 0.9)
collider(15, Z + 6, 1.4, 1.2, 0, 0.5)

frame_view()
result = 'hideout built'
