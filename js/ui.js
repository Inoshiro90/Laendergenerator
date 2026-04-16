import { RES_LABELS, FRAGMENTED_DEFAULTS, PROTRUSION_DEFAULTS, PERFORATED_DEFAULTS } from './config.js';

// ── Status Badge ──────────────────────────────────────────────────────────────
export function setStatus(msg, fade = false) {
  const el = document.getElementById('st');
  el.textContent = msg;
  el.classList.remove('gone');
  if (fade) setTimeout(() => el.classList.add('gone'), 2800);
}

// ── Shape-Specific Panel Visibility ──────────────────────────────────────────
function updateShapePanels(shape) {
  document.querySelectorAll('.shape-options').forEach(el => {
    const visFor = el.dataset.visibleFor;
    el.style.display = (visFor === shape) ? '' : 'none';
  });
}

// ── Parameter Reader ──────────────────────────────────────────────────────────
export function getP(currentShape) {
  const size    = +document.getElementById('size').value;
  const shape   = +document.getElementById('shape').value;
  const inflate = 0.25 + (size - 1) * 0.10;
  const round   = 0.62 - (shape - 1) * 0.12;

  const noisyPct  = +document.getElementById('noisy').value;
  const nrvarPct  = +document.getElementById('nrvar').value;
  const nsrvarPct = +document.getElementById('nsrvar').value;

  const seedRaw = document.getElementById('seed').value.trim();
  const seed    = seedRaw !== '' ? +seedRaw : 187;

  const p = {
    seed, inflate, round, size, shape,
    landShape:  currentShape,
    nr:         +document.getElementById('nr').value    | 0,
    nrvar:      nrvarPct  / 100,
    nrvarPct,
    nsr:        +document.getElementById('nsr').value   | 0,
    nsrvar:     nsrvarPct / 100,
    nsrvarPct,
    noisyPct,
    noisy:      noisyPct / 100 * 0.38,
    // Signal parametric prorupted (not legacy fallback)
    _parametricProrupted: true,
  };

  // ── Elongated params ────────────────────────────────────────────────────────
  if (currentShape === 'elongated') {
    p.stretch_angle = +document.getElementById('stretch_angle').value;
    p.aspect_ratio  = +document.getElementById('aspect_ratio').value / 10; // slider 15-50 → 1.5-5.0
    p.taper         = +document.getElementById('elong_taper').value / 100;
  }

  // ── Prorupted params ────────────────────────────────────────────────────────
  if (currentShape === 'prorupted') {
    const autoAngle = document.getElementById('prot_auto_angle')?.checked ?? true;
    p.protrusion_angle       = autoAngle
      ? (seed * 137.508) % 360  // seed-derived angle
      : +document.getElementById('prot_angle').value;
    p.protrusion_length      = +document.getElementById('prot_length').value / 100;
    p.protrusion_width_base  = +document.getElementById('prot_width').value / 100;
    p.protrusion_taper       = +document.getElementById('prot_taper').value / 100;
    p.main_body_size         = 0.50;
  }

  // ── Fragmented params ────────────────────────────────────────────────────────
  if (currentShape === 'fragmented') {
    p.cluster_count            = +document.getElementById('cluster_count').value;
    p.cluster_spread           = +document.getElementById('cluster_spread').value / 100;
    p.cluster_size_variance    = +document.getElementById('cluster_size_var').value / 100;
    p.cluster_min_separation   = 0.22;
    p.island_elongation        = 1.3;
    p.island_orientation_variance = 0.9;
    p.min_island_area_fraction = 0.04;
  }

  // ── Perforated params ────────────────────────────────────────────────────────
  if (currentShape === 'perforated') {
    p.enclave_count         = +document.getElementById('enclave_count').value;
    p.enclave_radius        = +document.getElementById('enclave_radius').value / 100;
    p.enclave_coast_margin  = 0.10;
    p.enclave_shape_noise   = 0.15;
  }

  // ── Complex params ────────────────────────────────────────────────────────
  if (currentShape === 'complex') {
    p.complex_preset           = document.getElementById('complex_preset')?.value ?? 'usa';
    p.complex_component_count  = +document.getElementById('complex_count')?.value ?? 2;
    p.min_component_area       = 0.05;
  }

  return p;
}

