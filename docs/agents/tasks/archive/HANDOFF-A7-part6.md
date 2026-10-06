# Handoff: A7 Part 6

## 1. Uncommitted Changes by File
- `src/world/layout.js`: Expanded `CITY` bounds to [-1280, 1280] x [520, 2020]; added Route 2 Bayshore Line (`c2-f`, `c2-r`, 4.60 km dual carriageway); added suburban ring `SUBURBS` (`k-sub-*`) in four quadrants; added `toll-bayshore` to `TOLLS`.
- `src/world/highway.js`: Placed median barrier and side rails on both Route 1 and Route 2; mapped toll plazas dynamically by `toll.road`; added rural and mountain guard rails where slope or drop exceeds 1.5 m outside town, skipping bridge decks with parapets.
- `src/world/scatter.js`: Tuned building scatter for core versus suburbs (`core === 0` has wider spacing 22 to 32 m, lower blocks 4.5 to 18 m, no tall towers; core has dense high-rises).
- `src/traffic/sim.js`: Raised `populate` spawn attempts from `target * 3` to `target * 8` to handle the larger network; removed stray double blank line.
- `tests/layout.test.mjs`: Updated toll assertion for 4 plazas across both carriageways of their expressways; added test asserting Bayshore Line length (4 to 6 km), dual carriageway, and toll plaza.

## 2. Part 6 Status
- Finished:
  - Bayshore Line carriageways (`c2-f`, `c2-r`) along bay ($z \approx 2415 \dots 2450$, 4.60 km).
  - Bayshore toll plaza (`toll-bayshore` at $x=800, z=2422$) with canopy, lights, and dividers.
  - Expanded `CITY` footprint (50% wider and deeper) and suburban street ring (`k-sub-*`).
  - Core high-rise density versus low suburban blocks.
  - Rural and mountain guard rails on steep drops and slopes (> 1.5 m).
  - Load time (3.02 s < 4 s) and city draw calls (118 < 160).
  - Top-down map captured to `tools/shots/map-after-bayshore.png`.
- Half done: None.
- Not started: Bayshore ramps (held per user instruction for Claude's merge component); version bump, changelog, architecture update, and git commit.

## 3. Broken Items and Test Status
- All 121 tests pass (`npm test`).
- Type check is clean (`npm run check`).
- `tools/mapcheck.mjs` reports 0 unexplained crossings, 0.0 cm lip, 1.5% max grade break.
- No tests are expected to fail.

## 4. Key Decisions and Rationale
- Coordinates: Bayshore runs between $x \in [-2300, 2300]$ at $z \approx 2415 \dots 2450$, along the scenic coastline north of the sea boundary ($z = 2470$).
- Overpass lift at $x \approx 26.4, z = 2420$: Harbor Ave terminates at harbor docks at $z = 2440$. Lifting Route 2 by 7.4 m creates an elevated coastal viaduct with piers allowing Harbor Ave traffic to pass freely beneath with 0 flat crossing conflicts.
- Speed limits: 100 km/h on Route 2 matching Route 1 expressway standards; 40 km/h on suburban streets.
- Suburb layout: 16 connected streets using `k-sub-*` prefix in the 4 quadrants between core grid and Route 1, avoiding flat crossings with arterials while integrating into the traffic network.
