import { P, ALT_PLACA, FOLGA, PAREDE, paramAjuste, rotulosEn, corpo, apoiosDeBaixo, pinosDeCima, inteiro } from './comum.js';
// Rampa (telhado): uma fileira de pinos atrás e a face inclinada descendo para a frente (−Y).
export default {
  api: 1, id: 'rampa-tijolo', nome: 'Rampa', categoria: 'Tijolos', icone: '◢', cor: '#e76f51', versao: '1.1.0', ordem: 4,
  descricao: 'Tijolo com face inclinada (telhado), uma fileira de pinos atrás',
  en: { nome: 'Slope', categoria: 'Bricks', descricao: 'Brick with a sloped face (roof), one row of studs at the back', rotulos: { ...rotulosEn, comprimento: 'Depth (studs)' } },
  parametros: [
    { chave: 'largura', rotulo: 'Largura (pinos)', padrao: 2, min: 1, max: 32, casas: 0 },
    { chave: 'comprimento', rotulo: 'Profundidade (pinos)', padrao: 2, min: 2, max: 8, casas: 0 },
    { chave: 'altura', rotulo: 'Altura (placas; 3 = tijolo)', padrao: 3, min: 2, max: 30, casas: 0 },
    paramAjuste,
  ],
  gerar(p, ctx) {
    const { Manifold, segmentos } = ctx;
    const nx = inteiro(p.largura), ny = inteiro(p.comprimento, 2, 8), h = inteiro(p.altura, 2, 30) * ALT_PLACA;
    const D = ny * P - 2 * FOLGA, W = nx * P - 2 * FOLGA;
    // plano da rampa: do topo, no começo da fileira de trás, até uma borda baixa (1 mm) na frente
    const yTopo = D / 2 - P + FOLGA, yFrente = -D / 2, zFrente = 1.0;
    const corteRampa = desloc => {
      // prisma que remove tudo acima do plano (deslocado para baixo por "desloc", para a cavidade)
      const pts = [[yFrente - 50, zFrente - desloc - 50 * (h - zFrente) / (yTopo - yFrente)], [yTopo, h - desloc], [yTopo, h + 50], [yFrente - 50, h + 50]];
      const cs = new ctx.CrossSection([pts.map(([y, z]) => [y, z])], 'NonZero');
      const prisma = cs.extrude(W + 2); cs.delete();
      // a seção está no plano XY (como Y, Z); gira para o plano YZ e estica ao longo de X
      const m = prisma.rotate([90, 0, 90]).translate([-(W + 2) / 2, 0, 0]); prisma.delete();
      return m;
    };
    const fora = Manifold.cube([W, D, h], true).translate([0, 0, h / 2]);
    const c1 = corteRampa(0), casca = fora.subtract(c1); fora.delete(); c1.delete();
    const hCav = h - 1.0;
    const cavBox = Manifold.cube([W - 2 * PAREDE, D - 2 * PAREDE, hCav + 0.02], true).translate([0, 0, hCav / 2 - 0.01]);
    const c2 = corteRampa(PAREDE * 1.4), cav = cavBox.subtract(c2); cavBox.delete(); c2.delete();
    const corpoR = casca.subtract(cav); casca.delete(); cav.delete();
    // apoios embaixo, aparados pela rampa (por dentro)
    const apoios = apoiosDeBaixo(ctx, nx, ny, hCav, p.ajuste, segmentos).map(a => { const c = corteRampa(PAREDE), r = a.subtract(c); a.delete(); c.delete(); return r; });
    const pinos = pinosDeCima(ctx, nx, ny, h, p.ajuste, segmentos, (i, j) => j === ny - 1);
    const u = Manifold.union([corpoR, ...apoios, ...pinos]); [corpoR, ...apoios, ...pinos].forEach(x => x.delete());
    return u;
  },
};
