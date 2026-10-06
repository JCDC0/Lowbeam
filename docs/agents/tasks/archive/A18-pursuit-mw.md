# A18: The pursuit HUD, Most Wanted style, grown (Antigravity)

The user wants the police chases to feel like Need for Speed: Most Wanted (2005). Hermes builds the
police (A17, including its section "The target: Need for Speed: Most Wanted, closely"); you built the
pursuit HUD and the police markers against the A13 contract. This task draws everything A17 adds to that
contract ("The view, grown": `PursuitViewMW` and the new marker kinds), against a scripted demo as in
A13, so you never wait on Hermes. Read A13, A17 and `docs/agents/ARCHITECTURE.md` first.

Version numbers: 0.8.25 to 0.8.29. Start after A16.

## Part 1 (0.8.25): the pursuit HUD, grown

In the A13 HUD (`src/ui/pursuit.js`, `layoutPursuit` stays pure and tested):
- Heat: five marks as now, and on a heat rise a banner across the top, `HEAT LEVEL 3`, in Teko 700
  (`--font-race`), red and white, for 2 s.
- Infractions: each new one slides in on the left as a short line (`+ RAMMING A POLICE VEHICLE`) in
  Share Tech Mono with the bounty it added, and stays listed small under the bounty while the pursuit
  lasts.
- Counters in Teko under the bars: bounty (big), units involved, units disabled, cost to state (yen),
  the pursuit time.
- HIDING: when `hiding` is true in cooldown, a word on the cooldown bar and the bar's fill pulses.
- Radio chatter: the line in `chatter` in a strip at the top left under a small radio icon, in Share
  Tech Mono, typed out over 0.4 s and gone 4 s after `t` = 0.
- State words stay Dela Gothic One (A16 part 3).

## Part 2 (0.8.26): the report

When `report` is set, the screen Most Wanted shows after a pursuit: BUSTED in red or ESCAPED in blue in
Dela Gothic One, then the rows (pursuit time, heat reached, bounty, fine if busted, infractions one per
line, units involved, units disabled, roadblocks dodged, spike strips dodged, cost to state) counting up
one after another in Teko, a total, and `ENTER  CONTINUE`. The drive stays paused under it until Enter.
Test the pure layout (`layoutReport(report)`: row order, the total, which color).

## Part 3 (0.8.27): the minimap and the Tab map in cooldown

- Each searching unit's sight cone (`cone: { r, half }`) as a translucent wedge ahead of its arrow, red
  when it sees the player.
- The last known position (`last: { x, z, r }`) as a dashed circle that grows.
- Roadblocks (a short red and blue bar across the road), spike strips (a short dashed line), pursuit
  breakers (a small warning triangle) as their own marker kinds, during a pursuit only.
- Hideouts glow on the minimap during cooldown (they are hiding spots).
Extend `tests/map.test.mjs`.

## Part 4 (0.8.28): the career sheet

A RAP SHEET page reachable from the main menu, from the store's `rapSheet` (pursuits, escapes, busts,
total bounty, longest pursuit, most units disabled), in the same style as the report. Show zeros until
Hermes's Drive writes it.

## Rules

- The demo (`__lowbeam.pursuitDemo` from A13) grows to script every new field: a heat rise, three
  infractions, chatter lines, units disabled, a hiding spot, a cooldown with cones, a roadblock and a
  spike strip marker, a breaker, then an ESCAPED report and a BUSTED one. Shots of each at 480 lines.
- Your files: `src/ui/*` except `src/ui/hud.js`, `style.css`, `src/main.js` (small edits), `tests/`.
- Do not edit: `src/police/*`, `src/race/*`, `src/traffic/*`, `src/drive.js`, `src/audio/*` (Hermes),
  `src/world/*`, `src/render/*`, `src/vehicles/*`, `assets/` (Claude).
- Shared files: re-read right before each edit, small exact-string edits, stage only your own hunks.
  The changelog stays sorted by version; the current state header names the highest version.
- `npm test` and `npm run check` green before each commit.
