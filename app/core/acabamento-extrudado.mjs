// Chanfro e fillet em peças extrudadas (texto, SVG, polígonos, estrelas…): em vez de uma ferramenta por
// aresta, o acabamento sai direto do contorno 2D da peça.
//  - arestas verticais: os cantos do contorno são arredondados (fillet) ou cortados (chanfro);
//  - arestas do topo/da base: o contorno é encolhido camada a camada seguindo o perfil do acabamento, e
//    cada camada é ligada à seguinte por uma superfície reta (régua), sem degraus.
// Como tudo vem de contornos contínuos, não há emendas entre ferramentas nem vértices de três arestas
// para dar errado. Só vale quando a peça é um prisma em Z e as arestas marcadas formam grupos inteiros
// (todas do topo, todas da base, todas as verticais); fora disso o método aresta por aresta continua.

const TOL = 1e-4, SOBREPOE = 1e-3;

// A peça é um prisma vertical? Devolve { contorno, z0, z1 } ou null.
function prisma(wasm, base) {
  const b = base.boundingBox(), z0 = b.min[2], z1 = b.max[2], H = z1 - z0;
  if (H < 1e-3) return null;
  const meio = base.slice((z0 + z1) / 2), area = meio.area();
  if (area < 1e-6) { meio.delete(); return null; }
  const vol = base.volume();
  if (Math.abs(vol - area * H) > Math.max(1e-3, vol * 2e-4)) { meio.delete(); return null; }
  // confere também perto do topo e da base (um furo que não atravessa quebraria a conta acima só às vezes)
  for (const z of [z0 + H * 0.02, z1 - H * 0.02]) { const s = base.slice(z), ok = Math.abs(s.area() - area) < area * 1e-4 + 1e-6; s.delete(); if (!ok) { meio.delete(); return null; } }
  return { contorno: meio, z0, z1 };
}

// Quais grupos de arestas foram marcados? null se a seleção não é de grupos inteiros.
function grupos(feicoes, indices, z0, z1) {
  const H = z1 - z0, perto = (a, b) => Math.abs(a - b) < Math.max(TOL, H * 1e-4);
  const grupo = f => {
    if (f.tipo === 'reta') {
      if (perto(f.a[2], z1) && perto(f.b[2], z1)) return 'topo';
      if (perto(f.a[2], z0) && perto(f.b[2], z0)) return 'base';
      const dz = Math.abs(f.a[2] - f.b[2]), dxy = Math.hypot(f.a[0] - f.b[0], f.a[1] - f.b[1]);
      if (dxy < dz * 1e-3 && dz > H * 0.999) return 'verticais';
      return null;
    }
    if (f.tipo === 'circulo') {
      if (f.pontos.every(p => perto(p[2], z1))) return 'topo';
      if (f.pontos.every(p => perto(p[2], z0))) return 'base';
    }
    return null;
  };
  const total = { topo: 0, base: 0, verticais: 0 }, marc = { topo: 0, base: 0, verticais: 0 };
  feicoes.forEach(f => { const g = grupo(f); if (g) total[g]++; });
  for (const i of indices) { const g = grupo(feicoes[i]); if (!g) return null; marc[g]++; }
  const r = {};
  for (const g of Object.keys(total)) {
    if (!marc[g]) continue;
    if (marc[g] < total[g]) return null; // grupo pela metade: fica com o método aresta por aresta
    r[g] = true;
  }
  return Object.keys(r).length ? r : null;
}

// quanto o contorno entra na profundidade h (0 = na face, m = onde o acabamento termina)
const recuo = (modo, m, h) => modo === 'chanfro' ? m - h : m - Math.sqrt(Math.max(0, m * m - (m - h) * (m - h)));

