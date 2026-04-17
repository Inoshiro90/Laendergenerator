// ── Canvas / rendering constants ─────────────────────────────────────────────
export const S            = 800;
export const MESH_SPACING = 20;
export const NOISY_LEN    = 10;
export const BORDER_NAT   = 0.55;

export const LW_COAST     = 2.5;
export const LW_REGION    = 1.4;
export const LW_SUB       = 0.7;
export const LW_ENCLAVE   = 1.6;
export const DASH         = 6;
export const DASH_ENCLAVE = 4;

// ── Export resolution steps ───────────────────────────────────────────────────
export const RES_STEPS  = [800, 1200, 1600, 2400, 4000];
export const RES_LABELS = ['800 px', '1200 px', '1600 px', '2400 px', '4000 px'];

// ── Water type constants ──────────────────────────────────────────────────────
export const WATER_OCEAN      = 1;
export const WATER_ENCLAVE    = 2;
export const ENCLAVE_MIN_CELLS = 8;

// ── Color Palette ─────────────────────────────────────────────────────────────
// All colors used by the renderer. Swap these to change the entire visual style.
export const PALETTE = {
  // Map background / water
  water:          '#c8dce8',  // steel blue-gray (ocean)
  waterDark:      '#a8bcc8',  // water hatching line color
  enclaveFill:    '#dce8d0',  // muted green for landlocked enclaves
  enclaveHatch:   '#b0c8a0',  // enclave hatching line color

  // Land (when no regions)
  land:           '#e8dfc8',  // parchment

  // Border colors
  borderCoast:    '#1a1510',  // darkest — coast outline
  borderRegion:   '#2a2010',  // region internal borders
  borderSub:      '#4a3a28',  // sub-region internal borders
  borderEnclave:  '#3a5040',  // enclave border (dashed)
  borderFrame:    '#000000',  // canvas frame

  // Region palette — 16 distinct hues, pastel, harmonious
  // Generated from golden-angle HSL: each hue = i * 137.508° mod 360
  regions: [
    '#d4856a',  // 0  terracotta
    '#7ab3a0',  // 1  sage teal
    '#a89cc8',  // 2  soft lavender
    '#c8b46e',  // 3  warm ochre
    '#8fb85a',  // 4  moss green
    '#c87a8a',  // 5  dusty rose
    '#6a9fd4',  // 6  cornflower
    '#d4a46a',  // 7  peach
    '#7aaab3',  // 8  sky blue
    '#b38a6a',  // 9  caramel
    '#8ac87a',  // 10 light green
    '#c86a6a',  // 11 muted red
    '#6a8ac8',  // 12 periwinkle
    '#c8c86a',  // 13 straw
    '#a06a9f',  // 14 plum
    '#6ac8b3',  // 15 seafoam
  ],
};

// ── Render Defaults ───────────────────────────────────────────────────────────
// Stored in localStorage key 'carto-render-opts'. Overridden by UI toggles.
export const RENDER_DEFAULTS = {
  useColors:            true,   // Fill regions with distinct colors
  useWaterFill:         true,   // Fill water with a color instead of white
  useHatching:          true,   // Add diagonal hatching over water / enclaves
  randomRegionColors:   false,  // Randomize hue within each region's base color
  showRegionBorders:    true,   // Draw region border lines
  showSubRegionBorders: true,   // Draw sub-region border lines (dashed)
};

// ── Shape-specific defaults ───────────────────────────────────────────────────

export const DEFAULT_STRETCH_ANGLE = 90;
export const DEFAULT_ASPECT_RATIO  = 2.5;

export const PROTRUSION_DEFAULTS = {
  angle:        null,
  length:       0.65,
  widthBase:    0.18,
  taper:        0.6,
  curve:        0.1,
  mainBodySize: 0.50,
};

export const FRAGMENTED_DEFAULTS = {
  cluster_count:               4,
  cluster_spread:              0.65,
  cluster_size_variance:       0.4,
  island_elongation:           1.3,
  island_orientation_variance: 0.9,
  min_island_area_fraction:    0.04,
};

export const PERFORATED_DEFAULTS = {
  enclave_count:        1,
  enclave_radius:       0.13,
  enclave_coast_margin: 0.10,
  enclave_shape_noise:  0.15,
};

export const COMPLEX_PRESETS = {
  usa: [
    { type: 'compact',   weight: 1.0, offset_x:  0.00, offset_y:  0.05, scale: 0.55, rotation: 0.0,  stretch_angle: 90, aspect_ratio: 1.2 },
    { type: 'compact',   weight: 0.7, offset_x: -0.60, offset_y: -0.40, scale: 0.22, rotation: 0.3,  stretch_angle: 40, aspect_ratio: 1.4 },
    { type: 'compact',   weight: 0.5, offset_x: -0.72, offset_y:  0.55, scale: 0.12, rotation: 0.0,  stretch_angle: 90, aspect_ratio: 1.0 },
  ],
  russia: [
    { type: 'elongated', weight: 1.0, offset_x:  0.00, offset_y:  0.00, scale: 0.65, rotation: 0.0,  stretch_angle:  0, aspect_ratio: 3.2 },
    { type: 'compact',   weight: 0.6, offset_x:  0.55, offset_y:  0.45, scale: 0.18, rotation: 0.5,  stretch_angle: 30, aspect_ratio: 1.3 },
  ],
  malaysia: [
    { type: 'elongated', weight: 1.0, offset_x: -0.20, offset_y:  0.20, scale: 0.45, rotation: 0.3,  stretch_angle: 10, aspect_ratio: 2.2 },
    { type: 'compact',   weight: 0.8, offset_x:  0.45, offset_y: -0.20, scale: 0.30, rotation: -0.2, stretch_angle: 40, aspect_ratio: 1.5 },
  ],
  archipelago_land: [
    { type: 'compact',   weight: 1.0, offset_x: -0.25, offset_y:  0.10, scale: 0.40, rotation: 0.2,  stretch_angle: 60, aspect_ratio: 1.4 },
    { type: 'compact',   weight: 0.6, offset_x:  0.30, offset_y:  0.30, scale: 0.18, rotation: 0.8,  stretch_angle: 30, aspect_ratio: 1.2 },
    { type: 'compact',   weight: 0.5, offset_x:  0.50, offset_y: -0.30, scale: 0.14, rotation: -0.4, stretch_angle: 80, aspect_ratio: 1.1 },
    { type: 'compact',   weight: 0.4, offset_x:  0.20, offset_y: -0.55, scale: 0.10, rotation:  0.6, stretch_angle: 45, aspect_ratio: 1.3 },
  ],
  random: null,
};
