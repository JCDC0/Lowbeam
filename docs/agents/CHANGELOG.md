# Changelog

## 0.9.76 (2026-10-08)

A bigger minimap with the heat on it (C2 part 7).

- The minimap grows from 168 to 220 px.
- The heat on the rim, as on Most Wanted's radar: five marks over the top, lit red up to the level
  in a pursuit, dimmer for the heat the police still hold after one, grey above it.
- In a pursuit the rim is red on the left and blue on the right, as the light bars; it holds and
  does not flash.
- Searching units draw their 60 m sight cone ahead of them in amber; a unit that sees the player
  wears a white ring (a pursuing unit too now, not only a watching patrol). The helicopters keep
  their searchlight circles.
- `Minimap.draw` takes the heat (`{ level, pursuit }`) from the Drive.

## 0.9.75 (2026-10-08)

The Hoshi Kei-S and the Kagero Hot-GT race with Gemini's models.

- `KIND_MODELS` gains `rv-kei` (`rv_kei_full`) and `rv-hothatch` (`rv_hothatch_full`), reviewed with
  Gemini's fix fd6f6cb (lamps and exhaust tips proud of the body, the hatch's tailgate). Checked in
  the game: both painted per car, lamps lit, at the size they collide with.
- Gemini's next pair is the Kagero Lancer-X and the Halden Drifter (0.9.60, 0.9.61).

## 0.9.74 (2026-10-07)

Banners with flair and the takedown hit (C2 part 6).

- `bannerer` in `ui/menus.js`: a big Michroma line in the middle of the screen that slams in (from
  1.9 times its size in 0.2 s), holds, and folds away; a rule above and below it by tone (police red
  over blue, green, red, amber, cyan) and an optional second line. A new banner replaces the one
  showing; nothing pulses.
- The police events, ESCAPED, BUSTED, ENGINE BLOWN and DUEL are banners now; toasts keep the small
  news (refuels, tolls, cameras) and slide in.
- A unit taken out: COP TAKEN OUT with the bounty and the unit, a white flash (`flasher`, 0.28 s), a
  camera jolt and `audio.takedown()` (the crash, a deep boom and a ring of torn metal).
- Reviewed Gemini's 0.9.58 (Hoshi Kei-S) and 0.9.59 (Kagero Hot-GT): both pass, under the 2,600
  triangle budget for a full car. Not yet in `KIND_MODELS`.
- Checked in the game with a takedown at 100 km/h.

## 0.9.73 (2026-10-07)

The Most Wanted pursuit HUD (C2 part 5).

- `ui/pursuit.js` and its styles rewritten: one panel at the bottom center (470 px, under the prompt
  line, between the minimap and the speedometer), every word and number in Michroma. The heat as five
  marks and the pursuit's time; the bounty in large amber digits, counting up as it grows; the evade
  and busted meter split from the middle, green to the left and red to the right, turning into a
  blue COOLDOWN bar while the police search; the units on the scene, the units in sight, the units
  taken out (the kill count) and a helicopter icon for each one up; at the end a BUSTED or ESCAPED
  card with the fine or the bounty, the meter hidden so the panel stays short.
- Before a pursuit, while a patrol watches, only the detection bar shows: amber, red past two thirds.
- No fades and no pulses. The panel shows only on the drive screen: the garage, the menus and the map
  no longer carry a pursuit HUD over them (the bug Jc saw entering a garage).
- `layoutPursuit` gains `helis`, `nearby`, `destroyed` and `fineText`; the Drive's `pursuitView` adds
  the helicopters up and the units in sight.
- Tests: the new layout fields. Checked in the game at heat 4 (7 on scene, 2 in sight, 2 taken out,
  2 helicopters), in cooldown, busted, and in the garage with a pursuit running. 359 pass.

## 0.9.72 (2026-10-07)

More helicopters (C2 part 4).

- `helisFor(heat)` (`police/units.js`): one helicopter at heat 3, two at 4, three at 5. The orders
  carry `helis`; the Drive keeps a list (`helis`, `heliViews`, `setHelis`) instead of one.
- The first takes off from the HQ's roof as before. The other two are backup with no helipad
  (`Heli` option `sky`): they arrive flying from a point 140 m over the west and east hills and,
  recalled, fly back there and are put away out of sight.
- Each holds its own station on the target (`HELI_SLOTS`): behind and to the right as before, ahead
  on the left, and wide on the right, so their searchlights land on different streets.
- The player is seen if any helicopter's light is on them; the rotor heard is the nearest one's;
  the maps show every helicopter off its pad.
- Tests: the count by heat; a backup helicopter arrives flying, three hold stations over 30 m apart,
  and a recalled one is put away in the sky. Checked in the game: three up at heat 5, two seen with
  their lights crossing on the car. 358 pass.

## 0.9.71 (2026-10-07)

Being noticed, provoking the police, and police chasing racers (C2 part 3).

- The detection bar (`Heat.attention`) drains 1.5 s after no unit sees the player (0.4 a second),
  never below what the speed cameras put on it, so two traps in a row still start a pursuit.
- A near miss provokes at once: passing a unit within 3.8 m at more than 22 m/s relative
  (`NEAR_MISS` in `director.js`; units now carry their velocity). It starts a pursuit like a ram,
  with a `provoked` event.
- The orders carry `detect`: the bar's level and the ids of the units that see the player. A
  watching patrol wears an amber mark over its roof, red once the bar is two-thirds full (a seventh
  flare per car); on the minimap patrols are grey arrows, a watching one blinks amber, pursuing ones
  flash red and blue. The bar itself goes into the new pursuit HUD (part 5).
- Police chase street racers (`TAIL`, `startTails`, `stepTail` in `sim.js`): while no pursuit of the
  player is on, a patrol that sees a racer above 1.25 times the limit within 80 m takes it up 30 %
  of the time, at most one at a time, bar and siren on, driven by the pursuit code with the racer as
  its target, for up to 45 s or until the racer is 380 m ahead or gone. The racer pushes on 15 %
  faster. A pursuit of the player drops it.
- `stepPursuit` takes its target and goals, so the same code chases the player or a racer.
- Tests: `tests/police-detect.test.mjs` (the bar fills and drains, the cameras' share holds, a near
  miss provokes and a slow or wide pass does not, the orders name the watchers, a patrol takes up a
  speeding racer and drops it when it is gone). Checked in the game: the bar fills in 1.5 s passing
  a patrol at 150 km/h and the amber mark shows over it. 356 pass.

## 0.9.70 (2026-10-07)

All four police units drive with Gemini's models (C1 part 7), and G3 passes review.

- `KIND_MODELS` adds the unmarked car (`police_unmarked_full`), the Rhino (`police_rhino_full`) and
  the interceptor (`police_interceptor_full`) to the cruiser and the Mazuma. The bar flares find each
  model's red lens, so the unmarked car flashes from its grille.
- Review of Gemini's 0.9.55 to 0.9.57 in `G3-police-cars.md`: all three pass with both notes from
  the cruiser applied. G3 is done; G5 (the street racers) is Gemini's next task.
- First version in Claude's new range (0.9.70 to 0.9.99).

## 0.9.61 (2026-10-08)

Street racers: Halden Drifter (`rv_v8drift`).

- `tools/blender/rv_v8drift.py`: Big V8 four-door sedan built for drifting in the Mark II / Chaser or Commodore spirit. 4.78 x 1.92 x 1.39 m, wheelbase 2.72 m (axles at z = +1.30 and -1.42 m), wheel radius 0.34 m at x = +-0.80.
- Long hood (a third of total length, ~1.56 m long) with induction power bulge; set-back low greenhouse with raked glass, visible B/C pillars, door cut lines; short rear deck with integrated ducktail spoiler lip.
- Wide, low stance with muscular fender flares (1.9200 m wide), deep front drift chin lip, sports side skirts, and gunmetal drift wheels.
- Emissive headlights (`lamp`, z in [2.228, 2.240] m > 0), full-width continuous tail lamp band (`tail`, z in [-2.521, -2.511] m < 0) across tail, both proud of hull; quad chrome exhaust tips (two per side) to -2.530 m with dark bores.
- 1,634 body triangles (budget <= 1,800), 2,338 full triangles with wheels (budget <= 2,600).
- `assets/models/rv_v8drift.json` and `assets/models/rv_v8drift_full.json`. Checked clean in props.html with 0 problems.

## 0.9.60 (2026-10-08)

Street racers: Kagero Lancer-X (`rv_boxer`).

- `tools/blender/rv_boxer.py`: 4-door rally sedan in the Evo / Impreza spirit. 4.50 x 1.77 x 1.45 m, wheelbase 2.63 m (axles at z = +1.15 and -1.48 m), wheel radius 0.32 m at x = +-0.76.
- Three-box sedan architecture with distinct hood, 4-door cabin (visible B and C pillars, door cut lines, handles), and trunk deck.
- Hood vents (two dark slots) and hood scoop; tall rear rally wing on two uprights over trunk (blade at y = 1.42 m, 0.44 m clear of trunk lid, wing apex at 1.450 m).
- Front and rear box-flared arches (1.7700 m wide), rally mud flaps behind all four wheels, big front intake with intercooler mesh, front chin splitter, and bumper fog lamps.
- Emissive headlights (`lamp`, z in [2.026, 2.048] m > 0), block taillights (`tail`, z in [-2.437, -2.427] m < 0), both proud of hull; single chrome cannon exhaust to -2.450 m with dark bore.
- 1,732 body triangles (budget <= 1,800), 2,436 full triangles with wheels (budget <= 2,600).
- `assets/models/rv_boxer.json` and `assets/models/rv_boxer_full.json`. Checked clean in props.html with 0 problems.

## 0.9.59 (2026-10-07)

Street racers: Kagero Hot-GT (`rv_hothatch`).

- `tools/blender/rv_hothatch.py`: 90s Japanese 3-door hot hatch (Civic EK9 Type R mould):
  - Proportions: length 4.00 m (z from -2.18 to +1.82), width 1.70 m (x from -0.85 to +0.85, mirrors to +-0.8950 m), height 1.37 m, wheelbase 2.62 m (axles at z = +1.00 m and -1.62 m), wheel radius 0.30 m.
  - Plan view sports hatch silhouette: tapered nose 1.4000 m at bumper, front flared arches 1.6600 m, doors waist 1.5800 m, wide blister rear hips 1.7000 m, tapered tail 1.5500 m, cabin pulled in to 1.2800 m across roof.
  - Aerodynamic roof spoiler wing extending over rear hatch, with wing blade and endplates reaching peak height of exactly 1.3700 m.
  - Front styling: slim rectangular headlights with chrome bezels and white emissive `lamp` lenses (strictly at z = 1.802 m > 0), sports mesh grille, deep lower air dam intake, chin splitter, and front plate.
  - Rear styling: block taillight clusters with emissive red `tail` lenses (strictly at z in [-2.157, -2.148] m < 0) and chrome reverse inserts, rear plate, rear diffuser, and large cannon chrome sports exhaust.
  - Real wheel openings with dark inner wells (`under`), sports side skirts, and 4 wheels for the viewer (`wheel-*`, radius 0.30 m).
- `assets/models/rv_hothatch.json`: body-only model (1,424 triangles, under 1,800 budget; bounds x: [-0.8950, 0.8950], y: [0.1900, 1.3700], z: [-2.1800, 1.8200]), check() clean with 0 problems.
- `assets/models/rv_hothatch_full.json`: full model with wheels (2,128 triangles, under 2,600 budget; bounds x: [-0.8950, 0.8950], y: [0.0000, 1.3700], z: [-2.1800, 1.8200]), check() clean with 0 problems.

## 0.9.58 (2026-10-07)

Street racers: Hoshi Kei-S (`rv_kei`).

- `tools/blender/rv_kei.py`: tiny front-engine Japanese kei sports car (Cappuccino / Beat mould):
  - Proportions: length 3.30 m (z from -1.69 to +1.61), width 1.48 m (x from -0.74 to +0.74, mirrors to +-0.7925 m), height 1.18 m, wheelbase 2.24 m (axles at z = +1.06 m and -1.18 m), wheel radius 0.27 m.
  - Plan view Coke-bottle silhouette: tapered nose 1.1600 m at bumper, front fenders 1.4300 m, doors waist 1.3866 m, wide rear hips 1.4800 m, tapered tail 1.3300 m, cabin pulled in to 1.1200 m across hardtop roof.
  - Front styling: round headlights (chrome bezel with white emissive `lamp` lens at z = 1.606 m > 0), oval grille intake, chin splitter, and front plate.
  - Rear styling: dual round taillights per side (emissive `tail` lenses at z in [-1.677, -1.660] m < 0), rear plate, rear diffuser, and single chrome sports exhaust tip with dark bore.
  - Real wheel openings with dark inner wells (`under`), side mirrors, sports side skirts, and 4 wheels for the viewer (`wheel-*`, radius 0.27 m).
- `assets/models/rv_kei.json`: body-only model (1,514 triangles, under 1,800 budget; bounds x: [-0.7925, 0.7925], y: [0.1750, 1.1796], z: [-1.6900, 1.6100]), check() clean with 0 problems.
- `assets/models/rv_kei_full.json`: full model with wheels (2,218 triangles, under 2,600 budget; bounds x: [-0.7925, 0.7925], y: [0.0000, 1.1796], z: [-1.6900, 1.6100]), check() clean with 0 problems.

## 0.9.57 (2026-10-07)

Police car trial: interceptor supercar (`police_interceptor`).

- `tools/blender/police_interceptor.py`: mid-engine Japanese police supercar interceptor (NSX mould):
  - Supercar proportions: length 4.60 m (z from -2.30 to +2.30), width 2.00 m, height 1.24 m, wheelbase 2.76 m (axles at z = +-1.38 m).
  - Forward fighter-canopy cockpit, mid-engine glass inspection cover, integrated rear wing blade on pedestals, and rear diffuser with quad chrome exhausts.
  - Cruiser two-tone livery: white upper body carried down doors to handle height (0.76 m); black lower body, side skirts, and mid-engine intake scoops.
  - Aerodynamic 1.32 m wide roof light bar with 0.12 m tall lenses (left red `lens-l` 0xff2a2a, right blue `lens-r` 0x2a5aff, both emissive), top strictly at 1.24 m.
  - Wide low-profile sports wheels (radius 0.33 m, width 0.24 m), slender headlights with police star crest, and full-width taillight bar.
