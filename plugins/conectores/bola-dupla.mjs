import { BOLA_D, BARRA_D } from '../tijolos/comum.js';
// Bola dupla: duas bolas (Ø 5,9) ligadas por um pescoço curto — junta dois soquetes.
export default {
  api: 1, id: 'bola-dupla-conector', nome: 'Bola dupla', categoria: 'Conectores', icone: '∞', cor: '#06d6a0', versao: '1.0.0', ordem: 2,
  descricao: 'Duas bolas Ø 5,9 mm ligadas, para unir dois soquetes',
  en: { nome: 'Double ball', categoria: 'Connectors', descricao: 'Two Ø 5.9 mm balls joined, to link two sockets', rotulos: { distancia: 'Distance between centers (mm)', folga: 'Clearance (mm)' } },
  parametros: [
    { chave: 'distancia', rotulo: 'Distância entre centros (mm)', padrao: 8, min: 6, max: 40 },
    { chave: 'folga', rotulo: 'Folga (mm)', padrao: 0, min: -0.3, max: 0.3, casas: 2 },
  ],
  gerar(p, { Manifold, segmentos }) {
    const r = BOLA_D / 2 - p.folga / 2, d = p.distancia;
    const b1 = Manifold.sphere(r, segmentos(r)), b2 = Manifold.sphere(r, segmentos(r)).translate([0, 0, d]);
    const pesc = Manifold.cylinder(d, BARRA_D / 2, BARRA_D / 2, segmentos(1.6));
    const u = Manifold.union([b1, b2, pesc]); b1.delete(); b2.delete(); pesc.delete();
    const m = u.translate([0, 0, r]); u.delete(); return m;
  },
};
