import { BOLA_D, BARRA_D, ALT_PLACA, tijolo } from '../tijolos/comum.js';
// Bola numa placa 1×1 (ou 1×2): encaixa nos tijolos por baixo e recebe um soquete em cima.
export default {
  api: 1, id: 'bola-placa-conector', nome: 'Bola na placa', categoria: 'Conectores', icone: '⚬', cor: '#8338ec', versao: '1.0.0', ordem: 3,
  descricao: 'Placa de montar com uma bola Ø 5,9 mm em cima',
  en: { nome: 'Ball on plate', categoria: 'Connectors', descricao: 'Building plate with a Ø 5.9 mm ball on top', rotulos: { comprimento: 'Length (studs)', lateral: 'Ball on the side', folga: 'Clearance (mm)' } },
  parametros: [
    { chave: 'comprimento', rotulo: 'Comprimento (pinos)', padrao: 1, min: 1, max: 4, casas: 0 },
    { chave: 'lateral', rotulo: 'Bola na lateral', tipo: 'booleano', padrao: false },
    { chave: 'folga', rotulo: 'Folga (mm)', padrao: 0, min: -0.3, max: 0.3, casas: 2 },
  ],
  gerar(p, ctx) {
    const { Manifold, segmentos } = ctx, n = Math.max(1, Math.min(4, Math.round(p.comprimento))), h = ALT_PLACA;
    const placa = tijolo(ctx, { nx: 1, ny: n, h, pinos: false });
    const r = BOLA_D / 2 - p.folga / 2, pesc = 2.2;
    let bola, haste;
    if (p.lateral) { // sai pela frente (−Y), na altura do meio da placa
      const y0 = -n * 4 + 0.1;
      haste = Manifold.cylinder(pesc, BARRA_D / 2, BARRA_D / 2, segmentos(1.6)).rotate([90, 0, 0]).translate([0, y0, h / 2]);
      bola = Manifold.sphere(r, segmentos(r)).translate([0, y0 - pesc - r * 0.8, h / 2]);
    } else {
      haste = Manifold.cylinder(pesc, BARRA_D / 2, BARRA_D / 2, segmentos(1.6)).translate([0, 0, h]);
      bola = Manifold.sphere(r, segmentos(r)).translate([0, 0, h + pesc + r * 0.8]);
    }
    const u = Manifold.union([placa, haste, bola]); placa.delete(); haste.delete(); bola.delete();
    const z = u.boundingBox().min[2], m = u.translate([0, 0, -z]); u.delete(); return m;
  },
};
