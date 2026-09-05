"""Deterministic, texture-free miniature town. Run with Blender 5 in background."""
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parents[1] / "output"
RNG = random.Random(23)
GROUND = 0.42
PALETTE = {
    "sand": "D9C8A5", "edge": "667967", "grass": "8B9C63",
    "paving": "BAAD93", "paving_light": "CDC2A8", "paving_dark": "AA9D88",
    "cream": "F1DFC0", "peach": "DEA086", "sage": "A8BEA4",
    "yellow": "E8C681", "rose": "CF958C", "blue": "9BB7BC",
    "roof": "AB5842", "roof_light": "C76E4F", "roof_dark": "804735",
    "slate": "506C72", "trim": "F7E8CE", "wood": "77543D",
    "wood_light": "AC8055", "glass": "365E64", "window_glint": "7FA5A3",
    "iron": "374C48", "leaf": "65844D", "leaf_light": "8FA65B",
    "leaf_dark": "466D47", "flower": "DB7180", "flower_gold": "F0C459",
    "water": "67ABB3", "water_light": "B5DFD6", "red": "B55043",
    "gold": "D4A75A", "ground": "EEE5D3",
}


def linear(c):
    c = int(c, 16) / 255
    return c / 12.92 if c < .04045 else ((c + .055) / 1.055) ** 2.4


def material(name, color):
    mat = bpy.data.materials.new(name)
    rgba = tuple(linear(color[i:i + 2]) for i in (0, 2, 4)) + (1,)
    mat.diffuse_color = rgba
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = rgba
    bsdf.inputs['Roughness'].default_value = .83 if name != 'water' else .25
    return mat


def group(name, position=(0, 0, 0), angle=0, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = position
    obj.rotation_euler.z = angle
    return obj


def mesh(name, vertices, faces, mat, parent=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.materials.append(MATS[mat])
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    return obj


CACHE = {}


def primitive(name, shape, position, scale, mat, parent=None, angle=0):
    key = (shape, mat)
    if key not in CACHE:
        if shape == 'box':
            verts = [(x / 2, y / 2, z / 2) for z in (-1, 1) for y in (-1, 1) for x in (-1, 1)]
            faces = [(0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)]
        else:
            n = int(shape.split(':')[1])
            verts = [(math.cos(i * math.tau / n), math.sin(i * math.tau / n), z / 2) for z in (-1, 1) for i in range(n)]
            faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
            faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
        seed = mesh(name, verts, faces, mat)
        CACHE[key] = seed.data
        bpy.data.objects.remove(seed, do_unlink=True)
    obj = bpy.data.objects.new(name, CACHE[key])
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = position
    obj.scale = scale
    obj.rotation_euler.z = angle
    return obj


def box(name, pos, size, mat, parent=None, angle=0):
    return primitive(name, 'box', pos, size, mat, parent, angle)


def cylinder(name, pos, radius, depth, mat, parent=None, sides=12):
    return primitive(name, f'cylinder:{sides}', pos, (radius, radius, depth), mat, parent)


def beam(name, a, b, thickness, mat, parent):
    a, b = Vector(a), Vector(b)
    obj = box(name, (a + b) / 2, (thickness, thickness, (b - a).length), mat, parent)
    obj.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    return obj


def crown(name, pos, size, mat, parent):
    # Shared faceted icosahedra keep the file compact and preserve a low-poly silhouette.
    key = ('ico', mat)
    if key not in CACHE:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1)
        seed = bpy.context.object
        seed.data.materials.append(MATS[mat])
        CACHE[key] = seed.data
        bpy.data.objects.remove(seed, do_unlink=True)
    obj = bpy.data.objects.new(name, CACHE[key])
    bpy.context.collection.objects.link(obj)
    obj.parent, obj.location, obj.scale = parent, pos, size
    obj.rotation_euler.z = RNG.random() * math.tau
    return obj


def text(name, body, pos, size, mat, parent):
    data = bpy.data.curves.new(name, 'FONT')
    data.body, data.align_x, data.size, data.extrude = body, 'CENTER', size, .007
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent, obj.location = parent, pos
    obj.rotation_euler = (math.pi / 2, 0, 0)
    data.materials.append(MATS[mat])
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)


