// Estrela octângula (stella octangula): dois tetraedros cruzados, um dentro do outro.
export default {
  api: 1, id: 'estrela-octangula', nome: 'Estrela octângula', categoria: 'Poliedros', icone: '✡', cor: '#ffb703', versao: '1.0.0', ordem: 20,
  descricao: 'Dois tetraedros entrelaçados (stella octangula de Kepler)',
  en: { nome: 'Stella octangula', categoria: 'Polyhedra', descricao: 'Two interlocked tetrahedra (Kepler\u2019s stella octangula)', rotulos: { diametro: 'Diameter (around the tips)' } },
  parametros: [{ chave: 'diametro', rotulo: 'Diâmetro (pelas pontas)', padrao: 30, min: 0.1 }],
  gerar(p, { Manifold }) {
    const e = p.diametro / 2 / Math.sqrt(3);
    const t1 = Manifold.hull([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(v => v.map(x => x * e)));
    const t2 = Manifold.hull([[-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]].map(v => v.map(x => x * e)));
    const u = Manifold.union([t1, t2]); t1.delete(); t2.delete();
    // apoiada em 4 pontas (as que ficam numa face do cubo envolvente): fica firme na mesa
    const r2 = u;
    const z = r2.boundingBox().min[2], m = r2.translate([0, 0, -z]); r2.delete(); return m;
  },
};
