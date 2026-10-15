// Seta: contorno 2D extrudado, com a largura e a espessura escolhidas.
export default {
  api: 1, id: 'seta', nome: 'Seta', categoria: 'Símbolos', icone: '➜', cor: '#4361ee', versao: '1.0.0',
  descricao: 'Seta para a direita (gire como quiser)',
  en: { nome: 'Arrow', categoria: 'Symbols', descricao: 'Right arrow (rotate as you like)', rotulos: { largura: 'Width', espessura: 'Thickness', haste: 'Shaft thickness (% of the head)' } },
  parametros: [
    { chave: 'largura', rotulo: 'Largura', padrao: 30, min: 0.1 },
    { chave: 'espessura', rotulo: 'Espessura', padrao: 5, min: 0.01 },
    { chave: 'haste', rotulo: 'Grossura da haste (% da ponta)', padrao: 40, min: 5, max: 95 },
  ],
  gerar(p, { CrossSection }) {
    const s = (() => {
      const h = p.haste / 100;
      return new CrossSection([[[0, -h / 2], [0.6, -h / 2], [0.6, -0.5], [1, 0], [0.6, 0.5], [0.6, h / 2], [0, h / 2]]], 'NonZero');
    })();
    // ajusta à largura pedida e centraliza
    const b = s.bounds(), esc = p.largura / (b.max[0] - b.min[0]);
    const s1 = s.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]); s.delete();
    const s2 = s1.scale([esc, esc]); s1.delete();
    const m = s2.extrude(p.espessura); s2.delete();
    return m;
  },
};
