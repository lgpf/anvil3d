// Antiprisma: dois polígonos de N lados girados meio passo, unidos por triângulos.
export default {
  api: 1, id: 'antiprisma', nome: 'Antiprisma', categoria: 'Poliedros', icone: '⬣', cor: '#577590', versao: '1.0.0', ordem: 23,
  descricao: 'Duas bases de N lados giradas entre si, laterais em triângulos',
  en: { nome: 'Antiprism', categoria: 'Polyhedra', descricao: 'Two N-sided bases rotated against each other, triangular sides',
    rotulos: { lados: 'Sides', diametro: 'Diameter', altura: 'Height (0 = equal triangles)' } },
  parametros: [
    { chave: 'lados', rotulo: 'Lados', padrao: 6, min: 3, max: 60, inteiro: true },
    { chave: 'diametro', rotulo: 'Diâmetro', padrao: 20, min: 0.1 },
    { chave: 'altura', rotulo: 'Altura (0 = triângulos iguais)', padrao: 0, min: 0 },
  ],
  gerar(p, { Manifold }) {
    const n = Math.round(p.lados), R = p.diametro / 2;
    // altura com triângulos equiláteros: h = R·sqrt(2·(cos(π/n) − cos(2π/n)))
    const h = p.altura > 0 ? p.altura : R * Math.sqrt(2 * (Math.cos(Math.PI / n) - Math.cos(2 * Math.PI / n)));
    const pts = [];
    for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; pts.push([R * Math.cos(a), R * Math.sin(a), 0], [R * Math.cos(a + Math.PI / n), R * Math.sin(a + Math.PI / n), h]); }
    return Manifold.hull(pts);
  },
};
