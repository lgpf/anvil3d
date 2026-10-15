// Texto 3D: plano (deitado), em pé, ou curvado em volta de um cilindro — para relevo ou para gravar
// (marque a peça como Furo e coloque no mesmo centro do cilindro).
export default {
  api: 1, id: 'texto', nome: 'Texto', categoria: 'Básicos', icone: 'T', cor: '#c0392b', versao: '1.0.0',
  descricao: 'Texto em 3D, deitado, em pé ou curvado em volta de um cilindro',
  en: {
    nome: 'Text', categoria: 'Basic', descricao: '3D text, lying flat, standing or wrapped around a cylinder',
    rotulos: { texto: 'Text', fonte: 'Font', tamanho: 'Letter height (mm)', espessura: 'Thickness / depth (mm)', espacamento: 'Letter spacing (mm)', forma: 'Shape', raio: 'Cylinder radius (mm)', lado: 'Direction on the cylinder' },
    opcoes: { plano: 'Flat (lying)', 'em-pe': 'Standing', cilindro: 'Around a cylinder', fora: 'Outward (relief)', dentro: 'Inward (to engrave, as a hole)' },
  },
  parametros: [
    { chave: 'texto', rotulo: 'Texto', tipo: 'texto', multilinha: true, padrao: 'Anvil3D' },
    { chave: 'fonte', rotulo: 'Fonte', tipo: 'fonte', padrao: 'DejaVu Sans Bold' },
    { chave: 'tamanho', rotulo: 'Altura das letras (mm)', padrao: 10, min: 0.5 },
    { chave: 'espessura', rotulo: 'Espessura / profundidade (mm)', padrao: 3, min: 0.1 },
    { chave: 'espacamento', rotulo: 'Espaço entre letras (mm)', padrao: 0 },
    { chave: 'forma', rotulo: 'Forma', tipo: 'opcao', opcoes: [['plano', 'Plano (deitado)'], ['em-pe', 'Em pé'], ['cilindro', 'Em volta de um cilindro']], padrao: 'plano' },
    { chave: 'raio', rotulo: 'Raio do cilindro (mm)', padrao: 20, min: 1 },
    { chave: 'lado', rotulo: 'Sentido no cilindro', tipo: 'opcao', opcoes: [['fora', 'Para fora (relevo)'], ['dentro', 'Para dentro (gravar, como furo)']], padrao: 'fora' },
  ],
  gerar(p, { Manifold, CrossSection, texto }) {
    const t = String(p.texto ?? '').trim();
    if (!t) throw new Error('escreva algum texto');
    const { letras, min, max } = texto(p.fonte, p.texto, { tamanho: p.tamanho, espacamento: p.espacamento });
    if (!letras.length) throw new Error('a fonte não tem desenho para esses caracteres');
    const cx = (min[0] + max[0]) / 2, cy = (min[1] + max[1]) / 2;
    const secoes = letras.map(c => new CrossSection(c, 'EvenOdd'));
    const s0 = CrossSection.union(secoes); secoes.forEach(x => x.delete());
    const s = s0.translate([-cx, -cy]); s0.delete();
    const altura = max[1] - min[1], largura = max[0] - min[0];
    let m;
    if (p.forma === 'plano') m = s.extrude(p.espessura);
    else if (p.forma === 'em-pe') {
      const e = s.extrude(p.espessura); m = e.rotate([90, 0, 0]).translate([0, p.espessura / 2, altura / 2]); e.delete();
    } else {
      const R = p.raio;
      if (largura > 2 * Math.PI * R * 0.98) throw new Error('o texto é maior que a volta do cilindro: aumente o raio ou diminua o texto');
      // fatia lisa: (x, y, z) da extrusão vira ângulo, altura e distância ao eixo
      const dentro = p.lado === 'dentro';
      const r0 = dentro ? R - p.espessura : R - Math.min(0.3, p.espessura / 3);
      const esp = dentro ? p.espessura + 1 : p.espessura + Math.min(0.3, p.espessura / 3);
      const e = s.extrude(esp), fino = e.refineToLength(Math.max(0.3, R * 0.03)); e.delete();
      m = fino.warp(v => {
        const ang = v[0] / R, rr = r0 + v[2], h = v[1] + altura / 2;
        v[0] = rr * Math.sin(ang); v[1] = -rr * Math.cos(ang); v[2] = h;
      });
      fino.delete();
      if (m.volume() < 0) { const n = m.mirror([1, 0, 0]); m.delete(); m = n; }
    }
    s.delete();
    return m;
  },
};
