import { mkRng } from './math.js';

// ── Cluster Centre Placement ──────────────────────────────────────────────────
// Places `count` cluster centres in [-spread, +spread] normalised space using
// farthest-point sampling so islands are well-separated.
export function placeClusterCenters(seed, count, spread, minSep) {
  const rf  = mkRng(seed ^ 0xf4a9b203);
  const centers = [];
  const MAX_ATTEMPTS = 30;

  // First centre: random within spread box
  centers.push({
    nx: (rf() * 2 - 1) * spread,
    ny: (rf() * 2 - 1) * spread,
  });

  for (let i = 1; i < count; i++) {
    let bestPos   = null;
    let bestMinD  = -1;

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
      // Early exit: good enough separation found
      if (minD >= minSep) break;
    }

    centers.push(bestPos ?? { nx: (rf() * 2 - 1) * spread, ny: (rf() * 2 - 1) * spread });
  }

  return centers;
}

// ── Per-cluster Properties ────────────────────────────────────────────────────
// Derives per-island size, elongation and orientation from seed and params.
export function computeClusterProperties(centers, seed, opts = {}) {
  const rf           = mkRng(seed ^ 0x2b7e3f1a);
  const count        = centers.length;
  const spread       = opts.cluster_spread          ?? 0.65;
  const sizeVar      = opts.cluster_size_variance   ?? 0.4;
  const elongation   = opts.island_elongation       ?? 1.3;
  const orientVar    = opts.island_orientation_variance ?? 0.9;

  // Base island radius: covers roughly 1/sqrt(N) of the spread area
  const baseSize = spread * 0.45 / Math.sqrt(count);

  const sizes        = [];
  const orientations = [];
  const elongations  = [];

  for (let i = 0; i < count; i++) {
    const sizeNoise = 1.0 + sizeVar * (rf() - 0.5) * 2;
    sizes.push(Math.max(0.06, baseSize * sizeNoise));
    orientations.push(rf() * Math.PI * 2 * orientVar);
    elongations.push(1.0 + (elongation - 1.0) * rf());
  }

  return { sizes, orientations, elongations };
}

// ── Fragmented Falloff Function ───────────────────────────────────────────────
// Returns a falloff function f(nx, ny) → dist that maps to the same distance
// convention as shapeFalloff() — smaller = more likely land.
// Each island contributes a Chebyshev-based falloff around its centre;
// the global value is the minimum across all islands.
export function buildFragmentedFalloff(centers, sizes, orientations, elongations) {
  return (nx, ny) => {
    let minDist = Infinity;
    for (let i = 0; i < centers.length; i++) {
      const { nx: cx, ny: cy } = centers[i];
      const size    = sizes[i];
      const angle   = orientations[i];
      const elong   = elongations[i] ?? 1.0;
      const cos     = Math.cos(angle);
      const sin     = Math.sin(angle);
      const dx      = nx - cx;
      const dy      = ny - cy;
      // Rotate to island-local frame
      const lx = cos * dx + sin * dy;
      const ly = -sin * dx + cos * dy;
      // Anisotropic scale: elong compresses the long axis
      const sqe = Math.sqrt(elong);
      const slx = lx * sqe;
      const sly = ly / sqe;
      // Chebyshev distance, normalised by island size
      const d = Math.max(Math.abs(slx), Math.abs(sly)) / size;
      if (d < minDist) minDist = d;
    }
    // Scale to match compact's effective distance range (~0.7 at island edge)
    return minDist * 0.7;
  };
}