def roof(parent, width, depth, wall_height, rise, mat='roof'):
    x, y, z = width / 2 + .25, depth / 2 + .25, wall_height
    mesh('Gabled roof', [(-x, -y, z), (x, -y, z), (-x, y, z), (x, y, z), (0, -y, z + rise), (0, y, z + rise)],
         [(0, 1, 4), (2, 5, 3), (0, 4, 5, 2), (1, 3, 5, 4), (0, 2, 3, 1)], mat, parent)
    beam('Ridge cap', (0, -y - .06, z + rise), (0, y + .06, z + rise), .12, 'roof_dark', parent)
    for side in (-1, 1):
        beam('Gable fascia', (side * x, -y - .02, z), (0, -y - .02, z + rise), .12, 'trim', parent)
        for row in range(1, 7):
            t = row / 7
            beam('Tile course', (side * x * t, -y, z + rise * (1 - t) + .02),
                 (side * x * t, y, z + rise * (1 - t) + .02), .035, 'roof_light' if mat == 'roof' else 'slate', parent)


def window(parent, x, y, z, width=.68, height=.88, shutters=True):
    box('Window surround', (x, y, z), (width + .15, .12, height + .15), 'trim', parent)
    box('Window pane', (x, y - .071, z), (width, .03, height), 'glass', parent)
    box('Window crossbar', (x, y - .10, z), (width, .04, .045), 'trim', parent)
    box('Window mullion', (x, y - .10, z), (.045, .04, height), 'trim', parent)
    box('Stone sill', (x, y - .10, z - height / 2 - .07), (width + .26, .28, .09), 'trim', parent)
    if shutters:
        for side in (-1, 1):
            sx = x + side * (width / 2 + .22)
            box('Shutter', (sx, y - .03, z), (.25, .09, height), 'slate', parent)
            for dz in (-.25, 0, .25):
                box('Shutter slat', (sx, y - .09, z + dz), (.21, .04, .025), 'window_glint', parent)


def flowerbox(parent, x, y, z, width=.9):
    box('Flower box', (x, y, z), (width, .3, .19), 'wood_light', parent)
    for i in range(5):
        xx = x - width * .38 + width * .19 * i
        crown('Geranium foliage', (xx, y, z + .15), (.17, .15, .18), 'leaf', parent)
        crown('Geranium blossom', (xx, y - .04, z + .25), (.09, .10, .09), 'flower' if i % 2 else 'flower_gold', parent)


def house(name, pos, width, depth, height, color, angle=0, shop=None, roofmat='roof'):
    parent = group(name, (*pos, GROUND + .12), angle, TOWN)
    parent['category'] = 'building'
    box('Foundation', (0, 0, .08), (width + .22, depth + .2, .22), 'sand', parent)
    box('Plaster walls', (0, 0, height / 2), (width, depth, height), color, parent)
    box('Cornice', (0, 0, height - .06), (width + .14, depth + .14, .17), 'trim', parent)
    box('Storey belt', (0, -depth / 2 - .04, height * .51), (width + .06, .1, .12), 'trim', parent)
    for xx in (-width / 2 + .09, width / 2 - .09):
        box('Corner quoin', (xx, -depth / 2 - .03, height / 2), (.16, .1, height), 'trim', parent)
    roof(parent, width, depth, height, width * .37, roofmat)
    box('Chimney', (width * .27, depth * .22, height + .7), (.40, .44, 1.3), 'cream', parent)
    box('Chimney cap', (width * .27, depth * .22, height + 1.38), (.53, .55, .14), 'roof_dark', parent)
    front = -depth / 2 - .06
    for xx in (-width * .27, width * .27):
        window(parent, xx, front, height * .75)
        flowerbox(parent, xx, front - .19, height * .75 - .64)
    # Side and rear facades are modeled as well, for orbiting around the GLB.
    for side in (-1, 1):
        facade = group('Side facade', (side * width / 2, 0, 0), side * math.pi / 2, parent)
        for yy in (-depth * .25, depth * .25):
            window(facade, yy, -.03, height * .73, .60, .8, False)
            window(facade, yy, -.03, .93, .60, .8, False)
    rear = group('Rear facade', (0, depth / 2, 0), math.pi, parent)
    for xx in (-width * .25, width * .25):
        window(rear, xx, -.03, height * .73, shutters=False)
    if shop:
        for xx in (-width * .27, width * .27):
            window(parent, xx, front, .90, width * .31, 1.20, False)
        box('Shop door', (0, front - .04, .76), (.62, .12, 1.50), 'wood', parent)
        box('Door glass', (0, front - .11, .99), (.40, .03, .76), 'glass', parent)
        box('Shop sign', (0, front - .16, 2.02), (width * .85, .16, .4), 'slate', parent)
        text('Shop lettering', shop, (0, front - .255, 1.90), .24, 'trim', parent)
        for i in range(12):
            xx = -width * .48 + (i + .5) * width * .96 / 12
            awning = box('Canvas awning', (xx, front - .58, 1.73), (width * .96 / 12, 1.05, .065), 'trim' if i % 2 else ('sage' if name == 'Cafe' else 'red'), parent)
            awning.rotation_euler.x = .18
            box('Awning valance', (xx, front - 1.10, 1.58), (width * .96 / 12, .055, .2), 'trim' if i % 2 else ('sage' if name == 'Cafe' else 'red'), parent)
    else:
        box('Front door frame', (0, front, .80), (.96, .18, 1.65), 'trim', parent)
        box('Front door', (0, front - .10, .77), (.76, .08, 1.52), 'wood', parent)
        box('Door inset', (0, front - .15, 1.13), (.48, .03, .46), 'glass', parent)
        cylinder('Door handle', (.24, front - .18, .70), .045, .09, 'gold', parent, 8).rotation_euler.x = math.pi / 2
        for xx in (-width * .3, width * .3):
            window(parent, xx, front, .96, .58, .82, False)
    box('Doorstep', (0, front - .29, .02), (1.10, .57, .16), 'sand', parent)
    return parent


