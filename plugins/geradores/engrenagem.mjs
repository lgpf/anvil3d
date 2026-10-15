// Exemplo de gerador paramétrico: engrenagem reta simplificada (dente trapezoidal).
export default {
  api: 1, id: 'engrenagem', nome: 'Engrenagem simples', categoria: 'Mecânica', icone: '⚙', cor: '#7d8b96',
  parametros: [
    { chave: 'dentes', rotulo: 'Número de dentes', padrao: 20, min: 6, inteiro: true },
    { chave: 'modulo', rotulo: 'Módulo', padrao: 1.5, min: 0.2, passo: 0.1 },
    { chave: 'espessura', rotulo: 'Espessura', padrao: 6, min: 0.1 },
    { chave: 'furo', rotulo: 'Diâmetro do furo central', padrao: 5, min: 0 },
  ],
  gerar(p, { Manifold, CrossSection, segmentos }) {
    const z = Math.round(p.dentes), m = p.modulo;
    const rRaiz = m * (z / 2 - 1.25), rPonta = m * (z / 2 + 1), passo = (2 * Math.PI) / z;
    const pts = [];
    for (let i = 0; i < z; i++) {
      const t = i * passo;
      for (const [r, f] of [[rRaiz, 0], [rPonta, 0.18], [rPonta, 0.32], [rRaiz, 0.5]])
        pts.push([r * Math.cos(t + f * passo), r * Math.sin(t + f * passo)]);
    }
    const cs = new CrossSection([pts]);
    let g = cs.extrude(p.espessura); cs.delete();
    if (p.furo > 0) {
      const rf = p.furo / 2;
      const f = Manifold.cylinder(p.espessura + 2, rf, rf, segmentos(rf)).translate([0, 0, -1]);
      const r = g.subtract(f); g.delete(); f.delete(); g = r;
    }
    return g;
  },
};
