import { ALT_PLACA, paramAjuste, rotulosEn, tijolo, inteiro } from './comum.js';
// Tijolo de montar (padrão de 8 mm): pinos em cima, tubos embaixo. Altura em "placas" (3 = tijolo comum).
export default {
  api: 1, id: 'tijolo', nome: 'Tijolo', categoria: 'Tijolos', icone: '▦', cor: '#d62828', versao: '1.1.0', ordem: 1,
  descricao: 'Tijolo de montar compatível com o padrão de 8 mm (pinos em cima, tubos embaixo)',
  en: { nome: 'Brick', categoria: 'Bricks', descricao: 'Building brick compatible with the 8 mm standard (studs on top, tubes underneath)', rotulos: rotulosEn },
  parametros: [
    { chave: 'largura', rotulo: 'Largura (pinos)', padrao: 2, min: 1, max: 32, casas: 0 },
    { chave: 'comprimento', rotulo: 'Comprimento (pinos)', padrao: 4, min: 1, max: 32, casas: 0 },
    { chave: 'altura', rotulo: 'Altura (placas; 3 = tijolo)', padrao: 3, min: 1, max: 30, casas: 0 },
    paramAjuste,
  ],
  gerar(p, ctx) {
    return tijolo(ctx, { nx: inteiro(p.largura), ny: inteiro(p.comprimento), h: inteiro(p.altura, 1, 30) * ALT_PLACA, ajuste: p.ajuste });
  },
};
