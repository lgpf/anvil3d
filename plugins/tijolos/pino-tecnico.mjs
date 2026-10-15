import { rotulosEn } from './comum.js';
// Pino técnico (conector): duas pontas que entram nos furos de Ø 4,8, com colar no meio e fendas que flexionam.
export default {
  api: 1, id: 'pino-tecnico-tijolo', nome: 'Pino técnico', categoria: 'Tijolos', icone: '⊷', cor: '#1d3557', versao: '1.1.0', ordem: 12,
  descricao: 'Pino conector para os furos técnicos (Ø 4,8), com colar e fendas',
  en: { nome: 'Technic pin', categoria: 'Bricks', descricao: 'Connector pin for technic holes (Ø 4.8), with collar and slots', rotulos: { ...rotulosEn, folga: 'Clearance (mm)', comprido: 'Long (3 units)' } },
  parametros: [
    { chave: 'comprido', rotulo: 'Comprido (3 unidades)', tipo: 'booleano', padrao: false },
    { chave: 'folga', rotulo: 'Folga (mm)', padrao: 0.1, min: 0, max: 0.4, casas: 2 },
  ],
  gerar(p, { Manifold, segmentos }) {
    const r = 4.8 / 2 - p.folga, colar = 0.8, ponta1 = 7.8, ponta2 = p.comprido ? 15.8 : 7.8, rc = 6.2 / 2 - 0.1;
    // ao longo de Z (em pé): ponta, colar, ponta — cada ponta com um ressalto na saída e uma fenda
    const peca = (L, z0) => {
      const c = Manifold.cylinder(L, r, r, segmentos(r)).translate([0, 0, z0]);
      const ressalto = Manifold.cylinder(0.6, r + 0.25, r, segmentos(r)).translate([0, 0, z0 + (z0 > 0 ? L - 0.6 : 0)]);
      const fenda = Manifold.cube([0.8, 2 * r + 2, L * 0.75], true).translate([0, 0, z0 > 0 ? z0 + L - L * 0.375 : z0 + L * 0.375]);
      const u = Manifold.union([c, ressalto]); c.delete(); ressalto.delete();
      const f = u.subtract(fenda); u.delete(); fenda.delete(); return f;
    };
    const a = peca(ponta1, 0), col = Manifold.cylinder(colar, rc, rc, segmentos(rc)).translate([0, 0, ponta1]), b = peca(ponta2, ponta1 + colar);
    // furo no meio, de ponta a ponta (como o original; ajuda a flexionar)
    const furo = Manifold.cylinder(ponta1 + colar + ponta2 + 2, 1.1, 1.1, segmentos(1.1)).translate([0, 0, -1]);
    const u = Manifold.union([a, col, b]); a.delete(); col.delete(); b.delete();
    const m = u.subtract(furo); u.delete(); furo.delete();
    // descarta lasquinhas de área zero que sobram onde a fenda encontra a ponta
    const partes = m.decompose(), maior = partes.reduce((a, b) => (b.volume() > a.volume() ? b : a));
    const r2 = Manifold.union(partes.filter(x => x.volume() > maior.volume() * 1e-4)); partes.forEach(x => x.delete()); m.delete(); return r2;
  },
};
