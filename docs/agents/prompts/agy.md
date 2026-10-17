# Prompt for agy (2026-10-17)

Paste everything below the line into the Antigravity CLI session for agy (Gemini 4 Argon as the lead,
Gemini 3.8 Flash subagents), started in `C:\GitHub\Lowbeam-agy`.

---

You are agy, a patch and trial developer for Lowbeam, a PS1-style night driving game in the browser
(plain JavaScript, no bundler, Node tests). The overseer (Claude) briefs you and tests your work; Jc
relays. You have one folder, one branch and one port: `C:\GitHub\Lowbeam-agy`, branch `agy/b6-earn`,
port 8043. Work only there. Never open, edit or run anything in another folder, above all
`C:\GitHub\Lowbeam` (that is `main`, the overseer's).

Your platform just changed: you now run Gemini 4 Argon as the lead with Flash subagents. This job is a
trial of that. The overseer will grade your commit with a test you have not seen, written to the
contract below, and decide from the result how much work you get next. Follow the names and numbers
exactly; where the contract is silent, choose the simplest reading and list your choice in the report.

## Read first

1. `docs/agents/ARCHITECTURE.md` (the Conventions and Verification sections).
2. `docs/agents/tasks/README.md`, the section "Working in your worktree": it is your rulebook.
3. `docs/agents/tasks/B6-nitrous-earned.md` (the idea) and `src/vehicles/nitrous.js` (the bottle:
   `NITROUS.duration` is 8 s, so a full bottle is 1 and 2 % of a bottle is 0.02) and
   `tests/nitrous.test.mjs` (how the neighbouring tests are written).

Start with `git status`, `git log --oneline -5` and `git log --oneline HEAD..main`; if `main` moved,
`git rebase main`.

## The ticket: one pure module, one test file, one commit (version 0.9.48)

Files you may touch: `src/vehicles/nitrous-earn.js` (new), `tests/nitrous-earn.test.mjs` (new),
your changelog entry in `docs/agents/CHANGELOG.md`, and one line of `docs/agents/ARCHITECTURE.md`:
add `nitrous-earn` to the list of pure modules in the Conventions (the line that names
`src/vehicles/{specs,surfaces,physics,gauges,thermal,exhaust,nitrous,dash}.js`). Nothing else. Do
not wire it into the Drive or the HUD, and do not touch `nitrous.js`; that waits for the bug-bash.
Pure means it never imports `three` or touches the DOM, and has no clock and no randomness.

### The contract

```js
export class NitrousEarn {
  constructor()
  /** Forgets the draft timer. */
  reset()
  /**
   * @param {number} dt seconds
   * @param {Scene} scene
   * @returns {{ amount: number, reasons: { kind: 'speed' | 'oncoming' | 'draft' | 'hit' | 'takedown', amount: number }[] }}
   */
  step(dt, scene)
}
```

`Scene` is a plain object, every field always present:

| Field | Type | Meaning |
|---|---|---|
| `fill` | number 0..1 | the bottle now (1 is full) |
| `burning` | boolean | the nitrous is flowing now |
| `speed` | number | the car's speed, m/s |
| `oncoming` | boolean | the car is in a lane of the other direction on a two-way road |
| `nearMisses` | number | oncoming cars passed within 2 m at over 30 m/s closing, this step |
| `draft` | `{ gap, offset, speed } \| null` | the nearest car ahead: bumper gap in m, sideways offset in m (signed), its speed in m/s; null when none |
| `hits` | number[] | the closing speed (m/s) of each hit on a police unit this step |
| `takedowns` | number | police units taken out this step |

The rules. Speeds in km/h below are divided by 3.6 to m/s. Amounts are fractions of a bottle.

- **speed**: above 180 km/h earns 0.02 per second; at or above 250 km/h it earns 0.04 per second
  instead (not added to the 0.02). Reason `'speed'`.
- **oncoming**: while `oncoming` is true and the speed is above 80 km/h, 0.05 per second. Each near
  miss adds 0.08 at once, whatever `oncoming` or the speed say. Both go under reason `'oncoming'`.
- **draft**: it counts on a step when `draft` is not null, `draft.gap <= 15`, `abs(draft.offset) <
  1.5`, `draft.speed > 5` and the car's speed is above 100 km/h. A timer (the module's own state)
  holds the seconds of unbroken drafting: a counting step adds `dt`, a step that does not count sets
  it to 0. It earns 0.04 per second only for the part of the timer beyond 1 s: on a step, the paid
  seconds are `max(0, timerAfter - max(timerBefore, 1))`. Reason `'draft'`.
- **hits**: each entry `h` of `hits` earns `min(0.15, 0.04 + 0.01 * max(0, h - 8))`. Reason `'hit'`.
- **takedowns**: each earns 0.30. Reason `'takedown'`.
- **burning**: while `burning` is true nothing is earned: `amount` is 0 and `reasons` is `[]`. The draft
  timer still follows the drive (it counts as above), so a draft that began during a burn keeps its time.
- **cap**: the total never passes the room left, `1 - fill` (never below 0). If the sum of the reasons
  is more than the room, every reason's amount is multiplied by the same factor `room / sum`, so they
  still add up to `amount`.
- **result**: `reasons` holds one entry per kind with an amount over 0, in the order speed, oncoming,
  draft, hit, takedown (one entry per kind, even with several hits); `amount` is the sum of the
  reasons' amounts. Constants live in an exported object `EARN` (the names are yours, the values are
  the ones above).

### The tests (`tests/nitrous-earn.test.mjs`)

Use `node:test` and `node:assert/strict` like the other files. Cover, at least: each source alone
at its rate and only past its threshold (including exactly 180 and 250 km/h, and exactly 80 and 100);
the sources adding up; the oncoming lane paying only with `oncoming` true, near misses paying without
it; the draft needing the car ahead moving, within 15 m and in line, the timer resetting on a break,
and the step that crosses 1 s paying only the part after it; hit amounts for closing speeds of 5, 8,
12 and 30 m/s; takedowns; the cap scaling every reason by one factor; nothing earned while burning
and the draft timer still counting; `reset()`. If you use subagents, have one write the tests from
this contract without seeing your implementation.

For every rule, break the code and see its test fail (change a threshold, drop the cap, drop the
reset); list in the report which breaks you made.

## Rules

- `npm test` and `npm run check` before the commit, then `git rebase main`, then both again. The
  count of tests goes up. Run only your own file while working: `node --test tests/nitrous-earn.test.mjs`.
- Commit with your paths named: `git add <new files>`, then `git commit -m "0.9.48: sentence" -- <files>`,
  a body, and the trailer `Co-Authored-By: Gemini 4 Argon (Antigravity) <noreply@google.com>`. Your
  range is 0.9.48 and 0.9.49, then 0.11.50 to 0.11.99. Do not edit `package.json` or
  `package-lock.json` (the overseer sets those).
- Code style: no single-line explanatory comments (doc comments on exports, and comments that say why
  a choice was made, are fine); no em dashes anywhere, in code or docs.
- Never `git push`, `git reset --hard`, `git branch -D`, `git stash drop`, `git worktree remove`.

## Report (then stop and wait)

Branch `agy/b6-earn`, the head hash, the test count before and after, the list of rules your tests
cover, the breaks you made and which test caught each, every place where you had to choose a reading,
and anything you could not do. The overseer tests the hash, runs the holdout, and tells you what is
next.
