import { P, rotulosEn, secaoCruz, inteiro } from './comum.js';
// Eixo em cruz: comprimento em unidades de 8 mm; entra nos furos em cruz e gira junto.
export default {
  api: 1, id: 'eixo-tijolo', nome: 'Eixo', categoria: 'Tijolos', icone: '✚', cor: '#343a40', versao: '1.1.0', ordem: 11,
  descricao: 'Eixo de seção em cruz (comprimento em unidades de 8 mm)',
  en: { nome: 'Axle', categoria: 'Bricks', descricao: 'Cross-section axle (length in 8 mm units)', rotulos: { ...rotulosEn, unidades: 'Length (units)', folga: 'Clearance (mm)' } },
  parametros: [
    { chave: 'unidades', rotulo: 'Comprimento (unidades)', padrao: 4, min: 2, max: 16, casas: 0 },
    { chave: 'folga', rotulo: 'Folga (mm)', padrao: 0.1, min: 0, max: 0.4, casas: 2 },
  ],
  gerar(p, ctx) {
    const L = inteiro(p.unidades, 2, 16) * P, s = secaoCruz(ctx, -2 * p.folga);
    // deitado (ao longo de X), apoiado na mesa por um dos braços da cruz
    const m = s.extrude(L); s.delete();
    const r = m.rotate([0, 90, 0]).translate([-L / 2, 0, 2.4 - p.folga]); m.delete(); return r;
  },
};
