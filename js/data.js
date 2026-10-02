/* ==========================================================================
   ZOE BY AZ — product + asset manifest
   --------------------------------------------------------------------------
   Single source of truth for every page and for the 3D atelier.
   Presentation code never hard-codes a product, a photo or a model path.

   Separation (as requested in the brief):
     DESIGNS  — garment CONSTRUCTION (geometry). One entry per distinct
                silhouette. Geometry is built / loaded once and reused.
     COLORS   — the configurable colour variants (material colours only).
     ENTRIES  — the five featured garment entries (photographed looks).
                Each points at a design + carries its own photos, its
                photographed colour and its lace/surface parameters.
     CATALOG  — every product shown in the photographic collection.

   VERIFIED FACTS ONLY. Anything not confirmed by the brand is either
   omitted or explicitly marked (see `status`, `verified`, `todo`).
   ========================================================================== */

export const BRAND = {
  name: 'ZOE BY AZ',
  instagram: 'https://www.instagram.com/zoebyaz/',
  instagramHandle: '@zoebyaz',
  instagramDM: 'https://ig.me/m/zoebyaz',
  // Verified from the public Instagram profile (bio + business info), Oct 2026
  city: 'Beograd',
  address: 'Kalenićeva 6',
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=Kaleni%C4%87eva+6%2C+Beograd',
  hours: [
    { days: 'Ponedeljak – petak', time: '13 – 19 h' },
    { days: 'Subota', time: '11 – 17 h' },
  ],
  walkIn: 'Dolazak se ne zakazuje.',
  // NOT available — do not invent. Fill in when the brand supplies them.
  email: null,
  phone: null,
  website: null,
  policies: null,
};

/* --------------------------------------------------------------------------
   Inquiry delivery. There is no backend in this project.
   Set `endpoint` to a form service URL (Formspree, Basin, own API …) that
   accepts a JSON POST. While it is null the form composes the message,
   copies it and hands the visitor over to Instagram Direct — it never shows
   a fake "sent" confirmation.
   -------------------------------------------------------------------------- */
export const INQUIRY = {
  endpoint: null,
  // e.g. 'https://formspree.io/f/xxxxxxx'
};

/* --------------------------------------------------------------------------
   COLOURS — garment material colours per material target.
   Targets: shell (satin base), lace (lace overlay), trim (bust fold, waist
   band, binding), lining (inside), sleeve (detached lace sleeves), cord
   (back lacing). `ui` is a muted swatch colour for the interface.
   -------------------------------------------------------------------------- */
export const COLORS = {
  'puder-roze': {
    label: 'Puder roze', en: 'Blush pink', ui: '#E3B8BE',
    targets: { shell: '#E0A8B3', lace: '#EABFC7', trim: '#DCA0AC', lining: '#F1DADE', sleeve: '#EDC6CD', cord: '#D4919F' },
  },
  'crna': {
    label: 'Crna', en: 'Black', ui: '#1D1B1D',
    targets: { shell: '#111012', lace: '#1A181C', trim: '#0D0C0E', lining: '#1F1C20', sleeve: '#1A181C', cord: '#0B0A0C' },
  },
  'svetloplava': {
    label: 'Svetloplava', en: 'Pale blue', ui: '#BCD2E2',
    targets: { shell: '#A6C2DA', lace: '#BDD4E6', trim: '#9DBCD6', lining: '#D3E1EC', sleeve: '#C6DBEA', cord: '#93B4D0' },
  },
  'puter-zuta': {
    label: 'Puter žuta', en: 'Butter yellow', ui: '#EEDDA0',
    targets: { shell: '#EAD487', lace: '#F1E2A6', trim: '#E4CC7C', lining: '#F5ECC9', sleeve: '#F3E6B4', cord: '#D8BE6C' },
  },
  'slonovaca': {
    label: 'Slonovača', en: 'Ivory', ui: '#ECE4D3',
    targets: { shell: '#E4DAC6', lace: '#EFE8DA', trim: '#DED2BB', lining: '#EEE8DC', sleeve: '#F0EADF', cord: '#D6C9AF' },
  },
};
export const COLOR_ORDER = ['slonovaca', 'puder-roze', 'svetloplava', 'puter-zuta', 'crna'];

/* --------------------------------------------------------------------------
   DESIGNS — construction. Reference analysis (see ASSETS.md):
   all five photographed dresses show the SAME construction — strapless
   corset bodice, sweetheart neckline, folded band across the bust, curved
   (basque) waist seam with satin/pleated trim, short skirt with strong hip
   volume, detached long lace sleeves, lace-up back. They differ in colour
   and in lace surface (sequin lace on black, raised floral on ivory …).
   → ONE design, shared geometry. A future distinct silhouette = a new
     design entry with its own `model.src`.
   -------------------------------------------------------------------------- */
