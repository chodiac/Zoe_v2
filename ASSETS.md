# ZOE BY AZ — 3D assets, fidelity and replacement workflow

## 1. What the reference photographs show

Nine owner-supplied images are stored in `_ref/`, mostly Instagram screenshots and stills.
`tools/process_images.py` crops them into `img/`. The crops remove the Instagram
profile and mute icons and the screenshot borders. Nothing is retouched.

**Conclusion: the five photographed dresses are ONE construction in five colours.**
They differ in lace surface (sequins, beads, raised appliqué), not in cut. The data
model reflects this: `DESIGNS['korset-mini']` holds one shared geometry, and five
`ENTRIES` (Look 01–05) point at it. Each entry has its own photos, its photographed
colour and its lace parameters. No extra silhouettes were invented.

| Feature | Seen in | Status |
|---|---|---|
| Strapless corset bodice, sweetheart neckline with scalloped lace edge | 1, 4, 7, 9 | **observed** |
| Folded / gathered band across the bust, pinched centre | 1 (pink), 4 + 7 (blue) | **observed** (not clearly visible on black / ivory / yellow front) |
| Curved (basque) waist seam with satin / pleated trim, dipping to the hips | 1, 4, 7 | **observed** |
| Short skirt with strong hip volume, lace over a base layer | all | **observed** |
| Long lace sleeves starting below the shoulder, flared at the wrist | 1–6, 8 | **observed** |
| Lace-up corset back | 5 (blue), 8 (yellow) | **observed** |
| Black: sequinned lace | 2, 3, 6 | **observed** |
| Ivory: raised floral lace | 9 (group crop only) | **observed, low resolution** |
| Yellow front | 9 (group only) | **inferred** from the group photo |
| Sleeves are separate pieces (not sewn to the bodice) | gap visible in 1, 5 | **inferred** |
| Internal boning, lining, closure type, exact eyelet count | — | **inferred / unknown** |

### Revision 7 — bust, back to a natural shape (current)
Revisions 5–6 (cup domes, sling drape, winged satin) were rolled back.
- **Neckline:** a natural sweetheart defined in metres across the chest: two round lobes, a dip of about 3.5 cm at the centre, and soft bell curves easing down to the side line.
- **Cups:** they follow the dress form's real bust, with only gentle rounding of up to about 0.8 cm.
- **Satin band:** a calm band over the lower half of the cups, gathered a little narrower into a rounded keeper, with soft folds; the ends taper into the side seams.

### Revision 6 — bust (owner's render reference; rolled back)
- **Cups:** sculpted cup domes add about 2.4 cm of projection, because the dress form's own bust is small. There is a visible cleavage between the domes.
- **Satin drape:** a sling over the lower cups. Its top edge rises from the keeper toward the outer cup and its bottom edge sags under each cup. Folds fan out from the keeper with rounded crests and sharp valleys, the edges are rolled, and the ends taper as they wrap to the side seams.
- **Keeper:** a rounded wrapped knot sitting in the cleavage.
- **Neckline:** the edge stays higher over the side, as in the 3/4 reference.

### Revision 5 — bust
- **Neckline:** two round arches, one per cup, meeting in a shallow centre dip. On the outside each arch curves down and continues over the side toward the back.
- **Satin band:** redone from the reference. It is a straight, wide band across the bust that wraps to the side seams: a flat satin face, long soft horizontal folds that bunch and fan into the keeper, and a slightly narrower gathered centre under a clean rectangular keeper. The earlier "wings" are gone. See `docs-3d-bust-comparison.jpg`.

### Revision 4
- **Length:** the dress is about 5.7 cm longer (hem = waist − 38.5 cm).
- **Neckline:** a heart shape with two rounded lobes and a deep centre dip. From the cup the edge curves down over the side to a lower, straight back.
- **Back:** the skirt is lifted over the seat (more volume at the top of the back, both in the gathered sides and in the back panel) and the back hem is about 1.2 cm higher.
- **Lace:** the owner-supplied rose lace pattern (`_ref/lace-pattern.webp`) is converted by `tools/make_lace.py` into `img/lace/rose-coverage.png` (1024², coverage map). It is tiled with mirrored repeat, so there is no seam or ghosting, at 20 cm per tile (roses about 4 cm). Colour, sparkle and relief are still generated per variant. If the file is missing, the procedural lace is used instead.

### Revision 3 (owner's full modeling reference sheet)

- **Skirt:** bell-shaped side volume (no hip ledge), deeper at the back. 13 folds per side, with rounded crests and narrower valleys, start at the satin bands and fan out toward the hem. They are irregular in width and get deeper toward the hem, and the hem follows them.
- **Bust drape:** a "bow-tie", narrow at the keeper and full over the lower cups. Its folds converge on the keeper, the top edge is rolled, and it wraps to the side seam. The keeper is larger and stands out, and the upper lace cups stay visible above it.
- **Seams:** princess seams on the fitted central panel and side seams; a centre-back seam on the skirt. The open V back is wider.
- **Sleeves:** a slim sheer sleeve, a ruched band at the wrist, and a separate flared cuff flounce (elliptical opening, ruffles, scalloped edge). The sleeves are about 2.8 cm clear of the skirt.
- **Satin bands:** about 2.7 cm wide, soft flat ribbons with diagonal creases.

### Revision 2 of the garment construction (based on the owner's photos + front/back sketch)

