// Pino de encaixe (cavilha) com pontas chanfradas; use "Folga" para fazer o furo correspondente.
export default {
  api: 1, id: 'pino', nome: 'Pino', categoria: 'Encaixes', icone: '│', cor: '#bc8a5f', versao: '1.0.0',
  descricao: 'Pino cilíndrico (cavilha) com pontas chanfradas',
  en: { nome: 'Pin', categoria: 'Joints', descricao: 'Cylindrical pin (dowel) with chamfered ends',
    rotulos: { diametro: 'Diameter', comprimento: 'Length', chanfro: 'End chamfer', folga: 'Clearance (to use as a hole)' } },
  parametros: [
    { chave: 'diametro', rotulo: 'Diâmetro', padrao: 6, min: 0.1 },
    { chave: 'comprimento', rotulo: 'Comprimento', padrao: 20, min: 0.1 },
    { chave: 'chanfro', rotulo: 'Chanfro nas pontas', padrao: 0.6, min: 0 },
    { chave: 'folga', rotulo: 'Folga (para usar como furo)', padrao: 0, min: 0, casas: 2 },
  ],
  gerar(p, { Manifold, segmentos }) {
    const r = p.diametro / 2 + p.folga / 2, c = Math.min(p.chanfro, r * 0.8, p.comprimento / 3), L = p.comprimento, n = segmentos(r);
    const partes = [Manifold.cylinder(L - 2 * c, r, r, n).translate([0, 0, c])];
    if (c > 0) partes.push(Manifold.cylinder(c, r - c, r, n), Manifold.cylinder(c, r, r - c, n).translate([0, 0, L - c]));
    const m = Manifold.union(partes); partes.forEach(x => x.delete()); return m;
  },
};
