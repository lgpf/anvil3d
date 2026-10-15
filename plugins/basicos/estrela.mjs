// Estrela de N pontas: plana (extrudada) ou cônica (as faces sobem até um bico no centro).
export default {
  api: 1, id: 'estrela', nome: 'Estrela', categoria: 'Básicos', icone: '★', cor: '#f2b632', versao: '1.1.0',
  descricao: 'Estrela de pontas iguais, plana ou cônica',
  en: {
    nome: 'Star', categoria: 'Basic', descricao: 'Star with equal points, flat or conical',
    rotulos: { pontas: 'Points', externo: 'Outer diameter', interno: 'Inner diameter (0 = perfect star)', altura: 'Height', formato: 'Shape', base: 'Base thickness (conical)', torcao: 'Twist (°)' },
    opcoes: { plana: 'Flat', conica: 'Conical (pointed)', dupla: 'Double conical' },
  },
  parametros: [
    { chave: 'pontas', rotulo: 'Pontas', padrao: 5, min: 3, max: 60, inteiro: true },
    { chave: 'externo', rotulo: 'Diâmetro externo', padrao: 40, min: 1 },
    { chave: 'interno', rotulo: 'Diâmetro interno (0 = estrela perfeita)', padrao: 0, min: 0 },
    { chave: 'altura', rotulo: 'Altura', padrao: 10, min: 0.01 },
    { chave: 'formato', rotulo: 'Formato', tipo: 'opcao', opcoes: [['plana', 'Plana'], ['conica', 'Cônica (com bico)'], ['dupla', 'Cônica dos dois lados']], padrao: 'plana' },
    { chave: 'base', rotulo: 'Espessura da base (cônica)', padrao: 0, min: 0 },
    { chave: 'torcao', rotulo: 'Torção (°)', padrao: 0, min: -3600, max: 3600, casas: 1 },
  ],
  gerar(p, { Manifold, CrossSection, segmentos }) {
    const n = Math.round(p.pontas), R = p.externo / 2;
    if (n < 3) throw new Error('são precisas pelo menos 3 pontas');
    // estrela perfeita {n/2}: as arestas de pontas opostas ficam alinhadas (pentagrama: r/R ≈ 0,382)
    const perfeito = n >= 5 ? R * Math.cos(2 * Math.PI / n) / Math.cos(Math.PI / n) : R * 0.5;
    const r = p.interno > 0 ? p.interno / 2 : perfeito;
    if (r >= R) throw new Error('o diâmetro interno precisa ser menor que o externo');
    const pts = Array.from({ length: 2 * n }, (_, i) => { const a = Math.PI / 2 + i * Math.PI / n, k = i % 2 ? r : R; return [k * Math.cos(a), k * Math.sin(a)]; });
    const s = new CrossSection([pts], 'NonZero');
    // torção: o topo (ou o bico) gira em relação à base, em fatias suficientes para ficar liso
    const tw = p.torcao || 0, div = h => tw ? Math.min(600, Math.ceil(segmentos(R) * Math.abs(tw) / 360 * Math.max(0.3, h / p.altura))) : 0;
    const ext = (h, topo, giro = tw * h / p.altura) => s.extrude(h, div(h), giro, topo);
    let m;
    if (p.formato === 'plana') m = ext(p.altura, [1, 1]);
    else {
      const base = Math.min(p.base, p.altura * 0.95);
      if (p.formato === 'conica') {
        const bico = ext(p.altura - base, [0, 0]).translate([0, 0, base]);
        m = base > 0 ? (() => { const b = s.extrude(base), u = Manifold.union([b, bico]); b.delete(); bico.delete(); return u; })() : bico;
      } else { // dupla: bico para cima e para baixo, base no meio
        const meio = (p.altura - base) / 2;
        const cima = ext(meio, [0, 0]).translate([0, 0, meio + base]);
        const baixo = ext(meio, [0, 0]).mirror([0, 0, 1]).translate([0, 0, meio]);
        const partes = [cima, baixo];
        if (base > 0) partes.push(s.extrude(base).translate([0, 0, meio]));
        m = Manifold.union(partes); partes.forEach(x => x.delete());
      }
    }
    s.delete();
    return m;
  },
};
