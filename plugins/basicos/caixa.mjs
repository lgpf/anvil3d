// Caixa com cantos arredondados opcionais (exatos, feitos por envoltória de cilindros/esferas).
export default {
  api: 1, id: 'caixa', nome: 'Caixa', categoria: 'Básicos', icone: '■', cor: '#e4572e', versao: '1.1.0',
  parametros: [
    { chave: 'largura', rotulo: 'Largura (X)', padrao: 20, min: 0.01 },
    { chave: 'profundidade', rotulo: 'Profundidade (Y)', padrao: 20, min: 0.01 },
    { chave: 'altura', rotulo: 'Altura (Z)', padrao: 20, min: 0.01 },
    { chave: 'arredondar', rotulo: 'Arredondar', tipo: 'opcao', padrao: 'verticais',
      opcoes: [['verticais', 'Arestas verticais'], ['topo', 'Verticais e topo'], ['todas', 'Todas as arestas']] },
    { chave: 'raio', rotulo: 'Raio', padrao: 0, min: 0 },
  ],
  gerar(p, { Manifold, segmentos }) {
    const { largura: w, profundidade: d, altura: h } = p;
    const modo = p.arredondar ?? 'verticais';
    const lim = modo === 'verticais' ? Math.min(w, d) / 2 : Math.min(w, d, modo === 'topo' ? 2 * h : h) / 2;
    const r = Math.min(p.raio, lim - 0.001);
    if (!(r > 0)) return Manifold.cube([w, d, h], true).translate([0, 0, h / 2]);
    const pecas = [], s = segmentos(r);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const x = sx * (w / 2 - r), y = sy * (d / 2 - r);
      if (modo === 'verticais') pecas.push(Manifold.cylinder(h, r, r, s).translate([x, y, 0]));
      if (modo === 'topo') {
        pecas.push(Manifold.cylinder(h - r, r, r, s).translate([x, y, 0]));
        pecas.push(Manifold.sphere(r, s).translate([x, y, h - r]));
      }
      if (modo === 'todas') for (const z of [r, h - r]) pecas.push(Manifold.sphere(r, s).translate([x, y, z]));
    }
    const res = Manifold.hull(pecas);
    pecas.forEach(c => c.delete());
    return res;
  },
};
