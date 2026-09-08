"""Create a physically settled linen duvet using Blender Cloth, in real metres."""
import bpy, math, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'public/models/hotel';out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def cube(name,location,size,bevel):
 bpy.ops.mesh.primitive_cube_add(size=1,location=location)
 o=bpy.context.object;o.name=name;o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 b=o.modifiers.new('Upholstered edges','BEVEL');b.width=bevel;b.segments=4
 bpy.ops.object.modifier_apply(modifier=b.name)
 for p in o.data.polygons:p.use_smooth=True
 return o
base=cube('bed_base',(0,0,.18),(1.65,2.12,.30),.035)
mattress=cube('mattress',(0,0,.425),(1.62,2.08,.24),.07)
mattress.modifiers.new('Linen collision','COLLISION')
mattress.collision.thickness_outer=.016
pillow=[]
for x in [-.39,.39]:
 p=cube('pillow',(x,.71,.635),(.69,.44,.18),.085);p.rotation_euler.z=x*.045;pillow.append(p)
 p.modifiers.new('Pillow collision','COLLISION');p.collision.thickness_outer=.012
# The cover starts above the mattress; gravity settles the unsupported edges.
verts=[];faces=[];nx=52;ny=62
for j in range(ny+1):
 for i in range(nx+1):
  x=(i/nx-.5)*2.12;y=(j/ny-.5)*2.20-.20
  z=.75+.020*math.sin(x*18+y*7)+.012*math.sin(y*22-x*8)
  verts.append((x,y,z))
for j in range(ny):
 for i in range(nx):
  a=j*(nx+1)+i;faces.append((a,a+1,a+nx+2,a+nx+1))
mesh=bpy.data.meshes.new('Cotton weave');mesh.from_pydata(verts,[],faces);mesh.update()
cover=bpy.data.objects.new('duvet',mesh);bpy.context.collection.objects.link(cover)
uv=mesh.uv_layers.new()
for p in mesh.polygons:
 p.use_smooth=True
 for li in p.loop_indices:
  v=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(v.x/.27,v.y/.27)
bpy.context.view_layer.objects.active=cover
cloth=cover.modifiers.new('Cotton settling','CLOTH');s=cloth.settings
s.quality=7;s.mass=.28;s.tension_stiffness=14;s.compression_stiffness=12;s.shear_stiffness=8;s.bending_stiffness=.65
cloth.collision_settings.use_self_collision=True;cloth.collision_settings.self_distance_min=.006;cloth.collision_settings.distance_min=.012
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=55
for frame in range(1,56):scene.frame_set(frame)
bpy.ops.object.modifier_apply(modifier=cloth.name)
solid=cover.modifiers.new('Duvet thickness','SOLIDIFY');solid.thickness=.018;bpy.ops.object.modifier_apply(modifier=solid.name)
for obj in [mattress,*pillow]:
 for modifier in list(obj.modifiers):obj.modifiers.remove(modifier)
for obj in [base,mattress,*pillow]:
 # Physical texture scale on upholstered primitives.
 if obj.data.uv_layers:
  for loop in obj.data.uv_layers.active.data:loop.uv*=3
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(out/'settled-bed-v64.glb'),export_format='GLB',export_materials='NONE',export_normals=True,export_texcoords=True)
(out/'SOURCES.md').write_text('Original model created with Blender 4.5.9 LTS. Real-scale mattress, rounded pillows and a 55-frame gravity-settled Cloth duvet; no third-party model. Linen PBR maps: the existing Poly Haven rough_linen (see public/materials/textile/SOURCES.md). Generator: scripts/build-hotel-bed.py.\n',encoding='utf-8')
print('BED_EXPORTED',str(out/'settled-bed-v64.glb'),flush=True)
