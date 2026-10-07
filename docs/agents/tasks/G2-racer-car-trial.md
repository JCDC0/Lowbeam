# G2: A street racer as a Blender car, the trial (Assets)

The real test of the asset workflow: one complete car, modeled in Blender to the standard of the five
player cars, to replace a street racer that is today a coarse profile lofted in code. If it works,
every racer (and later the police units and the traffic) moves to Blender. Read
`docs/agents/ARCHITECTURE.md` (Conventions, Verification, Blender), `docs/agents/tasks/README.md` and
`G1-pursuit-props.md` (the same workflow) first.

Versions: your range, 0.9.50 to 0.9.69; take the next number after your last commit.

## The car: the Mazuma RX-Coupe (`rv-rotary`)

A 90s Japanese twin-rotor sports coupe in the spirit of the FD RX-7: low, wide and curvy, a long
sloping nose with pop-up headlights (model them raised, so they read at night), a smooth flowing
waist, a short cabin with a bubble rear window, a ducktail spoiler, round tail lamps. Red paint.

See what it replaces and the bar to meet: with `npm start` running, open
`http://localhost:8040/tools/bodies.html` and run `__bodies.show('rv-rotary')` (today's version), and
`http://localhost:8040/tools/models.html` (the five player cars: the standard).

## Dimensions (these are fixed; the physics and the traffic use them)

| | Value |
|---|---|
| Origin | On the ground at the center of gravity: front axle at z = +1.15, rear axle at z = -1.28 |
| Front faces | +z. The car's LEFT is +x (the game's convention for cars) |
| Length | nose at z = +2.03, tail at z = -2.25 (4.28 m) |
| Width | 1.76 m over the body (x from -0.88 to +0.88), mirrors may stick out to 1.0 |
| Height | roof at y = 1.22; hood about 0.82; nose about 0.56; deck about 0.86 |
| Wheels | radius 0.31, width 0.22, centers at x = +-0.74, y = 0.31, z = +1.15 and -1.28 |

## Materials (exactly these names; the game maps them to its car materials)

`paint` (the body color, 0xc8102e), `accent` (second color: black trim and the spoiler, 0x141414),
`glass` (0x1a2430), `trim` (black plastic: grille, mirrors, skirts, 0x1c1c1e), `under`
(underbody and wheel wells, 0x0c0c0c), `chrome` (0x9aa0a8), `lamp` (headlights, white, emissive),
`tail` (tail lamps, red 0xd01818, emissive), `plate` (0xe8e6d8), and for the viewer only `tire`
(0x151515) and `rim` (0xb8bcc4). Use the kit's `mat()`; no `tex` on any of them.

## What it needs

- A body that reads as one smooth, curved shape: build it from `loft()` cross sections (or bmesh
  directly) with enough stations to carry the curves, not from boxes. The game smooths normals under a
  38 degree crease, so keep hard creases only where the real car has an edge.
- Real wheel openings: arches cut into the body around each wheel, the wheel wells dark (`under`),
  the tires visible in them from the side. No body surface through a wheel.
- Glass as its own faces (windshield, side windows, the bubble rear window), set into the body.
- Details that make it a car at 480 lines: raised pop-up headlights, front intake and lip, side
  mirrors, side skirts, the ducktail spoiler, round tail lamps (two each side), twin exhaust tips,
  front and rear plates, a rear diffuser.
- Four wheels for the viewer: objects named `wheel-fl`, `wheel-fr`, `wheel-rl`, `wheel-rr` (tire
  and rim, about 200 triangles each). The game builds its own wheels from the dimensions above, so
  they are only for checking the arches.
- Budget: the body (everything except the wheels) 2,500 triangles at most.

## How to build and check it

1. Script `tools/blender/rv_rotary.py` in the style of the other scripts (a docstring with the car
   and its dimensions, the dimensions as constants at the top).
