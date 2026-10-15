// Arestas, chanfro e fillet sobre malhas do Manifold.
//
// 1. extrairArestas(): acha as arestas vivas (dobra > 20°) e as junta em "feições":
//    retas (entre duas faces) e círculos (bordas de cilindros, furos, cones).
// 2. descritor()/casarArestas(): guarda cada aresta de forma que ela seja reencontrada
//    depois que a peça muda de medida (normais das faces + posição mais próxima).
// 3. ferramentas(): monta, para cada aresta, o sólido a remover (aresta convexa) ou a
//    acrescentar (aresta côncava, em cantos internos). aplicarAcabamento() faz as booleanas.

const ANG_VIVA = Math.cos(20 * Math.PI / 180);
const EPS = 0.01;      // folga para as ferramentas não deixarem película
const v = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
};
const r4 = a => a.map(x => Math.round(x * 1e4) / 1e4);

// Ramer–Douglas–Peucker sobre os índices ini..fim: devolve pares [k0, k1] de trechos praticamente retos
function trechosRetos(vs, ini, fim, P, tol = 0.02) {
  const a = P(vs[ini]), b = P(vs[fim]), ab = v.sub(b, a), l = v.len(ab) || 1;
  let kMax = -1, dMax = 0;
  for (let k = ini + 1; k < fim; k++) {
    const d = v.len(v.cross(v.sub(P(vs[k]), a), ab)) / l;
    if (d > dMax) { dMax = d; kMax = k; }
  }
  if (dMax <= tol || kMax < 0) return [[ini, fim]];
  return [...trechosRetos(vs, ini, kMax, P, tol), ...trechosRetos(vs, kMax, fim, P, tol)];
}

