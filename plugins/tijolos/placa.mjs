import { ALT_PLACA, paramAjuste, rotulosEn, tijolo, inteiro } from './comum.js';
// Placa: um terço da altura do tijolo (3,2 mm).
export default {
  api: 1, id: 'placa-tijolo', nome: 'Placa', categoria: 'Tijolos', icone: '▭', cor: '#2a9d8f', versao: '1.1.0', ordem: 2,
  descricao: 'Placa de montar (1/3 da altura do tijolo), pinos em cima',
  en: { nome: 'Plate', categoria: 'Bricks', descricao: 'Building plate (1/3 of a brick tall), studs on top', rotulos: rotulosEn },
  parametros: [
    { chave: 'largura', rotulo: 'Largura (pinos)', padrao: 2, min: 1, max: 32, casas: 0 },
    { chave: 'comprimento', rotulo: 'Comprimento (pinos)', padrao: 4, min: 1, max: 32, casas: 0 },
    paramAjuste,
  ],
  gerar(p, ctx) { return tijolo(ctx, { nx: inteiro(p.largura), ny: inteiro(p.comprimento), h: ALT_PLACA, ajuste: p.ajuste }); },
};
