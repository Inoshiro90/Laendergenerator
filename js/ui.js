import { RES_LABELS, RENDER_DEFAULTS } from './config.js';

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
    el.style.display = (el.dataset.visibleFor === shape) ? '' : 'none';
  });
}

// ── Render Options ────────────────────────────────────────────────────────────
// Stored in module state; synced with localStorage.
let _renderOpts = { ...RENDER_DEFAULTS };

function loadRenderOpts() {
  try {
    const saved = localStorage.getItem('carto-render-opts');
    if (saved) _renderOpts = { ...RENDER_DEFAULTS, ...JSON.parse(saved) };
  } catch (_) {}
}

function saveRenderOpts() {
  try { localStorage.setItem('carto-render-opts', JSON.stringify(_renderOpts)); } catch (_) {}
}

export function getRenderOpts() {
  return { ..._renderOpts };
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
  const seedRaw   = document.getElementById('seed').value.trim();
  const seed      = seedRaw !== '' ? +seedRaw : 187;

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
    _parametricProrupted: true,
  };

  if (currentShape === 'elongated') {
    p.stretch_angle = +document.getElementById('stretch_angle').value;
    p.aspect_ratio  = +document.getElementById('aspect_ratio').value / 10;
    p.taper         = +document.getElementById('elong_taper').value / 100;
  }
  if (currentShape === 'prorupted') {
    const autoAngle = document.getElementById('prot_auto_angle')?.checked ?? true;
    p.protrusion_angle      = autoAngle ? (seed * 137.508) % 360 : +document.getElementById('prot_angle').value;
    p.protrusion_length     = +document.getElementById('prot_length').value / 100;
    p.protrusion_width_base = +document.getElementById('prot_width').value / 100;
    p.protrusion_taper      = +document.getElementById('prot_taper').value / 100;
    p.main_body_size        = 0.50;
  }
  if (currentShape === 'fragmented') {
    p.cluster_count   = +document.getElementById('cluster_count').value;
    p.cluster_spread  = +document.getElementById('cluster_spread').value / 100;
    p.cluster_size_variance = +document.getElementById('cluster_size_var').value / 100;
    p.island_elongation = 1.3;
    p.island_orientation_variance = 0.9;
    p.min_island_area_fraction = 0.04;
  }
  if (currentShape === 'perforated') {
    p.enclave_count        = +document.getElementById('enclave_count').value;
    p.enclave_radius       = +document.getElementById('enclave_radius').value / 100;
    p.enclave_coast_margin = 0.10;
    p.enclave_shape_noise  = 0.15;
  }
  if (currentShape === 'complex') {
    p.complex_preset          = document.getElementById('complex_preset')?.value ?? 'usa';
    p.complex_component_count = +(document.getElementById('complex_count')?.value ?? 2);
    p.min_component_area      = 0.05;
  }
  return p;
}

// ── Slider + Number Input Bidirectional Binding ───────────────────────────────
// For each slider we also maintain a paired <input type="number">.
// Both stay in sync. formatter() maps raw value to display string.
function bindSliderNumber(sliderId, labelValueId, fmt, onChangeFn) {
  const slider = document.getElementById(sliderId);
  const numId  = sliderId + '_num';
  const numEl  = document.getElementById(numId);
  const labelVal = document.getElementById(labelValueId);

  if (!slider) return;

  const update = (val) => {
    if (labelVal) labelVal.textContent = fmt(+val);
    if (numEl)    numEl.value = val;
    if (onChangeFn) onChangeFn(+val);
  };

  update(slider.value);

  slider.addEventListener('input', () => update(slider.value));

  if (numEl) {
    numEl.addEventListener('input', () => {
      const clamped = Math.max(+numEl.min, Math.min(+numEl.max, +numEl.value));
      slider.value  = clamped;
      update(clamped);
    });
    numEl.addEventListener('change', () => {
      const clamped = Math.max(+numEl.min, Math.min(+numEl.max, +numEl.value));
      numEl.value   = clamped;
      slider.value  = clamped;
    });
  }
}

// ── Slider Definitions ────────────────────────────────────────────────────────
const SIZE_LABELS  = ['Klein', 'Klein-Mittel', 'Mittel', 'Mittel-Groß', 'Groß'];
const SHAPE_LABELS = ['Rund', 'Leicht buchtig', 'Buchtig', 'Stark buchtig', 'Fjordreich'];

