// Gancho em J para pendurar, com furo na haste para parafusar na parede.
export default {
  api: 1, id: 'gancho', nome: 'Gancho', categoria: 'Encaixes', icone: 'J', cor: '#495057', versao: '1.0.0',
  descricao: 'Gancho em J com furo para fixar',
  en: { nome: 'Hook', categoria: 'Joints', descricao: 'J hook with a hole to fasten it',
    rotulos: { altura: 'Height', abertura: 'Hook opening', grossura: 'Bar thickness', largura: 'Width', furo: 'Hole diameter (0 = none)' } },
  parametros: [
    { chave: 'altura', rotulo: 'Altura', padrao: 40, min: 5 },
    { chave: 'abertura', rotulo: 'Abertura do gancho', padrao: 14, min: 2 },
    { chave: 'grossura', rotulo: 'Grossura da barra', padrao: 4, min: 0.5 },
    { chave: 'largura', rotulo: 'Largura', padrao: 10, min: 1 },
    { chave: 'furo', rotulo: 'Diâmetro do furo (0 = sem)', padrao: 4, min: 0 },
  ],
  gerar(p, { Manifold, CrossSection, segmentos }) {
    const t = p.grossura, R = p.abertura / 2 + t / 2, H = p.altura, n = segmentos(R);
    if (H < 2 * R + 2 * t) throw new Error('a altura é pequena para essa abertura');
    // perfil (x, z): haste à esquerda, U embaixo (centro em x = R, z = R + t/2) e ponta subindo à direita
    const c0 = CrossSection.circle(R + t / 2, n), c1 = CrossSection.circle(R - t / 2, n), anel = c0.subtract(c1); c0.delete(); c1.delete();
    const metade = CrossSection.square([4 * R, 2 * R]).translate([-2 * R, -2 * R]);
    const u0 = anel.intersect(metade); anel.delete(); metade.delete();
    const u = u0.translate([R, R + t / 2]); u0.delete();
    const haste = CrossSection.square([t, H - R - t / 2]).translate([-t / 2, R + t / 2]);
    const ponta = CrossSection.square([t, R * 0.9]).translate([2 * R - t / 2, R + t / 2]);
    const s = CrossSection.union([haste, u, ponta]); haste.delete(); u.delete(); ponta.delete();
    const e = s.extrude(p.largura); s.delete();
    let m = e.rotate([90, 0, 0]).translate([0, p.largura / 2, 0]); e.delete();
    const z0 = m.boundingBox().min[2], m1 = m.translate([0, 0, -z0]); m.delete(); m = m1;
    if (p.furo > 0) {
      const c = Manifold.cylinder(t + 2, p.furo / 2, p.furo / 2, segmentos(p.furo)), f = c.rotate([0, 90, 0]).translate([-t / 2 - 1, 0, H - Math.min(8, H / 4)]); c.delete();
      const n2 = m.subtract(f); m.delete(); f.delete(); m = n2;
    }
    const b = m.boundingBox(), r = m.translate([-(b.min[0] + b.max[0]) / 2, 0, 0]); m.delete(); return r;
  },
};
