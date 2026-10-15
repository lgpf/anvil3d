// Coração: contorno 2D extrudado, com a largura e a espessura escolhidas.
export default {
  api: 1, id: 'coracao', nome: 'Coração', categoria: 'Símbolos', icone: '♥', cor: '#e5383b', versao: '1.0.0',
  descricao: 'Coração clássico',
  en: { nome: 'Heart', categoria: 'Symbols', descricao: 'Classic heart', rotulos: { largura: 'Width', espessura: 'Thickness' } },
  parametros: [
    { chave: 'largura', rotulo: 'Largura', padrao: 30, min: 0.1 },
    { chave: 'espessura', rotulo: 'Espessura', padrao: 5, min: 0.01 },
  ],
  gerar(p, { CrossSection }) {
    const s = (() => {
      const pts = []; for (let i = 0; i < 120; i++) { const t = 2 * Math.PI * i / 120;
        pts.push([16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)]); }
      return new CrossSection([pts], 'NonZero');
    })();
    // ajusta à largura pedida e centraliza
    const b = s.bounds(), esc = p.largura / (b.max[0] - b.min[0]);
    const s1 = s.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2]); s.delete();
    const s2 = s1.scale([esc, esc]); s1.delete();
    const m = s2.extrude(p.espessura); s2.delete();
    return m;
  },
};