export function extrairArestas(manifold) {
  const m = manifold.getMesh();
  const np = m.numProp, P = i => [m.vertProperties[i * np], m.vertProperties[i * np + 1], m.vertProperties[i * np + 2]];
  // o Manifold duplica vértices na costura entre partes de origens diferentes (ex.: onde um furo cortou);
  // junta os vértices repetidos para as arestas dessas costuras também serem encontradas
  const nv = m.vertProperties.length / np, canon = new Uint32Array(nv);
  for (let i = 0; i < nv; i++) canon[i] = i;
  if (m.mergeFromVert?.length) for (let k = 0; k < m.mergeFromVert.length; k++) canon[m.mergeFromVert[k]] = m.mergeToVert[k];
  else { // sem o mapa de costuras: junta pela posição
    const vistos = new Map();
    for (let i = 0; i < nv; i++) {
      const k = Math.round(m.vertProperties[i * np] * 1e5) + ',' + Math.round(m.vertProperties[i * np + 1] * 1e5) + ',' + Math.round(m.vertProperties[i * np + 2] * 1e5);
      const j = vistos.get(k); if (j === undefined) vistos.set(k, i); else canon[i] = j;
    }
  }
  const T = m.triVerts.map(v => canon[v]), nt = T.length / 3;
  const nTri = [];
  for (let t = 0; t < nt; t++) {
    const a = P(T[t * 3]), b = P(T[t * 3 + 1]), c = P(T[t * 3 + 2]);
    nTri.push(v.norm(v.cross(v.sub(b, a), v.sub(c, a))));
  }
  // aresta -> triângulos
  const mapa = new Map();
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
    const i = T[t * 3 + k], j = T[t * 3 + (k + 1) % 3];
    const ch = i < j ? i + ',' + j : j + ',' + i;
    (mapa.get(ch) ?? mapa.set(ch, []).get(ch)).push(t);
  }
  const vivas = new Map(); // vértice -> [vizinhos]
  const trisDa = new Map();
  for (const [ch, ts] of mapa) {
    if (ts.length !== 2 || v.dot(nTri[ts[0]], nTri[ts[1]]) > ANG_VIVA) continue;
    const [i, j] = ch.split(',').map(Number);
    (vivas.get(i) ?? vivas.set(i, []).get(i)).push(j);
    (vivas.get(j) ?? vivas.set(j, []).get(j)).push(i);
    trisDa.set(ch, ts);
  }
  // encadeia por vértices de grau 2
  const usada = new Set(), cadeias = [];
  const chave = (i, j) => (i < j ? i + ',' + j : j + ',' + i);
  const andar = (ini, prox) => {
    const c = [ini, prox]; usada.add(chave(ini, prox));
    let ant = ini, at = prox;
    while ((vivas.get(at)?.length ?? 0) === 2 && at !== ini) {
      const nx = vivas.get(at).find(x => x !== ant && !usada.has(chave(at, x)));
      if (nx === undefined) break;
      usada.add(chave(at, nx)); c.push(nx); ant = at; at = nx;
    }
    return c;
  };
  for (const [i, viz] of vivas) if (viz.length !== 2) for (const j of viz) if (!usada.has(chave(i, j))) cadeias.push({ vs: andar(i, j), fechada: false });
  for (const [i, viz] of vivas) for (const j of viz) if (!usada.has(chave(i, j))) { const vs = andar(i, j); cadeias.push({ vs, fechada: vs[0] === vs[vs.length - 1] }); }

  // dados de uma aresta (segmento i-j): normais das faces e direções "para dentro" de cada face
  const lados = (i, j) => {
    const ts = trisDa.get(chave(i, j)), a = P(i), d = v.norm(v.sub(P(j), a));
    return ts.map(t => {
      const w = [T[t * 3], T[t * 3 + 1], T[t * 3 + 2]].find(x => x !== i && x !== j);
      const q = v.sub(P(w), a), u = v.norm(v.sub(q, v.mul(d, v.dot(q, d))));
      return { n: nTri[t], u };
    });
  };

  const feicoes = [];
  for (const c of cadeias) {
    const pts = c.vs.map(P);
    if (c.fechada) pts.pop();
    // círculo?
    if (c.fechada && pts.length >= 12) {
      const cen = v.mul(pts.reduce((s, p) => v.add(s, p), [0, 0, 0]), 1 / pts.length);
      let nrm = [0, 0, 0];
      for (let k = 0; k < pts.length; k++) nrm = v.add(nrm, v.cross(v.sub(pts[k], cen), v.sub(pts[(k + 1) % pts.length], cen)));
      nrm = v.norm(nrm);
      const rs = pts.map(p => v.dist(p, cen)), rm = rs.reduce((s, x) => s + x, 0) / rs.length;
      const plano = pts.every(p => Math.abs(v.dot(v.sub(p, cen), nrm)) < 1e-3 * Math.max(1, rm));
      if (plano && rs.every(x => Math.abs(x - rm) < 0.01 * rm)) {
        feicoes.push({ tipo: 'circulo', c: cen, eixo: nrm, r: rm, pontos: pts, fechada: true, p0: pts[0], lados: lados(c.vs[0], c.vs[1]) });
        continue;
      }
    }
    // quebra em trechos retos
    let vs = c.vs.slice();
    if (c.fechada) {
      vs.pop();
      const k = vs.findIndex((_, i) => { const a = P(vs[(i - 1 + vs.length) % vs.length]), b = P(vs[i]), d = P(vs[(i + 1) % vs.length]); return v.dot(v.norm(v.sub(b, a)), v.norm(v.sub(d, b))) < 0.9994; });
      if (k < 0) { feicoes.push({ tipo: 'outra', pontos: vs.map(P), fechada: true }); continue; }
      vs = [...vs.slice(k), ...vs.slice(0, k), vs[k]];
    }
    let ini = 0;
    for (let i = 1; i < vs.length; i++) {
      const fim = i === vs.length - 1;
      const vira = !fim && v.dot(v.norm(v.sub(P(vs[i]), P(vs[i - 1]))), v.norm(v.sub(P(vs[i + 1]), P(vs[i])))) < 0.9994;
      if (fim || vira) {
        // um trecho que vira devagar (curva) não é uma reta só: divide onde a corda se afasta da curva
        for (const [k0, k1] of trechosRetos(vs, ini, i, P)) {
          const a = P(vs[k0]), b = P(vs[k1]);
          if (v.dist(a, b) > 1e-4) feicoes.push({ tipo: 'reta', a, b, pontos: [a, b], lados: lados(vs[k0], vs[k0 + 1]) });
        }
        ini = i;
      }
    }
  }
  for (const f of feicoes) {
    if (f.lados?.length === 2) {
      const [l1, l2] = f.lados;
      f.convexa = v.dot(v.add(l1.u, l2.u), v.add(l1.n, l2.n)) < 0;
      f.angulo = Math.acos(Math.max(-1, Math.min(1, v.dot(l1.u, l2.u)))) * 180 / Math.PI;
    }
  }
  return feicoes;
}

