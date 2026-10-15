// Arruela lisa nas medidas métricas usuais (ou com medidas próprias).
const TAB = { M2: [2.2, 5, 0.3], 'M2.5': [2.7, 6, 0.5], M3: [3.2, 7, 0.5], M4: [4.3, 9, 0.8], M5: [5.3, 10, 1], M6: [6.4, 12, 1.6], M8: [8.4, 16, 1.6], M10: [10.5, 20, 2], M12: [13, 24, 2.5] };
export default {
  api: 1, id: 'arruela', nome: 'Arruela', categoria: 'Fixadores', icone: '◎', cor: '#b0b8bf', versao: '1.0.0',
  descricao: 'Arruela lisa nas medidas métricas',
  en: { nome: 'Washer', categoria: 'Fasteners', descricao: 'Flat washer in metric sizes',
    rotulos: { medida: 'Size', interno: 'Inner diameter (0 = standard)', externo: 'Outer diameter (0 = standard)', espessura: 'Thickness (0 = standard)' } },
  parametros: [
    { chave: 'medida', rotulo: 'Medida', tipo: 'opcao', opcoes: Object.keys(TAB).map(k => [k, k]), padrao: 'M4' },
    { chave: 'interno', rotulo: 'Diâmetro interno (0 = padrão)', padrao: 0, min: 0 },
    { chave: 'externo', rotulo: 'Diâmetro externo (0 = padrão)', padrao: 0, min: 0 },
    { chave: 'espessura', rotulo: 'Espessura (0 = padrão)', padrao: 0, min: 0 },
  ],
  gerar(p, { Manifold, segmentos }) {
    const t = TAB[p.medida] ?? TAB.M4, ri = (p.interno || t[0]) / 2, re = (p.externo || t[1]) / 2, h = p.espessura || t[2];
    if (ri >= re) throw new Error('o furo é maior que a arruela');
    const a = Manifold.cylinder(h, re, re, segmentos(re)), b = Manifold.cylinder(h + 2, ri, ri, segmentos(re)).translate([0, 0, -1]);
    const m = a.subtract(b); a.delete(); b.delete(); return m;
  },
};
