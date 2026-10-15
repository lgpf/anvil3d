import { P, ALT_PLACA, FOLGA, PAREDE, TETO, paramAjuste, rotulosEn, pinosDeCima, nervuras, inteiro } from './comum.js';
// Arco 1×N: tijolo com o vão arredondado por baixo (pilares nas pontas).
export default {
  api: 1, id: 'arco-tijolo', nome: 'Arco', categoria: 'Tijolos', icone: '⌒', cor: '#bc6c25', versao: '1.2.0', ordem: 8,
  descricao: 'Arco 1×N, com vão redondo por baixo',
  en: { nome: 'Arch', categoria: 'Bricks', descricao: '1×N arch with a round opening underneath', rotulos: rotulosEn },
  parametros: [
    { chave: 'comprimento', rotulo: 'Comprimento (pinos)', padrao: 4, min: 3, max: 16, casas: 0 },
    { chave: 'altura', rotulo: 'Altura (placas; 3 = tijolo)', padrao: 6, min: 3, max: 30, casas: 0 },
    paramAjuste,
  ],
  gerar(p, ctx) {
    const { Manifold, segmentos } = ctx, n = inteiro(p.comprimento, 3, 16), h = inteiro(p.altura, 3, 30) * ALT_PLACA;
    const W = P - 2 * FOLGA, D = n * P - 2 * FOLGA;
    const bloco = Manifold.cube([W, D, h], true).translate([0, 0, h / 2]);
    // vão: metade de cima é um semicírculo (elipse), deixando um pilar de 1 pino em cada ponta e o topo de 1 placa
    const vao = (n - 2) * P, alturaVao = h - ALT_PLACA, rx = vao / 2;
    const elipse = Manifold.cylinder(W + 2, 1, 1, segmentos(rx)).rotate([0, 90, 0]).scale([1, rx, Math.max(0.1, alturaVao - rx * 0)]).translate([-(W + 2) / 2, 0, 0]);
    const baixo = Manifold.cube([W + 2, vao, 0.02], true);
    const corte = Manifold.union([elipse, baixo]); elipse.delete(); baixo.delete();
    // por baixo de cada pilar: o oco de encaixe, como num tijolo 1×1 (paredes de 1,2 mm), até perto do topo
    const hOco = Math.max(0.5, h - TETO - ALT_PLACA * 0.5);
    const ocos = [-1, 1].map(lado => Manifold.cube([W - 2 * PAREDE, P - 2 * FOLGA - 2 * PAREDE, hOco + 0.02], true)
      .translate([0, lado * (D / 2 - (P - 2 * FOLGA) / 2), hOco / 2 - 0.01]));
    const cortes = Manifold.union([corte, ...ocos]); corte.delete(); ocos.forEach(o => o.delete());
    const corpo = bloco.subtract(cortes); bloco.delete(); cortes.delete();
    // nervuras dentro dos pilares (casas 1×1): seguram o pino de baixo sem folga
    const yPilar = D / 2 - (P - 2 * FOLGA) / 2, nerv = [-1, 1].flatMap(l => nervuras(ctx, 0, l * yPilar, hOco, p.ajuste));
    const pinos = pinosDeCima(ctx, 1, n, h, p.ajuste, segmentos);
    const u = Manifold.union([corpo, ...nerv, ...pinos]); [corpo, ...nerv, ...pinos].forEach(x => x.delete()); return u;
  },
};
