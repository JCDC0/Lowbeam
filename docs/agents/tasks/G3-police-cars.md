# G3: The four police cars (Assets)

Starts once Claude passes the Mazuma (G2). Same workflow, same checks, same honesty as G2: read
`G2-racer-car-trial.md` (the brief and both reviews) and `G1-pursuit-props.md` first. Versions: the
next numbers in 0.9.50 to 0.9.69, one commit per car.

The police drive borrowed civilian bodies today. These four replace them; Claude fits them into the
traffic renderer and drives their light bars (red and blue, flashing) from the game.

## The cars

| Name (file) | Kind id | What | Length x width x height | Wheel radius |
|---|---|---|---|---|
| `police_cruiser` | `police` | The Japanese patrol car: a big four-door sedan in the Crown mould, white upper body and roof, black lower body and doors (`paint` white 0xf4f4f2, `accent` black 0x14161c), a low roof bar | 4.70 x 1.80 x 1.45 | 0.32 |
| `police_unmarked` | `police-fast` | An unmarked fast unit: a sporty four-door sedan in dark paint (`paint` 0x14161c), no bar on the roof, two small lamps behind the grille (`lens-l`, `lens-r`) | 4.50 x 1.85 x 1.34 | 0.32 |
| `police_rhino` | `police-heavy` | The Rhino: a heavy, boxy SUV in the cruiser's two-tone with a steel push bar on the nose (`chrome` or `trim`) and a bar on the roof | 4.90 x 2.00 x 1.90 | 0.38 |
| `police_interceptor` | `police-int` | A mid-engine supercar in the cruiser's two-tone, a slim bar on the roof | 4.60 x 2.00 x 1.24 | 0.33 |

Every car: the origin on the ground at the middle of its length, the front faces +z, its LEFT is +x
(the game's convention for cars). The heights include the roof bar. The axles sit about 0.3 of the
length from each end (about 0.6 of the length between them), the wheels centered at x = +-(width / 2
- 0.14).

## Materials

The G2 names (`paint`, `accent`, `glass`, `trim`, `under`, `chrome`, `lamp`, `tail`, `plate`, and
`tire` and `rim` for the viewer only), plus the light bar's two lenses: `lens-l` (red, 0xff2a2a, the
car's left, x > 0) and `lens-r` (blue, 0x2a5aff, x < 0), both emissive. The bar is part of each model.
No `tex` on any material.

## What each needs

- One smooth body to the standard the Mazuma is held to: a car shape seen from above (tapered nose
  and tail), real wheel arches with dark wells, glass as its own faces set into the body, mirrors,
  head and tail lamps, plates, the bar on the roof (or the grille lamps on the unmarked car).
- Body (everything but the wheels) at most 1,800 triangles: the police are drawn many at a time.
- Four wheels named `wheel-fl`, `wheel-fr`, `wheel-rl`, `wheel-rr` for the viewer only.
- Script `tools/blender/<name>.py`; exports `<name>` (body, `only=lambda n: not n.startswith('wheel')`)
  and `<name>_full`.

## Check and report

`http://localhost:8040/tools/props.html?models=police_cruiser_full,police_cruiser&smooth=38&budget=2600`
for each: `__props.check()` clean, the body under 1,800, shots at about 6 m (side, front three
quarter, rear three quarter, top), and the bounds and the plan-view widths at nose, doors and tail
quoted from the JSON. Commit each car on its own; stop after the cruiser for Claude's review, then
do the other three.

## Review of 0.9.54, the cruiser (Claude): passed

A Crown-sized sedan (4.70 x 1.23 body, 1.45 m to the top of the bar) in the two-tone livery, 1,630
body triangles, check() clean against the brief's budget. The lenses are right: `lens-l` red on the
car's left (+x), `lens-r` blue on its right, which is what `police/lights.js` flashes. Two notes to
carry into the other three, no fix round:

1. **The bar reads thin.** From the chase camera it is two or three pixels tall. Make the lenses about
   0.12 m tall and the bar about 1.3 m wide, on all four cars (the unmarked car's grille lamps the
   same size), so the red and blue read at a distance.
2. **The doors are black to the windows.** A Japanese patrol car is white above the waist line (the
   upper doors, the pillars, the roof) and black below it. On the cruiser, carry the white down the
   doors to about the height of the door handles.

Next: the unmarked car, the Rhino and the interceptor, one commit each (0.9.55 to 0.9.57), stopping
for review after all three. G5 follows.

## Review of 0.9.55 to 0.9.57 (Claude): passed, G3 done

The unmarked car (1,524 body triangles), the Rhino (1,568) and the interceptor (1,702), check()
clean. Both notes from the cruiser's review are in: the lenses are 0.12 m tall on 1.32 m bars (the
unmarked car's grille lamps the same height), and the marked cars are white down to the door
handles. The lens sides are right on all three. In the game (0.9.70) all four units now drive with
their own bodies, the bar flares sitting on each model's red lens, the unmarked car's in its grille.
Next for Gemini: G5, the street racers, two cars per review.

