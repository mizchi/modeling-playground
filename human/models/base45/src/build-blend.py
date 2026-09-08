"""Optional native authoring file: preserve quads and weights, no GLB round-trip.

Run through `just base45-blend`; the canonical input remains the generated JSON.
"""
import json
from pathlib import Path

import bpy
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'output/base45.topology.json').read_text())


def to_blender(point):
    """Y-up/+Z-front to Blender Z-up/-Y-front (a proper rotation)."""
    x, y, z = point
    return Vector((x, -z, y))


bpy.ops.wm.read_factory_settings(use_empty=True)
mesh = bpy.data.meshes.new('Base45Quads')
mesh.from_pydata([to_blender(p) for p in data['positions']], [], data['faces'])
mesh.update()
body = bpy.data.objects.new('BaseBody', mesh)
bpy.context.collection.objects.link(body)
body.show_wire = True
body.show_all_edges = True
material = bpy.data.materials.new('NeutralClay')
material.diffuse_color = (.52, .60, .65, 1)
body.data.materials.append(material)

armature = bpy.data.armatures.new('Base45Skeleton')
rig = bpy.data.objects.new('Base45Rig', armature)
bpy.context.collection.objects.link(rig)
rig.show_in_front = True
armature.display_type = 'STICK'
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
definitions = {bone['name']: bone for bone in data['bones']}
for definition in data['bones']:
    name = definition['name']
    bone = armature.edit_bones.new(name)
    bone.head = to_blender(definition['position'])
    children = [b for b in data['bones'] if b['parent'] == name]
    if children:
        bone.tail = to_blender(children[0]['position'])
    elif name == 'Head':
        bone.tail = to_blender((0, 2.18, 0))
    elif name.endswith('Hand'):
        bone.tail = bone.head + Vector((.15 if name.startswith('Left') else -.15, 0, 0))
    elif name.endswith('Toe'):
        bone.tail = bone.head + Vector((0, -.09, 0))
    else:
        bone.tail = bone.head + Vector((0, 0, .07))
    if definition['parent']:
        bone.parent = armature.edit_bones[definition['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
for name in definitions:
    group = body.vertex_groups.new(name=name)
    for i, weights in enumerate(data['weights']):
        for joint, weight in weights:
            if joint == name:
                group.add([i], weight, 'REPLACE')
body.parent = rig
modifier = body.modifiers.new('Base45Skin', 'ARMATURE')
modifier.object = rig

# Face/head selection groups are non-deforming; the intact base stays watertight.
for region in ('Head', 'Neck', 'Torso', *sorted({r for r in data['regions'] if r.startswith('Head.')})):
    group = body.vertex_groups.new(name='Select_' + region)
    vertices = sorted({v for face, tag in zip(data['faces'], data['regions']) if tag == region or tag.startswith(region + '.') for v in face})
    group.add(vertices, 1, 'REPLACE')

scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene['forward'] = '-Y'
scene['head_origin'] = list(to_blender(data['headOrigin']))
scene['source'] = 'base45.topology.json; Y-up source -> Z-up Blender'
scene['notes'] = 'BASE-45: shortened head (~4.9 heads tall), shallow painted-eye beds; no texture/UV/gaze/blink/IK. Select_ groups are for editing.'
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.region_3d.view_distance = 3.9
        area.spaces.active.region_3d.view_location = (0, 0, 1.12)
        area.spaces.active.region_3d.view_rotation = Quaternion((.85, .38, .16, .30)).normalized()
bpy.context.view_layer.objects.active = body
rig.select_set(False)
body.select_set(True)
# Avoid accumulating .blend1 backups when regenerating this derived artifact.
bpy.context.preferences.filepaths.save_version = 0
target = str(ROOT / 'output/base45.blend')
bpy.ops.wm.save_as_mainfile(filepath=target)

# Reopen the delivered file, then check topology and an evaluated elbow bend.
bpy.ops.wm.open_mainfile(filepath=target)
body, rig = bpy.data.objects['BaseBody'], bpy.data.objects['Base45Rig']
assert len(body.data.vertices) == len(data['positions'])
assert len(body.data.polygons) == len(data['faces'])
assert all(len(p.vertices) == 4 for p in body.data.polygons)
assert len(rig.data.bones) == len(data['bones'])
assert body.modifiers['Base45Skin'].object == rig
depsgraph = bpy.context.evaluated_depsgraph_get()
before = [v.co.copy() for v in body.evaluated_get(depsgraph).data.vertices]
rig.pose.bones['LeftForearm'].rotation_mode = 'XYZ'
rig.pose.bones['LeftForearm'].rotation_euler.x = .7
bpy.context.view_layer.update()
after = [v.co.copy() for v in body.evaluated_get(depsgraph).data.vertices]
assert max((a - b).length for a, b in zip(before, after)) > .02
print(f'Native BASE-45 verified: {len(body.data.polygons)} quads, {len(rig.data.bones)} bones; rest-pose file saved')
