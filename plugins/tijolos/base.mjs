import { ALT_PLACA, P, FOLGA, paramAjuste, rotulosEn, pinosDeCima, inteiro } from './comum.js';
// Placa de base: fina e maciça, só com pinos em cima (para montar em cima, não para encaixar embaixo).
export default {
  api: 1, id: 'base-tijolo', nome: 'Placa de base', categoria: 'Tijolos', icone: '▤', cor: '#52b788', versao: '1.1.0', ordem: 7,
  descricao: 'Placa de base fina para montar em cima (só pinos)',
  en: { nome: 'Baseplate', categoria: 'Bricks', descricao: 'Thin baseplate to build on (studs only)', rotulos: { ...rotulosEn, espessura: 'Thickness (mm)' } },
  parametros: [
    { chave: 'largura', rotulo: 'Largura (pinos)', padrao: 8, min: 1, max: 48, casas: 0 },
    { chave: 'comprimento', rotulo: 'Comprimento (pinos)', padrao: 8, min: 1, max: 48, casas: 0 },
    { chave: 'espessura', rotulo: 'Espessura (mm)', padrao: 1.6, min: 0.8, max: ALT_PLACA, casas: 1 },
    paramAjuste,
  ],
  gerar(p, ctx) {
    const { Manifold, segmentos } = ctx, nx = inteiro(p.largura, 1, 48), ny = inteiro(p.comprimento, 1, 48), h = p.espessura;
    const placa = Manifold.cube([nx * P - 2 * FOLGA, ny * P - 2 * FOLGA, h], true).translate([0, 0, h / 2]);
    const pinos = pinosDeCima(ctx, nx, ny, h, p.ajuste, segmentos);
    const u = Manifold.union([placa, ...pinos]); [placa, ...pinos].forEach(x => x.delete()); return u;
  },
};
