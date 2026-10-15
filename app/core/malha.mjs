import { tr, tt } from './i18n.mjs';
// Malhas editáveis (triângulos/vértices). No documento a malha fica como base64 de
// Float32 (vértices xyz) e Uint32 (triângulos), compacto e rápido de salvar/desfazer.

// ---------- base64 <-> arrays ----------
function paraB64(arr) {
  const b = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
function deB64(txt, Tipo) {
  const s = atob(txt), b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return new Tipo(b.buffer);
}

const cache = new Map(); // rev -> {v, t}
export function lerMalha(no) {
  const k = no.malha.rev;
  let d = cache.get(k);
  if (!d) {
    d = { v: deB64(no.malha.v, Float32Array), t: deB64(no.malha.t, Uint32Array) };
    if (cache.size > 30) cache.delete(cache.keys().next().value);
    cache.set(k, d);
  }
  return d;
}
export function gravarMalha(no, d) {
  const rev = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  no.malha = { rev, v: paraB64(d.v), t: paraB64(d.t) };
  cache.set(rev, d);
}
export const numTriangulos = no => Math.round(no.malha.t.length * 3 / 4 / 12);

// ---------- conversões ----------
export function deManifold(m) {
  const g = m.getMesh(), np = g.numProp, n = g.vertProperties.length / np;
  const v = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) v[i * 3 + k] = g.vertProperties[i * np + k];
  return { v, t: new Uint32Array(g.triVerts) };
}
export function paraManifold(wasm, d) {
  const mesh = new wasm.Mesh({ numProp: 3, vertProperties: d.v, triVerts: d.t });
  mesh.merge();
  return new wasm.Manifold(mesh); // lança erro se a malha não for fechada
}

// ---------- utilidades ----------
export function soldar(d, tol = 1e-4) {
  const mapa = new Map(), novo = [], remap = new Uint32Array(d.v.length / 3);
  for (let i = 0; i < remap.length; i++) {
    const x = d.v[i * 3], y = d.v[i * 3 + 1], z = d.v[i * 3 + 2];
    const k = Math.round(x / tol) + ',' + Math.round(y / tol) + ',' + Math.round(z / tol);
    let j = mapa.get(k);
    if (j === undefined) { j = novo.length / 3; mapa.set(k, j); novo.push(x, y, z); }
    remap[i] = j;
  }
  const t = [];
  for (let i = 0; i < d.t.length; i += 3) {
    const a = remap[d.t[i]], b = remap[d.t[i + 1]], c = remap[d.t[i + 2]];
    if (a !== b && b !== c && a !== c) t.push(a, b, c); // descarta triângulos degenerados
  }
  return { v: new Float32Array(novo), t: new Uint32Array(t) };
}

export function compactar(d) {
  const uso = new Int32Array(d.v.length / 3).fill(-1), v = [];
  const t = new Uint32Array(d.t.length);
  for (let i = 0; i < d.t.length; i++) {
    const o = d.t[i];
    if (uso[o] < 0) { uso[o] = v.length / 3; v.push(d.v[o * 3], d.v[o * 3 + 1], d.v[o * 3 + 2]); }
    t[i] = uso[o];
  }
  return { v: new Float32Array(v), t };
}

// arestas de borda (usadas por um triângulo só) com a orientação do triângulo
export function bordas(d) {
  const cont = new Map();
  for (let i = 0; i < d.t.length; i += 3) for (let k = 0; k < 3; k++) {
    const a = d.t[i + k], b = d.t[i + (k + 1) % 3];
    const ch = a < b ? a + ',' + b : b + ',' + a;
    const e = cont.get(ch);
    if (e) e.n++; else cont.set(ch, { n: 1, a, b });
  }
  const r = [];
  for (const e of cont.values()) if (e.n === 1) r.push([e.a, e.b]);
  return r;
}

export function apagarTriangulos(d, indices) {
  const fora = new Set(indices), t = [];
  for (let i = 0; i < d.t.length / 3; i++) if (!fora.has(i)) t.push(d.t[i * 3], d.t[i * 3 + 1], d.t[i * 3 + 2]);
  return compactar({ v: d.v, t: new Uint32Array(t) });
}

