# Prompt for OpenCode (2026-10-17)

Paste everything below the line into OpenCode, started in `C:\GitHub\Lowbeam-opencode`, on whatever
model Jc chose from the Go plan (write it in `docs/agents/tasks/README.md`'s team table afterwards).

---

You are OpenCode, a ticket developer for Lowbeam, a PS1-style night driving game in the browser (plain
JavaScript, no bundler, Node tests). The overseer (Claude) briefs you and tests your work; Jc relays.
You have one folder, one branch and one port: `C:\GitHub\Lowbeam-opencode`, branch
`opencode/gps-turns`, port 8045. Work only there. Never open, edit or run anything in another folder,
above all `C:\GitHub\Lowbeam` (that is `main`, the overseer's).

This is your first job and a trial of the platform: one ticket, one commit. Do exactly what is below.
If a step fails twice, stop and report what you saw.

## Read first (in this order)

1. `docs/agents/ARCHITECTURE.md` (the Conventions and Verification sections).
2. `docs/agents/tasks/README.md`, the section "Working in your worktree": it is your rulebook.
3. `src/ui/route.js` (all of `routeTo`), `tests/island/route.test.mjs` (`createMockNet` shows how to
   build a small hand-made net) and, only to read, `TrafficNet.route` and `TURN_COST` in
   `src/traffic/net.js`.

Start with `git status`, `git log --oneline -5` and `git log --oneline HEAD..main`; if `main` moved,
`git rebase main`. `node_modules` here is a link to `main`'s: do not run `npm install`.

## The ticket: X-03, the GPS route has no turn cost (version 0.12.50)

The problem. The traffic router (`TrafficNet.route`) charges 8 m (`TURN_COST`) for every turn, so cars
do not zigzag for nothing. The GPS router (`routeTo` in `src/ui/route.js`) charges nothing: a link
costs only the distance driven to reach it (`distAlong`). On a street grid many routes are almost
equal, so the GPS picks a staircase of side streets when a straight route is a few meters longer. The
overseer saw it on the island: with CCC's coming junction rework the Ginza to Dori test route goes from
14 lanes (straight) to 24 lanes (a staircase) to save 6 m of 6,099.

The change, in `src/ui/route.js` only:
- `export const GPS_TURN_COST = 8;` with a doc comment saying it equals `TURN_COST` in
  `src/traffic/net.js` (which is not exported; do not edit `net.js`, another branch is changing it).
- `routeTo(net, from, to, { turnCost = GPS_TURN_COST } = {})`. A link whose `kind` is `'turn'` or
  `'exit'` adds `turnCost` to the cost of taking it; a link of kind `'end'` (a lane flowing on into the
  next) adds nothing. The A* heuristic stays the straight-line distance, which is still admissible.
- `turnCost: 0` must reproduce today's behaviour exactly.
- The returned route also gets `turns`: how many `'turn'` or `'exit'` links it takes.
- Leave `RouteTracker` and everything else in the file alone; the default turn cost applies to it.

The tests (new file `tests/island/route-turns.test.mjs`, imported by one new line in
`tests/island-roads.test.mjs` next to `./island/route.test.mjs`):
1. A mechanism test on a tiny hand-made net (build it the way `createMockNet` does, in your own file):
   a start lane and a target lane joined two ways, one straight (a lane whose `'end'` link lands on the
   target, 100 m, no turns) and one a staircase of four `'turn'` links (about 98 m). With
   `turnCost: 0` the staircase must win; with the default the straight one must win. Check by the lane
   lists, not only the length.
2. Island properties on the shared island (`island()` and `trafficNet()` from `tests/island.mjs`):
   for the pair `STATIONS[0]` to the police HQ (as the existing test builds it) and two more pairs of
   your own, using `STATIONS` and `LOTS` from `src/world/layout.js`: with the default cost the route has
   `turns` at most those of the `turnCost: 0` route, and its `length` is at most 1.02 times the
   `turnCost: 0` route's length. `turnCost: 0` gives a route with the same lane ids as the old code
   (record them from `main` before you edit and assert them in the test).
3. `tests/island/route.test.mjs` is also being edited by CCC (it replaces its lane count pin). Edit it
   only if its "bounded search" test fails with your change, and then only the numbers, with the
   measured reason in a comment; the overseer settles the merge.

Break the code to see each test fail (drop the turn cost, charge `'end'` links too, make the default
0), and list in your report which breaks you made.

## Files you may touch

`src/ui/route.js`, `tests/island/route-turns.test.mjs` (new), `tests/island-roads.test.mjs` (one import
line), `tests/island/route.test.mjs` (see 3), your changelog entry in `docs/agents/CHANGELOG.md`, and
the lines of `docs/agents/ARCHITECTURE.md` your change makes untrue (probably none). Nothing else; not
`package.json` or `package-lock.json` (the overseer sets those).

## Rules

- `npm test` and `npm run check` before the commit, then `git rebase main` (the only conflict you can
  meet is `docs/agents/CHANGELOG.md`: keep both entries, newest first, delete the markers, `git add`
  it, `git rebase --continue`; any other conflict: `git rebase --abort` and report), then both again.
  While working, run only your files: `node --test tests/island/route-turns.test.mjs` (5 s or more:
  it builds the island).
- Commit with your paths named: `git add <new files>`, then `git commit -m "0.12.50: sentence" --
  <files>`, a body, and the trailer `Co-Authored-By: OpenCode <noreply@opencode.ai>`. Your range is
  0.12.50 to 0.12.99.
- Code style: no single-line explanatory comments (doc comments on exports, and comments that say why
  a choice was made, are fine); no em dashes anywhere, in code or docs.
- Never `git push`, `git reset --hard`, `git branch -D`, `git stash drop`, `git worktree remove`.

## Report (then stop and wait)

Branch `opencode/gps-turns`, the head hash, the test count before and after, and a table for the three
pairs: lanes, `turns`, length and A* expansions at `turnCost` 0 and at the default; the breaks you made
and which test caught each; anything you could not do. The overseer tests the hash, checks it again on
`main` once CCC's 0.11.0 is merged (that is where the staircase shows), and tells you what is next.
