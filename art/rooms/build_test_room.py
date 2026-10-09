"""
Salas de prueba (Fases 2 y 3).

Genera desde cero, con cajas texturizadas, dos salas que siguen la convención de nombres
de PLAN.md §6.2 y las exporta como GLB para el juego:

- hall:      sala en forma de L con los 4 destacados, el libro con la bio y una puerta
             a la sala de guardado.
- save-room: sala pequeña con la máquina de escribir (contacto), curiosidades y la
             puerta de vuelta al hall.

Cómo usarlo
-----------
- Desde Blender: abrir la pestaña *Scripting*, cargar este archivo y pulsar *Run Script*.
- Sin interfaz:   blender -b -P art/rooms/build_test_room.py

Resultado:
- art/rooms/test_room.blend, save_room.blend           (fuentes editables; no se publican)
- public/models/rooms/test_room.glb, save_room.glb     (lo que carga el juego)

Si editas la sala a mano en el .blend, exporta tú el GLB (File > Export > glTF 2.0,
formato GLB, +Y Up, Cameras y Punctual Lights activados, Lighting Mode = Raw, Apply
Modifiers) a la misma ruta y NO vuelvas a correr este script, porque reconstruye las salas
desde cero.

Convención (PLAN.md §6.2)
-------------------------
COL_*            colisión (invisible en el juego)
CAM_<n>          cámara fija
TRG_CAM_<n>      volumen que activa CAM_<n>
INT_<id>         objeto examinable: un proyecto de projects.json (un hijo con el material
                 MAT_Cover recibe la portada) o un documento del perfil: about, contact, trivia
DOOR_<roomId>    puerta hacia otra sala (rooms.json)
TRG_CAM_<n>_<x>  volúmenes extra para la misma cámara (p. ej. TRG_CAM_2_entrada)
SPAWN_<roomId>   punto de aparición al llegar desde esa sala; SPAWN_default para el inicio
                 (Empty; su flecha, +Z local, indica hacia dónde mira)
Las luces puntuales se exportan tal cual (modo RAW: la potencia en W = intensidad en Three.js).
Coordenadas de Blender: Z arriba, 1 unidad = 1 m.
"""

import math
import os
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Vector

# --------------------------------------------------------------------------------------
# Rutas
# --------------------------------------------------------------------------------------

def repo_root():
    here = None
    if "__file__" in globals() and os.path.isfile(__file__):
        here = os.path.dirname(os.path.abspath(__file__))
    elif bpy.data.filepath:
        here = os.path.dirname(bpy.data.filepath)
    if here is None:
        sys.exit("Guarda el script en art/rooms/ o ejecútalo con blender -b -P")
    return os.path.normpath(os.path.join(here, "..", ".."))


ROOT = repo_root()

# --------------------------------------------------------------------------------------
# Escena limpia (una por sala)
# --------------------------------------------------------------------------------------

scene = None
COLLECTIONS = {}
MAT = {}


def new_scene():
    global scene, MAT
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.render.resolution_x = 320
    scene.render.resolution_y = 240
    COLLECTIONS.clear()
    MAT = make_materials()


def collection(name):
    if name not in COLLECTIONS:
        col = bpy.data.collections.new(name)
        scene.collection.children.link(col)
        COLLECTIONS[name] = col
    return COLLECTIONS[name]


# --------------------------------------------------------------------------------------
# Texturas procedurales (64×64, paleta corta, filtrado Closest)
# --------------------------------------------------------------------------------------

RNG = np.random.default_rng(7)
S = 64


def noise(scale=1.0):
    return RNG.random((S, S)) * scale


def to_image(name, rgb):
    """rgb: array (S, S, 3) en 0..1, fila 0 = arriba de la imagen."""
    img = bpy.data.images.new(name, S, S, alpha=False)
    rgba = np.ones((S, S, 4), dtype=np.float32)
    # Cuantizar a 5 bits por canal, como las texturas de 15 bits de la época.
    rgba[..., :3] = np.round(np.clip(rgb, 0, 1) * 31) / 31
    img.pixels.foreach_set(np.flipud(rgba).ravel())  # Blender guarda de abajo hacia arriba
    img.pack()
    return img


