import { S, RES_STEPS } from './config.js';

// ── Filename Builder ──────────────────────────────────────────────────────────
export function buildFilename(p, ext) {
  const SHAPE_CODE = {
    compact:      'ko',
    'elongated':  'el',
    'elongated-h':'eh',
    'elongated-v':'ev',
    prorupted:    'pr',
    fragmented:   'fr',
    perforated:   'pe',
    complex:      'cx',
  };
  const shapeCode = SHAPE_CODE[p.landShape] ?? 'ko';

  const parts = [
    `s${p.seed}`,
    `sz${p.size}`,
    `ks${p.shape}`,
    `lg${shapeCode}`,
    `gr${p.noisyPct}`,
    `r${p.nr}`,
    `rv${p.nrvarPct}`,
    `u${p.nsr}`,
    `uv${p.nsrvarPct}`,
  ];

  // Shape-specific suffix tokens
  if (p.landShape === 'elongated') {
    if (p.stretch_angle != null) parts.push(`sa${p.stretch_angle}`);
    if (p.aspect_ratio  != null) parts.push(`ar${Math.round(p.aspect_ratio * 10)}`);
  }
  if (p.landShape === 'fragmented') {
    if (p.cluster_count  != null) parts.push(`cc${p.cluster_count}`);
    if (p.cluster_spread != null) parts.push(`cs${Math.round(p.cluster_spread * 100)}`);
  }
  if (p.landShape === 'prorupted') {
    if (p.protrusion_angle  != null) parts.push(`pa${Math.round(p.protrusion_angle)}`);
    if (p.protrusion_length != null) parts.push(`pl${Math.round(p.protrusion_length * 100)}`);
  }
  if (p.landShape === 'perforated') {
    if (p.enclave_count  != null) parts.push(`ec${p.enclave_count}`);
    if (p.enclave_radius != null) parts.push(`er${Math.round(p.enclave_radius * 100)}`);
  }
  if (p.landShape === 'complex') {
    if (p.complex_preset != null) parts.push(`cx${p.complex_preset.slice(0,3)}`);
  }

  return parts.join('_') + '.' + ext;
}

// ── Export Handlers ───────────────────────────────────────────────────────────
export function initExport(getSvgOut, getParams) {
  document.getElementById('bPNG').addEventListener('click', async () => {
    const svgOut = getSvgOut();
    if (!svgOut) { alert('Bitte zuerst generieren.'); return; }

    const p     = getParams();
    const resPx = RES_STEPS[+document.getElementById('res').value];
    const fname = buildFilename(p, 'png');

    if (resPx === S) {
      triggerDownload(fname, document.getElementById('map').toDataURL('image/png'));
      return;
    }

    const blob = new Blob([svgOut], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      const oc = document.createElement('canvas');
      oc.width = resPx; oc.height = resPx;
      oc.getContext('2d').drawImage(img, 0, 0, resPx, resPx);
      URL.revokeObjectURL(url);
      triggerDownload(fname, oc.toDataURL('image/png'));
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  });

  document.getElementById('bSVG').addEventListener('click', () => {
    const svgOut = getSvgOut();
    if (!svgOut) { alert('Bitte zuerst generieren.'); return; }
    const p    = getParams();
    const blob = new Blob([svgOut], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    triggerDownload(buildFilename(p, 'svg'), url);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
}

function triggerDownload(filename, href) {
  const a    = document.createElement('a');
  a.download = filename;
  a.href     = href;
  a.click();
}
