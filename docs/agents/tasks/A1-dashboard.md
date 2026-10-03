# A1: repair the cockpit dashboard

Files: `src/vehicles/models.js` (`buildCockpit` only), `src/ui/cluster.js`, `src/drive.js`
lines that create the dash canvas (the only drive.js edit allowed), your tests.

The 0.1.9 dash pastes the HUD cluster onto a plane. Looking at `tools/shots/cockpit_with_update.png`
and the code, it has three problems.

## 1. The image is mirrored

Car local +X is the car's LEFT. The gauge quad in `buildCockpit` maps `u = 0` to
`dx - gw` (the driver's right), so the picture is reversed left to right. Flip `u`.
Prove it: draw a test canvas with the word LOWBEAM, a red mark on its left edge and a
blue mark on its right edge, take a cockpit `shot()`, and confirm the text reads
correctly and red is on the driver's left. Then switch back to the live gauges.

## 2. The binnacle blocks the view

`bTopY = beltY + 0.28` makes the hood rise 28 cm into the sight line, a big dark slab
above the dash. The rearview mirror is a 24 by 7 cm black box that also reads as a slab.

- The hood may rise at most 4 cm above the dash top at the driver's eye line.
- The face sits low and tilted toward the eye, visible through the top of the steering wheel.
- Shrink the mirror and keep it out of the forward sight line.
- Do not open see-through gaps (keep the 0.1.9 DoubleSide and sealing work).

## 3. It is unreadable at 240p

The render target is 240 lines. The face is about 90 by 65 px on screen, but the canvas
uses 7 to 15 px glyphs and hairline ticks, so the dials turn to mush.

- Draw a cockpit layout of the same cluster: same arrangement and colors as the HUD
  (big round tach, speed and gear in the gap, four sub-dials around it), but bold:
  thick strokes, no glyph under about 8 % of the face height, tick marks only each
  1000 rpm, one numeral per 1000, a fat needle.
- Keep the aspect ratio. `drawCluster` currently scales x and y independently
  (`g.scale(w / W, h / H)`), which stretches a 420 by 300 canvas. Fix that.
- The 3rd person HUD cluster can keep the detailed look.

## 4. Gauge contract (built by Claude in 0.2.x, build against stubs now)

Claude is changing `src/vehicles/gauges.js`. The new `Gauges` fields you should read:

| Field | Meaning |
|---|---|
| `temp` | engine temperature in C, 80 to 120, replaces `water` |
| `exh` | exhaust gas temperature, 300 to 900 |
| `gear` | `'R'`, `'N'`, `'1'` to `'7'` (some cars have 5, 6 or 7 gears) |
| `gears` | number of forward gears |
| `overrev` | 0 to 1, how far past the redline toward the 11,000 rpm blow limit |
| `damage` | 0 to 1 |
| `blown` | boolean, engine is blown (limp mode) |
| `rpm` | engine rpm, can exceed the redline up to 11,000 |

Display changes:

- Rename the WATER dial to TEMP (label `TEMP`, red from 110 C, a HOT lamp from 115 C).
- The tach scale runs to 11 for every car, with a normal red band from the car's redline
  and a darker "danger" band from the redline to 11. Today `maxRpmOf` is
  `ceil(redline / 1000) * 1000 + 1000`, which cannot show an over-rev.
- Gear box handles `R`, `N` and one digit up to 7.
- New lamps: CHECK ENGINE flashing when `blown`, a steady damage lamp when
  `damage > 0.3`, a short over-rev flash when `overrev > 0`.
- Until Claude lands `gauges.js`, read the fields defensively (`gs.temp ?? gs.water`).

## Done when

- A cockpit `shot()` of Hayate, Rampart and Vespera at night shows an upright, readable
  cluster, a clear view over the dash, and no see-through parts.
- `npm test` and `npm run check` pass. Update `docs/agents/ARCHITECTURE.md` (Gauge cluster
  and Cockpit sections) and the changelog.
