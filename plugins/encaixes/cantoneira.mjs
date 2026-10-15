// Cantoneira em L com furos para parafuso nas duas abas e reforço opcional no canto.
export default {
  api: 1, id: 'cantoneira', nome: 'Cantoneira', categoria: 'Encaixes', icone: '⌐', cor: '#6c757d', versao: '1.0.0',
  descricao: 'Cantoneira em L com furos nas duas abas',
  en: { nome: 'L bracket', categoria: 'Joints', descricao: 'L-shaped bracket with holes in both flanges',
    rotulos: { aba: 'Flange length', largura: 'Width', espessura: 'Thickness', furo: 'Hole diameter (0 = none)', reforco: 'Corner gusset' } },
  parametros: [
    { chave: 'aba', rotulo: 'Comprimento da aba', padrao: 25, min: 1 },
    { chave: 'largura', rotulo: 'Largura', padrao: 15, min: 1 },
    { chave: 'espessura', rotulo: 'Espessura', padrao: 3, min: 0.2 },
    { chave: 'furo', rotulo: 'Diâmetro do furo (0 = sem)', padrao: 4.5, min: 0 },
    { chave: 'reforco', rotulo: 'Reforço no canto', tipo: 'booleano', padrao: true },
  ],
  gerar(p, { Manifold, CrossSection, segmentos }) {
    const a = p.aba, w = p.largura, e = p.espessura;
    if (e * 2 >= a) throw new Error('a espessura é grande demais para a aba');
    const partes = [Manifold.cube([a, w, e]), Manifold.cube([e, w, a])];
    if (p.reforco) {
      const g = a * 0.45, er = Math.min(e, w / 3), s = new CrossSection([[[e, e], [e + g, e], [e, e + g]]], 'NonZero');
      const ex = s.extrude(er); s.delete();
      partes.push(ex.rotate([90, 0, 0]).translate([0, w / 2 + er / 2, 0])); ex.delete();
    }
    let m = Manifold.union(partes); partes.forEach(x => x.delete());
    if (p.furo > 0) {
      const r = p.furo / 2, pos = e + (a - e) * 0.6;
      const f1 = Manifold.cylinder(e + 2, r, r, segmentos(r)).translate([pos, w / 2, -1]);
      const c2 = Manifold.cylinder(e + 2, r, r, segmentos(r)), f2 = c2.rotate([0, 90, 0]).translate([-1, w / 2, pos]); c2.delete();
      const f = Manifold.union([f1, f2]); f1.delete(); f2.delete();
      const n = m.subtract(f); m.delete(); f.delete(); m = n;
    }
    const n = m.translate([-a / 2, -w / 2, 0]); m.delete(); return n;
  },
};
