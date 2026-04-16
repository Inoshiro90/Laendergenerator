// ── PRNG — Xorshift32 ─────────────────────────────────────────────────────────
// Returns a function that yields uniform floats in [0, 1).
export function mkRng(seed) {
  let s = ((seed ^ 0) >>> 0) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// Returns a function that yields uniform integers in [0, n).
export function mkRandInt(seed) {
  const rf = mkRng(seed);
  return n => (rf() * n) | 0;
}

// ── Simplex Noise 2D ──────────────────────────────────────────────────────────
// Seeded via shuffle of the permutation table.
export function buildSimplex(seed) {
  const rf   = mkRng(seed);
  const perm = new Uint8Array(512);
  const p    = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j  = (rf() * (i + 1)) | 0;
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const g = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0,  1], [ 0, -1],
    [1, .5], [-1, .5], [1, -.5], [-1, -.5],
  ];
  const dot = (gv, x, y) => gv[0] * x + gv[1] * y;

  return {
    noise2D(xin, yin) {
      const F  = 0.5 * (Math.sqrt(3) - 1);
      const G  = (3 - Math.sqrt(3)) / 6;
      const s2 = (xin + yin) * F;
      const i  = Math.floor(xin + s2), j = Math.floor(yin + s2);
      const t0 = (i + j) * G;
      const x0 = xin - (i - t0), y0 = yin - (j - t0);
      const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + G,     y1 = y0 - j1 + G;
      const x2 = x0 - 1 + 2 * G,  y2 = y0 - 1 + 2 * G;
      const ii = i & 255, jj = j & 255;
      const gi0 = perm[ii      + perm[jj     ]] % 12;
      const gi1 = perm[ii + i1 + perm[jj + j1]] % 12;
      const gi2 = perm[ii + 1  + perm[jj + 1 ]] % 12;
      let n0 = 0, n1 = 0, n2 = 0, t;
      t = 0.5 - x0*x0 - y0*y0; if (t >= 0) { t *= t; n0 = t*t*dot(g[gi0], x0, y0); }
      t = 0.5 - x1*x1 - y1*y1; if (t >= 0) { t *= t; n1 = t*t*dot(g[gi1], x1, y1); }
      t = 0.5 - x2*x2 - y2*y2; if (t >= 0) { t *= t; n2 = t*t*dot(g[gi2], x2, y2); }
      return 70 * (n0 + n1 + n2);
    },
  };
}

// ── Fractal Brownian Motion ───────────────────────────────────────────────────
// Sums octaves of noise, each at double frequency and halved amplitude.
export function fbmNoise(noise, amplitudes, nx, ny) {
  let sum = 0, sumA = 0;
  for (let o = 0; o < amplitudes.length; o++) {
    const f = 1 << o;
    sum  += amplitudes[o] * noise.noise2D(nx * f, ny * f);
    sumA += amplitudes[o];
  }
  return sum / sumA;
}
