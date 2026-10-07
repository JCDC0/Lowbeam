# G4: Greenery for the city (Assets)

After G3. Small props the scatter will place by the hundred along Kurogane's avenues, in the medians,
at building fronts and in pocket parks (Claude does the placing, C1 part 5). They are drawn
instanced, so keep them cheap. Same workflow as G1: read `G1-pursuit-props.md` first.

| Name (file) | What | Size (w x h x d) | Triangles | Colliders |
|---|---|---|---|---|
| `street_tree` | A Japanese street tree (zelkova or ginkgo): a slim trunk, a clustered crown, standing in a square iron grate set in the pavement | 3.0 x 7.0 x 3.0 | 300 at most | one small box round the trunk, y1 2 |
| `planter_box` | A concrete planter with a clipped hedge in it, the kind in front of offices | 2.0 x 0.9 x 0.7 | 120 at most | one box over the whole planter |
| `hedge_row` | A clipped hedge, 4 m long, for medians and lot edges | 4.0 x 1.0 x 0.8 | 100 at most | one box |
| `shrub` | A rounded shrub (azalea), for corners and parks | 1.2 x 0.9 x 1.2 | 80 at most | none |
| `park_bench` | A wooden slat bench on concrete legs | 1.8 x 0.8 x 0.6 | 120 at most | one box |

Every model: the origin on the ground at its center, the front faces +z, nothing below y = 0. Foliage
in two or three greens that read at night under sodium lamps (about 0x2f5a2a, 0x3d6e30, 0x24461f),
bark 0x4a3a2c, concrete through `tex: 'concrete'`, iron 0x2a2c2e. No emissive materials.

Check all five at once:
`http://localhost:8040/tools/props.html?models=street_tree,planter_box,hedge_row,shrub,park_bench`,
`__props.check()` clean, shots of each solo from road height and from above and all five with the
car. One commit for the set, then stop and report.
