// Dual-mesh structure over a Delaunay triangulation.
// Regions (r) = Voronoi cells / original point sites.
// Triangles (t) = Delaunay triangles / Voronoi vertices.
// Sides (s) = half-edges. Each side s has an opposite s' = halfedges[s].
export class TriangleMesh {
  static t_from_s(s) { return (s / 3) | 0; }
  static s_next_s(s) { return (s % 3 === 2) ? s - 2 : s + 1; }

  constructor(points, del, numBoundary) {
    this.numBoundaryRegions = numBoundary;
    this._vertex_r   = points.slice();
    this._triangles  = del.triangles;
    this._halfedges  = del.halfedges;
    this.numSolidSides = del.triangles.length;
    this._vertex_t   = [];
    this._addGhosts();
    this._build();
  }

  // Delaunator leaves boundary half-edges without opposites (halfedge === -1).
  // We close the convex hull by adding ghost triangles that fan out to a single
  // ghost region placed at infinity. This lets all subsequent code treat the
  // mesh as if it were a sphere.
  _addGhosts() {
    const T = this._triangles, H = this._halfedges, ns = T.length;
    let nu = 0, first = -1;
    const unp = {};
    for (let s = 0; s < ns; s++) {
      if (H[s] === -1) { nu++; unp[T[s]] = s; first = s; }
    }
    const rg = this._vertex_r.length;
    this._vertex_r.push([NaN, NaN]);
    const nT = new Int32Array(ns + 3 * nu);
    const nH = new Int32Array(ns + 3 * nu);
    nT.set(T); nH.set(H);
    let i = 0, s = first;
    while (i < nu) {
      const sg = ns + 3 * i;
      nH[s] = sg; nH[sg] = s;
      nT[sg]   = nT[TriangleMesh.s_next_s(s)];
      nT[sg+1] = nT[s];
      nT[sg+2] = rg;
      const k = ns + (3 * i + 4) % (3 * nu);
      nH[sg+2] = k; nH[k] = sg + 2;
      s = unp[nT[TriangleMesh.s_next_s(s)]];
      i++;
    }
    this._triangles = nT;
    this._halfedges = nH;
  }

  _build() {
    const T = this._triangles, H = this._halfedges, vr = this._vertex_r;
    this.numSides          = T.length;
    this.numRegions        = vr.length;
    this.numSolidRegions   = this.numRegions - 1;
    this.numTriangles      = this.numSides / 3;
    this.numSolidTriangles = this.numSolidSides / 3;

    // For each region: one outgoing side (used to walk the neighbourhood).
    this._s_of_r = new Int32Array(this.numRegions);
    for (let s = 0; s < T.length; s++) {
      const ep = T[TriangleMesh.s_next_s(s)];
      if (this._s_of_r[ep] === 0 || H[s] === -1) this._s_of_r[ep] = s;
    }

    // Triangle circumcentres (= Voronoi vertices).
    // Ghost triangles get a point slightly outside the hull so lines don't collapse.
    this._vertex_t = new Array(this.numTriangles);
    for (let t = 0; t < this.numTriangles; t++) {
      const base = 3 * t;
      const a = vr[T[base]], b = vr[T[base+1]], c = vr[T[base+2]];
      if (this.is_ghost_s(base)) {
        const dx  = b[0] - a[0], dy = b[1] - a[1];
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        const sc  = 10 / len;
        this._vertex_t[t] = [0.5*(a[0]+b[0]) + dy*sc, 0.5*(a[1]+b[1]) - dx*sc];
      } else {
        this._vertex_t[t] = [(a[0]+b[0]+c[0])/3, (a[1]+b[1]+c[1])/3];
      }
    }
  }

  x_of_r(r)       { return this._vertex_r[r][0]; }
  y_of_r(r)       { return this._vertex_r[r][1]; }
  x_of_t(t)       { return this._vertex_t[t][0]; }
  y_of_t(t)       { return this._vertex_t[t][1]; }
  pos_of_r(r)     { return this._vertex_r[r]; }
  pos_of_t(t)     { return this._vertex_t[t]; }
  r_begin_s(s)    { return this._triangles[s]; }
  r_end_s(s)      { return this._triangles[TriangleMesh.s_next_s(s)]; }
  t_inner_s(s)    { return TriangleMesh.t_from_s(s); }
  t_outer_s(s)    { return TriangleMesh.t_from_s(this._halfedges[s]); }
  s_opposite_s(s) { return this._halfedges[s]; }
  r_ghost()       { return this.numRegions - 1; }
  is_ghost_r(r)   { return r === this.numRegions - 1; }
  is_ghost_s(s)   { return s >= this.numSolidSides; }
  is_ghost_t(t)   { return this.is_ghost_s(3 * t); }
  is_boundary_r(r){ return r < this.numBoundaryRegions; }

  r_around_r(r, out = []) {
    const s0 = this._s_of_r[r]; let inc = s0;
    out.length = 0;
    do {
      out.push(this.r_begin_s(inc));
      inc = this._halfedges[TriangleMesh.s_next_s(inc)];
    } while (inc !== -1 && inc !== s0);
    return out;
  }

  s_around_r(r, out = []) {
    const s0 = this._s_of_r[r]; let inc = s0;
    out.length = 0;
    do {
      out.push(this._halfedges[inc]);
      inc = this._halfedges[TriangleMesh.s_next_s(inc)];
    } while (inc !== -1 && inc !== s0);
    return out;
  }
}
