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
  `gas-station`, `rally-dressing`, `world` (so `scatter.js` is pure), and
  `src/vehicles/{specs,surfaces,physics,gauges}.js`.
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
| `index.html`, `style.css` | Page shell with the import map; all UI styles and the display font |
| `src/main.js` | Boot, state machine (title, garage, loading, drive, pause, free), `window.__lowbeam` |
| `src/drive.js` | Free roam: fixed-step loop, collisions, cameras, refuel, tow, reset, area names |
| `src/core/input.js` | Keyboard and standard-mapping gamepad; menu actions; `drive(dt)` with keyboard ramps |
| `src/core/store.js` | localStorage wrapper (`lowbeam.v1`): car, paints, money, settings |
| `src/ui/garage.js` | Showroom scene, turntable, the car card with bars and paints |
| `src/ui/menus.js` | Title, loading, pause and toast DOM screens |
| `src/ui/hud.js` | Driving HUD: area name, money, prompt, minimap slot, cluster slot |
| `src/ui/minimap.js` | Rotating canvas minimap with roads, pads, station and rally icons |
| `src/world/collision.js` | Pure: circles and oriented boxes in a grid; car as three circles; impulses |
| `src/vehicles/car.js` | `Car`: physics state, model, two spot headlights, cockpit, interpolated pose |
| `src/render/cameras.js` | `CameraRig`: chase, hood, bumper, cockpit |
| `assets/fonts/` | Michroma (SIL OFL, `OFL.txt`), the Microgramma-style display face |
| `src/world/layout.js` | Authored data: roads, stations, rally config, economy |
| `src/world/heightfield.js` | Natural terrain (`baseHeight`), blur, the carved grid and triangle sampling |
| `src/world/spline.js` | Arc-length Catmull-Rom `Path`: sample, nearest, signed offset |
| `src/world/roads.js` | Road profiles (smoothing, grade clamp, bumps, junction blending), grid queries |
| `src/world/ground.js` | `Ground.at(x, z)`: height and surface from roads, then pads, then terrain; carving |
| `src/world/scatter.js` | Pure placement: lamps, trees, buildings, station furniture, baked lights, colliders |
| `src/world/build-terrain.js` | Chunked terrain mesh (same diagonal as `Heightfield.at`), lake surface |
| `src/world/build-roads.js` | Road ribbons with skirts, forecourt pads with curbs |
| `src/world/props.js` | Street lamps, instanced tree chunks, town buildings with windows, konbini, neon |
| `src/world/gas-station.js` | Canopy, pumps, kiosk, brand sign; service park tents, floods, rival cars |
| `src/world/world.js` | `World.create(step)`: builds the scene in stages; `update(camera, focus)` |
| `src/render/bake.js` | `LightGrid`, `bakeGeometry` (the `bake` attribute), `sampleLight` for movers |
| `src/render/sky.js` | Gradient dome, stars, moon; `MOON_DIR` |
| `src/vehicles/specs.js` | The three cars: bars, mass, engine, gears, tires, steering, fuel, paints |
| `src/vehicles/surfaces.js` | Grip, slip peak, slide falloff and rolling resistance per surface |
| `src/vehicles/physics.js` | 120 Hz bicycle model, gearbox, traction control, jumps, fuel |
| `src/render/stage.js` | Renderer, 240-line target, dither and 15-bit quantize post pass, `shot()` |
| `src/render/psx.js` | Material factory with vertex snapping and baked light |
| `src/render/builder.js` | `MeshBuilder`: flat-shaded quads, boxes, cylinders into grouped geometry |
| `src/render/textures.js` | Canvas-drawn textures: glass, rims, plates, shadow, noise |
| `src/vehicles/models.js` | Loft modeler (`Kit`), body data per car (`BODIES`), `CarModel`, `buildCockpit` |
| `tools/sim.mjs` | Headless tuning bench for the cars |
| `tools/models.html` | Dev model viewer: the three cars on a floor, orbit, views, `shot()` |

## Current state (0.1.4)

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

- Render plumbing runs in the browser: `stage.js`, `psx.js`, `builder.js`.
- Car models (`src/vehicles/models.js`), seen in `tools/models.html`. Each body is
  lofted from 9 to 11 cross sections plus 7 arch stations per axle. A station is
  `[z, y0, w0, y1, w1, y2, w2, y3, w3]`: rocker bottom, shoulder, belt line, roof edge
  (half widths). The ring runs right side bottom to roof, then left side roof to bottom
  (local +X is the car's LEFT). Bands: lower side, upper side, greenhouse side (glass by
  z range), roof (glass for windshield and rear window by z range), underside. Arch
  stations raise y0 on a circle of radius `wheelRadius + 0.08` and flare the fender.
  `Kit` has helpers that put parts on the surface: `face` (end faces), `top` (follows the
  roof band), `side`, `stripes`, `ducktail`. Bodies come out at 520 to 630 triangles
  plus 40 per wheel. Wheels: pivot (steer about Y) > spin (rotation.x = wheelAngle) >
  mesh (rotated PI for right-side wheels). `CarModel.pose(state, dt)` places the car
  from a physics state and adds body roll and pitch. Material keys: paint, accent,
  glass, trim, under, chrome, lamp, tail, plate, tire, rim.
- Title screen and garage (`index.html`, `src/main.js`, `src/ui/garage.js`). Enter on
  the title opens the garage. Left and right change the car, up and down the paint,
  Esc goes back. The choice persists in localStorage. The camera centers the car in
  the space the card leaves free. Enter in the garage only shows a toast until the
  world exists.
- Display font: CSS family `Lowbeam Display` tries `local()` Microgramma D Extended
  and Eurostile Extended, then the vendored Michroma.
