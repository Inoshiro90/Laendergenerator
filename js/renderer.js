import { LW_COAST, LW_REGION, LW_SUB, LW_ENCLAVE, DASH, DASH_ENCLAVE } from './config.js';

// ── Canvas Renderer ───────────────────────────────────────────────────────────
// enclave_r is optional (Uint8Array or null/undefined); backwards compatible.
export function drawMap(ctx, S, p, mesh, water_r, region_r, subregion_r, lines, enclave_r) {
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, S, S);

  const hasEnclaves = enclave_r && enclave_r.some(v => v > 0);
  const sOut = [];

  // ── Land fill ──────────────────────────────────────────────────────────────
  for (let r = 0; r < mesh.numSolidRegions; r++) {
    if (water_r[r]) continue;
    mesh.s_around_r(r, sOut);
    if (!sOut.length) continue;
    ctx.beginPath();
    let first = true;
    for (const s of sOut) {
      const t = mesh.t_inner_s(s);
      if (mesh.is_ghost_t(t)) continue;
      const x = mesh.x_of_t(t), y = mesh.y_of_t(t);
      if (first) { ctx.moveTo(x, y); first = false; }
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  // ── Edge categorisation ────────────────────────────────────────────────────
  // enclaveCoastS: land ↔ enclave (dashed inner border)
  // coastS:        land ↔ ocean
  // regS:          land ↔ land, different regions
  // subS:          land ↔ land, same region, different sub-regions
  const coastS = [], regS = [], subS = [], enclaveCoastS = [];

  for (let s = 0; s < mesh.numSolidSides; s++) {
    const r0 = mesh.r_begin_s(s), r1 = mesh.r_end_s(s);
    if (r0 >= r1) continue;
    if (mesh.s_opposite_s(s) === -1) continue;
    const seg = lines[s]; if (!seg || !seg.length) continue;

    const isGhost0 = mesh.is_ghost_r(r0);
    const isGhost1 = mesh.is_ghost_r(r1);
    const w0       = water_r[r0] || isGhost0;
    const w1       = water_r[r1] || isGhost1;
    const e0       = hasEnclaves && !isGhost0 && enclave_r[r0] === 1;
    const e1       = hasEnclaves && !isGhost1 && enclave_r[r1] === 1;

    if (w0 !== w1) {
      // Boundary between water and land — distinguish ocean coast from enclave
      if (e0 || e1) {
        enclaveCoastS.push(s);
      } else {
        coastS.push(s);
      }
    } else if (!w0 && !w1) {
      // Both land — region / sub-region borders
      if (p.nr > 0 && region_r[r0] !== region_r[r1]) {
        regS.push(s);
      } else if (
        p.nr > 0 && p.nsr > 0 &&
        region_r[r0] === region_r[r1] &&
        subregion_r[r0] !== -1 &&
        subregion_r[r0] !== subregion_r[r1]
      ) {
        subS.push(s);
      }
    }
  }

  const drawSides = (sides, lw, dash, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth   = lw;
    ctx.setLineDash(dash || []);
    for (const s of sides) {
      const seg = lines[s]; if (!seg || !seg.length) continue;
      const t0  = mesh.t_inner_s(s);
      ctx.beginPath();
      ctx.moveTo(mesh.x_of_t(t0), mesh.y_of_t(t0));
      for (const [x, y] of seg) ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  };

  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // Draw order: sub-regions → regions → enclave borders → coast shadow → coast
  drawSides(subS,         LW_SUB,           [DASH, DASH + 2],           '#000');
  drawSides(regS,         LW_REGION,        null,                        '#000');
  drawSides(enclaveCoastS, LW_ENCLAVE + 1,  null,                        'rgba(0,0,0,.08)');
  drawSides(enclaveCoastS, LW_ENCLAVE,      [DASH_ENCLAVE, DASH_ENCLAVE + 2], '#000');
  drawSides(coastS,       LW_COAST + 2,     null,                        'rgba(0,0,0,.1)');
  drawSides(coastS,       LW_COAST,         null,                        '#000');

  // Border frame
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.setLineDash([]);
  ctx.strokeRect(1, 1, S - 2, S - 2);
}

// ── SVG Builder ───────────────────────────────────────────────────────────────
export function makeSVG(S, p, mesh, water_r, region_r, subregion_r, lines, enclave_r) {
  const hasEnclaves = enclave_r && enclave_r.some(v => v > 0);
  const landPaths   = [];
  const sOut        = [];

  for (let r = 0; r < mesh.numSolidRegions; r++) {
    if (water_r[r]) continue;
    mesh.s_around_r(r, sOut);
    if (!sOut.length) continue;
    const v = [];
    for (const s of sOut) {
      const t = mesh.t_inner_s(s);
      if (!mesh.is_ghost_t(t)) v.push(`${mesh.x_of_t(t).toFixed(1)},${mesh.y_of_t(t).toFixed(1)}`);
    }
    if (v.length > 2) landPaths.push(`M${v.join('L')}Z`);
  }

  const cP = [], rP = [], sP = [], eP = [];

  for (let s = 0; s < mesh.numSolidSides; s++) {
    const r0 = mesh.r_begin_s(s), r1 = mesh.r_end_s(s);
    if (r0 >= r1) continue;
    if (mesh.s_opposite_s(s) === -1) continue;
    const seg = lines[s]; if (!seg || !seg.length) continue;

    const w0  = water_r[r0] || mesh.is_ghost_r(r0);
    const w1  = water_r[r1] || mesh.is_ghost_r(r1);
    const e0  = hasEnclaves && !mesh.is_ghost_r(r0) && enclave_r[r0] === 1;
    const e1  = hasEnclaves && !mesh.is_ghost_r(r1) && enclave_r[r1] === 1;
    const t0  = mesh.t_inner_s(s);
    const d   =
      `M${mesh.x_of_t(t0).toFixed(1)},${mesh.y_of_t(t0).toFixed(1)}` +
      seg.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join('');

    if (w0 !== w1) {
      if (e0 || e1) { eP.push(d); }
      else          { cP.push(d); }
    } else if (!w0 && !w1) {
      if (p.nr > 0 && region_r[r0] !== region_r[r1]) {
        rP.push(d);
      } else if (
        p.nr > 0 && p.nsr > 0 &&
        region_r[r0] === region_r[r1] &&
        subregion_r[r0] !== subregion_r[r1] &&
        subregion_r[r0] !== -1 && subregion_r[r1] !== -1
      ) {
        sP.push(d);
      }
    }
  }

  const enclavePath = eP.length
    ? `\n<path d="${eP.join('')}" stroke="black" stroke-width="${LW_ENCLAVE}" stroke-dasharray="${DASH_ENCLAVE},${DASH_ENCLAVE + 2}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
<rect width="${S}" height="${S}" fill="white"/>
<path d="${landPaths.join('')}" fill="white" stroke="none"/>
<path d="${sP.join('')}" stroke="black" stroke-width="${LW_SUB}" stroke-dasharray="${DASH},${DASH + 2}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${rP.join('')}" stroke="black" stroke-width="${LW_REGION}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>${enclavePath}
<path d="${cP.join('')}" stroke="black" stroke-width="${LW_COAST}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="1" y="1" width="${S - 2}" height="${S - 2}" fill="none" stroke="black" stroke-width="1.5"/>
</svg>`;
}