| Part | Built as | Source |
|---|---|---|
| Elongated central panel (front and back) | fitted over the abdomen/seat, then an A-line to the hem | photos + sketch |
| Gathered sides | hip volume, broad irregular folds, fine gathers at the seam | photos |
| 4 satin bands | flat draped ribbons with edge thickness, from the hips inward to the hem | front + upper back: photos · **lower back: sketch (inferred)** |
| Bust | sculpted cups, bridged centre, draped satin overlay with soft folds, small rectangular keeper | bust close-up photo |
| Open back | two separate rear panels, V gap, bound edges, crossed cords over empty space | back photos |
| Sleeves | separate floating meshes on a relaxed arm path, scalloped cuff, unlined (more transparent) | photos |
| Removed | waist piping, teardrop at the bust centre | — |

`docs-3d-comparison.jpg` places the reference sheet next to the 3D model (3/4 front, back, side, bust detail).

## 2. Fidelity status

| Asset | State | Notes |
|---|---|---|
| Finished 3D garment supplied by the owner | **none** | — |
| `korset-mini` dress | **approximate prototype from photographs** | Procedural mesh in `js/atelier/garment.js`. It has real geometry with thickness offsets, separate materials per part and procedural lace textures. It is **not** an exact or production-accurate replica. |
| Mannequin (dress form) | **finished asset, supplied by the owner** | `g2f-dress-mannequin` (Sketchfab .blend). Exported by `tools/export_dressform.py` to `models/dressform.glb` (about 5 MB; 4K textures downscaled to 2K/1K). Uses the "Pure" leather body and the wooden stand; the gingham "Alighment" variant and the Genesis 2 armature are dropped. |
| Fallback mannequin | procedural | `js/atelier/mannequin.js` → `buildMannequin()`. Used automatically if the GLB or profile fails to load. |
| Production-accurate GLB of `korset-mini` | **missing — needs professional modelling** | Blender / CLO / Marvelous Designer |
| Other silhouettes | **none needed yet** | No photographs of other cuts were supplied |

**Fit to the dress form:** the export script raycasts the form's torso in Blender and writes
`models/dressform-profile.json`, a radius table r(φ, y) with 96 angles and 5 mm rows.
`setBodyProfile()` (`js/atelier/body.js`) loads it and measures the landmarks
(waist ≈ 1.189 m, bust ≈ 1.334 m, shoulders ≈ 1.49 m). The dress is then built on that
measured surface plus a fabric offset (satin +9 mm, lace +12.5 mm, trims +13.5–25 mm), so it
does not clip into the form. The noisy open hip rim (bottom 3 cm) is ignored, and below the
hips the skirt hangs free.

**Sleeves:** the dress form has no arms. The sleeves are independent meshes that float where
the arms would be, and they rotate together with the dress. Clearance check:
`__zba.clearance()` gives about 35 mm between sleeve and skirt.

## 3. Missing content (to be supplied by the brand)

- Product names (Look 01–05 are temporary reference labels), prices, sizes,
  materials, care information and availability.
- Which colour × design combinations are actually sold. All non-photographed
  colours are labelled "pregled" (preview).
- Clean, high-resolution photos. The current sources are about 700 px wide screenshots.
  Look 05 (ivory) exists only as a crop from the group photo.
- Photos and data for **all other dresses** in the catalog (`CATALOG_EXTRA` in `js/data.js`).
- Email, phone, policies and an inquiry backend (see `INQUIRY.endpoint`).
- Founder or designer name and role. None is shown on the site until the brand confirms it.

## 4. Replacing a prototype with a finished GLB (no interface changes)

1. The reference body is the owner's dress form: `models/dressform.glb` (or the original
   .blend). Use metres, Y-up, the stand base at y = 0, and +Z as front. `dev/viewer.html` → **export mannequin.glb**
   exports exactly what the viewer shows.
   **export prototype.glb** also includes the current dress for reference.
2. Model or simulate the dress on that body (Blender / CLO / Marvelous Designer).
   Keep the same units, axis and origin. Do not move or scale the body.
3. Name meshes or materials so they map to colour targets. Matching is
   "name contains", case-insensitive, configured in `DESIGNS[...].materialTargets`:
   `shell` · `lace` · `trim` · `lining` · `sleeve` · `cord`.
   Unmatched meshes default to `shell`.
4. Author colourable textures **neutral** (white / grey albedo). The viewer
   multiplies `material.color` per target, so all five colours keep the authored
   texture, normal and roughness detail. Lace should use alpha (cut-out) and
   `alphaTest`, not blended transparency.
5. Export `models/korset-mini.glb`. Keep it under about 8 MB; use 2K textures and
   WebP/KTX2 where possible. If you use Draco or KTX2 compression, register
   `DRACOLoader` / `KTX2Loader` in `loadGLBParts()` (`js/atelier/viewer.js`). It is
   not wired in yet.
6. In `js/data.js` set `DESIGNS['korset-mini'].model.src = 'models/korset-mini.glb'`
   and `status = 'final'`. Nothing else changes: the panel badge switches from
   "3D prototip" to "3D model". If the GLB fails to load, the viewer falls back to the
   procedural prototype automatically.
7. A genuinely different silhouette is a **new** `DESIGNS` entry with its own `src`.
   Point the matching `ENTRIES[i].design` at it, and the viewer loads that geometry only
   when the entry is selected. Colour-only changes never reload geometry.
8. A colour that needs its own texture (for example a printed version) is not
   modelled yet. Add a `textures` object to that `COLORS` entry and apply it in
   `setColour()`.

Mannequin replacement: put another GLB through `tools/export_dressform.py`
(run with `blender -b file.blend --python tools/export_dressform.py`, after adjusting the
`KEEP` object names). It writes both the GLB and the measured profile, so the dress refits
automatically. `MANNEQUIN` in `js/atelier/mannequin.js` points at both files, and
`hasArms: true` shows the sleeves on the mannequin.
