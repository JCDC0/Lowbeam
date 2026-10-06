# A3: vehicle bodies, batch 1 (assets only)

Start after A1 is merged. New files only: `src/vehicles/bodies/*.js`, a catalog page
`tools/bodies.html` (copy `tools/models.html`), and a pure test for the data.

The new world has traffic and 10 racing rivals. Each vehicle needs a body that the
existing loft modeler can build. Read `BODIES` and `Kit` in `src/vehicles/models.js`
first (stations, glass ranges, `parts(kit)`). Do not change `models.js` except to add a
registry line that merges the new files into `BODIES` (one exact-string edit).

## Batch 1 (eight bodies)

Rivals (4): kei sports car (tiny, mid or rear engine), rotary coupe (low, pop-up
look), hot hatch (short, tall roof), boxer rally sedan (a different one than the Hayate:
big wing, hood scoop, mudflaps).

Civilians (4): compact sedan, kei box car (tall and narrow), station wagon, taxi (the
sedan with a roof sign).

## Format

Same data shape as `BODIES` plus these fields:

- `id`, `name`, `length`, `width`, `height`, `wheelRadius`, `wheelbase`
- `exhaust: [[x, y, z]]` tip positions in body space (used for flames and smoke)
- `lights: { head: [[x, y, z]], tail: [[x, y, z]] }` for the traffic renderer
- `tier: 'rival' | 'traffic'`

## Budgets

- Traffic bodies: at most 700 triangles including wheels, wheels may be 8 sided.
- Rival bodies: at most 1800 triangles, 12 sided tires.
- Dimensions realistic (kei car about 3.4 by 1.48 m, sedan about 4.5 by 1.75 m).
- Colors come from the paint system: use the `paint`, `accent`, `glass`, `trim`, `tail`,
  `lamp`, `tire`, `rim` material keys. No new material keys without asking.

## Done when

`tools/bodies.html` shows all eight in a grid under the same lighting as the garage, with
orbit and `shot('bodies-1')`; a pure test checks every body builds, stays under budget
and has exhaust and light anchors. Docs and changelog updated. Wait for review before A4.
