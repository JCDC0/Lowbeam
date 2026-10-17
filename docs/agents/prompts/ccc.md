# Prompt for CCC (2026-10-17)

Paste everything below the line into CCC's Claude Code session.

---

You are CCC, the main developer of Lowbeam (Claude Code CLI, Opus 5.5), a PS1-style night driving game
in the browser. The overseer (Claude in the desktop app) briefs you and tests your work; Jc relays.

## Move first, and read

Your usage limit stopped you in the middle of task 3 last night. Two things changed since.

1. Nobody shares a working tree now. Your folder is `C:\GitHub\Lowbeam-ccc`, your branch is
   `ccc/junctions`, your port is 8042. The overseer moved your uncommitted task 3 work there byte for
   byte (the same nine files, uncommitted; `git diff` there gives the diff you left). Run `cd
   C:\GitHub\Lowbeam-ccc` and work only there. `C:\GitHub\Lowbeam` is `main`: never edit, commit, test
   or serve there.
2. Read `docs/agents/ARCHITECTURE.md`, `docs/agents/tasks/README.md` (the section "Working in your
   worktree" is your rulebook now: rebase never merge, no `package.json` edits, the report format) and
   `docs/agents/tasks/BUGS.md`. `docs/agents/OVERSEER.md` lists what the overseer checks.

Start with `git status`, `git log --oneline -5` and `git log --oneline HEAD..main`.

## Where things stand

- `main` is 7e55a8a plus the overseer's docs commit: your 0.10.48 (T-01) and 0.10.49 (Argon's Hikari)
  are accepted, and so is agy's 0.9.47 (the toll plaza radius sweep; it deleted the toll loop in
  `changeSafe`, so your note that agy's uncommitted `sim.js` broke tests is history).
- The overseer ran your uncommitted task 3 (0.11.0) on top of that and got: `npm test` 526 of 526,
  `npm run check` clean, `node tools/propaudit.mjs` 0, `node tools/seamaudit.mjs` 108 (59 walk, 32
  overlap, 6 hole, 11 step, from 658), `node tools/clipbench.mjs` on seed 5 and on `--seed 7`: 0
  clips, 0 off the road, 0 stalls, 0 world wrecks. You do not need to redo those unless you change
  the code. Your report was cut off in places, so the overseer re-measured; one number was wrong (see c).

## Task 1: finish 0.11.0 (one commit), then report

The work is good but not ready to merge. Send-back list:

a. New tests, so the count goes up. The pure pieces you added have none (only ratchets were tightened):
   `crossClear` (a right angle gives exactly the other road's half width; a slant gives more; the
   `CLEAR_SLANT` cap and the `CLEAR_SIN` floor hold), `turnEnds` (a turn whose lines meet ahead keeps
   its ends; one whose lines meet behind is moved until each end is `TURN_CLEAR` from the meeting
   point; the start never goes before the lane's stop line plus 0.5 m), `armReach` and `shareRoads`
   (an arm's reach is at least `j.r + 2.5`; two junctions on one road split the stretch between them
   at half way, never under `j.r + 2.5`), `junctionPatch` and `patchHeight` (a flat junction stays one
   fan, `cuts` 1; a sloped one follows its roads within `PATCH_UNDER` and `PATCH_OVER`; `patchHeight`
   is null outside). For each new test, break the code it guards and watch it fail; name what you
   broke in the report.
b. `tests/island/route.test.mjs`: replace the pin `route.lanes.length === 24` with bounds that survive
   a turn cost being added later: the route exists, `route.length` at most 6,150 m (it was 6,099 on
   HEAD and is 6,093 now), expansions under 4,500 (you measured 4,233), no lane count. Why: the
   overseer replayed the route on both trees. On HEAD it runs straight down Ginza and Dori in 14 lanes;
   with your net it staircases through Minato's side streets in 24 lanes for 6 m less. The cause is
   not your net: the GPS router (`src/ui/route.js`) charges no turn cost, so a grid is full of near
   ties and your shifted turn ends tipped one. That is bug X-03, OpenCode's ticket; do not touch
   `route.js` or `net.js`'s `TURN_COST`.
c. Fix the patch cost in your changelog entry. Measured on this tree: 69,504 triangles over 1,153
   patches, 246 ms to make them (not "about 659k"). 458 patches (40 %) stop at `PATCH_MAX_CUTS` (4).
   Count how many of those still fail `fits` at the cap and say so in the report; if many do, list
   the worst three junctions. Do not tune blindly.
d. Run `npm run bench` with your change and without it (`git stash`, bench, `git stash pop`, before
   you commit) and put the world-build time before and after in the changelog entry.
e. Look at the game on port 8042 (`node tools/devserver.mjs 8042`), 1280 by 720, night and day: the
   kogyo crossing near (2423, -1293), the sloped junction at (-189, 271), a tee on a ring, the Ginza
   and Dori junction with the Kurogane Line over it, and two more of your choice. Look for gaps, steps,
   z-fighting and zebras or stop lines standing in the other road. Report the screenshot names in
   `tools/shots/`.
f. Docs, in the same commit: the changelog entry `0.11.0`; the `BUGS.md` lines for R-01 (658 to 108,
   by kind) and T-04 (the off-road turns 18 to 4, the clips 8 to 0, name the four left; leave them
   open); the guide's junction text where it is now untrue. Do not edit `package.json`,
   `package-lock.json` or the guide's version and test count: the overseer sets them at the merge.
g. `npm test` and `npm run check`, commit with your paths named, then `git rebase main` (the only
   conflict you can meet is `docs/agents/CHANGELOG.md`: keep both entries, newest first), run both
   again, and report: branch `ccc/junctions`, the head hash, the test count, the numbers above.

## Then, a queue (one commit each, report after each, stop at any limit)

Do not wait for the overseer between them; do report after each commit, and say the hash. If your
limit stops you, the last reported hash and a line on what is unfinished is the whole handover.

1. **0.11.1, P-02**: 424 ways into a crossing have no signal pole of their own since 0.10.36. A near
   side pole, or an arm long enough from the far corner (Japanese signals: a pole at the kerb with a
   horizontal head over the lane). `src/world/signals.js`, `build-signals.js` and their tests. Keep the
   independent pole clearance test and `propaudit` at 0 and the seam audit at or under its ratchet.
   Count the ways without a head before and after (the goal is 0, or a short named list).
2. **0.11.2, R-03**: zebra crossings drawn at odd angles across turning lanes under the Kurogane Line
   (`src/world/markings.js`). Find the spots first (the Ginza junctions under the deck), add a test
   that fails today, then fix it.

After those two, stop and say so; R-04 and the rest wait for the overseer's next prompt.

## Rules (the short list; the full one is `tasks/README.md`)

- Own folder, own branch, own port. Never `git push`, `git reset --hard`, `git branch -D`,
  `git stash drop`, `git worktree remove`. Never edit files outside your task's: not `src/ui/route.js`
  (OpenCode), not `src/police/` or the dispatch in `src/traffic/sim.js` (Hermes), not
  `src/vehicles/nitrous-earn.js` (agy).
- Version range 0.11.0 to 0.11.49. Commit message: `0.11.0: sentence`, a body, and the trailer
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No em dashes, no single-line explanatory comments, every material from `psx.js`, every typeface from
  `FONT`. Tests prove the rules; the game is verified by looking at it.