def tree(x, y, scale=1):
    p = group('Tree', (x, y, GROUND + .10), parent=TOWN)
    cylinder('Tree bed', (0, 0, .05), .73 * scale, .14, 'sand', p)
    cylinder('Soil', (0, 0, .13), .62 * scale, .035, 'grass', p)
    cylinder('Trunk', (0, 0, .9 * scale), .12 * scale, 1.8 * scale, 'wood', p, 7)
    for a in (0, 2.1, 4.2):
        beam('Branch', (0, 0, .9 * scale), (.40 * math.cos(a) * scale, .40 * math.sin(a) * scale, 1.85 * scale), .10 * scale, 'wood', p)
    for dx, dy, dz, radius, mat in [(0, 0, 2.6, .91, 'leaf_light'), (-.45, 0, 2.02, .77, 'leaf'), (.43, .15, 2.16, .82, 'leaf_light'), (0, .45, 1.9, .73, 'leaf_dark')]:
        crown('Faceted canopy', (dx * scale, dy * scale, dz * scale), (radius * scale, radius * scale, radius * 1.12 * scale), mat, p)


def bench(x, y, angle=0):
    p = group('Bench', (x, y, GROUND + .12), angle, TOWN)
    for xx in (-.55, .55):
        for yy in (-.18, .18):
            box('Bench leg', (xx, yy, .23), (.075, .075, .46), 'iron', p)
        box('Back support', (xx, .20, .70), (.06, .06, .55), 'iron', p)
    for yy in (-.19, 0, .19):
        box('Seat slat', (0, yy, .49), (1.5, .15, .08), 'wood_light', p)
    for zz in (.75, .95):
        box('Back slat', (0, .23, zz), (1.5, .07, .15), 'wood_light', p)


def lamp(x, y):
    p = group('Street lantern', (x, y, GROUND + .12), parent=TOWN)
    cylinder('Lamp foot', (0, 0, .10), .21, .2, 'iron', p)
    cylinder('Lamp post', (0, 0, 1.18), .055, 2.3, 'iron', p, 8)
    box('Lantern base', (0, 0, 2.25), (.36, .36, .10), 'iron', p)
    box('Lantern glass', (0, 0, 2.48), (.25, .25, .38), 'flower_gold', p)
    for xx in (-.14, .14):
        for yy in (-.14, .14):
            box('Lantern bar', (xx, yy, 2.48), (.035, .035, .44), 'iron', p)
    cylinder('Lantern roof', (0, 0, 2.72), .28, .11, 'iron', p, 4).rotation_euler.z = math.pi / 4
    crown('Lantern finial', (0, 0, 2.83), (.07, .07, .12), 'iron', p)


