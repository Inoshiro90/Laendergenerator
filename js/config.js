// ── Canvas / rendering constants ─────────────────────────────────────────────
export const S            = 800;
export const MESH_SPACING = 20;   // Poisson disc min distance (px)
export const NOISY_LEN    = 10;   // Minimum segment length before subdividing
export const BORDER_NAT   = 0.55; // Border perturbation base strength

export const LW_COAST    = 2.5;
export const LW_REGION   = 1.4;
export const LW_SUB      = 0.7;
export const LW_ENCLAVE  = 1.6;   // Enclave border line width
export const DASH        = 6;
export const DASH_ENCLAVE = 4;    // Enclave dashed line segment length

// ── Export resolution steps ───────────────────────────────────────────────────
export const RES_STEPS  = [800, 1200, 1600, 2400, 4000];
export const RES_LABELS = ['800 px', '1200 px', '1600 px', '2400 px', '4000 px'];

// ── Water type constants ──────────────────────────────────────────────────────
export const WATER_OCEAN   = 1;  // ocean-connected water
export const WATER_ENCLAVE = 2;  // landlocked enclave water (perforated mode)
export const ENCLAVE_MIN_CELLS = 8;  // minimum Voronoi cells per enclave

// ── Shape-specific defaults ───────────────────────────────────────────────────

// Elongated
export const DEFAULT_STRETCH_ANGLE = 90;   // degrees (90 = vertical / N–S)
export const DEFAULT_ASPECT_RATIO  = 2.5;  // long:short axis ratio

// Prorupted
export const PROTRUSION_DEFAULTS = {
  angle:         null,  // null = seed-derived (~200°)
  length:        0.65,
  widthBase:     0.18,
  taper:         0.6,
  curve:         0.1,
  mainBodySize:  0.50,
};

// Fragmented
export const FRAGMENTED_DEFAULTS = {
  cluster_count:             4,
  cluster_spread:            0.65,
  cluster_size_variance:     0.4,
  cluster_min_separation:    0.22,
  island_elongation:         1.3,
  island_orientation_variance: 0.9,
  min_island_area_fraction:  0.04,
};

// Perforated
export const PERFORATED_DEFAULTS = {
  enclave_count:         1,
  enclave_radius:        0.13,
  enclave_coast_margin:  0.10,
  enclave_shape_noise:   0.15,
};

// Complex presets — each is a list of ComponentDescriptor objects
// Component: { type, weight, offset_x, offset_y, scale, rotation, stretch_angle, aspect_ratio }
export const COMPLEX_PRESETS = {
  usa: [
    { type: 'compact',    weight: 1.0, offset_x:  0.00, offset_y:  0.05, scale: 0.55, rotation: 0.0,  stretch_angle: 90, aspect_ratio: 1.2 },
    { type: 'compact',    weight: 0.7, offset_x: -0.60, offset_y: -0.40, scale: 0.22, rotation: 0.3,  stretch_angle: 40, aspect_ratio: 1.4 },
    { type: 'compact',    weight: 0.5, offset_x: -0.72, offset_y:  0.55, scale: 0.12, rotation: 0.0,  stretch_angle: 90, aspect_ratio: 1.0 },
  ],
  russia: [
    { type: 'elongated',  weight: 1.0, offset_x:  0.00, offset_y:  0.00, scale: 0.65, rotation: 0.0,  stretch_angle:  0, aspect_ratio: 3.2 },
    { type: 'compact',    weight: 0.6, offset_x:  0.55, offset_y:  0.45, scale: 0.18, rotation: 0.5,  stretch_angle: 30, aspect_ratio: 1.3 },
  ],
  malaysia: [
    { type: 'elongated',  weight: 1.0, offset_x: -0.20, offset_y:  0.20, scale: 0.45, rotation: 0.3,  stretch_angle: 10, aspect_ratio: 2.2 },
    { type: 'compact',    weight: 0.8, offset_x:  0.45, offset_y: -0.20, scale: 0.30, rotation: -0.2, stretch_angle: 40, aspect_ratio: 1.5 },
  ],
  archipelago_land: [
    { type: 'compact',    weight: 1.0, offset_x: -0.25, offset_y:  0.10, scale: 0.40, rotation: 0.2,  stretch_angle: 60, aspect_ratio: 1.4 },
    { type: 'compact',    weight: 0.6, offset_x:  0.30, offset_y:  0.30, scale: 0.18, rotation: 0.8,  stretch_angle: 30, aspect_ratio: 1.2 },
    { type: 'compact',    weight: 0.5, offset_x:  0.50, offset_y: -0.30, scale: 0.14, rotation: -0.4, stretch_angle: 80, aspect_ratio: 1.1 },
    { type: 'compact',    weight: 0.4, offset_x:  0.20, offset_y: -0.55, scale: 0.10, rotation:  0.6, stretch_angle: 45, aspect_ratio: 1.3 },
  ],
  random: null,  // handled by deriveComponentsFromSeed
};
