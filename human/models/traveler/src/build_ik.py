"""Native Blender IK controllers plus a portable, explicitly versioned viewer contract."""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_character as character
from rig_character import build_rig

OUT = character.OUT
CONTRACT = json.loads(Path(__file__).with_name('ik_contract.json').read_text())


def control(name, position, parent, kind='CUBE', size=.065):
    obj=bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(obj)
    obj.parent=parent
    obj.location=position
    obj.empty_display_type=kind
    obj.empty_display_size=size
    obj.show_in_front=True
    obj.show_name=True
    return obj


def drive(constraint,rig):
    driver=constraint.driver_add('influence').driver
    var=driver.variables.new()
    var.name='ik'
    var.targets[0].id=rig
    var.targets[0].data_path='["IK"]'
    driver.expression='ik'


def evaluated(rig):
    rig.update_tag()
    bpy.context.view_layer.update()
    return rig.evaluated_get(bpy.context.evaluated_depsgraph_get())


def add_controls(rig,root):
    rig['IK']=1.0
    rig.id_properties_ui('IK').update(min=0.0,max=1.0,description='1: target controllers (IK), 0: rotate deform bones (FK)')
    folder=character.group('IK_Controls',root)
    hip=control('CTRL_Hips',(0,0,.865),folder,'CIRCLE',.25)
    constraint=rig.pose.bones['Hips'].constraints.new('COPY_LOCATION')
    constraint.name='Hip position'
    constraint.target=hip
    constraint.owner_space=constraint.target_space='WORLD'
    drive(constraint,rig)
    result={}
    for chain in CONTRACT['chains']:
        end=rig.data.bones[chain['end']]
        goal=control('CTRL_'+chain['end'],end.head_local,folder)
        goal.rotation_mode='QUATERNION'
        goal.rotation_quaternion=end.matrix_local.to_quaternion()
        x,y,z=chain['pole']
        pole=control('POLE_'+chain['end'],(x,-z,y),folder,'SPHERE',.045)
        ik=rig.pose.bones[chain['lower']].constraints.new('IK')
        ik.name=chain['label']+' IK'
        ik.target,ik.pole_target,ik.chain_count=goal,pole,2
        ik.use_stretch=False
        ik.iterations=200
        for name in [chain['upper'],chain['lower']]: rig.pose.bones[name].ik_stretch=0
        drive(ik,rig)
        rotation=rig.pose.bones[chain['end']].constraints.new('COPY_ROTATION')
        rotation.name='Effector orientation'
        rotation.target=goal
        rotation.owner_space=rotation.target_space='WORLD'
        drive(rotation,rig)
        # Calibrate the pole against the actual bone roll; do not assume symmetry of axes.
        best=(-float('inf'),0)
        for i in range(64):
            ik.pole_angle=-math.pi+i*math.tau/64
            pose=evaluated(rig).pose.bones
            a,b,c=[pose[chain[k]].head.copy() for k in ['upper','lower','end']]
            axis=(c-a).normalized()
            bend=b-a-axis*(b-a).dot(axis)
            toward=pole.location-a-axis*(pole.location-a).dot(axis)
            score=bend.normalized().dot(toward.normalized())
            if score>best[0]: best=(score,ik.pole_angle)
        ik.pole_angle=best[1]
        result[chain['id']]={'target':goal,'pole':pole,'constraint':ik,'chain':chain}
    evaluated(rig)
    return hip,result


def verify(rig,hip,controls):
    def positions():
        bones=evaluated(rig).pose.bones
        return {key:bones[value['chain']['end']].head.copy() for key,value in controls.items()}
    def reaches():
        actual=positions()
        for key,ctrl in controls.items():
            assert (actual[key]-ctrl['target'].location).length<.002, (key,actual[key],ctrl['target'].location)
    reaches()
    feet={key:value.copy() for key,value in positions().items() if 'Foot' in key}
    hip.location.z-=.10
    reaches()
    for key,pos in feet.items(): assert (positions()[key]-pos).length<.002
    hip.location.z+=.10
    arm=controls['leftHand']
    original=arm['target'].location.copy()
    arm['target'].location+=Vector((-.025,-.05,.10))
    reaches()
    lower=arm['chain']['lower']
    before=evaluated(rig).pose.bones[lower].head.copy()
    pole=arm['pole'].location.copy()
    arm['pole'].location.y-=.5
    after=evaluated(rig).pose.bones[lower].head.copy()
    assert (after-before).length>.005
    reaches()
    arm['pole'].location=pole
    arm['target'].location=original
    rig['IK']=0.0
    actual=positions()
    assert all(abs(c['constraint'].influence)<1e-6 for c in controls.values())
    rig['IK']=1.0
    reaches()
    print('Blender IK verified: four effectors, planted-foot crouch, hand target, elbow pole, IK/FK driver')


if __name__=='__main__':
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    character.MATS={name:character.make_material(name,color) for name,color in character.COLORS.items()}
    root=character.group('Traveler')
    root['title']='Milo — Interactive IK'
    root['units']='meters'
    root['rigged']=True
    root['ikRig']=json.dumps(CONTRACT,ensure_ascii=False)
    character.torso(root)
    character.head(root)
    for side in [-1,1]: character.arm(side,root); character.leg(side,root)
    character.backpack(root)
    bpy.context.view_layer.update()
    rig=build_rig(root)
    for obj in list(root.children_recursive):
        if obj.type=='MESH' and any(mod.type=='ARMATURE' for mod in obj.modifiers):
            world=obj.matrix_world.copy()
            obj.parent=rig
            obj.matrix_world=world
    hip,controls=add_controls(rig,root)
    verify(rig,hip,controls)
    OUT.mkdir(parents=True,exist_ok=True)
    # GLB stores skin and the contract. Live Blender constraints stay in the .blend.
    bpy.ops.object.select_all(action='DESELECT')
    for obj in root.children_recursive:
        if obj.name!='IK_Controls' and obj.parent.name!='IK_Controls': obj.select_set(True)
    root.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/'traveler-ik.glb'),export_format='GLB',use_selection=True,
                             export_cameras=False,export_lights=False,export_extras=True,export_animations=False)
    character.studio()
    bpy.context.scene.render.filepath=str(OUT/'traveler-ik.png')
    bpy.ops.object.select_all(action='DESELECT')
    hip.select_set(True)
    bpy.context.view_layer.objects.active=hip
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'traveler-ik.blend'))
    if '--skip-render' not in sys.argv: bpy.ops.render.render(write_still=True)
