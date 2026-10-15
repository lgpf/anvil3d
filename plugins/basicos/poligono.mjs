// Polígono regular de N lados, extrudado (prisma). Medida pelo diâmetro externo (dos cantos) ou pela distância entre lados.
export default {
  api: 1, id: 'poligono', nome: 'Polígono', categoria: 'Básicos', icone: '⬢', cor: '#5b8def', versao: '1.1.0',
  descricao: 'Prisma de base poligonal regular (triângulo, hexágono, octógono…)',
  en: {
    nome: 'Polygon', categoria: 'Basic', descricao: 'Prism with a regular polygon base (triangle, hexagon, octagon…)',
    rotulos: { lados: 'Sides', medida: 'Size (mm)', referencia: 'Size measured', altura: 'Height', giro: 'Rotation (°)', torcao: 'Twist (°)' },
    opcoes: { cantos: 'Across corners', lados: 'Across flats' },
  },
  parametros: [
    { chave: 'lados', rotulo: 'Lados', padrao: 6, min: 3, max: 200, inteiro: true },
    { chave: 'medida', rotulo: 'Medida (mm)', padrao: 20, min: 0.1 },
    { chave: 'referencia', rotulo: 'Medida entre', tipo: 'opcao', opcoes: [['cantos', 'Cantos (diâmetro externo)'], ['lados', 'Lados opostos (chave)']], padrao: 'cantos' },
    { chave: 'altura', rotulo: 'Altura', padrao: 10, min: 0.01 },
    { chave: 'giro', rotulo: 'Giro (°)', padrao: 0, casas: 1 },
    { chave: 'torcao', rotulo: 'Torção (°)', padrao: 0, min: -3600, max: 3600, casas: 1 },
  ],
  gerar(p, { CrossSection, segmentos }) {
    const n = Math.round(p.lados);
    if (n < 3) throw new Error('são precisos pelo menos 3 lados');
    const R = p.referencia === 'lados' ? (p.medida / 2) / Math.cos(Math.PI / n) : p.medida / 2;
    // um lado fica embaixo, reto (como uma porca vista de cima)
    const a0 = -Math.PI / 2 + Math.PI / n + p.giro * Math.PI / 180;
    const pts = Array.from({ length: n }, (_, i) => [R * Math.cos(a0 + 2 * Math.PI * i / n), R * Math.sin(a0 + 2 * Math.PI * i / n)]);
    // torção: o topo gira em relação à base, em fatias suficientes para ficar liso
    const tw = p.torcao || 0, div = tw ? Math.min(600, Math.ceil(segmentos(R) * Math.abs(tw) / 360)) : 0;
    const s = new CrossSection([pts], 'NonZero'), m = s.extrude(p.altura, div, tw); s.delete();
    return m;
  },
};
