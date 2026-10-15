// Meia esfera: a parte de cima de uma esfera, com a face plana na mesa.
export default {
  api: 1, id: 'meia-esfera', nome: 'Meia esfera', categoria: 'Básicos', icone: '◓', cor: '#e2438f', versao: '1.0.0',
  descricao: 'Metade de uma esfera, com a face plana apoiada na mesa',
  en: { nome: 'Half sphere', categoria: 'Basic', descricao: 'Half of a sphere, flat face on the bed',
    rotulos: { diametro: 'Diameter', altura: 'Height (0 = half the diameter)', lados: 'Sides (0 = automatic)' } },
  parametros: [
    { chave: 'diametro', rotulo: 'Diâmetro', padrao: 20, min: 0.1 },
    { chave: 'altura', rotulo: 'Altura (0 = metade do diâmetro)', padrao: 0, min: 0 },
    { chave: 'lados', rotulo: 'Lados (0 = automático)', padrao: 0, min: 0, inteiro: true },
  ],
  gerar(p, { Manifold, segmentos }) {
    const R = p.diametro / 2, e = Manifold.sphere(R, p.lados || segmentos(R)), m = e.trimByPlane([0, 0, 1], 0); e.delete();
    if (!(p.altura > 0)) return m;
    const s = m.scale([1, 1, p.altura / R]); m.delete(); return s;
  },
};
