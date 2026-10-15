// Tampa para a Caixa oca de mesmas medidas: placa com uma borda que entra na caixa (com folga).
export default {
  api: 1, id: 'tampa', nome: 'Tampa', categoria: 'Recipientes', icone: '⊓', cor: '#a3b18a', versao: '1.0.0',
  descricao: 'Tampa de encaixe para a Caixa oca de mesmas medidas',
  en: { nome: 'Lid', categoria: 'Containers', descricao: 'Fitting lid for the Open box with the same sizes',
    rotulos: { largura: 'Box width (X)', profundidade: 'Box depth (Y)', parede: 'Box wall', espessura: 'Lid thickness', borda: 'Lip height', folga: 'Clearance', raio: 'Corner radius' } },
  parametros: [
    { chave: 'largura', rotulo: 'Largura da caixa (X)', padrao: 60, min: 1 },
    { chave: 'profundidade', rotulo: 'Profundidade da caixa (Y)', padrao: 40, min: 1 },
    { chave: 'parede', rotulo: 'Parede da caixa', padrao: 2, min: 0.2 },
    { chave: 'espessura', rotulo: 'Espessura da tampa', padrao: 2, min: 0.2 },
    { chave: 'borda', rotulo: 'Altura da borda', padrao: 4, min: 0 },
    { chave: 'folga', rotulo: 'Folga', padrao: 0.25, min: 0, casas: 2 },
    { chave: 'raio', rotulo: 'Raio dos cantos', padrao: 4, min: 0 },
  ],
  gerar(p, { Manifold, CrossSection, segmentos }) {
    const { largura: a, profundidade: b, parede: e, espessura: t, borda: h, folga: g } = p;
    const r = Math.min(p.raio, Math.min(a, b) / 2 - 0.01);
    const ret = (x, y, rr) => { if (rr <= 0.01) return CrossSection.square([x, y], true); const q = CrossSection.square([x - 2 * rr, y - 2 * rr], true), o = q.offset(rr, 'Round', 2, segmentos(rr)); q.delete(); return o; };
    const placa = ret(a, b, r), m1 = placa.extrude(t); placa.delete();
    if (!(h > 0)) return m1;
    if (4 * e + 2 * g >= Math.min(a, b)) throw new Error('a caixa é estreita demais para a borda da tampa');
    const ext = ret(a - 2 * e - 2 * g, b - 2 * e - 2 * g, Math.max(0, r - e - g)), int = ret(a - 4 * e - 2 * g, b - 4 * e - 2 * g, Math.max(0, r - 2 * e - g));
    const anel = ext.subtract(int); ext.delete(); int.delete();
    const a0 = anel.extrude(h), m2 = a0.translate([0, 0, t - 0.01]); anel.delete(); a0.delete();
    const m = Manifold.union([m1, m2]); m1.delete(); m2.delete(); return m;
  },
};
