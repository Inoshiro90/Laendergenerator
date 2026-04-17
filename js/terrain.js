import { S, MESH_SPACING, ENCLAVE_MIN_CELLS } from './config.js';
import { fbmNoise, mkRng }                    from './math.js';

export function shapeFalloff(nx, ny, shape, opts = {}) {
  switch (shape) {

    case 'elongated-h': {
      const ex = nx * 0.55, ey = ny * 1.6;
      return Math.max(Math.abs(ex), Math.abs(ey));
    }
    case 'elongated-v': {
      const ex = nx * 1.6, ey = ny * 0.55;
      return Math.max(Math.abs(ex), Math.abs(ey));
    }

    case 'elongated': {
      const angleDeg = opts.stretch_angle ?? 90;
      const ar       = Math.max(1.5, Math.min(5.0, opts.aspect_ratio ?? 2.5));
      const taper    = Math.max(0, Math.min(0.5, opts.taper ?? 0));
      const rad      = angleDeg * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const rx = cos * nx + sin * ny;
      const ry = -sin * nx + cos * ny;
      const sqAr = Math.sqrt(ar);
      let ex = rx * sqAr;
      let ey = ry / sqAr;
      if (taper > 0) {
        const widthMod = Math.max(0.05, 1.0 + taper * Math.abs(ey));
        ex = ex * widthMod;
      }
      return Math.max(Math.abs(ex), Math.abs(ey));
    }

    case 'prorupted': {
      if (opts.protrusion_angle == null && !opts._parametricProrupted) {
        const mainDist  = Math.max(Math.abs(nx * 1.1), Math.abs(ny * 1.1));
        const protAngle = Math.PI * 0.2;
        const px = Math.cos(protAngle), py = -Math.sin(protAngle);
        const proj = nx * px + ny * py;
        const perp = Math.abs(-nx * py + ny * px);
        const inProt = proj > 0.25 && perp < 0.28 + (1.1 - proj) * 0.2;
        if (inProt) return Math.max(0, perp * 3.0 - 0.1);
        return mainDist;
      }
      const angleDeg  = opts.protrusion_angle ?? 200;
      const length    = Math.min(1.0, opts.protrusion_length      ?? 0.65);
      const widthBase = Math.max(0.05, opts.protrusion_width_base ?? 0.18);
      const taper     = Math.max(0, Math.min(1, opts.protrusion_taper ?? 0.6));
      const mainSize  = opts.main_body_size ?? 0.50;
      const rad = angleDeg * Math.PI / 180;
      const dx  = Math.cos(rad);
      const dy  = Math.sin(rad);
      const mainBodyDist = Math.max(Math.abs(nx), Math.abs(ny)) / mainSize * 0.7;
      const ax  = dx * mainSize * 0.7;
      const ay  = dy * mainSize * 0.7;
      const bx  = dx * length;
      const by  = dy * length;
      const abx = bx - ax;
      const aby = by - ay;
      const abLen2 = abx * abx + aby * aby;
      let protDist = 10;
      if (abLen2 > 1e-10) {
        const t = Math.max(0, Math.min(1, ((nx - ax) * abx + (ny - ay) * aby) / abLen2));
        const closestX = ax + t * abx;
        const closestY = ay + t * aby;
        const perpDist = Math.sqrt((nx - closestX) ** 2 + (ny - closestY) ** 2);
        const curWidth = Math.max(0.04, widthBase * (1 - taper * t));
        protDist = (perpDist / curWidth) * 0.7;
      }
      return Math.min(mainBodyDist, protDist);
    }

    case 'fragmented': {
      if (opts.fragmentedFalloffFn) return opts.fragmentedFalloffFn(nx, ny);
      return Math.max(Math.abs(nx), Math.abs(ny));
    }

    case 'perforated': {
      return Math.max(Math.abs(nx), Math.abs(ny));
    }

    case 'complex': {
      if (opts.complexFalloffFn) return opts.complexFalloffFn(nx, ny);
      return Math.max(Math.abs(nx), Math.abs(ny));
    }

    case 'compact':
    default:
      return Math.max(Math.abs(nx), Math.abs(ny));
  }
}