- `assets/models/police_interceptor.json`: body-only model (1,702 triangles, under 1,800 budget; bounds x: [-1.0000, 1.0000], y: [0.1700, 1.2400], z: [-2.3000, 2.3000]), check() clean with 0 problems.
- `assets/models/police_interceptor_full.json`: full model with wheels (2,406 triangles, under 2,600 budget; bounds x: [-1.0000, 1.0000], y: [0.0000, 1.2400], z: [-2.3000, 2.3000]), check() clean with 0 problems.

## 0.9.56 (2026-10-07)

Police car trial: Rhino heavy SUV (`police_rhino`).

- `tools/blender/police_rhino.py`: heavy boxy pursuit SUV in Japanese police two-tone (Land Cruiser / Patrol mould):
  - Proportions: length 4.90 m (z from -2.45 to +2.45), width 2.00 m, height 1.90 m, wheelbase 2.94 m (axles at z = +-1.47 m).
  - Heavy steel push bar / bull bar on the nose with rubberized push pads, cross tubes, and headlight protectors.
  - Cruiser two-tone livery: white upper body carried down doors to handle height (~1.08 m); black lower body, lower doors, flared wheel arches, and bumpers.
  - High-visibility roof light bar: 1.32 m wide, 0.12 m tall lenses (left red `lens-l` 0xff2a2a, right blue `lens-r` 0x2a5aff, both emissive), top strictly at 1.90 m.
  - Large SUV all-terrain wheels (radius 0.38 m, width 0.26 m), roof rails, rear step bumper, tow hitch, and vertical tail clusters.
- `assets/models/police_rhino.json`: body-only model (1,568 triangles, under 1,800 budget; bounds x: [-1.0800, 1.0800], y: [0.3000, 1.9000], z: [-2.4500, 2.4500]), check() clean with 0 problems.
- `assets/models/police_rhino_full.json`: full model with wheels (2,272 triangles, under 2,600 budget; bounds x: [-1.0800, 1.0800], y: [0.0000, 1.9000], z: [-2.4500, 2.4500]), check() clean with 0 problems.

## 0.9.55 (2026-10-07)

Police car trial: unmarked fast sedan (`police_unmarked`).

- `tools/blender/police_unmarked.py`: sporty 4-door pursuit sedan in dark metallic paint (`paint` 0x14161c):
  - Proportions: length 4.50 m (z from -2.25 to +2.25), width 1.85 m, height 1.34 m, wheelbase 2.70 m (axles at z = +-1.35 m).
  - Clean unmarked body without roof bar: sports chin splitter, rear lip spoiler, diffuser, dual chrome exhausts.
  - Emergency flasher strobes behind front grille: left red lens (`lens-l` 0xff2a2a, x > 0) and right blue lens (`lens-r` 0x2a5aff, x < 0), both 0.12 m tall and emissive for long-distance visibility.
  - Wheel arches with dark wells (`under`), side mirrors, and 4 wheels for the viewer (`wheel-*`, radius 0.32 m).
- `assets/models/police_unmarked.json`: body-only model (1,524 triangles, under 1,800 budget; bounds x: [-1.0000, 1.0000], y: [0.1900, 1.3394], z: [-2.2500, 2.2500]), check() clean with 0 problems.
- `assets/models/police_unmarked_full.json`: full model with wheels (2,228 triangles, under 2,600 budget; bounds x: [-1.0000, 1.0000], y: [0.0000, 1.3394], z: [-2.2500, 2.2500]), check() clean with 0 problems.

## 0.9.54 (2026-10-07)

Police car trial: Japanese police cruiser sedan (`police_cruiser`).

- `tools/blender/police_cruiser.py`: authentic Japanese patrol car in the Toyota Crown mould:
  - Big 4-door sedan proportions: length 4.70 m (z from -2.35 to +2.35), body width 1.80 m, height 1.45 m (including roof light bar), wheelbase 2.80 m (axles at z = +-1.40).
  - Japanese police two-tone livery: white upper body, hood, trunk, and pillars (`paint` 0xf4f4f2); black lower body, doors, and bumpers (`accent` 0x14161c).
  - Low roof light bar with chrome bracket, central white siren speaker housing, left red lens (`lens-l` 0xff2a2a, x > 0), and right blue lens (`lens-r` 0x2a5aff, x < 0), both emissive, top reaching exactly 1.45 m.
  - Front fascia: chrome grille surround with police sunburst star crest and black mesh, rectangular sedan headlights with chrome bezels, amber corner indicators, bumper rub strips, chin intake, and Japanese license plate.
  - Rear fascia: wide sedan taillights with red lens and white reverse insert, license plate in trunk recess, bumper rub strip, and chrome exhaust tip.
  - Wheel arches with dark inner wells (`under`), side mirrors on front doors, and 4 wheels for the viewer (`wheel-*`, radius 0.32 m).
- `assets/models/police_cruiser.json`: body-only model (1,630 triangles, under 1,800 budget; bounds x: [-0.9800, 0.9800], y: [0.2200, 1.4500], z: [-2.3500, 2.3500]), check() clean with 0 problems.
- `assets/models/police_cruiser_full.json`: full model with wheels (2,334 triangles, under 2,600 budget; bounds x: [-0.9800, 0.9800], y: [0.0000, 1.4500], z: [-2.3500, 2.3500]), check() clean with 0 problems.

## 0.9.53 (2026-10-07)

Mazuma RX-Coupe fix round (`rv_rotary`).

- `tools/blender/rv_rotary.py`: resolved all 3 review findings from 0.9.52:
  - Closed hole in the hood: underside floor clamped to y = 0.20 (preventing intrusion into the dipped hood) and clean non-wrapping topology across bilateral rings.
  - Authentic sports car silhouette in plan view: nose tapered to 1.5004 m at lamps (z = 1.70 m), doors waist pulled in to 1.6192 m (z = 0.00 m), rear hips flaring to 1.7600 m (z = -1.28 m), tail tapered to 1.6054 m at lip (z = -2.25 m), and cabin pulled in to 1.3000 m across the roof.
  - Eliminated the roof slab: continuous curvature profile connects the cowl seamlessly through windshield into roof peak and fastback rear glass without vertical steps or standing panels.
  - Rear lamps: bespoke tail lamp geometry with rear-facing cap normals (-Z) to prevent backface culling in Three.js renderer.
- `assets/models/rv_rotary.json`: body-only model (1,914 triangles, under 2,500 budget; bounds x: [-0.9750, 0.9750], y: [0.1800, 1.2150], z: [-2.2500, 2.0300]), check() clean with 0 problems.
- `assets/models/rv_rotary_full.json`: full car with wheels (2,618 triangles, under 3,200 budget; bounds x: [-0.9750, 0.9750], y: [0.0000, 1.2150], z: [-2.2500, 2.0300]), check() clean with 0 problems.

## 0.9.52 (2026-10-07)

Mazuma RX-Coupe fix round (`rv_rotary`).

- `tools/blender/rv_rotary.py`: reshaped to authentic FD RX-7 proportions addressing all 5 review findings:
  - Tail lamps (two per side, radius 0.06 m) and twin exhaust tips (with dark bores) now face rearward using `cylinder(..., axis='z')`.
  - Dimensions strictly bounded inside the required box: x in [-0.9750, 0.9750] (body width 1.76 m, mirrors to 0.975 m), y in [0.1800, 1.2150] (roof peak 1.215 m <= 1.22 m), z in [-2.2500, 2.0300].
  - Reshaped body: front fenders rise above a dipped hood center, Coke-bottle waist dips into wide rear hips (0.88 m half-width), integrated paint ducktail lip curves from the rear deck, bubble rear window wraps into quarter glass, low rounded nose with oval mouth and tucked chin lip.
- `assets/models/rv_rotary.json`: body-only model (1,895 triangles, well under 2,500 budget; size 1.95 x 1.04 x 4.28 m), verified clean in props viewer.
- `assets/models/rv_rotary_full.json`: full model with wheels (2,599 triangles, well under 3,200 budget; size 1.95 x 1.22 x 4.28 m), verified clean in props viewer.

## 0.9.51 (2026-10-07)

Racer car trial: Mazuma RX-Coupe (`rv_rotary`).

- `tools/blender/rv_rotary.py`: FD RX-7 inspired sports coupe with low sloping nose, raised pop-up headlights, curved waist, bubble rear window, ducktail spoiler, round tail lamps, and viewer wheels.
- `assets/models/rv_rotary.json`: body only model (2,012 triangles, under 2,500 budget), verified clean in props viewer.
- `assets/models/rv_rotary_full.json`: full model with wheels (2,716 triangles, under 3,200 budget), verified clean in props viewer.

## 0.9.50 (2026-10-07)

Pursuit props, first part: spike strip.

- `tools/blender/spike_strip.py`: accordion scissor lattice with 7 diamond bays, hollow metal spikes, yellow and black end caps, and a pull cord.
- `assets/models/spike_strip.json`: 270 triangles, 4.0 x 0.06 x 0.30 m, verified clean in props viewer.

## 0.9.19 (2026-10-07)

Police cars that can be destroyed (C2 part 2).

- Unit kinds have hit points and a bounty (`police/units.js`): cruiser 100 and ¥5,000, unmarked 80
  and ¥8,000, interceptor 120 and ¥12,000, Rhino 260 and ¥20,000. `unitDamage(hit, other, own)`:
  0.35 times the closing speed squared times the unit's share of the crash (a wall counts 1.2),
  nothing under 2 m/s. About five rams at 30 km/h destroy a cruiser; a pillar at 70 does it at once.
- The sim takes hit points on every hit, the player's, other cars' (`collideAgents`) and walls'
  (`collideWorld`), replacing the old wreck threshold of 9 m/s (`hurt`, `destroy`). Below a quarter
  of its hit points a unit limps at 70 % of its top speed. A destroyed unit is a wreck with its bar,
  siren, lamps and hazards off, lost to the pursuit and reported by kind (`takeEvents().destroyed`).
- The director pays each destroyed unit's bounty into the pursuit (`Pursuit.disable(bounty)`),
  counts it as taken out, adds an infraction's worth of heat and raises a `destroyed` event, shown
  for now as a COP TAKEN OUT toast with the bounty (the slam-in banner is part 6). The rap sheet
  keeps a running total of units destroyed.
- `traffic/damage-fx.js`: grey smoke from under the hood below half, black and thicker below a
  quarter, and flames with a column of black smoke on a destroyed unit; two pooled point clouds, one
  draw call each. A hurt unit's paint dulls, a destroyed one is burnt black.
- Version ranges: Claude's 0.9.0 to 0.9.19 is used up; Claude goes on at 0.9.70 to 0.9.99. The
  backend range stays reserved.
- Tests: `tests/police-damage.test.mjs` (damage by speed squared and mass, walls worst; rams wear a
  cruiser down to destroyed, reported by kind; the director pays the kind's bounty). 351 pass.

## 0.9.18 (2026-10-07)

One set of car physics for everybody (C2 part 1).

- A car the player hits is no longer wrecked by any touch. Under 11 m/s closing (about 40 km/h) it
  is `knocked`: a free body on its tires (`stepKnocked`: the sideways slide dies at the tires' grip,
  7.5 m/s2, the driver brakes at 4.5, the spin settles), hazards on, its place on its lane following
  it so the cars behind see it; slow and straight on a lane facing its way, it drives on. A harder
  hit wrecks it, and so does sitting off every lane for 6 s. A unit in a pursuit is still only
  shoved (`knock`).
- Knocked cars and moving wrecks collide with the rest of the traffic by the same mass-and-impulse
  contacts as the player's car (`collideAgents`), so a hit can push one car into the next.
- A wreck slides at the grip of sliding tires (6.8 m/s2 and a light drag) instead of stopping from
  120 km/h in two seconds.
- A duel ends only when the rival is wrecked, not when it is knocked.
- Tests: `tests/traffic-knock.test.mjs` (a tap knocks a car and it drives on within 6 s, a hard hit
  wrecks it, mass counts both ways, a knocked car knocks the next one). Checked in the game: a hatch
  tapped at 15 km/h spins, settles and drives on 1.7 s later. 348 pass.

## 0.9.17 (2026-10-07)

Gemini's models drive in traffic (C1 part 7, the first two).

- `KIND_MODELS` (`traffic/kinds.js`) names a Blender body per kind: the Mazuma RX-Coupe racer
  (`rv_rotary_full`, G2) and the patrol cruiser (`police_cruiser_full`, G3). The world loads them
  with the other models; `TrafficRenderer` takes them and `modelGeometry` (`traffic/bodies.js`)
  turns each into the traffic format: the `paint` material tinted per car, `lamp` faces at the front
  lit as head lamps and `tail` faces as tail lamps, the light bar's lenses dark with the flares set
  on the red lens's own spot. Until a model loads, or for kinds without one, the lofted or boxy
  body stays.
- The C2 plan's pursuit HUD uses Michroma (`FONT.display`), Jc's choice, already bundled.
- Tests: `tests/kind-models.test.mjs` (each named model exists, has the paint, lamp, tail and lens
  materials, and matches its kind's size within 0.35 m). 344 pass.

## 0.9.16 (2026-10-07)

The plan for Jc's pursuit requests: `docs/agents/tasks/C2-pursuit-overhaul.md` (one set of car
physics for every car, destructible police and a kill count, the detection bar, police chasing
racers, more helicopters, a Most Wanted pursuit HUD at the bottom center, banners with flair, a
bigger minimap with the heat on it, the audio expansion). `docs/DESIGN.md` and `ARCHITECTURE.md`
now say what each inspiration governs: Most Wanted (2005) the police and the pursuit, Night-Runners
Prologue the world, the rendering and the driving.

## 0.9.15 (2026-10-07)

Review of Gemini's 0.9.54 police cruiser: passes (`G3-police-cars.md`). Two notes for the other three
cars: taller light bar lenses, and the white livery carried down the doors. The rest of G3 comes
before G5, so the police can be wired in together.

## 0.9.14 (2026-10-07)

The Kurogane Line, a Shuto-style elevated expressway over the city (C1 part 5, the expressway).

- `layout.js` `kuroganeLine()`: a dual carriageway (`c3-f`, `c3-r`, two lanes each way, 80 km/h)
  from Route 1's south side up over the port streets and the outer ring, 12 m above the middle of
  Kurogane-dori across downtown, and back down to Route 1. Its junctions are on the inner
  carriageway, which has its slips on the city side, so no ramp crosses the loop: an exit and an
  entry 550 m apart at each end (`c3-ramp-wx`, `wn`, `ex`, `en`, KUROGANE JCT). The south side was
  the only stretch of the inner carriageway with room for both; Minato Toll moved from x -700 to
  x -160, between the Harbor ramps, to clear the south-west entry.
- Its priority sits just under Kurogane-dori's, so before the lifts it takes the avenue's profile and
  rides exactly 12 m over it. A new lift `floor` (`roads.js`) keeps the deck at 6 m to its ends,
  where the ramps, lifted to 6 m at theirs, meet it with no lip.
- Streets pass under it with no junction (lifted roads never form one) and buildings keep out from
  under it. Over the avenue the deck stands on portal frames, two legs on the sidewalks and a
  crossbeam (`portalOver`, drawn in `build-bridges.js`); elsewhere on round piers. The longest span
  is 68 m. The underside has a faint glow so it reads as a ceiling from the avenue.
- `net.js`: a road end joins a road it touches when their heights match, not when the other is
  unlifted, so the deck's ends link to the lifted ramps (and a road under a deck still does not).
- A reset (R) on a deck, the Kurogane Line or Route 1's viaducts, puts the car back on the deck
  instead of the road below (`placeVehicle` takes a height).
- Tests: `tests/kurogane-line.test.mjs` (the deck 12 m over the avenue, streets under it with no
  junction, routes on and off at both ends both ways); the ramp count is 24; the lamp test checks a
  pole on a deck's median against the deck; the cross-city route test samples city lanes only (the
  seeded player now stands by the south-east junction). 343 pass.

