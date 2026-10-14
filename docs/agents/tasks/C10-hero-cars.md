# C10: the player's cars from outside models or Gemini 4 Argon

Owner: Claude. Asked by Jc on 2026-10-14: the five player cars (and the racers' copies of them) with
better bodies than the lofted ones in `vehicles/models.js`, from outside models or made by Gemini 4
Argon in the Gemini app. Status: Argon's second Hikari is in behind `?hero=hikari:hikari_300zr`
(0.10.49), with the side by side in `tools/shots/c10-*.png`. Jc chose on 2026-10-14 that Argon makes
all five, outside and inside (part 2 below); Cosmo's cars stay for the traffic, its `kamaro` kept in
reserve for the Rampart. Nothing replaces a lofted body until Jc has seen the two side by side and chosen.

## What a player car needs

A traffic kind is a body and its lamps. A player car is more, and all of it hangs off the loft today
(`CarModel` in `vehicles/models.js`, with `car.js` and `cockpit.js`): the body built from the stations;
the wheels CarModel makes itself at the spec's axles and track (so a model's own wheels are dropped);
the cockpit (`buildCockpit`) placed by the glass and the driver's side; the cockpit camera solved per
car; the head lamps at `kit.zMax`; the exhaust tips from `def.exhaust`; the tail spots for the glow
and the light trails (`tailSpots`); the plate; the paint and the accent. Before writing anything, read
those three files and list everything the loft feeds. A mesh body has to give each of them the same
answer, so the work is a mesh-body path in CarModel (the converted model in place of the loft, the
rest kept), with the lamp and tail spots read from the model's own lamp and tail faces.

## The frame and the five cars

The game's car frame: y up, the ground at y = 0, +z the car's front, +x the car's LEFT, the origin on
the ground under the center of gravity. The front axle is at `cgToFront`, the rear at
`cgToFront - wheelbase` (`specs.js`). The body numbers are the lofted body's (its stations plus the
bevel); the roof is the roof's edge, the crown sits a little higher.

| Car | Front axle | Rear axle | Track | Wheel radius | Body z | Width | Roof |
|---|---|---|---|---|---|---|---|
| Hayate RS-4 | +1.06 | -1.46 | 1.48 | 0.31 | -2.46 to +1.95 | 1.73 | 1.42 |
| Rampart 440 | +1.28 | -1.64 | 1.56 | 0.34 | -2.75 to +2.26 | 1.90 | 1.33 |
| Vespera GT | +1.54 | -1.11 | 1.62 | 0.33 | -1.94 to +2.57 | 2.00 | 1.14 |
| Tsurugi GT-X | +1.26 | -1.52 | 1.58 | 0.335 | -2.49 to +2.17 | 1.94 | 1.31 |
| Hikari 300ZR | +1.20 | -1.32 | 1.46 | 0.31 | -2.29 to +2.30 | 1.74 | 1.28 |

## Where the bodies come from

