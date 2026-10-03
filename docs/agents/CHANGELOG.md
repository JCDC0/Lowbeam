# Changelog

## 0.4.0 (2026-10-03)

Traffic.

- `traffic/net.js`: the road network as 80 directed lanes with keep-left offsets, links for
  continuing roads, exits, entries and turns, and traffic lights at the 99 city crossings.
  Ramps carry `link` data (the arc lengths on the roads they join) from `roadgen.diamond`.
  Arterials are four lanes now (two each way).
- `traffic/sim.js`: about 38 agents with IDM following, red lights, bends, overtaking,
  chance exits and turns, spawn out of sight and despawn behind, wrecks.
- `traffic/kinds.js`, `bodies.js`, `render.js`: fourteen kinds drawn as boxy stand-ins, one
  InstancedMesh per kind with paint tint, lit like the player's car, head and tail lights
  with brake boost (`psx.js` gets a `lamp` option).
- `vehicles/contact.js`: car against car, used when the player hits traffic.
- `Drive` runs the traffic each frame, collides it with the player (camera shake and an
  impact sound) and fills the roads when a drive starts.
- Verified: headless runs of the network and the sim in three places, a lit downtown street
  and Route 1 in the browser.
- Tests: 100 passing (`traffic.test.mjs`: lanes, connectivity, lane geometry, lights, the sim over
  two minutes in three places, a red light, a collision, momentum).

## 0.3.3 (2026-10-03)

Route 1 gets its furniture, and the toll plazas work.

- `highway.js`: a concrete median barrier along the whole loop, steel guard rails on both
  outer edges, and three toll plazas. Rails and barrier leave gaps at ramps, forecourts and
  plazas. Every piece has a collider with a height range, so cars on the overpasses are not
  stopped by what is below them.
- `build-highway.js`: barrier and rail in 180 m chunks that are culled with the road; the
  plaza canopy, columns, islands, booths with lit windows, lane lights, barrier arms and a
  name board.
- `toll.js`: `TollMeter` detects the crossing, reads the speed and keeps the best per plaza.
  `Drive` charges the 700 yen toll, saves `tollBest`, and shows the speed trap result.
- Lane markings: expressway carriageways draw lane lines and tire bands; ramps draw edge lines only.
- Nothing grows or stands under an overpass deck (`clearOfRoads` now looks for decks).
- Verified by driving a Hayate through KITA TOLL at 161 km/h: 700 yen charged, toast shown, no collision.
- Tests: 92 passing (`toll.test.mjs`: crossing, cooldown, saved best, lanes, barrier and booth colliders).

## 0.3.2 (2026-10-03)

Kurogane replaces the Kirigaoka valley.

- A new 6 km map (`layout.js`, `heightfield.js`, `zones.js`, `roadgen.js`, `mapdata.js`):
  Route 1, a 11 km expressway loop of two 3-lane one-way carriageways with a median;
  four avenues that pass over it on overpasses with diamond interchanges; Kuro Pass
  (6.4 km, up to 254 m on a terrain ledge); a 20 street downtown grid with towers; the
  forest valley with Kami-ike; a bay in the south; four gas stations; three toll plaza
  positions; 70 km of road.
- Roads: twin carriageways share one height profile, closed roads obey the grade limit
  across the seam, junction blending spreads a correction over enough road to stay
  climbable and blends neighbouring junctions into each other.
- Terrain carving: a lifted road shapes the ground only where it is cut into it.
- Scatter: median lamps along the loop, lamp runs for a full road, no poles on decks, bigger
  and taller downtown buildings, trees by zone (forest outside the loop, farmland inside),
  buildings indexed in a grid (tree scatter went from 8.3 s to 0.6 s), nothing planted in the sea.
- Render: terrain and road ribbons in chunks hidden past the fog, a bay, the camera far plane.
- `buildMapData(ground)` for a full-screen map (roads, pois, zones).
- Tools: `tools/mapview.html` (top-down map with hillshade, `__map.shot()`) and
  `tools/mapcheck.mjs` (road numbers and crossings).
- Tests: 87 passing (new `layout.test.mjs`: roads inside the map, Route 1 closed with equal
  carriageway heights, interchange ramps, roads cross only at overpasses, tolls, zones,
  terrain, map data).

## 0.3.1 (2026-10-03)

Full-screen tactical map overlay, controls update, render height setting, and dynamic garage scaling.

