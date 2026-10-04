# A16: Speedometer styles for the HUD cluster, the fonts across the UI, and the controls settings (Antigravity)

The game has had one speedometer and one typeface since the start. Since 0.8.0 it bundles more faces
(`src/render/fonts.js`: `FONT.display` Michroma, `FONT.seg7` and `FONT.seg14` DSEG segment digits,
`FONT.mono` Share Tech Mono, `FONT.impact` Dela Gothic One, `FONT.jp` M PLUS 1p). This task gives the
HUD cluster (the outside views) a style per car and puts the faces to work across the UI. Claude does
the same for the cockpit instruments, adds a fifth car with an 80s fluorescent digital dash, and fixes
the cockpit camera. Read `docs/agents/ARCHITECTURE.md` (Gauge cluster) and the rules in `README.md`.

Version numbers: 0.8.10 (part 1), 0.8.11 (part 2), 0.8.12 (part 3), 0.8.13 (part 4). Claude has 0.8.0
to 0.8.9.

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

## Part 1 (0.8.10): the styles (done)

Claude wrote `src/ui/cluster-styles.js` and the shared painters (`src/vehicles/instruments.js`, 0.8.3)
while you were on A15, and your session committed the styles as 0.8.10. The HUD now shows each car's own
cluster, drawn with the cockpit's own code. Do not redraw them; parts 2 to 4 build on them.
`Cluster.setSpec(spec, override)` takes one style for every car ('classic' ... 'vfd') or 'car' / null
for the car's own.

## Part 2 (0.8.11): the choice

Settings gets a `SPEEDOMETER` row: `PER CAR` (default) or any one style for every car, saved in the
store under `clusterStyle` ('car' or a style). Apply it where the cluster is made: in `src/drive.js` the
two lines `if (!this.cluster) this.cluster = new Cluster(...)` / `else this.cluster.setSpec(spec)` may
pass `store.get('clusterStyle', 'car')` (the only drive.js edit you may make), and a change in Settings
calls `drive.cluster?.setSpec(drive.cluster.spec, value)` from main.js. The garage card shows the car's
style name (CLASSIC, TWIN, SPORT, DIGITAL, VFD). Shots at 480 lines of all five styles in the chase view
with the car at speed near the redline.

## Part 3 (0.8.12): the fonts across the whole UI

The user wants the UI to stop leaning on one face. Since 0.8.4 there are two more: Orbitron
(`FONT.tech`, weights 700 and 900, wide and geometric) and Teko (`FONT.race`, 500 and 700, condensed
sport numerals). Put every face in `:root` of `style.css` as variables (`--font-display`, `--font-tech`,
`--font-race`, `--font-mono`, `--font-seg7`, `--font-seg14`, `--font-impact`, `--font-jp`, the same
stacks as `src/render/fonts.js`) and use the variables, never a family name in a rule. Where each goes:

| Screen | Element | Face |
|---|---|---|
| Title | LOWBEAM wordmark | Orbitron 900, wide tracking |
| Title | 黒鉄ナイトラン under it (Kurogane Night Run) | Dela Gothic One |
| Title | PRESS ENTER (blinking), the version line | Share Tech Mono |
| Main menu | Item labels | Orbitron 700, with a small Japanese subtitle under each in M PLUS 1p: ドライブ, ガレージ, 設定, 操作設定 |
| Main menu | Telemetry card numbers | Share Tech Mono |
| Settings, Controls | Section headings | Orbitron 700 |
| Settings, Controls | Row labels | Michroma |
| Settings, Controls | Values (ON, AUTO, 480, key names) | Share Tech Mono; volume levels as segment bars with the number in DSEG14 |
| Garage | Car name | Orbitron 900, the katakana name under it in M PLUS 1p (ハヤテ, ランパート, ヴェスペラ, ツルギ, ヒカリ) |
| Garage | Maker, year, drivetrain, gears | Share Tech Mono |
| Garage | Bench figures if shown (0-100, top speed) | DSEG7 |
| Loading | Percent | DSEG7; the tip line in Share Tech Mono |
| Pause | Heading | Orbitron 900 |
| Drive HUD | Money, NOW PLAYING, rally clock and splits | Share Tech Mono |
| Drive HUD | Area name | Michroma, with the Japanese name under it in M PLUS 1p from `AREA_JP` in `src/world/layout.js` (a name missing there gets no subtitle; the one edit you may make in `hud.js` is in `area()` for this) |
| Drive HUD | Toll speed trap toast (the km/h), duel and rally countdown | Teko 700, large |
| Drive HUD | Duel and rally result headings | Dela Gothic One |
| Pursuit HUD | State words (PURSUIT, EVADING, BUSTED, ESCAPED) | Dela Gothic One |
| Pursuit HUD | Heat number, bounty, timer | Teko |

Michroma stays the face of the row labels and the area name, so the game still looks like itself.
Shots of every screen at 480 lines.

## Part 4 (0.8.13): Controls settings (key rebinding)

The controls screen today is a read-only briefing. Make it a real settings screen, reachable from the
main menu (CONTROLS / 操作設定), from Settings and from Pause.

- One row per action in `src/core/input.js` (throttle, brake, steer left, steer right, handbrake, shift
  up, shift down, camera, reset, interact, map, pause, and any other the drive reads), two key slots per
  action and the gamepad button shown beside them (read only).
- Select a slot and press Enter: the slot shows PRESS A KEY; the next key binds it, Esc cancels. A key
  already bound to another action is swapped into the slot this one left, so nothing is ever unbound by
  surprise. Esc and Enter cannot be bound (they run the menus).
- RESET TO DEFAULTS at the bottom; the defaults stay `KEYS` in input.js.
- Saved in the store under `keys` (action to codes); `input.js` loads it at boot and takes
  `setBindings(map)` when it changes, so a change applies at once, also mid-drive from Pause.
- Show key names the way a player reads them (W, Shift, Ctrl, Space, Up, Left), not `KeyW` or
  `ArrowUp`.
- The old briefing (what each control does, N R 1..n, the camera views) moves to a second page or a
  column on the same screen.
- Test the pure parts in `tests/controls.test.mjs`: `rebind(map, action, slot, code)` swaps duplicates,
  refuses Esc and Enter, and the reset gives back `KEYS`; `keyLabel(code)`.

## Rules

- Your files: `src/core/input.js` and `src/core/store.js` (part 4), `src/ui/*` except `src/ui/hud.js` (Hermes's rally and duel panels; style them with new
  rules at the end of `style.css` and class names, not by editing hud.js), `style.css`, `tests/`.
- Do not edit: `src/vehicles/*` (Claude: specs, cockpit, the new car), `src/drive.js`,
  `src/traffic/*`, `src/audio/*` (Hermes's A14), `src/world/*`, `src/render/*`, `src/police/*`,
  `assets/`.
- `src/main.js` and `style.css`: small exact-string edits, re-read right before editing, stage only
  your own hunks. The changelog stays sorted by version; the current state header names the highest
  version.
- `npm test` and `npm run check` green before each commit.
