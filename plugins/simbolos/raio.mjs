// Raio: contorno 2D extrudado, com a largura e a espessura escolhidas.
export default {
  api: 1, id: 'raio', nome: 'Raio', categoria: 'Símbolos', icone: '⚡', cor: '#ffb703', versao: '1.0.0',
  descricao: 'Raio em zigue-zague',
  en: { nome: 'Lightning', categoria: 'Symbols', descricao: 'Zigzag lightning bolt', rotulos: { largura: 'Width', espessura: 'Thickness' } },
  parametros: [
    { chave: 'largura', rotulo: 'Largura', padrao: 30, min: 0.1 },
    { chave: 'espessura', rotulo: 'Espessura', padrao: 5, min: 0.01 },
  ],
  gerar(p, { CrossSection }) {
    const s = (() => {
      return new CrossSection([[[0.42, 1], [0.05, 0.42], [0.38, 0.42], [0.18, 0], [0.75, 0.58], [0.43, 0.58], [0.75, 1]]], 'NonZero');
    })();
    // ajusta à largura pedida e centraliza
    const b = s.bounds(), esc = p.largura / (b.max[0] - b.min[0]);
    const s1 = s.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]); s.delete();
    const s2 = s1.scale([esc, esc]); s1.delete();
    const m = s2.extrude(p.espessura); s2.delete();
    return m;
  },
};
