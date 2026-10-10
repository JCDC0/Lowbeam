# B6: Nitrous earned on the road (Backend, with Claude's HUD)

Jc (2026-10-10): the nitrous should fill up while you drive like a street racer, not only at a pump: at
high speed, by damaging police cars, by driving in the oncoming lane and by drafting. After the bug-bash
(`BUGS.md`); not before.

Read `src/vehicles/nitrous.js` (the bottle, refilled at a pump) and how the Drive feeds it.

## What fills the bottle

A full bottle is 8 s. Each source adds to it while it lasts, capped at full; the numbers are a first guess
to tune with Jc's hands on the keys:
- Speed: above 180 km/h, 2 % of a bottle a second, 4 % above 250.
- The oncoming lane: on a two-way road, in a lane of the other direction at more than 80 km/h, 5 % a
  second, and a near miss with an oncoming car (within 2 m at a closing speed over 30 m/s) 8 % at once.
- Drafting: within 15 m behind a moving car, nearly in its line (under 1.5 m to the side), above 100
  km/h, 4 % a second after the first second.
- Police: a hit on a unit 4 % plus 1 % per m/s of closing speed over 8 (capped at 15 % a hit), and 30 % for
  a unit taken out.
- While the nitrous is burning nothing refills it.

## Rules and tests

- Pure: a `NitrousEarn` (or the bottle's own `earn(dt, scene)`) takes what the Drive already knows (speed,
  the lane under the car and its direction, the nearest car ahead and its offset, the pursuit's hits and
  takedowns this step) and returns what was earned and why (for the HUD).
- Tests: each source alone fills at its rate and only above its threshold, they add up, the bottle never
  passes full, nothing fills while it burns, the oncoming lane counts only on a two-way road, drafting
  needs the car ahead moving and in line.
- Claude's part: the HUD's nitrous bar flashes as it fills and a small word says why (DRAFT, ONCOMING,
  SPEED, TAKEDOWN), from the reason you return. Say the field's name in your report.
