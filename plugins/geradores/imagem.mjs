// Imagem → peça 3D. A imagem (PNG, JPG, GIF, BMP…) é guardada em tons de cinza dentro do próprio projeto
// (parâmetro "dados"), e o resto continua editável no painel:
// · Relevo: o escuro sobe (ou o claro, com "Inverter") — desenhos e logotipos escuros em fundo claro saem em relevo;
// · Litofania: placa fina em que o escuro fica mais grosso — contra a luz, mostra a foto;
// · Silhueta: só o contorno (pelo limiar), extrudado com a altura — logotipos, recortes.
const deB64 = s => { const b = atob(s || ''); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
function suavizar(g, w, h, r) {
  if (r <= 0) return g;
  let a = Float32Array.from(g), t = new Float32Array(a.length);
  for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) { let s = 0, c = 0; for (let d = -r; d <= r; d++) { const x = j + d; if (x >= 0 && x < w) { s += a[i * w + x]; c++; } } t[i * w + j] = s / c; }
  for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) { let s = 0, c = 0; for (let d = -r; d <= r; d++) { const y = i + d; if (y >= 0 && y < h) { s += t[y * w + j]; c++; } } a[i * w + j] = s / c; }
  return a;
}
export default {
  api: 1, id: 'imagem', nome: 'Imagem', categoria: 'Geradores', icone: '🖼', cor: '#9c6644', versao: '1.0.0', ordem: 5,
  descricao: 'Peça feita de uma imagem: relevo, litofania ou silhueta (use Arquivo › Importar imagem…)',
  en: { nome: 'Image', categoria: 'Generators', descricao: 'Part made from an image: relief, lithophane or silhouette (use File › Import image…)',
    rotulos: { modo: 'Mode', largura: 'Width (mm)', altura: 'Relief height (mm)', base: 'Base (mm)', inverter: 'Invert', limiar: 'Threshold (silhouette)', suavizar: 'Smoothing' },
    opcoes: { relevo: 'Relief (dark goes up)', litofania: 'Lithophane (dark is thicker)', silhueta: 'Silhouette (outline)' } },
  parametros: [
    { chave: 'modo', rotulo: 'Modo', tipo: 'opcao', opcoes: [['relevo', 'Relevo (o escuro sobe)'], ['litofania', 'Litofania (escuro mais grosso)'], ['silhueta', 'Silhueta (contorno)']], padrao: 'relevo' },
    { chave: 'largura', rotulo: 'Largura (mm)', padrao: 80, min: 5, max: 1000 },
    { chave: 'altura', rotulo: 'Altura do relevo (mm)', padrao: 3, min: 0.2, max: 100, casas: 2 },
    { chave: 'base', rotulo: 'Base (mm)', padrao: 1, min: 0, max: 50, casas: 2 },
    { chave: 'inverter', rotulo: 'Inverter', tipo: 'booleano', padrao: false },
    { chave: 'limiar', rotulo: 'Limiar (silhueta)', padrao: 128, min: 1, max: 254, casas: 0, mostrarSe: { modo: 'silhueta' } },
    { chave: 'suavizar', rotulo: 'Suavizar', padrao: 1, min: 0, max: 6, casas: 0 },
    { chave: 'px', rotulo: 'px', padrao: 2, oculto: true },
    { chave: 'py', rotulo: 'py', padrao: 2, oculto: true },
    { chave: 'dados', rotulo: 'dados', tipo: 'texto', padrao: '/////w==', oculto: true }, // sem imagem: uma placa lisa 2×2 branca
  ],
  gerar(p, { Manifold, CrossSection, Mesh }) {
    const w = Math.round(p.px), h = Math.round(p.py), bruto = deB64(p.dados);
    if (!w || !h || bruto.length < w * h) throw new Error('sem imagem: use Arquivo › Importar imagem…');
    const s = p.largura / w;                    // mm por pixel
    let g = suavizar(bruto, w, h, Math.round(p.suavizar));
    // 0..1, com o claro = 1 (com "Inverter", o escuro = 1)
    const t = i => { const v = g[i] / 255; return p.inverter ? 1 - v : v; };
    if (p.modo === 'silhueta') {
      const lim = p.limiar / 255, ret = [];
      for (let i = 0; i < h; i++) {
        let j = 0;
        while (j < w) {
          while (j < w && !(t(i * w + j) < lim)) j++;       // escuro (abaixo do limiar) = parte da peça
          const ini = j; while (j < w && t(i * w + j) < lim) j++;
          if (j > ini) { const y0 = (h - 1 - i) * s, x0 = ini * s, x1 = j * s; ret.push([[x0, y0], [x1, y0], [x1, y0 + s], [x0, y0 + s]]); }
        }
      }
      if (!ret.length) throw new Error('a silhueta ficou vazia: ajuste o limiar ou use "Inverter"');
      const cs = new CrossSection(ret, 'Positive'), simp = cs.simplify(s * 0.05); cs.delete();
      const alt = Math.max(0.2, p.altura + p.base), m = simp.extrude(alt); simp.delete();
      const r = m.translate([-w * s / 2, -h * s / 2, 0]); m.delete(); return r;
    }
    // relevo / litofania: superfície de alturas em cima, fundo plano, paredes nas bordas
    const z = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) z[i] = p.base + p.altura * (1 - t(i)); // o escuro fica mais alto/grosso
    const N = w * h, vert = new Float32Array(N * 2 * 3), x0 = -(w - 1) * s / 2, y0 = (h - 1) * s / 2;
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
      const k = i * w + j, X = x0 + j * s, Y = y0 - i * s;
      vert.set([X, Y, Math.max(0.05, z[k])], k * 3); vert.set([X, Y, 0], (N + k) * 3);
    }
    const tri = [], top = (i, j) => i * w + j, bot = (i, j) => N + i * w + j;
    for (let i = 0; i < h - 1; i++) for (let j = 0; j < w - 1; j++) {
      const a = top(i, j), b = top(i, j + 1), c = top(i + 1, j), d = top(i + 1, j + 1);
      tri.push(a, c, b, b, c, d);                         // em cima (normal +Z; Y cresce para cima na peça)
      const A = bot(i, j), B = bot(i, j + 1), C = bot(i + 1, j), D = bot(i + 1, j + 1);
      tri.push(A, B, C, B, D, C);                         // embaixo (normal −Z)
    }
    const parede = (p1, p2, q1, q2) => tri.push(p1, q1, p2, p2, q1, q2);
    for (let j = 0; j < w - 1; j++) { parede(top(0, j + 1), top(0, j), bot(0, j + 1), bot(0, j)); parede(top(h - 1, j), top(h - 1, j + 1), bot(h - 1, j), bot(h - 1, j + 1)); }
    for (let i = 0; i < h - 1; i++) { parede(top(i, 0), top(i + 1, 0), bot(i, 0), bot(i + 1, 0)); parede(top(i + 1, w - 1), top(i, w - 1), bot(i + 1, w - 1), bot(i, w - 1)); }
    const mesh = new Mesh({ numProp: 3, vertProperties: vert, triVerts: new Uint32Array(tri) });
    const m = new Manifold(mesh);
    if (m.isEmpty() || m.status?.() && m.status() !== 'NoError') throw new Error('não foi possível montar a superfície');
    return m;
  },
};
