# ZOE BY AZ — v2 "magazin koji postaje atelje"

A static, responsive website for **ZOE BY AZ**, a dress boutique in Beograd at Kalenićeva 6.
It is an editorial fashion magazine with a real-time 3D atelier.
Customer copy is in Serbian (Latin script).

## Run

```bash
python tools/serve.py 5198
```

Open http://localhost:5198/. In `D:\CLAUDE\.claude\launch.json` this is `zoe-by-az-v2`.
Any static host works. There is no build step; three.js, GSAP and Lenis load from CDNs.

Dev flags: `?motion` forces full motion when the browser reports reduced motion
(headless and in-app browsers do). `?raw` uses native scroll without Lenis.

## Pages

| File | Content |
|---|---|
| `index.html` | cover → five shades → pinned 3D sequence → free atelier → five looks → horizontal lookbook → brand → contact |
| `kolekcija.html` | photographic catalog with a colour filter (filters exist only for data that exists) |
| `haljina.html?id=look-03&boja=crna` | product page with **Fotografije / 3D prikaz** tabs, colour, details and inquiry |
| `dev/viewer.html` | bare 3D viewer for QA, plus GLB export of the reference mannequin |

## Architecture

```
js/data.js          brand facts, COLORS, DESIGNS (geometry), ENTRIES (5 looks), catalog
js/site.js          selection store, Lenis, header contrast, menu, inquiry drawer, reveals, lightbox
js/atelier-ui.js    stage (poster / loading / fallback / HUD) + control panel, lazy-loads the viewer
js/atelier/
  body.js           single body definition the mannequin AND the dress are built from
  mannequin.js      owner's dress form (models/dressform.glb + measured profile), procedural fallback
  garment.js        procedural "korset mini" prototype (geometry + material targets)
  textures.js       procedural lace / weave textures (neutral, colour lives in materials)
  viewer.js         one renderer, scene modes, presets, colour tweening, GLB loader
js/home.js          homepage choreography
js/catalog.js, js/product.js
```

- **Selection state** (garment, colour, size, quantity) lives in `localStorage` and is
  shared by the viewer, product page and inquiry drawer. The product URL carries `?boja=`.
- **Explicit scene modes:** `scroll` (the pinned sequence drives the pose) and `manual`.
  The first drag, key press, preset or zoom switches to manual permanently, so scroll and
  hand never fight. Wheel never zooms; zoom uses buttons, `+`/`−` keys and presets.
- **Performance:** the viewer module and three.js are imported only when the stage is
  within about 900 px. There is one renderer per page, rendering is on demand and pauses
  off-screen, DPR is capped (1.75 desktop / 1.5 mobile), and at most two lace texture
  sets are kept. Slow or data-saver connections get a "Pokreni 3D prikaz" button.
  Without WebGL, photos are shown instead.
- **Accessibility:** skip link, labelled controls, radiogroup swatches with arrow keys,
  ARIA tabs, focus-trapped drawer, keyboard-rotatable canvas, reduced-motion build
  (no pins, no smooth scroll).

## Inquiry

There is no backend. With `INQUIRY.endpoint = null` (in `js/data.js`) the form validates,
writes the message and copies it to the clipboard (with a fallback to a visible text box).
It then offers **Instagram Direct (@zoebyaz)**. It says explicitly that nothing has been
sent yet. Setting `endpoint` to a JSON form service turns on real sending, and a success
message appears only after a 2xx response.

## Honesty notes

See **ASSETS.md** for the fidelity statement, observed vs inferred construction,
missing content and the GLB replacement workflow. In short:

- The mannequin is the owner-supplied dress form (`g2f-dress-mannequin`).
- The 3D dress is an **approximate prototype from photos**, not a replica, fitted to the form's measured shape.
- Look names are temporary. Only the photographed colour per look is verified;
  the other four are labelled preview configurations.
- Prices, sizes, materials, care, email and phone were not available and are not shown.
- Verified from Instagram (Oct 2026): name, address, opening hours, "dolazak se ne zakazuje".
