// Icosaedro: sólido platônico, com uma face apoiada na mesa.
export default {
  api: 1, id: 'icosaedro', nome: 'Icosaedro', categoria: 'Poliedros', icone: '⬢', cor: '#e63946', versao: '1.0.0', ordem: 5,
  descricao: '20 faces triangulares iguais (como o do Tinkercad)',
  en: { nome: 'Icosahedron', categoria: 'Polyhedra', descricao: '20 equal triangular faces (like in Tinkercad)', rotulos: { diametro: 'Diameter (around the corners)' } },
  parametros: [{ chave: 'diametro', rotulo: 'Diâmetro (pelos cantos)', padrao: 20, min: 0.1 }],
  gerar(p, { Manifold }) {
    const v = (() => { const f = (1 + Math.sqrt(5)) / 2, v = []; for (const a of [-1, 1]) for (const b of [-1, 1]) v.push([0, a, b * f], [a, b * f, 0], [a * f, 0, b]); return v; })();
    const r = Math.hypot(...v[0]), esc = p.diametro / 2 / r;
    let m = Manifold.hull(v.map(q => q.map(x => x * esc)));
    // gira até uma face ficar para baixo e apoia em z = 0
    const g = m.getMesh(), t = g.triVerts, P = i => [0, 1, 2].map(k => g.vertProperties[i * g.numProp + k]);
    const [a, b, c] = [P(t[0]), P(t[1]), P(t[2])];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const ln = Math.hypot(...n); n = n.map(x => x / ln);
    const az = -Math.atan2(n[1], n[0]) * 180 / Math.PI;
    const el = (Math.PI / 2 + Math.asin(Math.max(-1, Math.min(1, n[2])))) * 180 / Math.PI;
    const r1 = m.rotate([0, 0, az]); m.delete();
    const r2 = r1.rotate([0, -el, 0]); r1.delete();
    const bb = r2.boundingBox(), cx = (bb.min[0] + bb.max[0]) / 2, cy = (bb.min[1] + bb.max[1]) / 2;
    m = r2.translate([-cx, -cy, -bb.min[2]]); r2.delete();
    return m;
  },
};