// ── Slider Label Formatters ───────────────────────────────────────────────────
const SIZE_LABELS  = ['Klein', 'Klein-Mittel', 'Mittel', 'Mittel-Groß', 'Groß'];
const SHAPE_LABELS = ['Rund', 'Leicht buchtig', 'Buchtig', 'Stark buchtig', 'Fjordreich'];

const SLIDER_BINDS = [
  ['size',    'vsize',    v => SIZE_LABELS[v - 1]],
  ['shape',   'vshape',   v => SHAPE_LABELS[v - 1]],
  ['noisy',   'vnoisy',   v => v + ' %'],
  ['nr',      'vnr',      v => v === 0 ? 'Keine' : String(v)],
  ['nrvar',   'vnrvar',   v => v + ' %'],
  ['nsr',     'vnsr',     v => v === 0 ? 'Keine' : String(v)],
  ['nsrvar',  'vnsrvar',  v => v + ' %'],
  ['res',     'vres',     v => RES_LABELS[v]],
  // Elongated
  ['stretch_angle', 'vstretch_angle', v => v + '°'],
  ['aspect_ratio',  'vaspect_ratio',  v => (v / 10).toFixed(1) + ':1'],
  ['elong_taper',   'velong_taper',   v => v + ' %'],
  // Prorupted
  ['prot_angle',  'vprot_angle',  v => v + '°'],
  ['prot_length', 'vprot_length', v => (v / 100).toFixed(2)],
  ['prot_width',  'vprot_width',  v => (v / 100).toFixed(2)],
  ['prot_taper',  'vprot_taper',  v => v + ' %'],
  // Fragmented
  ['cluster_count',    'vcluster_count',    v => String(v)],
  ['cluster_spread',   'vcluster_spread',   v => v + ' %'],
  ['cluster_size_var', 'vcluster_size_var', v => v + ' %'],
  // Perforated
  ['enclave_count',  'venclave_count',  v => String(v)],
  ['enclave_radius', 'venclave_radius', v => (v / 100).toFixed(2)],
  // Complex
  ['complex_count', 'vcomplex_count', v => String(v)],
];

// ── initUI ────────────────────────────────────────────────────────────────────
export function initUI({ onShapeChange }) {
  // Slider label sync (skip missing elements gracefully)
  for (const [id, vid, fmt] of SLIDER_BINDS) {
    const el = document.getElementById(id);
    const vl = document.getElementById(vid);
    if (!el || !vl) continue;
    vl.textContent = fmt(+el.value);
    el.addEventListener('input', () => vl.textContent = fmt(+el.value));
  }

  // Shape (Landgestalt) buttons
  const shapeBtns = document.querySelectorAll('.shape-btn');
  shapeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      shapeBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      const shape = btn.dataset.shape;
      updateShapePanels(shape);
      onShapeChange(shape);
    });
  });

  // Random seed button
  document.getElementById('btnRandom').addEventListener('click', () => {
    document.getElementById('seed').value = (Math.random() * 2147483647) | 0;
  });

  // Prorupted: toggle angle slider visibility
  const autoAngleEl = document.getElementById('prot_auto_angle');
  if (autoAngleEl) {
    const manualRow = document.getElementById('prot_angle_row');
    const toggle = () => {
      if (manualRow) manualRow.style.display = autoAngleEl.checked ? 'none' : '';
    };
    toggle();
    autoAngleEl.addEventListener('change', toggle);
  }

  // Initial panel state: hide all shape-specific panels
  updateShapePanels('compact');
}