// ---------- descrição estável e reencontro ----------
export function descritor(f) {
  if (f.tipo === 'reta') return { tipo: 'reta', a: r4(f.a), b: r4(f.b), n1: r4(f.lados[0].n), n2: r4(f.lados[1].n) };
  if (f.tipo === 'circulo') return { tipo: 'circulo', c: r4(f.c), eixo: r4(f.eixo), r: Math.round(f.r * 1e4) / 1e4 };
  return null;
}

export function casarArestas(feicoes, descritores) {
  const diag = (() => {
    const ps = feicoes.flatMap(f => f.pontos);
    if (!ps.length) return 1;
    const mn = [0, 1, 2].map(k => Math.min(...ps.map(p => p[k]))), mx = [0, 1, 2].map(k => Math.max(...ps.map(p => p[k])));
    return v.dist(mn, mx) || 1;
  })();
  const usados = new Set(), achados = [];
  let faltando = 0;
  for (const d of descritores) {
    let melhor = -1, nota = Infinity;
    feicoes.forEach((f, i) => {
      if (usados.has(i) || f.tipo !== d.tipo) return;
      if (d.tipo === 'reta') {
        const n1 = f.lados[0].n, n2 = f.lados[1].n;
        const mesmas = (v.dot(n1, d.n1) > 0.995 && v.dot(n2, d.n2) > 0.995) || (v.dot(n1, d.n2) > 0.995 && v.dot(n2, d.n1) > 0.995);
        const dir = Math.abs(v.dot(v.norm(v.sub(f.b, f.a)), v.norm(v.sub(d.b, d.a))));
        if (!mesmas || dir < 0.999) return;
        const s = v.dist(v.mul(v.add(f.a, f.b), 0.5), v.mul(v.add(d.a, d.b), 0.5)) + 0.25 * Math.abs(v.dist(f.a, f.b) - v.dist(d.a, d.b));
        if (s < nota) { nota = s; melhor = i; }
      } else {
        if (Math.abs(v.dot(f.eixo, d.eixo)) < 0.999) return;
        const s = v.dist(f.c, d.c) + Math.abs(f.r - d.r);
        if (s < nota) { nota = s; melhor = i; }
      }
    });
    if (melhor >= 0 && nota < 0.5 * diag) { usados.add(melhor); achados.push(melhor); } else faltando++;
  }
  return { indices: achados, faltando };
}

// ---------- perfil 2D da ferramenta ----------
// U1, U2: direções (2D, unitárias) ao longo de cada face, saindo da aresta (origem).
function perfil(U1, U2, modo, medida, segArco, nFixo = 0) {
  const cosA = Math.max(-1, Math.min(1, U1[0] * U2[0] + U1[1] * U2[1])), alfa = Math.acos(cosA);
  if (alfa < 1e-3 || alfa > Math.PI - 1e-3) throw new Error('faces quase paralelas nessa aresta');
  let bis = [U1[0] + U2[0], U1[1] + U2[1]]; const lb = Math.hypot(...bis); bis = [bis[0] / lb, bis[1] / lb];
  const O = [-bis[0] * EPS * 2, -bis[1] * EPS * 2];
  // margem para fora das faces: em superfícies facetadas (esferas, curvas) a face real fica um pouco
  // acima da reta do perfil em alguns trechos, e sobrava uma "casca" fina de material (triângulos soltos).
  // As pernas do perfil passam um pouco por fora das faces, no ar, para garantir o corte até a borda.
  const mg = Math.max(EPS * 2, medida * 0.3);
  const fora = U => { let N = [-U[1], U[0]]; if (N[0] * bis[0] + N[1] * bis[1] > 0) N = [-N[0], -N[1]]; return N; };
  const N1 = fora(U1), N2 = fora(U2);
  const P1f = (k) => [U1[0] * k + N1[0] * mg, U1[1] * k + N1[1] * mg], P2f = (k) => [U2[0] * k + N2[0] * mg, U2[1] * k + N2[1] * mg];
  if (modo === 'chanfro') return [O, P1f(medida * 0.98), [U1[0] * medida, U1[1] * medida], [U2[0] * medida, U2[1] * medida], P2f(medida * 0.98)];
  // ângulo muito fechado: o fillet "comeria" as faces (tangente enorme); limita o alcance a 3× o raio
  if (medida / Math.tan(alfa / 2) > 3 * medida) medida = 3 * medida * Math.tan(alfa / 2);
  const t = medida / Math.tan(alfa / 2), dc = medida / Math.sin(alfa / 2);
  const C = [bis[0] * dc, bis[1] * dc], T1 = [U1[0] * t, U1[1] * t], T2 = [U2[0] * t, U2[1] * t];
  let a1 = Math.atan2(T1[1] - C[1], T1[0] - C[0]), a2 = Math.atan2(T2[1] - C[1], T2[0] - C[0]);
  let da = a2 - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
  // passos de no máximo 7,5° no arco: com menos, cada emenda vira um "risco" visível (vinco > 20°)
  const n = nFixo || Math.max(4, Math.ceil(segArco * Math.abs(da) / (2 * Math.PI)), Math.ceil(Math.abs(da) / (7.5 * Math.PI / 180)));
  const arco = [];
  for (let k = 0; k <= n; k++) { const a = a1 + da * k / n; arco.push([C[0] + medida * Math.cos(a), C[1] + medida * Math.sin(a)]); }
  return [O, P1f(t * 0.98), ...arco, P2f(t * 0.98)];
}

