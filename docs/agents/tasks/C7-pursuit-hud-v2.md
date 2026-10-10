# C7: The pursuit HUD, second sketch (Claude, with the backend's fields)

Jc's second sketch (2026-10-10), from the first (`archive/A13-pursuit-hud.md`, the contract of the markers
still holds): over the pursuit board a resupply header (a bar, a big clock, REINFORCEMENTS ARRIVING), then
a row of icons, one per kind of police vehicle and the helicopter, each over its count; the board below
is as before. What Jc said about the icons, which this brief follows:

- They fade in when that kind of vehicle is in the player's sight, not when the director spawns it.
- Their numbers are in the Japanese face (`--font-jp`, M PLUS 1p), and a count is a count: 0, never 00,
  and the DESTROYED tally on the board reads 0 too (it read 00 and 01).
- When one of their vehicles crashes (is destroyed) its icon plays a fading glitch, its count drops, the
  board's ON SCENE falls and DESTROYED rises: the slot is freed.
- Jc found no reference for the look ("something like Need for Speed Unbound's"); this is drawn from the
  sketch, not from that game.

## Done in 0.10.22 (Claude: `ui/pursuit.js`, `style.css`, `tests/pursuit-hud.test.mjs`)

- `layoutPursuit` gives each kind `{ kind, n, seen }` and `heliSeen`, the destroyed tally unpadded, and
  `resupply: { left, fill, text }` from `view.resupply` (seconds left, `60:00` as seconds and hundredths).
  `lostKinds(prev, next)` says which icons glitch: the tally rose and the kind's count fell, so a unit
  that went home does not glitch.
- The icons: hidden until seen, then they fade in (0.7 s) and stay for the pursuit; at 0 they rest dimmed
  showing 0 (`ZERO_KEEPS_SLOT`), they glitch on a loss (0.75 s: a sliced clip, a red and cyan split, a
  flicker, ending at rest), and the DESTROYED number bumps. Counts are in the Japanese face at 26 px.
- The header: a bar draining over `RESUPPLY_SECONDS` (60), the clock, REINFORCEMENTS ARRIVING. It shows
  while `view.resupply` is a number, or (no clock) while `view.reinforcements` is true.
- Checked in the browser at 1280 by 720 with scripted views: an empty row before any sighting; five icons
  with 3, 2, 1, 1, 1 and a 38:42 clock; a destroyed Rhino resting at 0; a destroyed unmarked car caught
  mid-glitch.

## What waits for the backend (B5, `pursuitView()` in `drive.js`)

Both fields are optional: the HUD works without them (an icon counts as seen while its kind has units,
and there is no clock), and shows them as soon as they arrive.

- `seen: string[]`: the kind ids (`police`, `police-fast`, `police-int`, `police-heavy`) and `'heli'` that
  have been in the player's sight at any moment of this pursuit, reset when it ends. In sight is: a unit
  of that kind within 120 m with a clear line to the player (`clearLine`, as the police use it) and in
  front of the camera (within 70 degrees of the view direction; the rig has it); a helicopter within
  400 m, in the view and not under a roof (`rain.cover`). Once in, a kind stays in.
- `resupply: number | null`: the seconds left on B5's 60 s clock (part 2), null when no clock runs.
  `reinforcements` stays true while cars the clock dispatched are still driving in.

## Decisions to confirm with Jc

- The reading of the sketch's top rectangle as the clock's bar, and of `60:00` as seconds and
  hundredths (the sketch's colon was a drawing slip). Both are one constant each.
- An icon whose units are all gone keeps its slot, dimmed, at 0 ("an actual meter of 0"). If Jc meant
  the icon leaves the row when its kind is gone, `ZERO_KEEPS_SLOT` is false and the slot is freed.
- The three board tallies (ON SCENE, ASSIGNED, DESTROYED) stay in Michroma; only the icons' counts and the
  clock are in the Japanese face. One CSS line moves them too.
