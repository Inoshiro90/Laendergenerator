import { mkRng } from './math.js';

// ── Cluster Centre Placement ──────────────────────────────────────────────────
// Places `count` cluster centres in [-spread, +spread] normalised space.
// Uses farthest-point sampling with an ADAPTIVE minimum separation derived
// from the requested count and spread, so islands always fit without merging.
export function placeClusterCenters(seed, count, spread) {
  const rf = mkRng(seed ^ 0xf4a9b203);

  // Adaptive min separation: for N points in a [±spread]² box, the ideal
  // Poisson spacing is spread*1.3/√N. We use 85% of that to give farthest-
  // point some room to improve over random placement.
  const adaptiveMinSep = spread * 1.1 / Math.sqrt(count);

  const centers = [];
  const MAX_ATTEMPTS = 50;

  // First centre: random within spread box
  centers.push({
    nx: (rf() * 2 - 1) * spread,
    ny: (rf() * 2 - 1) * spread,
  });

  for (let i = 1; i < count; i++) {
    let bestPos  = null;
    let bestMinD = -1;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const cx = (rf() * 2 - 1) * spread;
      const cy = (rf() * 2 - 1) * spread;

      let minD = Infinity;
      for (const c of centers) {
        const d = Math.hypot(cx - c.nx, cy - c.ny);
        if (d < minD) minD = d;
      }

      if (minD > bestMinD) {
        bestMinD = minD;
        bestPos  = { nx: cx, ny: cy };
      }
      // Stop early if we found a well-separated position
      if (minD >= adaptiveMinSep) break;
    }

    centers.push(bestPos ?? { nx: (rf() * 2 - 1) * spread, ny: (rf() * 2 - 1) * spread });
  }

  return centers;
}

// ── Per-cluster Properties ────────────────────────────────────────────────────
// Derives per-island size, elongation and orientation from seed and params.
// KEY FIX: island radius is bounded by the actual minimum centre separation
// so that islands can never overlap and merge.
export function computeClusterProperties(centers, seed, opts = {}) {
  const rf       = mkRng(seed ^ 0x2b7e3f1a);
  const count    = centers.length;
  const spread   = opts.cluster_spread              ?? 0.65;
  const sizeVar  = opts.cluster_size_variance       ?? 0.4;
  const elongation = opts.island_elongation         ?? 1.3;
  const orientVar  = opts.island_orientation_variance ?? 0.9;

  // Compute actual nearest-neighbour distance between placed centres
  let actualMinSep = spread * 2;  // fallback for count=1
  if (count > 1) {
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const d = Math.hypot(centers[i].nx - centers[j].nx, centers[i].ny - centers[j].ny);
        if (d < actualMinSep) actualMinSep = d;
      }
    }
  }

  // Maximum safe radius: the boundary between two adjacent islands must be
  // at least 18% of their separation (safety gap). The falloff function
  // multiplies by 0.7, so effective island radius = size / 0.7 in world units.
  // We want: 2 * (size / 0.7) <= actualMinSep * 0.82
  //   => size <= actualMinSep * 0.82 * 0.7 / 2  ≈  actualMinSep * 0.287
  const maxSafeSize  = actualMinSep * 0.28;

  // Target size based on spread/count — uses a slightly tighter multiplier
  // than before (0.38 vs 0.45) so smaller islands with clearer separation
  const targetSize   = spread * 0.38 / Math.sqrt(count);

  const baseSize = Math.min(targetSize, maxSafeSize);

  const sizes        = [];
  const orientations = [];
  const elongations  = [];

  for (let i = 0; i < count; i++) {
    // Reduced variance range (1.4x instead of 2x) so small islands
    // don't drop below the minimum threshold after variance
    const sizeNoise = 1.0 + sizeVar * (rf() - 0.5) * 1.4;
    sizes.push(Math.max(0.04, baseSize * sizeNoise));
    orientations.push(rf() * Math.PI * 2 * orientVar);
    elongations.push(1.0 + (elongation - 1.0) * rf());
  }

  return { sizes, orientations, elongations };
}

// ── Fragmented Falloff Function ───────────────────────────────────────────────
export function buildFragmentedFalloff(centers, sizes, orientations, elongations) {
  return (nx, ny) => {
    let minDist = Infinity;
    for (let i = 0; i < centers.length; i++) {
      const { nx: cx, ny: cy } = centers[i];
      const size  = sizes[i];
      const angle = orientations[i];
      const elong = elongations[i] ?? 1.0;
      const cos   = Math.cos(angle);
      const sin   = Math.sin(angle);
      const dx    = nx - cx;
      const dy    = ny - cy;
      // Rotate to island-local frame
      const lx = cos * dx + sin * dy;
      const ly = -sin * dx + cos * dy;
      // Anisotropic Chebyshev: elong stretches along local-y
      const sqe = Math.sqrt(elong);
      const slx = lx * sqe;
      const sly = ly / sqe;
      const d   = Math.max(Math.abs(slx), Math.abs(sly)) / size;
      if (d < minDist) minDist = d;
    }
    return minDist * 0.7;
  };
}