def fountain():
    p = group('Fountain', (0, -.2, GROUND + .10), parent=TOWN)
    cylinder('Circular plaza', (0, 0, .035), 2.4, .09, 'paving_light', p, 48)
    cylinder('Fountain plinth', (0, 0, .15), 1.66, .22, 'sand', p, 24)
    cylinder('Basin exterior', (0, 0, .34), 1.50, .32, 'trim', p, 24)
    cylinder('Pool water', (0, 0, .511), 1.32, .025, 'water', p, 48)
    # Individual coping blocks form a true raised rim around the water.
    for i in range(24):
        a = i * math.tau / 24
        box('Basin coping', (1.43 * math.cos(a), 1.43 * math.sin(a), .56), (.36, .24, .16), 'sand', p, a + math.pi / 2)
    cylinder('Fountain pedestal', (0, 0, .91), .25, 1.00, 'sand', p)
    cylinder('Upper bowl', (0, 0, 1.44), .64, .16, 'trim', p, 16)
    cylinder('Upper water', (0, 0, 1.53), .52, .025, 'water', p, 24)
    cylinder('Finial', (0, 0, 1.78), .13, .48, 'sand', p)
    crown('Fountain top', (0, 0, 2.05), (.18, .18, .21), 'trim', p)
    for a in (0, math.pi / 2, math.pi, math.pi * 1.5):
        for j in range(7):
            t = j / 6
            r = .40 + .5 * t
            crown('Water cascade', (r * math.cos(a), r * math.sin(a), 1.52 - t * t * .93), (.035, .035, .065), 'water_light', p)


def clocktower():
    p = group('ClockTower', (1.4, 7.4, GROUND + .12), parent=TOWN)
    box('Tower footing', (0, 0, .18), (2.7, 2.7, .36), 'sand', p)
    box('Tower walls', (0, 0, 3.55), (2.2, 2.2, 7.1), 'cream', p)
    for z in (.4, 3.9, 5.4, 7.02):
        box('Tower cornice', (0, 0, z), (2.39, 2.39, .18), 'trim', p)
    for xx in (-1.02, 1.02):
        for yy in (-1.02, 1.02):
            box('Tower corner', (xx, yy, 3.7), (.17, .17, 6.8), 'sand', p)
    for a in (0, math.pi / 2, math.pi, 3 * math.pi / 2):
        face = group('Clock face', angle=a, parent=p)
        dial = cylinder('Clock surround', (0, -1.14, 6.2), .66, .10, 'wood', face, 32)
        dial.rotation_euler.x = math.pi / 2
        dial = cylinder('Clock dial', (0, -1.20, 6.2), .56, .025, 'trim', face, 32)
        dial.rotation_euler.x = math.pi / 2
        for i in range(12):
            aa = i * math.tau / 12
            tick = box('Hour mark', (.46 * math.sin(aa), -1.222, 6.2 + .46 * math.cos(aa)), (.035, .025, .10), 'wood', face)
            tick.rotation_euler.y = aa
        beam('Minute hand', (0, -1.25, 6.2), (.32, -1.25, 6.40), .043, 'iron', face)
        beam('Hour hand', (0, -1.26, 6.2), (-.21, -1.26, 6.35), .055, 'iron', face)
        window(face, 0, -1.12, 4.65, .68, .80, False)
    box('Tower door', (0, -1.13, 1.13), (1.0, .10, 2.05), 'wood', p)
    for z in (.22, .12):
        box('Tower step', (0, -1.50 - (.22 - z) * 3, z), (1.6, .8, z), 'sand', p)
    mesh('Pyramid roof', [(-1.5, -1.5, 7.14), (1.5, -1.5, 7.14), (1.5, 1.5, 7.14), (-1.5, 1.5, 7.14), (0, 0, 9.05)],
         [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (3, 2, 1, 0)], 'slate', p)
    cylinder('Spire', (0, 0, 9.25), .045, .5, 'gold', p, 8)
    crown('Spire ball', (0, 0, 9.50), (.1, .1, .1), 'gold', p)


def terrace(x, y):
    p = group('Cafe terrace', (x, y, GROUND + .14), parent=TOWN)
    for xx in (-.85, .85):
        cylinder('Table pedestal', (xx, 0, .37), .045, .7, 'iron', p)
        cylinder('Bistro tabletop', (xx, 0, .75), .44, .075, 'wood_light', p, 16)
        for yy in (-.64, .64):
            cylinder('Chair seat', (xx, yy, .40), .22, .07, 'sage', p)
            for dx in (-.13, .13):
                for dy in (-.12, .12):
                    box('Chair leg', (xx + dx, yy + dy, .20), (.035, .035, .40), 'iron', p)
            box('Chair back', (xx, yy + (.18 if yy > 0 else -.18), .67), (.40, .06, .38), 'sage', p)
        cylinder('Cup', (xx + .10, 0, .84), .06, .11, 'trim', p, 10)
    cylinder('Parasol pole', (0, .28, 1.29), .035, 2.58, 'wood', p)
    for i in range(8):
        a, b = i * math.tau / 8, (i + 1) * math.tau / 8
        top = [(0, .28, 2.83), (1.35 * math.cos(a), .28 + 1.35 * math.sin(a), 2.40), (1.35 * math.cos(b), .28 + 1.35 * math.sin(b), 2.40)]
        bottom = [(x, y, z - .035) for x, y, z in top]
        mesh('Parasol panel', top + bottom, [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)], 'trim' if i % 2 else 'yellow', p)