2. In Blender (MCP, port 9876; never `read_factory_settings`): exec `kit.py`, exec your script, then
   two exports:
   `export('rv_rotary', r'C:\GitHub\Lowbeam\assets\models\rv_rotary.json', only=lambda n: not n.startswith('wheel'))`
   (the body the game will use) and
   `export('rv_rotary_full', r'C:\GitHub\Lowbeam\assets\models\rv_rotary_full.json')` (with wheels,
   for the viewer). Viewport screenshots from the side, the front three quarter and the rear three
   quarter.
3. Open
   `http://localhost:8040/tools/props.html?models=rv_rotary_full,rv_rotary&smooth=38&budget=3200`.
   It draws both at night on a road beside the game's Hayate (a 4.4 m player car) with the game's
   shading. `__props.check()` must report no problems for both (the body alone stays under 2,500).
   Compare it with the Hayate and with `tools/bodies.html`: proportions, stance, how the curves read.
4. Shots with `__props.show(i)`, `__props.view(yaw, pitch, dist)` and `__props.shot('g2-<view>')`:
   side (yaw 1.57, pitch 0.08), front three quarter (yaw 0.6, pitch 0.15), rear three quarter
   (yaw 2.5, pitch 0.15), top (pitch 1.3), at 1280 by 720.

## Review of 0.9.51 (Claude) and the fix round

The process passed: own files only, clean commits, check() clean, 2,012 body triangles, the wheels sit
in real arches, the glass is its own faces, the raised pop-ups read at night. The car does not pass
yet. Measured from `assets/models/rv_rotary.json` and looked at in the viewer:

1. **The round tail lamps and the exhaust tips stand upright.** The kit's `cylinder` only stood on
   y, so the lamps are 1.5 cm discs lying flat (they read as red slits) and the tips are 12 cm tubes
   pointing at the sky. The kit now has `axis='z'` (0.9.2): `cylinder(name, m, x, y, z, r, h,
   axis='z')` runs from z to z + h, so a negative h points backward. Two round lamps each side
   facing back, about 0.06 radius; the tips run out the back and end at the tail with the dark bore.
2. **It is outside the fixed box.** z runs from -2.375 to +2.07 (the brief: -2.25 to +2.03) and the
   roof reaches 1.256 (the brief: 1.22). Tuck the lip, the intake and the plate inside the nose and
   end the tips at the tail.
3. **It reads as a generic 80s wedge, not the FD.** The beltline is one straight line nose to tail,
   the tail is a vertical slab under a black plank, the nose is a blunt box with a lip sticking out.
   What makes the FD:
   - front fenders that rise above the hood, the hood dipping between them;
   - rear hips wider than the cabin (the cabin pulls in above the waist), the waist dipping behind
     the door into the rear fender;
   - the rear deck curving down into a ducktail that is part of the body in paint, not a box in
     `accent`; the tail panel tucking in under it;
   - the bubble rear glass wrapping into the side glass, visible from the rear three quarter;
   - a low round nose with a wide oval mouth under it, the lip tucked under the nose.
4. **The shots are too far away to judge.** Take them at about 6 m so the car fills a third of the
   frame, and add a close rear shot (yaw 3.14, pitch 0.15) that shows the lamps and the tips.
5. **Say only what you measured.** The report called the lamps round and the roof 1.22 m; they were
   not. Quote numbers from `__props.check()` or the JSON.

You may model any way Blender allows, as long as `rv_rotary.py` rebuilds the car from an empty scene:
the exporter reads the evaluated mesh, so modifiers (subdivision, mirror, solidify, decimate) count as
they appear. The body budget stays 2,500 triangles.

The fix round is 0.9.52: re-export both models, the shots `g2b-side`, `g2b-front3`, `g2b-rear3`,
`g2b-rear`, `g2b-top` and `g2b-all-with-car` beside the Hayate, one commit, and a report with
before and after pairs.

## Done when

- `tools/blender/rv_rotary.py`, `assets/models/rv_rotary.json` and `rv_rotary_full.json`, check()
  clean, the body under 2,500 triangles, the shots above.
- One commit, your files staged by name, with the version bump and a changelog entry.
- A report: triangle counts, the shots, what was hard in Blender or the kit, and your honest view of
  how it compares with the player cars. Claude then wires it into the game in place of the lofted
  racer, using the game's own wheels.
