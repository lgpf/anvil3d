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

// Parafuso: rosca métrica (ISO, passo normal), soberba (madeira, ponta fina) ou lisa; cabeça sextavada,
// cilíndrica (Allen), panela, chata (escareada) ou sem cabeça; fenda, Phillips ou Allen.
// Sai com a cabeça para baixo, apoiada na mesa, que é a posição boa para imprimir.
export default {
  api: 1, id: 'parafuso', nome: 'Parafuso', categoria: 'Fixadores', icone: '⚙', cor: '#8c97a1', versao: '1.0.0',
  descricao: 'Parafuso com rosca de verdade, várias cabeças e fendas',
  en: {
    nome: 'Screw', categoria: 'Fasteners', descricao: 'Screw with a real thread, several heads and drives',
    rotulos: { rosca: 'Thread', medida: 'Size (metric)', soberba: 'Diameter (wood screw)', comprimento: 'Length (under the head)', roscado: 'Threaded length (0 = all)',
      cabeca: 'Head', fenda: 'Drive', folga: 'Printing clearance (mm)' },
    opcoes: { metrica: 'Metric (ISO)', soberba: 'Wood screw (self-tapping)', lisa: 'Plain (no thread)',
      sextavada: 'Hex', cilindrica: 'Socket cap (cylindrical)', panela: 'Pan', chata: 'Flat (countersunk)', nenhuma: 'None (threaded rod)',
      nenhum: 'None', fenda: 'Slot', phillips: 'Phillips', allen: 'Hex socket (Allen)' },
  },
  parametros: [
    { chave: 'rosca', rotulo: 'Rosca', tipo: 'opcao', opcoes: [['metrica', 'Métrica (ISO)'], ['soberba', 'Soberba (madeira)'], ['lisa', 'Lisa (sem rosca)']], padrao: 'metrica' },
    { chave: 'medida', rotulo: 'Medida (métrica)', tipo: 'opcao', opcoes: Object.keys(METRICA).map(k => [k, `${k} × ${METRICA[k][0]}`]), padrao: 'M4' },
    { chave: 'soberba', rotulo: 'Diâmetro (soberba)', tipo: 'opcao', opcoes: Object.keys(SOBERBA).map(k => [k, k.replace('.', ',') + ' mm']), padrao: '4' },
    { chave: 'comprimento', rotulo: 'Comprimento (abaixo da cabeça)', padrao: 16, min: 1 },
    { chave: 'roscado', rotulo: 'Comprimento roscado (0 = tudo)', padrao: 0, min: 0 },
    { chave: 'cabeca', rotulo: 'Cabeça', tipo: 'opcao', opcoes: [['sextavada', 'Sextavada'], ['cilindrica', 'Cilíndrica (Allen)'], ['panela', 'Panela'], ['chata', 'Chata (escareada)'], ['nenhuma', 'Sem cabeça (barra roscada)']], padrao: 'sextavada' },
    { chave: 'fenda', rotulo: 'Fenda', tipo: 'opcao', opcoes: [['nenhum', 'Nenhuma'], ['fenda', 'Fenda'], ['phillips', 'Phillips'], ['allen', 'Allen (sextavado interno)']], padrao: 'nenhum' },
    { chave: 'folga', rotulo: 'Folga de impressão (mm)', padrao: 0, min: 0, max: 1, casas: 2 },
  ],
  gerar(p, ctx) {
    const { Manifold, CrossSection, segmentos } = ctx;
    const metrica = p.rosca !== 'soberba';
    const tab = METRICA[p.medida] ?? METRICA.M4;
    const d = (metrica ? Number(p.medida.slice(1)) : Number(p.soberba)) - p.folga;
    const passo = metrica ? tab[0] : SOBERBA[p.soberba] ?? 1.6;
    const R = d / 2, L = p.comprimento;
    const Lr = p.rosca === 'lisa' ? 0 : (p.roscado > 0 ? Math.min(p.roscado, L) : L);
    const nPts = Math.max(32, Math.min(96, segmentos(R)));
    const partes = [];
    // ---- cabeça (para baixo, em z = 0 … k) ----
    const D = { sextavada: tab[1], cilindrica: metrica ? tab[3] : 1.6 * d + 1, panela: 2 * d, chata: 2 * d, nenhuma: 0 }[p.cabeca] ?? 0;
    const k = { sextavada: metrica ? tab[2] : 0.7 * d, cilindrica: d, panela: 0.6 * d, chata: d / 2, nenhuma: 0 }[p.cabeca] ?? 0;
    let cab = null;
    if (p.cabeca === 'sextavada') {
      const Rh = D / 2 / Math.cos(Math.PI / 6);
      const hex = new CrossSection([Array.from({ length: 6 }, (_, i) => [Rh * Math.cos(i * Math.PI / 3), Rh * Math.sin(i * Math.PI / 3)])], 'NonZero');
      const pr = hex.extrude(k); hex.delete();
      const cone = Manifold.cylinder(k, D / 2 * 0.95, D / 2 * 0.95 + k * 1.2, segmentos(D)); // chanfro de 30° na face de baixo
      cab = pr.intersect(cone); pr.delete(); cone.delete();
    } else if (p.cabeca === 'cilindrica') {
      const c = Math.min(0.1 * d, k / 4);
      cab = Manifold.union([Manifold.cylinder(c, D / 2 - c, D / 2, segmentos(D)), Manifold.cylinder(k - c, D / 2, D / 2, segmentos(D)).translate([0, 0, c])]);
    } else if (p.cabeca === 'panela') {
      const esf = Manifold.sphere(D / 2 * 1.15, segmentos(D)).scale([1, 1, k / (D / 2 * 1.15)]).translate([0, 0, k]);
      const cil = Manifold.cylinder(k, D / 2, D / 2, segmentos(D));
      cab = esf.intersect(cil); esf.delete(); cil.delete();
    } else if (p.cabeca === 'chata') {
      cab = Manifold.cylinder(k, D / 2, R, segmentos(D)); // 90°: o cone afina da face (z = 0) até o corpo
    }
    if (cab) {
      // ---- fenda na face de baixo da cabeça ----
      const prof = p.cabeca === 'chata' ? k * 0.5 : k * 0.55;
      let corte = null;
      if (p.fenda === 'fenda') corte = Manifold.cube([D * 1.2, 0.16 * d + 0.4, prof * 2], true);
      else if (p.fenda === 'phillips') {
        const w = 0.18 * d + 0.4, l = Math.min(D * (p.cabeca === 'chata' ? 0.6 : 0.7), 2.2 * d);
        corte = Manifold.union([Manifold.cube([l, w, prof * 2], true), Manifold.cube([w, l, prof * 2], true)]);
      } else if (p.fenda === 'allen') {
        const a = (metrica ? tab[4] : 0.5 * d) + 0.1, ra = a / 2 / Math.cos(Math.PI / 6);
        const hx = new CrossSection([Array.from({ length: 6 }, (_, i) => [ra * Math.cos(i * Math.PI / 3), ra * Math.sin(i * Math.PI / 3)])], 'NonZero');
        corte = hx.extrude(prof * 2, 0, 0, 1, true); hx.delete();
      }
      if (corte) { const n = cab.subtract(corte); cab.delete(); corte.delete(); cab = n; }
      partes.push(cab);
    }
    // ---- corpo: parte lisa junto da cabeça e rosca até a ponta ----
    const liso = L - Lr;
    if (liso > 0) partes.push(Manifold.cylinder(liso + 0.01, R, R, segmentos(R)).translate([0, 0, k - 0.005]));
    if (Lr > 0) {
      const { solido, rMin } = barraRoscada(ctx, { d, passo, tipo: metrica ? 'metrica' : 'soberba', comprimento: Lr, nPts });
      // ponta: chanfro curto na métrica; ponta fina na soberba
      // a "ponta" é um cone que corta só a extremidade de cima
      const cortePonta = metrica
        ? Manifold.cylinder(passo, R + 0.01, rMin - 0.05, segmentos(R)).translate([0, 0, Lr - passo])
        : Manifold.cylinder(Math.min(Lr, 1.6 * d), R + 0.01, 0.05, segmentos(R)).translate([0, 0, Lr - Math.min(Lr, 1.6 * d)]);
      const base = Manifold.cylinder(Math.max(0, Lr - (metrica ? passo : Math.min(Lr, 1.6 * d))) + 0.001, R + 1, R + 1, 16);
      const limite = Manifold.union([base, cortePonta]); base.delete(); cortePonta.delete();
      const r = solido.intersect(limite); solido.delete(); limite.delete();
      partes.push(r.translate([0, 0, k + liso])); r.delete();
    }
    const u = Manifold.union(partes); partes.forEach(x => x.delete());
    const z0 = u.boundingBox().min[2], m = u.translate([0, 0, -z0]); u.delete();   // apoiado em z = 0
    return m;
  },
};
