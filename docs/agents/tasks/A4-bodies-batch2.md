# A4: vehicle bodies, batch 2 (assets only)

Start after batch 1 (A3) has been reviewed by Claude and the user. Same rules, format,
budgets and files as A3.

## Rivals (6 more)

V8 drift sedan (long hood, flared arches), twin-turbo wedge GT (low, pop-up lights, big
wing), retro hardtop (a 1970s two-door with chrome), mid-engine kei roadster, widebody
tuner (wide fenders, deep front lip), hypercar (low, wide, huge rear diffuser).

## Civilians (4 more)

Second sedan (different silhouette), SUV, pickup truck, minivan.

## Vans (2)

Panel van, minibus.

## Trucks (5 plus a bus)

Kei truck (tiny cab, flat bed), 4 t box truck, flatbed, tanker, semi (cab and a separate
trailer body, two meshes, trailer follows the cab; budget 1000 triangles total), city bus.
These are box-like: build them with `MeshBuilder` boxes and cylinders (`Kit` helpers where
useful) instead of the car loft. Traffic budget applies (700 triangles) except the semi
and the bus (1000).

## Done when

All bodies appear in `tools/bodies.html`, `shot('bodies-2')`, test passes for budgets and
anchors, docs and changelog updated.