- World meshes (`World.create`, about 0.75 s): 10 by 10 terrain chunks with vertex
  colors per surface and a detail texture, road ribbons (7 columns: skirt, edge, three
  across, edge, skirt; higher priority roads sit 12 mm per priority higher so junctions
  never z-fight), concrete pads with curbs, 56 sodium street lamps, about 100 town
  buildings (two konbini, vertical neon signs), about 25k instanced trees in 250 m
  chunks hidden past the fog, three gas stations, the service park with tents,
  floodlights and two rival cars, the lake, sky and moon. A town street view draws
  about 70 calls and 165k triangles.
- Light: moonlight (directional) and a sky fill (hemisphere) are the only real lights.
  `scatter.js` lists about 170 baked lights (lamps, canopies, kiosks, konbini, neon,
  floods). `bakeGeometry` writes them into the `bake` attribute of static meshes; parked
  cars bake too (`CarModel(spec, paint, { light: 'baked' })`). Moving things use the
  local light instead: `World.update(camera, focus)` samples the same lights at the
  player car and sets `psxUniforms.uLocalColor` and `uLocalDir`; materials made with
  `local: true` add it. Light colors above 1 are deliberate: the bake multiplies
  albedo, and night albedos are dark.
- Driving (`src/drive.js`). Enter in the garage builds the world once (about 0.75 s)
  and puts the chosen car beside a pump at G1. Physics steps at 120 Hz in a fixed-step
  loop; the car is drawn interpolated between steps. Controls: W S or arrows for
  throttle and brake (hold brake at rest for reverse), A D steer, Space handbrake, C
  camera, R back onto the nearest road (or a tow for 5,000 yen when the tank is dry),
  E held at a pump to refuel (3 L/s, 168 yen/L), Esc pause (resume, garage, title).
  Gamepad: RT and LT, left stick, A or X handbrake, Y camera, B refuel, Back reset,
  Start pause. Keyboard throttle ramps to full in about 0.3 s and steering in about
  0.3 s; triggers and stick are read directly.
- Collisions (`src/world/collision.js`): the car is three circles of half its width;
  trees, lamp poles, canopy pillars, sign poles and tent legs are circles; buildings,
  kiosks and pump islands are oriented boxes; the valley edge is a wall. Contacts push
  the car out and apply an impulse at the contact point (restitution 0.22, friction
  0.35), so glancing hits turn the car. Driving into the lake resets onto the road.
- Cameras (`CameraRig`): chase (damped, leans toward the direction of travel in a
  slide, FOV 62 to 78 with speed), hood, bumper and cockpit. The cockpit is a lofted
  interior (`buildCockpit`): dash, binnacle, gauge face (dark until the cluster
  lands), steering wheel turning at 4.5 times the road wheel angle, A-pillars, header,
  liner, door panels, mirror, console and passenger seat. It rides in the leaning body.
- Headlights: two spot lights per car (320 cd, decay 1.35, 95 m). Physical units:
  weaker values vanish on the dark ground.
- HUD: area name (fades), money, prompts, the minimap (rotates with the car, zooms
  out with speed, north marker, station and rally start icons) and a plain digital
  speed, gear and fuel readout that the gauge cluster replaces next.
- `__lowbeam.simulate(seconds, input)` runs the drive loop without frames, for checks
  in a hidden tab; `__lowbeam.setState('free')` gives the development free camera.
- Tests: 18 passing (splines, ground and pads, stage grades, bars vs sim, braking,
  reverse, jumps, lamp, tree, building and pump placement, wall and pole impacts,
  push-out, valley edge). `npm run check` is clean. CPU time for one drive update and
  render is about 2 ms in the browser pane.

Not started: the gauge cluster and everything after it in the build order in
`docs/DESIGN.md`.

## Next steps (in order)

1. **Gauge cluster** (requested by Jc): see the HUD section of `docs/DESIGN.md`.
   Arcade-style round tach plus FUEL, WATER, BOOST or INTAKE, EXH sub-gauges, bottom
   right, canvas-drawn. Add `src/vehicles/gauges.js` (pure) for the simulated values.
   The font is already vendored (see Current state).
2. **Rally**: start, countdown, checkpoints, pace notes from curvature, results,
   ghost. Config is `RALLY` in layout.js (start at s = 130 m).
3. Audio, settings (the pause menu exists; add settings to it). Then look at every part in the browser and tune.

## Verification

The game is verified by looking at it. Start the dev server, open the page in a
browser, and use `window.__lowbeam` (set in `main.js`) to force a state
(`setState('garage')`) and call `shot(name)`, which re-renders the last drawn scene
and writes `tools/shots/<name>.png`. `tools/models.html` does the same for the bare
car models. The first session ran
on a Linux laptop with weak graphics; continue on the gaming desktop for real frame
rates.

## Open work and known issues

- RWD cars spin on gravel at full throttle and full lock (Rampart and Vespera reach
  90 degrees of slide in the bench). Intended character; the keyboard throttle ramp
  exists now (`RAMP` in input.js). Needs a real drive with hands on the keys to judge.
- The Hayate shows a light yaw oscillation in a high-speed step steer. Watch it in play.
- Lamp pools on Route 7 in town overlap into an even wash at 34 m spacing. Check from
  the driver's seat; shorter range or wider spacing gives distinct pools.
- The valley floor inside Route 7 is empty. Candidates: rice fields, a rail line, a
  second town block. Not needed for this milestone.
- `Ground.at` scans every pad on each call. Fine with 3 pads; add a grid if pads grow.
- Neon signs draw Japanese text with the system font (Yu Gothic, Meiryo, MS Gothic or
  Noto Sans CJK). A machine without any of them shows boxes.