// Cantos do contorno (as arestas verticais): cada canto vivo vira um arco (fillet) ou um corte reto
// (chanfro). O recuo de cada canto é limitado pelo tamanho das arestas vizinhas, para que partes finas
// (o pingo do i, hastes estreitas) não sumam como sumiriam num simples "abrir e fechar" do contorno.
function cantosArredondados(wasm, C, modo, r, segmentos) {
  const vivo = Math.cos((180 - 40) * Math.PI / 180); // dobra maior que 40° = canto de verdade (dobras menores, como o fim de uma curva, ficam como estão)
  const novos = [];
  for (const P of C.toPolygons()) {
    const n = P.length, out = [];
    for (let i = 0; i < n; i++) {
      const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n];
      const u = [a[0] - b[0], a[1] - b[1]], w = [c[0] - b[0], c[1] - b[1]], lu = Math.hypot(...u), lw = Math.hypot(...w);
      if (lu < 1e-9 || lw < 1e-9) { out.push(b); continue; }
      const cosA = (u[0] * w[0] + u[1] * w[1]) / (lu * lw); // ângulo entre as duas arestas no vértice
      if (cosA < vivo) { out.push(b); continue; }          // quase reto (curva suave): fica como está
      // canto para dentro: fica para o "fechar" do contorno logo abaixo (feito pelo Manifold, sem dobras)
      if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < 0) { out.push(b); continue; }
      // canto vivo encostado numa curva (arestas vizinhas curtinhas, como onde o arco de dentro do n encontra
      // a haste): o corte ficaria minúsculo e deixava um dente no acabamento de cima; o canto fica vivo
      if (Math.min(lu, lw) < r * 0.6) { out.push(b); continue; }
      // canto para fora colado num canto para dentro (o topo da haste do n, logo ao lado do vão do arco):
      // cortar ali deixava um dente entre o corte e o vão; o canto fica vivo
      const cantoDentro = j => { const pa = P[(j - 1 + n) % n], pb = P[j], pc = P[(j + 1) % n]; const e1 = [pb[0] - pa[0], pb[1] - pa[1]], e2 = [pc[0] - pb[0], pc[1] - pb[1]]; const l = (Math.hypot(...e1) * Math.hypot(...e2)) || 1; return (e1[0] * e2[1] - e1[1] * e2[0]) / l < -Math.sin(30 * Math.PI / 180); };
      let dentroPerto = false;
      for (const passo of [1, -1]) { // anda pelo contorno até 4× a medida para cada lado, procurando um canto para dentro
        let dist = 0, j = i;
        for (let k = 0; k < n && dist < r * 4 && !dentroPerto; k++) { const jn = (j + passo + n) % n; dist += Math.hypot(P[jn][0] - P[j][0], P[jn][1] - P[j][1]); j = jn; if (dist < r * 4 && cantoDentro(j)) dentroPerto = true; }
      }
      if (dentroPerto) { out.push(b); continue; }
      const ang = Math.acos(Math.max(-1, Math.min(1, cosA)));
      let t = modo === 'chanfro' ? r : r / Math.tan(ang / 2);
      t = Math.min(t, lu * 0.49, lw * 0.49);
      const ua = [u[0] / lu, u[1] / lu], wa = [w[0] / lw, w[1] / lw];
      const p1 = [b[0] + ua[0] * t, b[1] + ua[1] * t], p2 = [b[0] + wa[0] * t, b[1] + wa[1] * t];
      if (modo === 'chanfro') { out.push(p1, p2); continue; }
      const re = t * Math.tan(ang / 2), bis = [ua[0] + wa[0], ua[1] + wa[1]], lb = Math.hypot(...bis);
      const cc = [b[0] + bis[0] / lb * re / Math.sin(ang / 2), b[1] + bis[1] / lb * re / Math.sin(ang / 2)];
      let a1 = Math.atan2(p1[1] - cc[1], p1[0] - cc[0]), a2 = Math.atan2(p2[1] - cc[1], p2[0] - cc[0]);
      let da = a2 - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const k = Math.max(2, Math.ceil(segmentos(re) * Math.abs(da) / (2 * Math.PI)));
      for (let j = 0; j <= k; j++) { const q = a1 + da * j / k; out.push([cc[0] + re * Math.cos(q), cc[1] + re * Math.sin(q)]); }
    }
    novos.push(out);
  }
  // Só os cantos para fora são arredondados/cortados. Os cantos para dentro (o encontro da haste com o
  // arco do n, o bico do meio do 3) ficam vivos: neles o acabamento vertical teria de ENCHER um vão em
  // cunha, e qualquer forma de fazer isso deixava espinhos ou tampava o vão.
  return new wasm.CrossSection(novos, 'Positive');
}

