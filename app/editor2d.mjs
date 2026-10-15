// Editor 2D de perfis para geradores com parâmetro do tipo 'pontos' e "editor".
//   modo 'revolucao': perfil (r, z) ao lado de um eixo vertical; r nunca fica negativo.
//   modo 'plano':     polígono livre (x, y) em torno da origem.
// Ferramentas: Reta (clique põe um canto), Curva (clique põe um ponto suave), Livre (arraste desenha),
// Editar (arraste move pontos; duplo clique troca canto/suave; botão direito ou Del apaga).
// O desenho (pontos de controle) fica guardado junto do objeto para poder ser editado de novo.

export function amostrarPerfil(pts, modo) {
  const n = pts.length, out = [];
  if (n < 2) return pts.map(p => [p.x, p.y]);
  const P = i => pts[(i + n) % n];
  for (let i = 0; i < n; i++) {
    const a = P(i), b = P(i + 1);
    out.push([a.x, a.y]);
    if (!a.s && !b.s) continue;
    const p0 = P(i - 1), p3 = P(i + 2);
    // Catmull-Rom; nos cantos a tangente é zerada para a curva sair reta do canto
    const t1 = a.s ? [(b.x - p0.x) / 2, (b.y - p0.y) / 2] : [0, 0];
    const t2 = b.s ? [(p3.x - a.x) / 2, (p3.y - a.y) / 2] : [0, 0];
    const passos = Math.max(4, Math.min(24, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 1.2)));
    for (let k = 1; k < passos; k++) {
      const t = k / passos, t2_ = t * t, t3 = t2_ * t;
      const h1 = 2 * t3 - 3 * t2_ + 1, h2 = -2 * t3 + 3 * t2_, h3 = t3 - 2 * t2_ + t, h4 = t3 - t2_;
      out.push([h1 * a.x + h2 * b.x + h3 * t1[0] + h4 * t2[0], h1 * a.y + h2 * b.y + h3 * t1[1] + h4 * t2[1]]);
    }
  }
  return out.map(([x, y]) => [Math.round((modo === 'revolucao' ? Math.max(0, x) : x) * 1000) / 1000, Math.round(y * 1000) / 1000]);
}
export const textoDoPerfil = pts => pts.map(([x, y]) => `${x},${y}`).join('\n');

function simplificar(pts, tol) { // Ramer–Douglas–Peucker
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let iMax = 0, dMax = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    const d = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / l;
    if (d > dMax) { dMax = d; iMax = i; }
  }
  if (dMax <= tol) return [a, b];
  return [...simplificar(pts.slice(0, iMax + 1), tol).slice(0, -1), ...simplificar(pts.slice(iMax), tol)];
}