- Cosmo's Low Poly Cars, free (CC0; downloaded for 0.10.43, `assets/models/SOURCES.md`): its rally car
  for the Hayate (loose: a hatchback, and the Hayate is a boxy four-door), "kamaro" for the Rampart,
  "lamb" or "ghini" for the Vespera. The unpacked pack was left in the session scratchpad of
  2026-10-14 (`C:\Users\1carl\AppData\Local\Temp\claude\C--GitHub-Lowbeam\87323906-a2c8-474c-9592-16fd324b2e02\scratchpad\dl-cosmo-cars\unpacked\lowpoly_cars_free\GLTF\`);
  if it is gone, download it again with Jc's go.
- Gemini 4 Argon in the Gemini app, Task mode: nothing outside fits the Tsurugi or the Hikari, so they
  are Argon's trial, the Hikari first. Jc runs the brief below as a new Task and downloads what it
  makes (the .glb, its build script, four renders) from the task's Files into
  `G:\My Drive\Lowbeam\from-gemini\`.
- Not usable as they are: RG Poly's free cars face +x (a turn option in the converter would open them),
  Innerscene's are 16,000 to 19,000 triangles.

## Steps

1. The converter (`tools/import-glb.mjs`): a .glb's material names come through to the parts (today
   only an FBX's do); a material named exactly `paint`, `glass`, `lamp`, `tail`, `trim`, `under`,
   `plate`, `tire` or `rim` is that part with no hue rules, and any other name keeps its own color,
   unlit (`signal`, the amber corner lamps); an option drops the model's wheels (`wheel_*` nodes) for a
   player car, whose wheels CarModel makes.
2. Check the model against the frame before wiring anything: the arches over the axles, the length,
   width and roof against the table, the body within 2,000 triangles, every part present; in
   `tools/props.html?day=1` and at night.
3. The mesh-body path in CarModel, chosen by the body def (a model name in place of the stations),
   keeping the cockpit, the wheels, the camera solve, the head lamps, the exhaust, the tail spots and
   the plate. A test in the style of `kind-models.test.mjs` for each hero model: the parts present,
   the size within the spec's, the lamp faces in the front quarter and the tail faces in the back.
4. Side by side for Jc: the lofted Hikari and Argon's, in the garage, in the chase view and the
   cockpit, at night and by day. Jc decides.
5. If Argon's is better, the Tsurugi by the same brief with its own numbers, then Cosmo's three.
6. Each model recorded in `SOURCES.md` (Argon's: made for Jc in the Gemini app, Jc's to use), the
   changelog and the guide.

## Argon's first Hikari (2026-10-14, the overseer's review)

`hikari_300zr.glb` with its build script (Python, numpy and pillow, its own flat-shaded renderer) and
four renders. It reads at once as a 1984 wedge coupe: pop-up lamps, a greenhouse with real pillars, a
2+2 quarter window, hood vents, door handles, a louvered full-width tail bar, a ducktail; 1,700
triangles, every material named as asked, the wheels separate. Against the lofted Hikari (a smooth
shape with a single dark canopy and no panel detail) it is a clear step up, so the trial goes on.
Its faults, sent back to Argon as a revision round:
- It was built to the first brief's wrong rear (z -2.39, the exhaust tips): 4.70 m long against the
  lofted 4.59. The rear overhang comes in 0.10 m.
- The raised pop-up pods are thin tilted plates with fins, which read as horns from the side; they
  should be solid boxes about 0.38 wide, 0.13 tall and 0.26 deep, the lens on the front face.
- Its own exhaust tips double the ones the game draws (`def.exhaust`): removed.
- The amber corner lamps are `lamp`, so they would light as head lamps and take head lamp glows:
  their own material, `signal`.
- Some door and fender quads are not planar and show crumpled shading; the game smooths a car's
  normals under a 38 degree crease (`smoothNormals`), which hides most of it, but planar panels are asked for.

## The brief for Argon (Gemini app, a new Task, model Argon)

For the Tsurugi, swap the car paragraph and the numbers from the table.

```text
Build a low poly 3D car body for my PS1-style night driving game and deliver it as a binary glTF file (.glb).

The car: the HIKARI 300ZR, a fictional 1984 Japanese turbo GT coupe (2+2) in the spirit of that era's wedge sports coupes, but copying no real car, badge or logo. Long low hood, pop-up headlamps shown raised, a sharply raked windshield, a long fastback rear glass, a full-width tail lamp bar across the back, slim bumpers, a low wide stance.

The exact frame (meters; these must match or it will not fit my game):
- y up, the ground at y = 0; +z is the car's FRONT; +x is the car's LEFT side.
- The origin is on the ground between the axles: front axle at z = +1.20, rear axle at z = -1.32.
- Wheel centers at x = +-0.73, y = 0.31; wheel radius 0.31. The wheel arches sit on those centers.
- The body runs from z = -2.29 (rear bumper) to z = +2.30 (front bumper), 1.74 wide at the doors (mirrors may stick out), the roof at about 1.30.

Style and budget: 1,200 to 2,000 triangles for the body, flat shaded, plain colors, no textures. Use exactly these material names:
paint (the body color; make it white, the game tints it), glass, lamp (the head lamp lenses, on faces looking forward), tail (the tail lamp bar, on faces looking back), trim (black strips, grille, window frames, mirrors), under (the underside and wheel wells), plate (plain light grey plates front and back).
Add four separate simple wheels (12-sided cylinders, materials tire and rim) named wheel_fl, wheel_fr, wheel_rl, wheel_rr, so the arches can be checked. No interior.

Work in rounds: build it in code, render it, look at your render against this brief (proportions, arches on the axles, roofline, stance, the era's look), and fix. At least five rounds. Deliver in this task's Files: the .glb, the script that builds it, and four renders (front three quarter, rear three quarter, side, top).

If the computer has no 3D software, install what you need (for example trimesh or pygltflib), or write the .glb and a simple flat-shaded renderer yourself with numpy and pillow. Do not skip the renders.
```

## Part 2: Argon makes all five, outside and inside (Jc, 2026-10-14)

Jc's choice, after looking at Cosmo's candidates: only the `kamaro` fits its car (the Rampart); the
`rally` is a modern hatchback where the Hayate is a boxy 1990s four-door, and `lamb` and `ghini` are
modern supercars where the Vespera is a 1970s to 80s wedge. Cosmo's soft rounded style beside Argon's
crisp facets would also show. So Argon makes every player car's body and its interior, made to the
car's own numbers, and they match because one hand makes them all.

**What Argon makes, per car:** the body (part 1's brief), and the interior as its own .glb in the same
frame, built inside its own body (the glass, pillars and belt line from the body's script, so nothing
gaps): the dash in the style of the car and its era, the instrument housings, the center console and
shifter, the seats (the rear ones on a 2+2), the door cards, the headliner, the inside of the pillars,
the mirror, and the steering wheel as its own node.

**What the game keeps doing (CCC hooks it up):** the steering wheel turning (`steer` node, spun about
its own axis); the instruments live, painted by the existing painters (`dash.js`, `instruments.js`,
`screens.js`) onto Argon's faces and their needles turned; the map on the dash screen (the minimap's
picture, `radarFrame`, drawn to the `screen_tablet` or the built-in screen's face); the head lamps and
their beams from the `lamp` faces (`headSpots`, 0.10.49); the tail lamps, their glow and the light
trails from the `tail` faces (`tailSpots`).

**Instruments are real, never a flat picture.** Each car keeps the instrument style it has now
(`DASHES` in `dash.js`: the Hayate's classic black dials and aftermarket racing tach and boost pod, the
Rampart's cream speedometer and tach, the Vespera's yellow dials, the Tsurugi's LCD cluster and three-
gauge center stack, the Hikari's green and amber fluorescent display), modeled as a real car's: a hood
over the cluster, each dial a recessed face in a bezel with depth, the needle in front of the face. A
2D picture of the HUD speedometer laid on the dash is the mistake not to repeat. Argon models the
housings to `DASHES`' layout (each pod's width and height, each gauge's place `u, v` and radius `r`,
scaled as one), and marks each dial with an empty node `gauge_<type>` at the face's center, its +z
facing the eye; a screen pod (the Hikari's VFD, the Tsurugi's LCD) is one flat face named
`screen_cluster` with UVs 0 to 1. The game puts its painted face and its needle at each `gauge_*`.

**The dash screens follow the car's real era (Jc).** A car whose real counterparts came with a screen
gets it built in, in that era's style: the Tsurugi, a modern GT, a color screen in the center stack
(`screen_center`). The cars too old for one (the Hikari, the Rampart, the Vespera, the Hayate) get the
same generic tablet on a bracket in the middle of the dash, as if the owner had modded it in: one
model, `tablet.glb` (its face `screen_tablet`, its origin at the bracket's foot), placed in each of
these interiors at an empty node `tablet_mount`. While the cockpit view shows the dash map, the HUD's
minimap circle hides (a setting keeps it).

**The steering wheel sits where a real one does**, not 20 cm from the eye as the loft's does today
(`cockpit.js`): its hub about 0.45 to 0.5 m ahead of the eye and 0.3 m below it, its plane raked
about 25 degrees (top toward the driver), 0.36 to 0.38 m across, the cluster seen over its rim.

**Order.** The Hikari's interior first (the trial for interiors; it has no dials, so the Tsurugi's
center stack is the first test of `gauge_*`), with the tablet. Then one car at a time, outside and
inside together: the Tsurugi, then the Hayate, the Rampart and the Vespera. CCC's part per car: convert
both models, the cockpit loader in place of `buildCockpit` for a car with an interior model (the
camera solve kept), the hooks above, the side by side for Jc. The dash map's drawing waits for the
bug-bash to clear; the screen faces go in now so no interior is remade for it.

**The Hikari's cockpit numbers (from the game, 0.10.49):** the driver on the right (x negative, since
+x is the car's left); the cockpit camera at x -0.351, y 1.141, z -0.150, looking toward +z pitched
down 0.17 rad, vertical field of view 68 degrees, 16:9; the windshield from its base at z 0.95 to the
roof's edge at z 0.08.
