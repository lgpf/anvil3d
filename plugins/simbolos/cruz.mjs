// Cruz: contorno 2D extrudado, com a largura e a espessura escolhidas.
export default {
  api: 1, id: 'cruz', nome: 'Cruz', categoria: 'Símbolos', icone: '✚', cor: '#2a9d8f', versao: '1.0.0',
  descricao: 'Sinal de mais (cruz)',
  en: { nome: 'Plus sign', categoria: 'Symbols', descricao: 'Plus sign (cross)', rotulos: { largura: 'Width', espessura: 'Thickness', braco: 'Arm thickness (% of width)' } },
  parametros: [
    { chave: 'largura', rotulo: 'Largura', padrao: 30, min: 0.1 },
    { chave: 'espessura', rotulo: 'Espessura', padrao: 5, min: 0.01 },
    { chave: 'braco', rotulo: 'Grossura do braço (% da largura)', padrao: 33, min: 5, max: 95 },
  ],
  gerar(p, { CrossSection }) {
    const s = (() => {
      const b = p.braco / 200;
      return new CrossSection([[[-b, -0.5], [b, -0.5], [b, -b], [0.5, -b], [0.5, b], [b, b], [b, 0.5], [-b, 0.5], [-b, b], [-0.5, b], [-0.5, -b], [-b, -b]]], 'NonZero');
    })();
    // ajusta à largura pedida e centraliza
    const b = s.bounds(), esc = p.largura / (b.max[0] - b.min[0]);
    const s1 = s.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]); s.delete();
    const s2 = s1.scale([esc, esc]); s1.delete();
    const m = s2.extrude(p.espessura); s2.delete();
    return m;
  },
};
