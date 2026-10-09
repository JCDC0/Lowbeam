# C6: Fill the map (Claude, with Gemini's models)

Jc's list (2026-10-09): expand the buildings around the map; a police station in every part of the map
("one per map" is read here as one per district; Jc to confirm); and many more hideouts, gas stations
and repair stations around the island.

## Where it stands

- Buildings: about 10,700 in the city (the nine districts and the outer ring, eleven kinds, merged per
  320 m cell). Outside the Sotokan ring the island is forest, hill, the lake and the Route 1 loop with
  almost nothing built beside it.
- Landmark lots (`LOTS` in `layout.js`): 13. Police: the HQ and the Kitamachi and Toge stations (3);
  garages 5; hideouts 5. Gas stations (`STATIONS`): 4.
- A lot is placed by a search from a hint (`near`, `road`, `side`): on land, flat, 14 m clear of every
  generated street, so adding one moves no street. Each lot kind has one model (`police_hq`,
  `police_station`, `garage`, `hideout`): copies of one model look alike.

## Targets

| What | Now | Target | Notes |
|---|---|---|---|
| Police stations | 10 (done, 0.10.18) | the HQ and one in each of the nine districts (10) | the three that exist count; the others are `police_station` lots; each has a helipad |
| Hideouts | 5 | 12 | spread over the island, some out by the lake, the pass and the port |
| Repair garages | 5 | 12 | at least one in every district, along the avenues |
| Gas stations | 4 | 10 | on Route 1's service roads, the avenues and the pass |
| Buildings | about 10,700 | about 16,000 | the new ones outside the ring, see below |

The districts are Ginza-machi, Shinmachi, Minatomachi, Kitamachi, Higashimachi, Hamacho, Higashi Kogyo,
Kurogane Futo and Nishimachi (`AREA_JP`).

## 1. More lots (Claude)

- A lot generator in `layout.js` (or `lots.js`): from a list of hints per district it finds a spot by the
  existing search, so the 13 stay where they are and the new ones fill the gaps. Placement test: every lot
  on land, flat, clear of every street, none within 250 m of another of its kind, one police station in
  each district, every district within 900 m of a garage.
- The map, the minimap, the GPS and the helicopter's stations take the new lots with no change (they read
  `LOTS` and `STATIONS`); check that nothing assumes three stations (`helipadOf`, the tow, the heli pads
  in `drive.js` are by kind, not by count; the backend confirms).
- Gas stations: more `STATIONS` entries on the same placement rules as the four, each with its own
  name and brand (`gas-station.js` builds the whole layout).

## 2. More buildings (Claude, with Gemini's models for the new kinds)

- Suburbs: houses and walk-ups in lines along Route 18 and the avenues' outer ends, a village at the foot
  of Kuro Pass, a small resort by the lake, houses on the hills above Kitamachi (the hill needs terraces:
  the building mask already counts every road).
- The port and the industrial district: denser warehouses, container yards and gantry cranes, a sea wall.
- New kinds in `buildings.js` and `props.js` (Claude, lofted in code at first): apartment blocks with
  balconies, a temple and a shrine with torii, a school, a multi-storey car park, a pachinko hall. The
  ones that need real modelling go to Gemini as a new brief (`G8`).
- Budgets: keep the world build under 10 s (6 to 8 s now), a downtown view under 150 draw calls, and the
  test suite under 25 s (the new buildings are checked in the existing scatter tests, not new islands).

## 3. Order

1. The lot generator with the test, and the districts' police stations (they use the model that exists),
   and the stakeout spots for B5's hidden undercover cars (`world/stakeouts.js`, pure: about 16 positions
   on lay-bys, side street mouths, car parks and beside the toll plazas, each with a yaw and the road it
   watches, 80 m from a station and clear of every lane).
2. Gas stations, garages, hideouts, then the three model variants of each that Gemini makes (`G8`: two
   more garages, two more hideouts and a second police station in the district style, so copies differ).
3. Suburbs and the village, then the port, then the new building kinds.

Each step is one commit with its tests and a look at the game from the road; none of it waits on Gemini
except the model variants.

## Decided

Jc (2026-10-10): one police station per district, as read above.

## Progress

- Step 1, first part, done in 0.10.18: `tools/lotsearch.mjs` (node tools/lotsearch.mjs check | police),
  `DISTRICTS`, `LOT_ROADS` and `LOT_MARGIN` in `layout.js`, and seven new stations: Ginza, Shinmachi,
  Minatomachi, Higashimachi, Hamacho, Higashi Kogyo, Nishimachi. Ten stations with the HQ, Kitamachi and
  Toge. Kurogane Futo has none of its own (nothing fits in the port's grid) and is served from
  Hamacho's, 390 m away; Kitamachi's own streets leave no frontage, so Route 18's station serves it.
- What the tool teaches for the next kinds: the avenues and the city's frame roads are the only frontage
  there is inside the ring, and they give a spot within 200 to 400 m of a district's center; a pad is
  accepted at 3 m from flat, and the old lots would not pass the tool's own clearance (their streets
  were generated round them), so test the new ones only. To add a kind, add a request beside `police()`
  in the tool (its size, its names, the rule that picks a district) and paste what it prints.
- Step 1, second part, done in 0.10.20: the stakeout spots (`world/stakeouts.js`, `tools/stakeoutsearch.mjs`),
  eighteen: eight lay-bys, four Route 1 shoulders, three toll corners, two side street mouths, the foot of
  the pass. No coin car park: their bays are full of colliders (a spot there would need an empty bay).
- Next: gas stations, garages and hideouts (step 2), then the model variants.
