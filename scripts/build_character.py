"""Create an editable, static low-poly traveler. Blender 5; Z-up authoring, -Y front."""
import math
from pathlib import Path

import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parents[1] / 'output'
COLORS = {
    'skin': 'DCA17D', 'skin_light': 'EDB58C', 'blush': 'C8816F',
    'hair': '503B32', 'hair_light': '70513B', 'hair_dark': '382E29',
    'jacket': '407E7B', 'jacket_light': '58958A', 'jacket_dark': '2E6264',
    'lining': 'E0D8B6', 'scarf': 'E8B84D', 'scarf_shadow': 'C89536',
    'pants': '354651', 'pants_light': '485A61', 'leather': '79543C',
    'leather_light': '9F7451', 'sole': '3C3733', 'gold': 'CFAB65',
    'eye_white': 'FFEFDA', 'iris': '456568', 'pupil': '222B2E',
    'glint': 'FFFFFF', 'canvas': 'AEB590', 'stitch': 'DAC6A0',
    'ground': 'EBE6DA',
}


def make_material(name, color):
    def linear(value):
        n = int(value, 16) / 255
        return n / 12.92 if n < .04045 else ((n + .055) / 1.055) ** 2.4
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = tuple(linear(color[i:i + 2]) for i in (0, 2, 4)) + (1,)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = mat.diffuse_color
    shader.inputs['Roughness'].default_value = .8
    if name == 'gold':
        shader.inputs['Metallic'].default_value = .55
        shader.inputs['Roughness'].default_value = .38
    return mat


