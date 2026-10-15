// Texto 3D: transforma um texto numa lista de contornos 2D por letra, a partir de uma fonte já lida
// pelo opentype.js. As curvas das letras viram trechos retos (mais trechos em curvas maiores).

function achatar(path, passo) {
  const contornos = []; let atual = null, x = 0, y = 0;
  const pt = (px, py) => atual.push([px, -py]);       // o opentype usa Y para baixo
  for (const c of path.commands) {
    if (c.type === 'M') { if (atual && atual.length > 2) contornos.push(atual); atual = []; pt(c.x, c.y); }
    else if (c.type === 'L') pt(c.x, c.y);
    else if (c.type === 'Q') {
      const n = Math.max(2, Math.min(16, Math.ceil(Math.hypot(c.x - x, c.y - y) / passo)));
      for (let i = 1; i <= n; i++) { const t = i / n, a = (1 - t) ** 2, b = 2 * (1 - t) * t, d = t * t; pt(a * x + b * c.x1 + d * c.x, a * y + b * c.y1 + d * c.y); }
    } else if (c.type === 'C') {
      const n = Math.max(3, Math.min(24, Math.ceil(Math.hypot(c.x - x, c.y - y) / passo)));
      for (let i = 1; i <= n; i++) {
        const t = i / n, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, d = 3 * (1 - t) * t * t, e = t ** 3;
        pt(a * x + b * c.x1 + d * c.x2 + e * c.x, a * y + b * c.y1 + d * c.y2 + e * c.y);
      }
    } else if (c.type === 'Z') { if (atual && atual.length > 2) contornos.push(atual); atual = null; }
    if (c.x !== undefined) { x = c.x; y = c.y; }
  }
  if (atual && atual.length > 2) contornos.push(atual);
  // tira o último ponto quando repete o primeiro
  return contornos.map(k => { const [a, b] = [k[0], k.at(-1)]; return Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6 ? k.slice(0, -1) : k; }).filter(k => k.length > 2);
}

// Devolve { letras: [[contorno, ...], ...], min: [x, y], max: [x, y] }; várias linhas com \n, centralizadas.
export function contornosDoTexto(fonte, texto, { tamanho = 10, espacamento = 0, entrelinha = 1.25, passo = 0.35 } = {}) {
  const linhas = String(texto).replace(/\r/g, '').split('\n');
  // "tamanho" é a altura das letras maiúsculas (como o H), não o corpo da fonte
  let cap = fonte.tables?.os2?.sCapHeight;
  if (!cap) { try { cap = fonte.charToGlyph('H').getBoundingBox().y2; } catch {} }
  if (!(cap > 0)) cap = fonte.unitsPerEm * 0.7;
  const corpo = tamanho * fonte.unitsPerEm / cap;
  const escala = corpo / fonte.unitsPerEm;
  const larguras = linhas.map(l => {
    let w = 0; const gs = fonte.stringToGlyphs(l);
    gs.forEach((g, i) => { w += (g.advanceWidth ?? 0) * escala + (i < gs.length - 1 ? espacamento + (fonte.getKerningValue(g, gs[i + 1]) ?? 0) * escala : 0); });
    return w;
  });
  const letras = [];
  linhas.forEach((l, li) => {
    let x = -larguras[li] / 2; const y = -li * corpo * entrelinha;
    const gs = fonte.stringToGlyphs(l);
    gs.forEach((g, i) => {
      const c = achatar(g.getPath(x, -y, corpo), passo);
      if (c.length) letras.push(c);
      x += (g.advanceWidth ?? 0) * escala + espacamento + (i < gs.length - 1 ? (fonte.getKerningValue(g, gs[i + 1]) ?? 0) * escala : 0);
    });
  });
  let min = [Infinity, Infinity], max = [-Infinity, -Infinity];
  for (const l of letras) for (const k of l) for (const [a, b] of k) { min = [Math.min(min[0], a), Math.min(min[1], b)]; max = [Math.max(max[0], a), Math.max(max[1], b)]; }
  return { letras, min, max };
}