## 0.9.13 (2026-10-07)

Review of Gemini's 0.9.53 fix round: the Mazuma RX-Coupe passes (`G2-racer-car-trial.md`). The
hood is closed, the roof flows into the glass, the nose and tail taper. G3 (the police cars, the
cruiser first) is Gemini's next task; the Mazuma goes into the game with C1 part 7.

## 0.9.12 (2026-10-07)

Nitrous, as Jc asked: more heat, a little engine damage, a real risk of over-revving (C1 part 6).

- `src/vehicles/nitrous.js` (pure): `NITROUS` (8 s a bottle, 45 % of peak torque, from half
  throttle, 2.6 C a second, damage 0.004 a second plus 0.012 near the limiter, ¥6,000 a bottle),
  `stepNitrous` and `refillCost`. The state gains `n2o` (the bottle) and `n2oOn`.
- `physics.js` adds the nitrous torque after the rev limiter's cut, so held through a gear it drives
  the revs past the redline into over-rev (and its own damage). Bench: 0-160 km/h 0.6 to 4.0 s
  quicker; a clean run costs 4 to 6 % damage and 10 C; held in 3rd from 90 km/h, 600 to 1,400 rpm
  past the redline and 11 to 22 % damage a bottle. The dry bars do not move.
- Input: `nitrous` on N and right Shift, L3 on a pad; in the controls list and the briefing.
- Pump: once the tank is full, HOLD F TO FILL NITROUS for the empty part of the bottle.
- HUD: a bottle bar with its symbol beside the main dial in every style (`paintNitrous`, `N2O_BAR`;
  lower on the tall digital screens), glowing while it flows, the symbol blinking when empty. The
  cockpit binnacle gets a thin blue strip at its right edge. A new `nitrous` icon in `paintIcon`.
- A long blue exhaust flame while it flows (`fx.n2o`), a high hiss, a solenoid thunk on and a purge
  off.
- Tests: `tests/nitrous.test.mjs` (5): when it flows, the bottle's length, heat and damage, every car
  quicker, the over-rev when held on the limiter, the refill price. 340 pass.

## 0.9.11 (2026-10-07)

Small, recessed cockpit instruments, from Jc's sketch (C1 part 4, the cockpit).

- The cluster binnacle moved from the dash lip (about a third of a meter from the camera, raised into
  view, a third of the frame) onto the dash top under the windshield, 0.12 m past the lip, at 58 %
  size (`BINNACLE` in `cockpit.js`; `podFrame` takes a scale). Its hood is a short dark tunnel with
  sides and a sill, so the dials sit in a recess. The dash-top boost gauge and the center stack
  shrink to 80 %.
- The steering wheel rises into view: its rim sits just under the binnacle as the camera sees it,
  so the wheel frames the cluster from below. `COCKPIT_VIEW.gauges` is gone.
- Checked in the game for all five cars (analog: two to four small dials; digital: a wide low
  screen). 335 tests pass.

## 0.9.10 (2026-10-07)

The HUD clusters stand upright, from Jc's sketch (C1 part 4, the outside view).

- One upright 300 by 400 canvas for every style (`CLUSTER_W`, `CLUSTER_H`; CSS width 200 to 300 px):
  the main dial at the bottom right (`MAIN`), the small gauges on one arc up its left side and over
  its top (`arcSpot`), the way the classic cluster first placed them. The twin's speedometer stands
  above its tach; the sport's five shift lights follow the tach's rim.
- The warning symbols moved inside the main dial (`dialLamps`: a row across the face, or an arc
  round the hub on the busy racing tach). The classic HUD's CHECK ENGINE, OVERREV, DMG and ENGINE
  OFF words are now symbols like the others'.
- The digital and VFD styles are a new tall display: the rev bar curves from the bottom left up the
  side and over the top, thickening as it climbs; the gear, the warnings and big speed digits sit
  inside the curve, the boost, fuel and temperature bars in its corner.
- Tests: the check-engine symbol lights on the classic HUD instead of the words; the layout stands
  upright with the small gauges clear of each other. 335 pass.

## 0.9.9 (2026-10-07)

The music comes in earlier and new tracks drop in without code (C1 part 3).

- The swell: silent below 30 km/h, full at 75, 60 on the pass (was 50, 140 and 100).
- `assets/music/tracks.json` lists the tracks (id, title, file, mood, loudness, `vocal`, optional
  `enabled: false`); `MusicPlayer` loads it at start through `parseManifest` and `setSoundtrack`,
  and keeps the built-in list when the file is missing or leaves a mood without a track.
- `npm run music` (`tools/music-manifest.mjs`) builds it from the folder: measures each new file's
  loudness with ffmpeg, keeps the moods, titles and flags already set, adds new files as `cruise`
  for Jc to set, drops files that are gone, and warns about a mood with no track.
- Tests: the swell at the new speeds; the manifest names real files and covers every mood; defaults,
  skipped entries and a refused list. 334 pass.

## 0.9.8 (2026-10-07)

Lights and sirens (C1 part 2, and B1 part 3).

- The world shader's moving lights take a color each (`uBeamCol` in `psx.js`). The traffic renderer
  fills them in order: the light bars of the four nearest units (red or blue as they flash, a wide
  light above the roof that reaches the road and the walls), the three nearest blinking
  indicators (a small amber pool), then headlight beams. `addBeamLight` puts the same light on the
  player's car.
- `police/lights.js`: Most Wanted's quad flash, red twice on the car's left, blue twice on its right,
  a phase per car. The bar flares are red and blue, larger, and face the player (they were two red
  dots facing the sky, so they showed at a seventh of their size from the side). A blinking
  indicator's flare grows by a third.
- `audio/siren.js`: the three nearest units with their bars on are heard: wail far, yelp within 70 m,
  hi-lo for a roadblock; Doppler from the closing speed; gain by distance to 380 m; panned. The
  helicopter's rotor by distance with its own Doppler. Three siren voices and the rotor are built in
  `audio.js` and play through the effects channel, muffled in the cockpit.
- A pursuit puts the music in the `intense` mood at once (even on the pass) and holds the swell at
  0.85 through cooldown.
- `tools/render-sirens.mjs` writes a check WAV: a unit closing from 300 m, passing, pulling away, then
  a roadblock. `tests/sirens.test.mjs`: the flash pattern, the patterns' range, Doppler, gain, the
  voice choice and panning, the rotor, the pursuit mood. 332 pass.

## 0.9.7 (2026-10-07)

Other cars hit the world (C1 part 1).

- `TrafficSim.hitWorld`, set by the Drive to `Colliders.probe`: every car off its lane (a wreck, a
  police unit driving free at the player) collides as three circles along its length, is pushed
  out, loses its speed into the wall (a 0.2 bounce, a 0.35 scrape along it) and is spun by a hit
  at the nose or the tail. A unit that hits a wall above 9 m/s is wrecked and lost to the pursuit.
  Lane followers are not tested (their lanes are clear), so the traffic costs nothing more.
- Wrecks keep to the ground under them as they slide.
- `tests/traffic-walls.test.mjs`: a sliding wreck stops at a building's face, an angled hit spins,
  a free unit aimed through a block stops and wrecks, lane followers are untouched. 325 pass.

## 0.9.6 (2026-10-07)

Briefs G5 (the other eleven street racers in Blender, with their fixed dimensions from
`bodies/racers.js`) and G6 (the fourteen traffic kinds remade and seven new ones). The Gemini order
is G2, G3's cruiser, G5 two cars at a time, the rest of G3, G1, G4, G6.

## 0.9.5 (2026-10-07)

The plan after the police rebuild, from Jc's requests: `C1-claude-queue.md` (other cars hit the
world; red and blue light bars that light their surroundings, lit blinkers, sirens; the music in at
30 and full at 75 km/h with a track manifest; the instrument rework; a second-layer city expressway
and greenery; nitrous with heat, damage and over-rev risk; Gemini's models into the game),
`G3-police-cars.md` (four police cars) and `G4-city-greenery.md`. The old Claude rows in the task
list fold into C1.

## 0.9.4 (2026-10-07)

Review of the Mazuma fix round (0.9.52), in the G2 brief: the lamps, the tips and the box are fixed;
a hole in the hood, a rectangular plan view and a slab on the roof go to a second fix round (0.9.53).
The task list also records Jc's instrument rework: vertical HUD gauges with the small dials curving
round the main one and the warning lamps inside it, and small recessed cockpit instruments.

## 0.9.3 (2026-10-07)

The police, rebuilt (task B1 parts 1 and 2, taken by Claude while the backend seat is empty).

- New `src/police/director.js`: `PoliceDirector` runs the whole pursuit and returns orders the Drive
  carries out (spawn, chase or search or patrol, the helicopter, a roadblock, flat tires, money, the
  HUD view). `Drive.stepPolice` only feeds it and obeys. Fixes every bug in the B1 list: the pursuit
  ends and clears after a 6 s report so a second one can start; a toll trap is one event, not a
  state; heat has an attention stage (1.5 s of watching) before level 1; a duel only counts when a
  unit sees it; roadblocks find the player's lane from the traffic network; dodged roadblocks are
  counted when passed; spike strips reach the physics; line of sight is a real line.
- `heat.js`: attention, then heat 1 to 5 (a level per 90 s of pursuit and per infraction), kept
  after an escape and cooling a level per 120 s, wiped by a bust.
- New `src/police/sight.js` and `Colliders.solidAt`: buildings and the hillside block sight.
- `traffic/net.js`: `lanesAt`, `locate` and `route` (Dijkstra over lane links with U-turns).
- `traffic/sim.js`: chasing units route to the player along the lanes, drive free at them when close
  with a clear line (on the ground under them), follow the player with IDM instead of piling in,
  shove from heat 2, search the last known position, park in roadblocks, go home when released;
  police ignore lights; a hit sets a unit's speed from the impact and only a hard one wrecks it.
  Unit kinds have a top speed (`top`, km/h) and chase at the player's pace up to it.
- `roadblock.js`: blocks span the road from its center (they were centered on one lane), the strip
  sits in the gap (an operator precedence bug put it 1.7 m off the lane), the hit test uses the
  strip's length and depth, and tires go flat within 1.5 s.
- `physics.js`: `tireGrip` and `tireTop` in the state scale grip and drag.
- Busted: the fine is taken, the car towed to the police HQ and mended. Escaped: the bounty is paid.
  Lifetime totals under `rapSheet`. The spike strip is drawn from Gemini's model
  (`police/pursuit-view.js`); parked roadblock units flash their bars.
- Tests: `police-director.test.mjs` (eleven whole chases on a fake world), `police-units.test.mjs`
  (routing, chasing by the lanes, the free chase, search, roadblock units, release, hits); the heat
  tests rewritten for the new rules. 321 pass.

## 0.9.2 (2026-10-07)

Review of the asset agent's first two commits, and a kit fix the car needed.

- `tools/blender/kit.py`: `cylinder` takes `axis` ('y' upright as before, 'z' along the car, 'x'
  across), so round lamps and exhaust tips can face backward. Before this, every cylinder stood up.
- G2 review (in the brief): the spike strip (0.9.50) is accepted. The Mazuma (0.9.51) passes the
  process but goes back for a fix round (0.9.52): lamps and tips upright, outside the fixed box
  (4.45 m long, roof 1.256 m), and the shape reads as a generic wedge rather than the FD.
- `tasks/README.md`: `package.json` holds the highest version committed, so a lower-range commit
  leaves it alone.

## 0.9.1 (2026-10-07)

Brief G2 (a street racer as a Blender car), and the prop viewer grows options for it.

- `tools/props.html`: `&budget=` sets the triangle budget per model, `&smooth=38` smooths the normals
  under the game's crease (the exporter writes flat normals) so a car shows as it will in the game,
  `&car=0` hides the reference car.
- New brief `G2-racer-car-trial.md`: the Mazuma RX-Coupe modeled in Blender to the player cars'
  standard, before the rest of G1.

## 0.9.0 (2026-10-07)

A new team and a guide that says what is true now; one set of typefaces everywhere.

- The team: Claude orchestrates and owns rendering, the world and the UI; a backend agent (GPT 6 Sol
  or Hermes on Xiaomi MiMo 2.6 Pro) owns the game logic and tests; Gemini 3.8 Flash builds models in
  Blender. One owner per file, ranges 0.9.0 to 0.9.19, 0.9.20 to 0.9.49, 0.9.50 to 0.9.69
  (`docs/agents/tasks/README.md`). The old briefs moved to `tasks/archive/`.
- `ARCHITECTURE.md` rewritten from about 800 lines to the current state, the conventions, how to
  verify, the Blender workflow and the known issues (the police bugs). New briefs: B1 (police repair,
  backend) and G1 (pursuit props, assets).
- New `tools/props.html`: any exported model at night on a road beside a game car, with collider and
  light markers and a `check()` report, for the asset agent to test in a browser.
- Fonts: the classic cluster and the Tab map used their own stack with an Arial Black fallback, the
  page body Arial Narrow, plates, the coin parking sign and the gas station signs the system sans
  serif or monospace; all now use `FONT` and the `--font-*` variables (`--display` and `--body` are
  gone). The settings help says six speedometer styles.

## 0.8.18 (2026-10-04)

Roadblocks and spike strips (A17 part 4).