def group(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj['focusTarget'] = True
    return obj


def assign(obj, name, mat, parent):
    obj.name = name
    obj.data.materials.append(MATS[mat])
    obj.parent = parent
    return obj


def mesh(name, vertices, faces, mat, parent):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(MATS[mat])
    obj.parent = parent
    return obj


def box(name, pos, size, mat, parent, bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = assign(bpy.context.object, name, mat, parent)
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Soft tailored edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def ellipsoid(name, pos, size, mat, parent, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=pos)
    obj = assign(bpy.context.object, name, mat, parent)
    obj.scale = size
    return obj


def cylinder(name, a, b, r1, r2, mat, parent, vertices=12):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=(b-a).length, location=(a+b)/2)
    obj = assign(bpy.context.object, name, mat, parent)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj


def tube(name, points, radius, mat, parent, sides=6):
    # Each ring uses a transported frame; all joins belong to one mesh.
    vertices = []
    for i, point in enumerate(points):
        p = Vector(point)
        tangent = Vector(points[min(i+1, len(points)-1)]) - Vector(points[max(0, i-1)])
        tangent.normalize()
        helper = Vector((0, 1, 0)) if abs(tangent.y) < .9 else Vector((1, 0, 0))
        u = tangent.cross(helper).normalized()
        v = tangent.cross(u).normalized()
        for j in range(sides):
            angle = math.tau * j / sides
            vertices.append(p + radius * (u * math.cos(angle) + v * math.sin(angle)))
    faces = [tuple(reversed(range(sides)))]
    for i in range(len(points)-1):
        for j in range(sides):
            a, b = i*sides+j, i*sides+(j+1)%sides
            faces.append((a, b, b+sides, a+sides))
    faces.append(tuple(range((len(points)-1)*sides, len(points)*sides)))
    return mesh(name, vertices, faces, mat, parent)


def loft(name, rings, mat, parent, count=16):
    """Rings are (height, half width, half depth, forward offset)."""
    verts = [(rx*math.cos(i*math.tau/count), cy+ry*math.sin(i*math.tau/count), z)
             for z, rx, ry, cy in rings for i in range(count)]
    faces = [tuple(reversed(range(count)))]
    for k in range(len(rings)-1):
        for i in range(count):
            a, b = k*count+i, k*count+(i+1)%count
            faces.append((a, b, b+count, a+count))
    faces.append(tuple(range((len(rings)-1)*count, len(rings)*count)))
    return mesh(name, verts, faces, mat, parent)


def head(parent):
    p = group('Head', parent)
    loft('Face', [(1.51,.12,.12,-.014), (1.56,.20,.167,-.005), (1.65,.255,.197,0),
                  (1.78,.275,.215,0), (1.88,.265,.20,.008), (1.97,.205,.165,.01),
                  (2.005,.095,.085,.01)], 'skin_light', p, 24)
    for side in (-1, 1):
        ellipsoid('Ear', (side*.273,0,1.755), (.057,.05,.078), 'skin', p)
        ellipsoid('Ear fold', (side*.299,-.034,1.755), (.026,.014,.042), 'blush', p)
        x = side*.105
        ellipsoid('Eye white', (x,-.206,1.779), (.069,.029,.067), 'eye_white', p, 20, 12)
        ellipsoid('Iris', (x+side*.005,-.231,1.778), (.037,.011,.046), 'iris', p, 20, 12)
        ellipsoid('Pupil', (x+side*.005,-.240,1.780), (.020,.006,.029), 'pupil', p)
        ellipsoid('Eye catchlight', (x-.008,-.246,1.797), (.009,.004,.011), 'glint', p, 12, 8)
        tube('Upper eyelid', [(x-.055,-.221,1.81),(x-.028,-.233,1.838),(x+.023,-.233,1.84),(x+.055,-.218,1.816)], .008, 'hair', p)
        tube('Eyebrow', [(x-.05,-.20,1.878),(x,-.219,1.895),(x+.046,-.20,1.885)], .015, 'hair', p)
        ellipsoid('Cheek', (side*.18,-.156,1.685), (.042,.019,.024), 'blush', p)
    ellipsoid('Nose', (0,-.225,1.709), (.036,.047,.041), 'skin', p, 12, 8)
    tube('Smile', [(-.060,-.177,1.634),(-.033,-.187,1.622),(0,-.191,1.618),(.033,-.187,1.622),(.060,-.177,1.634)], .007, 'hair', p)
    # A fitted cap with a variable hairline: short forehead, longer sides and nape.
    count = 32
    verts = []
    for ring in range(6):
        t = ring/6
        for i in range(count):
            a = math.tau*i/count
            front = max(0, -math.sin(a))
            bottom = 1.64 + .245*front**3
            z = bottom + (2.065-bottom)*t
            profile = math.sqrt(max(.01,1-((z-1.80)/.275)**2))
            verts.append((.289*profile*math.cos(a), .018+.229*profile*math.sin(a), z))
    verts.append((0,.02,2.071))
    faces = []
    for r in range(5):
        for i in range(count):
            a,b=r*count+i,r*count+(i+1)%count
            faces.append((a,b,b+count,a+count))
    for i in range(count): faces.append((5*count+i,5*count+(i+1)%count,6*count))
    mesh('Sculpted hair cap', verts, faces, 'hair', p)
    for x, z, tilt in [(-.19,1.938,-.32),(-.11,1.965,-.42),(-.015,1.985,-.46),(.085,1.997,-.40),(.176,1.982,-.30)]:
        lock = ellipsoid('Swept fringe', (x,-.155,z), (.071,.099,.11), 'hair_light' if x<-.1 else 'hair', p, 12, 8)
        lock.rotation_euler.y = tilt
    for side in (-1,1):
        cylinder('Sideburn', (side*.252,-.05,1.79),(side*.246,-.04,1.87),.025,.035,'hair',p)
    return p


def torso(parent):
    p = group('Torso', parent)
    cylinder('Neck', (0,0,1.39),(0,0,1.58),.092,.087,'skin',p)
    loft('Tailored jacket', [(.88,.225,.145,0),(.95,.23,.15,0),(1.16,.215,.148,0),
                            (1.35,.285,.17,0),(1.43,.26,.14,0),(1.46,.16,.11,0)], 'jacket', p)
    loft('Jacket hem', [(.885,.23,.15,0),(.94,.235,.155,0)],'jacket_dark',p)
    box('Zipper tape', (0,-.158,1.17),(.025,.015,.46),'lining',p,.004)
    box('Zipper pull', (0,-.182,1.35),(.03,.018,.045),'gold',p,.005)
    for side in (-1,1):
        pocket = box('Jacket pocket', (side*.137,-.139,1.03),(.115,.037,.12),'jacket_light',p,.012)
        pocket.rotation_euler.y = side*.06
        box('Pocket flap',(side*.137,-.164,1.085),(.127,.025,.029),'jacket_dark',p,.005)
        ellipsoid('Pocket snap',(side*.137,-.181,1.081),(.010,.005,.010),'gold',p,12,8)
    # Diagonal lapels and a contrasting collar make the torso read as clothing.
    for side in (-1,1):
        mesh('Jacket lapel', [(side*.075,-.132,1.42),(side*.235,-.09,1.41),(side*.13,-.18,1.25)],[(0,1,2)],'jacket_light',p)
    loft('Scarf collar', [(1.42,.135,.123,0),(1.475,.147,.132,0),(1.52,.13,.12,0)],'scarf',p)
    ellipsoid('Scarf knot',(.071,-.137,1.44),(.064,.045,.06),'scarf_shadow',p)
    scarf = box('Scarf tail',(.088,-.188,1.32),(.102,.028,.23),'scarf',p,.008)
    scarf.rotation_euler.y = -.16
    for x in (.048,.073,.098,.123):
        cylinder('Scarf tassel',(x,-.19,1.22),(x+.012,-.192,1.177),.006,.004,'scarf_shadow',p,6)
    # Explorer badge, on the upper left breast.
    cylinder('Badge backing',(-.17,-.168,1.278),(-.17,-.182,1.278),.042,.042,'gold',p,16)
    mesh('Badge mountain',[(-.193,-.194,1.26),(-.17,-.194,1.294),(-.147,-.194,1.26)],[(0,1,2)],'lining',p)


def arm(side, parent):
    p = group('LeftArm' if side<0 else 'RightArm',parent)
    shoulder=(side*.274,0,1.365)
    elbow=(side*.400,-.015,1.14)
    wrist=(side*.461,-.065,.947)
    ellipsoid('Shoulder seam',shoulder,(.105,.129,.13),'jacket',p)
    cylinder('Upper sleeve',elbow,shoulder,.088,.117,'jacket',p)
    ellipsoid('Elbow',elbow,(.087,.095,.091),'jacket',p)
    cylinder('Lower sleeve',wrist,elbow,.063,.089,'jacket_light',p)
    cylinder('Knitted cuff',(side*.453,-.058,.977),(side*.469,-.07,.923),.070,.065,'lining',p)
    ellipsoid('Palm',(side*.476,-.073,.868),(.057,.044,.083),'skin_light',p)
    # Four separate rounded fingers and an opposed thumb, in a relaxed pose.
    for i in range(4):
        x=side*(.435+i*.027)
        z=.812+(abs(i-1.5)*.009)
        cylinder('Finger',(x,-.077,.876),(x+side*.005,-.097,z),.014,.012,'skin_light',p,8)
        ellipsoid('Fingertip',(x+side*.005,-.097,z),(.012,.013,.018),'skin_light',p,12,8)
    cylinder('Thumb',(side*.433,-.076,.902),(side*.416,-.110,.850),.020,.015,'skin',p,10)
    ellipsoid('Thumb tip',(side*.416,-.110,.850),(.016,.018,.020),'skin_light',p)
    if side<0:
        cylinder('Watch strap',(side*.452,-.058,.98),(side*.465,-.067,.939),.074,.072,'leather',p)
        box('Watch face',(side*.465,-.135,.955),(.061,.019,.046),'gold',p,.008)
        box('Watch dial',(side*.465,-.148,.955),(.044,.01,.032),'lining',p,.005)


def leg(side,parent):
    p=group('LeftLeg' if side<0 else 'RightLeg',parent)
    hip=(side*.12,0,.925)
    knee=(side*.137,-.006,.56)
    ankle=(side*.15,.008,.21)
    cylinder('Trouser thigh',knee,hip,.104,.123,'pants',p,16)
    ellipsoid('Trouser knee',knee,(.102,.115,.12),'pants',p)
    cylinder('Trouser shin',ankle,knee,.076,.103,'pants',p,16)
    cylinder('Rolled trouser hem',(side*.15,.008,.27),(side*.15,.008,.33),.09,.09,'pants_light',p)
    box('Boot sole',(side*.15,-.069,.047),(.217,.355,.069),'sole',p,.027)
    box('Boot welt',(side*.15,-.069,.091),(.215,.347,.027),'leather_light',p,.018)
    box('Boot foot',(side*.15,-.070,.15),(.204,.32,.132),'leather',p,.045)
    cylinder('Boot shaft',(side*.15,.015,.12),(side*.15,.015,.278),.103,.09,'leather',p,16)
    cylinder('Boot collar',(side*.15,.015,.25),(side*.15,.015,.285),.098,.098,'leather_light',p,16)
    for i in range(3):
        z=.145+i*.035
        tube('Boot lace',[(side*.15-.045,-.130,z),(side*.15,-.145,z+.013),(side*.15+.045,-.130,z)],.0045,'stitch',p)
    box('Heel loop',(side*.15,.107,.25),(.035,.022,.08),'leather_light',p,.007)


def backpack(parent):
    p=group('Backpack',parent)
    box('Canvas pack',(0,.221,1.20),(.41,.235,.43),'canvas',p,.06)
    box('Leather base',(0,.225,1.013),(.408,.23,.079),'leather',p,.025)
    box('Top flap',(0,.26,1.393),(.43,.215,.12),'leather_light',p,.04)
    box('Outer pocket',(0,.362,1.15),(.25,.073,.17),'jacket_dark',p,.023)
    box('Pocket cover',(0,.382,1.23),(.274,.072,.035),'jacket',p,.01)
    for side in (-1,1):
        x=side*.145
        # Shoulder straps follow both sides of the torso and wrap over the shoulders.
        tube('Shoulder strap',[(x,.20,1.02),(side*.23,.12,1.23),(side*.235,.045,1.423),(side*.20,-.075,1.425),(side*.177,-.157,1.25),(side*.19,-.14,1.08)],.024,'leather',p,8)
        box('Strap buckle',(side*.184,-.169,1.14),(.064,.022,.072),'gold',p,.008)
        box('Buckle opening',(side*.184,-.182,1.14),(.034,.008,.04),'leather',p,.004)
        box('Flap strap',(side*.12,.371,1.328),(.041,.026,.12),'leather',p,.006)
        box('Flap buckle',(side*.12,.39,1.297),(.060,.018,.052),'gold',p,.005)
    tube('Carry handle',[(-.071,.235,1.43),(-.067,.235,1.49),(.067,.235,1.49),(.071,.235,1.43)],.015,'leather',p)
    # A rolled blanket adds a readable silhouette on the back.
    cylinder('Bedroll',(-.259,.255,1.51),(.259,.255,1.51),.079,.079,'jacket_dark',p,16)
    for side in (-1,1):
        cylinder('Bedroll binding',(side*.15-.016,.255,1.51),(side*.15+.016,.255,1.51),.083,.083,'leather_light',p,16)
    cylinder('Rolled blanket end',(.259,.255,1.51),(.263,.255,1.51),.054,.054,'jacket_light',p,16)


def studio():
    floor=box('Studio floor',(0,0,-.035),(200,200,.05),'ground',None,0)
    scene=bpy.context.scene
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.73,.79,.85,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
    for name,pos,energy,size in [('Studio key',(-3,-4,6),450,4),('Studio fill',(3,-1,3),150,3),('Studio rim',(1,3,4),350,3)]:
        data=bpy.data.lights.new(name,'AREA')
        obj=bpy.data.objects.new(name,data)
        bpy.context.collection.objects.link(obj)
        obj.location=pos
        obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
        data.energy,data.shape,data.size=energy,'DISK',size
    data=bpy.data.cameras.new('Studio camera')
    camera=bpy.data.objects.new('Studio camera',data)
    bpy.context.collection.objects.link(camera)
    camera.location=(3,-6,2.8)
    camera.rotation_euler=(Vector((0,0,1.06))-camera.location).to_track_quat('-Z','Y').to_euler()
    data.type,data.ortho_scale='ORTHO',2.65
    scene.camera=camera
    scene.render.engine='CYCLES'
    scene.cycles.samples=64
    scene.cycles.use_denoising=True
    scene.render.resolution_x,scene.render.resolution_y=1200,1400
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(OUT/'traveler.png')
    scene.view_settings.view_transform='AgX'


if __name__=='__main__':
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    MATS={name:make_material(name,color) for name,color in COLORS.items()}
    root=group('Traveler')
    root['title']='Milo the Traveler'
    root['units']='meters'
    root['rigged']=False
    root['description']='Static stylized humanoid with individually editable body parts and clothing.'
    torso(root)
    head(root)
    for side in (-1,1):
        arm(side,root)
        leg(side,root)
    backpack(root)
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH':
            assert not obj.data.validate(), f'Invalid generated mesh: {obj.name}'
    OUT.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(OUT/'traveler.glb'),export_format='GLB',use_selection=True,
                              export_cameras=False,export_lights=False,export_extras=True,export_animations=False)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(OUT/'traveler.glb'))
    bpy.context.view_layer.update()
    corners=[obj.matrix_world@Vector(v) for obj in bpy.context.scene.objects if obj.type=='MESH' for v in obj.bound_box]
    bounds=[max(p[i] for p in corners)-min(p[i] for p in corners) for i in range(3)]
    assert .8<bounds[0]<1.2 and .5<bounds[1]<.85 and 2<bounds[2]<2.2,bounds
    assert min(p.z for p in corners)>=-.001
    print(f'Character GLB reimport verified; dimensions: {bounds}')
    studio()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'traveler.blend'))
    bpy.ops.render.render(write_still=True)