- Tactical map overlay (Task A2): Tab key opens and closes a full-screen tactical map of the whole world, pausing simulation while continuing to render the 3D scene behind a translucent dark veil.
- Road hierarchy and POIs: cached offscreen road rendering sharing `drawRoads` with the minimap (thick white expressway, rally trails, mountain passes, arterials, and ramps). Displays gas stations with brand badges, rally start checkered flag, Kirigaoka valley zone names, north compass, adaptive scale bar, and vehicle arrow with live heading, model name, speed, and gear telemetry.
- Navigation controls: map supports click-drag and WASD/arrow panning, mouse wheel and +/- zooming, and Home recentering on the player vehicle.
- Keybinding conflicts resolved: interact key moved from E to F (`KEYS.interact = ['KeyF']` and `INTERACT_KEY = 'F'` in `src/drive.js`). Manual shift keys unified: shift up (`ShiftLeft`, `ShiftRight`, `KeyE`), shift down (`ControlLeft`, `ControlRight`, `KeyQ`). Map bound to Tab and gamepad Back / Select.
- Controls briefing screen updated with R, N, 1..7 manual gear order, Tab tactical map, F refuel & repair, C camera views (5 views), and R reset.
- Render height setting: added display scanline selector (240, 360, 480 lines) persisted under `store.get('renderHeight', 240)` and applied to stage configuration.
- Dynamic garage scaling (Task A6): garage card and selector handle any number of cars in `CARS` with left/right wrapping and responsive card sizing. Displays drivetrain layout, gear count (`${spec.gears.length}-SPEED`), and live transmission mode (`AUTO` / `MANUAL`). Clamps bar values cleanly to 10 segments.
- Unit tests: added `tests/map.test.mjs` (road hierarchy, POIs, and fallback data extraction) and `tests/garage.test.mjs` (spec metrics, 3-car and 5-car wrapping).

## 0.3.0 (2026-10-03)

Overpasses: roads can leave the ground.

- `lifts` on a road def raise it over the road it crosses (flat top, cosine ease), applied
  after junction blending. Above 2 m a road is a deck.
- `Ground.at(x, z, y)` and `RoadNetwork.query(..., y)` return a deck only to something at
  or above its surface. The physics passes the car's own height, so a car can drive over
  and under the same spot. Without `y` you get the ground, so props, trees and the terrain
  carve ignore decks.
- Collision shapes get `y0`/`y1` height ranges: deck parapets and piers no longer stop the
  traffic on the other level.
- `build-bridges.js`: slab sides that reach down to the ground on embankments, an underside,
  parapets and piers. `scatter.bridges` lists them with their wall and pier colliders.
- `roadgen.js`: helpers for the new map (offset paths, dual carriageways, street grids and
  ramps), in use from the next version.
- Verified in the browser with a temporary overpass on Route 7: the car climbs onto the
  deck, drives over a road it passes under, and comes back down.
- Tests: 74 passing (new `bridge.test.mjs`: lift profile, layered queries, terrain
  carve, a car under and over, collider heights).

## 0.2.4 (2026-10-03)

Dashboard repair, bold 240p cockpit cluster, and gauge contract implementation.

- Mirrored gauge fix: corrected gauge quad texture mapping in `src/vehicles/models.js` so
  driver's left (+X) maps to u=0 and driver's right (-X) maps to u=1. Verified with a test
  canvas showing un-mirrored text with red on driver's left and blue on driver's right.
- Sightline clearing: lowered binnacle hood to rise at most 4 cm above dash top (`beltY + 0.04`),
  recessed face low (`beltY - 0.19`) and tilted toward eye, framed cleanly through the steering wheel.
- Compact rearview mirror (14 by 3.5 cm) tucked high against roof header out of forward sightline.
- Cabin sealing: sealed binnacle side cheeks, dash front face, firewall, and floor pan with DoubleSide
  materials and zero see-through gaps.
- 240p bold cockpit layout: `drawCluster` in `src/ui/cluster.js` supports high-contrast interior layout
  with fat needle (`lineWidth: 7`), bold numerals (>= 22px), tick marks only every 1000 rpm, bold
  speed digits (50px), and enlarged gear box (34px). Fixed aspect ratio scaling to uniformly preserve
  circle geometry (`Math.min(w/W, h/H)`).