def cart(x, y):
    p = group('Flower cart', (x, y, GROUND + .12), -.18, TOWN)
    box('Cart box', (0, 0, .57), (1.20, .64, .45), 'wood_light', p)
    for yy in (-.38, .38):
        wheel = cylinder('Cart wheel', (0, yy, .28), .28, .10, 'iron', p, 12)
        wheel.rotation_euler.x = math.pi / 2
    for xx in (-.40, 0, .40):
        cylinder('Flower pot', (xx, 0, .87), .15, .25, 'roof', p)
        for i in range(3):
            crown('Flowers', (xx + .1 * math.cos(i * 2.1), .1 * math.sin(i * 2.1), 1.13), (.13, .13, .16), 'flower' if xx else 'flower_gold', p)
    beam('Cart handle', (.60, 0, .55), (1.15, 0, .78), .065, 'wood', p)


def create_town():
    box('Diorama base', (0, 0, -.08), (28, 24, .76), 'edge', TOWN)
    box('Sandstone base lip', (0, 0, .29), (28.12, 24.12, .14), 'sand', TOWN)
    box('Town pavement', (0, 0, .38), (27.8, 23.8, .08), 'paving', TOWN)
    # Stone pavers laid only in public streets; deterministic color variations.
    paving = group('Stone streets', parent=TOWN)
    for row in range(30):
        y = -11.5 + row * .78
        for col in range(36):
            x = -13.55 + col * .77 + (.385 if row % 2 else 0)
            if x > 13.6:
                continue
            public = abs(y) < 4.3 or abs(x) < 4.0 or abs(x) > 12.5
            if public:
                box('Paving stone', (x, y, .43), (.73, .74, .045), RNG.choice(['paving', 'paving', 'paving_light', 'paving_dark']), paving)
    for x, y, w, d in [(-7.3, 7.7, 9.5, 6.4), (8.4, 7.7, 7.9, 6.4), (-8.7, -8.4, 7, 5.4), (7.7, -8.5, 9.6, 5.4), (-10.6, .5, 4.5, 6.4), (10.6, .8, 4.5, 6.4)]:
        box('Garden curb', (x, y, .47), (w, d, .15), 'sand', TOWN)
        box('Garden lawn', (x, y, .55), (w - .18, d - .18, .025), 'grass', TOWN)
    house('Bakery', (-8.6, 7.6), 3.7, 3.4, 3.7, 'yellow', shop='BAKERY')
    house('Rose house', (-4.3, 7.9), 3.2, 3.2, 4.5, 'rose')
    house('Bookshop', (5.5, 7.6), 3.4, 3.5, 4.0, 'sage', shop='BOOKS', roofmat='slate')
    house('Blue house', (9.5, 7.9), 3.3, 3.2, 3.6, 'blue')
    house('Cafe', (-10.3, .2), 3.8, 3.4, 3.9, 'cream', math.pi / 2, 'CAFE')
    house('Corner shop', (10.2, .9), 3.6, 3.5, 4.3, 'peach', -math.pi / 2, 'FLEURS')
    house('Sage cottage', (-9.0, -8.5), 3.5, 3.1, 3.1, 'sage', .12)
    house('Peach cottage', (-4.7, -8.6), 3.0, 3.0, 3.5, 'peach', -.05)
    house('Yellow cottage', (5.4, -8.6), 3.3, 3.0, 3.2, 'yellow', .04)
    house('Blue cottage', (9.5, -8.4), 3.4, 3.2, 3.6, 'blue', -.10, roofmat='slate')
    clocktower()
    fountain()
    terrace(-6.45, -.25)
    cart(7.0, 3.5)
    for x, y, scale in [(-12, 10, .95), (-1.6, 9.9, .8), (12.2, 10, 1.0), (-12.4, -4.0, .85), (12.2, -4.2, .9), (-11.9, -9.5, .76), (12.2, -9.1, .8), (-3.5, 3.2, .85), (3.55, 3.0, .9), (-3.6, -3.4, .78), (3.6, -3.4, .8)]:
        tree(x, y, scale)
    for x, y, a in [(-2.6, .4, math.pi / 2), (2.7, .4, -math.pi / 2), (0, 3.1, 0), (7.5, -3.7, math.pi)]:
        bench(x, y, a)
    for x, y in [(-4.8, 4.2), (4.8, 4.2), (-4.8, -4.4), (4.8, -4.4), (-1.8, -9.6), (1.8, -9.6)]:
        lamp(x, y)
    # Low picket fences border the front gardens without enclosing the street.
    fences = group('Garden fences', parent=TOWN)
    for left, right in [(-12.6, -2.8), (3.3, 12.3)]:
        for z in (.84, 1.16):
            box('Fence rail', ((left + right) / 2, -11.20, z), (right - left, .065, .065), 'trim', fences)
        for i in range(int((right - left) / .33) + 1):
            x = left + i * .33
            box('Fence picket', (x, -11.2, .96), (.11, .11, .90), 'trim', fences)
    for x, y in [(-11.7, 5.1), (11.9, 5.0), (-6.4, -6.4), (7.6, -6.2)]:
        box('Hedge planter', (x, y, .70), (1.5, .66, .35), 'sand', TOWN)
        for dx in (-.48, 0, .48):
            crown('Hedge', (x + dx, y, 1.05), (.45, .38, .46), 'leaf', TOWN)
    # Small enamel plaque on the front of the base.
    box('Town nameplate', (0, -12.09, -.06), (4.7, .055, .40), 'slate', TOWN)
    text('Town name', 'PETIT  QUARTIER', (0, -12.125, -.145), .23, 'trim', TOWN)


