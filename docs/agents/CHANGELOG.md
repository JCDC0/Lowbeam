# Changelog

## 0.1.5 (2026-10-02)

Arcade gauge cluster.

- `src/vehicles/gauges.js` (pure): coolant temperature, turbo boost with spool lag and
  blow-off on shifts (Hayate), manifold vacuum (Rampart, Vespera), exhaust gas
  temperature, shift light. `engine.turbo` in the Hayate spec. Tests.
- `src/ui/cluster.js`: canvas cluster in the bottom right with a round tach, red zone,
  shift lights, digital speed and gear, and FUEL, WATER, BOOST or VAC, EXH dials, set
  in Michroma. `drawDash` paints the same readings onto the cockpit binnacle.
- The cockpit binnacle sits higher, in the upper opening of the steering wheel. The
  interim digital readout is gone.

## 0.1.4 (2026-10-02)

Driving.

- `src/drive.js`: free roam in the valley with a fixed 120 Hz step and interpolated
  drawing, refueling at the pumps, tows when the tank runs dry, R back onto the nearest
  road, a lake guard, area names and money that persists.
- `src/world/collision.js` (pure): circles and oriented boxes in a grid, the car as
  three circles, contact impulses that turn the car on a glancing hit. Tests.
- `src/vehicles/car.js`: physics state, model, two spot headlights, cockpit, pose.
- `src/render/cameras.js`: chase, hood, bumper and cockpit cameras.
- `buildCockpit` in models.js: dash, binnacle, gauge face, turning steering wheel,
  pillars, header, liner, door panels, mirror, console and passenger seat.
- `src/core/input.js`: driving axes with keyboard ramps, gamepad triggers and stick,
  camera, reset, refuel and pause actions.
- `src/ui/hud.js`, `src/ui/minimap.js`, pause menu in `src/ui/menus.js`.

## 0.1.3 (2026-10-02)

World meshes.

- `src/world/scatter.js` (pure): street lamps from the road `lamps` runs, about 25k
  trees on a jittered grid, town buildings along the streets (two konbini, neon signs),
  gas station furniture, about 170 baked light sources and the collider lists.
- Builders: chunked terrain with per-surface vertex colors and the same diagonal as
  `Heightfield.at`; road ribbons with skirts and painted lines; forecourt pads with
  curbs; lamps; instanced tree chunks; town with lit windows; three gas stations with
  canopies, pumps, kiosks and brand signs; the service park with tents, floodlights and
  two parked rival cars; the lake; a sky dome with stars and the moon.
- `src/render/bake.js`: light grid, per-vertex bake and a light sampler for moving
  objects. `psx.js` materials take `local: true` for the sampled light; cars use it.
- Garage Enter now builds the world (about 0.75 s) and opens a free camera at G1.
- Tests for lamp, tree, building and pump placement (14 tests).

## 0.1.2 (2026-10-02)

Title screen and garage.

- `index.html`, `style.css` and `src/main.js`: the first playable page. Boot, a
  title, garage state machine and `window.__lowbeam` for browser checks.
- `src/ui/garage.js`: showroom with a turntable, spot and rim lights and neon strips.
  The card shows maker, name, class, blurb, the three bars as ten-segment meters,
  layout, engine, gearbox, weight and four paint swatches. Keyboard, gamepad and mouse.
- `src/core/input.js` (keyboard and gamepad menu actions), `src/core/store.js`
  (localStorage), `src/ui/menus.js` (title, loading, toast).
- Michroma (SIL OFL) vendored in `assets/fonts/` with its license. The CSS stack
  prefers an installed Microgramma or Eurostile Extended.
- `stage.shot()` re-renders the last drawn scene instead of the default one.

## 0.1.1 (2026-10-02)

Car models.

- `src/vehicles/models.js`: loft modeler that builds each body from cross sections,
  cuts wheel arches with extra stations at each axle and flares the fenders. Part
  helpers place lamps, grilles, plates, scoops, wings, stripes, louvers and intakes on
  the body surface. `CarModel` adds wheels (steer and spin), a blob shadow, paint
  swaps, brake lights and body lean.
- Hayate RS-4: boxy sedan, hood scoop, big wing, mudflaps, gold six-spoke rims.
  Rampart 440: long hood, fastback, hood scoop, twin stripes, ducktail, chrome
  bumpers. Vespera GT: wedge nose, cab-forward glass, engine louvers, side intakes,
  carbon sills, wing, quad exhausts.
- `src/render/textures.js`: canvas-drawn glass, rim, plate and shadow textures.
  `psxPhong` in `src/render/psx.js` for paint, glass and chrome.
- `tools/models.html`: dev viewer for the models.

## 0.1.0 (2026-10-02)

First commit. Plan, scaffold and the pure core.

- `docs/DESIGN.md`: the plan for the night rally milestone, including the arcade gauge
  cluster, the cockpit camera and the long-term open-world direction.
- Scaffold: vendored Three.js r185, import-map setup, `tools/devserver.mjs` with canvas
  capture, `tsc` type-checking, `node --test`.
- World: seeded valley terrain, spline roads with smoothed and grade-clamped profiles,
  junction blending, carved heightfield, three gas station pads, `Ground.at`.
- Vehicles: three car specs and a 120 Hz bicycle-model physics with load transfer,
  traction control, automatic gearbox, reverse, jumps and fuel. Tuned so the garage
  bars match the sim.
- Render plumbing (not yet run): low-res target with dither and 15-bit quantize,
  PSX materials with vertex snapping and baked light, `MeshBuilder`.
- `tools/sim.mjs` tuning bench. 11 tests.
