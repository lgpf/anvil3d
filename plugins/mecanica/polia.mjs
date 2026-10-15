// Polia com canal em V (correia) ou redondo (anel de borracha), cubo e furo para o eixo.
export default {
  api: 1, id: 'polia', nome: 'Polia', categoria: 'Mecânica', icone: '◉', cor: '#7f8c8d', versao: '1.0.0',
  descricao: 'Polia com canal em V ou redondo e furo para eixo',
  en: { nome: 'Pulley', categoria: 'Mechanics', descricao: 'Pulley with a V or round groove and a shaft hole',
    rotulos: { diametro: 'Outer diameter', largura: 'Width', canal: 'Groove', profundidade: 'Groove depth', eixo: 'Shaft hole diameter', cubo: 'Hub height (0 = none)' },
    opcoes: { v: 'V (belt)', redondo: 'Round (O-ring)' } },
  parametros: [
    { chave: 'diametro', rotulo: 'Diâmetro externo', padrao: 30, min: 2 },
    { chave: 'largura', rotulo: 'Largura', padrao: 8, min: 0.5 },
    { chave: 'canal', rotulo: 'Canal', tipo: 'opcao', opcoes: [['v', 'Em V (correia)'], ['redondo', 'Redondo (anel de borracha)']], padrao: 'v' },
    { chave: 'profundidade', rotulo: 'Profundidade do canal', padrao: 3, min: 0 },
    { chave: 'eixo', rotulo: 'Diâmetro do furo do eixo', padrao: 5, min: 0 },
    { chave: 'cubo', rotulo: 'Altura do cubo (0 = sem)', padrao: 5, min: 0 },
  ],
  gerar(p, { Manifold, CrossSection, segmentos }) {
    const R = p.diametro / 2, w = p.largura, d = Math.min(p.profundidade, R * 0.6);
    let perfil;
    if (p.canal === 'v') perfil = [[0, 0], [R, 0], [R, w * 0.15], [R - d, w / 2], [R, w * 0.85], [R, w], [0, w]];
    else {
      const rc = Math.min(d, w / 2 * 0.9); perfil = [[0, 0], [R, 0], [R, w / 2 - rc]];
      for (let i = 1; i < 24; i++) { const a = -Math.PI / 2 + Math.PI * i / 24; perfil.push([R - d * Math.cos(a), w / 2 + rc * Math.sin(a)]); }
      perfil.push([R, w / 2 + rc], [R, w], [0, w]);
    }
    const s = new CrossSection([perfil], 'NonZero'); let m = s.revolve(segmentos(R)); s.delete();
    if (p.cubo > 0) { const rh = Math.max(p.eixo, 3) / 2 + 3; const c = Manifold.cylinder(p.cubo + 0.01, rh, rh, segmentos(rh)).translate([0, 0, w - 0.01]); const u = m.add(c); m.delete(); c.delete(); m = u; }
    if (p.eixo > 0) { const f = Manifold.cylinder(w + p.cubo + 2, p.eixo / 2, p.eixo / 2, segmentos(p.eixo)).translate([0, 0, -1]); const n = m.subtract(f); m.delete(); f.delete(); m = n; }
    return m;
  },
};