// Fecha cada buraco com um leque a partir do centro do contorno.
export function fecharBuracos(d) {
  const b = bordas(d);
  if (!b.length) return { dados: d, buracos: 0 };
  // saídas de cada vértice pelas arestas de borda (pode haver mais de uma em vértices "pinçados")
  const saidas = new Map();
  b.forEach(([a, c], i) => (saidas.get(a) ?? saidas.set(a, []).get(a)).push(i));
  const usada = new Uint8Array(b.length);
  const v = Array.from(d.v), t = Array.from(d.t);
  let buracos = 0;
  for (let e0 = 0; e0 < b.length; e0++) {
    if (usada[e0]) continue;
    const laco = [];
    let e = e0;
    while (e !== undefined && !usada[e]) {
      usada[e] = 1; laco.push(b[e][0]);
      e = (saidas.get(b[e][1]) ?? []).find(x => !usada[x]);
    }
    // um contorno que passa duas vezes pelo mesmo vértice vira dois buracos simples
    const pilha = [], pos = new Map(), lacos = [];
    for (const x of laco) {
      if (pos.has(x)) { const j = pos.get(x); const sub = pilha.splice(j + 1); lacos.push([x, ...sub]); sub.forEach(y => pos.delete(y)); }
      else { pos.set(x, pilha.length); pilha.push(x); }
    }
    lacos.push(pilha);
    for (const l of lacos) {
      if (l.length < 3) continue;
      buracos++;
      const c = [0, 0, 0];
      for (const i of l) for (let k = 0; k < 3; k++) c[k] += d.v[i * 3 + k] / l.length;
      const ic = v.length / 3; v.push(...c);
      for (let k = 0; k < l.length; k++) t.push(l[(k + 1) % l.length], l[k], ic);
    }
  }
  return { dados: { v: new Float32Array(v), t: new Uint32Array(t) }, buracos };
}

// Faces vizinhas quase coplanares a partir de uma semente
export function faceplana(d, sementes, tolGraus = 1) {
  const n = d.t.length / 3, normal = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [a, b, c] = [d.t[i * 3], d.t[i * 3 + 1], d.t[i * 3 + 2]].map(x => [d.v[x * 3], d.v[x * 3 + 1], d.v[x * 3 + 2]]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const x = u[1] * w[2] - u[2] * w[1], y = u[2] * w[0] - u[0] * w[2], z = u[0] * w[1] - u[1] * w[0], l = Math.hypot(x, y, z) || 1;
    normal[i * 3] = x / l; normal[i * 3 + 1] = y / l; normal[i * 3 + 2] = z / l;
  }
  const viz = new Map();
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
    const a = d.t[i * 3 + k], b = d.t[i * 3 + (k + 1) % 3], ch = a < b ? a + ',' + b : b + ',' + a;
    (viz.get(ch) ?? viz.set(ch, []).get(ch)).push(i);
  }
  const lim = Math.cos(tolGraus * Math.PI / 180), sel = new Set(sementes), fila = [...sementes];
  while (fila.length) {
    const i = fila.pop();
    for (let k = 0; k < 3; k++) {
      const a = d.t[i * 3 + k], b = d.t[i * 3 + (k + 1) % 3];
      for (const j of viz.get(a < b ? a + ',' + b : b + ',' + a)) {
        if (sel.has(j)) continue;
        const dot = normal[i * 3] * normal[j * 3] + normal[i * 3 + 1] * normal[j * 3 + 1] + normal[i * 3 + 2] * normal[j * 3 + 2];
        if (dot >= lim) { sel.add(j); fila.push(j); }
      }
    }
  }
  return sel;
}

// Simplificação por colapso de arestas com erro quádrico (meshoptimizer).
export async function simplificar(Simplificador, d, { proporcao = 0.5, erroMax = 0, manterBordas = true } = {}) {
  await Simplificador.ready;
  const s = soldar(d, 1e-5);
  const alvo = Math.max(3, Math.floor((s.t.length / 3) * proporcao) * 3);
  const flags = ['ErrorAbsolute', ...(manterBordas ? ['LockBorder'] : [])];
  const [idx, erro] = Simplificador.simplify(s.t, s.v, 3, alvo, erroMax > 0 ? erroMax : 1e9, flags);
  return { dados: compactar({ v: s.v, t: idx }), erro };
}