// ---------- varredura contínua ao longo de uma cadeia de trechos retos ----------
// Uma curva livre vira muitos trechos curtos. Em vez de um prisma por trecho (que deixa "dentes"
// nas emendas), monta UM sólido varrendo o perfil do fillet/chanfro ao longo da cadeia inteira,
// com o perfil de cada vértice calculado pela média das faces dos dois trechos vizinhos.
const chP = p => p.map(x => Math.round(x * 1000)).join(',');
function agruparCadeias(retas) {
  const pontas = new Map();
  retas.forEach((f, i) => { for (const p of [f.a, f.b]) (pontas.get(chP(p)) ?? pontas.set(chP(p), []).get(chP(p))).push(i); });
  const usado = new Set(), cadeias = [], lim = Math.cos(40 * Math.PI / 180);
  const orientar = (f, inverter) => inverter ? { a: f.b, b: f.a, lados: f.lados, convexa: f.convexa } : { a: f.a, b: f.b, lados: f.lados, convexa: f.convexa };
  const seguir = (ponto, dir) => {
    let melhor = -1, nota = lim;
    for (const j of pontas.get(chP(ponto)) ?? []) {
      if (usado.has(j)) continue;
      const g = retas[j], sai = chP(g.a) === chP(ponto) ? v.norm(v.sub(g.b, g.a)) : v.norm(v.sub(g.a, g.b));
      const d = v.dot(dir, sai); if (d >= nota) { nota = d; melhor = j; }
    }
    return melhor;
  };
  for (let i = 0; i < retas.length; i++) {
    if (usado.has(i)) continue;
    usado.add(i);
    let cad = [orientar(retas[i], false)];
    for (let j; (j = seguir(cad.at(-1).b, v.norm(v.sub(cad.at(-1).b, cad.at(-1).a)))) >= 0;) { usado.add(j); cad.push(orientar(retas[j], chP(retas[j].a) !== chP(cad.at(-1).b))); }
    for (let j; (j = seguir(cad[0].a, v.norm(v.sub(cad[0].a, cad[0].b)))) >= 0;) { usado.add(j); cad.unshift(orientar(retas[j], chP(retas[j].b) !== chP(cad[0].a))); }
    const fechada = cad.length > 2 && chP(cad[0].a) === chP(cad.at(-1).b);
    cadeias.push({ trechos: cad, fechada });
  }
  return cadeias;
}
function varrerCadeia(wasm, { trechos, fechada }, modo, medida, segmentos, ext = [0, 0]) {
  // trechos longos são divididos em pedaços de no máximo ~1,2× a medida: assim a suavização junto às
  // curvas vizinhas só afeta as pontas da reta, e o meio dela fica com o perfil exato da reta
  {
    const passo = Math.max(1e-6, medida * 1.2), novos = [];
    for (const t of trechos) {
      const L = v.dist(t.a, t.b), n = Math.min(200, Math.max(1, Math.ceil(L / passo)));
      for (let i = 0; i < n; i++) novos.push({ ...t, a: v.add(t.a, v.mul(v.sub(t.b, t.a), i / n)), b: v.add(t.a, v.mul(v.sub(t.b, t.a), (i + 1) / n)) });
    }
    trechos = novos;
  }
  // alinha "face 1" e "face 2" ao longo da cadeia
  const L = [];
  let ant = trechos[0].lados;
  for (const t of trechos) {
    let [l1, l2] = t.lados;
    if (v.dot(l1.n, ant[0].n) < v.dot(l1.n, ant[1].n)) [l1, l2] = [l2, l1];
    L.push([l1, l2]); ant = [l1, l2];
  }
  const convexa = v.dot(v.add(L[0][0].u, L[0][1].u), v.add(L[0][0].n, L[0][1].n)) < 0;
  const n = trechos.length, nv = fechada ? n : n + 1, nArco = modo === 'chanfro' ? 0 : Math.max(12, Math.min(24, segmentos(medida) / 4));
  const dirs = trechos.map(t => v.norm(v.sub(t.b, t.a)));
  // dados de cada vértice da cadeia; as direções das faces são SUAVIZADAS ao longo da linha:
  // numa superfície facetada (esfera, cilindro) cada trecho vê faces um pouco diferentes, e sem
  // suavizar o perfil "treme" de um trecho para o outro, deixando dentes
  const VS = [], TG = [], U1 = [], U2 = [];
  for (let k = 0; k < nv; k++) {
    const iA = fechada ? (k - 1 + n) % n : Math.max(0, k - 1), iB = fechada ? k % n : Math.min(n - 1, k);
    VS.push(fechada || k < n ? trechos[iB].a : trechos[n - 1].b);
    TG.push(v.norm(v.add(dirs[iA], dirs[iB])));
    U1.push(v.add(L[iA][0].u, L[iB][0].u)); U2.push(v.add(L[iA][1].u, L[iB][1].u));
  }
  // Suavização ao longo da linha medida em MILÍMETROS (não em número de trechos): só entram vizinhos a
  // até ~2,5× a medida de distância ao longo da cadeia, com peso que cai com a distância. Contar por
  // trechos misturava uma reta longa com os trechos curtinhos de uma curva vizinha e entortava o
  // acabamento da reta inteira (aparecia um vinco ao longo dela).
  const S = [0];
  for (let k = 1; k < nv; k++) S.push(S[k - 1] + v.dist(VS[k - 1], VS[k]));
  const Ltot = fechada ? S[nv - 1] + v.dist(VS[nv - 1], VS[0]) : S[nv - 1];
  const W = Math.max(1e-6, medida * 2.5);
  const suavizar = arr => arr.map((_, k) => {
    let acc = v.mul(v.norm(arr[k]), 1);
    for (const sentido of [-1, 1]) for (let d = 1; d < nv; d++) {
      let j = k + sentido * d;
      if (fechada) j = ((j % nv) + nv) % nv; else if (j < 0 || j >= nv) break;
      let ds = Math.abs(S[j] - S[k]); if (fechada) ds = Math.min(ds, Ltot - ds);
      if (ds > W) break;
      acc = v.add(acc, v.mul(v.norm(arr[j]), 1 - ds / W));
    }
    return acc;
  });
  const U1s = suavizar(U1), U2s = suavizar(U2);
  // a direção da linha também é suavizada: numa curva feita de trechos em zigue-zague (interseção com
  // uma esfera facetada) a borda do chanfro acompanhava cada zigue-zague e ficava serrilhada
  const TGs = suavizar(TG).map(t => v.norm(t));
  const perfis = [];
  for (let k = 0; k < nv; k++) {
    const V = VS[k], tg = TGs[k];
    const proj = u => { const w = v.sub(u, v.mul(tg, v.dot(u, tg))); return v.norm(w); };
    const u1 = proj(U1s[k]), u2 = proj(U2s[k]);
    const e1 = u1, e2 = v.cross(tg, u1);
    const U2 = [v.dot(u2, e1), v.dot(u2, e2)], l = Math.hypot(...U2);
    const pts2 = perfil([1, 0], [U2[0] / l, U2[1] / l], modo, medida, 0, nArco);
    let base = V;
    if (!fechada && convexa && k === 0) base = v.sub(V, v.mul(tg, Math.max(EPS, ext[0])));
    if (!fechada && convexa && k === nv - 1) base = v.add(V, v.mul(tg, Math.max(EPS, ext[1])));
    perfis.push(pts2.map(([x, y]) => v.add(base, v.add(v.mul(e1, x), v.mul(e2, y)))));
  }
  const N = perfis[0].length, vert = [], tri = [];
  for (const p of perfis) for (const q of p) vert.push(...q);
  const id = (k, i) => k * N + i;
  const aneis = fechada ? nv : nv - 1;
  for (let k = 0; k < aneis; k++) {
    const k2 = (k + 1) % nv;
    for (let i = 0; i < N; i++) { const i2 = (i + 1) % N; tri.push(id(k, i), id(k, i2), id(k2, i2), id(k, i), id(k2, i2), id(k2, i)); }
  }
  if (!fechada) for (let i = 1; i < N - 1; i++) { tri.push(id(0, 0), id(0, i + 1), id(0, i)); tri.push(id(nv - 1, 0), id(nv - 1, i), id(nv - 1, i + 1)); }
  const montar = t => { const m = new wasm.Mesh({ numProp: 3, vertProperties: new Float32Array(vert), triVerts: new Uint32Array(t) }); m.merge(); return new wasm.Manifold(m); };
  let sol = montar(tri);
  if (sol.volume() < 0 || sol.isEmpty()) {
    sol.delete();
    const inv = []; for (let i = 0; i < tri.length; i += 3) inv.push(tri[i], tri[i + 2], tri[i + 1]);
    sol = montar(inv);
  }
  return { solido: sol, convexa };
}