- New pure `src/police/roadblock.js`. `planRoadblock` lays two or three units across the player's
  lane 250 to 400 m ahead at heat 4 and up, splitting the road into slots and leaving one slot
  open at an end as the gap to thread; `shouldSetRoadblock` and `tooNearBlock` keep one block at
  a time, set up out of sight of the player. `planSpikes` lays a strip across that gap,
  `hitSpikes` says when the car runs over it, and `spikePenalty` is the flat-tire curve: grip and
  top speed fall over the first seconds and mend after `FLAT_TIME` 22 s (or at a pump).
- `src/drive.js`: the block and strip are planned and tracked in `stepPolice`, and the flat-tire
  timer runs from the frame.
- Tests: new `tests/roadblock.test.mjs`, seven cases covering the placement distance, the heat
  gate, the gap, the one-at-a-time rule, the strip and the tire curve.

## 0.8.17 (2026-10-04)

The police chase (A17 part 3): units leave their lanes, the pursuit is wired in.

- `src/traffic/sim.js`: `stepChase`. A pursuing unit within `CHASE_RANGE` 120 m stops following
  its lane and drives at the player, aiming where the player will be (`CHASE_LEAD` 1.2 s ahead),
  braking for the traffic in its way and steering at `CHASE_STEER`. At heat 4 and up a cruiser
  aims at the player's flank to PIT; a Rhino (`headOn`) drives straight at the player. Units
  carry a `pursuit` flag and `sim.heat` decides how hard they drive.
- `src/drive.js`: the police core is wired into the drive frame as `stepPolice`. It feeds the
  heat what they notice (speeding past a unit, a toll speed trap, a duel in sight), starts the
  pursuit when the heat first reaches a level, sends out the roster for that heat, flags the units
  to chase, scrambles the helicopter at heat 3 and over and recalls it on an escape or a bust,
  and steps the pursuit event. `pursuitView()` and `policeMarkers()` now return the A13 contract:
  every unit plus the helicopter with its searchlight, a searching unit's sight cone, and where
  they last saw the player.
- Verified live at 480 lines: forcing the heat to 4 brought out three cruisers, the unmarked fast
  units and the Rhinos, scrambled the helicopter, and filled the HUD view and the map markers.

## 0.8.16 (2026-10-04)

The pursuit as a RaceEvent (A17 part 2).

- New pure `src/race/pursuit.js`: `Pursuit` extends `RaceEvent`, the same shape as `Duel` and
  `Rally`, so the drive loop does not care it is running. Its states are the A13 `PursuitView`
  ones the HUD already draws: `pursuit`, `evading`, `cooldown`, `busted`, `escaped`.
- Losing them: out of sight the evade bar fills (faster the lower the heat, as Most Wanted lets a
  newcomer slip away); back in sight it drains and the pursuit is on again. A full evade bar starts
  the cooldown, where they search the last known position, which widens with time; the helicopter
  seeing you, or any unit, drops you straight back into pursuit.
- The bust: below about 10 km/h with a unit alongside, the bust bar fills over `BUST_TIME` 3 s;
  pulling away empties it again.
- Infractions, each once per pursuit, each adding bounty: speeding, reckless driving, hit and run
  (a civilian wrecked), ramming a police vehicle, resisting arrest (30 s), driving off road,
  damage to property, and a toll gate run at speed. `bounty` rises with time, heat, each
  infraction and the cost to state. `disable()` and `involve()` track units out and involved.
- `view()` returns exactly the A13 `PursuitView` fields (heat, evade, cooldown, bust, units,
  heli, bounty, time), plus the grown MW fields (`infractions`, `cost`, `disabled`, `involved`,
  `hiding`, `report`), so the HUD built in A13 keeps working.
- Tests: new `tests/pursuit.test.mjs`, fifteen cases over the states, the bars, the infractions and
  the end-of-pursuit report.

## 0.8.15 (2026-10-04)

Police patrols and heat (A17 part 1).

- New pure `src/police/units.js`: the four police unit kinds and the Most Wanted roster that decides
  which are on the road at each heat. `police` (the cruiser, the black and white sedan) from heat 1,
  `police-fast` (an unmarked sports car in dark paint with hidden lights, `hidden`) at 3,
  `police-heavy` (the Rhino SUV, `headOn` because it drives at you from ahead) at 4, and
  `police-int` (a supercar in police paint) at 5. Until Claude's police models land, every unit
  borrows an existing body through its `model` id, so the swap later is one line per kind.
  `buildKindGeometry` now resolves a civilian `model` id too and threads the kind's `accent`
  (the black of the two-tone) into `vehicleGeometry`.
- The units live outside the weighted civilian `KINDS` pool so the traffic weights never pick one
  by accident; `kinds.js` registers them in `ALL_KINDS` so the renderer builds their meshes.
- `src/traffic/render.js`: a police light bar is drawn as two extra roof flares, alternating left
  and right at 2 Hz while the unit is chasing, on the same flare mesh (no new draw call). The flare
  budget is now `FLARES_PER_CAR` 6 rather than 4.
- `src/traffic/sim.js`: `spawnUnit` sends one unit out of the motor pool onto a lane near the
  player, `units()`, `countUnits()` and `unitsNear(player, range)` let the police core and the HUD
  find them. Agents carry a `pursuit` flag the renderer reads.
- New pure `src/police/heat.js`: what the police notice. `noticesSpeeding` (a patrol within 60 m
  sees a car more than 40 km/h over the limit), `noticesTrap` (a toll speed trap above 160 km/h),
  and `Heat`, which rises with what they see and with every second of a pursuit (a full five in
  about a minute) and cools after a quiet spell.
- Tests: new `tests/police-heat.test.mjs`, ten cases covering the unit kinds, the roster, the heat
  model and spawning a unit on the network.

## 0.8.13 (2026-10-04)

The controls settings: key rebinding (A16 part 4, by Antigravity; committed by Claude after its session
was halted, with two JSDoc type fixes).

- `src/core/input.js`: `CONTROL_ACTIONS`, `ACTION_LABELS`, `PAD_LABELS`, `keyLabel(code)` (W, UP, SPACE,
  SHIFT), `rebind(map, action, slot, code)` (swaps a key already in use, refuses Escape and Enter),
  `loadBindings()` and `setBindings(map)` with the bindings saved under `keys`.
- The controls screen (`controlsScreen` in menus.js) is a settings screen: two key slots per action and
  the gamepad button, Enter to listen (PRESS KEY), Esc to cancel, RESET TO DEFAULTS, the old briefing in
  a column beside it. Reached from the main menu, Settings and Pause, and returns to where it came from.
- Tests: `tests/controls.test.mjs`.

## 0.8.12 (2026-10-04)

Typography update across the UI with Orbitron, Teko, Dela Gothic One, Share Tech Mono and M PLUS 1p (A16 part 3).

- `style.css`: added all eight font variables to `:root` (`--font-display`, `--font-tech`, `--font-race`, `--font-mono`, `--font-seg7`, `--font-seg14`, `--font-impact`, `--font-jp`). Replaced direct font usages across UI screens.
- Title screen: LOWBEAM in Orbitron 900 with wide tracking, Japanese subtitle 黒鉄ナイトラン in Dela Gothic One, and footer/prompt in Share Tech Mono.
- Main menu: item labels in Orbitron 700 with small Japanese subtitles in M PLUS 1p (ドライブ, ガレージ, 設定, 操作設定), telemetry numbers in Share Tech Mono.
- Settings and Controls: section headings in Orbitron 700, row labels in Michroma, values and keys in Share Tech Mono, audio segment bar readouts in DSEG14.
- Garage: car name in Orbitron 900 with katakana subtitle in M PLUS 1p (ハヤテ, ランパート, ヴェスペラ, ツルギ, ヒカリ), specifications in Share Tech Mono.
- Drive HUD: area name in Michroma with Japanese subtitle in M PLUS 1p from `AREA_JP` in `src/world/layout.js`, money and rally time/splits in Share Tech Mono, rally countdown and toast numbers in Teko 700, headings in Dela Gothic One.
- Pursuit HUD: state banners (PURSUIT, EVADING, BUSTED, ESCAPED) in Dela Gothic One, heat, bounty and timer in Teko.

## 0.8.11 (2026-10-04)

Speedometer settings and garage style readout (A16 part 2).

- `src/ui/menus.js`: added `SPEEDOMETER` row to Settings screen with options `PER CAR` (default) or lock to any style (`CLASSIC`, `TWIN DIAL`, `SPORT TACH`, `DIGITAL LCD`, `1984 VFD`), saved under `clusterStyle` in local storage.
- `src/ui/garage.js`: garage card displays the selected car's HUD cluster style name (`CLUSTER` row).
- `src/drive.js`: passes the stored `clusterStyle` preference when initializing or updating the HUD gauge cluster.
- `src/main.js`: dynamically updates active drive gauge cluster when settings are adjusted.
- `src/ui/cluster.js`: `Cluster` constructor and `setSpec` support stored `clusterStyle` override.

## 0.8.10 (2026-10-04)

Speedometer styles for the HUD cluster (A16 part 1).

- `src/ui/cluster-styles.js`: `CLUSTER_STYLES` (`classic`, `twin`, `sport`, `digital`, `vfd`) and `drawStyled` providing each car with an arcade HUD speedometer matching its dashboard character:
  - `twin`: Rampart 440 twin white dials with red needles in chrome housing, gear window, shift lamp and fuel/temp bars.
  - `sport`: Vespera GT central yellow tachometer with embedded digital speed readout, shift lights and vertical gauges.
  - `digital`: Tsurugi GT-X modern LCD screen in a bezel with gear and warning lamps.
  - `vfd`: Hikari 300ZR 1984 vacuum fluorescent bar-graph display in green, amber, cyan with phosphor ghosting.
- `src/ui/cluster.js`: reads `spec.dash?.hud ?? 'classic'`, caches dial faces per car, and draws the styled clusters.
- `clusterStyleOf`: pure resolver for spec dash style and manual overrides.
- `warningLamps` and `shiftLightsLit`: pure warning lamp (CHECK, DMG, REV, ENG OFF, HOT) and shift light calculations.
- Tests: `tests/cluster.test.mjs` expanded with tests for `CLUSTER_STYLES`, `clusterStyleOf`, warning lamps, shift lights, and multi-style rendering.

## 0.8.7 (2026-10-04)

Symbols for the warnings, fuel and temperature as gauges, the gear inside the gauges, bigger screens.

- `instruments.js`: `paintIcon` (engine, wrench, overrev, battery, temp, fuel, turbo); the LCD and VFD
  use symbols for their bars and warnings; the tuner face shows a symbol for boost, temp and fuel.
- `cluster-styles.js`: warnings in fixed slots (`lampIcons`), faint when off; `warningLamps` gains
  `icon` and a FUEL lamp; small fuel and temperature gauges on twin, sport and tuner; the gear in the
  Rampart's tach and in the Vespera's speed window; the digital strips scaled up.

## 0.8.6 (2026-10-04)

The HUD clusters float instead of sitting on boards, and the Hayate gets a racing tach.

- `cluster-styles.js`: no housings; `twin` and `sport` float with shadows, `digital` and `vfd` are bare,
  leaned and glowing like Cyberpunk 2077's car displays, the analog styles show a lamp only when lit;
  new style `tuner` (racing tach, small boost and temperature gauges, fuel bar).
- `instruments.js`: the `tuner` face, `paintTunerReadout`, `paintNeedle` takes the face, `paintScreen`
  takes `bare`. `dash.js`: face `tuner`, `dialAngle`. The Hayate's tach and boost gauge are racing
  gauges, its HUD style `tuner`; the cockpit's racing tach shows the live speed in its LCD.
- Settings and garage name the new style (RACING TACH).
- Tests: the racing sweep and face, the style list.

## 0.8.5 (2026-10-04)

Japanese area names, and the briefs for Most Wanted style chases and the rest of the UI.

- `AREA_JP` in layout.js: the Japanese name of every zone, named road, toll and fallback area name, for
  the subtitle under the area name (A16 part 3).
- Briefs: A16 parts 2 to 4 (the speedometer setting, every face across every screen, a controls
  settings screen with key rebinding), A17 grows a Most Wanted section (unit tiers by heat, infractions
  and cost to state, hiding spots and search, spike strips and roadblocks, pursuit breakers, radio
  chatter, the report), new A18 for Antigravity (that HUD). Ranges: Hermes 0.8.15 to 0.8.24,
  Antigravity 0.8.25 to 0.8.29.

## 0.8.4 (2026-10-04)

Two more typefaces for the UI.

- Orbitron (bold, black) as `FONT.tech` for the title screen and menu headings, and Teko (medium, bold)
  as `FONT.race` for big race and pursuit numbers. Both OFL, vendored by `tools/vendor-fonts.mjs`
  (latin only), licenses in `assets/fonts/`, loaded by `loadFonts`.

## 0.8.3 (2026-10-04)

One set of instrument painters for the cockpit and the HUD (the base of the 0.8.10 HUD styles).

- New `src/vehicles/instruments.js`: the dial face, needle and screen painters moved out of `cockpit.js`
  and `screens.js` (`paintDial` draws at any center and radius, `paintNeedle`, `paintScreen` for `lcd`
  and `vfd`, `readingOf`, `FACES`). The cockpit looks the same; `cluster-styles.js` draws the HUD with
  them.
- The LCD's CHECK ENGINE moved to the top-left corner, clear of the speed digits.
- Tests: `tests/instruments.test.mjs` (numerals on the dial faces, both screens, every HUD style for
  every car).

## 0.8.2 (2026-10-04)

Give every car its own instruments, and add the Hikari 300ZR with a fluorescent dash.

- `dash.js`: gauge faces (`classic`, `white`, `yellow`) and screen pods (`lcd`, `vfd`); the Rampart's
  dials are cream, the Vespera's yellow, the Tsurugi's cluster an LCD, the Hikari's a VFD;
  `segmentsLit` and `tachZone`.
- New `screens.js`: the LCD and VFD drawn with DSEG7, DSEG14 and Share Tech Mono.
- `cockpit.js`: faces with numerals and red needles; screen pods; the wheel marker smaller and the rim
  lower so it never covers a display.
- New car `hikari` in specs.js and models.js (1984 turbo coupe, pop-up lamps, fastback); every spec
  names its HUD cluster style (`dash.hud`) for A16. Not a street racer yet (traffic test samples).
- Tests: faces and screens per car, the bar graph tach; the gear count list has five cars.

## 0.8.1 (2026-10-04)

Fix the cockpit view: see the road, the gauges and the wheel in every car.