def tex_floor():
    # Baldosas 2×2 por metro, piedra gris verdosa con mugre y juntas oscuras.
    y, x = np.mgrid[0:S, 0:S]
    tile = ((x // 32) + (y // 32)) % 2
    base = np.where(tile[..., None], [0.30, 0.31, 0.27], [0.22, 0.23, 0.21])
    grime = noise(0.10)[..., None] - 0.05
    grout = ((x % 32) < 1) | ((y % 32) < 1)
    rgb = base + grime
    rgb[grout] = [0.09, 0.09, 0.08]
    return rgb


def tex_wallpaper():
    # Papel tapiz verde desvaído con franjas verticales y manchas de humedad.
    y, x = np.mgrid[0:S, 0:S]
    stripe = ((x // 8) % 2).astype(float)
    base = np.array([0.20, 0.25, 0.18]) + stripe[..., None] * np.array([0.04, 0.05, 0.03])
    dots = ((x % 16 == 12) & (y % 16 == 8))
    rgb = base + (noise(0.06)[..., None] - 0.03)
    rgb[dots] = [0.36, 0.33, 0.20]
    damp = np.clip(1.0 - (y / S) * 1.6, 0, 1) * noise(0.08)
    return rgb - damp[..., None]


def tex_wainscot():
    # Zócalo de madera: tablas verticales con moldura arriba.
    y, x = np.mgrid[0:S, 0:S]
    base = np.array([0.24, 0.14, 0.08])
    grain = np.sin((x * 0.9) + RNG.random(S)[None, :] * 3) * 0.02
    rgb = base + grain[..., None] + (noise(0.05)[..., None] - 0.025)
    rgb[(x % 16) == 0] = [0.10, 0.06, 0.03]
    rgb[y < 5] = [0.32, 0.20, 0.11]
    rgb[y == 5] = [0.08, 0.05, 0.03]
    return rgb


def tex_wood():
    y, x = np.mgrid[0:S, 0:S]
    rings = np.sin(y * 0.55 + np.sin(x * 0.15) * 2.0) * 0.03
    rgb = np.array([0.20, 0.11, 0.06]) + rings[..., None] + (noise(0.04)[..., None] - 0.02)
    rgb[(y % 21) == 0] = [0.08, 0.04, 0.02]
    return rgb


def tex_ceiling():
    rgb = np.array([0.16, 0.15, 0.14]) + (noise(0.05)[..., None] - 0.025)
    y, x = np.mgrid[0:S, 0:S]
    rgb[(x % 32 == 0) | (y % 32 == 0)] = [0.10, 0.10, 0.09]
    return rgb


def tex_crate():
    y, x = np.mgrid[0:S, 0:S]
    rgb = np.array([0.33, 0.24, 0.13]) + (noise(0.06)[..., None] - 0.03)
    rgb[(y % 16) == 0] = [0.15, 0.10, 0.05]
    border = (x < 5) | (x > S - 6) | (y < 5) | (y > S - 6)
    rgb[border] = [0.25, 0.17, 0.09]
    diag = np.abs(x - y) < 3
    rgb[diag & ~border] = [0.27, 0.19, 0.10]
    return rgb


def tex_door():
    y, x = np.mgrid[0:S, 0:S]
    rgb = np.array([0.17, 0.08, 0.05]) + (noise(0.04)[..., None] - 0.02)
    for (x0, x1, y0, y1) in [(8, 28, 6, 28), (36, 56, 6, 28), (8, 28, 36, 58), (36, 56, 36, 58)]:
        rgb[y0:y1, x0:x1] = [0.13, 0.06, 0.04]
        rgb[y0:y1, x0] = rgb[y0, x0:x1] = [0.24, 0.12, 0.07]
    return rgb


def tex_metal():
    rgb = np.array([0.13, 0.13, 0.14]) + (noise(0.05)[..., None] - 0.025)
    y, x = np.mgrid[0:S, 0:S]
    rgb[(y % 16) == 0] = [0.20, 0.20, 0.21]
    return rgb


def tex_book():
    y, x = np.mgrid[0:S, 0:S]
    rgb = np.array([0.30, 0.07, 0.06]) + (noise(0.05)[..., None] - 0.025)
    rgb[(x < 4) | (x > S - 5) | (y < 4) | (y > S - 5)] = [0.45, 0.36, 0.16]
    return rgb


def tex_paper():
    y, x = np.mgrid[0:S, 0:S]
    rgb = np.array([0.80, 0.76, 0.64]) + (noise(0.05)[..., None] - 0.025)
    lines = ((y % 6) == 0) & (x > 6) & (x < S - 6) & (RNG.random((S, S)) > 0.25)
    rgb[lines] = [0.30, 0.28, 0.25]
    return rgb


def tex_cover_placeholder():
    rgb = np.full((S, S, 3), 0.1) + noise(0.1)[..., None]
    return rgb


def material(name, rgb, emission=0.0):
    img = to_image("T_" + name[4:], rgb)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Closest"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    if emission:
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


def make_materials():
    return {
    "floor": material("MAT_Floor", tex_floor()),
    "wall": material("MAT_Wallpaper", tex_wallpaper()),
    "wainscot": material("MAT_Wainscot", tex_wainscot()),
    "wood": material("MAT_Wood", tex_wood()),
    "ceiling": material("MAT_Ceiling", tex_ceiling()),
    "crate": material("MAT_Crate", tex_crate()),
    "door": material("MAT_Door", tex_door()),
    # El juego sustituye esta textura por la portada del proyecto (projects.json).
    "cover": material("MAT_Cover", tex_cover_placeholder(), emission=0.9),
    "metal": material("MAT_Metal", tex_metal()),
    "book": material("MAT_Book", tex_book()),
    "paper": material("MAT_Paper", tex_paper(), emission=0.3),
    }

# --------------------------------------------------------------------------------------
# Geometría
# --------------------------------------------------------------------------------------


def new_object(name, bm, col="Room", mats=()):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    obj = bpy.data.objects.new(name, me)
    collection(col).objects.link(obj)
    return obj


def add_quad(bm, uv_layer, corners, uvs, mat_index=0):
    verts = [bm.verts.new(c) for c in corners]
    face = bm.faces.new(verts)
    face.material_index = mat_index
    for loop, uv in zip(face.loops, uvs):
        loop[uv_layer].uv = uv
    return face


def gridded_quad(bm, uv_layer, origin, u_axis, v_axis, u_len, v_len, step, uv_scale, mat_index=0,
                 uv_offset=(0.0, 0.0)):
    """Quad subdividido en celdas de `step` m (evita la deformación afín exagerada)."""
    o = Vector(origin)
    ua = Vector(u_axis).normalized()
    va = Vector(v_axis).normalized()
    nu = max(1, round(u_len / step))
    nv = max(1, round(v_len / step))
    du, dv = u_len / nu, v_len / nv
    for i in range(nu):
        for j in range(nv):
            u0, u1 = i * du, (i + 1) * du
            v0, v1 = j * dv, (j + 1) * dv
            corners = [o + ua * u0 + va * v0, o + ua * u1 + va * v0,
                       o + ua * u1 + va * v1, o + ua * u0 + va * v1]
            uvs = [((u + uv_offset[0]) / uv_scale, (v + uv_offset[1]) / uv_scale)
                   for (u, v) in [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]]
            add_quad(bm, uv_layer, corners, uvs, mat_index)


def box(name, center, size, mat=None, col="Props", uv_scale=1.0):
    """Caja con UVs proyectadas por cara (texel ~constante)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda k: abs(n[k]))
        for loop in f.loops:
            co = loop.vert.co + Vector(center)
            if ax == 0:
                u, v = co.y * (1 if n.x > 0 else -1), co.z
            elif ax == 1:
                u, v = co.x * (-1 if n.y > 0 else 1), co.z
            else:
                u, v = co.x, co.y
            loop[uv].uv = (u / uv_scale, v / uv_scale)
    obj = new_object(name, bm, col, [mat] if mat else [])
    obj.location = center
    return obj


def helper_box(name, center, size, col):
    """Volumen invisible en el juego (colisión o trigger): se ve como alambre en Blender."""
    obj = box(name, center, size, None, col)
    obj.display_type = "WIRE"
    obj.hide_render = True
    return obj


# --------------------------------------------------------------------------------------
# Planta: sala en L (hall + pasillo al este)
#
#      y=4  +--------------------------------------------+
#           |                  hall      |   pasillo    |  techo pasillo 2.6 m
#      y=1  |                            +--------------+ x=10
#           |                            |
#     y=-4  +----------------------------+
#          x=-5                         x=3
# --------------------------------------------------------------------------------------

OUTLINE = [(-5, -4), (3, -4), (3, 1), (10, 1), (10, 4), (-5, 4)]  # antihorario
HALL_H = 3.2
CORRIDOR_H = 2.6
WAINSCOT_H = 1.0


def build_shell():
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    # 0 piso, 1 papel tapiz, 2 zócalo, 3 techo
    # Piso y techo por celdas de 1 m dentro de la L.
    for x in range(-5, 10):
        for y in range(-4, 4):
            in_hall = x < 3
            in_corr = x >= 3 and y >= 1
            if not (in_hall or in_corr):
                continue
            gridded_quad(bm, uv, (x, y, 0), (1, 0, 0), (0, 1, 0), 1, 1, 1, 1, 0, (x, y))
            h = HALL_H if in_hall else CORRIDOR_H
            gridded_quad(bm, uv, (x, y + 1, h), (1, 0, 0), (0, -1, 0), 1, 1, 1, 2, 3, (x, -y - 1))

    # Muros orientados hacia dentro, a lo largo del contorno.
    n = len(OUTLINE)
    run = 0.0
    for i in range(n):
        a = Vector((*OUTLINE[i], 0))
        b = Vector((*OUTLINE[(i + 1) % n], 0))
        d = b - a
        length = d.length
        # Altura: el pasillo (x>=3, y>=1) es más bajo.
        mid = (a + b) / 2
        h = CORRIDOR_H if (mid.x > 3 and mid.y >= 1) else HALL_H
        # Recorremos antihorario; el interior queda a la izquierda → la cara mira a la izquierda.
        gridded_quad(bm, uv, a, d, (0, 0, 1), length, WAINSCOT_H, 1, 1, 2, (run, 0))
        gridded_quad(bm, uv, a + Vector((0, 0, WAINSCOT_H)), d, (0, 0, 1), length, h - WAINSCOT_H,
                     1, 1, 1, (run, WAINSCOT_H))
        run += length
    # Dintel entre hall y pasillo (x=3, y∈[1,4], z∈[2.6,3.2]), mirando al hall (-X).
    gridded_quad(bm, uv, (3, 4, CORRIDOR_H), (0, -1, 0), (0, 0, 1), 3, HALL_H - CORRIDOR_H, 1, 1, 1)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # no cambia nada si ya son coherentes
    obj = new_object("Room_Shell", bm, "Room",
                     [MAT["floor"], MAT["wall"], MAT["wainscot"], MAT["ceiling"]])
    # recalc_face_normals asume malla cerrada: forzamos normales hacia dentro a mano.
    fix_inward_normals(obj)
    return obj


def fix_inward_normals(obj):
    """Cada cara debe mirar hacia el interior de la L."""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for f in bm.faces:
        c = f.calc_center_median()
        probe = c + f.normal * 0.05
        if not point_inside(probe):
            f.normal_flip()
    bm.to_mesh(me)
    bm.free()


def point_inside(p):
    x, y, z = p
    in_hall = -5 < x < 3 and -4 < y < 4 and 0 < z < HALL_H
    in_corr = 3 <= x < 10 and 1 < y < 4 and 0 < z < CORRIDOR_H
    return in_hall or in_corr


def build_collision():
    t = 0.4  # grosor de los muros de colisión (hacia fuera)
    walls = [
        ("COL_Wall_S", (-1, -4 - t / 2, 1.5), (8 + 2 * t, t, 3)),
        ("COL_Wall_N", (2.5, 4 + t / 2, 1.5), (15 + 2 * t, t, 3)),
        ("COL_Wall_W", (-5 - t / 2, 0, 1.5), (t, 8, 3)),
        ("COL_Wall_E_Hall", (3 + t / 2, -1.5 - t / 2, 1.5), (t, 5 + t, 3)),
        ("COL_Wall_S_Corridor", (6.5 + t / 2, 1 - t / 2, 1.5), (7 + t, t, 3)),
        ("COL_Wall_E_Corridor", (10 + t / 2, 2.5, 1.5), (t, 3, 3)),
    ]
    for name, c, s in walls:
        helper_box(name, c, s, "Collision")


def pedestal(project_id, xy, facing_deg):
    """Pedestal de madera con un atril inclinado que muestra la portada del proyecto."""
    x, y = xy
    root = box(f"INT_{project_id}", (x, y, 0.45), (0.6, 0.6, 0.9), MAT["wood"], "Interactables")
    root.rotation_euler.z = math.radians(facing_deg)
    # Atril (hijo): plano 0.56×0.42 inclinado 35°, con el material de portada.
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    w, h = 0.56, 0.42
    corners = [(-w / 2, 0, 0), (w / 2, 0, 0), (w / 2, 0, h), (-w / 2, 0, h)]
    add_quad(bm, uv, corners, [(0, 0), (1, 0), (1, 1), (0, 1)])
    cover = new_object(f"COVER_{project_id}", bm, "Interactables", [MAT["cover"]])
    cover.parent = root
    cover.location = (0, -0.12, 0.45)
    cover.rotation_euler.x = math.radians(-55)  # inclinado hacia quien lo mira (−Y local)
    # Marco detrás de la portada.
    frame = box(f"FRAME_{project_id}", (0, 0, 0), (w + 0.06, 0.03, h + 0.06), MAT["wood"], "Interactables")
    frame.parent = cover
    frame.location = (0, 0.02, h / 2)
    # Colisión del pedestal.
    col = helper_box(f"COL_Pedestal_{project_id}", (x, y, 0.5), (0.7, 0.7, 1.0), "Collision")
    col.rotation_euler.z = math.radians(facing_deg)
    return root


def build_props():
    # Pilastras del hall, pegadas a los muros para no tapar a las cámaras.
    for i, (x, y) in enumerate([(-1, -3.7), (-1, 3.7)]):
        box(f"Pillar_{i + 1}", (x, y, HALL_H / 2), (0.6, 0.6, HALL_H), MAT["wainscot"], "Props")
        helper_box(f"COL_Pillar_{i + 1}", (x, y, 1.5), (0.6, 0.6, 3), "Collision")
    # Mesa con cajas encima.
    box("Table_Top", (1.4, -0.4, 0.74), (1.6, 0.8, 0.08), MAT["wood"], "Props")
    for i, (dx, dy) in enumerate([(-0.7, -0.32), (0.7, -0.32), (-0.7, 0.32), (0.7, 0.32)]):
        box(f"Table_Leg_{i + 1}", (1.4 + dx, -0.4 + dy, 0.35), (0.08, 0.08, 0.7), MAT["wood"], "Props")
    box("Table_Box", (1.85, -0.45, 0.89), (0.36, 0.28, 0.22), MAT["crate"], "Props", uv_scale=0.5)
    # Libro abierto con la bio (profile.about).
    book = box("INT_about", (1.0, -0.4, 0.80), (0.42, 0.30, 0.04), MAT["book"], "Interactables", 0.5)
    page = box("PAGES_about", (0, 0, 0), (0.38, 0.26, 0.012), MAT["paper"], "Interactables", 0.5)
    page.parent = book
    page.location = (0, 0, 0.026)
    helper_box("COL_Table", (1.4, -0.4, 0.5), (1.7, 0.9, 1.0), "Collision")
    # Cajas en el pasillo (decoran y obligan a rodear).
    crates = [("Crate_1", (6.2, 3.45, 0.4), 0.8), ("Crate_2", (6.2, 3.45, 1.1), 0.6),
              ("Crate_3", (7.1, 3.5, 0.35), 0.7)]
    for name, c, s in crates:
        obj = box(name, c, (s, s, s), MAT["crate"], "Props", uv_scale=s)
        obj.rotation_euler.z = math.radians(8 if name == "Crate_2" else -4)
    helper_box("COL_Crates", (6.65, 3.45, 0.6), (1.8, 0.95, 1.2), "Collision")
    # Puerta al oeste, hacia la sala de guardado.
    door("save-room", (-5.0, 0.0), 90)
    spawn("save-room", (-4.1, 0.0), -90)  # al volver, mirando al este


def door(room_id, xy, facing_deg):
    """Puerta en un muro: marco + hoja (DOOR_<roomId>). La hoja mira a −Y local."""
    x, y = xy
    root = box(f"DOOR_{room_id}", (x, y, 1.15), (1.2, 0.08, 2.3), MAT["door"], "Doors", uv_scale=2.3)
    root.rotation_euler.z = math.radians(facing_deg)
    for i, (dx, w, z, h) in enumerate([(-0.66, 0.12, 1.2, 2.4), (0.66, 0.12, 1.2, 2.4), (0, 1.44, 2.42, 0.12)]):
        part = box(f"DOORFRAME_{room_id}_{i}", (0, 0, 0), (w, 0.14, h), MAT["wainscot"], "Doors", 1)
        part.parent = root
        part.location = (dx, 0, z - 1.15)
    knob = box(f"DOORKNOB_{room_id}", (0, 0, 0), (0.06, 0.06, 0.06), MAT["metal"], "Doors", 1)
    knob.parent = root
    knob.location = (0.45, -0.06, -0.1)
    return root


def spawn(name, xy, facing_deg):
    """Empty SPAWN_<name>. facing_deg: 0 = norte (+Y), 90 = oeste, -90 = este, 180 = sur."""
    sp = bpy.data.objects.new(f"SPAWN_{name}", None)
    sp.empty_display_type = "SINGLE_ARROW"
    sp.empty_display_size = 0.6
    collection("Spawns").objects.link(sp)
    sp.location = (xy[0], xy[1], 0)
    # La flecha de un Empty apunta a +Z local: tumbarla hacia +Y y girarla alrededor de Z.
    sp.rotation_euler = (math.radians(-90), 0, math.radians(facing_deg))
    sp.rotation_mode = "XYZ"
    return sp


def build_interactables():
    # Los cuatro destacados del Hall (PLAN.md §3).
    # facing_deg gira el frente del pedestal (−Y local) alrededor de Z.
    pedestal("persona-error", (-4.2, -2.6), 90)    # mirando al este (+X)
    pedestal("catharsis", (-4.2, 2.6), 90)
    pedestal("kerberos-engine", (1.6, -3.3), 180)  # mirando al norte (+Y)
    pedestal("death-of-will", (9.4, 2.5), -90)     # final del pasillo, mirando al oeste (−X)


def camera(name, location, target, fov_deg=55):
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens_unit = "FOV"
    cam_data.sensor_fit = "VERTICAL"
    cam_data.angle = math.radians(fov_deg)
    cam_data.clip_start = 0.1
    cam_data.clip_end = 40
    cam = bpy.data.objects.new(name, cam_data)
    collection("Cameras").objects.link(cam)
    cam.location = location
    direction = Vector(target) - Vector(location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return cam


def build_cameras():
    # Las zonas se solapan 0.4 m: la cámara activa no cambia hasta salir de su volumen.
    # Para una zona con varios volúmenes, nombrarlos TRG_CAM_<n>_a, TRG_CAM_<n>_b…
    camera("CAM_1", (2.6, -3.7, 2.95), (-3.6, 0.6, 0.4), 52)          # mitad oeste del hall
    helper_box("TRG_CAM_1", (-3.0, 0, 1), (4.4, 8, 2), "Triggers")    # x ∈ [-5.2, -0.8]
    camera("CAM_2", (-4.7, 3.7, 2.95), (2.2, -1.2, 0.4), 52)          # mitad este del hall
    helper_box("TRG_CAM_2", (1.0, 0, 1), (4.4, 8, 2), "Triggers")     # x ∈ [-1.2, 3.2]
    helper_box("TRG_CAM_2_entrada", (3.55, 2.5, 1), (0.7, 3, 2), "Triggers")  # x ∈ [3.2, 3.9]
    # Pasillo: la cámara mira por debajo del dintel desde el hall.
    camera("CAM_3", (2.2, 1.3, 2.4), (9.6, 3.0, 0.3), 50)
    helper_box("TRG_CAM_3", (6.85, 2.5, 1), (6.7, 3, 2), "Triggers")  # x ∈ [3.5, 10.2]


def light(name, location, power, color):
    """Luz puntual. Se exporta en modo RAW: `power` es directamente la intensidad (cd)
    que usará Three.js, por eso en el viewport de Blender se ven tenues."""
    data = bpy.data.lights.new(name, "POINT")
    data.energy = power
    data.color = color
    data.shadow_soft_size = 0.1
    obj = bpy.data.objects.new(name, data)
    collection("Lights").objects.link(obj)
    obj.location = location
    return obj


def build_lights():
    light("Light_Hall_W", (-2.8, 0.0, 2.8), 8.0, (1.0, 0.78, 0.55))
    light("Light_Hall_E", (1.4, -0.6, 2.8), 7.0, (1.0, 0.80, 0.58))
    light("Light_Corridor", (6.5, 2.5, 2.3), 3.5, (0.65, 0.78, 1.0))
    light("Light_Corridor_End", (9.3, 2.5, 2.2), 2.5, (1.0, 0.55, 0.40))


def build_spawns():
    spawn("default", (0.2, -2.6), 0)  # inicio: mirando al norte


# --------------------------------------------------------------------------------------
# Sala de guardado: 5 × 4 m, puerta al este hacia el hall
# --------------------------------------------------------------------------------------

SAVE_X = (-2.5, 2.5)
SAVE_Y = (-2.0, 2.0)
SAVE_H = 2.8


def build_save_room():
    x0, x1 = SAVE_X
    y0, y1 = SAVE_Y
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    gridded_quad(bm, uv, (x0, y0, 0), (1, 0, 0), (0, 1, 0), x1 - x0, y1 - y0, 1, 1, 0, (x0, y0))
    gridded_quad(bm, uv, (x0, y1, SAVE_H), (1, 0, 0), (0, -1, 0), x1 - x0, y1 - y0, 1, 2, 3)
    outline = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    run = 0.0
    for i in range(4):
        a = Vector((*outline[i], 0))
        b = Vector((*outline[(i + 1) % 4], 0))
        d = b - a
        gridded_quad(bm, uv, a, d, (0, 0, 1), d.length, WAINSCOT_H, 1, 1, 2, (run, 0))
        gridded_quad(bm, uv, a + Vector((0, 0, WAINSCOT_H)), d, (0, 0, 1), d.length, SAVE_H - WAINSCOT_H,
                     1, 1, 1, (run, WAINSCOT_H))
        run += d.length
    obj = new_object("Room_Shell", bm, "Room", [MAT["floor"], MAT["wall"], MAT["wainscot"], MAT["ceiling"]])
    # Normales hacia dentro de la caja.
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for f in bm.faces:
        p = f.calc_center_median() + f.normal * 0.05
        if not (x0 < p.x < x1 and y0 < p.y < y1 and 0 < p.z < SAVE_H):
            f.normal_flip()
    bm.to_mesh(me)
    bm.free()

    t = 0.4
    for name, c, sz in [
        ("COL_Wall_S", (0, y0 - t / 2, 1.5), (x1 - x0 + 2 * t, t, 3)),
        ("COL_Wall_N", (0, y1 + t / 2, 1.5), (x1 - x0 + 2 * t, t, 3)),
        ("COL_Wall_W", (x0 - t / 2, 0, 1.5), (t, y1 - y0, 3)),
        ("COL_Wall_E", (x1 + t / 2, 0, 1.5), (t, y1 - y0, 3)),
    ]:
        helper_box(name, c, sz, "Collision")

    # Escritorio con la máquina de escribir (contacto), contra el muro norte.
    box("Desk_Top", (0.0, 1.55, 0.74), (1.4, 0.7, 0.06), MAT["wood"], "Props")
    for i, (dx, dy) in enumerate([(-0.62, -0.28), (0.62, -0.28), (-0.62, 0.28), (0.62, 0.28)]):
        box(f"Desk_Leg_{i + 1}", (dx, 1.55 + dy, 0.36), (0.07, 0.07, 0.72), MAT["wood"], "Props")
    helper_box("COL_Desk", (0.0, 1.55, 0.5), (1.5, 0.8, 1.0), "Collision")
    tw = box("INT_contact", (0.0, 1.5, 0.84), (0.46, 0.34, 0.14), MAT["metal"], "Interactables", 0.5)
    keys = box("TW_Keys", (0, 0, 0), (0.42, 0.14, 0.05), MAT["metal"], "Interactables", 0.5)
    keys.parent = tw
    keys.location = (0, -0.16, -0.03)
    keys.rotation_euler.x = math.radians(-18)
    roller = box("TW_Roller", (0, 0, 0), (0.52, 0.07, 0.07), MAT["metal"], "Interactables", 0.5)
    roller.parent = tw
    roller.location = (0, 0.1, 0.1)
    sheet = box("TW_Paper", (0, 0, 0), (0.30, 0.01, 0.30), MAT["paper"], "Interactables", 0.3)
    sheet.parent = tw
    sheet.location = (0, 0.12, 0.25)
    sheet.rotation_euler.x = math.radians(-12)

    # Mesita con una libreta de curiosidades (profile.trivia), esquina noroeste.
    box("SideTable", (-1.85, 1.45, 0.35), (0.6, 0.6, 0.7), MAT["wood"], "Props")
    helper_box("COL_SideTable", (-1.85, 1.45, 0.5), (0.7, 0.7, 1.0), "Collision")
    note = box("INT_trivia", (-1.85, 1.4, 0.72), (0.3, 0.22, 0.03), MAT["book"], "Interactables", 0.5)
    note.rotation_euler.z = math.radians(15)
    pages = box("PAGES_trivia", (0, 0, 0), (0.27, 0.19, 0.01), MAT["paper"], "Interactables", 0.5)
    pages.parent = note
    pages.location = (0, 0, 0.018)

    # Estantería y cajas de decoración en el muro sur.
    box("Shelf", (-1.2, -1.75, 1.0), (1.4, 0.4, 2.0), MAT["wood"], "Props")
    for i, z in enumerate([0.5, 1.05, 1.6]):
        box(f"Shelf_Books_{i}", (-1.2 + 0.1 * (i - 1), -1.72, z), (1.1, 0.3, 0.32), MAT["book"], "Props", 0.5)
    helper_box("COL_Shelf", (-1.2, -1.75, 1.0), (1.5, 0.5, 2.0), "Collision")
    box("Crate_1", (1.2, -1.55, 0.35), (0.7, 0.7, 0.7), MAT["crate"], "Props", 0.7)
    helper_box("COL_Crate", (1.2, -1.55, 0.5), (0.75, 0.75, 1.0), "Collision")

    door("hall", (x1, 0.0), -90)
    spawn("hall", (x1 - 0.9, 0.0), 90)  # entrando desde el hall: mirando al oeste
    spawn("default", (0.0, 0.0), 90)

    camera("CAM_1", (-2.25, -1.75, 2.55), (1.4, 0.9, 0.5), 60)
    helper_box("TRG_CAM_1", (0, 0, 1), (5.4, 4.4, 2), "Triggers")

    light("Light_Desk", (0.3, 1.3, 1.3), 1.6, (1.0, 0.72, 0.45))
    light("Light_Ceiling", (0.0, 0.0, 2.5), 3.5, (0.95, 0.85, 0.70))


# --------------------------------------------------------------------------------------
# Construcción y exportación
# --------------------------------------------------------------------------------------


def export(basename, active_camera="CAM_1"):
    scene.camera = bpy.data.objects[active_camera]
    blend_out = os.path.join(ROOT, "art", "rooms", f"{basename}.blend")
    glb_out = os.path.join(ROOT, "public", "models", "rooms", f"{basename}.glb")
    os.makedirs(os.path.dirname(blend_out), exist_ok=True)
    os.makedirs(os.path.dirname(glb_out), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=blend_out, compress=True)
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_cameras=True,
        export_lights=True,
        export_import_convert_lighting_mode="RAW",
        export_extras=True,
        export_animations=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
    )
    print("OK:", blend_out, glb_out)


# Hall (archivo test_room.* por compatibilidad con la Fase 2).
new_scene()
build_shell()
build_collision()
build_props()
build_interactables()
build_cameras()
build_lights()
build_spawns()
export("test_room")

# Sala de guardado.
new_scene()
build_save_room()
export("save_room")
