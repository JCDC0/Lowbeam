# A5: building kit, facades and street furniture (assets only)

Start after Claude's new map layout lands (0.3.x, `tools/mapview.html` exists). New files
only: `src/world/build-buildings.js`, `src/world/facades.js` (pure parameters),
additions at the end of `src/render/textures.js`, a viewer `tools/buildings.html` (copy
`tools/trees.html`). Claude integrates it into `scatter.js` and `world.js`.

The current buildings are boxes with a window texture (`windowTextures` in textures.js,
`buildTown` in `src/world/props.js`). The goal is the Night-Runners-Prologue look:
varied, believable Japanese city blocks at a triangle budget.

## Buildings

- Six facade styles from one atlas (canvas drawn, 128 by 128 tiles): apartment with
  balconies and AC units, glass office, shopfront with a sign band, brick, concrete
  mid-rise, tower with a crown. Lit and dark windows at random.
- Heights from 12 m to 140 m. Setbacks on tall ones, a podium plus shaft, roof clutter
  (AC boxes, water tanks, antennas, a blinking red aviation light on towers above 60 m).
- Awnings, shutters, signs, neon strips. Entrance steps and sidewalk curbs.
- Budget: 40 to 120 triangles per building, 20 distinct footprints. Parameters in a pure
  `facades.js` so tests can check sizes. Buildings expose a footprint box
  `{ cx, cz, hw, hd, yaw }` for collision.

## Street furniture

Traffic lights with a signal head over the lane, crosswalk stripes, utility poles with
wires between them, vending machines with an emissive front, bus stops, bollards, guard
rails (a segment kit, 4 m long, repeatable), jersey barriers, retaining wall segments,
highway signs (green gantry boards with white text).

## Done when

`tools/buildings.html` shows each style and the furniture; `shot('buildings')`; test checks
budgets and footprints; docs and changelog updated.
