// Esfera geodésica: icosaedro com as faces subdivididas e projetadas na esfera (como cúpulas geodésicas).
export default {
  api: 1, id: 'esfera-geodesica', nome: 'Esfera geodésica', categoria: 'Poliedros', icone: '◍', cor: '#52b788', versao: '1.0.0', ordem: 21,
  descricao: 'Icosaedro subdividido e projetado na esfera, com faces visíveis',
  en: { nome: 'Geodesic sphere', categoria: 'Polyhedra', descricao: 'Subdivided icosahedron projected onto a sphere, with visible faces',
    rotulos: { diametro: 'Diameter', frequencia: 'Frequency (subdivisions)', cupula: 'Dome only (half)' } },
  parametros: [
    { chave: 'diametro', rotulo: 'Diâmetro', padrao: 30, min: 0.1 },
    { chave: 'frequencia', rotulo: 'Frequência (subdivisões)', padrao: 3, min: 1, max: 10, inteiro: true },
    { chave: 'cupula', rotulo: 'Só a cúpula (metade)', tipo: 'booleano', padrao: false },
  ],
  gerar(p, { Manifold }) {
    const f = (1 + Math.sqrt(5)) / 2, R = p.diametro / 2, n = Math.round(p.frequencia);
    const V = []; for (const a of [-1, 1]) for (const b of [-1, 1]) V.push([0, a, b * f], [a, b * f, 0], [a * f, 0, b]);
    const ico = Manifold.hull(V), g = ico.getMesh(); ico.delete();
    const P = i => [0, 1, 2].map(k => g.vertProperties[i * g.numProp + k]), pts = [];
    for (let t = 0; t < g.triVerts.length / 3; t++) {
      const [A, B, C] = [0, 1, 2].map(k => P(g.triVerts[t * 3 + k]));
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        const q = [0, 1, 2].map(k => (A[k] * (n - i - j) + B[k] * i + C[k] * j) / n), l = Math.hypot(...q);
        pts.push(q.map(x => x / l * R));
      }
    }
    let m = Manifold.hull(pts);
    if (p.cupula) { const c = m.trimByPlane([0, 0, 1], 0); m.delete(); return c; }
    const z = m.boundingBox().min[2], r = m.translate([0, 0, -z]); m.delete(); return r;
  },
};