// ── Enclave Placement (internal) ─────────────────────────────────────────────
function placeEnclaves(mesh, water_r, seed, opts) {
  const enclave_r     = new Uint8Array(mesh.numRegions);
  const enclaveCount  = Math.max(1, Math.min(3, opts.enclave_count  ?? 1));
  const enclaveRadius = Math.max(0.04, opts.enclave_radius          ?? 0.13);
  const coastMargin   = opts.enclave_coast_margin ?? 0.10;
  const shapeNoise    = opts.enclave_shape_noise  ?? 0.15;
  const rOut          = [];

  const NORM_PER_HOP = MESH_SPACING / (S / 2);
  const minHops      = Math.ceil((enclaveRadius + coastMargin) / NORM_PER_HOP);

  const hopDist = new Int32Array(mesh.numRegions).fill(-1);
  const queue   = [];
  for (let r = 0; r < mesh.numSolidRegions; r++) {
    if (water_r[r] || mesh.is_boundary_r(r)) { hopDist[r] = 0; queue.push(r); }
  }
  let qi = 0;
  while (qi < queue.length) {
    const r = queue[qi++];
    mesh.r_around_r(r, rOut);
    for (const nb of rOut) {
      if (hopDist[nb] === -1 && !mesh.is_ghost_r(nb)) {
        hopDist[nb] = hopDist[r] + 1;
        queue.push(nb);
      }
    }
  }

  const interiorCells = [];
  for (let r = 0; r < mesh.numSolidRegions; r++) {
    if (!water_r[r] && hopDist[r] >= minHops) interiorCells.push(r);
  }
  if (interiorCells.length < ENCLAVE_MIN_CELLS) return enclave_r;

  const rf = mkRng(seed ^ 0xe7a3f501);
  const centers = [];
  const firstIdx = (rf() * interiorCells.length) | 0;
  centers.push(interiorCells[firstIdx]);

  for (let i = 1; i < enclaveCount; i++) {
    let bestR = interiorCells[0], bestD = 0;
    for (const r of interiorCells) {
      let minD = Infinity;
      for (const c of centers) {
        const dx = mesh.x_of_r(r) - mesh.x_of_r(c);
        const dy = mesh.y_of_r(r) - mesh.y_of_r(c);
        minD = Math.min(minD, Math.sqrt(dx * dx + dy * dy));
      }
      if (minD > bestD) { bestD = minD; bestR = r; }
    }
    const minSepPx = enclaveRadius * (S / 2) * 2.2;
    if (bestD >= minSepPx || centers.length === 0) centers.push(bestR);
  }

  const radiusPx = enclaveRadius * (S / 2);
  for (const center of centers) {
    const cx = mesh.x_of_r(center);
    const cy = mesh.y_of_r(center);
    const visited  = new Set([center]);
    const bfsQueue = [center];
    enclave_r[center] = 1;
    water_r[center]   = 1;
    let bqi = 0;
    while (bqi < bfsQueue.length) {
      const r = bfsQueue[bqi++];
      mesh.r_around_r(r, rOut);
      for (const nb of rOut) {
        if (visited.has(nb) || mesh.is_ghost_r(nb) || water_r[nb]) continue;
        const distPx = Math.sqrt(
          (mesh.x_of_r(nb) - cx) ** 2 + (mesh.y_of_r(nb) - cy) ** 2,
        );
        const noiseMod = 1.0 + shapeNoise * (rf() - 0.5) * 2;
        if (distPx <= radiusPx * noiseMod) {
          visited.add(nb);
          enclave_r[nb] = 1;
          water_r[nb]   = 1;
          bfsQueue.push(nb);
        }
      }
    }
  }

  const newOcean = new Uint8Array(mesh.numRegions);
  const oStack   = [mesh.r_ghost()];
  newOcean[mesh.r_ghost()] = 1;
  while (oStack.length) {
    const r = oStack.pop();
    mesh.r_around_r(r, rOut);
    for (const nb of rOut) {
      if (!newOcean[nb] && water_r[nb]) { newOcean[nb] = 1; oStack.push(nb); }
    }
  }
  for (let r = 0; r < mesh.numSolidRegions; r++) {
    if (enclave_r[r] && newOcean[r]) enclave_r[r] = 0;
  }
  return enclave_r;
}