def stage():
    box('Studio floor', (0, 0, -.55), (200, 200, .12), 'ground')
    world = bpy.context.scene.world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.72, .79, .86, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = .45
    data = bpy.data.lights.new('Studio key', 'AREA')
    light = bpy.data.objects.new('Studio key', data)
    bpy.context.collection.objects.link(light)
    light.location = (-10, -15, 27)
    data.energy, data.shape, data.size = 2600, 'DISK', 13
    light.rotation_euler = (Vector((0, 0, 0)) - light.location).to_track_quat('-Z', 'Y').to_euler()
    data = bpy.data.lights.new('Studio sun', 'SUN')
    light = bpy.data.objects.new('Studio sun', data)
    bpy.context.collection.objects.link(light)
    light.rotation_euler = (.45, -.5, -.45)
    data.energy, data.angle = 2.0, .15
    data = bpy.data.cameras.new('Studio camera')
    cam = bpy.data.objects.new('Studio camera', data)
    bpy.context.collection.objects.link(cam)
    cam.location = (32, -42, 33)
    cam.rotation_euler = (Vector((0, 0, 1.7)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    data.type, data.ortho_scale = 'ORTHO', 42
    scene = bpy.context.scene
    scene.camera = cam
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1600, 1400
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(OUT / 'little-town.png')
    scene.view_settings.view_transform = 'AgX'


if __name__ == '__main__':
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    MATS = {name: material(name, color) for name, color in PALETTE.items()}
    TOWN = group('Town')
    TOWN['title'] = 'Petit Quartier'
    TOWN['units'] = 'meters'
    TOWN['seed'] = 23
    create_town()
    OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT / 'little-town.glb'), export_format='GLB',
                              use_selection=True, export_cameras=False, export_lights=False,
                              export_extras=True, export_yup=True, export_animations=False)
    # Render the delivered GLB after a fresh import, so the preview validates the artifact.
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(OUT / 'little-town.glb'))
    bpy.context.view_layer.update()
    corners = [obj.matrix_world @ Vector(v) for obj in bpy.context.scene.objects if obj.type == 'MESH' for v in obj.bound_box]
    extent = [max(p[i] for p in corners) - min(p[i] for p in corners) for i in range(3)]
    assert 28 < extent[0] < 29 and 24 < extent[1] < 25 and 9 < extent[2] < 11, extent
    assert all(bpy.data.objects.get(name) is not None for name in ('Town', 'Cafe', 'ClockTower', 'Fountain'))
    print(f'GLB reimport verified; dimensions: {extent}')
    stage()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'little-town.blend'))
    print(f'Town created: {len(bpy.data.objects)} objects; output: {OUT}')
