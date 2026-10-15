// Pote/copo: cilíndrico ou cônico (boca mais larga), com parede e fundo.
export default {
  api: 1, id: 'pote', nome: 'Pote', categoria: 'Recipientes', icone: '◡', cor: '#e9c46a', versao: '1.0.0',
  descricao: 'Pote ou copo cilíndrico (ou cônico) com parede e fundo',
  en: { nome: 'Cup', categoria: 'Containers', descricao: 'Cylindrical (or tapered) cup with wall and bottom',
    rotulos: { diametro: 'Bottom diameter', boca: 'Top diameter (0 = same)', altura: 'Height', parede: 'Wall', fundo: 'Bottom' } },
  parametros: [
    { chave: 'diametro', rotulo: 'Diâmetro do fundo', padrao: 40, min: 1 },
    { chave: 'boca', rotulo: 'Diâmetro da boca (0 = igual)', padrao: 0, min: 0 },
    { chave: 'altura', rotulo: 'Altura', padrao: 50, min: 0.5 },
    { chave: 'parede', rotulo: 'Parede', padrao: 2, min: 0.2 },
    { chave: 'fundo', rotulo: 'Fundo', padrao: 2, min: 0.2 },
  ],
  gerar(p, { Manifold, segmentos }) {
    const r1 = p.diametro / 2, r2 = (p.boca || p.diametro) / 2, h = p.altura, e = p.parede, f = p.fundo;
    if (e >= Math.min(r1, r2) || f >= h) throw new Error('parede ou fundo grossos demais');
    const n = segmentos(Math.max(r1, r2)), k = (r2 - r1) / h;
    const fora = Manifold.cylinder(h, r1, r2, n);
    const d0 = Manifold.cylinder(h - f + 0.01, r1 + k * f - e, r2 - e, n), dentro = d0.translate([0, 0, f]); d0.delete();
    const m = fora.subtract(dentro); fora.delete(); dentro.delete(); return m;
  },
};
