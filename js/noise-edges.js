import { NOISY_LEN } from './config.js';

export function lerpv(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// Recursively subdivides the dual edge between two Voronoi cell circumcentres
// using the shared Delaunay edge's endpoints (p, q) as a "corridor" to
// constrain lateral displacement. This produces naturally jagged borders that
// never cross each other.
//
// amp clamped to [0, 0.38]: beyond ~0.4 the midpoint can leave the corridor
// entirely, producing degenerate spikes.
export function buildNoisyLines(mesh, randInt, amp) {
  amp = Math.max(0, Math.min(0.38, amp));
  const lenSq = NOISY_LEN * NOISY_LEN;
  const div   = 0x10000000;

  function subdivide(a, b, p, q) {
    const dx = a[0] - b[0], dy = a[1] - b[1];
    if (dx*dx + dy*dy < lenSq) return [b];
    const ap = lerpv(a, p, 0.5), bp = lerpv(b, p, 0.5);
    const aq = lerpv(a, q, 0.5), bq = lerpv(b, q, 0.5);
    const t  = 0.5 * (1 - amp) + (randInt(div) / div) * amp;
    const c  = lerpv(p, q, t);
    return [...subdivide(a, c, ap, aq), ...subdivide(c, b, bp, bq)];
  }

  const lines = new Array(mesh.numSides);

  for (let s = 0; s < mesh.numSides; s++) {
    const r0 = mesh.r_begin_s(s), r1 = mesh.r_end_s(s);
    if (r0 < r1) {
      if (mesh.is_ghost_s(s)) {
        lines[s] = [mesh.pos_of_t(mesh.t_outer_s(s))];
      } else {
        lines[s] = subdivide(
          mesh.pos_of_t(mesh.t_inner_s(s)),
          mesh.pos_of_t(mesh.t_outer_s(s)),
          mesh.pos_of_r(r0),
          mesh.pos_of_r(r1),
        );
      }
      const opp = mesh.s_opposite_s(s);
      if (opp !== -1) {
        // Reverse the forward path so the opposite half-edge is consistent.
        const rev = lines[s].slice(0, -1).reverse();
        rev.push(mesh.pos_of_t(mesh.t_inner_s(s)));
        lines[opp] = rev;
      }
    }
  }

  return lines;
}
