// Paraboloide: cúpula de perfil parabólico (como a do Tinkercad).
export default {
  api: 1, id: 'paraboloide', nome: 'Paraboloide', categoria: 'Básicos', icone: '⌒', cor: '#9b8fd6', versao: '1.0.0',
  descricao: 'Cúpula de perfil parabólico, base redonda apoiada na mesa',
  en: { nome: 'Paraboloid', categoria: 'Basic', descricao: 'Parabolic dome with a round base on the bed',
    rotulos: { diametro: 'Base diameter', altura: 'Height', invertido: 'Upside down (bowl)', lados: 'Sides (0 = automatic)' } },
  parametros: [
    { chave: 'diametro', rotulo: 'Diâmetro da base', padrao: 20, min: 0.1 },
    { chave: 'altura', rotulo: 'Altura', padrao: 20, min: 0.1 },
    { chave: 'invertido', rotulo: 'De ponta-cabeça (tigela)', tipo: 'booleano', padrao: false },
    { chave: 'lados', rotulo: 'Lados (0 = automático)', padrao: 0, min: 0, inteiro: true },
  ],
  gerar(p, { CrossSection, segmentos }) {
    const R = p.diametro / 2, H = p.altura, n = 48;
    // perfil: z = H·(1 − (r/R)²), de r = 0 até R
    const perfil = [[0, 0]];
    for (let i = n; i >= 0; i--) { const r = R * i / n; perfil.push([r, H * (1 - (r / R) ** 2)]); }
    perfil[1] = [R, 0];
    const s = new CrossSection([perfil], 'NonZero');
    let m = s.revolve(p.lados || segmentos(R)); s.delete();
    if (p.invertido) { const v = m.mirror([0, 0, 1]).translate([0, 0, H]); m.delete(); m = v; }
    return m;
  },
};
