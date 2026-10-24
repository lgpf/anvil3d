// Copia só os arquivos de runtime necessários para app/vendor (o executável não leva node_modules).
import { cpSync, mkdirSync, rmSync } from 'node:fs';
const v = 'app/vendor';
rmSync(v, { recursive: true, force: true });
mkdirSync(`${v}/addons/controls`, { recursive: true });
mkdirSync(`${v}/addons/lines`, { recursive: true });
for (const f of ['LineSegments2.js', 'LineSegmentsGeometry.js', 'LineMaterial.js']) cpSync(`node_modules/three/examples/jsm/lines/${f}`, `${v}/addons/lines/${f}`);
for (const f of ['three.module.js', 'three.core.js']) cpSync(`node_modules/three/build/${f}`, `${v}/${f}`);
for (const f of ['OrbitControls.js', 'TransformControls.js']) cpSync(`node_modules/three/examples/jsm/controls/${f}`, `${v}/addons/controls/${f}`);
for (const f of ['manifold.js', 'manifold.wasm']) cpSync(`node_modules/manifold-3d/${f}`, `${v}/${f}`);
cpSync('node_modules/meshoptimizer/meshopt_simplifier.js', `${v}/meshopt_simplifier.js`);
cpSync('node_modules/meshoptimizer/LICENSE.md', `${v}/LICENSE-meshoptimizer.txt`);
cpSync('node_modules/three/LICENSE', `${v}/LICENSE-three.txt`);
cpSync('node_modules/manifold-3d/LICENSE', `${v}/LICENSE-manifold.txt`);
// texto 3D: leitor de fontes e as fontes DejaVu (licença livre, ver LICENSE-dejavu.txt)
cpSync('node_modules/opentype.js/dist/opentype.module.js', `${v}/opentype.module.js`);
cpSync('node_modules/opentype.js/LICENSE', `${v}/LICENSE-opentype.txt`);
mkdirSync(`${v}/fontes`, { recursive: true });
for (const f of ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSerif.ttf', 'DejaVuSerif-Bold.ttf', 'DejaVuSansMono.ttf', 'DejaVuSansCondensed-Bold.ttf'])
  cpSync(`node_modules/dejavu-fonts-ttf/ttf/${f}`, `${v}/fontes/${f}`);
cpSync('node_modules/dejavu-fonts-ttf/LICENSE', `${v}/LICENSE-dejavu.txt`);
// STEP: OpenCascade compilado para WebAssembly (só leitura), carregado na hora de importar um .step
for (const f of ['occt-import-js.js', 'occt-import-js.wasm', 'occt-import-js-worker.js']) cpSync(`node_modules/occt-import-js/dist/${f}`, `${v}/${f}`);
cpSync('node_modules/occt-import-js/dist/license.occt.txt', `${v}/LICENSE-occt.txt`);
cpSync('node_modules/occt-import-js/dist/license.occt-import-js.txt', `${v}/LICENSE-occt-import-js.txt`);
console.log('vendor ok');
