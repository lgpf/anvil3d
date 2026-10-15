// ---- rosca helicoidal: a seção perpendicular ao eixo (raio variando com o ângulo, seguindo o perfil
// do filete) extrudada com torção de 360° por passo gera a hélice exata, rosca direita ----
const METRICA = { // d: [passo, sextavado (chave), altura cabeça sext., Ø cabeça cilíndrica, allen, altura porca]
  M2: [0.4, 4, 1.4, 3.8, 1.5, 1.6], 'M2.5': [0.45, 5, 1.7, 4.5, 2, 2], M3: [0.5, 5.5, 2, 5.5, 2.5, 2.4], M4: [0.7, 7, 2.8, 7, 3, 3.2],
  M5: [0.8, 8, 3.5, 8.5, 4, 4], M6: [1, 10, 4, 10, 5, 5], M8: [1.25, 13, 5.3, 13, 6, 6.5], M10: [1.5, 16, 6.4, 16, 8, 8], M12: [1.75, 18, 7.5, 18, 10, 10],
};
const SOBERBA = { '2.5': 1.0, '3': 1.2, '3.5': 1.4, '4': 1.6, '4.5': 1.8, '5': 2.0, '6': 2.5 };
function perfilRosca(tipo) {
  // raio relativo (0 = fundo, 1 = crista) ao longo de um passo
  const [crista, fundo] = tipo === 'soberba' ? [0.04, 0.30] : [1 / 8, 1 / 4];
  const flanco = (1 - crista - fundo) / 2;
  return t => {
    t = ((t % 1) + 1) % 1;
    const a = crista / 2, b = a + flanco, c = b + fundo, d = c + flanco;
    if (t < a || t >= d) return 1;
    if (t < b) return 1 - (t - a) / flanco;
    if (t < c) return 0;
    return (t - c) / flanco;
  };
}
function barraRoscada({ Manifold, CrossSection }, { d, passo, tipo, comprimento, nPts }) {
  const R = d / 2, prof = tipo === 'soberba' ? 0.38 * R : 0.5413 * passo; // ISO: 5/8·H, H = 0,866·P
  const rMin = R - prof, f = perfilRosca(tipo);
  const pts = [];
  for (let i = 0; i < nPts; i++) { const ang = 2 * Math.PI * i / nPts, r = rMin + (R - rMin) * f(-i / nPts); pts.push([r * Math.cos(ang), r * Math.sin(ang)]); }
  const s = new CrossSection([pts], 'NonZero');
  const voltas = comprimento / passo;
  const m = s.extrude(comprimento, Math.max(1, Math.ceil(voltas * 20)), 360 * voltas); s.delete();
  return { solido: m, rMin };
}

// Porca sextavada com rosca interna (métrica ISO, passo normal), chanfrada dos dois lados.
export default {
  api: 1, id: 'porca', nome: 'Porca', categoria: 'Fixadores', icone: '⬡', cor: '#a7b1b9', versao: '1.0.0',
  descricao: 'Porca sextavada com rosca interna métrica',
  en: {
    nome: 'Nut', categoria: 'Fasteners', descricao: 'Hex nut with a metric internal thread',
    rotulos: { medida: 'Size', altura: 'Height (0 = standard)', folga: 'Printing clearance (mm)', rosca: 'Internal thread' },
  },
  parametros: [
    { chave: 'medida', rotulo: 'Medida', tipo: 'opcao', opcoes: Object.keys(METRICA).map(k => [k, `${k} × ${METRICA[k][0]}`]), padrao: 'M4' },
    { chave: 'altura', rotulo: 'Altura (0 = padrão)', padrao: 0, min: 0 },
    { chave: 'rosca', rotulo: 'Rosca interna', tipo: 'booleano', padrao: true },
    { chave: 'folga', rotulo: 'Folga de impressão (mm)', padrao: 0.2, min: 0, max: 1, casas: 2 },
  ],
  gerar(p, ctx) {
    const { Manifold, CrossSection, segmentos } = ctx;
    const tab = METRICA[p.medida] ?? METRICA.M4, d = Number(p.medida.slice(1)), passo = tab[0], s = tab[1];
    const m = p.altura > 0 ? p.altura : tab[5];
    const Rh = s / 2 / Math.cos(Math.PI / 6);
    const hex = new CrossSection([Array.from({ length: 6 }, (_, i) => [Rh * Math.cos(i * Math.PI / 3), Rh * Math.sin(i * Math.PI / 3)])], 'NonZero');
    const pr = hex.extrude(m); hex.delete();
    // chanfro de 30° nos dois lados
    const c1 = Manifold.cylinder(m, s / 2 * 0.95, s / 2 * 0.95 + m * 1.2, segmentos(s));
    const c2 = Manifold.cylinder(m, s / 2 * 0.95 + m * 1.2, s / 2 * 0.95, segmentos(s));
    const corpo = Manifold.intersection([pr, c1, c2]); pr.delete(); c1.delete(); c2.delete();
    let furo;
    if (p.rosca) {
      const { solido } = barraRoscada(ctx, { d: d + p.folga, passo, tipo: 'metrica', comprimento: m + 2 * passo, nPts: Math.max(32, Math.min(96, segmentos(d))) });
      furo = solido.translate([0, 0, -passo]); solido.delete();
    } else furo = Manifold.cylinder(m + 2, (d + p.folga) / 2, (d + p.folga) / 2, segmentos(d)).translate([0, 0, -1]);
    // escareado leve na entrada dos dois lados
    const e1 = Manifold.cylinder(passo, d / 2 + passo * 0.6, d / 2 - 0.1, segmentos(d)).translate([0, 0, -0.001]);
    const e2 = Manifold.cylinder(passo, d / 2 - 0.1, d / 2 + passo * 0.6, segmentos(d)).translate([0, 0, m - passo + 0.001]);
    const tudo = Manifold.union([furo, e1, e2]); furo.delete(); e1.delete(); e2.delete();
    const r = corpo.subtract(tudo); corpo.delete(); tudo.delete();
    return r;
  },
};
