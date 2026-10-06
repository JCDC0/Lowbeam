# C1: Kurogane Island, the map overhaul (Claude)

Owner: Claude. This is the plan other agents read so they know what is moving under them. Do not
edit the files listed under "Claude's files" while C1 is open; ask in your report instead.

## Why

Playtest verdict (Jc, 2026-10-04): the highways are good, but the rest reads as "driving to land
accidentally": open grass between the city and Route 1, a flat predictable street grid, a pass that
ends in a sharp hook beside Kami-ike, ramps that still do not merge cleanly in places, toll plazas
that look nothing like the real ones (`concepts/` holds two references: Shuto Oi and an ETC plaza),
lamps that give an arbitrary smooth glow, traffic with no lights. The target is the illegal street
racing look of Night-Runners Prologue, Wangan Midnight and Tokyo Xtreme Racer.

## What changes

1. **Island.** Kurogane becomes an island: sea all round an irregular coast (the bay in the south
   stays as the harbor), cliffs under the western mountains. The forest edge belt goes; the sea is
   the boundary, and driving into it resets the car like the lake does. `mapData.water.coast` is
   the coast polygon.
2. **Built up, not grass.** Dense buildings along every road in the urban zones: residential
   blocks between the city and Route 1, an industrial and warehouse district on the east coast,
   a container port along the bay, a village in the forest valley. Farmland only on the north
   slopes. Buildings come from a kit modeled in Blender (exported GLB in `assets/models/`) plus the
   procedural blocks, merged per chunk and culled like the trees.
3. **A real city street network.** The grid goes. Districts with their own street angle, spacing
   and bends, a few curved through streets, T junctions, dead ends and alleys, and every street
   reaching somewhere. `src/world/junctions.js` (pure) finds crossings and T junctions from the
   road geometry; road surfaces, curbs, lights and traffic all read it. `GRID` is removed.
4. **Elevated expressway.** Route 1 rises onto a Shuto style viaduct (about 10 to 14 m, piers,
   parapets, sound walls) where it runs through town; the avenues pass under it there. More
   height variation on the open sections. The Bayshore Line runs on a viaduct along the water.
5. **Roads fixed.** The pass no longer ends in a hook: Route 18 meets it at a T junction in the
   forest village, and the road continues east along the north coast to the north-east cape and
   down the east coast to East Ave, so nothing dead-ends. Every ramp is rechecked for merges.
6. **New buildings (models only, no logic yet).** Kurogane police headquarters on the north-east
   cape (main block, motor pool, cruiser garage, helipad on the roof), player garages and tuning
   shops, old warehouses with open doors and covered lots that will be hiding spots, and the toll
   plazas rebuilt from the references (canopy fascia with lane signs, ETC purple and general
   green, red and white chevrons, booths on striped islands, lane signals, blue ETC lane paint).
   Positions are data in layout.js (`POLICE_HQ`, `GARAGES`, `HIDEOUTS`) so the police, helicopter
   and garage logic can come later.
7. **Light.** Street lamps get two arms (lighting both directions) and their light becomes real
   pools on the road computed per pixel (a clustered light grid read in the PSX shader), with the
   PSX banding, instead of a vertex glow. Traffic cars get headlights, tail and brake lights, and
   light pools of their own.
8. **Music and view (done in 0.5.0).** The music follows the speed like Night-Runners, render
   height defaults to 480 lines, the car and cockpit cameras look out over the car.

Order: 0.5.0 music and view, then junctions.js and lamps and light pools, then the island terrain
and road layout, then the city network and buildings, then the special buildings and toll plazas,
then traffic lights. Each step is its own commit with tests and screenshots.

## Claude's files during C1

`src/world/*` (all of it), `src/render/*`, `src/traffic/render.js`, `src/traffic/bodies.js`,
`src/audio/*`, `assets/models/`, `tools/mapview.html`, `tools/mapcheck.mjs`, `tests/layout.test.mjs`,
`tests/toll.test.mjs`, `tests/forest.test.mjs`.

Other agents: `src/traffic/net.js` is Antigravity's for A10, `src/traffic/sim.js` and `src/race/`
are Hermes's. Everything that reads the world should read it through `ground`, `roads`, `mapData`
and the exported layout data, never through the old `GRID`, `CITY` or `TOWN` names.
