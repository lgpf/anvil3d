import { BARRA_D } from '../tijolos/comum.js';
// Cubo conector: furos para a barra Ø 3,18 nas seis faces (monta estruturas tipo treliça).
export default {
  api: 1, id: 'cubo-conector', nome: 'Cubo conector', categoria: 'Conectores', icone: '⧈', cor: '#e63946', versao: '1.0.0', ordem: 6,
  descricao: 'Cubo com furos para a barra Ø 3,18 mm nas seis faces',
  en: { nome: 'Connector cube', categoria: 'Connectors', descricao: 'Cube with holes for the Ø 3.18 mm bar on all six faces', rotulos: { lado: 'Side (mm)', profundidade: 'Hole depth (mm)', folga: 'Clearance (mm)' } },
  parametros: [
    { chave: 'lado', rotulo: 'Lado (mm)', padrao: 8, min: 6, max: 30 },
    { chave: 'profundidade', rotulo: 'Profundidade dos furos (mm)', padrao: 3, min: 1, max: 12, casas: 1 },
    { chave: 'folga', rotulo: 'Folga (mm)', padrao: 0.15, min: 0, max: 0.5, casas: 2 },
  ],
  gerar(p, { Manifold, segmentos }) {
    const L = p.lado, r = BARRA_D / 2 + p.folga, prof = Math.min(p.profundidade, L / 2 - 1.6); // sobra um miolo maciço ligando as faces
    const cubo = Manifold.cube([L, L, L], true);
    const furo = Manifold.cylinder(prof + 0.01, r, r, segmentos(r)).translate([0, 0, L / 2 - prof]);
    const furos = [[0, 0, 0], [180, 0, 0], [90, 0, 0], [-90, 0, 0], [0, 90, 0], [0, -90, 0]].map(a => furo.rotate(a)); furo.delete();
    const c = Manifold.union(furos); furos.forEach(x => x.delete());
    const rr = cubo.subtract(c); cubo.delete(); c.delete();
    const m = rr.translate([0, 0, L / 2]); rr.delete(); return m;
  },
};
