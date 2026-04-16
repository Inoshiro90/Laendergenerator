// Poisson disc sampling with an O(1) active-set removal.
// Returns { pts, numBoundary } where the first numBoundary entries form the
// boundary ring that keeps Voronoi cells well-formed near the canvas edges.
export function poissonDisc(rf, W, H, r) {
  const cell  = r / Math.SQRT2;
  const cols  = Math.ceil(W / cell);
  const rows  = Math.ceil(H / cell);
  const grid  = new Int32Array(cols * rows).fill(-1);
  const pts   = [];

  const gi = (x, y) => ((y / cell) | 0) * cols + ((x / cell) | 0);

  const ok = (x, y) => {
    if (x < 0 || x > W || y < 0 || y > H) return false;
    const cx = (x / cell) | 0, cy = (y / cell) | 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        const id = grid[ny * cols + nx];
        if (id >= 0) {
          const ex = pts[id][0] - x, ey = pts[id][1] - y;
          if (ex*ex + ey*ey < r*r) return false;
        }
      }
    }
    return true;
  };

  const add = (x, y) => {
    const i = pts.length;
    pts.push([x, y]);
    if (x >= 0 && x <= W && y >= 0 && y <= H) grid[gi(x, y)] = i;
  };

  // Two staggered rows of boundary points along each edge.
  // The inner row is slightly jittered so boundary Voronoi cells are small and
  // irregular rather than long strips parallel to the canvas edge.
  const bspc = r * Math.SQRT2;
  const nW   = Math.ceil(W / bspc);
  const nH   = Math.ceil(H / bspc);

  for (let i = 0; i <= nW; i++) {
    const x   = W * (i + 0.5) / (nW + 1);
    const jit = rf() * r * 0.6;
    add(x, jit);   add(x, H - jit);
    add(x, 0);     add(x, H);
  }
  for (let i = 0; i <= nH; i++) {
    const y   = H * (i + 0.5) / (nH + 1);
    const jit = rf() * r * 0.6;
    add(jit, y);   add(W - jit, y);
    add(0, y);     add(W, y);
  }
  const numBoundary = pts.length;

  // Seed interior with one point near the centre.
  const cx = W / 2 + (rf() - 0.5) * 10;
  const cy = H / 2 + (rf() - 0.5) * 10;
  add(ok(cx, cy) ? cx : W / 2, ok(cx, cy) ? cy : H / 2);
  const active = [pts.length - 1];

  while (active.length) {
    // Pick a random active point and try to place a neighbour.
    const ri = (rf() * active.length) | 0;
    const [px, py] = pts[active[ri]];
    let found = false;
    for (let k = 0; k < 28; k++) {
      const a  = rf() * Math.PI * 2;
      const d  = r * (1 + rf());
      const nx = px + Math.cos(a) * d;
      const ny = py + Math.sin(a) * d;
      if (ok(nx, ny)) { add(nx, ny); active.push(pts.length - 1); found = true; break; }
    }
    if (!found) {
      // O(1) swap-remove instead of O(n) splice.
      active[ri] = active[active.length - 1];
      active.pop();
    }
  }

  return { pts, numBoundary };
}
