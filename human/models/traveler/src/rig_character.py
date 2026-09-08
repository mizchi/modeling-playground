"""Generate a skinned Milo with a baked Walk clip; preserve the original static asset."""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_character as character
from gait import sample_walk, CYCLE_SECONDS, FPS

OUT = character.OUT
HIP = Vector((0, 0, .925))
BONES = [
    ('Root', (0,0,0), (0,0,.15), None),
    ('Hips', HIP, (0,0,1.05), 'Root'),
    ('Spine', (0,0,1.05), (0,0,1.30), 'Hips'),
    ('Chest', (0,0,1.30), (0,0,1.44), 'Spine'),
    ('Neck', (0,0,1.44), (0,0,1.56), 'Chest'),
    ('HeadBone', (0,0,1.56), (0,0,1.98), 'Neck'),
]
for side, prefix in [(-1, 'Left'), (1, 'Right')]:
    BONES += [
        (prefix+'UpperArm', (side*.274,0,1.365), (side*.400,-.015,1.14), 'Chest'),
        (prefix+'Forearm', (side*.400,-.015,1.14), (side*.461,-.065,.947), prefix+'UpperArm'),
        (prefix+'Hand', (side*.461,-.065,.947), (side*.476,-.073,.835), prefix+'Forearm'),
        (prefix+'Thigh', (side*.12,0,.925), (side*.137,-.006,.56), 'Hips'),
        (prefix+'Shin', (side*.137,-.006,.56), (side*.15,.008,.21), prefix+'Thigh'),
        (prefix+'Foot', (side*.15,.008,.21), (side*.15,-.18,.10), prefix+'Shin'),
    ]


def smooth(a, b, value):
    t = min(1.0, max(0.0, (value-a)/(b-a)))
    return t*t*(3-2*t)


def body_weights(z):
    if z < 1.13:
        t = smooth(.98,1.13,z)
        return {'Hips':1-t, 'Spine':t}
    t = smooth(1.20,1.33,z)
    return {'Spine':1-t, 'Chest':t}


def weights(part, name, point):
    z = point.z
    if part == 'Head': return {'HeadBone':1}
    if part == 'Backpack':
        return body_weights(z) if name.startswith(('Shoulder strap','Strap buckle','Buckle opening')) else {'Chest':1}
    if part == 'Torso': return body_weights(z)
    prefix = 'Left' if part.startswith('Left') else 'Right'
    if part.endswith('Arm'):
        if name.startswith(('Palm','Finger','Thumb')): return {prefix+'Hand':1}
        t = smooth(1.09,1.19,z)
        return {prefix+'UpperArm':t,prefix+'Forearm':1-t}
    if name.startswith(('Boot','Heel','Rolled trouser')): return {prefix+'Foot':1}
    t = smooth(.50,.62,z)
    return {prefix+'Thigh':t,prefix+'Shin':1-t}


def build_rig(root):
    data = bpy.data.armatures.new('MiloSkeleton')
    rig = bpy.data.objects.new('MiloRig', data)
    bpy.context.collection.objects.link(rig)
    rig.parent = root
    rig.show_in_front = True
    data.display_type = 'OCTAHEDRAL'
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for name, head, tail, parent in BONES:
        bone = data.edit_bones.new(name)
        bone.head, bone.tail = head, tail
        if parent: bone.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for part in [obj for obj in root.children if obj.type=='EMPTY']:
        objects = [obj for obj in part.children_recursive if obj.type=='MESH']
        for obj in objects:
            # Bake object transforms before weighting, giving every skin the same bind space.
            transform = obj.matrix_world.copy()
            obj.data.transform(transform)
            obj.matrix_world = Matrix.Identity(4)
            groups = {}
            for vertex in obj.data.vertices:
                influences = weights(part.name, obj.name, vertex.co)
                for name, weight in influences.items():
                    if weight <= 0: continue
                    if name not in groups: groups[name]=obj.vertex_groups.new(name=name)
                    groups[name].add([vertex.index],weight,'REPLACE')
        # Keep editable body groups, but consolidate small pieces to seven skinned meshes.
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        obj=bpy.context.object
        obj.name=part.name+'Mesh'
        obj['focusTarget']=True
        modifier=obj.modifiers.new('Milo skin','ARMATURE')
        modifier.object=rig
        for vertex in obj.data.vertices:
            assert abs(sum(g.weight for g in vertex.groups)-1)<1e-5
    return rig


def pivot_rotation(point, angle, axis):
    return Matrix.Translation(point) @ Matrix.Rotation(angle,4,axis) @ Matrix.Translation(-Vector(point))


