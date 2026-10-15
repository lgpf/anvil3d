export default {
  api: 1, id: 'cone', nome: 'Cone', categoria: 'Básicos', icone: '▲', cor: '#8e6cb8',
  parametros: [
    { chave: 'diametroBase', rotulo: 'Diâmetro da base', padrao: 20, min: 0 },
    { chave: 'diametroTopo', rotulo: 'Diâmetro do topo', padrao: 0, min: 0 },
    { chave: 'altura', rotulo: 'Altura', padrao: 20, min: 0.01 },
    { chave: 'lados', rotulo: 'Lados (0 = automático)', padrao: 0, min: 0, inteiro: true },
  ],
  gerar(p, { Manifold, segmentos }) {
    const r1 = p.diametroBase / 2, r2 = p.diametroTopo / 2;
    if (r1 <= 0 && r2 <= 0) throw new Error('os dois diâmetros são zero');
    return Manifold.cylinder(p.altura, r1, r2, p.lados >= 3 ? p.lados : segmentos(Math.max(r1, r2)));
  },
};
