# G6: The civilian traffic, remade and widened (Assets)

After the racers (G5). Kurogane's traffic is fourteen kinds lofted in code
(`src/traffic/kinds.js`, `src/vehicles/bodies/civilians.js`). This brief remakes them in Blender and
adds new designs so the city looks like a Japanese city at night. Same workflow as G2 and G3, at a
traffic budget: they are drawn many at a time.

## Rules for every civilian

- Origin on the ground at the middle of the length, the front faces +z, the LEFT is +x.
- Materials as G2 (`paint` is the body color, repainted by the game per car; `accent` the second
  color where a kind has one), no `tex`.
- Body at most 1,200 triangles for cars and vans, 1,600 for trucks and buses; `wheel-*` objects for
  the viewer only (the game builds wheels from the kind's numbers).
- Shots and bounds as G2; one commit per two or three models; stop for review after the first.

## The fourteen in the game today (dimensions from `kinds.js`, length x width x height)

| Id (file) | What | Size |
|---|---|---|
| `sedan` (`civ_sedan`) | A plain four-door family sedan | 4.55 x 1.78 x 1.42 |
| `hatch` (`civ_hatch`) | A five-door compact hatch | 3.95 x 1.70 x 1.45 |
| `kei` (`civ_kei`) | A tall boxy kei car | 3.40 x 1.48 x 1.62 |
| `wagon` (`civ_wagon`) | An estate wagon | 4.70 x 1.78 x 1.50 |
| `taxi` (`civ_taxi`) | A Tokyo taxi: a tall upright sedan, roof sign (`lamp`), two-tone | 4.60 x 1.78 x 1.50 |
| `suv` (`civ_suv`) | A mid-size SUV | 4.70 x 1.90 x 1.75 |
| `minivan` (`civ_minivan`) | A sliding-door minivan | 4.80 x 1.80 x 1.78 |
| `van` (`civ_van`) | A panel van (HiAce mould), windowless rear | 4.90 x 1.85 x 2.00 |
| `pickup` (`civ_pickup`) | A pickup | 5.20 x 1.90 x 1.80 |
| `keitruck` (`civ_keitruck`) | A kei truck with a flat bed and drop sides | 3.40 x 1.48 x 1.80 |
| `truck` (`civ_truck`) | A 4 t box truck | 7.20 x 2.30 x 3.20 |
| `tanker` (`civ_tanker`) | A tanker truck | 9.00 x 2.40 x 3.00 |
| `bus` (`civ_bus`) | A city bus | 10.50 x 2.50 x 3.10 |
| `semi` (`civ_semi`) | A semi: the cab and the trailer as two objects named `cab` and `trailer` | 16.0 x 2.50 x 3.60 |

## New designs (Claude adds the kinds when they pass)

| File | What | Size |
|---|---|---|
| `civ_kei_van` | A tall kei box van (N-Box mould), sliding doors | 3.40 x 1.48 x 1.80 |
| `civ_luxury` | A big black executive sedan (Century mould), chrome grille | 5.30 x 1.93 x 1.50 |
| `civ_coupe` | An ordinary two-door coupe, not a racer | 4.40 x 1.75 x 1.35 |
| `civ_compact_suv` | A small crossover | 4.30 x 1.80 x 1.60 |
| `civ_delivery` | A walk-in delivery van with a tall box (Japan Post or Yamato mould, invented livery in `accent`) | 4.70 x 1.70 x 2.30 |
| `civ_garbage` | A garbage truck with a rear packer | 6.50 x 2.20 x 2.80 |
| `civ_ambulance` | An ambulance, white with a red stripe (`accent`), roof lamps (`lens-l`, `lens-r`) | 5.60 x 1.90 x 2.50 |

Ambulances and their lamps are for the traffic only; they do not join the police.

## Sizes are collision sizes (added 2026-10-09)

Jc saw cars clipping into things at the side of the road. The civilians collide as the size their kind
says (`bodyOf` in `vehicles/contact.js` takes `length` and `width` from `kinds.js`), so a model must fill
that size and not stick out of it: the widest point of the body, mirrors included, within `width`, and
the nose and tail within `length`. Quote the plan-view width along the body and the bounds from the
JSON as G5 did, and Claude extends `tests/kind-models.test.mjs` to the civilians as each one lands. See
`B4-civilian-world-collisions.md` for what the backend does about corners, poles and edges.