- Gauge contract: WATER dial renamed to TEMP (red over 110 C, HOT lamp from 115 C). Tachometer scale runs
  to 11,000 rpm for all cars with normal red band and darker danger band. Added warning lamps: CHECK ENGINE
  (flashing when blown), DMG (steady when damage > 0.3), OVERREV (flashing when overrev > 0). Gear box displays
  R, N, and forward gears 1..7.
- Tests: added pure unit tests in `tests/cluster.test.mjs` verifying gauge contract, tach scale, and HUD/cockpit layouts.

## 0.2.3 (2026-10-03)

Aero grip and the car camera.

- `spec.aero = { front, rear }`: downforce in N per (m/s)^2, added to each axle's load on
  hard surfaces only (gravel numbers are untouched). Vespera 0.5 and 0.9, Hayate 0.15 and
  0.45, Rampart 0.05 and 0.15. Tarmac grip: 1.35, 1.20 and 1.46 g at the bench speed.
- New `car` view next to `chase`: the standard near view from behind. The camera choice is
  saved by name (`cameraView`) so reordering views never changes a saved choice.
- Tests: 67 passing from the physics, engine, exhaust and gauge suites.

## 0.2.1 (2026-10-03)

Exhaust flames, sparks, smoke and a damaged-engine sound.

- `exhaust.js` (pure) turns the physics state into flame, sparks, smoke and pop events:
  a flame on a shift at high revs, lift-off crackle, constant sparks and crackle while
  over-revving, a smoke puff then dense smoke once the engine is blown.
- `exhaust-fx.js` draws them at each car's pipe tips: additive flame fins on the body, pooled
  spark and smoke particles in world space.
- Engine voice: `damage` (misfires, knock, rattle, less power), `overrev` (rasp) and a `blow`
  event (bang, clank, stumble) in the worklet and the DSP. Exhaust pops now come from the
  physics events. Verified live: the graph takes the new parameters and reacts to a money shift.
- Limp mode could not pull away in first gear (the clutch floor sat above the rpm cap);
  fixed and tested for every car.
- `tools/render-engines.mjs` also writes `engine-<car>-moneyshift.wav`.
- Tests: 66 passing.

## 0.2.0 (2026-10-03)

Driving model: rpm from the driven wheels, a real gearbox, heat, the money shift, tarmac grip.

- Engine rpm now comes from a driven-wheel speed state (`s.slip`), not from the car's
  forward speed. A loose or over-powered launch revs to the limiter, the needle no longer
  sits on a constant number, and a car spinning or sliding sideways keeps its rpm. The
  speedometer shows the speed of travel. The clutch slips in first and reverse so the
  launch rpm climbs with speed. Auto shifts on road speed.
- Gearbox R, N, 1 to n at any speed, nothing refused. Hayate 5, Rampart 5, Vespera 6
  gears. Manual W is always throttle and S always brake.
- `thermal.js`: temperature (renamed from water) is real and derates power from 108 C
  to 70 % at 120 C; exhaust temperature; over-rev damage; money shift above 11,000 rpm
  blows the engine, pegs temp and exh, leaves a limp mode (quarter torque, 3,500 rpm
  cap). Repair at a pump (hold interact) or by tow. Toasts for a blown or hot engine.
- Tarmac grip raised (1.0 to 1.28 on asphalt) and brakes strengthened; gravel unchanged.
  Bench: Hayate 1.34 g, Rampart 1.20 g, Vespera 1.41 g on tarmac; 100 to 0 in 35, 37
  and 32 m.
- Gauges mirror the physics and gain `gears`, `overrev`, `damage`, `blown`. `water` stays
  as a deprecated alias of `temp`.
- Tests: 59 passing.

## 0.1.10 (2026-10-03)

Task briefs for Antigravity, ahead of the 0.2 to 0.5 work.

- `docs/agents/tasks/`: A1 dashboard repair (mirrored image, hood blocking the view,
  unreadable at 240p, the new gauge contract), A2 Tab map and controls (interact moves to
  F), A6 garage for any number of cars, A3 and A4 vehicle bodies for rivals, traffic,
  vans, trucks and a bus, A5 buildings and street furniture.
- Plan ahead: 0.2.x driving model (rpm from a driven-wheel state, R N 1..7 gearbox,
  temperature, money shift and limp mode, exhaust flames, tarmac grip, near chase view),
  0.3.x a 6 km map with a city, an expressway with toll plazas, a mountain pass and a
  forest section, 0.4.x traffic and rivals, 0.5.x quality pass.

