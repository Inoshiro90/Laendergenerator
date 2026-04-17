import { LW_COAST, LW_REGION, LW_SUB, LW_ENCLAVE, DASH, DASH_ENCLAVE, PALETTE } from './config.js';

// ── Color Helpers ─────────────────────────────────────────────────────────────

// Returns the fill color for a given region + optional sub-region.
// When randomColors=true, we slightly perturb the region's base hue.
function getRegionFill(regionIdx, numRegions, subregionIdx, renderOpts) {
  const base  = PALETTE.regions[regionIdx % PALETTE.regions.length];
  if (!renderOpts.useColors) return '#ffffff';
  if (renderOpts.randomRegionColors) {
    // Perturb lightness slightly per sub-region for variation
    return shiftLightness(base, subregionIdx >= 0 ? ((subregionIdx % 3) - 1) * 7 : 0);
  }
  // Sub-region tint: cycle through ±6 lightness
  if (subregionIdx >= 0) {
    return shiftLightness(base, ((subregionIdx % 3) - 1) * 6);
  }
  return base;
}

// Parses a hex color #rrggbb, shifts the luminance by deltaL in [0,100],
// and returns a new hex string. Purely numeric, no DOM needed.
function shiftLightness(hex, deltaL) {
  if (!deltaL) return hex;
  const r = parseInt(hex.slice(1,3), 16) / 255;
  const g = parseInt(hex.slice(3,5), 16) / 255;
  const b = parseInt(hex.slice(5,7), 16) / 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0, l = (max+min)/2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch (max) {
      case r: h = ((g-b)/d + (g<b?6:0))/6; break;
      case g: h = ((b-r)/d + 2)/6; break;
      case b: h = ((r-g)/d + 4)/6; break;
    }
  }
  l = Math.max(0, Math.min(1, l + deltaL/100));
  return hslToHex(h*360, s*100, l*100);
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h/30) % 12;
  const a = s * Math.min(l, 1-l);
  const f = n => l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n), 1)));
  const toHex = x => Math.round(x*255).toString(16).padStart(2,'0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

// ── Hatch Pattern Builder ─────────────────────────────────────────────────────
// Creates a small canvas tile with diagonal lines and returns a CanvasPattern.
function makeHatchPattern(ctx, lineColor, spacing = 7, angle = 45) {
  const sz   = spacing * 2;
  const off  = document.createElement('canvas');
  off.width  = sz;
  off.height = sz;
  const oc   = off.getContext('2d');
  oc.strokeStyle = lineColor;
  oc.lineWidth   = 0.8;
  oc.beginPath();
  // Two diagonal lines per tile at requested angle
  const rad  = angle * Math.PI / 180;
  const cos  = Math.cos(rad);
  const sin  = Math.sin(rad);
  const len  = sz * 2;
  for (let offset = -len; offset <= len * 2; offset += spacing) {
    oc.moveTo(offset * cos - len * sin, offset * sin + len * cos);
    oc.lineTo(offset * cos + len * sin, offset * sin - len * cos);
  }
  oc.stroke();
  return ctx.createPattern(off, 'repeat');
}

// ── Canvas Renderer ───────────────────────────────────────────────────────────
// renderOpts defaults come from RENDER_DEFAULTS in config.js, overridden by UI.
export function drawMap(ctx, S, p, mesh, water_r, region_r, subregion_r, lines, enclave_r, renderOpts = {}) {
  const ro = {
    useColors:            true,
    useWaterFill:         true,
    useHatching:          true,
    randomRegionColors:   false,
    showRegionBorders:    true,
    showSubRegionBorders: true,
    ...renderOpts,
  };

  const hasEnclaves = enclave_r && enclave_r.some(v => v > 0);
  const numRegions  = p.nr > 0 ? (p.nr || 1) : 1;
  const sOut        = [];

  // ── Background fill ────────────────────────────────────────────────────────
  ctx.clearRect(0, 0, S, S);
  if (ro.useColors && ro.useWaterFill) {
    ctx.fillStyle = PALETTE.water;
  } else {
    ctx.fillStyle = '#ffffff';
  }
  ctx.fillRect(0, 0, S, S);

  // ── Water hatch pattern (over the background, only if wanted) ─────────────
  let waterHatchPattern = null;
  let enclaveHatchPattern = null;
  if (ro.useColors && ro.useHatching) {
    waterHatchPattern   = makeHatchPattern(ctx, PALETTE.waterDark,   8, 45);
    enclaveHatchPattern = makeHatchPattern(ctx, PALETTE.enclaveHatch, 6, -45);
  }

  if (waterHatchPattern) {
    ctx.fillStyle = waterHatchPattern;
    ctx.fillRect(0, 0, S, S);
  }

  // ── Land fill ──────────────────────────────────────────────────────────────
  for (let r = 0; r < mesh.numSolidRegions; r++) {
    if (water_r[r]) continue;
    mesh.s_around_r(r, sOut);
    if (!sOut.length) continue;

    // Determine fill colour
    let fillColor;
    if (ro.useColors && p.nr > 0) {
      const ri  = region_r[r] ?? 0;
      const sri = (ro.showSubRegionBorders && p.nsr > 0 && subregion_r[r] !== -1)
        ? (subregion_r[r] % 200)
        : -1;
      fillColor = getRegionFill(ri, numRegions, sri, ro);
    } else if (ro.useColors) {
      fillColor = PALETTE.land;
    } else {
      fillColor = '#ffffff';
    }

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
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  // ── Enclave fill & hatch ───────────────────────────────────────────────────
  if (hasEnclaves) {
    for (let r = 0; r < mesh.numSolidRegions; r++) {
      if (!enclave_r[r]) continue;
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
      if (ro.useColors) {
        ctx.fillStyle = PALETTE.enclaveFill;
        ctx.fill();
        if (enclaveHatchPattern) {
          ctx.fillStyle = enclaveHatchPattern;
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#e8e8e8';
        ctx.fill();
      }
    }
  }

  // ── Edge categorisation ────────────────────────────────────────────────────
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
      if (e0 || e1) enclaveCoastS.push(s);
      else          coastS.push(s);
    } else if (!w0 && !w1) {
      if (ro.showRegionBorders && p.nr > 0 && region_r[r0] !== region_r[r1]) {
        regS.push(s);
      } else if (
        ro.showSubRegionBorders && p.nr > 0 && p.nsr > 0 &&
        region_r[r0] === region_r[r1] &&
        subregion_r[r0] !== -1 &&
        subregion_r[r0] !== subregion_r[r1]
      ) {
        subS.push(s);
      }
    }
  }

  // ── Border drawing ─────────────────────────────────────────────────────────
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

  const borderRegion  = ro.useColors ? PALETTE.borderRegion  : '#000';
  const borderSub     = ro.useColors ? PALETTE.borderSub     : '#000';
  const borderCoast   = ro.useColors ? PALETTE.borderCoast   : '#000';
  const borderEnclave = ro.useColors ? PALETTE.borderEnclave : '#444';

  drawSides(subS,          LW_SUB,           [DASH, DASH + 2],                   borderSub);
  drawSides(regS,          LW_REGION,        null,                               borderRegion);
  drawSides(enclaveCoastS, LW_ENCLAVE + 1,   null,                               'rgba(0,0,0,.06)');
  drawSides(enclaveCoastS, LW_ENCLAVE,       [DASH_ENCLAVE, DASH_ENCLAVE + 2],   borderEnclave);
  drawSides(coastS,        LW_COAST + 2,     null,                               'rgba(0,0,0,.12)');
  drawSides(coastS,        LW_COAST,         null,                               borderCoast);

  ctx.strokeStyle = PALETTE.borderFrame; ctx.lineWidth = 1.5; ctx.setLineDash([]);
  ctx.strokeRect(1, 1, S - 2, S - 2);
}

// ── SVG Builder ───────────────────────────────────────────────────────────────
// Supports color fills per region. Each Voronoi cell is emitted as an individual
// filled path so no geometry merging is needed.
export function makeSVG(S, p, mesh, water_r, region_r, subregion_r, lines, enclave_r, renderOpts = {}) {
  const ro = {
    useColors: true, useWaterFill: true, useHatching: false,
    randomRegionColors: false, showRegionBorders: true, showSubRegionBorders: true,
    ...renderOpts,
  };

  const hasEnclaves = enclave_r && enclave_r.some(v => v > 0);
  const sOut        = [];

  // ── Land cells grouped by fill color ──────────────────────────────────────
  const colorPaths = new Map();  // fillColor -> path strings[]

  for (let r = 0; r < mesh.numSolidRegions; r++) {
    if (water_r[r]) continue;

    let fillColor = '#ffffff';
    if (ro.useColors && p.nr > 0) {
      const ri  = region_r[r] ?? 0;
      const sri = (ro.showSubRegionBorders && p.nsr > 0 && subregion_r[r] !== -1)
        ? (subregion_r[r] % 200) : -1;
      fillColor = getRegionFill(ri, p.nr, sri, ro);
    } else if (ro.useColors) {
      fillColor = PALETTE.land;
    }

    mesh.s_around_r(r, sOut);
    if (!sOut.length) continue;
    const v = [];
    for (const s of sOut) {
      const t = mesh.t_inner_s(s);
      if (!mesh.is_ghost_t(t)) v.push(`${mesh.x_of_t(t).toFixed(1)},${mesh.y_of_t(t).toFixed(1)}`);
    }
    if (v.length > 2) {
      if (!colorPaths.has(fillColor)) colorPaths.set(fillColor, []);
      colorPaths.get(fillColor).push(`M${v.join('L')}Z`);
    }
  }

  // ── Enclave cells ─────────────────────────────────────────────────────────
  const enclPaths = [];
  if (hasEnclaves) {
    for (let r = 0; r < mesh.numSolidRegions; r++) {
      if (!enclave_r[r]) continue;
      mesh.s_around_r(r, sOut);
      if (!sOut.length) continue;
      const v = [];
      for (const s of sOut) {
        const t = mesh.t_inner_s(s);
        if (!mesh.is_ghost_t(t)) v.push(`${mesh.x_of_t(t).toFixed(1)},${mesh.y_of_t(t).toFixed(1)}`);
      }
      if (v.length > 2) enclPaths.push(`M${v.join('L')}Z`);
    }
  }

  // ── Border edges ──────────────────────────────────────────────────────────
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
      if (e0 || e1) eP.push(d);
      else          cP.push(d);
    } else if (!w0 && !w1) {
      if (ro.showRegionBorders && p.nr > 0 && region_r[r0] !== region_r[r1]) {
        rP.push(d);
      } else if (
        ro.showSubRegionBorders && p.nr > 0 && p.nsr > 0 &&
        region_r[r0] === region_r[r1] &&
        subregion_r[r0] !== subregion_r[r1] &&
        subregion_r[r0] !== -1 && subregion_r[r1] !== -1
      ) {
        sP.push(d);
      }
    }
  }

  // ── SVG assembly ──────────────────────────────────────────────────────────
  const waterBg     = ro.useColors && ro.useWaterFill ? PALETTE.water : 'white';
  const borderCoast = ro.useColors ? PALETTE.borderCoast   : 'black';
  const borderReg   = ro.useColors ? PALETTE.borderRegion  : 'black';
  const borderSub   = ro.useColors ? PALETTE.borderSub     : 'black';
  const borderEncl  = ro.useColors ? PALETTE.borderEnclave : '#444444';

  // Build land fill paths grouped by color
  let landFills = '';
  for (const [color, paths] of colorPaths) {
    landFills += `<path d="${paths.join('')}" fill="${color}" stroke="none"/>\n`;
  }

  const enclaveFill = enclPaths.length
    ? `<path d="${enclPaths.join('')}" fill="${ro.useColors ? PALETTE.enclaveFill : '#e0e0e0'}" stroke="none"/>\n`
    : '';

  const enclaveBorder = eP.length
    ? `<path d="${eP.join('')}" stroke="${borderEncl}" stroke-width="${LW_ENCLAVE}" stroke-dasharray="${DASH_ENCLAVE},${DASH_ENCLAVE + 2}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>\n`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
<rect width="${S}" height="${S}" fill="${waterBg}"/>
${landFills}${enclaveFill}<path d="${sP.join('')}" stroke="${borderSub}" stroke-width="${LW_SUB}" stroke-dasharray="${DASH},${DASH + 2}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${rP.join('')}" stroke="${borderReg}" stroke-width="${LW_REGION}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
${enclaveBorder}<path d="${cP.join('')}" stroke="${borderCoast}" stroke-width="${LW_COAST}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="1" y="1" width="${S - 2}" height="${S - 2}" fill="none" stroke="${PALETTE.borderFrame}" stroke-width="1.5"/>
</svg>`;
}
