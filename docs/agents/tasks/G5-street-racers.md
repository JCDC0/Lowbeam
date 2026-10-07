# G5: The other eleven street racers (Assets)

After the Mazuma (G2) passes and the cruiser (G3) is reviewed. Jc asked for a field of street racers;
twelve are in the game today as coarse bodies lofted in code (`src/vehicles/bodies/racers.js`), and
the Mazuma was the trial for moving them to Blender. This brief moves the other eleven, to the same
standard and the same rules as G2 (read it and both of its reviews first).

Versions: the next numbers in 0.9.50 to 0.9.69 (ask Claude for a new range when it runs out); one
commit per car; stop for Claude's review after every two cars.

## The cars

The dimensions are fixed (the physics and the traffic use them). Origin on the ground at the center
of gravity, the front faces +z, the car's LEFT is +x. Axles are given as front / rear z, the body
as nose / tail z. Wheels: radius and the x of the wheel centers.

| Id (file) | Name | Length | Width | Height | Axles z | Nose / tail z | Wheels |
|---|---|---|---|---|---|---|---|
| `rv-kei` (`rv_kei`) | HOSHI KEI-S | 3.30 | 1.48 | 1.18 | +1.06 / -1.18 | +1.61 / -1.69 | 0.27, x +-0.65 |
| `rv-hothatch` (`rv_hothatch`) | KAGERO HOT-GT | 4.00 | 1.70 | 1.37 | +1.00 / -1.62 | +1.82 / -2.18 | 0.30, x +-0.73 |
| `rv-boxer` (`rv_boxer`) | KAGERO LANCER-X | 4.50 | 1.77 | 1.45 | +1.15 / -1.48 | +2.05 / -2.45 | 0.32, x +-0.76 |
| `rv-v8drift` (`rv_v8drift`) | HALDEN DRIFTER | 4.78 | 1.92 | 1.39 | +1.30 / -1.42 | +2.25 / -2.53 | 0.34, x +-0.80 |
| `rv-wedge` (`rv_wedge`) | TSURUGI WEDGE | 4.40 | 1.86 | 1.16 | +1.50 / -1.05 | +2.45 / -1.95 | 0.32, x +-0.79 |
| `rv-hardtop` (`rv_hardtop`) | KENRO HARDTOP | 4.40 | 1.66 | 1.41 | +1.15 / -1.42 | +1.97 / -2.43 | 0.30, x +-0.70 |
| `rv-roadster` (`rv_roadster`) | HOSHI BEAT | 3.40 | 1.40 | 0.86 | +1.20 / -1.08 | +1.75 / -1.65 | 0.27, x +-0.61 |
| `rv-wide` (`rv_wide`) | KAGERO RS-WIDE | 4.60 | 1.95 | 1.39 | +1.25 / -1.42 | +2.17 / -2.43 | 0.33, x +-0.80 |
| `rv-hyper` (`rv_hyper`) | VESPERA ZERO | 4.65 | 2.04 | 1.13 | +1.55 / -1.15 | +2.60 / -2.05 | 0.34, x +-0.85 |
| `rv-sakura` (`rv_sakura`) | KENRO SAKURA S | 4.45 | 1.70 | 1.32 | +1.17 / -1.36 | +2.03 / -2.42 | 0.31, x +-0.74 |
| `rv-vip` (`rv_vip`) | KAGERO ARISTO VIP | 4.95 | 1.82 | 1.45 | +1.25 / -1.67 | +2.20 / -2.75 | 0.34, x +-0.78 |

What each one is (fictional makes; the spirit of a real car, never a copy of its badges):

- **Hoshi Kei-S**: a kei sports car, a tiny front-engine roadster coupe with a hard top, round lamps.
- **Kagero Hot-GT**: a 90s three-door hot hatch, wide arches, a roof spoiler.
- **Kagero Lancer-X**: a four-door rally sedan, hood vents and scoop, a tall rear wing.
- **Halden Drifter**: a big V8 four-door sedan built for drifting, long hood, a ducktail.
- **Tsurugi Wedge**: an 80s twin-turbo wedge GT, pop-up lamps, a sharp folded-paper body.
- **Kenro Hardtop**: a 70s two-door hardtop, chrome bumpers, bolt-on over-fenders, a chin spoiler.
- **Hoshi Beat**: a mid-engine kei roadster, open top with a roll hoop, tiny and low.
- **Kagero RS-Wide**: a widebody tuner coupe, riveted flares, a big wing, a front splitter.
- **Vespera Zero**: a hypercar, cab-forward, a long tail with a full-width lamp bar.
- **Kenro Sakura S**: a late-80s rear-drive coupe in the Silvia mould, pop-ups or slim lamps.
- **Kagero Aristo VIP**: a long luxury sedan slammed in VIP style, chrome, deep-dish wheels.

## Each car

As G2: materials `paint` (the body color; any strong color, the game repaints it), `accent`,
`glass`, `trim`, `under`, `chrome`, `lamp`, `tail`, `plate`, and `tire` and `rim` for the viewer;
the body at most 2,500 triangles; real arches, glass set in, a car shape from above; four `wheel-*`
objects; exports `<file>` (body) and `<file>_full`; the shots at about 6 m including the top view;
bounds and plan-view widths quoted from the JSON. Compare each with its lofted version in
`tools/bodies.html` (`__bodies.show('<id>')`).
