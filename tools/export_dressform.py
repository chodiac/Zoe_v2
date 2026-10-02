"""Blender (3.4+) headless: export the owner-supplied dress form as an optimised
GLB + measure its torso as a radial profile the procedural dress is fitted to.

  blender -b <Sketchfab_...blend> --python tools/export_dressform.py

Outputs (project root):
  models/dressform.glb             'Dress Mannequin Pure' + 'Dress Mannequin Stick'
  models/dressform-profile.json    r(phi, y) table in three.js space (Y up, +Z front)
"""
import bpy, json, math, os, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "models")
os.makedirs(OUT, exist_ok=True)

KEEP = {"Dress Mannequin Pure", "Dress Mannequin Stick"}
for o in list(bpy.data.objects):
    if o.name not in KEEP:
        bpy.data.objects.remove(o, do_unlink=True)

# bake transforms so mesh data == world space
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = bpy.data.objects["Dress Mannequin Pure"]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# downscale 4K textures (web budget): body 2K, stick 1K
for img in bpy.data.images:
    if img.size[0] == 0:
        continue
    target = 1024 if "Stick" in img.name else 2048
    if "Height" in img.name:
        continue
    if img.size[0] > target:
        img.scale(target, target)

# ---------------------------------------------------------------- profile
body = bpy.data.objects["Dress Mannequin Pure"]
bvh = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
zs = [v.co.z for v in body.data.vertices]
zmin, zmax = min(zs), max(zs)

def hit(origin, d):
    loc, nrm, idx, dist = bvh.ray_cast(Vector(origin), Vector(d).normalized(), 2.0)
    return dist

# slice centres (Blender: front = -Y) → one shared vertical axis
cy, n = 0.0, 0
step = 0.005
heights = []
z = zmin + 0.004
while z < zmax - 0.004:
    heights.append(round(z, 4)); z += step
for z in heights:
    f = hit((0, -1, z), (0, 1, 0)); b = hit((0, 1, z), (0, -1, 0))
    if f is not None and b is not None:
        cy += ((-1 + f) + (1 - b)) / 2; n += 1
cy /= max(n, 1)

NPHI = 96
rows = []
for z in heights:
    row = []
    for i in range(NPHI):
        phi = -math.pi + 2 * math.pi * i / NPHI
        d = (math.sin(phi), -math.cos(phi), 0.0)    # three +Z front == Blender -Y
        # cast from outside inwards → outermost surface (robust for any shell)
        o = (d[0] * 1.0, cy + d[1] * 1.0, z)
        t = hit(o, (-d[0], -d[1], 0))
        row.append(None if t is None else round(1.0 - t, 5))
    rows.append(row)

# fill holes (open neck/hip rims) by nearest valid in the same row
for row in rows:
    valid = [r for r in row if r is not None]
    m = sum(valid) / len(valid) if valid else 0
    for i, r in enumerate(row):
        if r is None:
            row[i] = round(m, 5)

stick = bpy.data.objects["Dress Mannequin Stick"]
sz = [v.co.z for v in stick.data.vertices]
profile = {
    "source": "Dress Mannequin Pure (g2f-dress-mannequin, Sketchfab_2021_03_04_15_05_52.blend)",
    "space": "three.js metres, Y up, +Z front; radii measured from the axis x=0, z=axisZ",
    "axisZ": round(-cy, 5),
    "y": heights,
    "nphi": NPHI,
    "r": rows,
    "standMinY": round(min(sz), 4), "standMaxY": round(max(sz), 4),
}
with open(os.path.join(OUT, "dressform-profile.json"), "w") as fh:
    json.dump(profile, fh, separators=(",", ":"))
print("PROFILE rows", len(rows), "z", round(zmin, 3), round(zmax, 3), "axisY(blender)", round(cy, 4))

# ---------------------------------------------------------------- GLB
bpy.ops.object.select_all(action="SELECT")
kw = dict(filepath=os.path.join(OUT, "dressform.glb"), export_format="GLB", use_selection=True,
          export_yup=True, export_apply=True, export_image_format="JPEG", export_texcoords=True,
          export_normals=True, export_materials="EXPORT", export_animations=False, export_skins=False)
try:
    bpy.ops.export_scene.gltf(**kw, export_jpeg_quality=82)
except TypeError:
    bpy.ops.export_scene.gltf(**kw)
print("GLB", os.path.getsize(kw["filepath"]))