export function abrirEditor2D({ modo, controle, tr, el, abrirModal, fecharModal, aoAplicar, decimal }) {
  let pts = (controle ?? []).map(p => ({ x: +p.x, y: +p.y, s: !!p.s }));
  let ferramenta = 'reta', passo = Number(localStorage.getItem('passo2d') ?? 1), sel = -1, hover = -1;
  const pilha = [];
  const guardar = () => { pilha.push(JSON.stringify(pts)); if (pilha.length > 200) pilha.shift(); };

  const tela = el('canvas', { class: 'editor2d-tela', width: 800, height: 520, tabindex: '0' });
  const ctx = tela.getContext('2d');
  const coords = el('span', { class: 'editor2d-coords' }, '');
  const btnF = {};
  const barra = el('div', { class: 'editor2d-barra' },
    el('div', { class: 'segmentado' }, ...[['reta', tr('Reta')], ['curva', tr('Curva')], ['livre', tr('Livre')], ['editar', tr('Editar')]].map(([f, r]) =>
      (btnF[f] = el('button', { onclick: () => { ferramenta = f; atualizarBarra(); } }, r)))),
    el('button', { onclick: () => { if (pilha.length) { pts = JSON.parse(pilha.pop()); sel = -1; desenhar(); } } }, tr('Desfazer')),
    el('button', { onclick: () => { guardar(); pts = []; sel = -1; desenhar(); } }, tr('Limpar')),
    el('label', {}, tr('Grade'), ' ', (() => {
      const s = el('select', { onchange: e => { passo = +e.target.value; localStorage.setItem('passo2d', passo); } },
        ...[[0, tr('livre')], [0.5, '0,5 mm'], [1, '1 mm'], [2, '2 mm'], [5, '5 mm']].map(([v, r]) => el('option', { value: v, selected: v === passo }, r)));
      return s;
    })()),
    coords);
  const dica = el('p', { class: 'dica' }, tr('Reta e Curva: clique para pôr pontos (cantos ou suaves); clicando em cima de uma linha, o ponto entra nela. Livre: arraste para desenhar. Em qualquer ferramenta dá para arrastar um ponto; duplo clique troca canto/suave; botão direito ou Del apaga. Roda: zoom; botão do meio: mover a vista.')
    + (modo === 'revolucao' ? ' ' + tr('A linha azul é o eixo de giro: o perfil fica à direita dele.') : ''));
  const rodape = el('div', { class: 'botoes' },
    el('button', { onclick: () => fecharModal() }, tr('Cancelar')),
    el('button', { class: 'primario', onclick: () => {
      if (pts.length < 3) return alert(tr('O perfil precisa de pelo menos 3 pontos.'));
      aoAplicar(pts.map(p => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000, s: p.s })));
      fecharModal();
    } }, tr('Aplicar')));
  function atualizarBarra() { for (const [f, b] of Object.entries(btnF)) b.classList.toggle('ativo', f === ferramenta); }
  atualizarBarra();

  // vista: escala (px por mm) e origem na tela
  let esc = 6, ox = 0, oy = 0;
  function enquadrar() {
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    let [x0, x1, y0, y1] = pts.length ? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] : [0, 40, 0, 40];
    if (modo === 'revolucao') x0 = Math.min(x0, 0);
    if (modo === 'plano' && !pts.length) { x0 = -30; x1 = 30; y0 = -25; y1 = 25; }
    const w = Math.max(x1 - x0, 10), h = Math.max(y1 - y0, 10);
    esc = Math.min((tela.width - 80) / w, (tela.height - 80) / h);
    ox = tela.width / 2 - ((x0 + x1) / 2) * esc; oy = tela.height / 2 + ((y0 + y1) / 2) * esc;
  }
  const paraTela = (x, y) => [ox + x * esc, oy - y * esc];
  window.__editor2d = { get pts() { return pts; }, paraTela: (x, y) => paraTela(x, y), tela: () => tela };
  const doEvento = e => {
    const r = tela.getBoundingClientRect(), sx = (e.clientX - r.left) * tela.width / r.width, sy = (e.clientY - r.top) * tela.height / r.height;
    return { sx, sy, x: (sx - ox) / esc, y: (oy - sy) / esc };
  };
  const encaixar = (x, y) => {
    if (passo > 0) { x = Math.round(x / passo) * passo; y = Math.round(y / passo) * passo; }
    if (modo === 'revolucao') x = Math.max(0, x);
    return [x, y];
  };
  // trecho (i → i+1, fechando no primeiro) mais perto do clique, em pixels; -1 se nenhum perto o bastante
  const segmentoPerto = (sx, sy) => {
    if (pts.length < 2) return -1;
    let m = -1, dm = 8;
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = paraTela(pts[i].x, pts[i].y), [bx, by] = paraTela(pts[(i + 1) % pts.length].x, pts[(i + 1) % pts.length].y);
      const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((sx - ax) * vx + (sy - ay) * vy) / l2));
      const d = Math.hypot(ax + vx * t - sx, ay + vy * t - sy);
      if (d < dm) { dm = d; m = i; }
    }
    return m;
  };
  const pontoPerto = (sx, sy) => {
    let m = -1, dm = 9;
    pts.forEach((p, i) => { const [px, py] = paraTela(p.x, p.y), d = Math.hypot(px - sx, py - sy); if (d < dm) { dm = d; m = i; } });
    return m;
  };

  function desenhar() {
    const W = tela.width, H = tela.height;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#fbfcfc'; ctx.fillRect(0, 0, W, H);
    // grade
    for (const [cada, cor] of [[1, '#eef2f3'], [10, '#d5dde0']]) {
      if (cada * esc < 5) continue;
      ctx.strokeStyle = cor; ctx.lineWidth = 1; ctx.beginPath();
      const xi = Math.floor(-ox / esc / cada) * cada, xf = (W - ox) / esc, yi = Math.floor((oy - H) / esc / cada) * cada, yf = oy / esc;
      for (let x = xi; x <= xf; x += cada) { const [sx] = paraTela(x, 0); ctx.moveTo(sx + 0.5, 0); ctx.lineTo(sx + 0.5, H); }
      for (let y = yi; y <= yf; y += cada) { const [, sy] = paraTela(0, y); ctx.moveTo(0, sy + 0.5); ctx.lineTo(W, sy + 0.5); }
      ctx.stroke();
    }
    // eixos
    const [x0s, y0s] = paraTela(0, 0);
    if (modo === 'revolucao') {
      ctx.fillStyle = 'rgba(30,42,48,0.06)'; ctx.fillRect(0, 0, x0s, H);
      ctx.strokeStyle = '#2a62b8'; ctx.lineWidth = 2; ctx.setLineDash([8, 5]);
      ctx.beginPath(); ctx.moveTo(x0s, 0); ctx.lineTo(x0s, H); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#2a62b8'; ctx.font = '12px Bahnschrift, Segoe UI, sans-serif'; ctx.fillText(tr('eixo de giro'), x0s + 6, 16);
      ctx.strokeStyle = '#9aa3a8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y0s); ctx.lineTo(W, y0s); ctx.stroke();
      ctx.fillStyle = '#56656c'; ctx.fillText('r →', W - 34, y0s - 6); ctx.fillText('z ↑', x0s + 6, 32);
    } else {
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, y0s); ctx.lineTo(W, y0s); ctx.stroke();
      ctx.strokeStyle = '#2e8b3e'; ctx.beginPath(); ctx.moveTo(x0s, 0); ctx.lineTo(x0s, H); ctx.stroke();
    }
    // perfil
    if (pts.length >= 2) {
      const am = amostrarPerfil(pts, modo);
      ctx.beginPath(); am.forEach(([x, y], i) => { const [sx, sy] = paraTela(x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.closePath();
      ctx.fillStyle = 'rgba(201,123,60,0.18)'; if (pts.length >= 3) ctx.fill();
      ctx.strokeStyle = '#c97b3c'; ctx.lineWidth = 2; ctx.stroke();
    }
    pts.forEach((p, i) => {
      const [sx, sy] = paraTela(p.x, p.y);
      ctx.fillStyle = i === sel ? '#e0a100' : i === hover ? '#ffcf4d' : '#fff';
      ctx.strokeStyle = '#1e2a30'; ctx.lineWidth = 1.5; ctx.beginPath();
      if (p.s) ctx.arc(sx, sy, 5, 0, Math.PI * 2); else ctx.rect(sx - 4.5, sy - 4.5, 9, 9);
      ctx.fill(); ctx.stroke();
      if (i === 0) { ctx.fillStyle = '#1e2a30'; ctx.font = '11px Bahnschrift, sans-serif'; ctx.fillText('1', sx + 7, sy - 6); }
    });
    if (rastro) { ctx.strokeStyle = '#2f6f8f'; ctx.lineWidth = 2; ctx.beginPath(); rastro.forEach((p, i) => { const [sx, sy] = paraTela(p.x, p.y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke(); }
  }

  let arrasto = null, rastro = null, panor = null;
  tela.addEventListener('contextmenu', e => e.preventDefault());
  tela.addEventListener('pointerdown', e => {
    tela.focus(); tela.setPointerCapture(e.pointerId);
    const q = doEvento(e);
    if (e.button === 1) { panor = { sx: q.sx, sy: q.sy, ox, oy }; return; }
    const i = pontoPerto(q.sx, q.sy);
    if (e.button === 2) { if (i >= 0) { guardar(); pts.splice(i, 1); sel = -1; desenhar(); } return; }
    if (i >= 0) { guardar(); sel = i; arrasto = { i }; desenhar(); return; }
    if (ferramenta === 'livre') { guardar(); rastro = [{ x: q.x, y: q.y }]; return; }
    if (ferramenta === 'editar') { sel = -1; desenhar(); return; }
    guardar();
    const [x, y] = encaixar(q.x, q.y);
    // clicou em cima de uma linha do perfil: o ponto novo entra nessa linha, onde você clicou
    const seg = segmentoPerto(q.sx, q.sy);
    if (seg >= 0) { pts.splice(seg + 1, 0, { x, y, s: ferramenta === 'curva' }); sel = seg + 1; desenhar(); return; }
    pts.push({ x, y, s: ferramenta === 'curva' }); sel = pts.length - 1; desenhar();
  });
  tela.addEventListener('pointermove', e => {
    const q = doEvento(e);
    const [ex, ey] = encaixar(q.x, q.y);
    coords.textContent = `${modo === 'revolucao' ? 'r' : 'x'} ${decimal(ex)}   ${modo === 'revolucao' ? 'z' : 'y'} ${decimal(ey)} mm`;
    if (panor) { ox = panor.ox + q.sx - panor.sx; oy = panor.oy + q.sy - panor.sy; desenhar(); return; }
    if (arrasto) { pts[arrasto.i].x = ex; pts[arrasto.i].y = ey; desenhar(); return; }
    if (rastro) { const u = rastro[rastro.length - 1]; if (Math.hypot(q.x - u.x, q.y - u.y) > 0.4) { rastro.push({ x: modo === 'revolucao' ? Math.max(0, q.x) : q.x, y: q.y }); desenhar(); } return; }
    const h = pontoPerto(q.sx, q.sy); if (h !== hover) { hover = h; desenhar(); }
  });
  tela.addEventListener('pointerup', () => {
    if (rastro) {
      const s = simplificar(rastro, Math.max(0.25, 1.5 / esc));
      if (s.length >= 2) for (const p of s) { const [x, y] = encaixar(p.x, p.y); pts.push({ x, y, s: true }); }
      else pilha.pop();
      rastro = null; desenhar();
    }
    arrasto = null; panor = null;
  });
  tela.addEventListener('dblclick', e => {
    const q = doEvento(e), i = pontoPerto(q.sx, q.sy);
    if (i >= 0) { guardar(); pts[i].s = !pts[i].s; desenhar(); }
  });
  tela.addEventListener('wheel', e => {
    e.preventDefault();
    const q = doEvento(e), f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    esc = Math.min(200, Math.max(0.5, esc * f));
    ox = q.sx - q.x * esc; oy = q.sy + q.y * esc; desenhar();
  }, { passive: false });
  tela.addEventListener('keydown', e => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel >= 0) { guardar(); pts.splice(sel, 1); sel = -1; desenhar(); e.preventDefault(); }
    if (e.key.toLowerCase() === 'z' && e.ctrlKey && pilha.length) { pts = JSON.parse(pilha.pop()); sel = -1; desenhar(); e.preventDefault(); }
    e.stopPropagation();
  });

  abrirModal(modo === 'revolucao' ? tr('Desenhar perfil (Revolução de Perfil)') : tr('Desenhar polígono'),
    el('div', { class: 'editor2d' }, barra, tela, dica, rodape));
  enquadrar(); desenhar();
  return { tela, get pontos() { return pts; } };
}
