# C7: The pursuit HUD, Jc's sketches (Claude, with the backend's fields)

Jc drew the layout three times (2026-10-10) and annotated a screenshot of the second attempt; this is the
third reading, from the annotated screenshot, which is the authority. It is drawn to be like Need for Speed
Unbound's pursuit HUD (Jc found no reference image). Two groups:

**At the top of the screen**, centered, about 43 % of the screen wide:
1. The reinforcements' timer bar, a red bar at the very top of the screen. It closes toward the middle as
   the clock runs down. When the timer reaches 0 the bar fades out, and with it the clock and the label;
   the reinforcements are added under their car symbols, and only the active cop icons and their integers
   stay.
2. Under the bar: the clock (38:42) and REINFORCEMENTS ARRIVING.
3. Under those, always while a pursuit runs: the row of icons, one per kind of police vehicle and the
   helicopter, each over its integer count.

**At the bottom center, the board** (the rounded panel): heat, bounty, time; the three tallies, each a
number over an ICON instead of a word (the words ON SCENE, ASSIGNED and DESTROYED were struck out): a cop
car with its light bar flashing, a car with a drop-in arrow over it, a crashed car crossed out; and the
evade and busted meter along the board's bottom ("Put Back": it is not at the top).

What Jc said about the icons, which the code follows:
- The row is a centered HTML row: icons fade in and out, and the row re-centers and closes up over the
  space a leaving icon frees.
- An icon fades in when that kind of vehicle is in the player's sight, not when the director spawns it.
- Their numbers are in the Japanese face (`--font-jp`, M PLUS 1p), and a count is a count: 0, never 00, and
  the DESTROYED tally reads 0 too.
- When one of their vehicles crashes its icon plays a fading glitch and its count drops; when the last of a
  kind is gone the icon rests at 0 for a moment, fades out and the row closes up.
- If a helicopter needs to refuel, a yellow gas symbol pops up beside it, then turns red and the
  helicopter retreats.
- There is always one cop car on sight unless the player physically cannot be chased (B5's rule: the last
  unit is never recalled; see "Always one" below).

## Done (Claude: `ui/pursuit.js`, `style.css`, `tests/pursuit-hud.test.mjs`; 0.10.22 to 0.10.27)

- `#pursuit-hud` is a full-screen overlay with a `.ph-top` group and a `.ph-bottom` board.
- The timer bar is 16 px, red, in a 3 px red frame, its fill a centered block that shrinks from both ends
  (`fill` is `view.resupply` over `RESUPPLY_SECONDS`, 60). When `view.resupply` goes from a number to
  null the bar closes in 0.6 s and the header fades over `RESUPPLY_FADE` (0.9 s), then it is gone.
- Counts that rise (reinforcements added) pop: scaled up in amber, then settled (`risenKinds`).
- A helicopter low on fuel (`view.heliFuel` 'low') gets a yellow pump that pops in; 'leaving' turns it red.
- `layoutPursuit` gives each kind `{ kind, n, seen }`, `heliSeen`, the unpadded destroyed tally, `fuel`,
  and `resupply: { left, fill, text }` (`60:00` is seconds and hundredths). `lostKinds` says which icons
  glitch (the tally rose and the kind's count fell: a unit that went home does not). `iconStep` is an icon's
  life in the row (in when seen and it has units, stays, rests `LEAVE_DELAY` 0.9 s at 0, leaves).
- Checked in the browser at 1280 by 720 with scripted views: the red bar at the top over a 38:42 clock,
  five icons (3, 2, 1, 1, 1) and a yellow pump beside the helicopter, the board with the icon tallies and
  the meter at its bottom; the timer running out (the bar closing, the header fading, the counts popping
  to 5, 3, 1, 1, the pump red).

## What waits for the backend (B5, `pursuitView()` in `drive.js`)

All three fields are optional: the HUD works without them (an icon counts as seen while its kind has
units, there is no clock, no pump) and shows them as soon as they arrive.

- `seen: string[]`: the kind ids (`police`, `police-fast`, `police-int`, `police-heavy`) and `'heli'` that
  have been in the player's sight at any moment of this pursuit, reset when it ends. In sight is: a unit
  of that kind within 120 m with a clear line to the player (`clearLine`, as the police use it) and in
  front of the camera (within 70 degrees of the view direction; the rig has it); a helicopter within
  400 m, in the view and not under a roof (`rain.cover`). Once in, a kind stays seen.
- `resupply: number | null`: the seconds left on B5's 60 s clock (part 2), null when no clock runs. It
  goes to null the moment the cars are dispatched; the HUD closes the bar on that frame.
- `heliFuel: 'low' | 'leaving' | null`: 'low' while any helicopter's fuel is under 15 s of its tank
  (`heli.js`: "CHOPPER BREAKING OFF" is at 15 s left), 'leaving' once it has broken off to refuel, null
  otherwise.

### Always one

Jc: "there is always one cop car on sight unless physically it can't be chased." B5 part 2 already keeps
the last unit on the player (it is never recalled and never counted out). If that car is destroyed the
road stays empty until the clock ends; the HUD then shows every count at 0 with the clock and the bar
running, which is the sketch's situation. To confirm with Jc: whether a destroyed last car should be
replaced at once instead of waiting for the clock.

## Still to confirm with Jc

- `60:00` as seconds and hundredths (the sketch's colon was a drawing slip): `clockText`.
- The tallies' numbers stay in Michroma; only the icons' counts and the clock are in the Japanese face.
- The tally icons are drawn by Claude from Jc's doodles (a cop car with a siren, a car under a drop-in
  arrow, a crashed car with an X): `TALLY_ICONS` in `ui/pursuit.js`.