// Sólidos de corte (convexas) e de enchimento (côncavas), no referencial da peça.
export function ferramentas(wasm, feicoes, modo, medida, segmentos, base = null) {
  const { Manifold, CrossSection } = wasm;
  // Ponta de uma aresta (ou cadeia) que termina num canto: se depois do canto não há mais material
  // (canto "de fora", como a ponta de uma estrela), a ferramenta é prolongada para o ar — assim o
  // acabamento vai até o fim e não deixa um triângulo de material na ponta. Se há material (canto de
  // dentro, como num bolso), não prolonga, para não comer a outra parede.
  // Lados "de verdade" das arestas: numa superfície curva (cilindro, esfera) a face vizinha da aresta é
  // um triângulo estreito, e o fillet ficava tangente só a ele — a superfície curva logo depois e sobrava
  // um degrau. Aqui a direção de cada lado é a média dos triângulos daquele lado até a distância que o
  // acabamento alcança (área ponderada), que é a superfície que o fillet/chanfro realmente vai tocar.
  if (base) {
    const g = base.getMesh(), np = g.numProp, P = i => [g.vertProperties[i * np], g.vertProperties[i * np + 1], g.vertProperties[i * np + 2]];
    const tris = [];
    for (let t = 0; t < g.triVerts.length / 3; t++) {
      const A = P(g.triVerts[t * 3]), B = P(g.triVerts[t * 3 + 1]), C = P(g.triVerts[t * 3 + 2]);
      const cr = v.cross(v.sub(B, A), v.sub(C, A)), ar = Math.hypot(...cr); if (ar < 1e-12) continue;
      tris.push({ c: v.mul(v.add(v.add(A, B), C), 1 / 3), n: v.mul(cr, 1 / ar), ar: ar / 2 });
    }
    const distSeg = (p, a, b) => { const ab = v.sub(b, a), t = Math.max(0, Math.min(1, v.dot(v.sub(p, a), ab) / (v.dot(ab, ab) || 1))); return v.dist(p, v.add(a, v.mul(ab, t))); };
    const alcance = f => {
      const [l1, l2] = f.lados, alfa = Math.acos(Math.max(-1, Math.min(1, v.dot(l1.u, l2.u))));
      return modo === 'chanfro' ? medida * 1.2 : Math.min(3 * medida, medida / Math.tan(Math.max(0.05, alfa) / 2)) * 1.1;
    };
    feicoes = feicoes.map(f => {
      if (f.tipo !== 'reta' || f.lados?.length !== 2) return f;
      const d = v.norm(v.sub(f.b, f.a)), R = alcance(f);
      const lados = f.lados.map(l => {
        let soma = [0, 0, 0], peso = 0;
        for (const t of tris) {
          if (v.dot(t.n, l.n) < Math.cos(15 * Math.PI / 180)) continue;           // só a mesma superfície (curvas suaves entram; faces vizinhas não)
          const rel = v.sub(t.c, f.a); if (v.dot(rel, l.u) < -1e-6) continue;     // do lado de cá da aresta
          const ab = v.sub(f.b, f.a), tt = v.dot(rel, ab) / (v.dot(ab, ab) || 1);
          if (tt < 0 || tt > 1) continue;                                          // só o que fica ao lado da aresta, não além das pontas
          if (distSeg(t.c, f.a, f.b) > R) continue;
          soma = v.add(soma, v.mul(t.n, t.ar)); peso += t.ar;
        }
        if (!peso) return l;
        const n = v.norm(soma); let u = v.norm(v.cross(n, d)); if (v.dot(u, l.u) < 0) u = v.mul(u, -1);
        return { ...l, n, u };
      });
      return { ...f, lados };
    });
  }
  const sonda = Manifold.cube([1, 1, 1], true);
  const prolongar = (V, saida, lados) => {
    if (!base) return 0;
    let bis = v.add(lados[0].u, lados[1].u); const lb = Math.hypot(...bis); if (lb < 1e-9) return 0; bis = v.mul(bis, 1 / lb);
    const P = v.add(V, v.add(v.mul(saida, medida * 0.6), v.mul(bis, medida * 0.3)));
    const t = sonda.scale(medida * 0.08).translate(P), x = t.intersect(base), dentro = x.volume() > 1e-12; t.delete(); x.delete();
    return dentro ? 0 : medida * 3;
  };
  const cortes = [], enchimentos = [], erros = [];
  // trechos retos encadeados viram uma varredura contínua; os soltos seguem pelo caminho antigo
  const retas = feicoes.filter(f => f.tipo === 'reta' && f.lados?.length === 2);
  const soltas = [];
  for (const c of agruparCadeias(retas)) {
    if (c.trechos.length < 2) { soltas.push(retas.find(f => f.a === c.trechos[0].a || f.a === c.trechos[0].b)); continue; }
    let ext = [0, 0];
    if (!c.fechada) {
      const t0 = c.trechos[0], t1 = c.trechos.at(-1);
      ext = [prolongar(t0.a, v.norm(v.sub(t0.a, t0.b)), t0.lados), prolongar(t1.b, v.norm(v.sub(t1.b, t1.a)), t1.lados)];
    }
    try { const { solido, convexa } = varrerCadeia(wasm, c, modo, medida, segmentos, ext); (convexa ? cortes : enchimentos).push(solido); }
    catch (e) { erros.push(e.message ?? String(e)); }
  }
  feicoes = [...soltas, ...feicoes.filter(f => f.tipo !== 'reta')];
  // Quinas entre arestas marcadas que se encontram em ângulo (ex.: a borda de um bolso quadrado):
  // cada ferramenta termina no próprio canto e sobrava um "dente" no meio. A peça do canto é a
  // intersecção das duas ferramentas prolongadas além do canto — como o encontro de duas réguas em 45°.
  const prisma = (f, origem, L) => {
    const [l1, l2] = f.lados, d = v.norm(v.sub(f.b, f.a)), e1 = l1.u, e2 = v.cross(d, e1);
    const p2 = u => [v.dot(u, e1), v.dot(u, e2)];
    const cs = new CrossSection([perfil(p2(l1.u), p2(l2.u), modo, medida, segmentos(medida))], 'NonZero');
    const sx = cs.extrude(L); cs.delete();
    const r = sx.transform([...e1, 0, ...e2, 0, ...d, 0, ...origem, 1]); sx.delete(); return r;
  };
  const retasSel = feicoes.filter(f => f.tipo === 'reta' && f.lados?.length === 2);
  for (let i = 0; i < retasSel.length; i++) for (let j = i + 1; j < retasSel.length; j++) {
    const f = retasSel[i], g = retasSel[j];
    if (f.convexa !== g.convexa) continue;
    const V = [f.a, f.b].find(p => chP(p) === chP(g.a) || chP(p) === chP(g.b)); if (!V) continue;
    const df = v.norm(v.sub(f.b, f.a)), dg = v.norm(v.sub(g.b, g.a));
    if (Math.abs(v.dot(df, dg)) > Math.cos(40 * Math.PI / 180)) continue; // quase alinhadas: já viram cadeia
    // ângulo entre as arestas no canto (saindo do canto): em cantos agudos a peça de canto vira uma
    // lasca comprida que corta onde não devia — nesses casos é melhor não pôr peça de canto
    const sf = chP(f.a) === chP(V) ? df : v.mul(df, -1), sg = chP(g.a) === chP(V) ? dg : v.mul(dg, -1);
    if (Math.acos(Math.max(-1, Math.min(1, v.dot(sf, sg)))) < 70 * Math.PI / 180) continue;
    try {
      const L = medida * 3;
      // prolongamento de cada uma para além do canto (no sentido de quem sai pelo canto)
      const ext = (h, dh) => chP(h.b) === chP(V) ? prisma(h, V, L) : prisma(h, v.sub(V, v.mul(dh, L)), L);
      const a1 = ext(f, df), b1 = ext(g, dg), c0 = a1.intersect(b1); a1.delete(); b1.delete();
      // a peça de canto fica só perto do canto (uma bola de 2× a medida)
      const bola = Manifold.sphere(medida * 2, 24).translate(V), canto = c0.intersect(bola); c0.delete(); bola.delete();
      if (canto.isEmpty()) canto.delete(); else (f.convexa ? cortes : enchimentos).push(canto);
    } catch (e) { erros.push(e.message ?? String(e)); }
  }
  for (const f of feicoes) {
    try {
      const [l1, l2] = f.lados;
      let solido;
      if (f.tipo === 'reta') {
        const d = v.norm(v.sub(f.b, f.a)), e1 = l1.u, e2 = v.cross(d, e1);
        const p2 = u => [v.dot(u, e1), v.dot(u, e2)];
        const cs = new CrossSection([perfil(p2(l1.u), p2(l2.u), modo, medida, segmentos(medida))], 'NonZero');
        const ea = f.convexa ? Math.max(EPS, prolongar(f.a, v.mul(d, -1), f.lados)) : 0, eb = f.convexa ? Math.max(EPS, prolongar(f.b, d, f.lados)) : 0;
        const L = v.dist(f.a, f.b) + ea + eb;
        const s = cs.extrude(L); cs.delete();
        const o = v.sub(f.a, v.mul(d, ea));
        solido = s.transform([...e1, 0, ...e2, 0, ...d, 0, ...o, 1]); s.delete();
      } else if (f.tipo === 'circulo') {
        const eixo = f.eixo;
        let b1 = v.sub(f.p0, f.c); b1 = v.norm(v.sub(b1, v.mul(eixo, v.dot(b1, eixo))));
        const b2 = v.cross(eixo, b1);
        const p2 = u => { const w = [v.dot(u, b1), v.dot(u, eixo)]; const l = Math.hypot(...w) || 1; return [w[0] / l, w[1] / l]; };
        const R = v.dot(v.sub(f.p0, f.c), b1), h = v.dot(v.sub(f.p0, f.c), eixo);
        const pts = perfil(p2(l1.u), p2(l2.u), modo, medida, segmentos(medida)).map(([x, y]) => [x + R, y + h]);
        if (pts.some(p => p[0] < -1e-6)) throw new Error('medida maior que o raio da borda');
        const cs = new CrossSection([pts.map(([x, y]) => [Math.max(0, x), y])], 'NonZero');
        const s = cs.revolve(f.pontos.length); cs.delete();
        solido = s.transform([...b1, 0, ...b2, 0, ...eixo, 0, ...f.c, 1]); s.delete();
      } else continue;
      (f.convexa ? cortes : enchimentos).push(solido);
    } catch (e) { erros.push(e.message ?? String(e)); }
  }
  sonda.delete();
  return { cortes, enchimentos, erros };
}

