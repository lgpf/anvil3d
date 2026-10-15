// Rabo de andorinha: trilho trapezoidal. Para o encaixe fêmea, use a mesma peça como Furo, com folga.
export default {
  api: 1, id: 'rabo-andorinha', nome: 'Rabo de andorinha', categoria: 'Encaixes', icone: '⏢', cor: '#9c6644', versao: '1.0.0',
  descricao: 'Trilho trapezoidal para encaixe deslizante',
  en: { nome: 'Dovetail', categoria: 'Joints', descricao: 'Trapezoidal rail for a sliding joint',
    rotulos: { base: 'Narrow width (base)', topo: 'Wide width (top)', altura: 'Height', comprimento: 'Length', folga: 'Clearance (to use as a hole)' } },
  parametros: [
    { chave: 'base', rotulo: 'Largura estreita (base)', padrao: 8, min: 0.1 },
    { chave: 'topo', rotulo: 'Largura larga (topo)', padrao: 12, min: 0.1 },
    { chave: 'altura', rotulo: 'Altura', padrao: 5, min: 0.1 },
    { chave: 'comprimento', rotulo: 'Comprimento', padrao: 30, min: 0.1 },
    { chave: 'folga', rotulo: 'Folga (para usar como furo)', padrao: 0, min: 0, casas: 2 },
  ],
  gerar(p, { CrossSection }) {
    const f = p.folga, b = p.base / 2 + f, t = p.topo / 2 + f, h = p.altura + f;
    const s = new CrossSection([[[-b, 0], [b, 0], [t, h], [-t, h]]], 'NonZero');
    const e = s.extrude(p.comprimento); s.delete();
    const m = e.rotate([90, 0, 0]).translate([0, p.comprimento / 2, 0]); e.delete(); return m;
  },
};
