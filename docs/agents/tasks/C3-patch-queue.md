# C3: Claude's patch queue (from Jc's test drive, 2026-10-08)

Small features and fixes in Claude's files, in order. The backend half of the same list is B2; the
models are G5 and G7.

1. **The Kurogane Line's median** (done in 0.9.81): its barrier was missing, so a car crossed the
   median and fell through where the ramps fork.
2. **Most Wanted's radar** (done in 0.9.83). The minimap restyled after Jc's reference: a dark disc, grey roads, the
   sea and the river in blue; the heat as a flame icon with "x N" at the top left outside the disc;
   the rim an amber arc filling with the heat's progress to the next level (red and blue in a
   pursuit as now). New icons for the stations, garages, hideouts, gas and the race starts. Police
   markers simpler: a car is a small red or blue chevron by its light bar's phase, a helicopter a
   plain disc with a short tail (no spinning lines); a unit's sight is a cone in its own red or blue
   that fades out with distance, not the flat yellow wedge.
3. **The pursuit HUD after Jc's sketch** (done in 0.9.84). Above the panel a row of the units on the scene by kind
   with an icon each (cruiser, unmarked, interceptor, Rhino) and the helicopters; in the panel the
   units on the scene, the units assigned (B2 part 6; a dash until it lands) and the units
   destroyed, the meter along the bottom; a REINFORCEMENTS line when they come.
4. **HUD overlay** (done in 0.9.85). A fine fishnet (a diagonal mesh) over the HUD panels, a vignette that closes in
   at high speed and a slight radial blur past about 200 km/h; each a toggle in Settings (on by
   default), saved with the settings.
5. **Skid marks and tire smoke** (done in 0.9.87) for every car: the player's, the traffic's, the racers' and the
   police: dark marks laid on the road where a tire slides (the player from the physics' slip, the
   others from their sideways speed and their turn), fading over about 40 s, and a light smoke trail
   in a hard slide.
6. **More places** (done in 0.9.88). Two more police stations (Gemini's district station model from G7, the HQ model
   until it lands), more hideouts and repair garages spread over the island (the existing models), on
   the map and the minimap with their icons. B2 part 7 makes the police use the nearest station.
7. **Banners for B2's events** as they land: reinforcements, a helicopter leaving to refuel and
   coming back.
