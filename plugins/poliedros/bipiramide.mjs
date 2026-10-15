// Bipirâmide: duas pirâmides de base com N lados unidas pela base (N = 4 é o octaedro).
export default {
  api: 1, id: 'bipiramide', nome: 'Bipirâmide', categoria: 'Poliedros', icone: '⧫', cor: '#b5838d', versao: '1.0.0', ordem: 22,
  descricao: 'Duas pirâmides unidas pela base, de N lados (como um cristal)',
  en: { nome: 'Bipyramid', categoria: 'Polyhedra', descricao: 'Two pyramids joined at the base, N sides (like a crystal)',
    rotulos: { lados: 'Sides', diametro: 'Diameter', altura: 'Total height', deitada: 'Lying on a face' } },
  parametros: [
    { chave: 'lados', rotulo: 'Lados', padrao: 6, min: 3, max: 60, inteiro: true },
    { chave: 'diametro', rotulo: 'Diâmetro', padrao: 20, min: 0.1 },
    { chave: 'altura', rotulo: 'Altura total', padrao: 30, min: 0.1 },
  ],
  gerar(p, { Manifold }) {
    const n = Math.round(p.lados), R = p.diametro / 2, h = p.altura;
    const pts = [[0, 0, 0], [0, 0, h]];
    for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; pts.push([R * Math.cos(a), R * Math.sin(a), h / 2]); }
    return Manifold.hull(pts);
  },
};
