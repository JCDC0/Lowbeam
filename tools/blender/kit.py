"""
Lowbeam modeling kit for Blender (run inside Blender through the MCP or the Python console).

Everything is authored in game coordinates: x to the right, y up, z toward the street (the
model's front faces +z). The kit converts to Blender's z-up frame when it builds and back when it
exports, so a script reads like the game code does.

A model is exported as JSON for src/world/models.js:
  { name, size: [w, h, d], materials: [{ name, color, tex, emissive, tile }],
    groups: [{ material, start, count }], position: [...], normal: [...], uv: [...],
    colliders: [{ x, z, hx, hz, y0, y1 }], lights: [{ x, y, z, c: [r, g, b], range, spot }] }
UVs are box-projected in meters divided by the material's tile, so textures line up across faces
and window bays line up with 3 m floors.

Materials are named by what the game should draw them with: `tex` is one of the game's canvas
textures (window, metal, shutter, concrete, asphalt, sign:<key>) or empty for a plain color;
`emissive` materials are unlit (lamps, signs, lit glass).
"""

import bpy
import bmesh
import json
import math
import os
from mathutils import Vector


def g2b(x, y, z):
    """Game (x, y up, z toward street) to Blender (x, y back, z up)."""
    return Vector((x, -z, y))


def b2g(v):
    return (v.x, v.z, -v.y)


def clear():
    """Empties the scene without resetting Blender (a factory reset stops the MCP server)."""
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)


