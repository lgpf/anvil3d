import { BARRA_D, tijolo, ALT_PLACA } from '../tijolos/comum.js';
// Clipe para a barra Ø 3,18: anel aberto que "abraça" a barra. Pode vir sozinho, numa placa 1×1 ou com
// uma barra própria (para encadear clipes).
export default {
  api: 1, id: 'clipe-conector', nome: 'Clipe', categoria: 'Conectores', icone: '⊂', cor: '#ffb703', versao: '1.0.0', ordem: 5,
  descricao: 'Clipe que prende na barra Ø 3,18 mm (sozinho, na placa ou com barra)',
  en: { nome: 'Clip', categoria: 'Connectors', descricao: 'Clip that snaps onto the Ø 3.18 mm bar (alone, on a plate or with a bar)', rotulos: { suporte: 'Mount', largura: 'Clip width (mm)', folga: 'Clearance (mm)' },
    opcoes: { nenhum: 'None', placa: '1×1 plate', barra: 'Bar' } },
  parametros: [
    { chave: 'suporte', rotulo: 'Suporte', tipo: 'opcao', opcoes: [['nenhum', 'Nenhum'], ['placa', 'Placa 1×1'], ['barra', 'Barra']], padrao: 'placa' },
    { chave: 'largura', rotulo: 'Largura do clipe (mm)', padrao: 3.2, min: 2, max: 8, casas: 1 },
    { chave: 'folga', rotulo: 'Folga (mm)', padrao: 0.1, min: 0, max: 0.4, casas: 2 },
  ],
  gerar(p, ctx) {
    const { Manifold, segmentos } = ctx, ri = BARRA_D / 2 + p.folga, parede = 0.9, re = ri + parede, w = p.largura;
    // anel deitado: o eixo da barra é X; a abertura fica em cima (+Z), mais estreita que a barra
    const anel0 = Manifold.cylinder(w, re, re, segmentos(re)).subtract(Manifold.cylinder(w + 2, ri, ri, segmentos(ri)).translate([0, 0, -1]));
    const abertura = Manifold.cube([BARRA_D * 0.8, re + 2, w + 2], true).translate([0, re, w / 2]);
    const anel1 = anel0.subtract(abertura); anel0.delete(); abertura.delete();
    // gira para o eixo X, com a abertura para cima
    const anel = anel1.rotate([90, 0, 0]).rotate([0, 0, 90]).translate([-w / 2, 0, 0]); anel1.delete();
    const zc = -re; // a base do anel fica em z = −re + ... (ajustado ao montar)
    const partes = [];
    if (p.suporte === 'placa') {
      const h = ALT_PLACA, pl = tijolo(ctx, { nx: 1, ny: 1, h, pinos: false });
      partes.push(pl, anel.translate([0, 0, h + re - 0.4]));
    } else if (p.suporte === 'barra') {
      const haste = Manifold.cylinder(10, BARRA_D / 2, BARRA_D / 2, segmentos(1.6)).translate([0, 0, -10 - re + 0.4]);
      partes.push(haste, anel.translate([0, 0, 0]));
    } else partes.push(anel.translate([0, 0, 0]));
    anel.delete();
    const u = Manifold.union(partes); partes.forEach(x => x.delete());
    const z = u.boundingBox().min[2], m = u.translate([0, 0, -z]); u.delete(); return m;
  },
};
