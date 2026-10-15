export default {
  api: 1, id: 'toroide', nome: 'Toroide', categoria: 'Básicos', icone: '⭘', cor: '#d1495b',
  parametros: [
    { chave: 'diametro', rotulo: 'Diâmetro externo', padrao: 30, min: 0.01 },
    { chave: 'espessura', rotulo: 'Espessura do anel', padrao: 6, min: 0.01 },
  ],
  gerar(p, { CrossSection, segmentos }) {
    const ra = p.espessura / 2, rc = p.diametro / 2 - ra;
    if (rc <= 0) throw new Error('espessura grande demais para o diâmetro');
    const c = CrossSection.circle(ra, segmentos(ra)).translate([rc, ra]);
    const r = c.revolve(segmentos(p.diametro / 2)); c.delete();
    return r;
  },
};
