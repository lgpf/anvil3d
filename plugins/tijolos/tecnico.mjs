import { P, ALT_TIJOLO, PAREDE, paramAjuste, rotulosEn, tijolo, inteiro } from './comum.js';
// Tijolo técnico 1×N: furos atravessando a lateral, entre os pinos, para eixos e conectores (Ø 4,8).
export default {
  api: 1, id: 'tecnico-tijolo', nome: 'Tijolo técnico', categoria: 'Tijolos', icone: '⦾', cor: '#457b9d', versao: '1.1.0', ordem: 6,
  descricao: 'Tijolo 1×N com furos laterais para eixos e conectores',
  en: { nome: 'Technic brick', categoria: 'Bricks', descricao: '1×N brick with side holes for axles and pins', rotulos: rotulosEn },
  parametros: [
    { chave: 'comprimento', rotulo: 'Comprimento (pinos)', padrao: 6, min: 2, max: 32, casas: 0 },
    paramAjuste,
  ],
  gerar(p, ctx) {
    const { Manifold, segmentos } = ctx;
    const n = inteiro(p.comprimento, 2, 32), h = ALT_TIJOLO, zFuro = 5.8;
    const base = tijolo(ctx, { nx: 1, ny: n, h, ajuste: p.ajuste });
    // reforço maciço em volta de cada furo (de parede a parede) e o furo com rebaixo nas duas faces
    const W = P - 0.2, partes = [], cortes = [];
    for (let k = 1; k < n; k++) {
      const y = k * P - n * P / 2;
      const ref = Manifold.cylinder(W, 3.6, 3.6, segmentos(3.6)).rotate([0, 90, 0]).translate([-W / 2, y, zFuro]);
      partes.push(ref);
      const furo = Manifold.cylinder(W + 2, 2.45, 2.45, segmentos(2.45)).rotate([0, 90, 0]).translate([-W / 2 - 1, y, zFuro]);
      const reb1 = Manifold.cylinder(0.8 + 1, 3.1, 3.1, segmentos(3.1)).rotate([0, 90, 0]).translate([-W / 2 - 1, y, zFuro]);
      const reb2 = Manifold.cylinder(0.8 + 1, 3.1, 3.1, segmentos(3.1)).rotate([0, 90, 0]).translate([W / 2 - 0.8, y, zFuro]);
      cortes.push(furo, reb1, reb2);
    }
    const u = Manifold.union([base, ...partes]); base.delete(); partes.forEach(x => x.delete());
    const corte = Manifold.union(cortes); cortes.forEach(x => x.delete());
    const r = u.subtract(corte); u.delete(); corte.delete();
    return r;
  },
};
