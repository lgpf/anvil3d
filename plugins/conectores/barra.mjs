import { BARRA_D, barra } from '../tijolos/comum.js';
// Barra (Ø 3,18): a "haste" do sistema de clipes. Pode ter batentes nas pontas.
export default {
  api: 1, id: 'barra-conector', nome: 'Barra', categoria: 'Conectores', icone: '━', cor: '#00a6fb', versao: '1.0.0', ordem: 1,
  descricao: 'Barra Ø 3,18 mm para os clipes, com batentes opcionais',
  en: { nome: 'Bar', categoria: 'Connectors', descricao: 'Ø 3.18 mm bar for the clips, with optional stops', rotulos: { comprimento: 'Length (mm)', batentes: 'Stops at the ends', folga: 'Clearance (mm)' } },
  parametros: [
    { chave: 'comprimento', rotulo: 'Comprimento (mm)', padrao: 24, min: 4, max: 200 },
    { chave: 'batentes', rotulo: 'Batentes nas pontas', tipo: 'booleano', padrao: true },
    { chave: 'folga', rotulo: 'Folga (mm)', padrao: 0, min: -0.3, max: 0.3, casas: 2 },
  ],
  gerar(p, ctx) {
    const { Manifold, segmentos } = ctx, L = p.comprimento, d = BARRA_D - p.folga;
    const partes = [barra(ctx, L, segmentos, d)];
    if (p.batentes) for (const x of [-L / 2 + 0.6, L / 2 - 0.6]) partes.push(barra(ctx, 1.2, segmentos, 4.6).translate([x, 0, 0]));
    const u = Manifold.union(partes); partes.forEach(x => x.delete());
    const z = u.boundingBox().min[2], m = u.translate([0, 0, -z]); u.delete(); return m;
  },
};
