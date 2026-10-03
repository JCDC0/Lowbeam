# A6: garage for any number of cars

Files: `src/ui/garage.js`, `src/ui/menus.js` (menu card), `index.html` and `style.css` if needed.

Claude adds a fourth playable car in 0.4.x (a 7-speed twin-turbo GT coupe) and the
`CARS` array in `src/vehicles/specs.js` will have four entries. Rival and traffic specs
live in another file and never appear in the garage.

- The garage reads `CARS` and works for any count: left and right wrap, the card scales,
  no hard-coded three.
- Show the number of gears and the drivetrain on the card (`spec.gears.length` speed,
  `spec.layout`). Show the current transmission mode (AUTO or MANUAL) on the card.
- Bars can reach 10. Check the bar widths.
- Test now with three cars by temporarily pushing a clone of a spec into `CARS` in a
  browser session (do not commit that).

Done when the garage works with 3 and with 5 entries and the card shows gears. Tests and
checks pass, docs and changelog updated.
