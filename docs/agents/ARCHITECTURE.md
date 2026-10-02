# Lowbeam: agent guide

The canonical guide for any agent (Claude, Hermes, Antigravity) working in this repo.
`CLAUDE.md`, `AGENTS.md` and `GEMINI.md` only point here. The design plan, with the
reasoning behind every system, is `docs/DESIGN.md`. Read both before changing code.

## What this is

A PS1-style night driving game in the browser. The long-term target is an open-world
street racer in the line of Night-Runners Prologue and Need for Speed: Most Wanted
(2005). The current milestone tests the limits with one level: the Kirigaoka valley,
three cars (Hayate RS-4 tuner, Rampart 440 muscle, Vespera GT exotic), three gas
stations and one gravel rally stage (SS1 Kirigaoka Ridge).

## Commands

| What | Command |
|---|---|
| Install | `npm install` (dev only: `three` for types, `typescript`) |
| Run | `npm start`, then open http://localhost:8040 |
| Test | `npm test` (`node --test tests/*.test.mjs`) |
| Type-check (the lint step) | `npm run check` (`tsc`, JSDoc types, no emit) |
| Car tuning bench | `npm run sim` (`node tools/sim.mjs`) |

No build step and no bundler. The browser loads `src/` directly through the import map
in `index.html`. Three.js r185 is vendored in `vendor/` (copied from
`node_modules/three/build/`). `tools/devserver.mjs` serves with no-store caching and
accepts `POST /__shot` to write a canvas capture to `tools/shots/` (git-ignored).

## Conventions

- Commit message: version prefix, then a sentence, then a body. Example:
  `0.1.1: Add the loft modeler and the three car bodies`. End with the
  Co-Authored-By trailer when an agent made the commit.
- Version lives in `package.json` and in `docs/agents/CHANGELOG.md`. Bump both.
- Pure modules never import `three` or touch the DOM: `src/core/mathx.js`,
  `src/core/rng.js`, everything in `src/world/` except files named `build-*`, `props`,
  `gas-station`, `rally-dressing`, `world`, and `src/vehicles/{specs,surfaces,physics,gauges}.js`.
  Tests import only pure modules.
- Units are meters, seconds, kilograms. North is -Z, east is +X.
- Yaw 0 faces +Z. forward = (sin yaw, cos yaw), left = (cos yaw, -sin yaw). Path
  lateral offsets `d` are positive to the left of travel. Input steer is positive to
  the right and is negated inside physics.
- Every material comes from `src/render/psx.js` so it gets vertex snapping and,
  where wanted, baked vertex light (`bake` attribute).
- Code style: no single-line explanatory comments; doc comments on exported APIs
  and comments that record why a choice was made are fine. No em dashes anywhere.
- When behavior changes, update this file and the changelog in the same commit.
- Do not edit `vendor/`. Do not commit `node_modules/` or `tools/shots/`.

## Key files

| File | Role |
|---|---|
| `docs/DESIGN.md` | The plan: pillars, cars, map, driving model, rally, HUD, build order |
| `src/world/layout.js` | Authored data: roads, stations, rally config, economy |
| `src/world/heightfield.js` | Natural terrain (`baseHeight`), blur, the carved grid and triangle sampling |
| `src/world/spline.js` | Arc-length Catmull-Rom `Path`: sample, nearest, signed offset |
| `src/world/roads.js` | Road profiles (smoothing, grade clamp, bumps, junction blending), grid queries |
| `src/world/ground.js` | `Ground.at(x, z)`: height and surface from roads, then pads, then terrain; carving |
| `src/vehicles/specs.js` | The three cars: bars, mass, engine, gears, tires, steering, fuel, paints |
| `src/vehicles/surfaces.js` | Grip, slip peak, slide falloff and rolling resistance per surface |
| `src/vehicles/physics.js` | 120 Hz bicycle model, gearbox, traction control, jumps, fuel |
| `src/render/stage.js` | Renderer, 240-line target, dither and 15-bit quantize post pass, `shot()` |
| `src/render/psx.js` | Material factory with vertex snapping and baked light |
| `src/render/builder.js` | `MeshBuilder`: flat-shaded quads, boxes, cylinders into grouped geometry |
| `tools/sim.mjs` | Headless tuning bench for the cars |

## Current state (0.1.0)

Done and tested:

- World data and ground. Route 7 loop (2.8 km asphalt), three town streets, SS1 gravel
  stage (2.9 km, climbs to about 85 m, grades capped at 13 %, one jump crest), three
  gas station pads, a lake. Terrain is carved under every road and pad. Ground build
  takes about 0.4 s.
