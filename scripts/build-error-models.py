"""Blender 4.5 LTS: carved masks and a turned, bevelled fusuma pull. Reproducible GLBs."""
import bpy, json, math, pathlib
from mathutils import Vector

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models/error'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bases=json.loads((ROOT/'assets/blender/error-bases.json').read_text())
objects=[]
for name,data in bases.items():
    verts=[(data['positions'][i],-data['positions'][i+2],data['positions'][i+1]) for i in range(0,len(data['positions']),3)]
    faces=[data['indices'][i:i+3] for i in range(0,len(data['indices']),3)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    uv=mesh.uv_layers.new(name='UVMap');col=mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
    for loop in mesh.loops:uv.data[loop.index].uv=data['uvs'][loop.vertex_index*2:loop.vertex_index*2+2]
    for i,c in enumerate(col.data):c.color=(*data['colors'][i*3:i*3+3],1)
    # Weld authored face corners before calculating bevels and smooth normals.
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=0.000001);bpy.ops.object.mode_set(mode='OBJECT')
    if name!='pull':
        # Preserve aperture rims/cavity bottoms while relaxing broad cheek polygons.
        group_name='Carved face';group=obj.vertex_groups.new(name=group_name)
        for i,v in enumerate(mesh.vertices):
            if mesh.color_attributes['Col'].data[i].color[0]>.85:group.add([i],.7,'REPLACE')
        sub=obj.modifiers.new('Carving subdivisions','SUBSURF');sub.subdivision_type='SIMPLE';sub.levels=1
        bpy.ops.object.modifier_apply(modifier=sub.name)
        smooth=obj.modifiers.new('Hand carved transitions','SMOOTH');smooth.factor=.18;smooth.iterations=3;smooth.vertex_group=group_name
        bpy.ops.object.modifier_apply(modifier=smooth.name)
        tex=bpy.data.textures.new(name+' lacquer grain',type='CLOUDS');tex.noise_scale=.012;tex.noise_depth=1
        dis=obj.modifiers.new('Submillimetre lacquer relief','DISPLACE');dis.texture=tex;dis.strength=.00055;dis.mid_level=.5;dis.vertex_group=group_name
        bpy.ops.object.modifier_apply(modifier=dis.name)
        dec=obj.modifiers.new('Mobile silhouette budget','DECIMATE');dec.ratio=.64
        bpy.ops.object.modifier_apply(modifier=dec.name)
    else:
        bevel=obj.modifiers.new('Turned lip edge','BEVEL');bevel.width=.00075;bevel.segments=2;bevel.limit_method='ANGLE';bevel.angle_limit=.22
        bpy.ops.object.modifier_apply(modifier=bevel.name)
    for p in obj.data.polygons:p.use_smooth=True
    # Export local modelling coordinates. Blender's glTF exporter restores web Y-up.
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_materials='NONE',export_vertex_color='NAME',export_vertex_color_name='Col',export_all_vertex_colors=True,export_active_vertex_color_when_no_material=True)
    print('ASSET',name,'triangles',sum(len(p.vertices)-2 for p in obj.data.polygons))
    obj.select_set(False);objects.append(obj)

# Keep an editable modelling file, separate from the light runtime exports.
for obj in objects:
    if obj.name=='inverse':obj.location.x=-.24
    if obj.name=='weeping':obj.location.x=.24
    if obj.name=='pull':obj.hide_render=True;obj.hide_set(True)
mat=bpy.data.materials.new('Aged lacquer');mat.use_nodes=True
nodes=mat.node_tree.nodes;shader=nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=.82
photo=nodes.new('ShaderNodeTexImage');photo.image=bpy.data.images.load(str(ROOT/'public/materials/enemies/ritual-mask-v60.png'))
vertex=nodes.new('ShaderNodeVertexColor');vertex.layer_name='Col'
mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
mat.node_tree.links.new(photo.outputs['Color'],mix.inputs[1]);mat.node_tree.links.new(vertex.outputs['Color'],mix.inputs[2]);mat.node_tree.links.new(mix.outputs[0],shader.inputs['Base Color'])
for obj in objects[:2]:obj.data.materials.append(mat)
camera_data=bpy.data.cameras.new('Sculpt review');camera=bpy.data.objects.new('Sculpt review',camera_data);bpy.context.collection.objects.link(camera)
camera.location=(0,-1.45,.0);camera.rotation_euler=(Vector((0,0,-.025))-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=.95;bpy.context.scene.camera=camera
lamp_data=bpy.data.lights.new('Softbox',type='AREA');lamp_data.energy=35;lamp_data.shape='DISK';lamp_data.size=.7
lamp=bpy.data.objects.new('Softbox',lamp_data);bpy.context.collection.objects.link(lamp);lamp.location=(-.55,-.75,.8);lamp.rotation_euler=(Vector((0,0,0))-lamp.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.world.color=(.06,.055,.05)
scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'work/error-masks-blender-v62.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/error-models.blend'))
bpy.ops.render.render(write_still=True)
