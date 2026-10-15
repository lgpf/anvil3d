// Caixa oca (aberta em cima) com parede, fundo e cantos arredondados.
export default {
  api: 1, id: 'caixa-oca', nome: 'Caixa oca', categoria: 'Recipientes', icone: '⊔', cor: '#d4a373', versao: '1.0.0',
  descricao: 'Caixa aberta com parede e fundo, cantos arredondados',
  en: { nome: 'Open box', categoria: 'Containers', descricao: 'Open box with walls and bottom, rounded corners',
    rotulos: { largura: 'Width (X)', profundidade: 'Depth (Y)', altura: 'Height', parede: 'Wall', fundo: 'Bottom', raio: 'Corner radius' } },
  parametros: [
    { chave: 'largura', rotulo: 'Largura (X)', padrao: 60, min: 1 },
    { chave: 'profundidade', rotulo: 'Profundidade (Y)', padrao: 40, min: 1 },
    { chave: 'altura', rotulo: 'Altura', padrao: 30, min: 0.5 },
    { chave: 'parede', rotulo: 'Parede', padrao: 2, min: 0.2 },
    { chave: 'fundo', rotulo: 'Fundo', padrao: 2, min: 0.2 },
    { chave: 'raio', rotulo: 'Raio dos cantos', padrao: 4, min: 0 },
  ],
  gerar(p, { CrossSection, segmentos }) {
    const { largura: a, profundidade: b, altura: h, parede: e, fundo: f } = p;
    if (2 * e >= Math.min(a, b) || f >= h) throw new Error('parede ou fundo grossos demais para a caixa');
    const r = Math.min(p.raio, Math.min(a, b) / 2 - 0.01);
    const ret = (x, y, rr) => { if (rr <= 0.01) return CrossSection.square([x, y], true); const q = CrossSection.square([x - 2 * rr, y - 2 * rr], true), o = q.offset(rr, 'Round', 2, segmentos(rr)); q.delete(); return o; };
    const fora = ret(a, b, r), dentro = ret(a - 2 * e, b - 2 * e, Math.max(0, r - e));
    const m1 = fora.extrude(h), d0 = dentro.extrude(h), m2 = d0.translate([0, 0, f]); fora.delete(); dentro.delete(); d0.delete();
    const m = m1.subtract(m2); m1.delete(); m2.delete(); return m;
  },
};
