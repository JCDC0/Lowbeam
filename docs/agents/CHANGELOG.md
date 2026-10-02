# Changelog

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