- `cockpit.js`: `cockpitCamera` solves the camera per car from its eye, cowl and roof so the road shows
  from 5 m ahead (it was hidden for 33 to 100 m); the binnacle is raised to sit in frame under the road;
  the steering wheel is placed by its tilted rim top under the gauges, with a lighter rim and a yellow
  marker. `COCKPIT_VIEW` holds the numbers. The header strip is slimmer.
- `cameras.js` reads the camera from the cockpit instead of fixed offsets.

## 0.8.0 (2026-10-04)

More typefaces: segment digits, a monospace, a heavy display face and a Japanese face.

- New dev dependencies `dseg`, `@fontsource/share-tech-mono`, `@fontsource/dela-gothic-one`,
  `@fontsource/m-plus-1p` (all OFL); `tools/vendor-fonts.mjs` copies them into `assets/fonts/` and
  writes `fonts.css` (linked from index.html); `assets/fonts/LICENSES.md` lists every face.
- New `src/render/fonts.js`: `FONT` stacks and `loadFonts`, awaited by `World.create` before any canvas.
- Signs: M PLUS 1p for the Japanese, Dela Gothic One for plaza, brand and lot names, DSEG7 for prices,
  pump displays and plates.
- `concepts/` (reference images from the web) is git-ignored and out of the history.

## 0.7.15 (2026-10-04)

Blinkers on the civilian traffic (A14 part 1).

- `src/traffic/sim.js`: agents carry `signal` (-1 left, 0 off, +1 right, 2 for hazards) in the
  driver's own frame. A civilian that decides to change lanes signals first and only moves after
  `SIGNAL_MIN` 1.2 to `SIGNAL_MAX` 2.5 s from its own random stream, then looks again; if the gap
  closed the signal goes off and the change is dropped. The signal stays on through the move and
  goes off when it ends. The checks a move has to pass are now `changeSafe`, called both before the
  signal and again after it, so a lane that fills up while the car waits cancels it.
- Turns and exits signal the same way: `signalForTurn` starts the signal about `SIGNAL_LEAD` 60 m
  before a planned exit or turn, an exit to the right and a turn whichever way the target lane is.
- Street racers never signal; they weave. A wreck runs its hazards on both sides until it fades.
- `src/traffic/render.js`: the flare on the outer head and tail lamp on the signalling side goes
  amber (`SIGNAL`) while the indicator is lit, blinking at about 1.5 Hz (`BLINK` 0.33 s on and off)
  with a phase per agent so a queue does not blink in unison. It uses the flares that were already
  there, so there is no extra draw call, and `update` now takes the clock as its third argument.
- Tests: new `tests/blinkers.test.mjs`, seven cases: a fresh agent has no signal, a lane change is
  signalled on the correct side for at least 1.2 s before the move starts, the signal runs 1.2 to
  2.5 s across five seeds, a change dropped because the gap closed turns the signal off, racers
  never signal, a wreck runs its hazards, and a car signals about 60 m out for an exit.
- Civilian lane changes reversed within 6 s stay at 0.0 % on the brief's seed 21 setup, so the
  blinkers did not make the dithering worse.

## 0.7.16 (2026-10-04)

The pass-by whoosh, as strong as the speed between you (A14 part 2).

- New pure `src/audio/passby.js`. `PassBy` tracks every traffic agent within `RANGE` 80 m and
  watches the relative position and velocity: when their dot product turns from negative (closing)
  to positive (opening) that is the closest approach, and only then, within `MISS` 14 m and over
  `MIN_SPEED` 4 m/s relative, does it emit one `{ speed, dist, side, heavy, kind }` event. One
  event per pass: a car that has whooshed stays fired until it goes out of range and comes back,
  so a car matching your speed beside you is silent and a pass is never heard twice.
- `passbyGain` is the loudness curve in one place, read by the voice and the tests: strong at
  30 m/s and up, falling with the miss distance so a car 13 m away is nearly nothing. A 120 km/h
  pass is violent and a 15 km/h creep is barely there. `passbyDuration` shortens as the speed
  rises (0.25 + 6 / speed s).
- `renderPassby` is the voice as pure DSP: white noise through a state-variable band-pass whose
  center sweeps down through the pass (Doppler), a swell and decay envelope, and a low rumble
  layer for the heavy vehicles (over `HEAVY_MASS` 4 t: trucks, buses, tankers, semis).
