# A16: Speedometer styles for the HUD cluster, and the new fonts in the UI (Antigravity)

The game has had one speedometer and one typeface since the start. Since 0.8.0 it bundles more faces
(`src/render/fonts.js`: `FONT.display` Michroma, `FONT.seg7` and `FONT.seg14` DSEG segment digits,
`FONT.mono` Share Tech Mono, `FONT.impact` Dela Gothic One, `FONT.jp` M PLUS 1p). This task gives the
HUD cluster (the outside views) a style per car and puts the faces to work across the UI. Claude does
the same for the cockpit instruments, adds a fifth car with an 80s fluorescent digital dash, and fixes
the cockpit camera. Read `docs/agents/ARCHITECTURE.md` (Gauge cluster) and the rules in `README.md`.

Version numbers: 0.8.10 (part 1), 0.8.11 (part 2), 0.8.12 (part 3). Claude has 0.8.0 to 0.8.9.

## The contract

Each car spec gets `dash: { hud: ClusterStyle }` (Claude adds it in `src/vehicles/specs.js`):

| Car | `hud` | Feel |
|---|---|---|
| Hayate RS-4 (90s rally sedan) | `classic` | The current cluster, unchanged. It stays the reference style. |
| Rampart 440 (muscle) | `twin` | Two big round dials side by side, white faces, chrome rings, a thin red needle, the gear in a small window between them |
| Vespera GT (exotic) | `sport` | A big center tach with a yellow face (Ferrari style), a digital speed readout in its middle, small fuel and temp bars beside it |
| Tsurugi GT-X (modern GT) | `digital` | A modern LCD: speed in big DSEG7, the tach as a segmented arc bar that fills and turns red at the redline, gear in DSEG14, boost as a bar, Share Tech Mono labels, cyan and white on black |
| Hikari 300ZR (new, 1984 turbo coupe, id `hikari`) | `vfd` | An 80s vacuum fluorescent display: a horizontal bar-graph tach across the top in green, then amber and red segments, speed in DSEG14 in cyan, gear and boost as segment bars, a faint glow and ghosting of the unlit segments |

Until Claude's commit lands, read `spec.dash?.hud ?? 'classic'`, so the code works either way.

## Part 1 (0.8.10): the styles

`src/ui/cluster.js` keeps `drawCluster` and the `Cluster` class. Add `CLUSTER_STYLES` (`classic`,
`twin`, `sport`, `digital`, `vfd`) and draw each style from the same gauge readings (`gauges.js`:
rpm, kmh, gear, boost or vacuum, fuel, temp, exh, shift light, limiter, warnings). Every style keeps
the warning lamps (CHECK ENGINE, DMG, OVERREV, ENGINE OFF, HOT) in its own look, and the shift light.
Same footprint and anchor as now (bottom right), never covering the minimap or the prompt. Test the
pure parts (bar fill for an rpm, which segment is red, the readout strings) in `tests/cluster.test.mjs`.

## Part 2 (0.8.11): the choice

Settings gets a `SPEEDOMETER` row: `PER CAR` (default) or any one style for every car, saved in the
store under `clusterStyle`. The garage card shows the car's style name. Shots at 480 lines of all five
styles in the drive view, with the car at speed near the redline.

## Part 3 (0.8.12): the fonts in the UI

- Dela Gothic One for the big banners: the pursuit HUD state words (PURSUIT, EVADING, BUSTED,
  ESCAPED), the duel and rally countdown and results, toasts for the toll speed trap.
- Share Tech Mono for numbers that change: money, the duel and rally clocks and splits, the F3 stats,
  NOW PLAYING.
- M PLUS 1p wherever the UI shows Japanese, and Japanese subtitles where they fit the style: the menu
  items (`ドライブ`, `ガレージ`, `設定`), the area names (`黒鉄シティ` under KUROGANE CITY).
- Michroma stays for the menus' headings and the area name.

## Rules

- Your files: `src/ui/*` except `src/ui/hud.js` (Hermes's rally and duel panels; style them with new
  rules at the end of `style.css` and class names, not by editing hud.js), `style.css`, `tests/`.
- Do not edit: `src/vehicles/*` (Claude: specs, cockpit, the new car), `src/drive.js`,
  `src/traffic/*`, `src/audio/*` (Hermes's A14), `src/world/*`, `src/render/*`, `src/police/*`,
  `assets/`.
- `src/main.js` and `style.css`: small exact-string edits, re-read right before editing, stage only
  your own hunks. The changelog stays sorted by version; the current state header names the highest
  version.
- `npm test` and `npm run check` green before each commit.