export function acabamentoExtrudado(wasm, base, feicoes, indices, modo, medida, segmentos) {
  const p = prisma(wasm, base);
  if (!p) return null;
  const g = grupos(feicoes, indices, p.z0, p.z1);
  if (!g) { p.contorno.delete(); return null; }
  const H = p.z1 - p.z0, faces = (g.topo ? 1 : 0) + (g.base ? 1 : 0);
  const m = Math.min(medida, faces ? H / faces * 0.98 : medida);
  let C = p.contorno;
  if (g.verticais) {
    // cantos do contorno (as arestas verticais): cada canto vivo vira um arco (fillet) ou um corte reto
    // (chanfro). O recuo de cada canto é limitado pelo tamanho das arestas vizinhas, para que partes finas
    // (o pingo do i, hastes estreitas) não sumam como sumiriam num simples "abrir e fechar" do contorno.
    const D = cantosArredondados(wasm, C, modo, medida, segmentos);
    // (antes aqui o contorno crescia e encolhia 1 µm para fechar frestas; nos cantos muito fechados isso
    // cortava a ponta do canto e era o "dentinho" no arco de dentro do n)
    C.delete(); C = D;
    if (C.isEmpty()) { C.delete(); return null; }
  }
  // Um prisma só, em camadas. Cada vértice recua pela direção de meia-esquadria conforme a profundidade
  // da camada; como todas as camadas têm os mesmos vértices, as paredes saem retas entre uma camada e a
  // outra, sem degraus e sem emendas.
  const n = modo === 'chanfro' ? 6 : Math.max(12, Math.min(32, Math.ceil(segmentos(m) / 3)));
  const prof = t => modo === 'chanfro' ? m * t : m * Math.sin(t * Math.PI / 2); // t=0 na face, 1 no fim do acabamento
  const niveis = [];                                                            // [z, recuo] de baixo para cima
  if (g.base) for (let i = 0; i <= n; i++) { const h = prof(i / n); niveis.push([p.z0 + h, recuo(modo, m, h)]); }
  else niveis.push([p.z0, 0]);
  if (g.topo) for (let i = n; i >= 0; i--) { const h = prof(i / n); niveis.push([p.z1 - h, recuo(modo, m, h)]); }
  else niveis.push([p.z1, 0]);
  // Cada camada é o contorno encolhido pelo próprio Manifold (offset: um contorno sempre válido, que nunca
  // "dá nó" nem se cruza). Duas camadas seguidas são costuradas por uma faixa de triângulos que anda pelos
  // dois contornos ao mesmo tempo (como um zíper), então elas não precisam ter o mesmo número de vértices.
  // Cada faixa usa exatamente o contorno da camada de baixo e o da de cima, e por isso as faixas se encaixam
  // umas nas outras sem frestas.
  // A medida cabe na peça? Se encolher o contorno pela medida faz alguma parte sumir ou se dividir (hastes
  // mais finas que 2× a medida), o acabamento ali vira uma crista e pode sair com defeitos. Nesse caso
  // calcula a maior medida que ainda cabe, para o aviso no painel.
  let medidaSegura = null;
  if (faces) {
    const partes = d => { const o = C.offset(-d, 'Miter', 4), n = o.decompose(); const k = n.length; n.forEach(x => x.delete()); o.delete(); return k; };
    const n0 = partes(0);
    if (partes(m * 0.98) !== n0) {
      let lo = 0, hi = m;
      for (let i = 0; i < 8; i++) { const md = (lo + hi) / 2; if (partes(md * 0.98) === n0) lo = md; else hi = md; }
      medidaSegura = Math.floor(lo * 0.7 * 20) / 20; // com folga: perto do limite as cristas ainda saem estranhas
    }
  }
  // recuo do contorno em cada altura (o acabamento de cima e o de baixo, se houver)
  const dDe = z => Math.max(g.topo && p.z1 - z < m ? recuo(modo, m, Math.max(0, p.z1 - z)) : 0, g.base && z - p.z0 < m ? recuo(modo, m, Math.max(0, z - p.z0)) : 0);
  // cada camada guarda suas regiões: um contorno externo com os furos dele
  const camada = z => {
    const d = dDe(z), o = d > 1e-9 ? C.offset(-d, 'Miter', 4) : C.translate([0, 0]);
    const regioes = o.decompose().map(pc => {
      const aneis = pc.toPolygons().filter(P => P.length >= 3 && Math.abs(areaPol(P)) > 1e-10).map(P => ({ P, area: areaPol(P), c: centroPol(P) }));
      pc.delete();
      const ext = aneis.reduce((x, r) => (r.area > (x?.area ?? 0) ? r : x), null);
      return ext ? { ext, furos: aneis.filter(r => r !== ext), todos: aneis } : null;
    }).filter(Boolean);
    o.delete(); return { z, regioes };
  };
  const pecas = [], zMin = m / 32;
  // Uma faixa entre as camadas A e B. Onde a forma muda entre elas (uma haste fina some, uma parte se
  // divide), a faixa é dividida ao meio até ficar bem fina: o degrau que sobra nesses pontos é mínimo.
  const faixaEntre = (A, B, primeira) => {
    if (B.z - A.z < 1e-9 || !A.regioes.length) return;
    const e0 = primeira ? 0 : SOBREPOE; // cada faixa entra um fio (1 µm) na de baixo, para a união não deixar fresta
    // cada região de cima escolhe a de baixo mais perto; uma região de baixo só é costurada se tiver
    // exatamente uma de cima e os mesmos furos (cada furo com o seu par)
    const dono = B.regioes.map(rb => { let k = -1, dm = Infinity; A.regioes.forEach((ra, i) => { const d = Math.hypot(ra.ext.c[0] - rb.ext.c[0], ra.ext.c[1] - rb.ext.c[1]); if (d < dm) { dm = d; k = i; } }); return k; });
    const pares = [], degraus = [];
    // e cada região de baixo escolhe a de cima mais perto: só vira par quem se escolhe dos dois lados
    // (quando uma parte se junta ou se divide, o par não é mútuo e essa parte sobe reta)
    const prox = A.regioes.map(ra => { let k = -1, dm = Infinity; B.regioes.forEach((rb, j) => { const d = Math.hypot(ra.ext.c[0] - rb.ext.c[0], ra.ext.c[1] - rb.ext.c[1]); if (d < dm) { dm = d; k = j; } }); return k; });
    A.regioes.forEach((ra, i) => {
      const fs = dono.map((d, j) => d === i ? j : -1).filter(j => j >= 0);
      const mutuo = fs.length === 1 && prox[i] === fs[0] && prox.filter(x => x === fs[0]).length === 1;
      const rb = mutuo ? B.regioes[fs[0]] : null;
      if (!rb || rb.furos.length !== ra.furos.length) { degraus.push(ra); return; }
      const usados = new Set(), pf = [];
      for (const fa of ra.furos) { let k = -1, dm = Infinity; rb.furos.forEach((fb, j) => { if (usados.has(j)) return; const d = Math.hypot(fa.c[0] - fb.c[0], fa.c[1] - fb.c[1]); if (d < dm) { dm = d; k = j; } }); if (k < 0) break; usados.add(k); pf.push([fa, rb.furos[k]]); }
      if (pf.length !== ra.furos.length) { degraus.push(ra); return; }
      pares.push([[ra.ext, rb.ext], ...pf]);
    });
    if (degraus.length && B.z - A.z > zMin) { // divide e tenta de novo
      const M = camada((A.z + B.z) / 2);
      faixaEntre(A, M, primeira); faixaEntre(M, B, false);
      return;
    }
    for (const grupo of pares) {
      const r = costurar(wasm, grupo, A.z - e0, B.z);
      if (r) pecas.push(r); else degraus.push({ todos: grupo.map(([a]) => a) });
    }
    if (degraus.length) {
      const cs = new wasm.CrossSection(degraus.flatMap(r => r.todos.map(a => a.P)), 'Positive'), e = cs.extrude(B.z - A.z + e0); cs.delete();
      pecas.push(e.translate([0, 0, A.z - e0])); e.delete();
    }
  };
  const camadas = niveis.map(([z]) => camada(z));
  for (let l = 0; l + 1 < camadas.length; l++) faixaEntre(camadas[l], camadas[l + 1], l === 0);
  C.delete();
  if (!pecas.length) return null;
  let r = wasm.Manifold.union(pecas); pecas.forEach(x => x.delete());
  if (r.isEmpty() || r.status() !== 'NoError' || r.volume() <= 0) { r.delete(); return null; }
  // lascas soltas minúsculas (onde uma haste fina some no meio de uma camada) são descartadas
  const partes = r.decompose();
  if (partes.length > 1) {
    const vol = partes.map(x => x.volume()), maior = Math.max(...vol), ficam = partes.filter((x, k) => vol[k] > maior * 0.002);
    if (ficam.length < partes.length) { const n = wasm.Manifold.union(ficam); r.delete(); r = n; }
  }
  partes.forEach(x => x.delete());
  if (medidaSegura !== null) r.medidaSegura = medidaSegura;
  // limpeza: junta vértices quase iguais e tira triângulos sem área (lâminas de espessura zero)
  try { const lim = r.simplify(1e-4); if (!lim.isEmpty() && Math.abs(lim.volume() - r.volume()) < r.volume() * 1e-3) { lim.medidaSegura = r.medidaSegura; r.delete(); r = lim; } else lim.delete(); } catch {}
  return r;
}

