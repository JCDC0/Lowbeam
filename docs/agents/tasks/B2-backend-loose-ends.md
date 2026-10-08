# B2: Backend loose ends (Backend)

For the backend seat (Hermes). Small, exact jobs in backend files, each with a test that proves it.
Read `docs/agents/ARCHITECTURE.md` and `docs/agents/tasks/README.md` first. Claude has been working
in these files while the seat was empty (C2, up to 0.9.80): pull first and read the code as it is
now, not as an older brief describes it.

Versions: 0.9.20 to 0.9.49 are yours and none is used yet. One commit per part, starting at 0.9.20.
A commit numbered below `package.json` (which holds 0.9.80 or higher) adds its changelog entry in
version order and leaves `package.json` and `package-lock.json` alone (README, "The version bump").
Stage your files by name, never `git add -A`; Gemini and Claude commit in the same tree.

## 1. The Hikari among the street racers (0.9.20)

`RIVALS` in `src/traffic/kinds.js` leaves out the Hikari 300ZR (`CARS.filter((c) => c.id !== 'hikari')`)
because adding a kind reshuffles every seeded pick, and two tests in `tests/traffic.test.mjs` sit
close to their limits with the current picks:

- `during any lane change the heading differs from the lane tangent by between 1 and 12 degrees...`
- `fewer than one civilian lane change in ten is reversed within 6 s`

(and check `over 3 minutes headless with traffic, racers average above 180 km/h...` too).

Do it in this order:
1. Remove the filter so the Hikari is a racer (`rv-hikari`), and run the tests. Note which fail and
   by how much (print the measured values).
2. Make each failing test robust, not lucky: run it over several seeds and assert on the worst or
   the mean with the limit the test's name states, or find the real cause if one seed is far out
   (a lane change that really is too sharp is a bug in `sim.js`, not a test to loosen). Never widen
   a limit the test's title promises; if a limit must change, change the title and say why in the
   changelog.
3. The racer engine voice: `VOICE_OF` in `src/audio/traffic-voices.js` maps racer ids to a voice
   class; the Hikari is a straight-six turbo (`racer` is right, or add `'rv-hikari': 'six'` if it
   sounds closer, your call, with a test line).
4. Remove the "The Hikari is left out of `RIVALS`" item from Open work in `ARCHITECTURE.md` and the
   sentence "The Hikari is not among the racers yet" in its Traffic paragraph.

Done when: the Hikari spawns on Route 1 (a test that `RIVALS` holds `rv-hikari` and that a seeded sim
with enough racer spawns places one), the lane change tests pass over several seeds, `npm test` and
`npm run check` are clean.

## 2. The route planning test measures the machine (0.9.21)

`tests/route.test.mjs`, `cross-island route plans in under 30 ms in Node`, times one call with
`performance.now()` and fails when the machine is busy (a known issue in `ARCHITECTURE.md`). Replace
the wall-clock bound with something the machine cannot change:

- Count the work: have `route` in `src/traffic/net.js` (or `routeTo` in `src/ui/route.js`, which is
  Claude's: if the counter must live there, say so in your report and Claude adds it) report how many
  lanes it expanded, and assert the cross-island plan expands under a bound you measure now plus
  50 %.
- Keep a timing check only as a generous guard (the median of 9 runs under 60 ms), so a real
  slowdown is still caught.

Done when: the test passes with the CPU busy (run `npm test` twice in parallel to prove it), and the
known issue is removed from `ARCHITECTURE.md`.

## 3. A unit's damage shows in how it drives (0.9.22)

Today a hurt unit only limps below a quarter of its hit points (`DAMAGE.limp` in
`src/police/units.js`, read by `pursuitSpeed` in `src/traffic/sim.js`). Make the damage felt before
that, after Most Wanted, where a battered cruiser wobbles and drops back:

- Between half and a quarter of its hit points a unit's top speed falls smoothly from 100 % to 85 %,
  then to `DAMAGE.limpSpeed` (70 %) below a quarter, with no step at the boundaries.
- Below half, a unit driving free (`stepChase`) steers with a small slow wobble (a sine of about
  0.15 rad at 0.6 Hz, its phase from the unit's id), so it visibly struggles to hold a line.
- A pure helper in `src/police/units.js` (`damagedTop(kind, hp)` or similar) that `sim.js` calls, and
  tests: full health is full speed, the curve is continuous and never rises as hp falls, a destroyed
  unit (hp 0) is not asked.

Done when: the tests pass, and `ARCHITECTURE.md` (the Police paragraph, where the limp is described)
and the changelog say what changed.

## Report

After each part: the commit hash, what changed, the test counts, the measured numbers (part 1: the
values each test saw before and after; part 2: the expansions and the timings; part 3: the curve),
and anything you need from Claude's files. Stop after part 3 for Claude's review.
