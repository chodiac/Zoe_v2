import bpy, mathutils
print("=== SCENE", bpy.context.scene.name, "unit", bpy.context.scene.unit_settings.scale_length)
for o in bpy.data.objects:
    bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box] if o.type=='MESH' else []
    mn = [min(v[i] for v in bb) for i in range(3)] if bb else None
    mx = [max(v[i] for v in bb) for i in range(3)] if bb else None
    info = ""
    if o.type=='MESH':
        info = f"verts={len(o.data.vertices)} polys={len(o.data.polygons)} mats={[m.name if m else None for m in o.data.materials]} uv={[u.name for u in o.data.uv_layers]}"
    print(f"OBJ {o.name!r} type={o.type} parent={o.parent.name if o.parent else None} loc={tuple(round(x,3) for x in o.location)} rot={tuple(round(x,3) for x in o.rotation_euler)} scale={tuple(round(x,3) for x in o.scale)} min={mn and [round(x,3) for x in mn]} max={mx and [round(x,3) for x in mx]} {info}")
for m in bpy.data.materials:
    if not m.use_nodes: continue
    imgs = [n.image.name for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]
    print("MAT", m.name, imgs)
for i in bpy.data.images:
    print("IMG", i.name, i.size[:], i.filepath)