export function aplicarAcabamento(wasm, base, feicoes, modo, medida, segmentos) {
  const { Manifold } = wasm;
  const { cortes, enchimentos, erros } = ferramentas(wasm, feicoes, modo, medida, segmentos, base);
  let r = base.translate([0, 0, 0]);
  if (cortes.length) { const u = Manifold.union(cortes); const n = r.subtract(u); r.delete(); u.delete(); r = n; }
  if (enchimentos.length) { const u = Manifold.union(enchimentos); const n = r.add(u); r.delete(); u.delete(); r = n; }
  cortes.forEach(m => m.delete()); enchimentos.forEach(m => m.delete());
  // nas junções de muitos trechos podem sobrar lascas soltas minúsculas: descarta o que ficou separado e é desprezível
  const partes = r.decompose();
  if (partes.length > 1) {
    const vol = partes.map(p => p.volume()), maior = Math.max(...vol), base = Manifold.union([]);
    const ficam = partes.filter((p, k) => vol[k] > maior * 0.002);
    const n = Manifold.union(ficam); r.delete(); r = n; base.delete();
  }
  partes.forEach(p => p.delete());
  // limpeza final: junta vértices quase iguais e tira triângulos degenerados (agulhas de área zero que
  // as operações deixam e que apareciam como riscos compridos atravessando as faces)
  try { const lim = r.simplify(Math.max(1e-4, medida * 0.002)); if (!lim.isEmpty() && Math.abs(lim.volume() - r.volume()) < Math.abs(r.volume()) * 1e-4) { r.delete(); r = lim; } else lim.delete(); } catch {}
  return { solido: r, erros };
}
