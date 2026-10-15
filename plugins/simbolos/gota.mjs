// Gota: contorno 2D extrudado, com a largura e a espessura escolhidas.
export default {
  api: 1, id: 'gota', nome: 'Gota', categoria: 'Símbolos', icone: '💧', cor: '#4cc9f0', versao: '1.0.0',
  descricao: 'Gota (lágrima)',
  en: { nome: 'Drop', categoria: 'Symbols', descricao: 'Teardrop', rotulos: { largura: 'Width', espessura: 'Thickness' } },
  parametros: [
    { chave: 'largura', rotulo: 'Largura', padrao: 30, min: 0.1 },
    { chave: 'espessura', rotulo: 'Espessura', padrao: 5, min: 0.01 },
  ],
  gerar(p, { CrossSection }) {
    const s = (() => {
      const c = CrossSection.circle(1, 96), q = new CrossSection([[[-0.01, 2.3], [0.01, 2.3], [0, 2.32]]], 'NonZero');
      const r = CrossSection.hull([c, q]); c.delete(); q.delete(); return r;
    })();
    // ajusta à largura pedida e centraliza
    const b = s.bounds(), esc = p.largura / (b.max[0] - b.min[0]);
    const s1 = s.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]); s.delete();
    const s2 = s1.scale([esc, esc]); s1.delete();
    const m = s2.extrude(p.espessura); s2.delete();
    return m;
  },
};
