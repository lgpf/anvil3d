import { ALT_PLACA, P, paramAjuste, rotulosEn, tijolo, inteiro } from './comum.js';
// Canto em L: um tijolo 2×2 sem um dos quatro pinos (vira cantoneira de parede).
export default {
  api: 1, id: 'canto-tijolo', nome: 'Canto', categoria: 'Tijolos', icone: '⌐', cor: '#9d4edd', versao: '1.1.0', ordem: 9,
  descricao: 'Tijolo de canto em L (2×2 menos um pino)',
  en: { nome: 'Corner', categoria: 'Bricks', descricao: 'L-shaped corner brick (2×2 minus one stud)', rotulos: rotulosEn },
  parametros: [
    { chave: 'altura', rotulo: 'Altura (placas; 3 = tijolo)', padrao: 3, min: 1, max: 30, casas: 0 },
    paramAjuste,
  ],
  gerar(p, ctx) {
    const { Manifold } = ctx, h = inteiro(p.altura, 1, 30) * ALT_PLACA;
    // dois tijolos 1×2 em L, sem sobrepor: um ao longo de Y (x = −4) e um 1×1 em (+4, −4)
    const a = tijolo(ctx, { nx: 1, ny: 2, h, ajuste: p.ajuste }).translate([-P / 2, 0, 0]);
    const b = tijolo(ctx, { nx: 1, ny: 1, h, ajuste: p.ajuste }).translate([P / 2, -P / 2, 0]);
    // junta as duas com uma ponte maciça na parede que se encosta (fica uma peça só)
    const ponte = Manifold.cube([0.4, P - 0.2, h], true).translate([0, -P / 2, h / 2]);
    const u = Manifold.union([a, b, ponte]); a.delete(); b.delete(); ponte.delete(); return u;
  },
};
