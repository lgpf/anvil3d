export default {
  api: 1, id: 'esfera', nome: 'Esfera', categoria: 'Básicos', icone: '◉', cor: '#3a86c8',
  parametros: [
    { chave: 'diametro', rotulo: 'Diâmetro', padrao: 20, min: 0.01 },
    { chave: 'segmentos', rotulo: 'Segmentos (0 = automático)', padrao: 0, min: 0, inteiro: true },
  ],
  gerar(p, { Manifold, segmentos }) {
    const r = p.diametro / 2;
    return Manifold.sphere(r, p.segmentos >= 4 ? p.segmentos : segmentos(r)).translate([0, 0, r]);
  },
};