// ---------- STL ----------
export function lerStl(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const binario = bytes.length >= 84 && 84 + dv.getUint32(80, true) * 50 === bytes.length;
  const v = [];
  if (binario) {
    const n = dv.getUint32(80, true);
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) v.push(dv.getFloat32(84 + i * 50 + 12 + k * 12 + j * 4, true));
  } else {
    const txt = new TextDecoder().decode(bytes);
    const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
    let m; while ((m = re.exec(txt))) v.push(+m[1], +m[2], +m[3]);
    if (!v.length) throw new Error(tr('arquivo STL vazio ou inválido'));
  }
  const t = new Uint32Array(v.length / 3).map((_, i) => i);
  return soldar({ v: new Float32Array(v), t });
}

// Divide uma malha não indexada (3 vértices por triângulo, na ordem) em regiões planas.
// Cada região guarda os triângulos, a normal, o centro (ponderado pela área) e a área.
export function regioesPlanas(pos, tolGraus = 1) {
  const n = pos.length / 9, lim = Math.cos(tolGraus * Math.PI / 180);
  const id = new Map(), vi = new Uint32Array(n * 3);
  for (let i = 0; i < n * 3; i++) {
    const k = Math.round(pos[i * 3] * 1e4) + ',' + Math.round(pos[i * 3 + 1] * 1e4) + ',' + Math.round(pos[i * 3 + 2] * 1e4);
    let j = id.get(k); if (j === undefined) { j = id.size; id.set(k, j); }
    vi[i] = j;
  }
  const nor = new Float32Array(n * 3), area = new Float32Array(n);
  for (let t = 0; t < n; t++) {
    const o = t * 9;
    const ux = pos[o + 3] - pos[o], uy = pos[o + 4] - pos[o + 1], uz = pos[o + 5] - pos[o + 2];
    const wx = pos[o + 6] - pos[o], wy = pos[o + 7] - pos[o + 1], wz = pos[o + 8] - pos[o + 2];
    const x = uy * wz - uz * wy, y = uz * wx - ux * wz, z = ux * wy - uy * wx, l = Math.hypot(x, y, z);
    area[t] = l / 2;
    if (l > 0) { nor[t * 3] = x / l; nor[t * 3 + 1] = y / l; nor[t * 3 + 2] = z / l; }
  }
  const viz = new Map();
  for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) {
    const a = vi[t * 3 + k], b = vi[t * 3 + (k + 1) % 3], ch = a < b ? a + ',' + b : b + ',' + a;
    (viz.get(ch) ?? viz.set(ch, []).get(ch)).push(t);
  }
  const rotulo = new Int32Array(n).fill(-1), regioes = [];
  for (let s = 0; s < n; s++) {
    if (rotulo[s] >= 0) continue;
    const r = regioes.length, ns = [nor[s * 3], nor[s * 3 + 1], nor[s * 3 + 2]];
    const tris = [s], fila = [s]; rotulo[s] = r;
    while (fila.length) {
      const t = fila.pop();
      for (let k = 0; k < 3; k++) {
        const a = vi[t * 3 + k], b = vi[t * 3 + (k + 1) % 3];
        for (const u of viz.get(a < b ? a + ',' + b : b + ',' + a)) {
          if (rotulo[u] >= 0) continue;
          if (nor[u * 3] * ns[0] + nor[u * 3 + 1] * ns[1] + nor[u * 3 + 2] * ns[2] < lim) continue;
          rotulo[u] = r; tris.push(u); fila.push(u);
        }
      }
    }
    let A = 0; const c = [0, 0, 0];
    for (const t of tris) {
      const o = t * 9; A += area[t];
      for (let k = 0; k < 3; k++) c[k] += area[t] * (pos[o + k] + pos[o + 3 + k] + pos[o + 6 + k]) / 3;
    }
    regioes.push({ tris, normal: ns, centro: A > 0 ? c.map(x => x / A) : [pos[s * 9], pos[s * 9 + 1], pos[s * 9 + 2]], area: A });
  }
  return { rotulo, regioes };
}

// ---------- diagnóstico e reparo para impressão 3D ----------
const chA = (a, b) => (a < b ? a + ',' + b : b + ',' + a);

