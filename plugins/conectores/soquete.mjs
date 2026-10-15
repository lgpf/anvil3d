import { BOLA_D } from '../tijolos/comum.js';
// Soquete de pressão para a bola Ø 5,9: copo com boca mais estreita e quatro fendas que abrem.
export default {
  api: 1, id: 'soquete-conector', nome: 'Soquete', categoria: 'Conectores', icone: '◡', cor: '#ef476f', versao: '1.0.0', ordem: 4,
  descricao: 'Soquete de pressão para a bola Ø 5,9 mm, com base para colar ou montar',
  en: { nome: 'Socket', categoria: 'Connectors', descricao: 'Snap socket for the Ø 5.9 mm ball, with a base', rotulos: { base: 'Base', folga: 'Clearance (mm)' }, opcoes: { disco: 'Disc', haste: 'Bar (Ø 3.18)', nenhuma: 'None' } },
  parametros: [
    { chave: 'base', rotulo: 'Base', tipo: 'opcao', opcoes: [['disco', 'Disco'], ['haste', 'Haste (Ø 3,18)'], ['nenhuma', 'Nenhuma']], padrao: 'disco' },
    { chave: 'folga', rotulo: 'Folga (mm)', padrao: 0.1, min: 0, max: 0.5, casas: 2 },
  ],
  gerar(p, { Manifold, segmentos }) {
    const rb = BOLA_D / 2 + p.folga, parede = 1.2, R = rb + parede, hBase = p.base === 'disco' ? 1.6 : 0;
    const zc = hBase + rb + 0.4, H = zc + rb * 0.55; // a borda passa do meio da bola: segura por pressão
    const copo = Manifold.cylinder(H - hBase, R, R, segmentos(R)).translate([0, 0, hBase]);
    const partes = [copo];
    if (p.base === 'disco') partes.push(Manifold.cylinder(hBase, R + 2.5, R + 2.5, segmentos(R + 2.5)));
    if (p.base === 'haste') partes.push(Manifold.cylinder(6, 1.59, 1.59, segmentos(1.6)).translate([0, 0, -6 + 0.01]));
    const u = Manifold.union(partes); partes.forEach(x => x.delete());
    const esf = Manifold.sphere(rb, segmentos(rb)).translate([0, 0, zc]);
    const boca = Manifold.cylinder(H, rb * 0.82, rb * 0.82, segmentos(rb)).translate([0, 0, zc]);
    const fendas = Manifold.union([0, 90].map(a => Manifold.cube([0.9, 2 * R + 2, rb * 1.2], true).rotate([0, 0, a]).translate([0, 0, H - rb * 0.6 + 0.01])));
    const corte = Manifold.union([esf, boca, fendas]); esf.delete(); boca.delete(); fendas.delete();
    const r = u.subtract(corte); u.delete(); corte.delete();
    const z = r.boundingBox().min[2], m = r.translate([0, 0, -z]); r.delete(); return m;
  },
};