const centroPol = P => P.reduce((s, p) => [s[0] + p[0] / P.length, s[1] + p[1] / P.length], [0, 0]);
// faixa entre os contornos de baixo (za) e de cima (zb), mais as duas tampas
function costurar(wasm, pares, za, zb) {
  if (!pares.length) return null;
  const pos = [], tri = [], baixo = [], cima = [];
  for (const [a, b] of pares) {
    // a costura começa (e termina) no meio da aresta mais comprida do contorno de baixo: é onde a emenda
    // do começo com o fim fica mais tranquila (começando num canto ou numa curva fechada sobrava um dente)
    let maior = 0, kM = 0;
    a.P.forEach((q, k) => { const r = a.P[(k + 1) % a.P.length], l = Math.hypot(r[0] - q[0], r[1] - q[1]); if (l > maior) { maior = l; kM = k; } });
    const qM = a.P[kM], rM = a.P[(kM + 1) % a.P.length];
    const A = [[(qM[0] + rM[0]) / 2, (qM[1] + rM[1]) / 2], ...a.P.slice(kM + 1), ...a.P.slice(0, kM + 1)], n = A.length;
    // o contorno de cima começa no ponto mais perto do começo do de baixo
    // o contorno de cima passa a começar exatamente no ponto dele mais perto do começo do de baixo (um
    // vértice novo é criado ali se preciso). Antes ele começava num vértice já existente, que numa parede
    // reta comprida (a perna do D) podia ficar milímetros adiante e entortava a parede inteira.
    let k0 = 0, u0 = 0, dm = Infinity;
    b.P.forEach((q, k) => {
      const r = b.P[(k + 1) % b.P.length], ab = [r[0] - q[0], r[1] - q[1]], l2 = ab[0] * ab[0] + ab[1] * ab[1] || 1;
      const u = Math.max(0, Math.min(1, ((A[0][0] - q[0]) * ab[0] + (A[0][1] - q[1]) * ab[1]) / l2));
      const d = Math.hypot(q[0] + ab[0] * u - A[0][0], q[1] + ab[1] * u - A[0][1]); if (d < dm) { dm = d; k0 = k; u0 = u; }
    });
    const P0 = b.P[k0], P1 = b.P[(k0 + 1) % b.P.length], inicio = [P0[0] + (P1[0] - P0[0]) * u0, P0[1] + (P1[1] - P0[1]) * u0];
    let B = [inicio, ...b.P.slice(k0 + 1), ...b.P.slice(0, k0 + 1)];
    B = B.filter((q, i) => i === 0 || Math.hypot(q[0] - B[i - 1][0], q[1] - B[i - 1][1]) > 1e-7);
    if (Math.hypot(B.at(-1)[0] - B[0][0], B.at(-1)[1] - B[0][1]) < 1e-7) B.pop();
    const m = B.length;
    const ia = pos.length / 3; for (const q of A) pos.push(q[0], q[1], za);
    const ib = pos.length / 3; for (const q of B) pos.push(q[0], q[1], zb);
    baixo.push([A, ia]); cima.push([B, ib]);
    // zíper: os dois contornos são percorridos juntos pela fração do comprimento (de 0 a 1, a partir dos
    // começos alinhados); a cada passo avança o que estiver mais atrasado. Assim a faixa nunca "pula"
    // de um lado para o outro de uma reentrância (como a barriga do 3) mesmo com densidades diferentes.
    const frac = P => { const f = [0]; let t = 0; for (let k = 0; k < P.length; k++) { const a = P[k], b = P[(k + 1) % P.length]; t += Math.hypot(b[0] - a[0], b[1] - a[1]); f.push(t); } return f.map(x => x / (t || 1)); };
    const fb = frac(B);
    // em vez da fração do próprio comprimento, cada vértice de baixo usa a posição do ponto do contorno de
    // cima que fica mais perto dele (andando sempre para a frente). Quando o contorno encolhe de forma
    // desigual (o arco de dentro do n, a barriga do 3), a costura continua ligando pontos vizinhos.
    // cada vértice de baixo usa a posição (fração do comprimento) do ponto do contorno de cima mais perto
    // dele, sem limite de janela; a posição é "desenrolada" para perto da anterior e nunca volta para trás
    const fa = [0];
    let tAnt = 0;
    for (let i = 1; i < n; i++) {
      const p0 = A[i]; let melhor = tAnt, dm = Infinity;
      for (let k = 0; k < m; k++) {
        const a = B[k], b2 = B[(k + 1) % m], ab = [b2[0] - a[0], b2[1] - a[1]], l2 = ab[0] * ab[0] + ab[1] * ab[1] || 1;
        const u = Math.max(0, Math.min(1, ((p0[0] - a[0]) * ab[0] + (p0[1] - a[1]) * ab[1]) / l2));
        const d = Math.hypot(a[0] + ab[0] * u - p0[0], a[1] + ab[1] * u - p0[1]); if (d < dm) { dm = d; melhor = fb[k] + (fb[k + 1] - fb[k]) * u; }
      }
      while (melhor < tAnt - 0.5) melhor += 1;
      while (melhor > tAnt + 0.5) melhor -= 1;
      melhor = Math.min(1, Math.max(tAnt, melhor));
      fa.push(melhor); tAnt = melhor;
    }
    fa.push(1);
    let i = 0, j = 0;
    while (i < n || j < m) {
      const avancaA = j >= m || (i < n && fa[i + 1] <= fb[j + 1]);
      if (avancaA) { tri.push(ia + i % n, ia + (i + 1) % n, ib + j % m); i++; }
      else { tri.push(ia + i % n, ib + (j + 1) % m, ib + j % m); j++; }
    }
  }
  try {
    const tampa = (aneis, inverte) => {
      const t = wasm.triangulate(aneis.map(([r]) => r), 1e-7), mapa = [];
      for (const [r, i0] of aneis) for (let i = 0; i < r.length; i++) mapa.push(i0 + i);
      for (const [x, y, z] of t) inverte ? tri.push(mapa[x], mapa[z], mapa[y]) : tri.push(mapa[x], mapa[y], mapa[z]);
    };
    tampa(baixo, true); tampa(cima, false);
    const r = new wasm.Manifold(new wasm.Mesh({ numProp: 3, vertProperties: new Float32Array(pos), triVerts: new Uint32Array(tri) }));
    if (r.isEmpty() || r.volume() <= 0) { r.delete(); return null; }
    return r;
  } catch { return null; }
}

const areaPol = P => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };

