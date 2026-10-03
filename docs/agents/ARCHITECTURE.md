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
accepts `POST /__shot` to write a canvas capture to `tools/shots/` (git-ignored) and
`POST /__file` (`{ name, ext, data }`, base64, ext one of wav, json, txt, png) for other
captures such as rendered audio.

## Conventions

- Commit message: version prefix, then a sentence, then a body. Example:
  `0.1.1: Add the loft modeler and the three car bodies`. End with the
  Co-Authored-By trailer when an agent made the commit.
- Version lives in `package.json` and in `docs/agents/CHANGELOG.md`. Bump both.
- Pure modules never import `three` or touch the DOM: `src/core/mathx.js`,
  `src/core/rng.js`, everything in `src/world/` except files named `build-*`, `props`,
  `gas-station`, `rally-dressing`, `world` (so `scatter.js` is pure), and
  `src/vehicles/{specs,surfaces,physics,gauges}.js`, `src/audio/{engine-dsp,env,songs}.js`.
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
| `src/main.js` | Boot, state machine (title, menu, garage, settings, controls, loading, drive, pause, free), `window.__lowbeam` |
| `src/drive.js` | Free roam: fixed-step loop, collisions, cameras, refuel, tow, reset, area names |
| `src/core/input.js` | Keyboard and standard-mapping gamepad; menu actions; `drive(dt)` with keyboard ramps |
| `src/core/store.js` | localStorage wrapper (`lowbeam.v1`): car, paints, money, settings |
| `src/ui/garage.js` | Showroom scene, turntable, the car card with bars and paints |
| `src/ui/menus.js` | Title, main menu, settings, controls, loading, pause and toast DOM screens |
| `src/ui/hud.js` | Driving HUD: area name, money, prompt, minimap slot, cluster slot |
| `src/ui/cluster.js` | Canvas arcade cluster (`Cluster`) and shared `drawCluster` for the cockpit binnacle |
| `src/vehicles/gauges.js` | Pure: mirrors temperature, exhaust, damage and the gear from the physics; boost or manifold vacuum, shift light |
| `src/vehicles/exhaust.js` | Pure: flame, sparks, smoke and pop events at the tailpipes, from the physics state |
| `src/vehicles/exhaust-fx.js` | Flame fins, spark and smoke particles at the pipe tips (`ExhaustFx`, owned by `Car`) |
| `src/vehicles/thermal.js` | Pure: engine temperature, exhaust temperature, over-rev, damage, the money shift, limp mode, repair |
| `src/ui/minimap.js` | Rotating canvas minimap with roads, pads, station and rally icons |
| `src/world/collision.js` | Pure: circles and oriented boxes in a grid; car as three circles; impulses |
| `src/vehicles/car.js` | `Car`: physics state, model, two spot headlights, cockpit, interpolated pose |
| `src/render/cameras.js` | `CameraRig`: chase, car (near, from behind), hood, bumper, cockpit |
| `assets/fonts/` | Michroma (SIL OFL, `OFL.txt`), the Microgramma-style display face |
| `src/world/layout.js` | Authored data: roads, stations, rally config, economy |
| `src/world/heightfield.js` | Natural terrain (`baseHeight`), blur, the carved grid and triangle sampling |
| `src/world/spline.js` | Arc-length Catmull-Rom `Path`: sample, nearest, signed offset |
| `src/world/roads.js` | Road profiles (smoothing, grade clamp, bumps, junction blending), grid queries |
| `src/world/ground.js` | `Ground.at(x, z)`: height and surface from roads, then pads, then terrain; carving |
| `src/world/scatter.js` | Pure placement: lamps, trees, buildings, station furniture, baked lights, colliders |
| `src/world/build-terrain.js` | Chunked terrain mesh (same diagonal as `Heightfield.at`), lake surface |
| `src/world/build-roads.js` | Road ribbons with skirts, forecourt pads with curbs |
| `src/world/forest.js` | Pure: nine tree species, habitats, stands, groves, the edge belt and thicket |
| `src/world/build-trees.js` | Nine low-poly tree geometries, instanced chunks, per-instance tint (`treeTint`) |
| `src/world/props.js` | Street lamps, town buildings with windows, konbini, neon |
| `src/world/gas-station.js` | Canopy, pumps, kiosk, brand sign; service park tents, floods, rival cars |
| `src/world/world.js` | `World.create(step)`: builds the scene in stages; `update(camera, focus)` |
| `src/render/bake.js` | `LightGrid`, `bakeGeometry` (the `bake` attribute), `sampleLight` for movers |
| `src/render/sky.js` | Gradient dome, stars, moon; `MOON_DIR` |
| `src/vehicles/specs.js` | The three cars: bars, mass, engine, gears, tires, steering, fuel, paints |
| `src/vehicles/surfaces.js` | Grip, slip peak, slide falloff and rolling resistance per surface |
| `src/vehicles/physics.js` | 120 Hz bicycle model, R N 1..n gearbox, driven-wheel slip and engine rpm, traction control, jumps, fuel |
| `src/render/stage.js` | Renderer, 240-line target, dither and 15-bit quantize post pass, `shot()` |
| `src/render/psx.js` | Material factory with vertex snapping and baked light |
| `src/render/builder.js` | `MeshBuilder`: flat-shaded quads, boxes, cylinders into grouped geometry |
| `src/render/textures.js` | Canvas-drawn textures: glass, rims, plates, shadow, noise |
| `src/vehicles/models.js` | Loft modeler (`Kit`), body data per car (`BODIES`), `CarModel`, `buildCockpit` |
| `tools/sim.mjs` | Headless tuning bench for the cars |
| `tools/models.html` | Dev model viewer: the three cars on a floor, orbit, views, `shot()` |
| `tools/trees.html` | Dev tree viewer: the nine species in a 3 by 3 grid, orbit, `shot()` |
| `src/audio/audio.js` | The `audio` singleton: graph, channels and settings, engine voice, tires, wind, ambience, impacts, pump, menu chirps |
| `src/audio/engine-dsp.js` | Pure: per-sample engine synthesis (`EngineVoice`, `VOICES`) |
| `src/audio/engine-worklet.js` | AudioWorklet shell around `EngineVoice`, driven by k-rate parameters |
| `src/audio/env.js` | Pure: forest, town and lake amounts around a point, for the ambience |
| `src/audio/songs.js` | Pure: the four tracks composed as note events (`composeTrack`, `TRACKS`) |
| `src/audio/music.js` | `MusicPlayer`: the synthesizer, look-ahead scheduling, speed-driven layer mix, track rotation |
| `docs/agents/tasks/` | Briefs for Antigravity: dashboard repair, Tab map, garage, vehicle bodies, buildings |
| `tools/render-engines.mjs` | Node: writes a drive-by WAV per car to `tools/shots/audio/` |
| `tools/audio-lab.html` | Browser: renders a scripted drive through the real audio graph offline, analyzes it, saves a WAV |

## Current state (0.2.3)

Done and tested:

- World data and ground. Route 7 loop (2.8 km asphalt), three town streets, SS1 gravel
  stage (2.9 km, climbs to about 85 m, grades capped at 13 %, one jump crest), three
  gas station pads, a lake. Terrain is carved under every road and pad. Ground build
  takes about 0.4 s.
- Vehicle physics for all three cars, tuned so the garage bars are honest. Bench
  output (`node tools/sim.mjs`):

  | Car | 0-100 | 1/4 mile | Top | 100-0 | Grip tarmac / gravel |
  |---|---|---|---|---|---|
  | Hayate RS-4 | 4.64 s | 13.10 s | 203 km/h | 34.7 m | 1.35 g / 0.80 g |
  | Rampart 440 | 3.74 s | 11.67 s | 245 km/h | 37.2 m | 1.20 g / 0.61 g |
  | Vespera GT | 4.20 s | 12.13 s | 293 km/h | 31.7 m | 1.46 g / 0.59 g |

  Tarmac grip was raised in 0.2.0 (`SURFACES.asphalt.mu` 1.0 to 1.28, concrete 1.24, brakes
  stronger) and 0.2.3 added downforce (`spec.aero`, N per (m/s)^2 per axle, hard surfaces
  only): the Vespera gains the most at speed, the Rampart the least. The tire curve shape
  (`peak`, `shape`) was left alone on purpose: measured, it already lets a keyboard
  player hold full lock at 1.1 to 1.3 g, and a sharper falloff only made that feel slipperier.
  Gravel, dirt, grass, sand are unchanged and a test guards gravel within 3 %.
- Drivetrain (`physics.js`). `gear` is -1 (R), 0 (N) or 1 to the top gear (Hayate and
  Rampart 5, Vespera 6). The engine is tied to the driven wheels, which can turn faster
  than the road passes under them: `s.slip` (m/s) is that extra wheel surface speed.
  When the engine pushes more than the tires can pass on (`tc` times grip, then a
  slip-ratio curve per surface in `surfaces.js`: `slipPeak`, `slipEnd`, `slide`), the
  wheels spin up with the real rotating mass, engine rpm follows them to the limiter, and
  the sliding tires keep pushing while they spin down. Engine rpm comes from the wheel
  speed (`s.rpm`), never from the car's heading, so a spinning or sliding car does not
  swing its tach. The speedometer is `hypot(vx, vz)`. In first and reverse the clutch
  slips (`CLUTCH_SLIP`) so the needle climbs from the launch rpm instead of sitting on a
  number. Neutral free-revs with the engine's own inertia (`engine.inertia`).
  Auto shifts on road speed (not wheel speed) and holds brake at rest for reverse.
  Manual (Settings, store key `transmission`) goes R, N, 1 ... n with 0.1 s of clutch,
  at any speed, W always throttle and S always brake; nothing is refused.
- Engine health (`thermal.js`, state in the physics). `s.temp` 80 to 120 C, power falls
  from 108 C to 70 % at 120 C (`thermalDerate`); `s.exh` 300 to 900 C. Rpm past the
  redline (150 rpm dead zone) is `s.overrev` 0 to 1 toward `engine.blowRpm` (11,000 for
  every car): it heats the engine, builds `s.damage`, and the wheels drag the car back.
  Wheel-driven rpm at or above the blow rpm (a money shift: 3rd to 2nd at 144 km/h in the
  Hayate, anything into R above about 120 km/h) or damage reaching 1 sets `s.blown`,
  `s.blowCount`, `s.seize` (0.35 s of grab), pegs temp and exh, and puts the car in limp
  mode: a quarter of the torque, 3,500 rpm cap, torque fading out above 50 to 65 km/h.
  `repairEngine` clears it: hold the interact key at a pump (`repairCost`, 12,000 yen
  when blown) or tow with R (tow fee plus the repair).
- Exhaust effects (`exhaust.js` state in `s.fx`, drawn by `exhaust-fx.js`). A shift above
  80 % of the redline throws a 0.16 s flame and sparks and a bang; a lift-off from full
  throttle above 55 % of the redline crackles 2 to 4 times; over-revving, or sitting on
  the limiter at full throttle, crackles continuously with a constant stream of sparks;
  the moment the engine blows there is a smoke puff, then dense smoke while it stays
  blown (thin smoke from heavy damage). Flames are additive crossed fins parented to the
  body; sparks and smoke are pooled points in world space (`car.fx.group`, added to the
  scene root by `Drive.start`). Pipe tips for each car are the `TIPS` table in
  `exhaust-fx.js`; a body with its own `exhaust: [[x, y, z]]` list wins.
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
  buildings (two konbini, vertical neon signs), about 48k instanced trees in 250 m
  chunks hidden past the fog (see Forest), three gas stations, the service park with
  tents, floodlights and two rival cars, the lake, sky and moon. A town street view
  draws about 70 calls and 165k triangles; a view into the edge belt about 50 calls and
  275k.
- Forest (`forest.js`, `build-trees.js`): nine species, `TREE` in forest.js: spruce,
  broadleaf, sugi (tall cedar), birch, maple (red, orange or gold per instance),
  black pine, bamboo clump, shrub (no collider) and dead snag, 30 to 144 triangles
  each. Habitats weight the species: valley floor (mixed broadleaf, birch, maple),
  lake edge (bamboo, shrubs, birch), slopes (spruce, sugi) and the high ridge (spruce,
  snags). A noise field makes stands, so a hillside is mostly one species. 18 groves
  of 34 to 68 m sit on the valley floor, each with its own species mix. The edge belt
  is Chebyshev distance 900 to 990 from the center: a dense forest of spruce and sugi
  plus the thicket, two staggered rows (rings 927 and 939) of big trees 3 m apart, each
  with a 1.3 m collider, so no gap is wider than 0.4 m. The wall at 988 stays as the
  backstop. tests/forest.test.mjs floods a car-sized circle through the belt and
  requires that it never gets past the first row. The mountain slopes are also too
  steep for the cars to climb far, so the belt mostly sits behind the terrain itself.
- Audio (`src/audio/`, all synthesized, nothing loaded from a file). The page calls
  `audio.unlock()` on the first key or click, `setMode(state)` on every screen change,
  `setCar(spec)` when the car changes (the garage plays its idle with a blip) and
  `update(frame)` once per drive frame. Every call that depends on time takes an optional
  `at`, so the same code runs live and in an `OfflineAudioContext`.
  - Settings contract, for any menu: `audio.settings` is `{ master, engine, effects,
    ambience, music }`, each `{ volume: 0 to 1, on: boolean }`. `setVolume(channel, v)`,
    `setOn(channel, on)`, `toggle(channel)`, `onChange(fn)` (returns an unsubscribe) and
    `audio.ui('move' | 'select' | 'back' | 'error')` for menu chirps. Settings save
    themselves to localStorage under `audio`. `audio.level()` is the output RMS.
  - Engine health: new k-rate parameters `damage` (misfires, uneven firings, knock, rattle,
    lost power), `overrev` (harsh rasp and drive) and a `blow` trigger (bang, metal clank and a
    stumble). Exhaust pops come from `s.fx.pops` with the size in `s.fx.level`.
  - Engine: an AudioWorklet synthesizes each cylinder firing as an exhaust pulse at its
    place in the 720 degree cycle, through a throttle-controlled low pass and two exhaust
    resonances, plus intake noise. Flat-four (Hayate): unequal pairs, the burble, plus a
    turbo whistle that follows boost and a blow-off hiss on lift. V8 (Rampart): uneven
    banks, heavy low end, loud pops. V12 (Vespera): even and high, with gear whine. All
    three crackle off throttle, cut on the limiter and dip on shifts.
  - Effects: tire squeal on tarmac (two narrow resonances that rise with speed and slip),
    gravel crunch and scrub on loose surfaces, road rumble, wind, impacts (thump, noise
    and a metallic ring scaled by closing speed), landing thumps, pump hum and clicks.
    A low-pass per camera (cockpit 1.7 kHz, hood 3.6 kHz, chase 9 kHz, bumper 12 kHz)
    muffles the vehicle sounds; the cockpit is also quieter.
  - Ambience: crickets (four gated tones), wind in the trees that follows forest density,
    lake lapping, town hum with a neon buzz, a 120 Hz fluorescent hum on a forecourt.
    All fade in a car going fast. `EnvMap` (pure) supplies forest, town and water.
  - Screens: title, loading mute the world; the garage plays the engine idle; pause mutes
    the world, keeps a faint ambience and ducks the music.
  - Music (`songs.js`, `music.js`): four tracks composed in code from a chord progression
    over a minor scale: NIGHT BRIEFING (menu, 76 bpm, F sharp minor), KIRIGAOKA NIGHTS
    (92 bpm, A minor), LOW BEAM (118 bpm, D minor) and RIDGE RUN (138 bpm, E minor, for
    the rally). Each has pad chords, a bass line (rolling, offbeat, gallop or pedal), an
    arpeggio, a lead melody built from rhythm shapes and nearest-chord-tone voice
    leading, and 16-step drums. The player synthesizes it with Web Audio nodes: detuned
    saw pads, filter-enveloped bass, plucked arpeggio, a lead with delayed vibrato, drum
    voices, a dotted-eighth echo and a generated reverb, with the pads and arpeggio
    ducking on every kick. Layers follow speed (`speedMix`): parked is pads and bass,
    the arpeggio comes in from about 5 km/h, hats and drums from 20 to 60, the lead from
    75 to 115. The menu track ignores speed. Title, garage and loading play the menu
    track; driving rotates Kirigaoka and Low Beam, two loops each, seamlessly. Notes are
    scheduled 1.4 s ahead so a throttled tab does not stutter, and late notes are
    skipped. `audio.music.hold('ridge')` and `release()` are for the rally stage.
  - Verified by numbers, not by ear: `tests/engine.test.mjs` checks the spectrum sits on
    the firing harmonics for every voice, the V12 is even and the others are lumpy, load
    makes it louder and brighter, the limiter chops it and the whistle appears under
    boost. `tools/audio-lab.html` renders the real graph offline and compares band
    energies (squeal, gravel, cockpit muffling, ambience). Listen with
    `node tools/render-engines.mjs`.
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
- Cameras (`CameraRig`, C cycles, the choice is saved by name under `cameraView`): chase
  (damped, leans toward the direction of travel in a slide, FOV 62 to 78 with speed), car
  (the standard near view: 4.4 m back, 1.3 m up, straight behind the heading so the whole
  car stays in frame, FOV 58 to 68), hood, bumper and cockpit. The cockpit is a lofted
  interior (`buildCockpit`): dash, binnacle, gauge face (dark until the cluster
  lands), steering wheel turning at 4.5 times the road wheel angle, A-pillars, header,
  liner, door panels, mirror, console and passenger seat. It rides in the leaning body.
- Headlights: two spot lights per car (320 cd, decay 1.35, 95 m). Physical units:
  weaker values vanish on the dark ground.
- HUD: area name (fades), money, prompts, the minimap (rotates with the car, zooms
  out with speed, north marker, station and rally start icons) and the gauge cluster.
- Gauge cluster (`src/ui/cluster.js`, bottom right, canvas, Michroma): a round tach
  sweeping 240 degrees with scale running to 11 (11,000 rpm) for every car, a normal red
  band from the car's redline, a darker danger band from redline+1000 to 11, a lit arc behind
  the needle, five shift lights that fill toward the upshift point and flash at it, a flashing
  red zone on the limiter, digital speed and a gear box (handling R, N, and gears 1..7) in the open
  bottom of the dial, and four small dials around it: FUEL (liters, red under 15 %), TEMP (80 to
  120 C, red over 110, HOT lamp from 115 C), BOOST on the Hayate (-0.7 to +1.2 bar) or VAC on the other
  two (-0.8 to 0 bar), EXH (300 to 900 C, red over 820). Warning lamps include CHECK ENGINE (flashing
  when blown), DMG (steady when damage > 0.3), OVERREV (flashing when overrev > 0), and ENGINE OFF.
  The values come from `src/vehicles/gauges.js` (pure), stepped once per frame from the physics state:
  temperature and exhaust come from the physics (`thermal.js`), boost spools
  above `engine.turbo.spoolRpm` with `engine.turbo.lag` and dumps on shifts, vacuum
  follows the throttle, exhaust follows load and rpm. Only the Hayate spec has a
  `turbo` block. `drawCluster` applies uniform aspect ratio scaling (`Math.min(w/W, h/H)`).
  In the cockpit view the HUD cluster hides and the same `drawCluster` function paints a bold
  cockpit layout onto the binnacle texture (400 by 300, 4:3), updated every frame with fat needle
  (lineWidth: 7), bold glyphs (>= 22px), ticks only every 1000 rpm, bold speed (50px), and enlarged gear box (34px).
- Cockpit interior fixes: exterior materials and cabin panels use `DoubleSide` so
  the hood and pillars are solid from the driver's POV. Dash gap to the windshield
  is closed, and cabin firewall and floor pan prevent light leaks. The hooded binnacle
  rises at most 4 cm above the dash top (`bTopY = beltY + 0.04`), opening the forward sightline.
  The gauge face sits low (`gh0 = beltY - 0.19`) and tilted toward the eye, clearly framed
  through the steering wheel. Gauge quad u coordinates are non-mirrored (u=0 driver's left,
  u=1 driver's right). Rearview mirror is compact (14 by 3.5 cm) tucked high against the roof header.
- Ace Combat and Japanese arcade styled menus:
  `mainMenuScreen` (tactical wireframe, telemetry card, audio chirps),
  `settingsScreen` (Auto vs Manual transmission toggle, Master, Engine, Effects,
  Ambience, Music channels with volume steps and mutes saved to localStorage),
  `controlsScreen` briefing, and updated `pauseScreen`.
- `__lowbeam.simulate(seconds, input)` runs the drive loop without frames, for checks
  in a hidden tab; `__lowbeam.setState('free')` gives the development free camera.
- Tests: 67 passing (splines, ground and pads, stage grades, bars vs sim, braking,
  reverse, jumps, lamp, tree, building and pump placement, wall and pole impacts,
  push-out, valley edge, boost lag, manifold vacuum, temperature ranges, shift light,
  species mix, the edge-belt flood fill, engine spectra and levels, the ambience map,
  track composition and the speed mix, R N 1..n for every car, rpm that reaches the limiter
  on a loose launch and ignores the heading in a spin, money shifts, limp mode, the heat
  derate, tarmac and gravel grip).
  `npm run check` is clean. CPU time for one drive update and render is about 2 ms in
  the browser pane.

Not started: the rally event and everything after it in the build order in
`docs/DESIGN.md`.

## Next steps (in order)

1. **Rally**: start, countdown, checkpoints, pace notes from curvature, results,
   ghost. Config is `RALLY` in layout.js (start at s = 130 m). The rally should call
   `audio.music.hold('ridge')`, `audio.beep('count')` and `audio.beep('go')`.
2. Tune engine, music and mix levels from listening in a real drive session.

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
- Gauge fields `water`, `WATER_MIN` and `WATER_MAX` are deprecated aliases of `temp`,
  `TEMP_MIN`, `TEMP_MAX`; remove them once the cluster reads `temp` (task A1).
- Neither the HUD nor the cockpit has been seen at real frame rates on the gaming
  desktop yet; all checks so far used `__lowbeam.simulate` and canvas captures.
- Lamp pools on Route 7 in town overlap into an even wash at 34 m spacing. Check from
  the driver's seat; shorter range or wider spacing gives distinct pools.
- The valley floor inside Route 7 is empty. Candidates: rice fields, a rail line, a
  second town block. Not needed for this milestone.
- `Ground.at` scans every pad on each call. Fine with 3 pads; add a grid if pads grow.
- Neon signs draw Japanese text with the system font (Yu Gothic, Meiryo, MS Gothic or
  Noto Sans CJK). A machine without any of them shows boxes.