export const DESIGNS = {
  'korset-mini': {
    name: 'Korset mini silueta',
    model: {
      // Drop a finished GLB here (see ASSETS.md) — the viewer loads it instead
      // of the procedural prototype without any interface change.
      src: null,                 // e.g. 'models/korset-mini.glb'
      procedural: 'corsetMini',  // fallback builder in js/atelier/garment.js
      status: 'prototype',       // 'final' | 'prototype' | 'missing'
    },
    // Mesh / material names inside a supplied GLB that belong to each target.
    // Matching is case-insensitive "name contains".
    materialTargets: {
      shell: ['shell', 'bodice_base', 'skirt_base', 'satin'],
      lace: ['lace_overlay', 'lace_body', 'lace_skirt'],
      trim: ['trim', 'bust_fold', 'waist_band', 'binding'],
      lining: ['lining', 'inner'],
      sleeve: ['sleeve'],
      cord: ['cord', 'lacing'],
    },
    visible: [
      'Korset-gornji deo bez bretela',
      'Srcoliki izrez sa čipkanim festonom',
      'Presavijena traka preko grudi',
      'Zakrivljen šav struka sa trakom',
      'Kratka suknja sa izraženim volumenom na bokovima',
      'Čipka preko podloge',
      'Duge čipkane rukavice-rukavi, ispod ramena',
      'Vezivanje na leđima (korset)',
    ],
    inferred: [
      'Unutrašnja podstava i konstrukcija korseta (nije vidljivo na fotografijama)',
      'Tačan broj ušica i dužina vezivanja',
      'Način pričvršćivanja rukava (verovatno samostalni rukavi)',
      'Prednja strana žutog modela — vidljiva samo na grupnoj fotografiji',
    ],
  },
};

/* --------------------------------------------------------------------------
   FEATURED ENTRIES — the five photographed looks.
   Names are TEMPORARY reference labels (the brand has not supplied product
   names). `photoColor` is the only colour verified by a photograph; every
   other colour is a PREVIEW CONFIGURATION, not a confirmed product.
   -------------------------------------------------------------------------- */
