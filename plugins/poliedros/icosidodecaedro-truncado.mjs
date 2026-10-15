// Icosidodecaedro truncado: poliedro convexo, com uma face apoiada na mesa. Faces: 62.
export default {
  api: 1, id: 'icosidodecaedro-truncado', nome: 'Icosidodecaedro truncado', categoria: 'Poliedros', icone: '✹', cor: '#a8dadc', versao: '1.0.0', ordem: 17,
  descricao: '30 quadrados, 20 hexágonos e 12 decágonos',
  en: { nome: 'Truncated icosidodecahedron', categoria: 'Polyhedra', descricao: '30 squares, 20 hexagons and 12 decagons', rotulos: { diametro: 'Diameter (around the corners)' } },
  parametros: [{ chave: 'diametro', rotulo: 'Diâmetro (pelos cantos)', padrao: 20, min: 0.1 }],
  gerar(p, { Manifold }) {
    const f = (1 + Math.sqrt(5)) / 2, s2 = Math.sqrt(2);
    const sinais = v => { let r = [[]]; for (const x of v) r = r.flatMap(a => x === 0 ? [[...a, 0]] : [[...a, x], [...a, -x]]); return r; };
    const ciclicas = v => [[v[0], v[1], v[2]], [v[1], v[2], v[0]], [v[2], v[0], v[1]]];
    const todas = v => [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map(i => i.map(k => v[k]));
    const unicos = l => { const m = new Map(); for (const p of l) m.set(p.map(x => x.toFixed(6)).join(','), p); return [...m.values()]; };
    const C = (...vs) => unicos(vs.flatMap(v => sinais(v).flatMap(ciclicas)));   // permutações cíclicas com todos os sinais
    const T = (...vs) => unicos(vs.flatMap(v => sinais(v).flatMap(todas)));      // todas as permutações com todos os sinais
    const v = C([1 / f, 1 / f, 3 + f], [2 / f, f, 1 + 2 * f], [1 / f, f * f, -1 + 3 * f], [2 * f - 1, 2, 2 + f], [f, 3, 2 * f]);
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
