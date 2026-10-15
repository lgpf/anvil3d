// Triacontaedro rômbico: poliedro convexo, com uma face apoiada na mesa. Faces: 30.
export default {
  api: 1, id: 'triacontaedro-rombico', nome: 'Triacontaedro rômbico', categoria: 'Poliedros', icone: '◈', cor: '#9a8c98', versao: '1.0.0', ordem: 19,
  descricao: '30 losangos (o dado de 30 lados)',
  en: { nome: 'Rhombic triacontahedron', categoria: 'Polyhedra', descricao: '30 rhombi (the 30-sided die)', rotulos: { diametro: 'Diameter (around the corners)' } },
  parametros: [{ chave: 'diametro', rotulo: 'Diâmetro (pelos cantos)', padrao: 20, min: 0.1 }],
  gerar(p, { Manifold }) {
    const f = (1 + Math.sqrt(5)) / 2, s2 = Math.sqrt(2);
    const sinais = v => { let r = [[]]; for (const x of v) r = r.flatMap(a => x === 0 ? [[...a, 0]] : [[...a, x], [...a, -x]]); return r; };
    const ciclicas = v => [[v[0], v[1], v[2]], [v[1], v[2], v[0]], [v[2], v[0], v[1]]];
    const todas = v => [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map(i => i.map(k => v[k]));
    const unicos = l => { const m = new Map(); for (const p of l) m.set(p.map(x => x.toFixed(6)).join(','), p); return [...m.values()]; };
    const C = (...vs) => unicos(vs.flatMap(v => sinais(v).flatMap(ciclicas)));   // permutações cíclicas com todos os sinais
    const T = (...vs) => unicos(vs.flatMap(v => sinais(v).flatMap(todas)));      // todas as permutações com todos os sinais
    // dual do icosidodecaedro: cada face dele vira um vértice (normal / distância)
    const v = (() => {
      const base = Manifold.hull(C([0, 0, f], [0.5, f / 2, f * f / 2])), g0 = base.getMesh(), Q = i => [0, 1, 2].map(k => g0.vertProperties[i * g0.numProp + k]), faces = [];
      for (let t = 0; t < g0.triVerts.length / 3; t++) {
        const [a, b, c] = [0, 1, 2].map(k => Q(g0.triVerts[t * 3 + k]));
        const u = b.map((x, i) => x - a[i]), w = c.map((x, i) => x - a[i]);
        let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const l = Math.hypot(...n); n = n.map(x => x / l);
        const d = n[0] * a[0] + n[1] * a[1] + n[2] * a[2];
        const nd = n.map(x => x / d); if (!faces.some(q => Math.hypot(q[0] - nd[0], q[1] - nd[1], q[2] - nd[2]) < 0.01)) faces.push(nd);
      }
      base.delete(); return faces;
    })();
    const r = Math.max(...v.map(q => Math.hypot(...q))), esc = p.diametro / 2 / r;
    let m = Manifold.hull(v.map(q => q.map(x => x * esc)));
    // gira até uma face ficar para baixo e apoia em z = 0
    const g = m.getMesh(), t = g.triVerts, P = i => [0, 1, 2].map(k => g.vertProperties[i * g.numProp + k]);
    const [a, b, c] = [P(t[0]), P(t[1]), P(t[2])];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const ln = Math.hypot(...n); n = n.map(x => x / ln);
    const az = -Math.atan2(n[1], n[0]) * 180 / Math.PI, el = (Math.PI / 2 + Math.asin(Math.max(-1, Math.min(1, n[2])))) * 180 / Math.PI;
    const r1 = m.rotate([0, 0, az]); m.delete();
    const r2 = r1.rotate([0, -el, 0]); r1.delete();
    const bb = r2.boundingBox();
    m = r2.translate([-(bb.min[0] + bb.max[0]) / 2, -(bb.min[1] + bb.max[1]) / 2, -bb.min[2]]); r2.delete();
    return m;
  },
};