## 0.1.9 (2026-10-02)

Cockpit overhaul, manual transmission, arcade main menu and settings.

- Cockpit interior fixes: exterior materials and cabin panels set to DoubleSide
  so the hood and pillars are solid from the driver's POV rather than backface-culled.
  Sealed dash-to-windshield gap by extending the dash to the cowl line, and added cabin
  firewall and floor pan to eliminate ground light leaks.
- Unified gauge cluster: refactored Cluster.draw in src/ui/cluster.js into shared
  drawCluster function used by both the 3rd person HUD and the cockpit binnacle texture
  (420 by 300), deleting the separate drawDash. The hooded binnacle is raised on top
  of the dashboard with full visibility of the round tachometer, sweeping needle,
  shift indicator LEDs, speedometer, gear readout box, and satellite dials.
- Sequential manual transmission: added manual gearbox mode with sequential shifting
  (shiftUp, shiftDown). Supports keyboard (Shift/Ctrl and E/Q) and gamepad bumpers (RB/LB).
  Engine rev limiter cuts ignition and bounces at redline without automatic upshifting.
  Over-rev downshifts that exceed engine redline are electronically refused.
- Ace Combat and Japanese arcade styled menus:
  - mainMenuScreen with tactical wireframe framing, telemetry readout card, and sound chirps.
  - settingsScreen with transmission toggle (Auto vs Manual) and audio controls for all
    five channels (Master, Engine, Effects, Ambience, Music) with volume steps and mutes,
    bound to the audio DSP API and persisted to localStorage.
  - controlsScreen briefing with keyboard and gamepad bindings.
  - Updated pauseScreen with access to settings and main menu.
- Tests: 47 passing (including manual shift hold at redline and over-rev rejection).

## 0.1.8 (2026-10-02)

Music.

- `src/audio/songs.js` (pure): four tracks composed from chord progressions, with pad,
  bass, arpeggio, lead and drum patterns. Deterministic, in key, melodies that move by
  step and end on a chord tone. Tests.
- `src/audio/music.js`: the synthesizer and player. Look-ahead scheduling, kick-driven
  ducking, echo and reverb, layers that build with speed, a menu track for the title and
  garage, seamless rotation of the two driving tracks, and `hold` for the rally track.
- `audio.js` hooks the player into the mode and per-frame update. `tools/audio-lab.html`
  renders tracks offline with a speed ramp for measuring and listening.

## 0.1.7 (2026-10-02)

Vehicle sound and ambience.

- `src/audio/engine-dsp.js` (pure) and `engine-worklet.js`: a per-sample engine
  synthesizer in an AudioWorklet. Three voices from the three cars: the Hayate's flat-four
  burble with turbo whistle and blow-off, the Rampart's lumpy V8 with pops, the
  Vespera's even V12 with gear whine. Rev limiter, shift dips and decel crackle.
- `src/audio/audio.js`: the `audio` singleton with five channels (master, engine,
  effects, ambience, music), each with a volume and an on switch saved to localStorage,
  and a small API for a settings menu. Tire squeal, gravel, road, wind, impacts, pump,
  per-camera muffling, menu chirps, countdown beeps.
- Ambience from the new `src/audio/env.js`: crickets, wind in the trees by forest
  density, lake, town hum, forecourt hum.
- Hooks in `main.js` (unlock on first input, mode per screen, the garage idles the chosen
  engine) and `drive.js` (car, impacts, pump, per-frame update).
- `tools/render-engines.mjs`, `tools/audio-lab.html`, and `POST /__file` on the dev
  server. Tests for the engine spectrum and the environment map.

## 0.1.6 (2026-10-02)

Trees and the edge forest.

- `src/world/forest.js` (pure): nine species in habitats with noise stands, 18 groves on
  the valley floor, a dense belt forest along the map edge and a thicket of two
  staggered rows of big trees with overlapping colliders that no car fits between.
- `src/world/build-trees.js`: spruce, broadleaf, sugi, birch, maple, black pine,
  bamboo, shrub and snag geometries; maple tints red, orange or gold per instance.
  Tree code moved out of `props.js`.
- About 48k trees (was 25k) in 250 m chunks; world build time is unchanged at about
  0.75 s.
- `tools/trees.html` species viewer. Tests for the species mix, trees off roads, and a
  flood fill that proves the belt cannot be crossed.

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