- `src/audio/audio.js`: `passbyVoice` plays that same voice live through the effects channel and
  the camera low-pass, so the cockpit muffles it exactly as it muffles the tires, and pans it to
  the side the car went past on a new `StereoPanner` (the sides follow the repo convention, so
  at yaw 0 the player's left is +X). `update` takes `f.traffic` and runs the tracker each frame.
- `src/drive.js`: one hook, the traffic agents passed into `audio.update`.
- `tools/render-passby.mjs` writes `tools/shots/audio/passby.wav`: a scripted pass at 20, 60 and
  120 km/h relative (plus a semi at 60 for the rumble), measured gains 0.06, 0.61 and 1.34.
- Tests: new `tests/passby.test.mjs`, ten cases: one event per pass, never two for one car,
  a car matching speed beside you silent, a creep and a 30 m miss silent, the left and right
  sides, the heavy flag, louder for faster and closer, and the render's swell and scaling.

## 0.7.13 (2026-10-04)

Set and draw GPS waypoint route on tactical map, minimap and HUD (A15 part 2).

- `src/ui/map.js`: clicking on the tactical map sets a GPS destination, snapping to nearby landmarks or gas stations within 20 screen pixels; Enter sets a waypoint at the map center; Backspace and context menu (right-click) clear the destination. Renders the active route polyline with an amber glow and a pulsing destination pin with a distance tag.
- `src/ui/minimap.js`: draws the active route polyline on top of the road network, draws the destination pin when in range, and clamps a directional indicator arrow to the minimap rim when the waypoint is off-screen.
- New `src/ui/route-hud.js`: DOM component mounted beneath the minimap displaying the remaining route distance (e.g. `420 M` or `3.5 KM`) with styling in `style.css`; flashes an `ARRIVED` banner for 3 seconds upon arrival.
- `src/main.js`: wires `RouteTracker` to the traffic network, updates `tracker` and `routeHud` in the frame loop, syncs visibility in `setState`, and exposes `setWaypoint`, `clearWaypoint`, and `getRoute` on `window.__lowbeam`.
- Tests: `tests/map.test.mjs` expanded with unit tests for map click/key waypoint interaction, route line rendering, edge marker clamping, and `routeHud` distance formatting and arrival state.

## 0.7.12 (2026-10-04)

The GPS waypoint route, pure (A15 part 1).

- New pure `src/ui/route.js`: `routeTo(net, from, to)` snaps car and destination to the nearest directed lanes
  (preferring a lane whose direction agrees with car yaw), runs A* over `(lane, s)` nodes with straight-line
  Euclidean heuristic, and generates a polyline every 10 m with total length and lane list.
- `RouteTracker`: holds the current route, `update(car, dt)` returns the remaining distance, detects arrival
  within 25 m of the destination (`arrived`), and re-plans when the car is more than 40 m off the polyline for 2 s.
- Tests: new `tests/route.test.mjs` verifying directed one-way lanes, T-junction turns, off-course re-planning,
  arrival detection, G1 to Police HQ route existence under 1.6x straight-line distance, and planning in under 30 ms.

## 0.7.11 (2026-10-04)

Police and helicopter markers on the minimap and Tab tactical map.

- `src/ui/minimap.js`: takes markers getter; draws police cars as directional chevrons flashing between red and blue with a 0.4 s siren rhythm; draws the helicopter with a spinning rotor glyph and translucent searchlight circle of radius `r`; clamps markers outside the minimap circle to the rim as edge indicator arrows.
- `src/ui/map.js`: `MapScreen` accepts markers getter; renders police chevrons and helicopter rotor glyphs oriented along heading and translucent searchlight spots in world space.
- Tests: `tests/map.test.mjs` extended with checks for police and helicopter markers, searchlight circles, heading rotation, and rim edge clamping.

## 0.7.10 (2026-10-04)

The pursuit HUD (NFS: Most Wanted 2005 style).

- New `src/ui/pursuit.js`: `pursuitHud` DOM component and pure `layoutPursuit(view)`.
  Displays five heat pips, status banner (`PURSUIT`, `EVADING`, `COOLDOWN`, `BUSTED`, `ESCAPED`),
  units count, helicopter tag, dual bars (evade/cooldown + conditional bust bar), bounty and time footer.
- `style.css`: `.pursuit-hud` with skewed amber heat marks, colored state banners, progress bars and smooth terminal fade-out.
- `src/main.js`: mounts `pursuitHud`, steps it in frame loop, exports `window.__lowbeam.pursuitDemo(state, markers)` and `getMarkers()`.
- Tests: `tests/pursuit-hud.test.mjs` verifying heat calculation, state banner formatting, bar fills, bust bar activation and terminal states.

## 0.7.9 (2026-10-04)

Hang the gas stations' dispensers from the canopy, after the user's photo.

- `gas-station.js`: hanging sign boxes over the pumps (brand swoosh, lane number, fuel in its color),
  coiled hoses to colored nozzles, payment posts on the islands, a white slatted ceiling with boxy
  square fixtures, red-brown lanes, a PRO PIT service bay with its yellow sign, a tire rack and a wash
  banner at the kiosk.
- `scatter.js`: `stationLayout` places the tire rack (with a collider) and moves the vending machines to
  the shop's end.

## 0.7.8 (2026-10-04)

Brief A15 for Antigravity: the GPS waypoint.

- New `docs/agents/tasks/A15-gps-waypoint.md`: a pure route over the traffic lanes (`routeTo`,
  `RouteTracker`), set from the Tab map and drawn on both maps with the distance left. A13 marked done.

## 0.7.7 (2026-10-04)

Fill the town with smaller buildings and housing.

- New kinds in `buildings.js` and `props.js`: shophouses (lit shop, awning, signboard), walk-up
  apartments (open corridors, doors, lamps, stair core), narrow townhouses (street gable, carport),
  machiya (timber lattice front, lean-to roof, noren, red lantern) and coin parking lots (bays, parked
  cars with colliders, P sign). New district mixes in `STYLES`; street-front-only kinds; the back row
  picks by weight; parking only on flat ground.
- `textures.js`: `shopTexture`, `shopSignAtlas` (`SHOP_SIGNS` and the P sign), `awningTexture`,
  `latticeTexture`, `parkingTexture`; the gas stations use the shared shop texture.
- Lights for shop fronts, walk-up corridors, parking lots and machiya lanterns.

## 0.7.6 (2026-10-04)

Rebuild the gas stations the Japanese way, to match the toll plazas.

- `gas-station.js`: a deep canopy with a lit brand fascia and a lamp grid, two-tone pillars, striped
  islands with bollards, self-service dispensers with lit price heads and colored nozzles, hose reels
  hanging from the canopy, a price pylon square to the road, a glass-fronted kiosk with a lit band,
  vending machines, and IN and OUT boards. One atlas and one fascia texture per brand.
- `scatter.js`: `stationLayout` places the vending machines and the boards, `placeStation` gives them
  colliders; the pylon's collider grows to 1 m.

## 0.7.5 (2026-10-04)

The police helicopter: modeled in Blender, parked on the HQ roof, flying and lighting the target.

- New `tools/blender/heli.py` and `assets/models/heli*.json`: body, main rotor and tail rotor as
  three models; `kit.py` gains `loft` (a body from elliptical stations, split into materials) and an
  object filter on `export`.
- New pure `src/police/heli.js` (`Heli`, `Skyline`, `helipadOf`) and `src/police/heli-view.js`.
- `World.create` loads the helicopter's models (`world.models`); `Drive` parks it on the HQ roof, steps
  and draws it, and answers the A13 contract (`policeMarkers`, `pursuitView`); `scrambleHeli` and
  `recallHeli` stand in for the police core.
- Tests: `tests/heli.test.mjs` (spin up before lift off, follows a car at 100 km/h with the light on it,
  never under the clearance over a 130 m tower, outrun by a fast car, lost under a deck, lands and spins
  down on the pad, banks and pitches).

## 0.7.4 (2026-10-04)

Brief A14 for Hermes, the next plan, and the changelog back in version order.

- New `docs/agents/tasks/A14-blinkers-passby.md`: blinkers on the civilian traffic (signal before a
  lane change, a turn, an exit or a merge; hazards on wrecks) and the pass-by whoosh scaled by the
  relative speed (a pure `PassBy` and its voice).
- Task index: A11 and A12 done, A13 (Antigravity) and A14 (Hermes) running, and Claude's next work:
  the helicopter, the gas stations modeled after the toll plazas, smaller buildings and housing.
- The changelog is sorted by version again (the agents' version ranges interleave in time).
- ARCHITECTURE's current state header follows the highest version, not the latest commit.

## 0.7.3 (2026-10-04)

Brief A13 for the pursuit HUD, ahead of the helicopter and the police.

- New `docs/agents/tasks/A13-pursuit-hud.md`: the contract the helicopter, the police core and the HUD
  share (`drive.pursuitView()`, `drive.policeMarkers()`), the pursuit HUD and the police markers on
  both maps for Antigravity. New version ranges per agent in the task index.
- ARCHITECTURE: lamp and building counts corrected from `npm run bench` (4,600 lamps, 8,900 buildings).

## 0.7.2 (2026-10-04)

Even out the steep spots where overpasses and slip roads meet the ground.

- `roads.js` `applyLifts`: a lifted road is raised (never lowered, so clearance holds) where the lift
  eases onto ground that climbs on its own; Route 18 over the ridge goes from 11.1 % to 7.5 %, Harbor
  Ave from 8.2 % to 7.5 %.
- `roads.js` `easeSlip`: a slip road's climb is eased into the stretch held at the carriageway's height;
  the Route 18 ramps go from 7.6 and 8.8 % to 6.5 %. Both ends of every ramp still meet exactly.

## 0.7.1 (2026-10-04)

Put Route 1 on two viaducts across the north corners.

- `C1_VIADUCTS` in layout.js: Route 1 rises 12 m across the north-east corner (KITA TOLL to the Route 1
  east gas station) and the north-west corner (West Ave to Route 18), clear of every ramp, plaza and pad.
- One deck for both carriageways (`build-bridges.js`): the forward slab spans the median to the far
  edge, the median is decked over, no median parapets or wall colliders (`scatter.js`).
- Median lamps stand on the deck (pole colliders only at deck height); the guard rails stop where the
  parapets start (`highway.js`); the underside is a separate material outside the light pools.

## 0.7.0 (2026-10-04)

Rebuild the toll plazas after the Shuto Expressway's Oi plaza.

- `build-highway.js`: a new plaza: blue columns, a fascia on each face with lit lane signs (ETC専用,
  ETC/一般, 一般), round signals and amber lamps, a glass and blue panel band and red fins, the name
  plate in kanji and romaji, three banners on top, chevron boards over the islands, booths with lit
  windows, striped impact cushions, hazard poles, fee and camera boards, barrier arms, light masts.
  All signs of a plaza come from one canvas atlas. The mirrored green name board is gone.
- `highway.js`: lanes carry a `sign` counted from the median out (the cash lane is now the outer
  lane on both carriageways), the ETC only lanes get blue paint strips along the carriageway
  (`paint`), `PLAZA_PARTS` sizes the islands, cushions and masts; colliders for the longer islands,
  the outer columns and the masts; the canopy lights are spot pools and the masts light the fascia.

## 0.6.12 (2026-10-04)

World-build bench (A12 part 3).

- `tools/buildbench.mjs`: Node benchmark timing each world-build stage (`layout import`, `citygen streets`,
  `Ground` construction and carve, the junction finder, `placeBuildings`, `scatterWorld`, `forest`)
  over 3 runs using pure modules only.
- Prints a table of median ms, percentage share, and element counts (roads, streets, junctions,
  buildings, lamps, trees, lights).
- Added `npm run bench` script to `package.json`.

## 0.6.11 (2026-10-04)

Landmark model viewer (A12 part 2).

- `tools/landmarks.html`: the police HQ, a garage and a hideout side by side on a floor at night, loaded
  through `loadModels` and built by `buildLots` with its materials, lit by the models' own lights through
  `installPools`. Each light is a small marker (L toggles them), each collider a green wireframe box (C
  toggles them). Keys 1 to 3 solo a model, 0 shows all, drag orbits, the wheel zooms. The readout lists
  vertices, triangles, colliders and lights per model. `window.__landmarks.shot(name)` writes
  `tools/shots/<name>.png`. The page sets `<base href="/">` because `loadModels` fetches a relative URL.

## 0.6.10 (2026-10-04)

Landmarks on the minimap (A12 part 1).

- `minimap.js`: the police HQ, garages and hideouts (`ground.lots`) are drawn with the tactical map's
  icons (`drawPoiIcon`, shield, wrench, dashed square) at 0.8 scale. They are placed like the station
  icons: positions turn with the map, the icons stay upright, all inside the minimap's circular clip.
- The tactical map already labels every point of interest with its name, lots included.
- `tests/map.test.mjs`: the minimap draws a lot's icon inside the clip when it is near the car and
  skips a far one.

## 0.6.9 (2026-10-04)

Starting the Kuro Pass run, the rally HUD, and the T-junction give-way (A11 part 3).

- `src/drive.js`: the run, marked like the duel. Stopped within 15 m of the start line the prompt
  reads `F  KURO PASS TIME ATTACK` and F begins a run: `placeOnRallyStart` puts the car on the line
  facing down the stage, `audio.music.hold('ridge')` runs, `audio.beep('count')` and
  `audio.beep('go')` come from the race events, and R during a run puts the car back on the stage
  with the 5 s penalty. A new best and its ghost are saved per car under `rallyBest` and
  `rallyGhost`. The stage road comes from `ground.roads.byId.get(RALLY.road)` every time, never a
  cached position.
- `src/traffic/sim.js`: `rallyRoad` stops spawning on that road and fades out any agent still on it,
  so the stage belongs to the player while a run is going.
- `src/traffic/sim.js`: the T-junction give-way Antigravity's net.js left as data is now read. A
  stop carrying `yield: { lanes, at }` holds a side-road car while anything on the through road could
  reach the junction in less than `YIELD_TIME` 4.5 s (`yieldClear`, looking `YIELD_LOOK` 45 m up the
  road), and lets it go once the road is clear. Every yield line sits about 11 m short of the lane
  end, so a car waiting there waits `YIELD_LINE` 0.4 m short of it rather than on top of it, which
  would creep it to a standstill and never let it turn in.
- `src/ui/hud.js` and `style.css`: the rally panel, the clock, the split at each gate (green ahead,
  red behind), the next two pace notes as big text, the off-course countdown and the result card for
  4 s. It sits at the top, so it stays clear of the gauges in the cockpit view.
- `src/audio/soundtrack.js`: a `rally` flag on the swell scene, like `rival`, holding the level at
  `SWELL.rallyFloor` 0.7 so a run is never silent below 50 km/h. Threading it to the swell needed
  one extra line in `music.js` (`setScene`) and one in `audio.js`, which were outside the part's
  stated file list; both were authorized as one-line edits.
- Tests: new `tests/rally-traffic.test.mjs` (five cases: the network has yield stops, an agent
  stops at one while traffic approaches, the same agent goes once it is clear, a rally road clears
  traffic and keeps it from spawning and gives it back afterwards, and other roads are unaffected)
  and two more in `tests/rally.test.mjs` (gates count in order and only then does the finish count,
  and a run that cannot pass a gate never finishes however far it drives).
- Verified in the browser at 480 lines: the prompt reads `F  KURO PASS TIME ATTACK`, F starts the
  countdown, the panel shows the clock and both pace notes on the pass, and a full run through every
  gate finishes gold with the splits alternating behind and ahead of a stored best.

## 0.6.8 (2026-10-04)

The Kuro Pass time attack, the second RaceEvent (A11 part 2).

- New pure `src/race/rally.js`: `Rally extends` the A9 base. `new Rally(carId, cfg, road, opts?)`
  takes the stage road (a `world/roads.js` Road through `path.length`, or anything with a plain
  `length`), starts at `cfg.startS` and finishes `cfg.finishEndOffset` short of the end, with
  `cfg.checkpoints` gates spread evenly between. Gates only count when the car is actually on the
  road, so cutting one does not finish the run; `nextGate()` is the next required gate.
- Splits are recorded at every gate and at the finish as `{ at, against, ahead }` and compared
  against the saved best for that car, passed in as `opts.best` and `opts.bestSplits`. Medals come
  from `cfg.medals` (average km/h targets, gold first) and the prize from `cfg.prize`.
  `penalize()` adds `PENALTY` 5 s for putting the car back on the stage.
- Off course: more than `OFF_COURSE` 25 m from the road for `OFF_LIMIT` 3 s starts an `OFF_GRACE`
  10 s countdown, then the run aborts with no result. Coming back on the road clears the timer.
- Ghost: `recordGhost(t, pose)` stores `x`, `z` and `yaw` as whole centimeters and centi-radians
  every `GHOST_STEP` 0.1 s, and `ghostAt(t)` interpolates between samples, returning null outside
  the recorded span so the caller knows not to draw anything. Drawing the ghost car is Claude's.
- Pure module: it never reads or writes the save, so `Drive` owns `rallyBest` and `rallyGhost`.
- Tests: `tests/rally.test.mjs`, 15 cases: the 3 s countdown holds the clock, gates evenly spaced
  between start and finish, a run through every gate finishes with a time and a medal, skipping a
  gate does not finish, the penalty adds exactly 5 s, the off-course countdown aborts and coming
  back clears it, `ghostAt` interpolates and returns null outside the span, ghost samples are
  stored as integers, splits compare against a best time (and are null with no best), medals and
  prize come from the config, a fast run wins gold, and `RALLY` is left as authored.
- Verified against the real Kuro Pass road read through `ground.roads.byId.get(RALLY.road)`: a
  5,913 m stage from s 400 to 6,313 with gates at 1583, 2765, 3948 and 5130, gold at 251.9 km/h.
  Positions are read from the road, never hard-coded, since the map is still moving.

## 0.6.7 (2026-10-04)

Model the police headquarters, garages and hideouts in Blender and place them on lots.

- New `LOTS` in layout.js: the police HQ on Hanazaki Cape, three tuning garages and three hideout
  warehouses, each a flat lot beside a road; the city streets keep clear of them (`blocked` in
  `cityStreets`).
- `Ground.lots`: landmark pads, flattened and paved like the forecourts (pad offset now counts the
  road's sidewalk).
- New `tools/blender/` (kit and one script per model) and `assets/models/*.json`, built with the
  Blender MCP and exported with box-projected UVs, colliders and lights.
- New pure `src/world/lots.js` and `src/world/build-lots.js`; the scatter adds the lots' colliders and
  lights, `World.create` builds the models; map points for police, garages and hideouts.
- Tests: `tests/lots.test.mjs` (frame, contents, every lot flat and clear of streets).
- Task brief index: A12 (Antigravity) and the A11 resume (Hermes); version ranges per agent.

## 0.6.6 (2026-10-04)

F3 stats overlay displays performance and scene metrics.

- New `src/ui/stats.js`: F3 toggles a corner readout of frames per second, draw calls, triangles (`renderer.info.render`), and traffic agent count.
- Hooked into `src/main.js` with inline styles and zero `style.css` edits.

## 0.6.5 (2026-10-04)

Pace notes for the Kuro Pass rally (A11 part 1).

- New pure `src/race/pacenotes.js`: `paceNotes(path, heightAt?)` walks a stage every 5 m
  (`NOTE_STEP`) and returns one note per corner, `{ s, dir, grade, mods }`. The radius comes from
  the heading change over that step and `gradeFor` maps it to 1 (tightest) through 6 (nearly
  flat). `dir` is left or right from the sign of the yaw change, the same convention as
  `vehicles/physics.js`. Mods: `hairpin` under `HAIRPIN_R` 20 m, `long` past `LONG_M` 60 m,
  `tightens` and `opens` when the radius changes by half (`CHANGE_R`) across the corner, `crest`
  where a climb tops out, and `into` when the next corner starts within `INTO_S` 30 m. A crest is
  a mod on the nearest corner rather than a note of its own. `path` only needs `length` and
  `sample(s)`, which `world/spline.js` `Path` already provides; `heightAt(s)` is optional and is
  what turns crests on.
- Tests: new `tests/pacenotes.test.mjs`, ten cases on synthetic paths: radius 15 is a hairpin,
  radius 150 grades 5 or 6, a left bend reads left and a right bend reads right, an S calls the
  second corner `into`, a corner over 60 m is `long`, a changing radius is `tightens` or `opens`,
  a climb topping out is a `crest`, every note carries an `s` inside the path with a valid grade
  and dir, a straight road produces nothing, and `HAIRPIN_R` is 20.

## 0.6.3 (2026-10-04)

Kurogane City becomes a real street network, built up from the waterfront to the expressway.

- New pure `src/world/citygen.js`: frame roads (Chuo-dori, Kurogane-dori, the Naikan and Sotokan
  rings) are authored; each district fills with its own streets at its own angle and spacing, bent,
  broken off a block early here and there, meeting the frame roads at T junctions, clear of the
  expressway, the ramps, lifted road and the pass. Nine districts, inside and outside the loop
  (downtown, midtown, residential, the port, the industrial east coast, the west side). About 400
  streets replace the 28-street grid; `GRID` and `streetGrid` are gone, and the avenues no longer
  taper to meet it.
- New pure `src/world/junctions.js`: crossings and T junctions from the road geometry. The road
  builder paves each as one patch and drops skirts and sidewalks inside it; the old grid-only
  crossing and curb builder is gone.
- Roads can have sidewalks (`walk` on the def): a 16 cm curb and a concrete walk on each side,
  part of the ribbon; the ground counts them as road. Lamps stand at the sidewalk's edge and never in
  a junction. Ribbons are merged per 256 m cell and material.
- New pure `src/world/buildings.js`: a row of buildings along each side of every town road and a
  second row behind in the denser districts, by district style (`cityStyle` in layout.js): towers
  and offices downtown, offices and apartment blocks in midtown, houses and small blocks in the
  residential districts, warehouses, garages and factories in the port and the industrial east,
  a house now and then on country roads. A 2 m road mask and a building hash keep it fast (about
  13,000 buildings).
- `props.js`: the town is merged per 320 m cell and culled like the ground, and each kind has a
  shape: stepped tower crowns with an aviation lamp, apartment balconies, pitched house roofs,
  corrugated sheds with roller doors, lit garage shutters, saw-tooth factory roofs.
- Town ground is paved (`TERRAIN.paved`); no trees grow on it. The east coast has a wider shelf.
- Faster build: district polygons are rasterized (`polygonMask`), road queries visit only the
  roads near the point, terrain far from every road skips the road lookup, and once the light pools
  are on `bakeGeometry` writes zeros instead of baking.
- Road heights at junctions run from one junction's correction to the next instead of averaging
  them (the average left steps beside a junction); the shortest junction blend is 50 m (was 35).
  Terrain is carved to the lowest road within reach, so it never pokes through a street beside
  another on a hillside.
- `traffic/sim.js`: spawns pick from the lanes near the player (40 m lane pieces in a 160 m grid);
  with ten times the lanes, picking from the whole island left the player's surroundings empty.
  Expressway traffic density 4.5 (was 3).
- Tests: town roads that cross at grade are joined by a paved junction; at-grade crossings are only
  forbidden for expressways and ramps; joins at Chuo-dori, Kurogane-dori and the coast roads;
  lamps may stand on sidewalks; streets may reach 20 % at hillside junctions.

## 0.6.2 (2026-10-04)

Island map rendering, elevated viaduct runs, new tactical POI icons and legend.

- `src/ui/map.js`: renders sea outside `water.coast` polygon with evenodd winding rule and fallback
  to `water.sea`. Maps elevated road runs on top of ground ribbons.
- `src/ui/map.js`: adds dedicated vector icons for `police` (shield), `garage` (wrench), and `hideout`
  (dashed square) next to existing station, toll, and rally markers, with a tactical map legend.
- `src/ui/minimap.js`: `drawRoads` renders lifted road runs above ground roads with dark outlines.
- `tests/map.test.mjs`: tests for island coast, elevated road overlays, and all POI icons with mock data.

## 0.6.1 (2026-10-04)

Traffic junctions at any angle, T junctions with yield stops, and multi-arm node merging.

- `src/traffic/net.js`: `linkCrossings` supports crossings between any two-way surface roads of class
  `street` or `arterial`. Crossings where either road is lifted more than 2 m are skipped as bridges.
- Light axes are assigned per road at the junction node (road A axis 0, road B axis 1) rather than from
  world direction octants, preserving alternation on curved and non-orthogonal intersections.
- T junctions: a road ending on another surface road's side receives a stop line with yield data
  (`{ s, yield: { lanes, at } }`), turn links onto both directions of the through road, and mid turn
  links from both through road directions into the side road.
- Crossings with five or more arms and junctions closer than 25 m merge into one light node.
- `tests/net.test.mjs`: unit tests for angled crossings, T junctions, bridge clearance, and node merging.

## 0.6.0 (2026-10-04)

Kurogane becomes an island, and the pass no longer ends in a hook by the lake.

- `COAST` in layout.js and new pure `src/world/island.js` (`inland`, the distance inside the
  shore, precomputed on a 24 m grid with a noisy shore). `heightfield.js` drops the land into the
  sea along it: cliffs under the western mountains, a low shelf elsewhere. The east coast and the
  north shore are low land for the industrial district and the coast roads. The bay is part of the
  same shore; `SEA` no longer shapes the terrain.
- `build-terrain.js`: one water sheet at sea level under the whole map replaces the lake discs and
  the bay sheet.
- `forest.js`: the edge belt and the thicket are gone (the sea is the edge now); trees within
  150 m of the shore are mostly black pine.
- New roads: the Higashi Coast Road (port to Hanazaki Cape up the east coast) and the Kita Coast
  Road (cape to the forest village along the north shore), which runs straight on into Kuro Pass.
  Route 18 ends on the Kita Coast Road at a T, East Ave on the Higashi Coast Road. G3 moved onto
  the Kita Coast Road. New zones: Hanazaki Cape, Kita Coast, Higashi Industrial.
- `mapData.water.coast` for the map screens; `waterAmount` reads the shore.
- Tests: the island is ringed by sea, the shore is lined with pines, and the terrain test checks
  the island's shape; the edge belt tests are gone.

## 0.5.2 (2026-10-04)

Traffic drives with its lights on.

- `src/traffic/render.js`: every car within 420 m of the player gets four flares, white at the
  head lamps and red at the tail lamps (brighter and bigger when braking), found from the body's
  `lamp` vertices (`lampSpots`), one instanced draw call for all of them. The 16 cars nearest the
  player throw a headlight beam onto the road, walls and buildings. `update(agents, focus)` takes
  the player; `drive.js` passes it.
- `src/render/psx.js`: `psxFlare`, an additive camera-facing quad that flares toward where the
  lamp faces and fades with the fog; the pool shader adds the beams (`BEAMS` 16, `uBeamPos`,
  `uBeamDir`), banded like the lamp pools.
- `src/render/textures.js`: `flareTexture`.

## 0.5.1 (2026-10-04)

Street lamps throw real pools of light, and every lamp has two arms.

- New `src/render/pools.js` and pure `src/render/pool-grid.js`: every world light goes into a float
  texture, and a 24 m grid over the map lists up to 12 lights per cell, strongest first.
  `World.create` installs them; `psx.js` materials made with `baked: true` then light each pixel
  from the cell's list instead of the per-vertex `bake` attribute, whose glow followed the 8 m
  terrain cells and the road ribbon columns and had no shape.
- Lamp heads are cone lights (`spot: 1` on the light): a pool about 16 m across with a visible edge
  and a faint spill outside it. All pool light is cut into 7 bands (`POOL_BANDS`).
- `scatter.js`, `props.js`: lamps have two arms. A pole in a median (Route 1, the Bayshore Line)
  lights both carriageways; a roadside pole also has a short, lower, dimmer arm over the sidewalk.
  Lamp light reach is 22 m (was 19).
- Tests: `tests/pools.test.mjs` for the grid (a light is listed in every cell it reaches and no
  other; a crowded cell keeps the strongest first and never overflows).

## 0.5.0 (2026-10-04)

Music that follows the speed, a sharper default picture, and cameras that look out over the car.

- `src/audio/soundtrack.js`: `SpeedSwell` and `SWELL`. While driving, the recorded music is
  silent below 50 km/h and swells in toward full at 140 km/h (100 on the pass), about 8 s from
  silence to full, falling slower and only after 3 s of lower speed. A racer within 150 m holds
  it at 0.55 or more. The fast mood now starts after 3 s above 140 km/h (was 4 s above 150).
- `src/audio/music.js`: the swell drives a gain and a low-pass (320 Hz at zero, opening an octave
  per sixth of the swell) on the recorded tracks, so a track comes in muffled and escalates with
  the speed. Menus play at full, pause holds the swell. `NOW PLAYING` shows once a track is audible.
- `src/render/stage.js`: `RENDER_HEIGHTS` 240, 360, 480, 600, 720 and 1080 lines, `DEFAULT_LINES`
  480. `main.js` applies the stored height at boot (it was only applied when changed in settings).
- `src/render/cameras.js`: the car view is 5.6 m back and 1.8 m up and looks 7 m ahead of the car,
  so the road shows over it; the cockpit camera sits 22 cm ahead of the modeled eye and looks
  less far down, so the windshield fills the top half instead of the roof header and the dash.
- `src/ui/cluster.js`: the TEMP and EXH readouts showed `Â°C` (a mis-encoded degree sign).
- Tests: three for the swell in `tests/soundtrack.test.mjs`.

## 0.4.23 (2026-10-03)

Challenging a street racer, the first RaceEvent (A9 part 3).

- New `src/race/`, pure like the rest of the physics: `race/event.js` holds the `RaceEvent`
  interface every race kind shares (`id`, `kind`, `state`, `time`, `participants`,
  `update(dt, world) -> events[]`, `result()`, plus `abort()`), and `race/duel.js` holds `Duel`.
- `src/race/duel.js`: Tokyo Xtreme Racer rules. Both gauges start at 1; whoever is behind loses
  gauge at a rate that grows with the gap (nothing under `GAUGE_FREE` 10 m, worst at `GAUGE_FAST`
  150 m, `DRAIN_MAX` 0.22 per second), the leader recovers `RECOVER` 0.02 per second, a wall or
  traffic hit costs the driver who caused it `HIT_DRAIN` 0.06, first gauge to 0 loses, and a gap
  past `WIN_GAP` 500 m wins at once for the leader. A 3 s countdown (`COUNTDOWN`) comes first with
  the gauge held still. The countdown beeps and the go tone are returned as events for the caller
  to play, not played here. Prize is `duelPrize`: `4000 + 6000 * rival speed factor` rounded to 500,
  nothing for a loss.
- `src/traffic/sim.js`: a `duel` flag on the agent. While set, the racer aims for
  `kind.speed[1]` instead of its cruising `factor`, and `maybeChange` only moves it to get past
  something or take a clearer line, so it never drifts back to the slow lane mid-duel. No other
  agent's behavior changes.
- `src/drive.js`: `startDuel`, `stepDuel`, `endDuel` and `duelPanel`, clearly marked. The
  challenge is refused unless the rival is ahead, within `CHALLENGE_RANGE` 60 m and on Route 1 or
  the Bayshore Line (`canChallenge`, `DUEL_ROADS`); the prompt offers it when it is allowed. Wins
  are counted per rival kind id in the save under `duelWins`.
- `src/core/input.js`: the `challenge` action on `KeyH`. The brief asked for gamepad RB, but RB
  and LB are already the manual gears, so it is on R3 (button 11) and the controls screen says so.
- `src/ui/hud.js` and `style.css`: the duel panel, two gauge bars with the rival's name, the
  countdown digits and `YOU WIN  ¥8,500` or `YOU LOSE` for 3 s. It sits at the top, so it stays
  clear of the gauges in the cockpit view like the prompt does.
- Music is untouched: it already turns intense when a racer is within 150 m.
- Tests: new `tests/race.test.mjs` (13 cases: the base shape, the countdown blocking the gauge
  with three counts and one go, the drain growing with the gap, leader recovery, hits costing
  gauge, first to zero losing, a 500 m lead winning at once either way, abort, the prize rounding
  to 500, a win paying and a loss paying nothing, and the challenge rules), plus
  `an agent in a duel aims for its top speed and ignores the slow lane` in `tests/traffic.test.mjs`.

## 0.4.22 (2026-10-03)

Remove the deprecated gauge aliases (A9 part 2).

- `src/vehicles/gauges.js`: the `WATER_MIN` and `WATER_MAX` exports are gone, along with the
  `water` field in `createGauges` and the `g.water = s.temp` line in `stepGauges`. The module now
  speaks only `temp`, `TEMP_MIN` and `TEMP_MAX`.
- `src/ui/cluster.js`: the cluster reads `gs.temp ?? 84` instead of `gs.temp ?? gs.water ?? 84`.
  The HUD cluster has read `temp` first since the rename, so no gauge changes.
- `docs/agents/ARCHITECTURE.md`: the "Open work and known issues" line about the aliases is deleted.
- Tests: `the gauges expose no deprecated water aliases` asserts the two constants are not exported
  and that neither `createGauges` nor `stepGauges` sets a `water` field.
- The `water` in `audio/env.js`, `world/surfaces.js` and the lake tests is the lake and sea amount,
  a different thing, and is untouched.

## 0.4.21 (2026-10-03)

The dev server answers range requests (A9 part 1).

- `tools/devserver.mjs`: `Range: bytes=` is honored with `206 Partial Content`, `Content-Range`,
  `Content-Length` and `Accept-Ranges: bytes` on every file, and `416` with `bytes */<size>` for a
  range that starts past the end. All three forms work (`a-b`, `a-`, `-n` for the last n bytes), a
  range that runs past the last byte is clamped, and an unparseable header falls back to the whole
  file. The no-store caching is unchanged, so a media element can now seek inside a track.
- `tools/devserver.mjs` exports `createServer` and the module only listens when it is the entry
  point, so `tests/devserver.test.mjs` can start the server on a free port instead of taking 8040.
- Tests: new `tests/devserver.test.mjs` with eight cases: `parseRange` over the three forms and a
  past-the-end range, a `206` slice of `package.json`, an open ended range, a suffix range, a `416`
  with the real length, a plain request still getting the whole file with `Accept-Ranges`, a ranged
  request for a missing file still a `404`, and ROOT being the repo.

## 0.4.20 (2026-10-03)

The recorded soundtrack: eight tracks that follow the driving.

- `assets/music/`: Jc's eight tracks, renamed to plain file names.
- `src/audio/soundtrack.js` (new, pure): the track list with mood and measured loudness, leveling
  to -16 LUFS, `nextTrack` (never the same twice running) and `MoodTracker` (menu, cruise,
  intense, mountain; up fast, down slow).
- `src/audio/music.js`: streams the tracks through media elements with 3 s crossfades, switches
  early only when the mood rises, falls back to the other track of a mood and then to the
  synthesized music when a file fails; offline rendering still uses the synth.
- `src/audio/audio.js`: `update` takes `mountain` and `rival` for the mood; `onTrack` hook.
- `src/drive.js`: works out whether the car is on the pass and how far the nearest racer is,
  three times a second. `src/main.js`: `NOW PLAYING` toast while driving.
- Tests: every file exists, the tracks level to the same loudness, rotation, and the mood rules.

## 0.4.19 (2026-10-03)

Ramps become slip roads, the Bayshore Line joins Route 1, and the street grid fills the city.
The street racer speed test averages four seeds.

- `src/world/merge.js` (new, pure): `slipRamp` builds the part of an exit or entry that runs
  beside its carriageway (a sliver widening over 60 m, a 90 m parallel lane, a 140 m diverge to
  24 m), `slipMeta` measures the finished ramp (shared stretch, nose, gore), `biarc` draws two-arc
  connectors with no bunched-up curvature, `inStretch` handles stretches across a closed road's seam.
- `src/world/roadgen.js`: `diamond` builds its four ramps from `slipRamp`; the old gore metadata is
  replaced by `slip` and a width `taper`.
- `src/world/roads.js`: a slip road takes its carriageway's height along the shared stretch and the
  gore. `query` and `influence` use the true distance past the end of an open road.
- `src/world/build-roads.js`: no skirts on either side of a shared edge, gores from `slip`, a thick
  dashed line over the seam of every added lane, city crossings from `GRID`.
- `src/world/highway.js`: the carriageway rail opens from the taper to 30 m past the gore, every
  slip road has a rail on its outer edge (not on decks), toll plazas take their lane count from the road.
- `src/world/layout.js`: the Bayshore Line is 2 lanes each way along the bay (x -850 to 800) and four
  junction ramps join it to Route 1 at the south corners, two of them flying over the loop; the street
  grid grows to 9 by 19 (`GRID`), West Ave and East Ave meet its middle street at the edges, the 16
  suburb stubs are gone; MINATO TOLL moves to x -700, the Bayshore toll to x 450, station G2 to z 450.
- `src/traffic/net.js`: no exit is offered at the very end of an expressway that a ramp continues.
- Tests: slip roads start as a sliver and share the carriageway's edge (within 12 cm) and height
  (within 2 cm) for over 120 m; the Bayshore joins Route 1 both ways at the same width and height,
  and traffic can drive Route 1 to the Bayshore and back; rails under a bridge do not count as on
  the ramp above.
- `tests/traffic.test.mjs`: the racer speed check averages seeds 77, 1, 2 and 3 instead of one seed; a
  single 3-minute run lands anywhere from 170 to 207 km/h, so one seed failed on any network change.

## 0.4.18 (2026-10-03)

Cockpit prompt out of the way, racer speed check restored (A8 part 5, written by Hermes, committed
by Claude after Hermes stopped).

- `src/ui/hud.js`, `style.css`, `src/drive.js`: `hud.prompt(text, cockpit)` toggles a `cockpit`
  class that moves the prompt from the bottom to 12 vh from the top, clear of the modeled gauges.
- `tests/traffic.test.mjs`: every racer kind must want more than 1.4 times the limit again (it had
  been loosened to 1.0).

## 0.4.17 (2026-10-03)

Civilians stop flip-flopping between lanes (Antigravity's A8 part 4).

- `src/traffic/sim.js`: a civilian that finishes a lane change sets `laneHold` to 8 s
  (`LANE_HOLD`) and will not move again until it passes, unless it has to: a planned exit or
  turn inside 250 m or something stopped ahead within 38 m outrank the hold. Racers set
  `laneHold` to 0 and keep weaving. Moving back to the slow lane now goes through the new
  `slowLaneClear`, which needs 120 m clear ahead in it (`SLOW_LANE_GAP`) and nothing faster
  closing within 60 m behind.
- Measured with the brief's setup (seed 21, 3 minutes on Route 1, player at 108 km/h): civilian
  lane changes 591 with 303 reversed within 6 s (51.3 %) before, 121 with 4 reversed (3.3 %)
  after. Racer mean speed in the 3 minute headless test is 192.0 km/h (top 279.7), unchanged,
  and the existing yield test still passes.
- The yield thresholds (within 45 m behind, closing by more than 3 m/s) are deliberately
  unchanged. Tightening them to the brief's 40 m and 8 m/s was measured and it drops racer
  mean speed to 172 km/h, under the 190 km/h target, because every extra civilian lane change
  is another car manoeuvring in front of a racer. The 8 s hold is what removes the dithering.
- Tests: `fewer than one civilian lane change in ten is reversed within 6 s` (the brief's
  setup, requires more than 100 changes to judge and under 10 % reversed).
- Also in this commit: `package-lock.json` was still at 0.4.13, so its two version fields now
  match `package.json`; and `gearRpm` in `src/vehicles/physics.js` no longer takes an unused
  `s` and its doc comment says it returns engine rpm rather than road speed.

## 0.4.16 (2026-10-03)

A downshift at crawling speed drops to the gear that fits (Antigravity's A8 part 3).

- `src/vehicles/physics.js`: a manual downshift in a forward gear above 1st now goes to `downGear`,
  the highest gear below the current one that would still turn the engine at least 1.2 times idle
  (`CRAWL_RPM_FACTOR`) at the current road speed, and to 1st when no gear does. A car sitting in 5th
  at walking pace after a crash drops straight to 1st on one tap instead of three, and at 100 km/h a
  tap still gives 4th. It never picks a gear that over-revs, so the money shift above it still blows
  the engine. 1st, R and N are fixed rungs.
- Tests: `a downshift at crawling speed drops straight to the gear that fits` (5th at 2 m/s gives 1
  with no damage, 5th at 28 m/s gives 4) and `a crawl downshift picks the gear the engine can
  actually pull` (every car from its top gear at walking pace lands in 1 and pulls without blowing
  or passing the redline). The money shift test is unchanged and still passes.

## 0.4.15 (2026-10-03)

Manual gear order runs N, R, 1 to the top gear (Antigravity's A8 part 2).

- `src/vehicles/physics.js`: new `stepGear` returns the next rung along N, R, 1 ... n for a
  manual shift, so shifting down from 1 lands in R and R is the last rung below neutral, and
  shifting up from N goes to R and from R to 1. Gear values are unchanged (-1 for R, 0 for N),
  only the order moved. The money-shift rule into R is unchanged, so a careless double tap down
  from 1 at speed still blows the engine. Auto mode is untouched.
- `src/ui/menus.js`: the settings notice and the pause key list now read (N, R, 1..7).
- Tests: `the manual selector runs N, R, 1 to the top gear for every car, at any speed` and the
  new `the manual selector steps N, R, 1 with a single tap, in both directions` (all four cars,
  single taps in both directions, N as the bottom stop). Tests that walked to R or N by tapping
  were adjusted for the new order.

## 0.4.14 (2026-10-03)

Neutral hits the rev limiter (Antigravity's A8 part 1).

- `src/vehicles/physics.js`: `freeRev` takes the throttle away while a limiter cut is running, so
  full throttle in N bounces on the redline like it does in gear. Peak rpm in neutral over 4 s fell
  from 13,684 to 7,840 (Hayate), 11,397 to 6,377 (Rampart), 16,463 to 8,634 (Vespera) and 13,938 to
  7,710 (Tsurugi); the limiter now fires about 30 times in those 4 s instead of once, and neutral can
  never reach the 11,000 rpm blow rpm on its own.
- Tests: `neutral bounces on the limiter without driving the car or blowing` replaces the old weak
  check and asserts, for all four cars, that rpm stays under redline + 150, the limiter cuts at least
  4 times, the car does not move, and the engine still falls back to idle when the throttle is lifted.

## 0.4.13 (2026-10-03)

Bayshore Line, a larger city rect with suburbs, and rails on steep drops (Antigravity's A7 part 6,
committed by Claude from its handoff, `docs/agents/tasks/HANDOFF-A7-part6.md`).

- `src/world/layout.js`: Route 2, the Bayshore Line (`c2-f`, `c2-r`, 4.6 km, 3 lanes each way,
  100 km/h) along the bay with a 7.4 m lift over Harbor Ave; `toll-bayshore`; `CITY` grows to
  x -1280 to 1280, z 520 to 2020; 16 suburb streets (`k-sub-*`, 40 km/h).
- `src/world/highway.js`: median barrier and side rails on both expressways, plazas found by
  `toll.road`, guard rails on drops and slopes over 1.5 m outside town (not on decks with parapets).
- `src/world/scatter.js`: lower, wider-spaced blocks in the suburban band, towers only in the core.
- `src/traffic/sim.js`: `populate` tries `target * 8` spawns to fill the larger network.
- Tests: four plazas across both carriageways; the Bayshore Line is 4 to 6 km and dual.
- Known gaps: the Bayshore Line has no ramps and cannot be reached; the suburb streets are stubs
  and the street grid itself is unchanged.

## 0.4.12 (2026-10-03)

Road joins and city grid: gore tapers, crossing patches, and corner curbs.

- `src/world/roadgen.js`: diamond interchange ramp departure and arrival tangents align strictly
  with the normal vector of the arterial tangent, and the ramp inner edge aligns flush with the
  carriageway outer edge at the gore split. Ramp definitions include gore metadata.
- `src/world/roads.js`: `Road.hwAt(s)` supports width tapers between arterials and street grids;
  `blendJunctions` links ramp heights with carriageways and arterials while preventing main roads
  from warping to ramps; `RoadNetwork.query` prioritizes paved roadway surface over unpaved skirts.
- `src/world/build-roads.js`: painted chevron gores fill triangles between Route 1 outer edge and
  ramp inner edge; city intersections receive seamless asphalt crossing patches and concrete corner
  curbs with rounded sidewalk corner fans; ribbon skirts suppress in gores and crossings.
- `src/world/highway.js`: guard rail verges open cleanly along the ramp throat from taper to gore nose.
- `src/world/layout.js`: Route 18, Harbor Ave, West Ave, and East Ave taper width between 7.0 m and
  4.6 m to join city streets flush; station g1 moved to [0, 1940] to keep clear of the harbor ramp gore.
- Tests: `tests/layout.test.mjs` verifies 0 lips and grade breaks at joins, and flush gore heights;
  `tools/mapcheck.mjs` confirms 0 unexplained crossings and max grade break under 2%.

## 0.4.11 (2026-10-03)

- Gauge faces lose their numerals and labels: ticks, the red zone and the needle only, since
  numbers cannot be read at 240 lines. Major ticks every 1,000 rpm and 40 km/h.

## 0.4.10 (2026-10-03)

Fast street racers and aggressive highway weaving.

- `src/traffic/sim.js`: street racers use racing lateral grip of 0.9 g (~8.83 m/s^2) for curve speeds,
  accelerate with double nominal acceleration when far below wanted cruising speed, and use a shorter
  IDM time headway of 0.6 s with a tighter 1.0 m minimum gap.
- `src/traffic/sim.js`: when blocked within 140 m, racers weave into any open neighboring lane (including
  the slow lane) in a 1.5 s diagonal move, with reduced safety margins for tight gaps, and move back to
  faster lanes once clear ahead.
- `src/traffic/sim.js`: rivals spawn exclusively on Route 1 fast lanes, 250 to 460 m from the player,
  balanced half ahead and half behind so vehicles pass the player, initialized at full cruising speed.
- Tests: `tests/traffic.test.mjs` verifies that over 3 minutes headless with traffic, racers maintain a
  mean speed above 190 km/h and top speed above 240 km/h.

## 0.4.9 (2026-10-03)

Real dashboards.

- `vehicles/cockpit.js` (new): the cockpit moves out of `models.js` and gets modeled instruments
  per car: hooded pods facing the driver, gauges with depth cans, chrome bezels, canvas faces and
  turning needles, a gear readout, a shift lamp and a warning lamp. The painted 2D cluster on the
  dash is gone (`drive.js` calls `cockpit.update`).
- `vehicles/dash.js` (new, pure): `DASHES` (Hayate with a boost pod, Rampart with two gauges only,
  Vespera without boost or exhaust, Tsurugi with a three-gauge center stack), `gaugeScale`,
  `needleAngle`.
- Steering wheel lowered and the cockpit camera tilted down so the cluster shows over the rim.
- Tests: `dash.test.mjs` (every car has its dash, the differences, no overlaps, tach range,
  needle sweep).

## 0.4.8 (2026-10-03)

Diagonal lane changes and civilian yielding.

- `src/traffic/sim.js`: lane changes replace exponential strafe decay with a smoothstep lateral
  move over duration scaled by road speed (2.5 s at 60 km/h to 4 s at 200 km/h). Yaw follows the
  actual motion vector (lane tangent plus lateral rate) so the nose steers into the new lane during
  the crossing and straightens upon completion.
- `src/traffic/sim.js`: comprehensive gap checks ahead and behind in the target lane prevent cutting
  off faster traffic; lane changes are blocked within 40 m of traffic lights, planned exits, or a
  player alongside.
- `src/traffic/sim.js`: civilians change lanes to pass slower traffic, yield to faster vehicles
  (racers or the player) closing from behind when the left lane is free, and position for planned exits.
- Tests: `tests/traffic.test.mjs` verifies lane change heading difference stays between 1 and 12 degrees
  with lateral speed under 3 m/s, and that a civilian yields to a faster car closing from behind within 3 s.

## 0.4.7 (2026-10-03)

The traffic is real vehicles too.

- `vehicles/bodies/civilians.js` (new, pure): sedan, hatchback, kei car, wagon, taxi with its roof
  sign, SUV, minivan, panel van, pickup with its bed, kei truck, box truck, tanker, city bus and
  semi, each lofted from a profile; trucks are a cab plus cargo with extra axles.
- `profile.js`: `bodyModel` builds a model from dimensions, a profile and details.
- `models.js`: a body can carry extra `axles` and a fixed `accent` color; `loft.js` only cuts
  arches that fall inside the body.

## 0.4.6 (2026-10-03)

Street racers drive real cars.

- `vehicles/bodies/profile.js` (new, pure): a body from a profile (nose, hood, deck and tail
  heights, cabin positions, roof, tapers) plus detail helpers.
- `vehicles/bodies/racers.js` (new, pure): twelve racer cars with their own shapes and details.
- `kinds.js`: `RIVALS` is the twelve racers plus the four player cars, sixteen kinds, each with a
  `model`; speeds raised to 1.8 to 2.7 times the limit.
- `models.js`: `vehicleGeometry` bakes a lofted car with wheels into one instancing geometry.
  `psx.js`: a `paint` option so the instance color only tints the paint. The traffic material is
  Phong now.
- `tools/bodies.html`: catalog of every racer and traffic kind.

## 0.4.5 (2026-10-03)

Blown engine idle: rough idle at 1,000 to 2,000 rpm in gear or neutral.

- `src/vehicles/thermal.js`: `LIMP_RPM` reduced from 3,500 to 2,000.
- `src/vehicles/physics.js`: when `s.blown`, engine rpm uses `freeRev` targeting a rough idle
  between 1,100 and 1,850 rpm (derived deterministically from vehicle state, not `Math.random`)
  and clamped to `LIMP_RPM` (2,000 rpm) in all gears. The wheels no longer drive the engine,
  slipping the clutch while limp torque (`LIMP_TORQUE`) continues to push the car. Shifting
  between gear 2, N and 1 keeps the same idle range without jumping.
- Tests: `tests/physics.test.mjs` verifies that after blowing the engine at 120 km/h in 2nd,
  rpm stays between 900 and 2,000 rpm for 5 s across gear 2, N and 1 while the car continues
  moving forward in gear.

## 0.4.4 (2026-10-03)

Rounder cars: the modeler upgrade.

- `vehicles/loft.js` (new, pure): monotone cubic station curves, wheel arches with 13 rings
  per axle, the 19-point ring with a crowned roof and Catmull-Rom side curves, the end bevel.
- `models.js`: `Kit` lofts from it (rings at most 26 cm apart), bevels the nose and tail, and
  `top` follows the crown (`roofY`). Bodies go from about 600 to about 1,900 triangles.
- `builder.js`: `smoothNormals` (crease-limited, area-weighted) and `buildWheel` (16 sides,
  tread shoulders, sidewall, rim lip, dished textured face).
- Tests: `loft.test.mjs` (no overshoot, ring symmetry and bands, ring spacing, arches, bevel).

## 0.4.3 (2026-10-03)

Tachometer scale fix: the tach never shows the blow rpm.

- `src/ui/cluster.js`: `maxRpmOf(spec)` is the redline plus 1,000, rounded up to the next
  1,000 (Hayate 9,000, Rampart 8,000, Vespera 10,000, Tsurugi 9,000).
- The blow rpm (`engine.blowRpm`, 11,000) stays in the logic but is never drawn on the dial.
- Replaced the two-part red and danger band with a single red band running from redline to
  the end of the scale, flashing on limiter or over-rev.
- The needle pins at the end stop (`TACH_END`) when rpm exceeds the scale, never wrapping.
- Tests: `tests/cluster.test.mjs` verifies scale bounds for all cars, absence of blow rpm
  numerals, and end-stop needle pinning.

## 0.4.2 (2026-10-03)

The fourth car.

- `specs.js`: TSURUGI GT-X, a 3.0 L twin-turbo straight-six grand tourer, rear-wheel drive,
  seven gears, bars 10 / 7 / 8. Bench: 0-100 4.37 s, quarter mile 11.78 s, 323 km/h, 34.2 m
  from 100, 1.43 g tarmac and 0.69 g gravel.
- `engine-dsp.js`: the `i6` voice (six even firings, turbo whistle, a little whine); the engine
  tests cover it for evenness, the whistle and damage.
- `models.js`: a provisional fastback body (`BODIES.tsurugi`), right-hand drive, four tailpipes
  (`TIPS` in `exhaust-fx.js`). It will be rebuilt with the new modeler.
- `tools/models.html` shows any number of cars.

## 0.4.1 (2026-10-03)

Street racers.

- `traffic/kinds.js`: ten racer kinds (`RIVALS`, ids `rv-*`) that want 1.5 to 2.6 times the
  limit; `ALL_KINDS` is what the renderer draws. `bodies.js` draws them as low, wide stand-ins
  with a wing and big wheels.
- `traffic/sim.js`: `spawnRival` (fast lanes of Route 1 only, out of sight), `countRivals`,
  `nearestRival`, a `rivals` option (default 5) kept apart from the traffic target. Racers stay on
  the loop, change lanes earlier and pick the most open neighbouring lane (`openAhead`).
- `Drive` shows the nearest rival within 220 m as a prompt.
- Tests: 102 passing (racers cruise far above the limit, stay on Route 1 and are replaced;
  nearest rival distance and side).

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