export const ENTRIES = [
  {
    id: 'look-01', no: '01', design: 'korset-mini',
    label: 'Look 01', tempName: 'Korset mini — puder roze', nameVerified: false,
    photoColor: 'puder-roze',
    caption: 'Puder roze čipka i nabrana traka preko grudi. Volumen počinje odmah ispod zakrivljenog šava.',
    photos: [
      { src: 'img/blush-front.webp', w: 725, h: 1248, alt: 'Puder roze korset mini haljina, spreda', view: 'Spreda' },
      { src: 'img/detalj-blush-korset.webp', w: 270, h: 340, alt: 'Detalj puder roze haljine: korset i nabrani šav na boku', view: 'Detalj' },
      { src: 'img/blush-grupa.webp', w: 184, h: 480, alt: 'Puder roze haljina na grupnoj fotografiji', view: 'Grupna fotografija' },
    ],
    poster: 'img/blush-front.webp',
    surface: { lace: 'floral', density: 0.95, sparkle: 0.18, relief: 0.8, seed: 11 },
  },
  {
    id: 'look-02', no: '02', design: 'korset-mini',
    label: 'Look 02', tempName: 'Korset mini — crna', nameVerified: false,
    photoColor: 'crna',
    caption: 'Crna čipka sa šljokicama. Najbolje se vidi u pokretu — svetlo hvata površinu suknje.',
    photos: [
      { src: 'img/noir-front.webp', w: 718, h: 1246, alt: 'Crna korset mini haljina, poluprofil', view: 'Poluprofil' },
      { src: 'img/noir-back.webp', w: 727, h: 878, alt: 'Crna korset mini haljina, pogled otpozadi', view: 'Otpozadi' },
      { src: 'img/noir-turn.webp', w: 709, h: 1246, alt: 'Crna korset mini haljina u okretu', view: 'U pokretu' },
      { src: 'img/detalj-noir-sljokice.webp', w: 490, h: 360, alt: 'Detalj crne suknje sa čipkom i šljokicama', view: 'Detalj' },
      { src: 'img/noir-grupa.webp', w: 205, h: 612, alt: 'Crna haljina na grupnoj fotografiji', view: 'Grupna fotografija' },
    ],
    poster: 'img/noir-front.webp',
    surface: { lace: 'sequin', density: 1.1, sparkle: 0.85, relief: 0.7, seed: 23 },
  },
  {
    id: 'look-03', no: '03', design: 'korset-mini',
    label: 'Look 03', tempName: 'Korset mini — svetloplava', nameVerified: false,
    photoColor: 'svetloplava',
    caption: 'Svetloplava čipka sa perlicama, mašna preko grudi i vezivanje na leđima.',
    photos: [
      { src: 'img/plava-front.webp', w: 705, h: 1208, alt: 'Svetloplava korset mini haljina, spreda', view: 'Spreda' },
      { src: 'img/plava-back.webp', w: 664, h: 948, alt: 'Svetloplava haljina otpozadi, vidljivo vezivanje', view: 'Otpozadi' },
      { src: 'img/plava-more.webp', w: 534, h: 497, alt: 'Svetloplava haljina, gornji deo i suknja, more u pozadini', view: 'Gornji deo' },
      { src: 'img/detalj-plava-masna.webp', w: 330, h: 300, alt: 'Detalj: presavijena traka preko grudi', view: 'Detalj grudi' },
      { src: 'img/detalj-plava-ledja.webp', w: 370, h: 410, alt: 'Detalj: vezivanje na leđima i čipkani rukav', view: 'Detalj leđa' },
      { src: 'img/detalj-plava-cipka.webp', w: 434, h: 480, alt: 'Detalj: svetloplava čipka na suknji', view: 'Detalj čipke' },
      { src: 'img/plava-grupa.webp', w: 196, h: 537, alt: 'Svetloplava haljina na grupnoj fotografiji', view: 'Grupna fotografija' },
    ],
    poster: 'img/plava-front.webp',
    surface: { lace: 'floral', density: 1.0, sparkle: 0.45, relief: 0.9, seed: 37 },
  },
  {
    id: 'look-04', no: '04', design: 'korset-mini',
    label: 'Look 04', tempName: 'Korset mini — puter žuta', nameVerified: false,
    photoColor: 'puter-zuta',
    caption: 'Puter žuta, vezena čipka. Na fotografiji otpozadi: vezivanje i duge čipkane rukavice-rukavi.',
    photos: [
      { src: 'img/zuta-back.webp', w: 588, h: 709, alt: 'Puter žuta korset mini haljina otpozadi', view: 'Otpozadi' },
      { src: 'img/detalj-zuta-ledja.webp', w: 300, h: 320, alt: 'Detalj: vezivanje na leđima žute haljine', view: 'Detalj leđa' },
      { src: 'img/zuta-grupa.webp', w: 194, h: 625, alt: 'Puter žuta haljina na grupnoj fotografiji', view: 'Grupna fotografija' },
    ],
    poster: 'img/zuta-back.webp',
    surface: { lace: 'embroidered', density: 1.15, sparkle: 0.14, relief: 0.6, seed: 41 },
  },
  {
    id: 'look-05', no: '05', design: 'korset-mini',
    label: 'Look 05', tempName: 'Korset mini — slonovača', nameVerified: false,
    photoColor: 'slonovaca',
    caption: 'Slonovača, reljefna cvetna čipka. Za sada postoji samo na grupnoj fotografiji.',
    photos: [
      { src: 'img/ivory-grupa.webp', w: 204, h: 562, alt: 'Haljina boje slonovače na grupnoj fotografiji', view: 'Grupna fotografija' },
      { src: 'img/grupa.webp', w: 715, h: 827, alt: 'Pet haljina na grupnoj fotografiji', view: 'Cela grupa' },
    ],
    poster: 'img/ivory-grupa.webp',
    photoNote: 'Dostupna je samo isečena grupna fotografija niske rezolucije. Potrebne su posebne fotografije.',
    surface: { lace: 'applique', density: 0.85, sparkle: 0.2, relief: 1.25, seed: 53 },
  },
];

/* Group photograph: left→right order of the five entries + marker position (%) */
export const GROUP_PHOTO = {
  src: 'img/grupa.webp', w: 715, h: 827,
  alt: 'Pet korset mini haljina: slonovača, puder roze, svetloplava, puter žuta i crna',
  markers: [
    { entry: 'look-05', x: 16, y: 54 },
    { entry: 'look-01', x: 33, y: 33 },
    { entry: 'look-03', x: 50, y: 55 },
    { entry: 'look-04', x: 66, y: 40 },
    { entry: 'look-02', x: 85, y: 55 },
  ],
};

/* --------------------------------------------------------------------------
   CATALOG — photographic collection.
   Only the five photographed looks have real data. Every other product
   must come from the brand. `CATALOG_PENDING` renders clearly-labelled
   empty slots so the layout can be reviewed; replace them with real
   products in the same shape as `catalogItem()` output.
   -------------------------------------------------------------------------- */
export const CATALOG_EXTRA = [
  // { id:'naziv-modela', name:'…', collection:'…', colors:['crna'], sizes:[…],
  //   price:null, availability:null, photos:[{src,w,h,alt}], featured3d:false }
];
export const CATALOG_PENDING = 6;

export function catalogItems() {
  return [
    ...ENTRIES.map(e => ({
      id: e.id, name: e.tempName, label: e.label, nameVerified: e.nameVerified,
      colors: [e.photoColor], preview3d: COLOR_ORDER, featured3d: true,
      price: null, availability: null, sizes: null,
      photos: e.photos,
    })),
    ...CATALOG_EXTRA,
  ];
}

export const entryById = id => ENTRIES.find(e => e.id === id) || ENTRIES[0];
export const colorStatus = (entry, colorId) =>
  colorId === entry.photoColor ? 'fotografisano' : 'pregled';