function mapaArestas(t) {
  const m = new Map();
  for (let i = 0; i < t.length / 3; i++) for (let k = 0; k < 3; k++) {
    const a = t[i * 3 + k], b = t[i * 3 + (k + 1) % 3], ch = chA(a, b);
    (m.get(ch) ?? m.set(ch, []).get(ch)).push(i);
  }
  return m;
}
function componentes(t, arestas) {
  const n = t.length / 3, comp = new Int32Array(n).fill(-1);
  let c = 0;
  for (let s = 0; s < n; s++) {
    if (comp[s] >= 0) continue;
    const fila = [s]; comp[s] = c;
    while (fila.length) {
      const i = fila.pop();
      for (let k = 0; k < 3; k++) for (const j of arestas.get(chA(t[i * 3 + k], t[i * 3 + (k + 1) % 3]))) if (comp[j] < 0) { comp[j] = c; fila.push(j); }
    }
    c++;
  }
  return { comp, total: c };
}
function volumeAssinado(v, t, tris) {
  let s = 0;
  for (const i of tris) {
    const a = t[i * 3] * 3, b = t[i * 3 + 1] * 3, c = t[i * 3 + 2] * 3;
    s += v[a] * (v[b + 1] * v[c + 2] - v[b + 2] * v[c + 1]) - v[a + 1] * (v[b] * v[c + 2] - v[b + 2] * v[c]) + v[a + 2] * (v[b] * v[c + 1] - v[b + 1] * v[c]);
  }
  return s / 6;
}
// conta arestas percorridas no mesmo sentido pelas duas faces (normais incoerentes)
function arestasIncoerentes(t, arestas) {
  let n = 0;
  const sentido = (i, a, b) => { for (let k = 0; k < 3; k++) if (t[i * 3 + k] === a && t[i * 3 + (k + 1) % 3] === b) return true; return false; };
  for (const [ch, ts] of arestas) {
    if (ts.length !== 2) continue;
    const [a, b] = ch.split(',').map(Number);
    if (sentido(ts[0], a, b) === sentido(ts[1], a, b)) n++;
  }
  return n;
}

export function diagnosticar(d) {
  const s = soldar(d, 1e-5);
  const arestas = mapaArestas(s.t);
  let borda = 0, naoManifold = 0;
  for (const ts of arestas.values()) { if (ts.length === 1) borda++; else if (ts.length > 2) naoManifold++; }
  const vistos = new Set(); let duplicados = 0;
  for (let i = 0; i < s.t.length / 3; i++) {
    const k = [s.t[i * 3], s.t[i * 3 + 1], s.t[i * 3 + 2]].sort((x, y) => x - y).join(',');
    if (vistos.has(k)) duplicados++; else vistos.add(k);
  }
  const { comp, total } = componentes(s.t, arestas);
  const porComp = Array.from({ length: total }, () => []);
  comp.forEach((c, i) => porComp[c].push(i));
  const invertidas = porComp.filter(tr => volumeAssinado(s.v, s.t, tr) < 0).length;
  return {
    triangulos: d.t.length / 3,
    degenerados: d.t.length / 3 - s.t.length / 3,
    verticesSoltos: d.v.length / 3 - s.v.length / 3,
    duplicados, arestasBorda: borda, naoManifold,
    incoerentes: arestasIncoerentes(s.t, arestas),
    cascas: total, cascasInvertidas: invertidas,
    ok: borda === 0 && naoManifold === 0 && duplicados === 0 && invertidas === 0 && arestasIncoerentes(s.t, arestas) === 0,
  };
}