def mat(name, color, tex='', emissive=False, tile=4.0):
    """A material the exporter understands. color is 0xRRGGBB."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    r = ((color >> 16) & 255) / 255
    g = ((color >> 8) & 255) / 255
    b = (color & 255) / 255
    m.diffuse_color = (r, g, b, 1)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (r, g, b, 1)
    if emissive:
        bsdf.inputs['Emission Color'].default_value = (r, g, b, 1)
        bsdf.inputs['Emission Strength'].default_value = 2.0
    m['lb_color'] = color
    m['lb_tex'] = tex
    m['lb_emissive'] = bool(emissive)
    m['lb_tile'] = float(tile)
    return m


def _obj(name, bm, material):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def box(name, material, cx, cy, cz, w, h, d, yaw=0.0, top=True, bottom=False):
    """A box centered at (cx, cz) with its base at cy, turned by yaw about y."""
    bm = bmesh.new()
    c = math.cos(yaw)
    s = math.sin(yaw)
    pts = []
    for (u, v) in [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]:
        pts.append((cx + u * c + v * s, cz - u * s + v * c))
    lo = [bm.verts.new(g2b(x, cy, z)) for x, z in pts]
    hi = [bm.verts.new(g2b(x, cy + h, z)) for x, z in pts]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([lo[i], lo[j], hi[j], hi[i]])
    if top:
        bm.faces.new(hi)
    if bottom:
        bm.faces.new(list(reversed(lo)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, material)


def poly(name, material, faces):
    """Faces given as lists of game-space points, wound counter-clockwise seen from the front."""
    bm = bmesh.new()
    for f in faces:
        vs = [bm.verts.new(g2b(*p)) for p in f]
        bm.faces.new(vs)
    return _obj(name, bm, material)


def prism(name, material, outline, y0, y1, top=True):
    """Walls up from an outline of (x, z) points (counter-clockwise from above), with a flat top."""
    bm = bmesh.new()
    lo = [bm.verts.new(g2b(x, y0, z)) for x, z in outline]
    hi = [bm.verts.new(g2b(x, y1, z)) for x, z in outline]
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([lo[i], lo[j], hi[j], hi[i]])
    if top:
        bm.faces.new(hi)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, material)


def cylinder(name, material, cx, cy, cz, r, h, sides=8, top=True):
    bm = bmesh.new()
    lo = []
    hi = []
    for i in range(sides):
        a = 2 * math.pi * i / sides
        x = cx + math.cos(a) * r
        z = cz + math.sin(a) * r
        lo.append(bm.verts.new(g2b(x, cy, z)))
        hi.append(bm.verts.new(g2b(x, cy + h, z)))
    for i in range(sides):
        j = (i + 1) % sides
        bm.faces.new([lo[i], lo[j], hi[j], hi[i]])
    if top:
        bm.faces.new(hi)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, material)


def loft(name, material, stations, sides=12, keep=None):
    """
    A smooth body along z from cross sections: each station is (z, yc, hw, hh), an ellipse of half
    width hw and half height hh around height yc. Ends are closed with fans. `keep(zmid, angle)`
    picks which faces this call makes (angle 0 is the right side, pi/2 the top), so one shape can
    be cut into several materials by calling loft once per material.
    """
    bm = bmesh.new()
    rings = []
    for (z, yc, hw, hh) in stations:
        ring = []
        for k in range(sides):
            a = 2 * math.pi * k / sides
            ring.append(bm.verts.new(g2b(hw * math.cos(a), yc + hh * math.sin(a), z)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        zm = (stations[i][0] + stations[i + 1][0]) / 2
        for k in range(sides):
            j = (k + 1) % sides
            am = 2 * math.pi * (k + 0.5) / sides
            if keep and not keep(zm, am):
                continue
            bm.faces.new([rings[i][k], rings[i][j], rings[i + 1][j], rings[i + 1][k]])
    for idx in (0, len(rings) - 1):
        z = stations[idx][0]
        if keep and not keep(z, -1):
            continue
        c = bm.verts.new(g2b(0, stations[idx][1], z))
        for k in range(sides):
            bm.faces.new([rings[idx][k], rings[idx][(k + 1) % sides], c])
    bm.verts.ensure_lookup_table()
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, material)


def collider(cx, cz, w, d, y0=0.0, y1=10.0):
    """A box collider for the game (axis aligned in the model's frame)."""
    e = bpy.data.objects.new('COL', None)
    e['lb_collider'] = [float(cx), float(cz), float(w / 2), float(d / 2), float(y0), float(y1)]
    bpy.context.scene.collection.objects.link(e)
    e.location = g2b(cx, (y0 + y1) / 2, cz)
    e.empty_display_type = 'CUBE'
    e.scale = (w / 2, d / 2, (y1 - y0) / 2)
    return e


def light(x, y, z, color, rng, spot=0):
    """A light the game puts into its light pools. color is linear rgb, can exceed 1."""
    e = bpy.data.objects.new('LIGHT', None)
    e['lb_light'] = [float(x), float(y), float(z), float(color[0]), float(color[1]), float(color[2]), float(rng), float(spot)]
    bpy.context.scene.collection.objects.link(e)
    e.location = g2b(x, y, z)
    e.empty_display_type = 'SPHERE'
    e.empty_display_size = 0.5
    return e


def export(name, path, only=None):
    """
    Writes every mesh in the scene as one model, grouped by material. `only(object_name)` limits it
    to some objects (a helicopter's body and its rotors are separate models so the rotors can spin).
    """
    groups = {}
    order = []
    deps = bpy.context.evaluated_depsgraph_get()
    lo = [math.inf] * 3
    hi = [-math.inf] * 3
    for ob in bpy.context.scene.objects:
        if ob.type != 'MESH' or (only and not only(ob.name)):
            continue
        ev = ob.evaluated_get(deps)
        me = ev.to_mesh()
        me.calc_loop_triangles()
        mw = ob.matrix_world
        nm = mw.to_3x3().inverted().transposed()
        for tri in me.loop_triangles:
            m = ob.material_slots[tri.material_index].material if ob.material_slots else None
            key = m.name if m else 'default'
            if key not in groups:
                groups[key] = {'mat': m, 'pos': [], 'nrm': [], 'uv': []}
                order.append(key)
            gr = groups[key]
            n = (nm @ tri.normal).normalized()
            gn = b2g(n)
            tile = float(m['lb_tile']) if m and 'lb_tile' in m else 4.0
            ax = max(range(3), key=lambda k: abs(gn[k]))
            sign = bool(m and str(m.get('lb_tex', '')).startswith('sign:'))
            if sign:
                # A sign face shows the whole texture: its UVs run 0 to 1 across the face.
                poly_ = me.polygons[tri.polygon_index]
                pts = [b2g(mw @ me.vertices[vi].co) for vi in poly_.vertices]
                us = [(p[0] if ax == 2 else p[2]) * (1 if (gn[2] > 0 if ax == 2 else gn[0] < 0) else -1) for p in pts]
                ws = [p[1] for p in pts]
                u0, u1, w0, w1 = min(us), max(us), min(ws), max(ws)
            for li in tri.loops:
                v = mw @ me.vertices[me.loops[li].vertex_index].co
                p = b2g(v)
                for k in range(3):
                    lo[k] = min(lo[k], p[k])
                    hi[k] = max(hi[k], p[k])
                if ax == 1:
                    u, w = p[0], p[2]
                elif ax == 0:
                    u, w = p[2] * (1 if gn[0] < 0 else -1), p[1]
                else:
                    u, w = p[0] * (1 if gn[2] > 0 else -1), p[1]
                gr['pos'].extend(round(c, 4) for c in p)
                gr['nrm'].extend(round(c, 4) for c in gn)
                if sign:
                    gr['uv'].extend((round((u - u0) / max(1e-6, u1 - u0), 4), round((w - w0) / max(1e-6, w1 - w0), 4)))
                else:
                    gr['uv'].extend((round(u / tile, 4), round(w / tile, 4)))
        ev.to_mesh_clear()
    out = {'name': name, 'size': [round(hi[k] - lo[k], 2) for k in range(3)], 'materials': [], 'groups': [],
           'position': [], 'normal': [], 'uv': [], 'colliders': [], 'lights': []}
    start = 0
    for key in order:
        gr = groups[key]
        m = gr['mat']
        out['materials'].append({
            'name': key,
            'color': int(m['lb_color']) if m and 'lb_color' in m else 0x808080,
            'tex': str(m['lb_tex']) if m and 'lb_tex' in m else '',
            'emissive': bool(m['lb_emissive']) if m and 'lb_emissive' in m else False,
        })
        count = len(gr['pos']) // 3
        out['groups'].append({'material': len(out['materials']) - 1, 'start': start, 'count': count})
        start += count
        out['position'].extend(gr['pos'])
        out['normal'].extend(gr['nrm'])
        out['uv'].extend(gr['uv'])
    for ob in bpy.context.scene.objects:
        if only and not only(ob.name):
            continue
        if 'lb_collider' in ob:
            cx, cz, hx, hz, y0, y1 = ob['lb_collider']
            out['colliders'].append({'x': cx, 'z': cz, 'hx': hx, 'hz': hz, 'y0': y0, 'y1': y1})
        if 'lb_light' in ob:
            x, y, z, r, g, b, rng, spot = ob['lb_light']
            out['lights'].append({'x': x, 'y': y, 'z': z, 'c': [r, g, b], 'range': rng, 'spot': int(spot)})
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    return {'path': path, 'verts': start, 'materials': len(out['materials']), 'colliders': len(out['colliders']), 'lights': len(out['lights'])}


def frame_view():
    """Points the viewport at everything, for screenshots."""
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for region in area.regions:
                if region.type == 'WINDOW':
                    with bpy.context.temp_override(area=area, region=region):
                        bpy.ops.view3d.view_all(center=False)
                    area.spaces[0].shading.type = 'MATERIAL'
            break
