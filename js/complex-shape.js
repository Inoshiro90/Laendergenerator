// ── Complex Shape Compositor ─────────────────────────────────────────────────
// Builds a combined falloff function from multiple independently-positioned
// sub-shapes. Each component can be any non-complex shape type.
// Imports shapeFalloff from terrain.js (one-way dependency, no circular issue).

import { shapeFalloff } from './terrain.js';
import { mkRng }        from './math.js';
import { COMPLEX_PRESETS } from './config.js';

// ── Derive Components from Seed ───────────────────────────────────────────────
// When the user selects 'random' preset, generate a plausible set of
// components deterministically from the seed.
export function deriveComponentsFromSeed(seed, count = 2) {
  const rf = mkRng(seed ^ 0x3c7d9f2a);
  const TYPES = ['compact', 'elongated', 'compact', 'prorupted'];

  const components = [];

  // Main component: large, near centre
  components.push({
    type:         TYPES[(rf() * 2) | 0],
    weight:       1.0,
    offset_x:     (rf() - 0.5) * 0.25,
    offset_y:     (rf() - 0.5) * 0.25,
    scale:        0.50 + rf() * 0.15,
    rotation:     rf() * Math.PI * 2,
    stretch_angle: rf() * 180,
    aspect_ratio: 1.3 + rf() * 1.5,
    protrusion_angle: (rf() * 360) | 0,
    protrusion_length: 0.50 + rf() * 0.25,
    protrusion_width_base: 0.14 + rf() * 0.08,
    protrusion_taper: 0.4 + rf() * 0.4,
  });

  const usedCount = Math.min(count, 4);
  for (let i = 1; i < usedCount; i++) {
    const angle = rf() * Math.PI * 2;
    const dist  = 0.30 + rf() * 0.30;
    components.push({
      type:         i % 2 === 0 ? 'elongated' : 'compact',
      weight:       0.55 + rf() * 0.45,
      offset_x:     Math.cos(angle) * dist,
      offset_y:     Math.sin(angle) * dist,
      scale:        0.18 + rf() * 0.18,
      rotation:     rf() * Math.PI * 2,
      stretch_angle: rf() * 180,
      aspect_ratio: 1.2 + rf() * 2.0,
    });
  }

  return components;
}

// ── Get Preset Components ─────────────────────────────────────────────────────
// Returns the component list for a named preset, or derives from seed for 'random'.
export function getPresetComponents(presetName, seed, count = 2) {
  if (presetName === 'random' || !COMPLEX_PRESETS[presetName]) {
    return deriveComponentsFromSeed(seed, count);
  }
  return COMPLEX_PRESETS[presetName];
}

// ── Build Complex Falloff Function ────────────────────────────────────────────
// Returns f(nx, ny) → dist compatible with shapeFalloff() conventions.
// Each component is evaluated in its own local coordinate system and the
// minimum distance across all components is returned (= union of shapes).
export function buildComplexFalloff(components) {
  return (nx, ny) => {
    let minDist = Infinity;

    for (const comp of components) {
      const {
        offset_x = 0,
        offset_y = 0,
        scale    = 0.5,
        rotation = 0,
        weight   = 1.0,
        type     = 'compact',
      } = comp;

      // Skip components entirely outside canvas (optimisation)
      const maxReach = scale * 2.0 + Math.hypot(offset_x, offset_y);
      if (maxReach < 0.01) continue;

      // Transform point into component-local normalised coordinate system
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const dx  = nx - offset_x;
      const dy  = ny - offset_y;
      const lx  = (cos * dx + sin * dy) / scale;
      const ly  = (-sin * dx + cos * dy) / scale;

      // Block 'complex' and 'fragmented' as sub-types to avoid recursion /
      // missing pre-computed data. Fall back to compact.
      const safeType = (type === 'complex' || type === 'fragmented')
        ? 'compact'
        : type;

      const d = shapeFalloff(lx, ly, safeType, comp) / weight;
      if (d < minDist) minDist = d;
    }

    return minDist;
  };
}
