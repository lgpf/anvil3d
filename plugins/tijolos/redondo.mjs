import { P, ALT_PLACA, FOLGA, PAREDE, TETO, PINO_D, paramAjuste, rotulosEn, pinosDeCima, centroPino, inteiro } from './comum.js';
// Tijolo redondo: cilindro de 1 ou 2 pinos de diâmetro (2 = quatro pinos em cima).
export default {
  api: 1, id: 'redondo-tijolo', nome: 'Redondo', categoria: 'Tijolos', icone: '◍', cor: '#f4a261', versao: '1.1.0', ordem: 5,
  descricao: 'Tijolo redondo (1 ou 2 pinos de diâmetro)',
  en: { nome: 'Round brick', categoria: 'Bricks', descricao: 'Round brick (1 or 2 studs across)', rotulos: rotulosEn },
  parametros: [
    { chave: 'diametro', rotulo: 'Diâmetro (pinos)', padrao: 2, min: 1, max: 2, casas: 0 },
    { chave: 'altura', rotulo: 'Altura (placas; 3 = tijolo)', padrao: 3, min: 1, max: 30, casas: 0 },
    paramAjuste,
  ],
  gerar(p, ctx) {
    const { Manifold, segmentos } = ctx;
    const n = inteiro(p.diametro, 1, 2), h = inteiro(p.altura, 1, 30) * ALT_PLACA, R = n * P / 2 - FOLGA;
    const fora = Manifold.cylinder(h, R, R, segmentos(R));
    // por baixo: oco para encaixar num pino (1×1) ou num tubo/quatro pinos (2×2)
    const rOco = n === 1 ? (PINO_D / 2 + 0.05) : R - PAREDE, hCav = Math.max(0, h - TETO);
    const oco = Manifold.cylinder(hCav + 0.01, rOco, rOco, segmentos(rOco)).translate([0, 0, -0.01]);
    let corpo = fora.subtract(oco); fora.delete(); oco.delete();
    if (n === 2 && hCav > 0.2) { // tubo central como nos 2×2
      const t1 = Manifold.cylinder(hCav, 6.51 / 2 + p.ajuste / 2, 6.51 / 2 + p.ajuste / 2, segmentos(3.3)), t2 = Manifold.cylinder(hCav + 0.02, 2.4, 2.4, segmentos(2.4)).translate([0, 0, -0.01]);
      const t = t1.subtract(t2); t1.delete(); t2.delete(); const c = Manifold.union([corpo, t]); corpo.delete(); t.delete(); corpo = c;
    }
    const pinos = pinosDeCima(ctx, n, n, h, p.ajuste, segmentos);
    const u = Manifold.union([corpo, ...pinos]); [corpo, ...pinos].forEach(x => x.delete());
    return u;
  },
};