export function reparar(wasm, d, { fechar = true, volumeMinimo = 1, unirCascas = true } = {}) {
  const rel = [];
  // 1. soldar vértices repetidos e tirar triângulos degenerados
  let s = soldar(d, 1e-5);
  const deg = d.t.length / 3 - s.t.length / 3, sold = d.v.length / 3 - s.v.length / 3;
  if (sold > 0) rel.push(tt`${sold} vértices repetidos soldados`);
  if (deg > 0) rel.push(tt`${deg} triângulos degenerados removidos`);
  // 2. triângulos duplicados (iguais somem para um só; pares opostos são paredes internas: somem os dois)
  {
    const mapa = new Map(), fora = new Set();
    for (let i = 0; i < s.t.length / 3; i++) {
      const k = [s.t[i * 3], s.t[i * 3 + 1], s.t[i * 3 + 2]].sort((x, y) => x - y).join(',');
      if (mapa.has(k)) fora.add(i); else mapa.set(k, i);
    }
    if (fora.size) { s = apagarTriangulos(s, [...fora]); rel.push(tt`${fora.size} triângulos duplicados removidos`); }
  }
  // 3. arestas com mais de duas faces: tira as faces envolvidas (o buraco é tampado depois)
  {
    const ar = mapaArestas(s.t), fora = new Set();
    for (const ts of ar.values()) if (ts.length > 2) ts.forEach(i => fora.add(i));
    if (fora.size) { s = apagarTriangulos(s, [...fora]); rel.push(tt`${fora.size} triângulos em arestas não-manifold removidos`); }
  }
  // 4. orientação coerente dentro de cada casca, e para fora
  {
    const t = s.t, ar = mapaArestas(t), n = t.length / 3, feito = new Uint8Array(n), orig = t.slice();
    let viradas = 0;
    const sentido = (i, a, b) => { for (let k = 0; k < 3; k++) if (t[i * 3 + k] === a && t[i * 3 + (k + 1) % 3] === b) return true; return false; };
    const virar = i => { const x = t[i * 3 + 1]; t[i * 3 + 1] = t[i * 3 + 2]; t[i * 3 + 2] = x; };
    for (let sem = 0; sem < n; sem++) {
      if (feito[sem]) continue;
      const tris = [sem], fila = [sem]; feito[sem] = 1;
      while (fila.length) {
        const i = fila.pop();
        for (let k = 0; k < 3; k++) {
          const a = t[i * 3 + k], b = t[i * 3 + (k + 1) % 3], viz = ar.get(chA(a, b));
          if (viz.length !== 2) continue;
          const j = viz[0] === i ? viz[1] : viz[0];
          if (feito[j]) continue;
          if (sentido(j, a, b)) virar(j);
          feito[j] = 1; tris.push(j); fila.push(j);
        }
      }
      if (volumeAssinado(s.v, t, tris) < 0) tris.forEach(virar);
    }
    for (let i = 0; i < n; i++) if (t[i * 3 + 1] !== orig[i * 3 + 1]) viradas++;
    if (viradas) rel.push(tt`${viradas} triângulos com a normal invertida corrigidos`);
  }
  // 5. buracos
  if (fechar) { const f = fecharBuracos(s); if (f.buracos) { s = f.dados; rel.push(tt`${f.buracos} buraco(s) fechado(s)`); } }
  // 6. peças soltas muito pequenas
  const ar = mapaArestas(s.t), { comp, total } = componentes(s.t, ar);
  const cascas = Array.from({ length: total }, () => []);
  comp.forEach((c, i) => cascas[c].push(i));
  const pequenas = cascas.filter(tr => Math.abs(volumeAssinado(s.v, s.t, tr)) < volumeMinimo);
  if (volumeMinimo > 0 && pequenas.length && pequenas.length < cascas.length) {
    s = apagarTriangulos(s, pequenas.flat());
    rel.push(tt`${pequenas.length} peça(s) solta(s) menor(es) que ${volumeMinimo} mm³ removida(s)`);
  }
  // 7. cascas sobrepostas: une tudo num corpo só (o que também valida a malha)
  let fechada = false;
  if (unirCascas) {
    const ar2 = mapaArestas(s.t), cc = componentes(s.t, ar2), lista = Array.from({ length: cc.total }, () => []);
    cc.comp.forEach((c, i) => lista[c].push(i));
    try {
      const partes = lista.map(tr => {
        const t = new Uint32Array(tr.length * 3);
        tr.forEach((i, k) => t.set(s.t.subarray(i * 3, i * 3 + 3), k * 3));
        return paraManifold(wasm, compactar({ v: s.v, t }));
      });
      const u = wasm.Manifold.union(partes); partes.forEach(p => p.delete());
      const antes = s.t.length / 3;
      s = deManifold(u); u.delete(); fechada = true;
      if (lista.length > 1) rel.push(tt`${lista.length} cascas unidas num corpo só (${antes} → ${s.t.length / 3} triângulos)`);
    } catch { /* continua aberta: o relatório avisa */ }
  } else {
    try { paraManifold(wasm, s).delete(); fechada = true; } catch {}
  }
  if (!rel.length) rel.push(tr('nenhum problema encontrado'));
  return { dados: s, relatorio: rel, fechada };
}