def solve_knee(hip, ankle, upper, lower):
    delta=ankle-hip
    distance=delta.length
    assert abs(upper-lower)<distance<upper+lower, f'Unreachable foot: {distance}'
    direction=delta.normalized()
    along=(upper*upper-lower*lower+distance*distance)/(2*distance)
    height=math.sqrt(max(0,upper*upper-along*along))
    pole=Vector((0,-1,0))
    pole=(pole-direction*pole.dot(direction)).normalized()
    return hip+direction*along+pole*height


def aimed_bone(bone, start, end):
    delta=(bone.tail_local-bone.head_local).rotation_difference(end-start)
    return Matrix.Translation(start) @ delta.to_matrix().to_4x4() @ bone.matrix_local.to_3x3().to_4x4()


def animate(rig):
    scene=bpy.context.scene
    scene.render.fps=FPS
    scene.frame_start,scene.frame_end=0,round(CYCLE_SECONDS*FPS)
    for frame in range(scene.frame_start,scene.frame_end+1):
        scene.frame_set(frame)
        walk=sample_walk(frame/FPS)
        body=Matrix.Translation((walk['sway'],0,walk['hips_z'])) @ Matrix.Rotation(walk['yaw'],4,'Z') @ Matrix.Translation(-HIP)
        desired={'Root':rig.data.bones['Root'].matrix_local.copy()}
        for name in ['Hips','Spine','Chest','Neck']:
            desired[name]=body @ rig.data.bones[name].matrix_local
        desired['HeadBone']=body @ pivot_rotation((0,0,1.56),-walk['yaw']*.7,'Z') @ rig.data.bones['HeadBone'].matrix_local
        for side,prefix,foot_name in [(-1,'Left','L'),(1,'Right','R')]:
            thigh,shin,foot=[rig.data.bones[prefix+n] for n in ['Thigh','Shin','Foot']]
            hip=body @ thigh.head_local
            target=Vector((side*.15,walk['feet'][foot_name]['y'],.1975+walk['feet'][foot_name]['lift']))
            knee=solve_knee(hip,target,thigh.length,shin.length)
            desired[prefix+'Thigh']=aimed_bone(thigh,hip,knee)
            desired[prefix+'Shin']=aimed_bone(shin,knee,target)
            desired[prefix+'Foot']=Matrix.Translation(target-foot.head_local) @ foot.matrix_local
            upper,forearm,hand=[rig.data.bones[prefix+n] for n in ['UpperArm','Forearm','Hand']]
            swing=walk['arm_swing']*(-side)
            upper_delta=body @ pivot_rotation(upper.head_local,swing,'X')
            lower_delta=upper_delta @ pivot_rotation(forearm.head_local,-.10-.06*math.sin(frame/FPS/CYCLE_SECONDS*math.tau), 'X')
            desired[prefix+'UpperArm']=upper_delta @ upper.matrix_local
            desired[prefix+'Forearm']=lower_delta @ forearm.matrix_local
            desired[prefix+'Hand']=lower_delta @ hand.matrix_local
        for bone in rig.pose.bones:
            rest=bone.bone.matrix_local
            if bone.parent:
                rest_local=bone.parent.bone.matrix_local.inverted() @ rest
                basis=rest_local.inverted() @ desired[bone.parent.name].inverted() @ desired[bone.name]
            else: basis=rest.inverted() @ desired[bone.name]
            bone.rotation_mode='QUATERNION'
            bone.location,bone.rotation_quaternion,bone.scale=basis.decompose()
            bone.keyframe_insert(data_path='location',frame=frame,group=bone.name)
            bone.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=bone.name)
            bone.keyframe_insert(data_path='scale',frame=frame,group=bone.name)
    action=rig.animation_data.action
    action.name='Walk'
    # Blender 5 layered Actions: use linear interpolation for the baked samples.
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for point in curve.keyframe_points: point.interpolation='LINEAR'
    scene.frame_set(0)


if __name__=='__main__':
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    character.MATS={name:character.make_material(name,color) for name,color in character.COLORS.items()}
    root=character.group('Traveler')
    root['title']='Milo — Walk'
    root['units']='meters'
    root['rigged']=True
    root['cycleSeconds']=CYCLE_SECONDS
    root['motion']='in-place'
    character.torso(root)
    character.head(root)
    for side in (-1,1): character.arm(side,root); character.leg(side,root)
    character.backpack(root)
    bpy.context.view_layer.update()
    rig=build_rig(root)
    animate(rig)
    OUT.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(OUT/'traveler-walk.glb'),export_format='GLB',use_selection=True,
                             export_cameras=False,export_lights=False,export_extras=True,export_animations=True,
                             export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=True)
    character.studio()
    scene=bpy.context.scene
    scene.render.filepath=str(OUT/'traveler-walk.png')
    scene.frame_set(5)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'traveler-walk.blend'))
    if '--skip-render' not in sys.argv: bpy.ops.render.render(write_still=True)
    print(f'Rigged walk generated: {len(rig.data.bones)} bones, {CYCLE_SECONDS}s')
