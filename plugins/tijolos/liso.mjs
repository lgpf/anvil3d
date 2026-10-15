import { ALT_PLACA, paramAjuste, rotulosEn, tijolo, inteiro } from './comum.js';
// Liso (tile): placa sem pinos em cima — acabamento e piso.
export default {
  api: 1, id: 'liso-tijolo', nome: 'Liso', categoria: 'Tijolos', icone: '▬', cor: '#e9c46a', versao: '1.1.0', ordem: 3,
  descricao: 'Placa lisa, sem pinos em cima (acabamento)',
  en: { nome: 'Tile', categoria: 'Bricks', descricao: 'Smooth plate with no studs on top (finishing)', rotulos: rotulosEn },
  parametros: [
    { chave: 'largura', rotulo: 'Largura (pinos)', padrao: 2, min: 1, max: 32, casas: 0 },
    { chave: 'comprimento', rotulo: 'Comprimento (pinos)', padrao: 2, min: 1, max: 32, casas: 0 },
    { chave: 'altura', rotulo: 'Altura (placas; 3 = tijolo)', padrao: 1, min: 1, max: 30, casas: 0 },
    paramAjuste,
  ],
  gerar(p, ctx) { return tijolo(ctx, { nx: inteiro(p.largura), ny: inteiro(p.comprimento), h: inteiro(p.altura, 1, 30) * ALT_PLACA, pinos: false, ajuste: p.ajuste }); },
};