- Vehicle physics for all three cars, tuned so the garage bars are honest. Bench
  output (`node tools/sim.mjs`):

  | Car | 0-100 | 1/4 mile | Top | 100-0 | Grip tarmac / gravel |
  |---|---|---|---|---|---|
  | Hayate RS-4 | 4.76 s | 13.20 s | 203 km/h | 40.9 m | 1.04 g / 0.80 g |
  | Rampart 440 | 4.80 s | 12.48 s | 245 km/h | 42.8 m | 0.93 g / 0.61 g |
  | Vespera GT | 4.92 s | 12.65 s | 293 km/h | 34.7 m | 1.10 g / 0.59 g |

- Render plumbing written but not yet seen running: `stage.js`, `psx.js`, `builder.js`.
- Tests: 11 passing (splines, ground and pads, stage grades, bars vs sim, braking,
  reverse, jumps). `npm run check` is clean.

Not started: there is **no `index.html` and no playable page yet**. Everything from
step 4 of the build order in `docs/DESIGN.md` remains.

## Next steps (in order)

1. **Car models** (`src/vehicles/models.js`). Loft each body from cross sections. Each
   station is `[z, y0, w0, y1, w1, y2, w2, y3, w3]`: rocker bottom, shoulder, belt line,
   roof edge (half widths). The ring has 8 points: right side bottom to roof, then left
   side roof to bottom (local +X is the car's LEFT). Bands between rings: lower side,
   upper side, greenhouse side (glass or paint by z range), roof (glass for windshield
   and rear window by z range), underside. Insert extra stations at each axle to cut
   wheel arches by raising y0 (axle +-0.46, +-0.36, +-0.2, 0). Caps: front fan winds
   (center, k+1, k), rear fan (center, k, k+1). Origin is the center of gravity on the
   ground, +Z forward, front axle at `cgToFront`, rear at `-(wheelbase - cgToFront)`.
   Wheels: pivot (steer about Y) > spin (rotation.x = wheelAngle) > mesh (rotated PI
   for right-side wheels). Parts: lamps (emissive), tail lights (brighten on brake),
   grille, mirrors, plates, exhausts; Hayate hood scoop, wing, mudflaps, gold rims;
   Rampart hood scoop, twin accent stripes lofted over the roofline, ducktail;
   Vespera wedge nose, cab-forward glass, black engine louvers, side intakes, wing.
   Material keys: paint, accent, glass, trim, under, chrome, lamp, tail, plate, tire, rim.
   Paint uses Phong with a little specular; glass gets a diagonal highlight texture.
2. **Garage turntable** and title screen (`index.html`, `style.css`, `src/main.js`).
3. **World meshes**: terrain (same diagonal as `Heightfield.at`), road ribbons with
   skirts (`SKIRT`, `SINK` in roads.js), town, street lamps, trees (instanced), the
   three gas stations, sky, and the light baker that writes the `bake` attribute.
4. **Driving**: cameras (chase, hood, bumper, cockpit), collisions, input with a
   throttle ramp for keyboards, minimap, fuel and refuel.
5. **Gauge cluster** (requested by Jc): see the HUD section of `docs/DESIGN.md`.
   Arcade-style round tach plus FUEL, WATER, BOOST or INTAKE, EXH sub-gauges, bottom
   right, canvas-drawn. Add `src/vehicles/gauges.js` (pure) for the simulated values.
   Vendor Michroma (OFL) into `assets/fonts/` with `OFL.txt`; font stack
   `local("Microgramma D Extended"), local("Eurostile Extended"), Michroma`.
6. **Rally**: start, countdown, checkpoints, pace notes from curvature, results,
   ghost. Config is `RALLY` in layout.js (start at s = 130 m).
7. Audio, settings, pause menu. Then look at every part in the browser and tune.

## Verification

The game is verified by looking at it. Start the dev server, open the page in a
browser, and use `window.__lowbeam` (to be added in `main.js`) to force a state and
call `stage.shot(name)`, which writes `tools/shots/<name>.png`. The first session ran
on a Linux laptop with weak graphics; continue on the gaming desktop for real frame
rates.

## Open work and known issues

- RWD cars spin on gravel at full throttle and full lock (Rampart and Vespera reach
  90 degrees of slide in the bench). Intended character, but keyboard players will
  need the throttle ramp from step 4. Re-check after the first real drive.
- The Hayate shows a light yaw oscillation in a high-speed step steer. Watch it in play.
- The valley floor inside Route 7 is empty. Candidates: rice fields, a rail line, a
  second town block. Not needed for this milestone.
- `Ground.at` scans every pad on each call. Fine with 3 pads; add a grid if pads grow.