const SLIDER_DEFS = [
  // [sliderId, labelValueId, formatter]
  ['size',    'vsize',    v => SIZE_LABELS[v - 1]],
  ['shape',   'vshape',   v => SHAPE_LABELS[v - 1]],
  ['noisy',   'vnoisy',   v => v + ' %'],
  ['nr',      'vnr',      v => v === 0 ? 'Keine' : String(v)],
  ['nrvar',   'vnrvar',   v => v + ' %'],
  ['nsr',     'vnsr',     v => v === 0 ? 'Keine' : String(v)],
  ['nsrvar',  'vnsrvar',  v => v + ' %'],
  ['res',     'vres',     v => RES_LABELS[v]],
  ['stretch_angle', 'vstretch_angle', v => v + '°'],
  ['aspect_ratio',  'vaspect_ratio',  v => (v / 10).toFixed(1) + ':1'],
  ['elong_taper',   'velong_taper',   v => v + ' %'],
  ['prot_angle',    'vprot_angle',    v => v + '°'],
  ['prot_length',   'vprot_length',   v => (v / 100).toFixed(2)],
  ['prot_width',    'vprot_width',    v => (v / 100).toFixed(2)],
  ['prot_taper',    'vprot_taper',    v => v + ' %'],
  ['cluster_count',    'vcluster_count',    v => String(v)],
  ['cluster_spread',   'vcluster_spread',   v => v + ' %'],
  ['cluster_size_var', 'vcluster_size_var', v => v + ' %'],
  ['enclave_count',    'venclave_count',    v => String(v)],
  ['enclave_radius',   'venclave_radius',   v => (v / 100).toFixed(2)],
  ['complex_count',    'vcomplex_count',    v => String(v)],
];

// ── Render Options Panel ──────────────────────────────────────────────────────
function initRenderOpts(onChangeFn) {
  loadRenderOpts();

  const toggleIds = [
    ['ro_colors',    'useColors'],
    ['ro_water',     'useWaterFill'],
    ['ro_hatch',     'useHatching'],
    ['ro_rand',      'randomRegionColors'],
    ['ro_borders',   'showRegionBorders'],
    ['ro_subborders','showSubRegionBorders'],
  ];

  for (const [id, key] of toggleIds) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.checked = _renderOpts[key];
    el.addEventListener('change', () => {
      _renderOpts[key] = el.checked;
      saveRenderOpts();
      if (onChangeFn) onChangeFn();
    });
  }
}

// ── initUI ────────────────────────────────────────────────────────────────────
export function initUI({ onShapeChange, onRenderChange }) {
  loadRenderOpts();

  // Slider + number binding
  for (const [sid, vid, fmt] of SLIDER_DEFS) {
    bindSliderNumber(sid, vid, fmt);
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

  // Random seed
  document.getElementById('btnRandom').addEventListener('click', () => {
    const v = (Math.random() * 2147483647) | 0;
    document.getElementById('seed').value = v;
    const numEl = document.getElementById('seed_num');
    if (numEl) numEl.value = v;
  });

  // Prorupted auto-angle toggle
  const autoAngleEl = document.getElementById('prot_auto_angle');
  if (autoAngleEl) {
    const manualRow = document.getElementById('prot_angle_row');
    const toggle = () => { if (manualRow) manualRow.style.display = autoAngleEl.checked ? 'none' : ''; };
    toggle();
    autoAngleEl.addEventListener('change', toggle);
  }

  // Render options
  initRenderOpts(onRenderChange);

  // Collapsible sections: <details> elements are native HTML,
  // but we also save open/closed state in localStorage.
  document.querySelectorAll('.collapsible-section').forEach(details => {
    const key = 'carto-sec-' + details.id;
    const saved = localStorage.getItem(key);
    if (saved === 'closed') details.removeAttribute('open');
    else if (saved === 'open') details.setAttribute('open', '');
    details.addEventListener('toggle', () => {
      localStorage.setItem(key, details.open ? 'open' : 'closed');
    });
  });

  // Initial panel state
  updateShapePanels('compact');

  // Seed number input sync (seed has no label span, just a plain number input)
  const seedSlider = document.getElementById('seed');
  const seedNum    = document.getElementById('seed_num');
  if (seedSlider && seedNum) {
    seedSlider.addEventListener('input', () => { seedNum.value = seedSlider.value; });
    seedNum.addEventListener('input', () => {
      const v = Math.max(0, Math.min(2147483647, +seedNum.value | 0));
      seedSlider.value = v;
      seedNum.value    = v;
    });
  }
}
