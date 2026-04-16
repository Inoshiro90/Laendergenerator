import { S, BORDER_NAT }       from './config.js';
import { mkRng, buildSimplex } from './math.js';

const LLOYD_MAX   = 8;
const EMPTY_RESULT = (mesh) => ({
  region_r:    new Int32Array(mesh.numRegions).fill(0),
  subregion_r: new Int32Array(mesh.numRegions).fill(-1),
});

function farthestPointSeeds(n, pool, mesh, rf) {
  const first = pool[(rf() * pool.length) | 0];
  const seeds = [[mesh.x_of_r(first), mesh.y_of_r(first)]];
  for (let i = 1; i < n; i++) {
    let bestR = pool[0], bestD = 0;
    for (const r of pool) {
      let minD = 1e18;
      for (const [sx, sy] of seeds) {
        const dx = mesh.x_of_r(r) - sx, dy = mesh.y_of_r(r) - sy;
        const d = dx * dx + dy * dy; if (d < minD) minD = d;
      }
      if (minD > bestD) { bestD = minD; bestR = r; }
    }
    seeds.push([mesh.x_of_r(bestR), mesh.y_of_r(bestR)]);
  }
  return seeds;
}

export function assignRegions(mesh, water_r, numReg, numSub, regVariance, subVariance, seed) {
  if (numReg === 0) return EMPTY_RESULT(mesh);

  const rf      = mkRng(seed ^ 0xabcdef01);
  const rfSub   = mkRng(seed ^ 0x12345678);
  const nbNoise = buildSimplex(seed ^ 0xdeadcafe);
  const rOut    = [];

  // Enclave cells have water_r[r]=1 — they are excluded automatically here.
  const landR      = [];
  const landRInner = [];
  for (let r = 0; r < mesh.numSolidRegions; r++) {
    if (water_r[r]) continue;
    landR.push(r);
    if (!mesh.is_boundary_r(r)) landRInner.push(r);
  }
  if (!landR.length) return EMPTY_RESULT(mesh);

  const lloydIter        = Math.round(LLOYD_MAX * (1 - regVariance));
  const borderNoiseScale = regVariance * BORDER_NAT * 6;
  const seedPool         = landRInner.length >= numReg ? landRInner : landR;
  const n                = Math.min(numReg, seedPool.length);

  const noiseOff = new Float32Array(mesh.numRegions);
  for (const r of landR) {
    const nx = mesh.x_of_r(r) / S, ny = mesh.y_of_r(r) / S;
    noiseOff[r] = nbNoise.noise2D(nx * 3, ny * 3) * borderNoiseScale;
  }

  const region_r = new Int32Array(mesh.numRegions).fill(-1);

  const voronoiAssign = (sx) => {
    for (const r of landR) {
      let best = 0, bestD = 1e18;
      const rx = mesh.x_of_r(r), ry = mesh.y_of_r(r);
      for (let i = 0; i < sx.length; i++) {
        const dx = rx - sx[i][0], dy = ry - sx[i][1];
        const d = dx * dx + dy * dy + noiseOff[r] * 1000;
        if (d < bestD) { bestD = d; best = i; }
      }
      region_r[r] = best;
    }
    for (let r = 0; r < mesh.numRegions; r++) {
      if (region_r[r] === -1) region_r[r] = 0;
    }
  };

  const lloydStep = (sx) => {
    const sumX = new Float64Array(n), sumY = new Float64Array(n), cnt = new Float64Array(n);
    for (const r of landR) {
      const i = region_r[r];
      sumX[i] += mesh.x_of_r(r); sumY[i] += mesh.y_of_r(r); cnt[i]++;
    }
    return Array.from({ length: n }, (_, i) =>
      cnt[i] > 0 ? [sumX[i] / cnt[i], sumY[i] / cnt[i]] : sx[i],
    );
  };

  let seedXY = farthestPointSeeds(n, seedPool, mesh, rf);
  voronoiAssign(seedXY);
  for (let iter = 0; iter < lloydIter; iter++) {
    seedXY = lloydStep(seedXY);
    voronoiAssign(seedXY);
  }

  if (borderNoiseScale < BORDER_NAT * 2) {
    const softPasses = Math.round(3 * (1 - regVariance));
    const softScale  = BORDER_NAT * 3;
    const softOff    = new Float32Array(mesh.numRegions);
    for (const r of landR) {
      const nx = mesh.x_of_r(r) / S, ny = mesh.y_of_r(r) / S;
      softOff[r] = nbNoise.noise2D(nx * 4 + 7, ny * 4 + 7) * softScale;
    }
    for (let pass = 0; pass < softPasses; pass++) {
      for (const r of landR) {
        mesh.r_around_r(r, rOut);
        let bestReg = region_r[r], bestOff = softOff[r];
        for (const nb of rOut) {
          if (water_r[nb] || mesh.is_ghost_r(nb)) continue;
          if (softOff[nb] < bestOff) { bestOff = softOff[nb]; bestReg = region_r[nb]; }
        }
        region_r[r] = bestReg;
      }
    }
  }

  // ── Sub-regions ───────────────────────────────────────────────────────────
  const subregion_r = new Int32Array(mesh.numRegions).fill(-1);

  if (numSub > 0) {
    const subNoiseScale = subVariance * BORDER_NAT * 6;
    const subLloydIter  = Math.round(LLOYD_MAX * (1 - subVariance));
    const subNoise      = new Float32Array(mesh.numRegions);
    for (const r of landR) {
      const nx = mesh.x_of_r(r) / S, ny = mesh.y_of_r(r) / S;
      subNoise[r] = nbNoise.noise2D(nx * 5 + 10, ny * 5 + 10) * subNoiseScale;
    }

    const subVoronoi = (pool, ns, ri, sx) => {
      for (const r of pool) {
        let best = 0, bestD = 1e18;
        const rx = mesh.x_of_r(r), ry = mesh.y_of_r(r);
        for (let i = 0; i < sx.length; i++) {
          const dx = rx - sx[i][0], dy = ry - sx[i][1];
          const d  = dx * dx + dy * dy + subNoise[r] * 1000;
          if (d < bestD) { bestD = d; best = i; }
        }
        subregion_r[r] = ri * 200 + best;
      }
    };

    const subLloyd = (pool, ns, ri, sx) => {
      const sumX = new Float64Array(ns), sumY = new Float64Array(ns), cnt = new Float64Array(ns);
      for (const r of pool) {
        const i = subregion_r[r] - ri * 200;
        if (i >= 0 && i < ns) { sumX[i] += mesh.x_of_r(r); sumY[i] += mesh.y_of_r(r); cnt[i]++; }
      }
      return sx.map((v, i) => cnt[i] > 0 ? [sumX[i] / cnt[i], sumY[i] / cnt[i]] : v);
    };

    for (let ri = 0; ri < n; ri++) {
      const pool = landR.filter(r => region_r[r] === ri);
      if (pool.length < 2) continue;
      const ns = Math.min(numSub, pool.length);

      let sxy = farthestPointSeeds(ns, pool, mesh, rfSub);
      subVoronoi(pool, ns, ri, sxy);
      for (let iter = 0; iter < subLloydIter; iter++) {
        sxy = subLloyd(pool, ns, ri, sxy);
        subVoronoi(pool, ns, ri, sxy);
      }

      if (subNoiseScale < BORDER_NAT * 2) {
        const sp    = Math.round(3 * (1 - subVariance));
        const ssOff = new Float32Array(mesh.numRegions);
        for (const r of pool) {
          const nx = mesh.x_of_r(r) / S, ny = mesh.y_of_r(r) / S;
          ssOff[r] = nbNoise.noise2D(nx * 6 + 20, ny * 6 + 20) * BORDER_NAT * 3;
        }
        for (let pass = 0; pass < sp; pass++) {
          for (const r of pool) {
            mesh.r_around_r(r, rOut);
            let bestSub = subregion_r[r], bestOff = ssOff[r];
            for (const nb of rOut) {
              if (water_r[nb] || mesh.is_ghost_r(nb) || region_r[nb] !== ri || subregion_r[nb] === -1) continue;
              if (ssOff[nb] < bestOff) { bestOff = ssOff[nb]; bestSub = subregion_r[nb]; }
            }
            subregion_r[r] = bestSub;
          }
        }
      }
    }
  }

  return { region_r, subregion_r };
}
