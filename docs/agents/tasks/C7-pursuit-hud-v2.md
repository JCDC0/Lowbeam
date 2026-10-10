# C7: The pursuit HUD, second sketch (Claude, with the backend's fields)

Jc's second sketch (2026-10-10), from the first (`archive/A13-pursuit-hud.md`, the contract of the markers
still holds), drawn to be like Need for Speed Unbound's pursuit HUD (Jc found no reference image; this is
drawn from the sketch). A column at the bottom center, top to bottom:

1. The evade and busted meter, a bar at the TOP of the column (it used to sit along the bottom of the
   board; Jc: "the bar rests at the top, not beneath").
2. While the police resupply: the clock (60:00) over REINFORCEMENTS ARRIVING.
3. A row of icons, one per kind of police vehicle and the helicopter, each over its count.
4. The board: heat, bounty, time, and the ON SCENE, ASSIGNED and DESTROYED tallies (the sketch's plain
   rounded panel at the bottom).

What Jc said about the icons, which this brief follows:

- The row is a centered HTML row: icons fade in and out, and the row re-centers and closes up over the
  space a leaving icon frees.
- An icon fades in when that kind of vehicle is in the player's sight, not when the director spawns it.
- Their numbers are in the Japanese face (`--font-jp`, M PLUS 1p), and a count is a count: 0, never 00,
  and the DESTROYED tally on the board reads 0 too (it read 00 and 01).
- When one of their vehicles crashes (is destroyed) its icon plays a fading glitch and its count drops;
  when the last of a kind is gone the icon rests at 0 for a moment, fades out and the row closes up; the
  board's ON SCENE falls and DESTROYED rises.

## Done in 0.10.22 and 0.10.23 (Claude: `ui/pursuit.js`, `style.css`, `tests/pursuit-hud.test.mjs`)

- `layoutPursuit` gives each kind `{ kind, n, seen }` and `heliSeen`, the destroyed tally unpadded, and
  `resupply: { left, text }` from `view.resupply` (seconds left; `60:00` is seconds and hundredths).
  `lostKinds(prev, next)` says which icons glitch: the tally rose and the kind's count fell, so a unit
  that went home does not glitch. `iconStep` is an icon's life in the row: it comes in when its kind is
  seen and has units, stays while it has units, rests `LEAVE_DELAY` (0.9 s) at 0, then leaves; a kind that
  comes back with units comes back in.
- The row is a flex row with `justify-content: center`; an icon is closed (no width, no margin, clear)
  until it is in: it opens, then fades in (0.3 s later); on its way out it fades, then closes (0.4 s
  later). A glitch is 0.75 s (a sliced clip, a red and cyan split, a flicker) and the DESTROYED number
  bumps. Counts are in the Japanese face at 26 px; at 0 an icon is dimmed.
- The meter is the first child of the column, on its own plate, with the evade and busted labels at its
  ends, split from the middle, a blue COOLDOWN bar while they search; it hides on the end card.
- The clock has no bar of its own (the meter is the bar). It shows while `view.resupply` is a number, or
  (no clock) while `view.reinforcements` is true.
- Checked in the browser at 1280 by 720 with scripted views: the meter on top over a 38:42 clock and five
  icons (3, 2, 1, 1, 1) over the board; a destroyed Rhino glitching, resting at 0, fading out and the row
  closing up to four icons, centered.

## What waits for the backend (B5, `pursuitView()` in `drive.js`)

Both fields are optional: the HUD works without them (an icon counts as seen while its kind has units,
and there is no clock), and shows them as soon as they arrive.

- `seen: string[]`: the kind ids (`police`, `police-fast`, `police-int`, `police-heavy`) and `'heli'` that
  have been in the player's sight at any moment of this pursuit, reset when it ends. In sight is: a unit
  of that kind within 120 m with a clear line to the player (`clearLine`, as the police use it) and in
  front of the camera (within 70 degrees of the view direction; the rig has it); a helicopter within
  400 m, in the view and not under a roof (`rain.cover`). Once in, a kind stays seen.
- `resupply: number | null`: the seconds left on B5's 60 s clock (part 2), null when no clock runs.
  `reinforcements` stays true while cars the clock dispatched are still driving in.

## Still to confirm with Jc

- `60:00` as seconds and hundredths (the sketch's colon was a drawing slip): `clockText`.
- The three board tallies (ON SCENE, ASSIGNED, DESTROYED) stay in Michroma; only the icons' counts and the
  clock are in the Japanese face. One CSS rule moves them too.