// ── Water Assignment ──────────────────────────────────────────────────────────
export function assignWater(mesh, noise, round, inflate, shape, opts = {}) {
  const amplitudes = shape === 'perforated'
    ? [0.5, 0.25, 0.12, 0.06, 0.03]
    : [1, 0.5, 0.25, 0.125, 0.0625];

  const water_r = new Uint8Array(mesh.numRegions);
  const rOut    = [];

  let effectiveInflate = inflate;
  if (shape === 'perforated') {
    effectiveInflate = Math.max(inflate, 0.65);
  } else if (shape === 'elongated') {
    const ar = opts.aspect_ratio ?? 2.5;
    if (ar > 3.5) effectiveInflate = inflate * (1.1 / ar) + 0.05;
  }
  effectiveInflate = Math.min(0.80, effectiveInflate);

  // Pass 1: noise + shape falloff → water/land
  for (let r = 0; r < mesh.numRegions; r++) {
    if (mesh.is_ghost_r(r) || mesh.is_boundary_r(r)) { water_r[r] = 1; continue; }
    const nx   = (mesh.x_of_r(r) - S / 2) / (S / 2);
    const ny   = (mesh.y_of_r(r) - S / 2) / (S / 2);
    const dist = shapeFalloff(nx, ny, shape, opts);
    let n      = fbmNoise(noise, amplitudes, nx, ny);
    n = (1 - round) * n + round * 0.5;
    water_r[r] = (n - (1 - effectiveInflate) * dist * dist) < 0 ? 1 : 0;
  }

  // Pass 2: flood-fill ocean from ghost
  const ocean = new Uint8Array(mesh.numRegions);
  const stack = [mesh.r_ghost()];
  ocean[mesh.r_ghost()] = 1;
  while (stack.length) {
    const r = stack.pop();
    mesh.r_around_r(r, rOut);
    for (const nb of rOut) {
      if (!ocean[nb] && water_r[nb]) { ocean[nb] = 1; stack.push(nb); }
    }
  }

  // Pass 3: landlocked water → land
  for (let r = 0; r < mesh.numSolidRegions; r++) {
    if (water_r[r] && !ocean[r]) water_r[r] = 0;
  }

  // Pass 4: component filter
  const useMultiComponent = shape === 'fragmented' || shape === 'complex';

  if (useMultiComponent) {
    // Collect all connected land components
    const visited  = new Uint8Array(mesh.numRegions);
    const allComps = [];
    for (let r = 0; r < mesh.numSolidRegions; r++) {
      if (water_r[r] || visited[r]) continue;
      const comp = [r]; visited[r] = 1; let qi = 0;
      while (qi < comp.length) {
        const cur = comp[qi++];
        mesh.r_around_r(cur, rOut);
        for (const nb of rOut) {
          if (!water_r[nb] && !visited[nb] && !mesh.is_ghost_r(nb)) {
            visited[nb] = 1; comp.push(nb);
          }
        }
      }
      allComps.push(comp);
    }

    if (allComps.length > 0) {
      // Sort largest first
      allComps.sort((a, b) => b.length - a.length);

      // FIX: for fragmented, keep exactly the top N components
      // where N = requested cluster_count. For complex, keep all above threshold.
      const keep = new Uint8Array(mesh.numRegions);

      if (shape === 'fragmented') {
        const requestedCount = opts.cluster_count ?? 4;
        const absoluteMin    = 5; // never keep a component smaller than 5 cells
        const keepCount      = Math.min(requestedCount, allComps.length);
        for (let i = 0; i < keepCount; i++) {
          if (allComps[i].length >= absoluteMin) {
            for (const r of allComps[i]) keep[r] = 1;
          }
        }
        // Always keep the largest even if somehow below absoluteMin
        for (const r of allComps[0]) keep[r] = 1;
      } else {
        // Complex: keep all components above 3% of the largest
        const threshold = Math.max(5, allComps[0].length * 0.03);
        for (const comp of allComps) {
          if (comp.length >= threshold) {
            for (const r of comp) keep[r] = 1;
          }
        }
      }

      for (let r = 0; r < mesh.numSolidRegions; r++) {
        if (!keep[r]) water_r[r] = 1;
      }
    }
  } else {
    // Single component: keep only the largest
    const visited = new Uint8Array(mesh.numRegions);
    let bestComp  = [], bestSize = 0;
    for (let r = 0; r < mesh.numSolidRegions; r++) {
      if (water_r[r] || visited[r]) continue;
      const comp = [r]; visited[r] = 1; let qi = 0;
      while (qi < comp.length) {
        const cur = comp[qi++];
        mesh.r_around_r(cur, rOut);
        for (const nb of rOut) {
          if (!water_r[nb] && !visited[nb] && !mesh.is_ghost_r(nb)) {
            visited[nb] = 1; comp.push(nb);
          }
        }
      }
      if (comp.length > bestSize) { bestSize = comp.length; bestComp = comp; }
    }
    const keep = new Uint8Array(mesh.numRegions);
    for (const r of bestComp) keep[r] = 1;
    for (let r = 0; r < mesh.numSolidRegions; r++) {
      if (!keep[r]) water_r[r] = 1;
    }
  }

  // Pass 5: Perforated — place enclaves
  let enclave_r = new Uint8Array(mesh.numRegions);
  if (shape === 'perforated') {
    enclave_r = placeEnclaves(mesh, water_r, opts.seed ?? 187, opts);
  }

  return { water_r, enclave_r };
}
