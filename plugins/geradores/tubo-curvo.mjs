// Tubo curvo: trecho reto de entrada, curva de raio e ângulo escolhidos e trecho reto de saída.
// Perfis externo e interno independentes (círculo, quadrado, hexágono; furo pode ser "nenhum" = barra maciça).
export default {
  api: 1, id: 'tubo-curvo', nome: 'Tubo curvo', categoria: 'Geradores', icone: '⌒', cor: '#8e44ad', versao: '1.1.0', ordem: 3,
  descricao: 'Tubo dobrado com entrada e saída retas, perfis à escolha',
  en: { nome: 'Bent pipe', categoria: 'Generators', descricao: 'Bent pipe with straight inlet and outlet, selectable profiles',
    rotulos: { perfil: 'Pipe shape', furo: 'Hole shape', largura: 'Outer width', parede: 'Wall thickness', raio: 'Bend radius (to the pipe center)', angulo: 'Bend angle (°)', entrada: 'Inlet length', saida: 'Outlet length' },
    opcoes: { circulo: 'Circle', quadrado: 'Square', hexagono: 'Hexagon', nenhum: 'None (solid)' } },
  parametros: [
    { chave: 'perfil', rotulo: 'Forma do tubo', tipo: 'opcao', opcoes: [['circulo', 'Círculo'], ['quadrado', 'Quadrado'], ['hexagono', 'Hexágono']], padrao: 'circulo' },
    { chave: 'furo', rotulo: 'Forma do furo', tipo: 'opcao', opcoes: [['circulo', 'Círculo'], ['quadrado', 'Quadrado'], ['hexagono', 'Hexágono'], ['nenhum', 'Nenhum (maciço)']], padrao: 'circulo' },
    { chave: 'largura', rotulo: 'Largura externa', padrao: 20, min: 0.5 },
    { chave: 'parede', rotulo: 'Espessura da parede', padrao: 3, min: 0.2 },
    { chave: 'raio', rotulo: 'Raio da curva (até o centro do tubo)', padrao: 30, min: 0.5 },
    { chave: 'angulo', rotulo: 'Ângulo da curva (°)', padrao: 90, min: 0, max: 360 },
    { chave: 'entrada', rotulo: 'Comprimento de entrada', padrao: 20, min: 0 },
    { chave: 'saida', rotulo: 'Comprimento de saída', padrao: 20, min: 0 },
  ],
  gerar(p, { Manifold, CrossSection, segmentos }) {
    const w = p.largura, Rb = p.raio;
    if (Rb <= w / 2) throw new Error('o raio da curva precisa ser maior que meia largura do tubo');
    if (p.furo !== 'nenhum' && 2 * p.parede >= w) throw new Error('a parede é grossa demais para essa largura');
    const forma = (tipo, larg) => {
      if (tipo === 'quadrado') return CrossSection.square([larg, larg], true);
      if (tipo === 'hexagono') { const r = larg / 2 / Math.cos(Math.PI / 6); return new CrossSection([Array.from({ length: 6 }, (_, i) => [r * Math.cos(i * Math.PI / 3), r * Math.sin(i * Math.PI / 3)])], 'NonZero'); }
      return CrossSection.circle(larg / 2, segmentos(larg / 2));
    };
    const fora = forma(p.perfil, w);
    let secao = fora;
    // o furo nunca atravessa a parede: se a forma do furo for diferente da do tubo, ela é reduzida até
    // caber inteira por dentro com a espessura pedida (ex.: furo sextavado num tubo quadrado de parede fina)
    const raioCanto = { circulo: 1, quadrado: Math.SQRT2, hexagono: 1 / Math.cos(Math.PI / 6) };
    const largFuro = p.furo === p.perfil ? w - 2 * p.parede : (w - 2 * p.parede) / raioCanto[p.furo];
    if (p.furo !== 'nenhum') { const dentro = forma(p.furo, largFuro); secao = fora.subtract(dentro); fora.delete(); dentro.delete(); }
    const partes = [];
    // curva: o perfil, afastado do eixo pelo raio, girado em volta de Z (começa no plano XZ e vai para +Y)
    if (p.angulo > 0) { const s = secao.translate([Rb, 0]); partes.push(s.revolve(Math.max(24, segmentos(Rb + w / 2)), Math.min(360, p.angulo))); s.delete(); }
    const reto = (L, fim) => {
      const e = secao.translate([Rb, 0]).extrude(L);           // ao longo de Z
      const r = e.rotate([fim ? -90 : 90, 0, 0]); e.delete();   // passa a correr ao longo de Y
      if (!fim) return r;
      const g = r.rotate([0, 0, p.angulo]); r.delete(); return g;
    };
    if (p.entrada > 0) partes.push(reto(p.entrada, false));
    if (p.saida > 0 && p.angulo < 360) partes.push(reto(p.saida, true));
    secao.delete();
    if (!partes.length) throw new Error('o tubo ficou sem comprimento');
    const u = Manifold.union(partes); partes.forEach(x => x.delete());
    const b = u.boundingBox(), m = u.translate([-(b.min[0] + b.max[0]) / 2, -(b.min[1] + b.max[1]) / 2, -b.min[2]]); u.delete();
    return m;
  },
};
