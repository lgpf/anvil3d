export default {
  api: 1, id: 'tubo', nome: 'Tubo', categoria: 'Básicos', icone: '◎', cor: '#59a96a',
  parametros: [
    { chave: 'diametroExterno', rotulo: 'Diâmetro externo', padrao: 20, min: 0.01 },
    { chave: 'diametroInterno', rotulo: 'Diâmetro interno', padrao: 14, min: 0 },
    { chave: 'altura', rotulo: 'Altura', padrao: 20, min: 0.01 },
  ],
  gerar(p, { Manifold, segmentos }) {
    const re = p.diametroExterno / 2, ri = p.diametroInterno / 2;
    if (ri >= re) throw new Error('o diâmetro interno precisa ser menor que o externo');
    const ext = Manifold.cylinder(p.altura, re, re, segmentos(re));
    if (ri <= 0) return ext;
    const int = Manifold.cylinder(p.altura + 2, ri, ri, segmentos(re)).translate([0, 0, -1]);
    const r = ext.subtract(int); ext.delete(); int.delete();
    return r;
  },
};
