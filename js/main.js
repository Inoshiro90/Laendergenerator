import { S, MESH_SPACING, COMPLEX_PRESETS }     from './config.js';
import { mkRng, mkRandInt, buildSimplex }         from './math.js';
import { TriangleMesh }                           from './mesh.js';
import { buildNoisyLines }                        from './noise-edges.js';
import { poissonDisc }                            from './poisson.js';
import { assignWater }                            from './terrain.js';
import { assignRegions }                          from './regions.js';
import { drawMap, makeSVG }                       from './renderer.js';
import { initExport }                             from './export.js';
import { initUI, getP, setStatus }                from './ui.js';
import {
  placeClusterCenters,
  computeClusterProperties,
  buildFragmentedFalloff,
} from './fragmented.js';
import { buildComplexFalloff, getPresetComponents } from './complex-shape.js';

// ── Module state ──────────────────────────────────────────────────────────────
let svgOut       = null;
let currentShape = 'compact';
let isGenerating = false;

const tick = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

// ── Main generation pipeline ──────────────────────────────────────────────────
async function _gen() {
  const p = getP(currentShape);

  // ── Pre-compute shape-specific falloff functions ───────────────────────────
  if (p.landShape === 'fragmented') {
    const centers = placeClusterCenters(
      p.seed,
      p.cluster_count          ?? 4,
      p.cluster_spread         ?? 0.65,
      p.cluster_min_separation ?? 0.22,
    );
    const { sizes, orientations, elongations } = computeClusterProperties(centers, p.seed, p);
    p.fragmentedFalloffFn = buildFragmentedFalloff(centers, sizes, orientations, elongations);
  }

  if (p.landShape === 'complex') {
    const components = getPresetComponents(
      p.complex_preset ?? 'usa',
      p.seed,
      p.complex_component_count ?? 2,
    );
    p.complexFalloffFn = buildComplexFalloff(components);
  }

  setStatus('Punkte verteilen…'); await tick();
  const { pts, numBoundary } = poissonDisc(mkRng(p.seed), S, S, MESH_SPACING);
  if (pts.length < 4) throw new Error('Zu wenige Punkte — anderen Seed versuchen');

  setStatus('Triangulierung…'); await tick();
  const del  = Delaunator.from(pts);
  const mesh = new TriangleMesh(pts, del, numBoundary);

  setStatus('Terrain…'); await tick();
  const noise               = buildSimplex(p.seed);
  const { water_r, enclave_r } = assignWater(
    mesh, noise, p.round, p.inflate, p.landShape, p,
  );

  let landCount = 0;
  for (let r = 0; r < mesh.numSolidRegions; r++) if (!water_r[r]) landCount++;
  if (landCount < 8) throw new Error('Keine Landmasse — anderen Seed versuchen');

  setStatus('Regionen…'); await tick();
  const { region_r, subregion_r } = assignRegions(
    mesh, water_r, p.nr, p.nsr, p.nrvar, p.nsrvar, p.seed,
  );

  setStatus('Noisy Edges…'); await tick();
  const lines = buildNoisyLines(mesh, mkRandInt(p.seed ^ 0x55443322), p.noisy);

  setStatus('Zeichne…'); await tick();
  drawMap(
    document.getElementById('map').getContext('2d'),
    S, p, mesh, water_r, region_r, subregion_r, lines, enclave_r,
  );

  setStatus('SVG…'); await tick();
  svgOut = makeSVG(S, p, mesh, water_r, region_r, subregion_r, lines, enclave_r);

  setStatus(`Seed ${p.seed} — Fertig`, true);
}

// ── Public generate() ─────────────────────────────────────────────────────────
function generate() {
  if (isGenerating) return;
  isGenerating = true;

  const btn   = document.getElementById('btnGen');
  const label = btn.querySelector('.btn-label');
  btn.classList.add('busy');
  btn.disabled = true;
  label.textContent = 'Generiere…';

  _gen()
    .catch(e => {
      console.error(e);
      setStatus('Fehler: ' + e.message);
    })
    .finally(() => {
      btn.classList.remove('busy');
      btn.disabled = false;
      label.textContent = 'Karte generieren';
      isGenerating = false;
    });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
initUI({ onShapeChange: shape => { currentShape = shape; } });
initExport(() => svgOut, () => getP(currentShape));
document.getElementById('btnGen').addEventListener('click', generate);
generate();
