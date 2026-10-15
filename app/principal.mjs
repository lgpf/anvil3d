// Anvil3D — interface principal
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { extrairArestas, descritor, casarArestas, ferramentas } from './core/arestas.mjs';
import ModuloManifold from './vendor/manifold.js';
import { RegistroPlugins, parametrosPadrao, lerPontos } from './core/plugins.mjs';
import opentype from './vendor/opentype.module.js';
import { abrirEditor2D, amostrarPerfil, textoDoPerfil } from './editor2d.mjs';
import { MotorGeometria, dadosMalha } from './core/geometria.mjs';
import { VERSAO as VERSAO_DOC, serializarPeca, lerPeca, novoDocumento, novaForma, novoGrupo, novoAcabamento, novaMalha, serializar, carregarDocumento, clonarComNovosIds } from './core/documento.mjs';
import { Historico } from './core/historico.mjs';
import { stlBinario } from './core/stl.mjs';
import { avaliar } from './core/expressao.mjs';
import { tr, tt, definirIdioma, idiomaAtual, decimal, inteiro } from './core/i18n.mjs';
definirIdioma(localStorage.getItem('idioma') || 'pt');
document.documentElement.lang = idiomaAtual() === 'en' ? 'en' : 'pt-BR';
import { diagnosticar, reparar, regioesPlanas, lerMalha, gravarMalha, deManifold, bordas, apagarTriangulos, fecharBuracos, faceplana, simplificar, lerStl } from './core/malha.mjs';
import { MeshoptSimplifier } from './vendor/meshopt_simplifier.js';

const RAD = Math.PI / 180, GRAU = 180 / Math.PI;
const CORES = ['#3a86c8', '#e4572e', '#59a96a', '#f2b134', '#8e6cb8', '#2bb3b1', '#d1495b'];
const $ = s => document.querySelector(s);
const anvil = window.anvil;

// ---------- estado ----------
const E = {
  doc: novoDocumento(), caminho: null, sujo: false,
  sel: [],                 // ids selecionados (primeiro nível)
  // o ponto escolhido não é guardado entre sessões; sem ele o giro ia para a origem da mesa (0,0,0)
  pivo: 'centro', // cada seleção começa girando pelo centro (veja pivoDaSelecao)
  pontoPivo: [0, 0, 0],
  escolhendoPonto: false,
  eixoGiro: 'z', anguloGiro: Number(localStorage.getItem('anguloGiro') ?? 90),
  erros: new Map(),        // id -> mensagem
  verTri: localStorage.getItem('verTri') === '1',
  modoGizmo: 'mover',
  avisos: new Map(),       // id -> aviso (ex.: aresta não encontrada)
  corIdx: 0,
};
const hist = new Historico();
const registro = new RegistroPlugins();

// ---------- motor ----------
const wasm = await ModuloManifold();
wasm.setup();
const motor = new MotorGeometria(wasm, registro);
motor.definirResolucao(Number($('#resolucao').value));

// ---------- cena ----------
const vista = $('#vista');
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, stencil: true }); }
catch (e) {
  vista.innerHTML = tr('<p style="padding:20px">Não foi possível iniciar o 3D (WebGL). Atualize o driver de vídeo e abra o Anvil3D de novo.</p>');
  throw e;
}
renderer.setPixelRatio(window.devicePixelRatio);
vista.appendChild(renderer.domElement);
// a vista 3D só aparece depois que tudo carregou e a câmera foi enquadrada (sem o plano "pular")
renderer.domElement.classList.add('carregando');
const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20000);
camera.up.set(0, 0, 1);
camera.position.set(150, -160, 190);
const orbita = new OrbitControls(camera, renderer.domElement);
orbita.enableDamping = false;
orbita.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
orbita.addEventListener('change', desenhar);
// Zoom e arraste da vista: o OrbitControls anda em passos proporcionais à distância até o ponto
// central da órbita; perto dele os passos ficavam minúsculos e o zoom/arraste "travava". Agora o zoom
// vai na direção do cursor e, quando a câmera chega muito perto do centro, o centro é empurrado para
// a frente (a câmera atravessa em vez de parar).
orbita.zoomToCursor = true;
orbita.zoomSpeed = 1.4;
orbita.panSpeed = 1.2;
orbita.minDistance = 0.5;
orbita.maxDistance = 20000;
renderer.domElement.addEventListener('wheel', e => {
  const dist = camera.position.distanceTo(orbita.target);
  const minimo = Math.max(25, ladoMesaAtual() * 0.12);
  if (e.deltaY < 0 && dist < minimo) {
    const dir = orbita.target.clone().sub(camera.position).normalize();
    orbita.target.copy(camera.position).addScaledVector(dir, minimo * 1.5);
  }
}, { capture: true, passive: true });
// o arraste (botão do meio) também usa a distância até o centro: mantém um mínimo razoável
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.button !== 1) return;
  const dist = camera.position.distanceTo(orbita.target), minimo = Math.max(25, ladoMesaAtual() * 0.12);
  if (dist < minimo) { const dir = orbita.target.clone().sub(camera.position).normalize(); orbita.target.copy(camera.position).addScaledVector(dir, minimo); }
}, true);

cena.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
const luz = new THREE.DirectionalLight(0xffffff, 1.6); luz.position.set(80, -120, 200); cena.add(luz);
const luz2 = new THREE.DirectionalLight(0xffffff, 0.5); luz2.position.set(-150, 100, 60); cena.add(luz2);

// mesa de impressão: a origem (0, 0, 0) fica na quina da frente à esquerda e a mesa vai para +X e +Y,
// como numa impressora 3D; o STL sai nessas mesmas coordenadas
const plano = new THREE.Group();
cena.add(plano);
// mesa retangular (X × Y, até 1000 × 1000); "ladoMesa" é o lado maior (usado para escalas de câmera)
let mesaX = Number(localStorage.getItem('mesaX') || localStorage.getItem('mesa') || 200);
let mesaY = Number(localStorage.getItem('mesaY') || localStorage.getItem('mesa') || 200);
let ladoMesa = Math.max(mesaX, mesaY);
// mesa redonda (impressoras delta): círculo de diâmetro mesaX, com o centro em (mesaX/2, mesaY/2) — a origem
// continua na quina da frente à esquerda do quadrado que envolve o círculo
let mesaRedonda = localStorage.getItem('mesaForma') === 'redonda';
// grade da mesa: linha fina a cada "passoGrade" mm (1, 2,5, 5 ou 10) e linha forte a cada 10 mm (50 mm se a fina for 10)
let passoGrade = Number(localStorage.getItem('grade') || 1);
function ladoMesaAtual() { return ladoMesa; }
const centroMesa = () => [mesaX / 2, mesaY / 2, 0];
function linhasGrade(LX, LY, passo, cor, z) {
  const pts = [], nX = Math.round(LX / passo), nY = Math.round(LY / passo);
  if (mesaRedonda) { // linhas cortadas no círculo
    const R = LX / 2, c = R;
    for (let i = 0; i <= nX; i++) { const x = Math.min(LX, i * passo), h = Math.sqrt(Math.max(0, R * R - (x - c) ** 2)); if (h > 0) pts.push(x, c - h, z, x, c + h, z); }
    for (let j = 0; j <= nY; j++) { const y = Math.min(LY, j * passo), h = Math.sqrt(Math.max(0, R * R - (y - c) ** 2)); if (h > 0) pts.push(c - h, y, z, c + h, y, z); }
  } else {
    for (let i = 0; i <= nX; i++) { const x = Math.min(LX, i * passo); pts.push(x, 0, z, x, LY, z); }
    for (let j = 0; j <= nY; j++) { const y = Math.min(LY, j * passo); pts.push(0, y, z, LX, y, z); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: cor }));
}
// Marca fora da mesa, logo abaixo da borda da frente, à direita: "Anvil3D" + ícone nos tons da mesa
let texMarca = null;
const MARCA_PROP = 1024 / 220;
function texturaMarca() {
  if (texMarca) return texMarca;
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 220;
  texMarca = new THREE.CanvasTexture(cv); texMarca.colorSpace = THREE.SRGBColorSpace; texMarca.anisotropy = 4;
  const img = new Image();
  img.onload = () => {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    // ícone recolorido no azul-acinzentado da mesa (mantém só o formato)
    const ic = document.createElement('canvas'); ic.width = ic.height = 200; const gi = ic.getContext('2d');
    gi.drawImage(img, 0, 0, 200, 200); gi.globalCompositeOperation = 'source-in'; gi.fillStyle = '#9fb5c3'; gi.fillRect(0, 0, 200, 200);
    // "Anvil3D" e depois o ícone; o ícone encosta na borda direita (que coincide com a borda direita da mesa)
    g.drawImage(ic, cv.width - 200, 10, 200, 200);
    g.fillStyle = '#9fb5c3'; g.textAlign = 'right'; g.textBaseline = 'middle';
    g.font = '700 150px Bahnschrift, "Segoe UI", sans-serif'; g.fillText('Anvil3D', cv.width - 215, 118);
    texMarca.needsUpdate = true; desenhar();
  };
  img.src = 'app://anvil/app/icone.png';
  return texMarca;
}
function montarMesa() {
  plano.userData.porBaixo = null;
  for (const o of [...plano.children]) { plano.remove(o); o.traverse(x => { x.geometry?.dispose(); }); }
  const LX = mesaX, LY = mesaY, L = Math.max(LX, LY);
  const chao = new THREE.Mesh(mesaRedonda ? new THREE.CircleGeometry(LX / 2, 128) : new THREE.PlaneGeometry(LX, LY), new THREE.MeshBasicMaterial({ color: 0xcfe0ea, transparent: true, opacity: 0.55, depthWrite: false }));
  chao.position.set(LX / 2, LY / 2, -0.02); plano.add(chao);
  const passoForte = passoGrade >= 10 ? 50 : 10;
  if (passoGrade < passoForte) plano.add(linhasGrade(LX, LY, passoGrade, 0xbfd0da, 0));
  plano.add(linhasGrade(LX, LY, passoForte, 0x8fa9b8, 0.01));
  const contorno = mesaRedonda
    ? Array.from({ length: 160 }, (_, i) => new THREE.Vector3(LX / 2 + LX / 2 * Math.cos(i / 160 * Math.PI * 2), LY / 2 + LX / 2 * Math.sin(i / 160 * Math.PI * 2), 0.02))
    : [new THREE.Vector3(0, 0, 0.02), new THREE.Vector3(LX, 0, 0.02), new THREE.Vector3(LX, LY, 0.02), new THREE.Vector3(0, LY, 0.02)];
  const borda = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(contorno), new THREE.LineBasicMaterial({ color: 0x56656c }));
  plano.add(borda);
  const seta = Math.min(40, L * 0.2);
  plano.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0.03), seta, 0xc0392b, 5, 2.5));
  plano.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0.03), seta, 0x2e8b3e, 5, 2.5));
  plano.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0.03), seta * 0.75, 0x2a62b8, 5, 2.5));
  const padrao = !mesaRedonda && LX === LY && [200, 220, 256, 300].includes(LX);
  for (const b of document.querySelectorAll('[data-cmd^="mesa"]')) b.classList.toggle('ativo', padrao ? b.dataset.cmd === 'mesa' + LX : b.dataset.cmd === 'mesaPersonalizada');
  const bp = document.querySelector('[data-cmd=mesaPersonalizada] span'); if (bp) bp.textContent = padrao ? tr('Mesa personalizada…') : mesaRedonda ? tt`Mesa personalizada (redonda, Ø ${LX} mm)…` : tt`Mesa personalizada (${LX} × ${LY} mm)…`;
  for (const b of document.querySelectorAll('[data-cmd^="grade"]')) b.classList.toggle('ativo', b.dataset.cmd === 'grade' + String(passoGrade).replace('.', ''));
  // marca fora da mesa: embaixo da borda da frente, alinhada à direita
  const larg = Math.min(LX, 300) * 0.42 * Math.max(1, LX / 300) ** 0.5, alt = larg / MARCA_PROP;
  const marca = new THREE.Mesh(new THREE.PlaneGeometry(larg, alt), new THREE.MeshBasicMaterial({ map: texturaMarca(), transparent: true, depthWrite: false }));
  marca.position.set(LX - larg / 2, -alt / 2 - L * 0.004, -0.01); marca.renderOrder = -1; marca.userData.marca = true; plano.add(marca);
  chao.userData.chao = true;
}
montarMesa();
function trocarMesa(L, LY = L, redonda = false) {
  mesaRedonda = redonda; if (redonda) LY = L;
  mesaX = L; mesaY = LY; ladoMesa = Math.max(L, LY);
  localStorage.setItem('mesaX', L); localStorage.setItem('mesaY', LY); localStorage.setItem('mesa', ladoMesa); localStorage.setItem('mesaForma', redonda ? 'redonda' : 'retangular');
  montarMesa(); enquadrar('iso'); mensagem(redonda ? tt`Mesa redonda de Ø ${L} mm.` : tt`Mesa de ${L} × ${LY} mm.`);
}
function trocarGrade(p) { passoGrade = p; localStorage.setItem('grade', p); montarMesa(); desenhar(); mensagem(tt`Grade da mesa a cada ${fmt(p, p % 1 ? 1 : 0)} mm.`); }
function pedirMesaPersonalizada() {
  const ix = el('input', { type: 'number', min: 50, max: 1000, step: 1, value: mesaX }), iy = el('input', { type: 'number', min: 50, max: 1000, step: 1, value: mesaY });
  const forma = el('select', {}, el('option', { value: 'retangular', selected: !mesaRedonda }, tr('Retangular')), el('option', { value: 'redonda', selected: mesaRedonda }, tr('Redonda (impressora delta)')));
  const linhaY = campo(tr('Profundidade Y (mm)'), iy, true), rotX = campo(tr('Largura X (mm)'), ix, true);
  const atualizar = () => { const r = forma.value === 'redonda'; linhaY.hidden = r; rotX.firstChild.textContent = r ? tr('Diâmetro (mm)') : tr('Largura X (mm)'); };
  forma.onchange = atualizar;
  const ok = () => {
    const x = Math.round(Math.max(50, Math.min(1000, lerNumero(ix.value) || mesaX))), y = Math.round(Math.max(50, Math.min(1000, lerNumero(iy.value) || mesaY)));
    fecharModal(); trocarMesa(x, y, forma.value === 'redonda');
  };
  for (const i of [ix, iy]) i.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  abrirModal(tr('Mesa personalizada'), el('div', { class: 'sobre' },
    el('p', { class: 'dica' }, tr('Tamanho da área de impressão da sua impressora, de 50 a 1000 mm em cada lado.')),
    campo(tr('Formato'), forma, true), rotX, linhaY,
    el('div', { class: 'botoes' }, el('button', { onclick: fecharModal }, tr('Cancelar')), el('button', { class: 'primario', onclick: ok }, tr('Aplicar')))), true);
  atualizar(); setTimeout(() => { ix.focus(); ix.select(); }, 0);
}
// peças novas nascem no centro da mesa (os testes antigos pedem a origem)
const posicaoNova = () => (localStorage.getItem('teste:origem') ? [0, 0, 0] : centroMesa());

const objetos3d = new THREE.Group(); cena.add(objetos3d);
const malhas = new Map();         // id -> THREE.Mesh
const cacheGeo = new Map();       // chave -> { geo, arestas }
const matFioGlobal = new THREE.LineBasicMaterial({ color: 0x1e2a30, transparent: true, opacity: 0.35 });

// marcador do pivô
const marcador = new THREE.Group();
marcador.add(new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe0a100, depthTest: false })));
for (const [d, c] of [[[1, 0, 0], 0xc0392b], [[0, 1, 0], 0x2e8b3e], [[0, 0, 1], 0x2a62b8]]) {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...d).multiplyScalar(-6), new THREE.Vector3(...d).multiplyScalar(6)]);
  marcador.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: c, depthTest: false })));
}
marcador.renderOrder = 999; marcador.traverse(o => (o.renderOrder = 999));
marcador.visible = false; cena.add(marcador);

const gizmo = new TransformControls(camera, renderer.domElement);
gizmo.setMode('translate'); gizmo.setSpace('world'); gizmo.setSize(0.9);
cena.add(gizmo.getHelper());
// o gizmo é desenhado por último, por cima da mesa transparente e de peças translúcidas (furos,
// opacidade): antes eles eram pintados por cima dele e o deixavam acinzentado
gizmo.getHelper().traverse(o => { o.renderOrder = 1000; });
// sem a linha comprida do eixo (quase branca, atravessando a tela) ao passar o mouse num anel de giro:
// o próprio anel destacado já mostra em volta de qual eixo a peça vai girar
for (const h of gizmo._gizmo?.helper?.rotate?.children ?? []) if (h.name === 'AXIS' && h.material) { h.material = h.material.clone(); h.material.visible = false; }
gizmo.addEventListener('change', desenhar);
gizmo.addEventListener('dragging-changed', e => { orbita.enabled = !e.value; });
// segurança: se um arraste não recebeu o "soltar" (botão solto fora da janela, troca de janela com
// Alt+Tab…), a vista ficava travada — sem zoom pela roda e sem girar. Qualquer novo clique, a roda ou
// a janela perdendo o foco religam a órbita quando nada está sendo arrastado.
function religarOrbita() { if (!arrasteCorpo && !arrasteAlca && !gizmo.dragging) orbita.enabled = true; }
window.addEventListener('blur', () => { if (arrasteCorpo) { arrasteCorpo = null; cotaMov.hidden = true; limparCotasMov(); atualizarVisual(); } religarOrbita(); });
renderer.domElement.addEventListener('wheel', religarOrbita, { capture: true, passive: true });
window.addEventListener('pointerdown', religarOrbita, true);

// ---------- ferramenta de arestas (fillet / chanfro) ----------
const MAT = {
  cand: new LineMaterial({ color: 0x24323a, linewidth: 2 }),
  indisp: new LineMaterial({ color: 0x9aa3a8, linewidth: 1.5, transparent: true, opacity: 0.6 }),
  sel: new LineMaterial({ color: 0xe0a100, linewidth: 5 }),
  hover: new LineMaterial({ color: 0xffc21a, linewidth: 8 }),
};
const grupoArestas = new THREE.Group(); cena.add(grupoArestas);
const matCorte = new THREE.MeshBasicMaterial({ color: 0xd63a2f, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const matEnche = new THREE.MeshBasicMaterial({ color: 0x2e9b4e, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
let MA = null; // estado do modo de arestas
const suportada = f => (f.tipo === 'reta' || f.tipo === 'circulo') && f.lados?.length === 2;

function iniciarModoAresta(modo, { novaCamada = false } = {}) {
  encerrarModos('MA');
  const sel = selecionados();
  if (sel.length !== 1) return mensagem(tr('Selecione um objeto para arredondar ou chanfrar arestas.'));
  const no = sel[0];
  if (E.erros.has(no.id)) return mensagem(tr('Corrija o erro do objeto antes.'), true);
  const editando = no.tipo === 'acabamento' && !novaCamada;
  const t = no.transformacao;
  let base;
  if (editando) base = motor.mundo(no.filhos[0]);
  else base = motor.local(no).scale(t.escala);
  const feicoes = extrairArestas(base);
  const selIdx = new Set(editando ? casarArestas(feicoes, no.arestas).indices : []);
  MA = {
    id: no.id, editando, feicoes, sel: selIdx, hover: -1,
    modo: editando ? no.modo : modo, medida: editando ? no.medida : (MA_ultimaMedida[modo] ?? 1), base,
  };
  grupoArestas.position.fromArray(t.posicao);
  grupoArestas.rotation.set(t.rotacao[0] * RAD, t.rotacao[1] * RAD, t.rotacao[2] * RAD, 'XYZ');
  grupoArestas.scale.set(editando ? t.escala[0] : 1, editando ? t.escala[1] : 1, editando ? t.escala[2] : 1);
  feicoes.forEach((f, i) => {
    const pos = [];
    const ps = f.pontos;
    const n = f.tipo === 'reta' ? 1 : (f.fechada ? ps.length : ps.length - 1);
    for (let k = 0; k < n; k++) pos.push(...ps[k], ...ps[(k + 1) % ps.length]);
    const linha = new LineSegments2(new LineSegmentsGeometry().setPositions(pos), MAT.cand);
    linha.userData.idx = i;
    grupoArestas.add(linha);
  });
  gizmo.detach();
  estilizarArestas(); atualizarPrevia(); montarPainel();
  mensagem(tt`${feicoes.filter(suportada).length} arestas disponíveis. Clique para marcar; Enter aplica, Esc cancela.`);
}
const MA_ultimaMedida = {};

function limparGrupoArestas() {
  for (const o of [...grupoArestas.children]) { o.geometry.dispose(); grupoArestas.remove(o); }
}
// Antes de criar uma peça nova: encerra a operação aberta e volta o gizmo para mover
function novaPecaPreparar() {
  encerrarModos();
  if (E.modoGizmo !== 'mover') definirModoGizmo('mover');
}
// Só um modo de cada vez: entrar numa operação conclui a anterior (as que já aplicam na hora, como
// alinhar e espelhar, só saem; as que esperam confirmação, como fillet e juntar faces, são canceladas)
function encerrarModos(manter = null) {
  if (MA && manter !== 'MA') sairModoAresta();
  if (ME && manter !== 'ME') sairME();
  if (JF && manter !== 'JF') sairJF();
  if (AL && manter !== 'AL') sairAlinhar();
  if (FM && manter !== 'FM') sairFM();
  if (ALN && manter !== 'ALN') sairAlinharObj();
  if (ESP && manter !== 'ESP') sairEspelhar();
  if (AF && manter !== 'AF') sairAplicarFace();
  if (E.escolhendoPonto && manter !== 'PONTO') cancelarEscolha();
}
// Se a peça de uma operação em andamento sumiu (apagada, desfeita), a operação é cancelada
function validarModos() {
  const existe = id => !!noPorId(id) && malhas.has(id);
  let cancelou = false;
  if (MA && !existe(MA.id)) { sairModoAresta(); cancelou = true; }
  if (ME && !existe(ME.id)) { sairME(); cancelou = true; }
  if ((JF || AL || FM) && !E.sel.some(existe)) { sairJF(); sairAlinhar(); sairFM(); cancelou = true; }
  if (ALN && E.sel.filter(existe).length < 2) { sairAlinharObj(); cancelou = true; }
  if (ESP && !E.sel.some(existe)) { sairEspelhar(); cancelou = true; }
  if (AF && !existe(AF.id)) { sairAplicarFace(); cancelou = true; }
  if (ALN) montarPontosAlinhar();
  if (ESP) montarSetasEspelho();
  if (cancelou) mensagem(tr('Operação cancelada: a peça não existe mais.'));
}
function sairModoAresta() { try { MA?.base?.delete(); } catch {} MA = null; limparGrupoArestas(); atualizarVisual(); montarPainel(); }

function estilizarArestas() {
  if (MA) MA.selT = selComTangentes();
  for (const l of grupoArestas.children) {
    if (l.userData.idx === undefined) continue;
    const i = l.userData.idx, f = MA.feicoes[i], sob = MA.hoverSet?.has(i);
    MA.selT ??= selComTangentes();
    l.material = sob && suportada(f) ? MAT.hover : MA.selT.has(i) ? MAT.sel : suportada(f) ? MAT.cand : MAT.indisp;
    l.renderOrder = MA.sel.has(i) || sob ? 10 : 5;
  }
  desenhar();
}

function atualizarPrevia() {
  for (const o of [...grupoArestas.children]) if (o.userData.previa) { o.geometry.dispose(); grupoArestas.remove(o); }
  if (!MA?.sel.size || !(MA.medida > 0)) return desenhar();
  const fs = [...selComTangentes()].map(i => MA.feicoes[i]);
  const { cortes, enchimentos, erros } = ferramentas(wasm, fs, MA.modo, MA.medida, motor.ctx.segmentos, MA.base);
  for (const [lista, mat] of [[cortes, matCorte], [enchimentos, matEnche]]) {
    if (!lista.length) continue;
    const u = wasm.Manifold.union(lista); lista.forEach(m => m.delete());
    const d = dadosMalha(u); u.delete();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(d.posicoes), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(d.indices), 1));
    const m = new THREE.Mesh(g, mat); m.userData.previa = true; m.renderOrder = 8;
    grupoArestas.add(m);
  }
  if (erros.length) mensagem(tr('Algumas arestas não aceitam essa medida: ') + [...new Set(erros.map(x => tr(x)))].join('; '), true);
  desenhar();
}

function arestaSobMouse(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  ray.params.Line2 = { threshold: 6 };
  const linhas = grupoArestas.children.filter(o => o.userData.idx !== undefined);
  const hit = ray.intersectObjects(linhas, false)[0];
  return hit ? hit.object.userData.idx : -1;
}
// Linha contínua: a partir de uma aresta, segue pelas vizinhas que continuam na mesma direção
// (dobra de até 35° em cada junção). Assim uma curva feita de muitos trechos retos vira um clique só.
let continua = localStorage.getItem('arestaContinua') !== '0';
const COS_CONTINUA = Math.cos(35 * Math.PI / 180);
function pontasArestas() {
  if (MA.pontas) return MA.pontas;
  const chave = p => p.map(v => Math.round(v * 1000)).join(',');
  const mapa = new Map();
  MA.feicoes.forEach((f, i) => {
    if (f.tipo !== 'reta') return;
    for (const [p, q] of [[f.a, f.b], [f.b, f.a]]) {
      const k = chave(p), dir = new V3(q[0] - p[0], q[1] - p[1], q[2] - p[2]).normalize(); // sai da ponta para dentro da aresta
      (mapa.get(k) ?? mapa.set(k, []).get(k)).push({ i, dir, outra: chave(q) });
    }
  });
  return (MA.pontas = mapa);
}
function cadeiaAresta(i0, cosLim = null) {
  const f0 = MA.feicoes[i0];
  if ((!continua && cosLim === null) || f0.tipo !== 'reta') return [i0];
  const LIM = cosLim ?? COS_CONTINUA;
  const pontas = pontasArestas(), chave = p => p.map(v => Math.round(v * 1000)).join(',');
  const vistos = new Set([i0]);
  // anda nos dois sentidos a partir das duas pontas
  for (const [inicio, fim] of [[f0.a, f0.b], [f0.b, f0.a]]) {
    let ponta = chave(fim), chegada = new V3(fim[0] - inicio[0], fim[1] - inicio[1], fim[2] - inicio[2]).normalize();
    for (let passos = 0; passos < 5000; passos++) {
      let melhor = null, nota = LIM;
      for (const c of pontas.get(ponta) ?? []) {
        if (vistos.has(c.i) || !suportada(MA.feicoes[c.i])) continue;
        const d = chegada.dot(c.dir);
        if (d >= nota) { nota = d; melhor = c; }
      }
      if (!melhor) break;
      vistos.add(melhor.i); chegada = melhor.dir; ponta = melhor.outra;
    }
  }
  return [...vistos];
}
// Seguir arestas tangentes (como o "tangent chain" dos CADs): o acabamento continua pelas arestas que
// emendam sem dobra (até 12°), para não terminar no meio de uma curva com um degrau triangular.
let tangentes = localStorage.getItem('arestaTangente') !== '0';
const COS_TANGENTE = Math.cos(12 * Math.PI / 180);
function selComTangentes() {
  if (!MA) return new Set();
  if (!tangentes) return new Set(MA.sel);
  const r = new Set();
  for (const i of MA.sel) for (const k of cadeiaAresta(i, COS_TANGENTE)) if (suportada(MA.feicoes[k])) r.add(k);
  return r;
}
function clicarAresta(e) {
  const i = arestaSobMouse(e);
  if (i < 0) return;
  const f = MA.feicoes[i];
  if (!suportada(f)) return mensagem(tr('Essa aresta é uma curva livre: ainda não suportada (só retas e círculos).'), true);
  const cadeia = e.altKey ? [i] : cadeiaAresta(i);
  const tirar = MA.sel.has(i);
  for (const k of cadeia) tirar ? MA.sel.delete(k) : MA.sel.add(k);
  estilizarArestas(); atualizarPrevia(); montarPainel();
  if (cadeia.length > 1) mensagem(tt`${cadeia.length} trechos contínuos ${tirar ? tr('desmarcados') : tr('marcados')} (Alt+clique pega só um trecho).`);
}
// modo pincel: segurando o botão e passando sobre as arestas, elas vão sendo marcadas
// (ou desmarcadas, se a primeira aresta tocada já estava marcada)
let pincel = null;
renderer.domElement.addEventListener('pointerdown', e => {
  if (!MA || e.button !== 0) return;
  const i = arestaSobMouse(e);
  pincel = { x: e.clientX, y: e.clientY, ativo: false, tirar: i >= 0 && MA.sel.has(i), feitos: new Set(), inicio: i };
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!pincel || !MA || !(e.buttons & 1)) return;
  if (!pincel.ativo) {
    if (Math.hypot(e.clientX - pincel.x, e.clientY - pincel.y) < 5) return;
    pincel.ativo = true; renderer.domElement.setPointerCapture(e.pointerId);
    if (pincel.inicio >= 0) pintarAresta(pincel.inicio);
  }
  const i = arestaSobMouse(e);
  if (i >= 0) pintarAresta(i);
});
function pintarAresta(i) {
  if (pincel.feitos.has(i) || !suportada(MA.feicoes[i])) return;
  pincel.feitos.add(i);
  pincel.tirar ? MA.sel.delete(i) : MA.sel.add(i);
  MA.hoverSet = new Set([i]); estilizarArestas();
}
renderer.domElement.addEventListener('pointerup', () => {
  if (!pincel) return;
  const p = pincel; pincel = null;
  if (!p.ativo || !MA) return;
  atualizarPrevia(); montarPainel();
  mensagem(tt`Pincel: ${p.feitos.size} aresta(s) ${p.tirar ? tr('desmarcadas') : tr('marcadas')}.`);
});

let pendenteHover = false;
renderer.domElement.addEventListener('pointermove', e => {
  if (!MA || pendenteHover || e.buttons) return;
  pendenteHover = true;
  requestAnimationFrame(() => {
    pendenteHover = false;
    if (!MA) return;
    const i = arestaSobMouse(e);
    if (pincel?.ativo) return;
  const k = i + (e.altKey ? 'a' : '');
    if (k !== MA.hoverChave) { MA.hover = i; MA.hoverChave = k; MA.hoverSet = new Set(i < 0 ? [] : e.altKey ? [i] : cadeiaAresta(i)); estilizarArestas(); }
  });
});

function selecionarArestas(filtro) {
  const fs = MA.feicoes;
  const zs = fs.flatMap(f => f.pontos.map(p => p[2])), zmax = Math.max(...zs);
  const regra = {
    todas: () => true, nenhuma: () => false,
    topo: f => f.pontos.every(p => p[2] > zmax - 1e-3),
    verticais: f => f.tipo === 'reta' && Math.abs(f.b[2] - f.a[2]) / Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1], f.b[2] - f.a[2]) > 0.999,
  }[filtro];
  MA.sel = new Set(fs.map((f, i) => (suportada(f) && regra(f) ? i : -1)).filter(i => i >= 0));
  estilizarArestas(); atualizarPrevia(); montarPainel();
}

function aplicarModoAresta() {
  if (!MA) return;
  if (!MA.sel.size) return mensagem(tr('Marque pelo menos uma aresta.'), true);
  if (!(MA.medida > 0)) return mensagem(tr('A medida precisa ser maior que zero.'), true);
  const desc = [...selComTangentes()].map(i => descritor(MA.feicoes[i]));
  const no = noPorId(MA.id), { modo, medida, editando } = MA;
  MA_ultimaMedida[modo] = medida;
  try { MA?.base?.delete(); } catch {} MA = null; limparGrupoArestas();
  alterar(() => {
    if (editando) {
      Object.assign(no, { modo, medida, arestas: desc, nome: `${modo === 'chanfro' ? tr('Chanfro') : tr('Fillet')} ${fmt(medida, 2).replace(/,?0+$/, '')} mm` });
    } else {
      const t = no.transformacao;
      no.transformacao = { posicao: [0, 0, 0], rotacao: [0, 0, 0], escala: t.escala };
      const ac = novoAcabamento(no, modo, medida, desc, { posicao: t.posicao, rotacao: t.rotacao, escala: [1, 1, 1] });
      ac.nome = `${modo === 'chanfro' ? tr('Chanfro') : tr('Fillet')} ${fmt(medida, 2).replace(/,?0+$/, '')} mm`;
      E.doc.objetos.splice(E.doc.objetos.indexOf(no), 1, ac);
      E.sel = [ac.id];
    }
  });
  mensagem(tt`${modo === 'chanfro' ? tr('Chanfro') : tr('Fillet')} aplicado em ${desc.length} aresta(s). Continua editável: selecione e use "Editar arestas".`);
}

function removerAcabamento(no) {
  alterar(() => {
    const f = no.filhos[0];
    definirMatriz(f, matrizDoNo(no).multiply(matrizDoNo(f)));
    E.doc.objetos.splice(E.doc.objetos.indexOf(no), 1, f);
    E.sel = [f.id];
  });
}

function painelArestas() {
  const nSup = MA.feicoes.filter(suportada).length;
  painel.append(el('h2', {}, MA.editando ? tr('Editar arestas') : (MA.modo === 'chanfro' ? tr('Chanfro') : tr('Fillet')), interrog('modoArestas')),
    el('div', { class: 'segmentado botoes' }, ...[['fillet', tr('Fillet')], ['chanfro', tr('Chanfro')]].map(([m, r]) =>
      el('button', { class: MA.modo === m ? 'ativo' : '', onclick: () => { MA.modo = m; atualizarPrevia(); montarPainel(); } }, r))),
    campo(MA.modo === 'chanfro' ? tr('Distância (mm)') : tr('Raio (mm)'), inputNumero(MA.medida, 2, v => { MA.medida = Math.max(0, arred(v, 4)); atualizarPrevia(); montarPainel(); })),
    el('p', { class: 'contagem' }, tt`${selComTangentes().size} de ${nSup} arestas marcadas`),
    (() => { // aviso de ângulos muito fechados entre as faces das arestas marcadas
      const agudas = [...MA.sel].filter(i => (MA.feicoes[i].angulo ?? 90) < 35).length;
      return agudas ? el('div', { class: 'caixa-aviso' }, tt`${agudas} das arestas marcadas têm faces se encontrando em ângulo muito fechado (menos de 35°). Ali o ${MA.modo === 'chanfro' ? tr('chanfro') : tr('fillet')} fica com alcance limitado e pode sair irregular; prefira um raio menor, chanfro, ou deixe essas arestas de fora (Alt+clique ou pincel).`) : null;
    })(),
    campo(tr('Seguir tangentes'), el('input', { type: 'checkbox', checked: tangentes, title: tr('Continua o acabamento pelas arestas que emendam sem dobra, para não sobrar um degrau triangular nas pontas.'),
      onchange: e => { tangentes = e.target.checked; localStorage.setItem('arestaTangente', tangentes ? '1' : '0'); estilizarArestas(); atualizarPrevia(); montarPainel(); } })),
    campo(tr('Linha contínua'), el('input', { type: 'checkbox', checked: continua, title: tr('Um clique pega a linha inteira enquanto ela segue sem dobras fortes. Alt+clique pega só um trecho.'),
      onchange: e => { continua = e.target.checked; localStorage.setItem('arestaContinua', continua ? '1' : '0'); MA.hoverChave = null; } })),
    el('div', { class: 'botoes' },
      el('button', { class: 'pequeno', onclick: () => selecionarArestas('todas') }, tr('Todas')),
      el('button', { class: 'pequeno', onclick: () => selecionarArestas('topo') }, tr('Do topo')),
      el('button', { class: 'pequeno', onclick: () => selecionarArestas('verticais') }, tr('Verticais')),
      el('button', { class: 'pequeno', onclick: () => selecionarArestas('nenhuma') }, tr('Nenhuma'))),
    el('p', { class: 'dica' }, tr('Clique numa aresta para marcar ou desmarcar, ou arraste por cima de várias (pincel). Em vermelho, o material que sai; em verde, o que entra nos cantos internos.')),
    el('p', { class: 'dica' }, tr('Topo e verticais seguem os eixos do próprio objeto.')),
    el('div', { class: 'botoes' },
      el('button', { onclick: sairModoAresta }, tr('Cancelar')),
      el('button', { class: 'primario', onclick: aplicarModoAresta }, tr('Aplicar'))));
}

// ---------- edição de malha (triângulos e vértices) ----------
const grupoMalha = new THREE.Group(); cena.add(grupoMalha);
const ajudanteV = new THREE.Object3D(); cena.add(ajudanteV);
const matFio = new THREE.LineBasicMaterial({ color: 0x1e2a30, transparent: true, opacity: 0.45 });
const matTriSel = new THREE.MeshBasicMaterial({ color: 0xe0a100, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const matPontos = new THREE.PointsMaterial({ color: 0x1e2a30, size: 5, sizeAttenuation: false });
const matPontosSel = new THREE.PointsMaterial({ color: 0xe0a100, size: 10, sizeAttenuation: false, depthTest: false });
let ME = null; // { id, modo, selT:Set, selV:Set }
let arrasteV = null;

function geoIndexada(d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(d.v, 3));
  g.setIndex(new THREE.BufferAttribute(d.t, 1));
  return g;
}
function iniciarME() {
  encerrarModos('ME');
  const no = selecionados()[0];
  if (!no || no.tipo !== 'malha') return;
  ME = { id: no.id, modo: 'triangulos', selT: new Set(), selV: new Set() };
  gizmo.detach(); montarOverlay(); montarPainel();
  mensagem(tr('Clique para marcar triângulos ou vértices. Del apaga triângulos, Esc conclui.'));
}
function sairME() { ME = null; arrasteV = null; limparOverlay(); atualizarVisual(); montarPainel(); }
function limparOverlay() { for (const o of [...grupoMalha.children]) { o.geometry.dispose(); grupoMalha.remove(o); } }
function montarOverlay() {
  limparOverlay();
  const no = ME && noPorId(ME.id);
  if (!no) { ME = null; return; }
  const d = lerMalha(no);
  aplicarTransformacao(grupoMalha, no.transformacao);
  grupoMalha.updateMatrixWorld(true);
  const fio = new THREE.LineSegments(new THREE.WireframeGeometry(geoIndexada(d)), matFio); fio.renderOrder = 6;
  grupoMalha.add(fio);
  if (ME.selT.size) {
    const p = new Float32Array(ME.selT.size * 9); let k = 0;
    for (const i of ME.selT) for (let j = 0; j < 3; j++) { const vi = d.t[i * 3 + j]; p[k++] = d.v[vi * 3]; p[k++] = d.v[vi * 3 + 1]; p[k++] = d.v[vi * 3 + 2]; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.Mesh(g, matTriSel); m.renderOrder = 7; grupoMalha.add(m);
  }
  if (ME.modo === 'vertices') {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(d.v, 3));
    const pts = new THREE.Points(g, matPontos); pts.userData.todos = true; grupoMalha.add(pts);
    const sv = [...ME.selV], ps = new Float32Array(sv.length * 3);
    sv.forEach((i, k) => ps.set(d.v.subarray(i * 3, i * 3 + 3), k * 3));
    const gs = new THREE.BufferGeometry(); gs.setAttribute('position', new THREE.BufferAttribute(ps, 3));
    const sel = new THREE.Points(gs, matPontosSel); sel.userData.sel = true; sel.renderOrder = 20; grupoMalha.add(sel);
    if (sv.length) {
      ajudanteV.position.copy(centroVertices(d).applyMatrix4(grupoMalha.matrixWorld));
      gizmo.attach(ajudanteV);
    } else gizmo.detach();
  } else gizmo.detach();
  desenhar();
}
function centroVertices(d) {
  const c = new THREE.Vector3();
  for (const i of ME.selV) c.add(new THREE.Vector3(d.v[i * 3], d.v[i * 3 + 1], d.v[i * 3 + 2]));
  return c.divideScalar(ME.selV.size || 1);
}
function clicarME(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  if (ME.modo === 'triangulos') {
    const hit = ray.intersectObject(malhas.get(ME.id), false)[0];
    if (!hit) return;
    const i = hit.faceIndex;
    if (ME.selT.has(i)) ME.selT.delete(i); else ME.selT.add(i);
  } else {
    const pts = grupoMalha.children.find(o => o.userData.todos);
    ray.params.Points.threshold = camera.position.distanceTo(orbita.target) * 0.012;
    const hits = ray.intersectObject(pts, false);
    if (!hits.length) return;
    const h = hits.reduce((a, b) => (b.distanceToRay < a.distanceToRay ? b : a));
    if (e.shiftKey || e.ctrlKey) { if (ME.selV.has(h.index)) ME.selV.delete(h.index); else ME.selV.add(h.index); }
    else ME.selV = ME.selV.has(h.index) && ME.selV.size === 1 ? new Set() : new Set([h.index]);
  }
  montarOverlay(); montarPainel();
}
function gravarNaMalha(fn, msg) {
  const no = noPorId(ME?.id ?? E.sel[0]);
  alterar(() => gravarMalha(no, fn(lerMalha(no))));
  if (ME) montarOverlay();
  if (msg) mensagem(msg);
}
function apagarSelecaoME() {
  if (!ME?.selT.size) return mensagem(tr('Marque triângulos para apagar.'));
  const n = ME.selT.size, sel = [...ME.selT];
  ME.selT = new Set();
  gravarNaMalha(d => apagarTriangulos(d, sel), tt`${n} triângulo(s) apagado(s). A malha ficou aberta: use "Fechar buracos" se for usá-la em grupos ou furos.`);
}
function moverVertices(delta) { // delta em coordenadas locais
  const sel = [...ME.selV];
  gravarNaMalha(d => {
    const v = new Float32Array(d.v);
    for (const i of sel) { v[i * 3] += delta.x; v[i * 3 + 1] += delta.y; v[i * 3 + 2] += delta.z; }
    return { v, t: d.t };
  });
}
function vertDown() {
  const no = noPorId(ME.id), d = lerMalha(no);
  arrasteV = { inicio: ajudanteV.position.clone(), inv: grupoMalha.matrixWorld.clone().invert(), base: centroVertices(d) };
}
function vertChange() {
  if (!arrasteV) return;
  const novo = ajudanteV.position.clone().applyMatrix4(arrasteV.inv);
  const delta = novo.sub(arrasteV.base);
  const sel = grupoMalha.children.find(o => o.userData.sel);
  const no = noPorId(ME.id), d = lerMalha(no), p = sel.geometry.attributes.position;
  [...ME.selV].forEach((i, k) => p.setXYZ(k, d.v[i * 3] + delta.x, d.v[i * 3 + 1] + delta.y, d.v[i * 3 + 2] + delta.z));
  p.needsUpdate = true;
}
function vertUp() {
  if (!arrasteV) return;
  const delta = ajudanteV.position.clone().applyMatrix4(arrasteV.inv).sub(arrasteV.base);
  arrasteV = null;
  if (delta.length() > 1e-6) moverVertices(delta);
}

function painelME() {
  const no = noPorId(ME.id), d = lerMalha(no), aberta = bordas(d).length > 0;
  painel.append(el('h2', {}, tr('Editar malha'), interrog('editarMalha')),
    el('p', { class: 'dica' }, tt`${fmtInt(d.t.length / 3)} triângulos, ${fmtInt(d.v.length / 3)} vértices${aberta ? tr(', aberta') : tr(', fechada')}.`),
    el('div', { class: 'segmentado botoes' }, ...[['triangulos', tr('Triângulos')], ['vertices', tr('Vértices')]].map(([m, r]) =>
      el('button', { class: ME.modo === m ? 'ativo' : '', onclick: () => { ME.modo = m; montarOverlay(); montarPainel(); } }, r))));
  if (ME.modo === 'triangulos') {
    const tot = d.t.length / 3;
    painel.append(el('p', { class: 'contagem' }, tt`${fmtInt(ME.selT.size)} triângulo(s) marcado(s)`),
      el('div', { class: 'botoes' },
        el('button', { class: 'pequeno', title: tr('Expande a seleção para toda a face plana'), onclick: () => { ME.selT = faceplana(d, [...ME.selT]); montarOverlay(); montarPainel(); } }, tr('Face plana')),
        el('button', { class: 'pequeno', onclick: () => { ME.selT = new Set(Array.from({ length: tot }, (_, i) => i).filter(i => !ME.selT.has(i))); montarOverlay(); montarPainel(); } }, tr('Inverter')),
        el('button', { class: 'pequeno', onclick: () => { ME.selT = new Set(); montarOverlay(); montarPainel(); } }, tr('Nenhum'))),
      el('div', { class: 'botoes' }, el('button', { onclick: apagarSelecaoME, disabled: !ME.selT.size }, tr('Apagar triângulos (Del)'))),
      el('p', { class: 'dica' }, tr('Clique num triângulo para marcar ou desmarcar. "Face plana" marca todos os vizinhos no mesmo plano.')));
  } else {
    painel.append(el('p', { class: 'contagem' }, tt`${fmtInt(ME.selV.size)} vértice(s) marcado(s)`));
    if (ME.selV.size) {
      const c = centroVertices(d);
      painel.append(titulo(ME.selV.size === 1 ? tr('Posição do vértice (mm, local)') : tr('Centro dos vértices (mm, local)'), 'editarMalha'),
        linhaXYZ(c.toArray(), 3, (i, v) => { const delta = new THREE.Vector3(); delta.setComponent(i, v - c.getComponent(i)); moverVertices(delta); }),
        el('div', { class: 'botoes' }, el('button', { class: 'pequeno', onclick: () => { ME.selV = new Set(); montarOverlay(); montarPainel(); } }, tr('Nenhum'))));
    }
    painel.append(el('p', { class: 'dica' }, tr('Clique num vértice para selecioná-lo; Shift+clique soma. Arraste pelas setas ou digite a posição. O passo de movimento vale aqui também.')));
  }
  if (aberta) painel.append(el('div', { class: 'botoes' }, el('button', { onclick: fecharBuracosSel }, tr('Fechar buracos'))));
  painelSimplificar(no);
  painel.append(el('div', { class: 'botoes' }, el('button', { class: 'primario', onclick: sairME }, tr('Concluir'))));
}

const opSimp = { proporcao: 50, erro: 0, bordas: true };
function painelSimplificar(no) {
  painel.append(titulo(tr('Simplificar'), 'simplificar'),
    campo(tr('Manter (% dos triângulos)'), inputNumero(opSimp.proporcao, 1, v => { opSimp.proporcao = Math.min(100, Math.max(0.1, v)); })),
    campo(tr('Desvio máximo (mm, 0 = livre)'), inputNumero(opSimp.erro, 3, v => { opSimp.erro = Math.max(0, v); })),
    campo(tr('Travar bordas abertas'), el('input', { type: 'checkbox', checked: opSimp.bordas, onchange: e => (opSimp.bordas = e.target.checked) })),
    el('div', { class: 'botoes' }, el('button', { onclick: () => simplificarNo(no) }, tr('Simplificar'))),
    el('p', { class: 'dica' }, tr('Com desvio máximo, ele para antes do alvo se fosse deformar a peça além dessa medida.')));
}
async function simplificarNo(no) {
  const d = lerMalha(no), antes = d.t.length / 3;
  mensagem('Simplificando…');
  const r = await simplificar(MeshoptSimplifier, d, { proporcao: opSimp.proporcao / 100, erroMax: opSimp.erro, manterBordas: opSimp.bordas });
  const depois = r.dados.t.length / 3;
  if (ME) { ME.selT = new Set(); ME.selV = new Set(); }
  alterar(() => gravarMalha(no, r.dados));
  if (ME) montarOverlay();
  mensagem(tt`${fmtInt(antes)} → ${fmtInt(depois)} triângulos (desvio de até ${fmt(r.erro, 3)} mm).`);
}
function fecharBuracosSel() {
  const no = noPorId(ME?.id ?? E.sel[0]);
  const r = fecharBuracos(lerMalha(no));
  if (ME) ME.selT = new Set();
  alterar(() => gravarMalha(no, r.dados));
  if (ME) montarOverlay();
  mensagem(tt`${r.buracos} buraco(s) fechado(s).`);
}
function converterEmMalha(no) {
  let solido;
  try { solido = motor.local(no); } catch (e) { return mensagem(e.message, true); }
  alterar(() => {
    const m = novaMalha(no.nome, no.cor);
    gravarMalha(m, deManifold(solido));
    m.transformacao = structuredClone(no.transformacao);
    m.furo = no.furo;
    m.origem = structuredClone(no);
    E.doc.objetos.splice(E.doc.objetos.indexOf(no), 1, m);
    E.sel = [m.id];
  });
  mensagem(tr('Convertido em malha. A versão paramétrica ficou guardada: "Voltar ao paramétrico" descarta as edições de malha.'));
}
function voltarParametrico(no) {
  alterar(() => {
    const o = no.origem; o.transformacao = structuredClone(no.transformacao);
    E.doc.objetos.splice(E.doc.objetos.indexOf(no), 1, o);
    E.sel = [o.id];
  });
}
// ---------- importar SVG ----------
// Usa o próprio navegador para entender o SVG: cada caminho (e retângulo, círculo, elipse, polígono)
// é amostrado em pontos, já com as transformações dos grupos aplicadas; cada subcaminho (M…Z) vira um contorno.
function contornosDoSvg(texto) {
  const doc = new DOMParser().parseFromString(texto, 'image/svg+xml');
  const raiz = doc.querySelector('svg');
  if (!raiz || doc.querySelector('parsererror')) throw new Error(tr('o arquivo não é um SVG válido'));
  const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-99999px;top:0;width:10px;height:10px;overflow:hidden';
  host.appendChild(document.importNode(raiz, true)); document.body.appendChild(host);
  const svg = host.querySelector('svg'), contornos = [];
  try {
    const formas = svg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line');
    const ns = 'http://www.w3.org/2000/svg';
    for (const f of formas) {
      if (f.closest('defs, clipPath, mask, symbol')) continue;
      const M = f.getCTM(), raizM = svg.getCTM()?.inverse();
      const T = raizM && M ? raizM.multiply(M) : M;
      // separa os subcaminhos de um path em paths próprios; as outras formas já são um contorno só
      let pedacos = [f];
      if (f.tagName.toLowerCase() === 'path') {
        const d = f.getAttribute('d') || '';
        const partes = d.match(/[Mm][^Mm]*/g) || [];
        let absX = 0, absY = 0; pedacos = [];
        for (let k = 0; k < partes.length; k++) {
          let parte = partes[k];
          // um "m" minúsculo é relativo ao fim do subcaminho anterior: converte para absoluto
          if (k > 0 && parte[0] === 'm') { const nums = parte.slice(1).trim().split(/[\s,]+/); parte = `M${absX + Number(nums[0])},${absY + Number(nums[1])}` + parte.slice(1).replace(/^[\s,]*-?[\d.]+(e-?\d+)?[\s,]*-?[\d.]+(e-?\d+)?/, ''); }
          const pth = document.createElementNS(ns, 'path'); pth.setAttribute('d', parte); svg.appendChild(pth);
          const L = pth.getTotalLength(); const fim = L > 0 ? pth.getPointAtLength(L) : { x: absX, y: absY };
          // o próximo "m" relativo parte do início deste subcaminho se ele fechou (Z), senão do fim
          const ini = pth.getPointAtLength(0); [absX, absY] = /[Zz]\s*$/.test(parte) ? [ini.x, ini.y] : [fim.x, fim.y];
          pedacos.push(pth);
        }
      }
      for (const g of pedacos) {
        const L = g.getTotalLength?.() ?? 0; if (!(L > 0)) continue;
        const n = Math.max(12, Math.min(800, Math.ceil(L / 0.4)));
        const pts = [];
        for (let i = 0; i < n; i++) { let q = g.getPointAtLength(L * i / n); if (T) q = new DOMPoint(q.x, q.y).matrixTransform(T); pts.push([q.x, -q.y]); }
        if (pts.length >= 3) contornos.push(pts);
        if (g !== f) g.remove();
      }
    }
  } finally { host.remove(); }
  if (!contornos.length) throw new Error(tr('o SVG não tem formas que dê para extrudar'));
  return contornos.map(c => c.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]));
}
async function importarSvg() {
  novaPecaPreparar();
  const r = await anvil.importarSvg(); if (!r) return;
  criarDeSvg(r.texto, r.nome);
}
function criarDeSvg(texto, nome) {
  const r = { texto, nome };
  let cont;
  try { cont = contornosDoSvg(r.texto); } catch (e) { return mensagem(tt`Não foi possível ler o SVG: ${e.message}`, true); }
  const g = registro.obter('svg'); if (!g) return mensagem(tr('O gerador de SVG não está disponível.'), true);
  const xs = cont.flat().map(p => p[0]), larguraOrig = Math.max(...xs) - Math.min(...xs);
  const no = novaForma(g, { ...parametrosPadrao(g), contornos: JSON.stringify(cont), largura: arred(Math.min(150, Math.max(10, larguraOrig * 0.2646)), 2) }, g.cor);
  no.nome = r.nome; no.transformacao.posicao = posicaoNova();
  alterar(() => { E.doc.objetos.push(no); E.sel = [no.id]; });
  mensagem(tt`SVG importado: ${cont.length} contorno(s). Ajuste a largura e a altura no painel.`);
}
async function importarStl() {
  novaPecaPreparar();
  const r = await anvil.importar();
  if (!r) return;
  let d;
  try { d = lerStl(new Uint8Array(r.bytes)); } catch (e) { return mensagem(tr('Não foi possível ler o STL: ') + e.message, true); }
  const b = new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(d.v, 3)), c = b.getCenter(new THREE.Vector3());
  // se o STL já cabe na mesa (veio de uma mesa de impressora ou do próprio Anvil3D), mantém o lugar dele;
  // senão, a peça chega centrada e apoiada no meio da mesa. A origem local fica no centro da base.
  const naMesa = b.min.x >= -0.01 && b.min.y >= -0.01 && b.max.x <= mesaX + 0.01 && b.max.y <= mesaY + 0.01 && (!mesaRedonda || [[b.min.x, b.min.y], [b.max.x, b.min.y], [b.min.x, b.max.y], [b.max.x, b.max.y]].every(([x, y]) => Math.hypot(x - mesaX / 2, y - mesaY / 2) <= mesaX / 2 + 0.01)) && b.min.z >= -0.01;
  for (let i = 0; i < d.v.length; i += 3) { d.v[i] -= c.x; d.v[i + 1] -= c.y; d.v[i + 2] -= b.min.z; }
  const no = novaMalha(r.nome, CORES[E.corIdx++ % CORES.length]);
  no.transformacao.posicao = naMesa ? [arred(c.x), arred(c.y), arred(b.min.z)] : posicaoNova();
  gravarMalha(no, d);
  alterar(() => { E.doc.objetos.push(no); E.sel = [no.id]; });
  enquadrar();
  const g = diagDe(no);
  mensagem(tt`${r.nome}: ${fmtInt(d.t.length / 3)} triângulos importados.${g.ok ? tr(' Malha boa para impressão.') : tr(' A malha tem problemas: veja "Impressão 3D" no painel e use Reparar.')}`, !g.ok);
}
const fmtInt = n => inteiro(n);

// ---------- juntar faces (segure J, ou botão "Juntar faces") ----------
// 1º clique: uma face do objeto selecionado. 2º clique: a face do outro objeto.
// O objeto gira para as faces ficarem de frente uma para a outra e encosta.
// Com Ctrl no 2º clique só encosta, mantendo a posição lateral.
const matFaceOrigem = new THREE.MeshBasicMaterial({ color: 0xe0a100, transparent: true, opacity: 0.75, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthTest: true });
const matFaceAlvo = new THREE.MeshBasicMaterial({ color: 0x2e9b4e, transparent: true, opacity: 0.75, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
let JF = null; // { segurando, origem: {id, regiao} | null, destaques: [] }

function regioesDe(malha) {
  const pos = malha.geometry.attributes.position;
  const ent = [...cacheGeo.values()].find(c => c.geo === malha.geometry || c.geo.attributes.position === pos);
  if (!ent) return null;
  ent.regioes ??= regioesPlanas(ent.geo.attributes.position.array);
  return ent.regioes;
}
function entrarJF(segurando) {
  if (JF) return; encerrarModos('JF');
  if (!E.sel.length) return mensagem(tr('Selecione o objeto que vai se mover antes de juntar faces.'));
  JF = { segurando, origem: null, hover: null, destaques: [] };
  gizmo.detach(); vista.classList.add('escolhendo'); desenhar();
  mensagem(tr('Juntar faces: clique na face do objeto selecionado que vai encostar.'));
}
function sairJF() {
  if (!JF) return;
  for (const d of JF.destaques) { d.parent?.remove(d); d.geometry.dispose(); }
  JF = null; vista.classList.remove('escolhendo'); atualizarVisual();
}
function faceSobMouse(e, alvos) {
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hit = ray.intersectObjects(alvos, false)[0];
  if (!hit) return null;
  const reg = regioesDe(hit.object);
  if (!reg) return null;
  return { malha: hit.object, id: hit.object.userData.id, regiao: reg.regioes[reg.rotulo[hit.faceIndex]] };
}
function destacar(f, mat) {
  const pos = f.malha.geometry.attributes.position.array, p = new Float32Array(f.regiao.tris.length * 9);
  f.regiao.tris.forEach((t, k) => p.set(pos.subarray(t * 9, t * 9 + 9), k * 9));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.Mesh(g, mat); m.renderOrder = 30;
  f.malha.add(m); JF.destaques.push(m);
  return m;
}
const alvosJF = () => [...malhas.values()].filter(m => JF.origem ? !E.sel.includes(m.userData.id) : E.sel.includes(m.userData.id));
function hoverJF(e) {
  const f = faceSobMouse(e, alvosJF());
  const chave = f ? f.id + ':' + f.regiao.tris[0] : null;
  if (chave === JF.hover?.chave) return;
  if (JF.hover) { JF.hover.obj.parent?.remove(JF.hover.obj); JF.hover.obj.geometry.dispose(); JF.destaques = JF.destaques.filter(d => d !== JF.hover.obj); }
  JF.hover = f ? { chave, obj: destacar(f, JF.origem ? matFaceAlvo : matFaceOrigem) } : null;
  desenhar();
}
function emMundo(f) {
  f.malha.updateMatrixWorld(true);
  const n = new THREE.Vector3(...f.regiao.normal).applyMatrix3(new THREE.Matrix3().getNormalMatrix(f.malha.matrixWorld)).normalize();
  const c = new THREE.Vector3(...f.regiao.centro).applyMatrix4(f.malha.matrixWorld);
  return { n, c };
}
function clicarJF(e) {
  const f = faceSobMouse(e, alvosJF());
  if (!f) return;
  if (!JF.origem) {
    JF.origem = f; JF.hover = null; // o destaque da origem fica
    mensagem(tr('Agora clique na face do outro objeto. Ctrl+clique só encosta, sem centralizar.'));
    return;
  }
  if (E.sel.length === 1) {
    // a peça de destino não pode estar presa (direta ou indiretamente) na que vai se mover
    let n = noPorId(f.id), passos = 0;
    while (n?.juncao && passos++ < 50) { if (n.juncao.alvo === E.sel[0]) { sairJF(); return mensagem(tt`"${noPorId(f.id).nome}" já está presa em "${noPorId(E.sel[0]).nome}": não dá para prender uma na outra nos dois sentidos. Solte uma das junções antes (Shift+J).`, true); } n = noPorId(n.juncao.alvo); }
  }
  const tinhaJuncao = E.sel.length === 1 && juncaoAtiva(noPorId(E.sel[0]));
  const o = emMundo(JF.origem), a = emMundo(f);
  const q = new THREE.Quaternion().setFromUnitVectors(o.n, a.n.clone().negate());
  const R = new THREE.Matrix4().makeRotationFromQuaternion(q);
  const giro = new THREE.Matrix4().makeTranslation(o.c.x, o.c.y, o.c.z).multiply(R).multiply(new THREE.Matrix4().makeTranslation(-o.c.x, -o.c.y, -o.c.z));
  const desl = a.c.clone().sub(o.c);
  if (e.ctrlKey) desl.copy(a.n).multiplyScalar(desl.dot(a.n)); // só encosta
  const T = new THREE.Matrix4().makeTranslation(desl.x, desl.y, desl.z).multiply(giro);
  const ids = [...E.sel], origem = JF.origem;
  const contato = o.c.clone().add(desl);
  sairJF();
  const unico = ids.length === 1 ? noPorId(ids[0]) : null;
  alterar(() => {
    for (const id of ids) { const no = noPorId(id); definirMatriz(no, T.clone().multiply(matrizDoNo(no))); }
    if (unico) {
      const alvo = noPorId(f.id);
      unico.juncao = {
        alvo: alvo.id, ponto: contato.clone().applyMatrix4(matrizDoNo(alvo).invert()).toArray().map(x => arred(x, 5)),
        normal: f.regiao.normal.map(x => arred(x, 6)), giro: 0, afastamento: 0,
        face: { normal: origem.regiao.normal.map(x => arred(x, 6)), centro: origem.regiao.centro.map(x => arred(x, 5)) },
      };
      unico.juncao.giro = giroDaMatriz(unico, matrizDoNo(unico));
    }
  });
  const graus = 2 * Math.acos(Math.min(1, Math.abs(q.w))) * GRAU;
  mensagem(tt`Faces juntadas${graus > 0.05 ? tt` (girou ${fmt(graus, 1)}°)` : ''}${e.ctrlKey ? tr(', posição lateral mantida') : tr(', centros alinhados')}.` + (tinhaJuncao ? ' ' + tr('A junção anterior desta peça foi trocada por esta.') : ''));
  if (unico) iniciarAlinhar(unico);
}
renderer.domElement.addEventListener('pointermove', e => { if (JF && !e.buttons) hoverJF(e); });

// ---------- junções: a peça fica presa à face da outra ----------
// Guardado no objeto que se move:
//   juncao = { alvo, ponto, normal (face do alvo, coordenadas locais dele), giro (° em torno da normal),
//              afastamento (mm), face: { normal, centro } (face do próprio objeto, coordenadas locais) }
// A posição é sempre recalculada a partir disso: se o alvo se move, a peça acompanha;
// se a peça muda de tamanho, a face continua encostada.
const V3 = THREE.Vector3;
function eixoMenosAlinhado(n) {
  const a = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)], i = a.indexOf(Math.min(...a));
  return new V3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0);
}
const tangente = n => { const h = eixoMenosAlinhado(n); return h.sub(n.clone().multiplyScalar(h.dot(n))).normalize(); };
const anguloAssinado = (a, b, n) => Math.atan2(n.dot(a.clone().cross(b)), a.dot(b));
const juncaoAtiva = no => !!(no?.juncao && no.juncao.alvo !== no.id && noPorId(no.juncao.alvo));

const cacheRegLocal = new Map();
function regioesLocais(no) {
  const k = motor.chave(no);
  let r = cacheRegLocal.get(k);
  if (!r) {
    let pos, idx;
    if (no.tipo === 'malha') { const m = lerMalha(no); pos = m.v; idx = m.t; }
    else { const d = dadosMalha(motor.local(no)); pos = d.posicoes; idx = d.indices; }
    const p = new Float32Array(idx.length * 3);
    for (let i = 0; i < idx.length; i++) { p[i * 3] = pos[idx[i] * 3]; p[i * 3 + 1] = pos[idx[i] * 3 + 1]; p[i * 3 + 2] = pos[idx[i] * 3 + 2]; }
    r = regioesPlanas(p);
    if (cacheRegLocal.size > 60) cacheRegLocal.clear();
    cacheRegLocal.set(k, r);
  }
  return r;
}
function casarFace(regs, normal, centro) {
  let melhor = null, dm = Infinity;
  for (const g of regs.regioes) {
    if (g.normal[0] * normal[0] + g.normal[1] * normal[1] + g.normal[2] * normal[2] < 0.999) continue;
    const d = Math.hypot(g.centro[0] - centro[0], g.centro[1] - centro[1], g.centro[2] - centro[2]);
    if (d < dm) { dm = d; melhor = g; }
  }
  return melhor;
}
function baseJuncao(no) {
  const j = no.juncao, alvo = noPorId(j.alvo), MT = matrizDoNo(alvo);
  const S = new V3(...no.transformacao.escala);
  const a3 = new V3(...j.face.normal).divide(S).normalize(), a1 = tangente(a3), a2 = a3.clone().cross(a1);
  const P = new V3(...j.ponto).applyMatrix4(MT);
  const N = new V3(...j.normal).applyMatrix3(new THREE.Matrix3().getNormalMatrix(MT)).normalize();
  const T = tangente(new V3(...j.normal)).transformDirection(MT);
  T.sub(N.clone().multiplyScalar(T.dot(N))).normalize();
  return { j, MT, S, a1, a2, a3, P, N, T };
}
function atualizarFacesJuncao(no) {
  const j = no.juncao, alvo = noPorId(j.alvo);
  try { const g = casarFace(regioesLocais(no), j.face.normal, j.face.centro); if (g) j.face.centro = g.centro.map(x => arred(x, 5)); } catch {}
  try {
    const g = casarFace(regioesLocais(alvo), j.normal, j.ponto);
    if (g && g.tris.length > 1) { // face plana: mantém o ponto sobre o plano dela
      const n = new V3(...g.normal), c = new V3(...g.centro), p = new V3(...j.ponto);
      p.sub(n.clone().multiplyScalar(p.clone().sub(c).dot(n)));
      j.ponto = p.toArray().map(x => arred(x, 5));
    }
  } catch {}
}
function matrizJuncao(no) {
  atualizarFacesJuncao(no);
  const { j, S, a1, a2, a3, P, N, T } = baseJuncao(no);
  const b3 = N.clone().negate(), b1 = T.clone().applyAxisAngle(N, j.giro * RAD), b2 = b3.clone().cross(b1);
  const R = new THREE.Matrix4().makeBasis(b1, b2, b3).multiply(new THREE.Matrix4().makeBasis(a1, a2, a3).transpose());
  const cS = new V3(...j.face.centro).multiply(S).applyMatrix4(R);
  const O = P.clone().add(N.clone().multiplyScalar(j.afastamento ?? 0)).sub(cS);
  return new THREE.Matrix4().makeTranslation(O.x, O.y, O.z).multiply(R).multiply(new THREE.Matrix4().makeScale(S.x, S.y, S.z));
}
function giroDaMatriz(no, M) {
  const { a1, N, T } = baseJuncao(no);
  const q = new THREE.Quaternion(); M.decompose(new V3(), q, new V3());
  return arred(normAng(anguloAssinado(T, a1.clone().applyQuaternion(q), N) * GRAU), 4);
}
// Recalcula na hora as peças presas (sem histórico): usada durante arrastes, giros e redimensionamentos
function previaJuncoes(movendo = new Set()) {
  let algum = false;
  for (let passo = 0; passo < 4; passo++)
    for (const no of E.doc.objetos) {
      if (!juncaoAtiva(no) || (movendo.has(no.id) && !movendo.has(no.juncao.alvo))) continue;
      try {
        definirMatriz(no, matrizJuncao(no));
        const m = malhas.get(no.id); if (m) { aplicarTransformacao(m, no.transformacao); m.updateMatrixWorld(true); }
        algum = true;
      } catch {}
    }
  if (algum) desenhar();
}
function posicionarJuncoes() {
  for (let passo = 0; passo < 4; passo++) // cadeias: A presa em B presa em C
    for (const no of E.doc.objetos) if (juncaoAtiva(no)) { try { definirMatriz(no, matrizJuncao(no)); } catch {} }
}

// --- deslizar a peça presa sobre a outra (arrastando com o mouse) ---
let deslize = null;
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.button !== 0 || MA || ME || JF || AL || E.escolhendoPonto || E.sel.length !== 1) return;
  if (gizmo.object && gizmo.axis !== null) return; // pegou o anel do gizmo
  const no = noPorId(E.sel[0]);
  if (!juncaoAtiva(no)) return;
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  if (!ray.intersectObject(malhas.get(no.id), false).length) return;
  deslize = { id: no.id, antes: hist.instantaneo(E.doc), moveu: false };
  if (E.modoGizmo === 'girar') {
    const { N } = baseJuncao(no), m = malhas.get(no.id); m.updateMatrixWorld(true);
    const c = new THREE.Box3().setFromObject(m, true).getCenter(new V3()), q = c.clone().project(camera);
    deslize.giro = {
      cx: r.left + (q.x + 1) / 2 * r.width, cy: r.top + (1 - q.y) / 2 * r.height,
      a0: null, g0: no.juncao.giro,
      // se a normal aponta para a câmera, o sentido da tela é o mesmo do giro
      sinal: N.dot(camera.position.clone().sub(c)) >= 0 ? 1 : -1,
    };
  }
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!deslize) return;
  if (deslize.giro) {
    const g = deslize.giro, a = Math.atan2(-(e.clientY - g.cy), e.clientX - g.cx) * GRAU;
    if (g.a0 === null) { g.a0 = a; return; }
    let d = normAng(a - g.a0) * g.sinal;
    const passo = Number($('#passo-giro').value) || 0;
    if (passo) d = Math.round(d / passo) * passo;
    const no = noPorId(deslize.id);
    no.juncao.giro = arred(normAng(g.g0 + d), 4);
    definirMatriz(no, matrizJuncao(no)); aplicarTransformacao(malhas.get(no.id), no.transformacao);
    previaJuncoes(new Set([no.id])); posicionarAjudanteGiro();
    mostrarCotaMov(tt`Giro na face ${fmt(no.juncao.giro, 1)}°`);
    deslize.moveu = true; desenhar();
    return;
  }
  const no = noPorId(deslize.id), j = no.juncao, alvoMalha = malhas.get(j.alvo);
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hit = ray.intersectObject(alvoMalha, false)[0];
  if (!hit) return;
  // transporte paralelo: a peça não "gira sozinha" ao passar por uma curva
  const antes = baseJuncao(no), q0 = new THREE.Quaternion();
  matrizDoNo(no).decompose(new V3(), q0, new V3());
  const b1 = antes.a1.clone().applyQuaternion(q0);
  const inv = matrizDoNo(noPorId(j.alvo)).invert();
  j.ponto = hit.point.clone().applyMatrix4(inv).toArray().map(x => arred(x, 5));
  j.normal = hit.face.normal.toArray().map(x => arred(x, 6));
  const depois = baseJuncao(no);
  b1.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(antes.N, depois.N));
  j.giro = arred(normAng(anguloAssinado(depois.T, b1, depois.N) * GRAU), 4);
  definirMatriz(no, matrizJuncao(no));
  aplicarTransformacao(malhas.get(no.id), no.transformacao);
  deslize.moveu = true;
  desenhar();
});
renderer.domElement.addEventListener('pointerup', () => {
  if (!deslize) return;
  const d = deslize; deslize = null; cotaMov.hidden = true;
  if (!d.moveu) return;
  hist.registrarTexto(d.antes);
  posicionarJuncoes(); marcarSujo(); reconstruir3d(); montarPainel();
});

// --- alinhar arestas (terceiro passo do Juntar faces, ou botão no painel) ---
let AL = null;
const grupoAlinhar = new THREE.Group(); cena.add(grupoAlinhar);
const MAT_ALVO = new LineMaterial({ color: 0x2e9b4e, linewidth: 2.5 });
const MAT_ALVO_HOVER = new LineMaterial({ color: 0x3fd06a, linewidth: 7 });
function arestasMundo(no) {
  const t = no.transformacao;
  const M = new THREE.Matrix4().compose(new V3(...t.posicao), new THREE.Quaternion().setFromEuler(new THREE.Euler(...t.rotacao.map(a => a * RAD), 'XYZ')), new V3(1, 1, 1));
  const s = motor.local(no).scale(t.escala), fs = extrairArestas(s).filter(f => f.tipo === 'reta'); s.delete();
  return fs.map(f => ({ a: new V3(...f.a).applyMatrix4(M), b: new V3(...f.b).applyMatrix4(M) }));
}
function iniciarAlinhar(no) {
  if (!juncaoAtiva(no)) return;
  sairAlinhar();
  let fo, fa;
  try { fo = arestasMundo(no); fa = arestasMundo(noPorId(no.juncao.alvo)); } catch (e) { return mensagem(e.message, true); }
  AL = { id: no.id, fo, fa, origem: -1, hover: null, linhas: [] };
  const linha = (f, lado, i) => {
    const l = new LineSegments2(new LineSegmentsGeometry().setPositions([...f.a.toArray(), ...f.b.toArray()]), lado === 'o' ? MAT.cand : MAT_ALVO);
    l.userData = { lado, i }; l.renderOrder = 12; grupoAlinhar.add(l); AL.linhas.push(l);
  };
  fo.forEach((f, i) => linha(f, 'o', i)); fa.forEach((f, i) => linha(f, 'a', i));
  for (const m of Object.values(MAT)) m.needsUpdate = true;
  MAT_ALVO.resolution.copy(MAT.cand.resolution); MAT_ALVO_HOVER.resolution.copy(MAT.cand.resolution);
  gizmo.detach(); vista.classList.add('escolhendo');
  mensagem(tr('Alinhar arestas (opcional): clique numa aresta da peça presa e depois numa aresta da outra peça. Esc pula.'));
  desenhar();
}
function sairAlinhar() {
  if (!AL) return;
  for (const l of AL.linhas) { l.geometry.dispose(); grupoAlinhar.remove(l); }
  AL = null; vista.classList.remove('escolhendo'); atualizarVisual();
}
function linhaSobMouse(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  ray.params.Line2 = { threshold: 7 };
  const lado = AL.origem < 0 ? 'o' : 'a';
  return ray.intersectObjects(AL.linhas.filter(l => l.userData.lado === lado), false)[0]?.object ?? null;
}
function estilizarAlinhar() {
  for (const l of AL.linhas) {
    const { lado, i } = l.userData;
    l.material = lado === 'o'
      ? (i === AL.origem ? MAT.sel : l === AL.hover ? MAT.hover : MAT.cand)
      : (l === AL.hover ? MAT_ALVO_HOVER : MAT_ALVO);
  }
  desenhar();
}
renderer.domElement.addEventListener('pointermove', e => {
  if (!AL || e.buttons) return;
  const l = linhaSobMouse(e);
  if (l !== AL.hover) { AL.hover = l; estilizarAlinhar(); }
});
function clicarAlinhar(e) {
  const l = linhaSobMouse(e);
  if (!l) return;
  if (AL.origem < 0) { AL.origem = l.userData.i; AL.hover = null; estilizarAlinhar(); return mensagem(tr('Agora clique na aresta da outra peça.')); }
  const no = noPorId(AL.id), ea = AL.fo[AL.origem], eb = AL.fa[l.userData.i];
  const { N, P, MT } = baseJuncao(no);
  const plano = v => v.sub(N.clone().multiplyScalar(v.dot(N))).normalize();
  const dA = plano(ea.b.clone().sub(ea.a)), dB = plano(eb.b.clone().sub(eb.a));
  if (dA.lengthSq() < 0.5 || dB.lengthSq() < 0.5) return mensagem(tr('Escolha arestas que fiquem no plano da junção.'), true);
  let fi = anguloAssinado(dA, dB, N);
  if (fi > Math.PI / 2) fi -= Math.PI; if (fi < -Math.PI / 2) fi += Math.PI;
  const pA = ea.a.clone().add(ea.b).multiplyScalar(0.5).sub(P).applyAxisAngle(N, fi).add(P);
  const w = N.clone().cross(dB).normalize(), s = eb.a.clone().sub(pA).dot(w);
  const novoP = P.clone().add(w.multiplyScalar(s)).applyMatrix4(MT.clone().invert());
  sairAlinhar();
  alterar(() => {
    no.juncao.giro = arred(normAng(no.juncao.giro + fi * GRAU), 4);
    no.juncao.ponto = novoP.toArray().map(x => arred(x, 5));
  });
  mensagem(tt`Arestas alinhadas (girou ${fmt(fi * GRAU, 1)}° na face). A junção continua: arraste a peça para deslizar.`);
}

// ---------- alças de tamanho e cotas na vista (como no Tinkercad) ----------
const grupoAlcas = new THREE.Group(); cena.add(grupoAlcas);
const geoAlca = new THREE.BoxGeometry(1, 1, 1);
const matAlca = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true });
const matAlcaHover = new THREE.MeshBasicMaterial({ color: 0xe0a100, depthTest: false, transparent: true });
const matAlcaProp = new THREE.MeshBasicMaterial({ color: 0x2a7fd4, depthTest: false, transparent: true });   // Shift: redimensiona proporcional
let shiftApertado = false;
const atualizarShift = e => { if (e.shiftKey !== shiftApertado) { shiftApertado = e.shiftKey; desenhar(); } };
window.addEventListener('keydown', atualizarShift); window.addEventListener('keyup', atualizarShift);
window.addEventListener('blur', () => { shiftApertado = false; });
const matAlcaBorda = new THREE.LineBasicMaterial({ color: 0x1e2a30, depthTest: false, transparent: true });
const camadaCotas = el('div', { id: 'cotas' }); vista.appendChild(camadaCotas);
const ALCAS = { 'x+': [[0, 1]], 'x-': [[0, -1]], 'y+': [[1, 1]], 'y-': [[1, -1]], 'z+': [[2, 1]],
  'x+y+': [[0, 1], [1, 1]], 'x+y-': [[0, 1], [1, -1]], 'x-y+': [[0, -1], [1, 1]], 'x-y-': [[0, -1], [1, -1]] };
let alcaHover = null, arrasteAlca = null;
const eixoV = i => new V3(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0);

// Seleção de várias peças: as alças e cotas valem para a caixa da seleção inteira (como uma peça só)
const objIdentidade = new THREE.Object3D(); objIdentidade.updateMatrixWorld(true);
function idsEscalaveis() { return E.sel.filter(id => malhas.has(id) && !malhas.get(id).userData.erro && !juncaoAtiva(noPorId(id))); }
function alvoAlcas() {
  if (MA || ME || JF || AL || FM || ALN || ESP || E.escolhendoPonto) return null;
  if (E.sel.length > 1) {
    const ids = idsEscalaveis(); if (ids.length < 2) return null;
    const b = new THREE.Box3(); for (const id of ids) b.union(caixaDe(id));
    return { no: { multi: true, ids, transformacao: { posicao: [0, 0, 0], rotacao: [0, 0, 0], escala: [1, 1, 1] } }, m: objIdentidade, b };
  }
  if (E.sel.length !== 1) return null;
  const no = noPorId(E.sel[0]), m = malhas.get(E.sel[0]);
  if (!no || !m || m.userData.erro || !m.geometry.boundingBox) return null;
  return { no, m, b: m.geometry.boundingBox };
}
function pontoLocalAlca(b, chave) {
  const p = [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.min.z];
  if (chave === 'z+') p[2] = b.max.z;
  for (const [i, s] of ALCAS[chave]) p[i] = s > 0 ? b.max.getComponent(i) : b.min.getComponent(i);
  return new V3(...p);
}
let alcasLaterais = localStorage.getItem('alcasLaterais') === '1';
setTimeout(() => { document.querySelector('[data-cmd=alcasLaterais]')?.classList.toggle('ativo', alcasLaterais); document.querySelector('[data-cmd=moverPeca]')?.classList.toggle('ativo', localStorage.getItem('moverPeca') !== '0'); }, 0);
function atualizarAlcas() {
  const a = alvoAlcas();
  if (!a) { grupoAlcas.visible = false; camadaCotas.replaceChildren(); return; }
  grupoAlcas.visible = true;
  a.m.updateMatrixWorld(true);
  if (!grupoAlcas.children.length) for (const k of Object.keys(ALCAS)) {
    const h = new THREE.Mesh(geoAlca, matAlca); h.userData.alca = k; h.renderOrder = 40;
    const borda = new THREE.LineSegments(new THREE.EdgesGeometry(geoAlca), matAlcaBorda); borda.renderOrder = 41;
    h.add(borda); grupoAlcas.add(h);
  }
  for (const h of grupoAlcas.children) {
    h.visible = alcasLaterais || h.userData.alca.length > 2 || h.userData.alca === 'z+';
    const p = pontoLocalAlca(a.b, h.userData.alca).applyMatrix4(a.m.matrixWorld);
    h.position.copy(p);
    h.quaternion.copy(a.m.getWorldQuaternion(new THREE.Quaternion()));
    h.scale.setScalar(camera.position.distanceTo(p) * (h.userData.alca.length > 2 ? 0.014 : 0.012));
    const prop = shiftApertado && (h.userData.alca === alcaHover || arrasteAlca?.chave === h.userData.alca || (arrasteAlca?.no && arrasteAlca.prop));
    h.material = prop ? matAlcaProp : h.userData.alca === alcaHover ? matAlcaHover : matAlca;
  }
}
// Cotas só aparecem quando você aponta para uma alça (ou arrasta uma), como no Tinkercad, e
// mostram só as medidas que aquela alça muda; somem ao girar a vista. Ficam um instante na tela
// depois que o mouse sai da alça, para dar tempo de clicar nelas e digitar.
let cotasAlca = null, cotasAte = 0, orbitando = false, mouseNaCota = false, cotasSel = '', proximaCota = null;
orbita.addEventListener('start', () => { orbitando = true; cotasAte = 0; cotasAlca = null; });
// clicar em qualquer lugar da vista que não seja alça nem cota esconde as cotas
renderer.domElement.addEventListener('pointerdown', () => { if (!alcaHover) { cotasAlca = null; cotasAte = 0; } });
orbita.addEventListener('end', () => { orbitando = false; });
function atualizarCotas() {
  if (arrasteAlca?.digitando) return;
  const a = alvoAlcas();
  const selAtual = E.sel.join();
  if (cotasSel !== selAtual) { cotasSel = selAtual; cotasAlca = null; }
  if (alcaHover || arrasteAlca?.chave) { cotasAlca = arrasteAlca?.chave ?? alcaHover; cotasAte = Infinity; }
  const mostrar = a && !orbitando && cotasAlca && (performance.now() < cotasAte || mouseNaCota);
  if (!mostrar) { if (!mouseNaCota) camadaCotas.replaceChildren(); return; }
  camadaCotas.replaceChildren();
  const eixosAlca = shiftApertado || cotasAlca === 'todas' ? [0, 1, 2] : ALCAS[cotasAlca].map(([i]) => i);
  const s = a.no.transformacao.escala, b = a.b, tam = [0, 1, 2].map(i => (b.max.getComponent(i) - b.min.getComponent(i)) * Math.abs(s[i]));
  const r = renderer.domElement.getBoundingClientRect(), v = vista.getBoundingClientRect();
  const pos = [ // onde cada cota aparece (local), um pouco para fora da peça
    new V3((b.min.x + b.max.x) / 2, b.min.y, b.min.z), new V3(b.max.x, (b.min.y + b.max.y) / 2, b.min.z), new V3(b.max.x, b.min.y, (b.min.z + b.max.z) / 2)];
  const fora = [new V3(0, -1, 0), new V3(1, 0, 0), new V3(1, -1, 0)];
  pos.forEach((p, i) => {
    if (!eixosAlca.includes(i)) return;
    const w = p.clone().applyMatrix4(a.m.matrixWorld);
    const dirFora = fora[i].clone().transformDirection(a.m.matrixWorld).multiplyScalar(camera.position.distanceTo(w) * 0.06);
    const q = w.add(dirFora).project(camera);
    if (q.z > 1) return;
    const m = 34, x = Math.min(v.width - m, Math.max(m, (q.x + 1) / 2 * r.width + r.left - v.left)), y = Math.min(v.height - 16, Math.max(16, (1 - q.y) / 2 * r.height + r.top - v.top));
    const c = el('button', { class: 'cota', title: tr('Clique para digitar a medida'), 'data-eixo': String(i) }, fmt(tam[i], 2));
    c.style.left = x + 'px'; c.style.top = y + 'px';
    // clicar numa cota enquanto outra está sendo digitada: aplica a primeira e já abre esta
    c.addEventListener('pointerdown', ev => { ev.stopPropagation(); if (arrasteAlca?.digitando) proximaCota = i; });
    c.addEventListener('pointerenter', () => { mouseNaCota = true; });
    c.addEventListener('pointerleave', () => { mouseNaCota = false; });
    if (shiftApertado) { c.classList.add('proporcional'); c.title = tr('Shift: muda as três medidas na mesma proporção'); }
    c.addEventListener('click', ev => { ev.stopPropagation(); editarCota(c, a.no, i, tam[i], ev.shiftKey, tam); });
    camadaCotas.append(c);
  });
}
function editarCota(botao, no, eixo, atual, proporcional = false, tam = null) {
  arrasteAlca = { digitando: true };
  const i = el('input', { class: 'cota' + (proporcional ? ' proporcional' : ''), value: fmt(atual, 2), title: proporcional ? tr('Proporcional: as três medidas mudam juntas') : '' });
  i.style.left = botao.style.left; i.style.top = botao.style.top;
  botao.replaceWith(i); i.focus(); i.select();
  let feito = false;
  const fim = aplicar => {
    if (feito) return; feito = true; arrasteAlca = null; mouseNaCota = false;
    cotasAte = Infinity; // as cotas continuam na tela depois de digitar
    const seguinte = proximaCota; proximaCota = null;
    if (seguinte !== null) requestAnimationFrame(() => { desenhar(); camadaCotas.querySelector(`[data-eixo="${seguinte}"]`)?.click(); });
    const v = lerNumero(i.value);
    if (aplicar && v > 0 && Math.abs(v - atual) > 1e-6) {
      if (no.multi) { escalarSelecaoPara(proporcional ? { 0: tam[0] * v / atual, 1: tam[1] * v / atual, 2: tam[2] * v / atual } : { [eixo]: v }); return; }
      const b = malhas.get(no.id).geometry.boundingBox;
      const novos = proporcional ? { 0: tam[0] * v / atual, 1: tam[1] * v / atual, 2: tam[2] * v / atual } : { [eixo]: v };
      alterar(() => redimensionar(no, b, eixo === 2 || proporcional ? 'z+' : (eixo === 0 ? 'x+' : 'y+'), novos, eixo !== 2 || proporcional));
    } else desenhar();
  };
  i.addEventListener('keydown', e => { if (e.key === 'Enter') fim(true); if (e.key === 'Escape') fim(false); e.stopPropagation(); });
  i.addEventListener('blur', () => fim(true));
}
// Escala várias peças juntas em volta do ponto A (mundo), pelos fatores f em X, Y, Z.
// Peças giradas fora de múltiplos de 90° não aceitam escala diferente por eixo sem deformar (cisalhar):
// nesse caso a escala vira proporcional (o maior fator nos três eixos).
function escalarVarias(ids, M0, f, A) {
  const girada = ids.some(id => noPorId(id).transformacao.rotacao.some(r => Math.abs(((r % 90) + 90) % 90) > 0.01 && Math.abs(((r % 90) + 90) % 90 - 90) > 0.01));
  let ff = f;
  if (girada && !(Math.abs(f[0] - f[1]) < 1e-9 && Math.abs(f[1] - f[2]) < 1e-9)) { const k = f.reduce((a, x) => Math.abs(x - 1) > Math.abs(a - 1) ? x : a, 1); ff = [k, k, k]; }
  const S = new THREE.Matrix4().makeTranslation(A.x, A.y, A.z).multiply(new THREE.Matrix4().makeScale(...ff)).multiply(new THREE.Matrix4().makeTranslation(-A.x, -A.y, -A.z));
  for (const id of ids) { const no = noPorId(id); definirMatriz(no, S.clone().multiply(M0.get(id))); aplicarTransformacao(malhas.get(id), no.transformacao); }
  return ff !== f;
}
function escalarSelecaoPara(novos, centralizado = true, chave = 'z+') {
  const ids = idsEscalaveis(); if (!ids.length) return;
  const b = new THREE.Box3(); for (const id of ids) b.union(caixaDe(id));
  const A = new V3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.min.z);
  if (!centralizado) for (const [i, s] of ALCAS[chave]) A.setComponent(i, s > 0 ? b.min.getComponent(i) : b.max.getComponent(i));
  const tam = b.getSize(new V3()).toArray(), f = [0, 1, 2].map(i => novos[i] !== undefined && tam[i] > 0 ? novos[i] / tam[i] : 1);
  const M0 = new Map(ids.map(id => [id, matrizDoNo(noPorId(id))]));
  let forcou = false;
  alterar(() => { forcou = escalarVarias(ids, M0, f, A); });
  if (forcou) mensagem(tr('Há peças giradas na seleção: a escala foi aplicada igual nos três eixos para não deformá-las.'));
}
// Muda o tamanho mantendo fixo o lado oposto à alça (ou o centro, se centralizado).
function redimensionar(no, b, chave, novos, centralizado = false) {
  const t = no.transformacao, q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...t.rotacao.map(a => a * RAD), 'XYZ'));
  const M0 = matrizDoNo(no);
  const ancora = new V3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.min.z);
  if (!centralizado) for (const [i, s] of ALCAS[chave]) ancora.setComponent(i, s > 0 ? b.min.getComponent(i) : b.max.getComponent(i));
  const A = ancora.clone().applyMatrix4(M0);
  const esc = [...t.escala];
  for (const [i, v] of Object.entries(novos)) {
    const base = b.max.getComponent(+i) - b.min.getComponent(+i);
    if (base > 0) esc[+i] = arred((Math.sign(t.escala[+i]) || 1) * v / base, 6);
  }
  const Ra = ancora.clone().multiply(new V3(...esc)).applyQuaternion(q);
  t.escala = esc;
  t.posicao = A.sub(Ra).toArray().map(x => arred(x));
}
function raioDoMouse(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  return ray;
}
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !grupoAlcas.visible) return;
  const a = alvoAlcas();
  if (!a) return;
  const hit = raioDoMouse(e).intersectObjects(grupoAlcas.children.filter(h => h.visible), false)[0];
  if (!hit) return;
  const chave = hit.object.userData.alca;
  e.stopImmediatePropagation();
  gizmo.enabled = false;
  const t = a.no.transformacao, q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...t.rotacao.map(x => x * RAD), 'XYZ'));
  const H0 = hit.object.position.clone();
  const ancora = pontoLocalAlca(a.b, chave);
  for (const [i, s] of ALCAS[chave]) ancora.setComponent(i, s > 0 ? a.b.min.getComponent(i) : a.b.max.getComponent(i));
  arrasteAlca = {
    no: a.no, b: a.b.clone(), chave, H0, q, antes: hist.instantaneo(E.doc), moveu: false,
    M0: a.no.multi ? new Map(a.no.ids.map(id => [id, matrizDoNo(noPorId(id))])) : null,
    A: ancora.applyMatrix4(matrizDoNo(a.no)),
    plano: new THREE.Plane().setFromNormalAndCoplanarPoint(eixoV(2).applyQuaternion(q), H0),
    tam0: [0, 1, 2].map(i => (a.b.max.getComponent(i) - a.b.min.getComponent(i)) * Math.abs(t.escala[i])),
  };
  renderer.domElement.setPointerCapture(e.pointerId);
}, true);
renderer.domElement.addEventListener('pointermove', e => {
  if (arrasteAlca?.no) {
    const d = arrasteAlca, rr = raioDoMouse(e).ray, eixos = ALCAS[d.chave];
    let W;
    if (eixos.length === 1) { // ponto da linha do eixo mais perto do raio do mouse
      const D = eixoV(eixos[0][0]).applyQuaternion(d.q);
      const w0 = d.H0.clone().sub(rr.origin), b = D.dot(rr.direction), dd = D.dot(w0), ee = rr.direction.dot(w0), den = 1 - b * b;
      if (den < 1e-6) return;
      W = d.H0.clone().add(D.multiplyScalar((b * ee - dd) / den));
    } else { W = rr.intersectPlane(d.plano, new V3()); if (!W) return; }
    const passo = Number($('#passo-mov').value) || 0;
    const novos = {};
    for (const [i, s] of eixos) {
      let v = s * W.clone().sub(d.A).dot(eixoV(i).applyQuaternion(d.q));
      if (passo) v = Math.round(v / passo) * passo;
      novos[i] = Math.max(passo || 0.1, v);
    }
    d.prop = e.shiftKey;
    if (e.shiftKey) { // Shift: proporcional nos três eixos (o fator é o do eixo que mais mudou)
      const f = Math.max(...eixos.map(([i]) => novos[i] / d.tam0[i]));
      for (const i of [0, 1, 2]) novos[i] = d.tam0[i] * f;
    }
    if (E.modoGizmo === 'girar') requestAnimationFrame(() => { try { posicionarAjudanteGiro(); } catch {} });
    afetadasAoVivo();
    if (d.no.multi) {
      const f = [0, 1, 2].map(i => novos[i] !== undefined && d.tam0[i] > 0 ? novos[i] / d.tam0[i] : 1);
      d.forcou = escalarVarias(d.no.ids, d.M0, f, d.A);
    } else {
      redimensionar(d.no, d.b, d.chave, novos);
      aplicarTransformacao(malhas.get(d.no.id), d.no.transformacao);
    }
    previaJuncoes();
    d.moveu = true;
    mensagem((e.shiftKey ? [0, 1, 2] : eixos.map(([i]) => i)).map(i => `${'XYZ'[i]} ${fmt(novos[i], 2)} mm`).join('  ·  ') + (e.shiftKey ? tr('   (proporcional)') : tr('   (Shift mantém a proporção)')));
    desenhar();
    return;
  }
  if (!e.buttons && grupoAlcas.visible) {
    const h = raioDoMouse(e).intersectObjects(grupoAlcas.children.filter(h => h.visible), false)[0]?.object.userData.alca ?? null;
    if (h !== alcaHover) { alcaHover = h; renderer.domElement.style.cursor = h ? 'pointer' : ''; desenhar(); }
  }
});
renderer.domElement.addEventListener('pointerup', e => {
  if (!arrasteAlca?.no) return;
  const d = arrasteAlca; arrasteAlca = null; gizmo.enabled = true;
  e.stopImmediatePropagation();
  if (!d.moveu) return;
  hist.registrarTexto(d.antes);
  posicionarJuncoes(); marcarSujo(); reconstruir3d(); montarPainel();
  if (d.forcou) mensagem(tr('Há peças giradas na seleção: a escala foi aplicada igual nos três eixos para não deformá-las.'));
}, true);

window.__alcasOk = true;

// ---------- face na mesa: escolher a face que fica apoiada no plano ----------
let FM = null;
function entrarFM() {
  encerrarModos('FM');
  if (FM || JF || MA || ME || AL) return;
  if (!E.sel.length) return mensagem(tr('Selecione o objeto antes de escolher a face que vai para a mesa.'));
  if (E.sel.some(id => juncaoAtiva(noPorId(id)))) return mensagem(tr('A peça está presa por junção: solte a junção antes de apoiá-la na mesa.'), true);
  FM = { hover: null };
  gizmo.detach(); vista.classList.add('escolhendo'); desenhar();
  mensagem(tr('Face na mesa: passe o mouse sobre a peça e clique na face que deve ficar apoiada no plano. Esc cancela.'));
}
function limparHoverFM() { if (FM?.hover) { FM.hover.parent?.remove(FM.hover); FM.hover.geometry.dispose(); FM.hover = null; } }
function sairFM() { if (!FM) return; limparHoverFM(); FM = null; vista.classList.remove('escolhendo'); atualizarVisual(); }
renderer.domElement.addEventListener('pointermove', e => {
  if (!FM || e.buttons) return;
  const f = faceSobMouse(e, E.sel.map(id => malhas.get(id)).filter(Boolean));
  const chave = f ? f.id + ':' + f.regiao.tris[0] : null;
  if (chave === FM.chave) return;
  limparHoverFM(); FM.chave = chave;
  if (f) {
    const pos = f.malha.geometry.attributes.position.array, p = new Float32Array(f.regiao.tris.length * 9);
    f.regiao.tris.forEach((t, k) => p.set(pos.subarray(t * 9, t * 9 + 9), k * 9));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    FM.hover = new THREE.Mesh(g, matFaceOrigem); FM.hover.renderOrder = 30; f.malha.add(FM.hover);
  }
  desenhar();
});
function clicarFM(e) {
  const f = faceSobMouse(e, E.sel.map(id => malhas.get(id)).filter(Boolean));
  if (!f) return;
  const { n, c } = emMundo(f);
  const q = new THREE.Quaternion().setFromUnitVectors(n, new V3(0, 0, -1));
  const G = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
  const ids = [...E.sel];
  sairFM();
  alterar(() => {
    for (const id of ids) { const no = noPorId(id); definirMatriz(no, G.clone().multiply(matrizDoNo(no))); }
    // desce (ou sobe) tudo junto até o ponto mais baixo encostar em Z = 0
    const b = new THREE.Box3();
    for (const id of ids) { const m = malhas.get(id); aplicarTransformacao(m, noPorId(id).transformacao); m.updateMatrixWorld(true); b.expandByObject(m, true); }
    for (const id of ids) { const t = noPorId(id).transformacao; t.posicao[2] = arred(t.posicao[2] - b.min.z); }
  });
  const graus = 2 * Math.acos(Math.min(1, Math.abs(q.w))) * GRAU;
  mensagem(tt`Face apoiada na mesa${graus > 0.05 ? tt` (girou ${fmt(graus, 1)}°)` : ''}.`);
}

// ---------- menus da barra ----------
let menuAberto = null;
function abrirMenu(m) {
  if (menuAberto && menuAberto !== m) fecharMenu();
  menuAberto = m; m.classList.add('aberto'); m.querySelector('.menu-itens').hidden = false;
}
function fecharMenu() {
  if (!menuAberto) return;
  menuAberto.classList.remove('aberto'); menuAberto.querySelector('.menu-itens').hidden = true; menuAberto = null;
}
for (const m of document.querySelectorAll('#barra .menu')) {
  m.querySelector('.menu-titulo').addEventListener('click', e => { e.stopPropagation(); menuAberto === m ? fecharMenu() : abrirMenu(m); });
  m.querySelector('.menu-titulo').addEventListener('mouseenter', () => { if (menuAberto && menuAberto !== m) abrirMenu(m); });
}
document.addEventListener('click', e => { if (menuAberto && (!e.target.closest('.menu') || e.target.closest('.menu-itens [data-cmd]'))) setTimeout(fecharMenu, 0); });

// ---------- alinhar vários objetos ----------
// Sem referência, cada eixo vai para a média dos objetos; clicando num objeto, ele vira a referência.
let ALN = null;
function entrarAlinhar() {
  encerrarModos('ALN');
  if (E.sel.length < 2) return mensagem(tr('Selecione dois ou mais objetos para alinhar (Shift+clique).'));
  ALN = { ref: null };
  gizmo.detach(); atualizarVisual(); montarPainel(); montarPontosAlinhar();
  mensagem(tr('Alinhar: clique nos pontos pretos em volta da seleção (ou nos botões do painel). Clique numa das peças para fixá-la como referência; sem referência, vale a média.'));
}
function sairAlinharObj() { if (!ALN) return; tirarPreviaAlinhar(); ALN = null; grupoPontosAln.clear(); atualizarVisual(); montarPainel(); }
function clicarALN(e) {
  const pt = pontoAlinharSob(e);
  if (pt) { tirarPreviaAlinhar(); ALN.hover = null; alinharObjetos(...pt.userData.alinhar); return; }
  const hit = raioDoMouse(e).intersectObjects(E.sel.map(id => malhas.get(id)).filter(Boolean), false)[0];
  if (!hit) return;
  const id = hit.object.userData.id;
  ALN.ref = ALN.ref === id ? null : id;
  atualizarVisual(); montarPainel(); montarPontosAlinhar();
}
function caixaDe(id) { const m = malhas.get(id); m.updateMatrixWorld(true); return new THREE.Box3().expandByObject(m, true); }
function alinharObjetos(eixo, onde) { // onde: 0 = mínimo, 0.5 = centro, 1 = máximo
  const valor = b => b.min.getComponent(eixo) + (b.max.getComponent(eixo) - b.min.getComponent(eixo)) * onde;
  const ids = E.sel.filter(id => !juncaoAtiva(noPorId(id)));
  const caixas = new Map(ids.map(id => [id, caixaDe(id)]));
  const alvo = ALN.ref && caixas.has(ALN.ref) ? valor(caixas.get(ALN.ref)) : [...caixas.values()].reduce((s, b) => s + valor(b), 0) / caixas.size;
  alterar(() => {
    for (const [id, b] of caixas) {
      if (id === ALN.ref) continue;
      const t = noPorId(id).transformacao;
      t.posicao[eixo] = arred(t.posicao[eixo] + alvo - valor(b));
    }
  });
  const presos = E.sel.length - ids.length;
  montarPontosAlinhar();
  mensagem(tt`Alinhado em ${'XYZ'[eixo]} (${ALN.ref ? noPorId(ALN.ref).nome : tr('média')}).` + (presos ? ' ' + tt`${presos} peça(s) presa(s) por junção ficaram de fora.` : ''));
}
// ---------- modo Espelhar (M): setas duplas nos três eixos em volta da seleção ----------
let ESP = null;
const grupoEspelho = new THREE.Group(); cena.add(grupoEspelho);
const CORES_ESP = { x: 0xc0392b, y: 0x2e8b3e, z: 0x2a62b8 };
function entrarEspelhar() {
  encerrarModos('ESP');
  if (!E.sel.length) return mensagem(tr('Selecione o que quer espelhar.'));
  ESP = { hover: null }; gizmo.detach(); montarSetasEspelho(); montarPainel();
  mensagem(tr('Espelhar: clique numa das setas (vermelha = X, verde = Y, azul = Z) ou num botão do painel.'));
}
function sairEspelhar() { if (!ESP) return; ESP = null; grupoEspelho.clear(); atualizarVisual(); montarPainel(); }
function montarSetasEspelho() {
  grupoEspelho.clear();
  if (!ESP || !E.sel.length) return desenhar();
  const b = caixaSelecao(), c = b.getCenter(new V3()), t = b.getSize(new V3());
  grupoEspelho.userData = { b, c, t };
  const off = Math.max(6, 0.15 * Math.max(t.x, t.y, t.z));
  for (const [eixo, dir, pos] of [['x', new V3(1, 0, 0), new V3(c.x, b.min.y - off, b.min.z + 0.05)], ['y', new V3(0, 1, 0), new V3(b.max.x + off, c.y, b.min.z + 0.05)], ['z', new V3(0, 0, 1), new V3(b.min.x - off, b.min.y - off, c.z)]]) {
    const L = Math.max(10, (eixo === 'x' ? t.x : eixo === 'y' ? t.y : t.z) * 0.7);
    const mat = new THREE.MeshBasicMaterial({ color: CORES_ESP[eixo], depthTest: false, transparent: true });
    const seta = new THREE.Group();
    const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 10), mat);   // eixo Y do cilindro, ajustado abaixo
    const p1 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.35, 16), mat), p2 = p1.clone();
    p1.position.y = 0.5; p2.position.y = -0.5; p2.rotation.z = Math.PI;
    seta.add(haste, p1, p2);
    // a seta é feita em escala 1 ao longo de Y; escala pelo comprimento e gira para o eixo
    seta.userData.fixa = true; seta.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir); seta.position.copy(pos);
    seta.userData = { espelho: eixo }; seta.traverse(o => { o.renderOrder = 72; o.userData.espelho = eixo; });
    grupoEspelho.add(seta);
  }
  desenhar();
}
function setaEspelhoSob(e) {
  const hit = raioDoMouse(e).intersectObjects(grupoEspelho.children, true)[0];
  return hit ? hit.object.userData.espelho : null;
}
renderer.domElement.addEventListener('pointermove', e => {
  if (!ESP || e.buttons) return;
  const eixo = setaEspelhoSob(e);
  if (eixo === ESP.hover) return;
  ESP.hover = eixo;
  for (const s of grupoEspelho.children) s.traverse(o => { if (o.material) o.material.color.set(s.userData.espelho === eixo ? 0xe0a100 : CORES_ESP[s.userData.espelho]); });
  renderer.domElement.style.cursor = eixo ? 'pointer' : '';
  if (eixo) mensagem(tt`Espelhar em ${eixo.toUpperCase()} — clique para aplicar.`);
  desenhar();
});
function clicarESP(e) {
  const eixo = setaEspelhoSob(e);
  if (eixo) { espelhar(eixo); montarSetasEspelho(); mensagem(tt`Espelhado em ${eixo.toUpperCase()}.`); }
}
function painelEspelhar() {
  painel.append(el('h2', {}, tr('Espelhar'), interrog('espelhar')),
    el('p', { class: 'dica' }, tr('Inverte a seleção em volta do centro dela. Clique numa seta na vista ou num botão abaixo; pode repetir.')),
    el('div', { class: 'segmentado botoes espelhar' }, ...['x', 'y', 'z'].map(a => el('button', { class: 'eixo-' + a, onclick: () => { espelhar(a); montarSetasEspelho(); } }, tt`Espelhar ${a.toUpperCase()}`))),
    el('div', { class: 'botoes' }, el('button', { class: 'primario', onclick: sairEspelhar }, tr('Concluir'))));
}

// ---------- alças visuais do Alinhar (como no Tinkercad) ----------
// Pontos pretos em volta da seleção: 3 na frente (X: esquerda, centro, direita), 3 do lado direito
// (Y: frente, centro, trás) e 3 numa haste vertical (Z: base, centro, topo). Passando o mouse, a
// prévia mostra onde as peças vão parar; clicando, alinha. Clicar numa peça a fixa como referência.
const grupoPontosAln = new THREE.Group(); grupoPontosAln.renderOrder = 70; cena.add(grupoPontosAln);
const matPonto = new THREE.MeshBasicMaterial({ color: 0x1e2a30, depthTest: false, transparent: true });
const matPontoHover = new THREE.MeshBasicMaterial({ color: 0xe0a100, depthTest: false, transparent: true });
const matLinhaAlinhar = new THREE.LineDashedMaterial({ color: 0x1e2a30, dashSize: 2, gapSize: 1.5, depthTest: false, transparent: true });
const geoPonto = new THREE.SphereGeometry(1, 16, 12);
let previaAlinhar = null; // { originais: Map(id → posição) }
function montarPontosAlinhar() {
  grupoPontosAln.clear();
  if (!ALN) return;
  const ids = E.sel.filter(id => malhas.has(id));
  if (!ids.length) return;
  // com uma peça de referência, os pontos ficam em volta dela (é nela que as outras vão se alinhar)
  const b = new THREE.Box3(); for (const id of (ALN.ref && ids.includes(ALN.ref) ? [ALN.ref] : ids)) b.union(caixaDe(id));
  const tam = b.getSize(new V3()), off = Math.max(6, 0.12 * Math.max(tam.x, tam.y, tam.z));
  const yF = b.min.y - off, xD = b.max.x + off, z0 = Math.max(0, b.min.z);
  const linha = (a, c) => { const g = new THREE.BufferGeometry().setFromPoints([a, c]); const l = new THREE.Line(g, matLinhaAlinhar); l.computeLineDistances(); l.renderOrder = 70; grupoPontosAln.add(l); };
  const ponto = (p, eixo, onde) => { const m = new THREE.Mesh(geoPonto, matPonto); m.position.copy(p); m.userData = { alinhar: [eixo, onde] }; m.renderOrder = 71; grupoPontosAln.add(m); };
  const mid = k => b.min.getComponent(k) + tam.getComponent(k) / 2;
  linha(new V3(b.min.x, yF, z0), new V3(b.max.x, yF, z0));
  linha(new V3(xD, b.min.y, z0), new V3(xD, b.max.y, z0));
  const xZ = b.min.x - off;
  linha(new V3(xZ, yF, b.min.z), new V3(xZ, yF, b.max.z));
  [0, 0.5, 1].forEach(o => {
    ponto(new V3(b.min.x + tam.x * o, yF, z0), 0, o);
    ponto(new V3(xD, b.min.y + tam.y * o, z0), 1, o);
    ponto(new V3(xZ, yF, b.min.z + tam.z * o), 2, o);
  });
  escalarPontosAlinhar();
  desenhar();   // mostra os pontos na hora (antes só apareciam quando a vista era girada)
}
function escalarPontosAlinhar() {
  for (const m of grupoPontosAln.children) if (m.isMesh) m.scale.setScalar(Math.max(0.3, camera.position.distanceTo(m.position) * 0.009));
}
function pontoAlinharSob(e) {
  const hit = raioDoMouse(e).intersectObjects(grupoPontosAln.children.filter(m => m.isMesh), false)[0];
  return hit?.object ?? null;
}
function deslocamentosAlinhar(eixo, onde) {
  const valor = b => b.min.getComponent(eixo) + (b.max.getComponent(eixo) - b.min.getComponent(eixo)) * onde;
  const ids = E.sel.filter(id => !juncaoAtiva(noPorId(id)));
  const caixas = new Map(ids.map(id => [id, caixaDe(id)]));
  const alvo = ALN.ref && caixas.has(ALN.ref) ? valor(caixas.get(ALN.ref)) : [...caixas.values()].reduce((s, b) => s + valor(b), 0) / caixas.size;
  return new Map([...caixas].filter(([id]) => id !== ALN.ref).map(([id, b]) => [id, alvo - valor(b)]));
}
function mostrarPreviaAlinhar(eixo, onde) {
  tirarPreviaAlinhar();
  previaAlinhar = { originais: new Map() };
  for (const [id, d] of deslocamentosAlinhar(eixo, onde)) {
    const m = malhas.get(id); previaAlinhar.originais.set(id, m.position.clone());
    m.position.setComponent(eixo, m.position.getComponent(eixo) + d);
  }
  desenhar();
}
function tirarPreviaAlinhar() {
  if (!previaAlinhar) return;
  for (const [id, p] of previaAlinhar.originais) malhas.get(id)?.position.copy(p);
  previaAlinhar = null; desenhar();
}
renderer.domElement.addEventListener('pointermove', e => {
  if (!ALN || e.buttons) return;
  const p = pontoAlinharSob(e);
  for (const m of grupoPontosAln.children) if (m.isMesh) m.material = m === p ? matPontoHover : matPonto;
  const chave = p ? p.userData.alinhar.join(':') : null;
  if (chave !== ALN.hover) {
    ALN.hover = chave;
    if (p) { mostrarPreviaAlinhar(...p.userData.alinhar); const [eixo, o] = p.userData.alinhar; const frases = [tr('à esquerda'), tr('no centro (X)'), tr('à direita'), tr('na frente'), tr('no centro (Y)'), tr('atrás'), tr('na base'), tr('no meio da altura'), tr('no topo')]; mensagem(tt`Alinhar ${frases[eixo * 3 + o * 2]} — clique para aplicar.`); }
    else tirarPreviaAlinhar();
  }
  renderer.domElement.style.cursor = p ? 'pointer' : '';
});
function painelAlinhar() {
  const ref = ALN.ref && noPorId(ALN.ref);
  painel.append(el('h2', {}, tr('Alinhar'), interrog('alinhar')),
    el('p', { class: 'dica' }, ref ? tt`Referência: "${ref.nome}" (clique nele de novo para voltar à média).` : tr('Referência: média dos objetos. Clique num objeto para usá-lo como referência.')));
  const nomes = [[tr('Esquerda'), tr('Centro'), tr('Direita')], [tr('Frente'), tr('Centro'), tr('Trás')], [tr('Base'), tr('Centro'), tr('Topo')]];
  ['X', 'Y', 'Z'].forEach((a, eixo) => {
    painel.append(el('h3', {}, tt`Eixo ${a}`), el('div', { class: 'segmentado botoes alinhar' },
      ...[0, 0.5, 1].map((onde, k) => el('button', { onclick: () => alinharObjetos(eixo, onde), title: nomes[eixo][k] },
        el('span', { class: 'icone-alinhar ' + 'abc'[k] }), nomes[eixo][k]))));
  });
  painel.append(el('div', { class: 'botoes' }, el('button', { class: 'primario', onclick: sairAlinharObj }, tr('Concluir'))));
}

// ---------- seleção por área (arrastar um retângulo) ----------
// Objetos: arraste a partir de um espaço vazio; entram os que ficam inteiros dentro do retângulo.
// Malha em edição: arraste em qualquer lugar; entram os triângulos (de frente para a câmera; Alt inclui os de trás)
// ou os vértices dentro do retângulo. Ctrl tira da seleção em vez de somar.
const retSel = el('div', { id: 'ret-sel', hidden: true }); vista.appendChild(retSel);
let caixaSel = null;
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.button !== 0 || MA || JF || AL || FM || ALN || ESP || E.escolhendoPonto || deslize || arrasteAlca) return;
  if (gizmo.object && gizmo.axis !== null) return;
  if (!ME && raioDoMouse(e).intersectObjects([...malhas.values()], false).length) return;
  caixaSel = { x0: e.clientX, y0: e.clientY, ativo: false };
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!caixaSel || arrasteCorpo) return;
  if (!caixaSel.ativo) {
    if (Math.hypot(e.clientX - caixaSel.x0, e.clientY - caixaSel.y0) < 6) return;
    caixaSel.ativo = true; retSel.hidden = false; renderer.domElement.setPointerCapture(e.pointerId);
  }
  const v = vista.getBoundingClientRect();
  Object.assign(retSel.style, {
    left: Math.min(e.clientX, caixaSel.x0) - v.left + 'px', top: Math.min(e.clientY, caixaSel.y0) - v.top + 'px',
    width: Math.abs(e.clientX - caixaSel.x0) + 'px', height: Math.abs(e.clientY - caixaSel.y0) + 'px',
  });
});
renderer.domElement.addEventListener('pointerup', e => {
  if (!caixaSel) return;
  const c = caixaSel; caixaSel = null; retSel.hidden = true;
  if (!c.ativo) return;
  const r = renderer.domElement.getBoundingClientRect();
  const [xa, xb] = [Math.min(c.x0, e.clientX), Math.max(c.x0, e.clientX)], [ya, yb] = [Math.min(c.y0, e.clientY), Math.max(c.y0, e.clientY)];
  const dentro = v => { const q = v.clone().project(camera); const x = r.left + (q.x + 1) / 2 * r.width, y = r.top + (1 - q.y) / 2 * r.height; return q.z < 1 && x >= xa && x <= xb && y >= ya && y <= yb; };
  const tirar = e.ctrlKey;
  if (ME) {
    const no = noPorId(ME.id), d = lerMalha(no), M = malhas.get(no.id).matrixWorld, cam = camera.position;
    const P = i => new THREE.Vector3(d.v[i * 3], d.v[i * 3 + 1], d.v[i * 3 + 2]).applyMatrix4(M);
    let n = 0;
    if (ME.modo === 'triangulos') {
      for (let t = 0; t < d.t.length / 3; t++) {
        const a = P(d.t[t * 3]), b = P(d.t[t * 3 + 1]), cc = P(d.t[t * 3 + 2]);
        if (!e.altKey) { const nrm = b.clone().sub(a).cross(cc.clone().sub(a)); if (nrm.dot(cam.clone().sub(a)) <= 0) continue; }
        if (dentro(a) && dentro(b) && dentro(cc)) { tirar ? ME.selT.delete(t) : ME.selT.add(t); n++; }
      }
    } else {
      for (let i = 0; i < d.v.length / 3; i++) if (dentro(P(i))) { tirar ? ME.selV.delete(i) : ME.selV.add(i); n++; }
    }
    montarOverlay(); montarPainel();
    return mensagem(tt`${n} item(ns) dentro da área.`);
  }
  const ids = [];
  for (const [id, m] of malhas) {
    m.updateMatrixWorld(true);
    const b = new THREE.Box3().expandByObject(m, true);
    const cantos = [0, 1, 2, 3, 4, 5, 6, 7].map(k => new THREE.Vector3(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z));
    if (cantos.every(dentro)) ids.push(id);
  }
  if (tirar) E.sel = E.sel.filter(id => !ids.includes(id));
  else E.sel = e.shiftKey ? [...new Set([...E.sel, ...ids])] : ids;
  definirModoGizmo('mover'); atualizarVisual(); montarPainel();
  mensagem(tt`${ids.length} objeto(s) dentro da área.`);
});

// ---------- ajuda: dicas "?" e manual ----------
const DICAS = {
  formas: ['Clique numa forma para colocá-la no plano. Os seus plugins aparecem em amarelo; "Recarregar" lê de novo a pasta de plugins sem reiniciar.', 'formas'],
  nada: ['Clique num objeto para editá-lo; Shift+clique soma à seleção. Botão direito gira a vista, botão do meio arrasta, roda dá zoom.', 'navegacao'],
  tipo: ['Sólido soma material; Furo só corta quando agrupado com sólidos. Tecla H alterna.', 'furo'],
  parametros: ['Medidas que definem a forma. Mudar aqui é melhor que escalar: furos e raios mantêm a medida certa. Campos aceitam contas como 45/2.', 'formas'],
  acabamento: ['Fillet ou chanfro aplicado em arestas. Mude a medida, troque as arestas ou remova quando quiser: a peça de dentro continua editável.', 'arestas'],
  arestas: ['Abre a ferramenta de arestas: clique nas arestas destacadas, digite o raio ou a distância e veja a prévia antes de aplicar.', 'arestas'],
  modoArestas: ['Clique numa aresta para marcar. Vermelho é o material que sai, verde o que entra nos cantos internos. Enter aplica, Esc cancela.', 'arestas'],
  malha: ['Converter em malha libera a edição de triângulos e vértices. A versão paramétrica fica guardada para voltar depois.', 'malha'],
  editarMalha: ['Triângulos: clique marca, Face plana expande, Del apaga. Vértices: clique seleciona, Shift soma, mova pelo gizmo ou digitando.', 'malha'],
  juncao: ['A peça está presa na face da outra. Arraste com o mouse para deslizar (ela acompanha curvas); use o giro e o afastamento para ajustar; "Soltar junção" libera.', 'juntar'],
  espelhar: ['Inverte a seleção em volta do centro dela, em X, Y ou Z. Use as setas coloridas na vista ou os botões do painel; dá para espelhar várias vezes.', 'espelharmodo'],
  alinhar: ['Escolha mínimo, centro ou máximo em cada eixo. Sem referência, os objetos vão para a média; clicando num objeto, ele fica parado e os outros se alinham a ele.', 'alinhar'],
  consolidar: ['Consolidar funde a seleção numa peça única, leve de mover e exportar; a receita fica guardada e "Voltar à receita" devolve os passos. "Salvar na biblioteca" guarda a peça em Minhas peças para usar em outros projetos.', 'consolidar'],
  impressao: ['Verifica buracos, arestas malformadas, normais invertidas e duplicados. "Reparar" corrige e une peças sobrepostas num corpo só, como o fatiador espera.', 'reparo'],
  simplificar: ['Reduz triângulos preservando detalhes. Use desvio máximo (ex.: 0,05 mm) para não deformar a peça além dessa medida.', 'simplificar'],
  posicao: ['Coordenadas da origem do objeto (centro da base). Também dá para arrastar pelas setas ou usar as setas do teclado.', 'mover'],
  tamanho: ['Também dá para arrastar as alças brancas na peça (cantos mudam X e Y; a de cima muda a altura; com Shift tudo muda na mesma proporção) ou clicar nas cotas e digitar. Mudar aplica escala. "Pousar no plano" apoia o ponto mais baixo em Z = 0.', 'tamanho'],
  rotacao: ['Ângulos absolutos em torno da origem do objeto, com uma casa decimal.', 'girar'],
  pivo: ['Escolha o ponto de giro, o eixo e o ângulo. "Ponto escolhido" + "Escolher no modelo" encaixa no vértice mais próximo do clique.', 'girar'],
  grupo: ['Grupo une sólidos e subtrai furos. Desagrupar devolve as peças originais com seus parâmetros.', 'grupo'],
  passoGiro: ['Encaixe do giro pelo gizmo (os anéis que aparecem no modo girar).', 'girar'],
  passo: ['Encaixe do movimento ao arrastar pelas setas e ao usar as setas do teclado.', 'ajustes'],
  resolucao: ['Quantos segmentos têm as curvas. Rascunho é mais rápido para montar; fina dá superfícies mais lisas no STL.', 'ajustes'],
};
const interrog = chave => el('button', { class: 'interrog', 'data-dica': chave, 'aria-label': tr('Dica') }, '?');
const titulo = (texto, chave) => el('h3', {}, texto, interrog(chave));
const popdica = $('#popdica');
function mostrarDica(chave, botao) {
  const [texto, secao] = DICAS[chave] ?? ['', 'inicio'];
  if (!popdica.hidden && popdica.dataset.chave === chave) return fecharDica();
  popdica.querySelector('p').textContent = tr(texto);
  popdica.dataset.chave = chave; popdica.dataset.secao = secao;
  popdica.hidden = false;
  const r = botao.getBoundingClientRect(), w = popdica.offsetWidth, h = popdica.offsetHeight;
  popdica.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left - w / 2 + r.width / 2)) + 'px';
  popdica.style.top = (r.bottom + h + 8 > window.innerHeight ? r.top - h - 6 : r.bottom + 6) + 'px';
}
function fecharDica() { popdica.hidden = true; delete popdica.dataset.chave; }
popdica.querySelector('.link').addEventListener('click', () => { const s = popdica.dataset.secao; fecharDica(); abrirAjuda(s); });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-dica]');
  if (b) { e.stopPropagation(); mostrarDica(b.dataset.dica, b); }
  else if (!e.target.closest('#popdica')) fecharDica();
}, true);

const modal = $('#modal');
function abrirModal(tituloTxt, conteudo, pequena = false) {
  fecharDica();
  modal.querySelector('h2').textContent = tituloTxt;
  modal.querySelector('.caixa-modal').classList.toggle('pequena', pequena);
  modal.querySelector('.conteudo-modal').replaceChildren(conteudo);
  modal.hidden = false;
  modal.querySelector('[data-fechar]').focus();
}
function fecharModal() { modal.hidden = true; modal.querySelector('.conteudo-modal').replaceChildren(); }
modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-fechar]')) fecharModal(); });
function abrirAjuda(secao = 'inicio') {
  abrirModal(tr('Manual do Anvil3D'), el('iframe', { src: `${idiomaAtual() === 'en' ? 'ajuda-en.html' : 'ajuda.html'}#${secao}`, title: tr('Manual') }));
}
function pedirTexto(tituloTxt, rotulo, valor) {
  return new Promise(ok => {
    const i = el('input', { value: valor ?? '', spellcheck: 'false' });
    let feito = false;
    const fim = v => { if (feito) return; feito = true; fecharModal(); ok(v); };
    const caixa = el('div', { class: 'sobre' }, campo(rotulo, i, true),
      el('div', { class: 'botoes' }, el('button', { onclick: () => fim(null) }, tr('Cancelar')), el('button', { class: 'primario', onclick: () => fim(i.value) }, tr('Salvar'))));
    i.addEventListener('keydown', e => { if (e.key === 'Enter') fim(i.value); if (e.key === 'Escape') fim(null); });
    abrirModal(tituloTxt, caixa, true);
    modal.addEventListener('click', function f(e) { if (modal.hidden) { modal.removeEventListener('click', f); if (!feito) { feito = true; ok(null); } } });
    setTimeout(() => { i.focus(); i.select(); }, 0);
  });
}
async function abrirGuiaIA() {
  const arq = idiomaAtual() === 'en' ? 'GENERATE-SHAPES-WITH-AI.md' : 'GERAR-FORMAS-COM-IA.md';
  const texto = await (await fetch('app://anvil/plugins/' + arq)).text();
  const marca = idiomaAtual() === 'en' ? 'START OF REQUEST' : 'INÍCIO DO PEDIDO';
  const pedido = texto.slice(texto.indexOf('\n', texto.indexOf(marca)) + 1).trim();
  const pre = el('pre', { class: 'guia-ia' }); pre.textContent = pedido;
  const copiar = el('button', { class: 'primario', onclick: async () => {
    await navigator.clipboard.writeText(pedido); copiar.textContent = tr('Copiado!'); setTimeout(() => (copiar.textContent = tr('Copiar pedido')), 1800);
  } }, tr('Copiar pedido'));
  abrirModal(tr('Criar formas com IA'), el('div', { class: 'sobre' },
    el('p', {}, tr('Copie o pedido abaixo, cole em qualquer IA (Claude, ChatGPT, Gemini…) e troque o último trecho pela descrição da forma que você quer. Salve a resposta como arquivo .mjs na pasta de plugins e clique em Recarregar.')),
    el('div', { class: 'botoes' }, copiar, el('button', { onclick: () => anvil.abrirPastaPlugins() }, tr('Abrir pasta de plugins'))),
    pre));
}
async function abrirSobre() {
  const v = await anvil.versao();
  abrirModal(tr('Sobre'), el('div', { class: 'sobre' },
    el('img', { src: 'icone.png', alt: '', class: 'logo-sobre' }),
    el('p', { class: 'nome' }, 'Anvil3D'),
    el('p', { class: 'versao' }, tt`Versão ${v}`),
    el('p', {}, tr('CAD local para modelagem com formas sólidas e furos, com histórico editável, fillet e chanfro, edição de malha e plugins.')),
    el('p', { class: 'autor' }, tr('Criado por '), el('b', {}, 'Luiz Pacheco')),
    el('p', {}, el('a', { href: 'mailto:luizgpf@gmail.com', target: '_blank' }, 'luizgpf@gmail.com')),
    el('p', {}, '© 2026 Luiz Pacheco · ', el('a', { href: 'https://nobetteridea.com', target: '_blank' }, 'nobetteridea.com'),
      ' · ', el('a', { href: 'https://github.com/lgpf/anvil3d', target: '_blank' }, 'github.com/lgpf/anvil3d')),
    el('div', { class: 'apoio' },
      el('p', {}, tr('O Anvil3D é gratuito. Se ele te ajudou, considere apoiar o desenvolvimento.')),
      el('a', { class: 'botao-apoio', href: 'https://ko-fi.com/anvil3d', target: '_blank', title: 'ko-fi.com/anvil3d' }, '♥ ', tr('Apoie o Anvil3D no Ko-fi'))),
    el('p', { class: 'licenca' }, tr('Software livre sob a licença GPL-3.0 (ou posterior). Plugins podem usar qualquer licença.')),
    el('p', { class: 'componentes' }, tr('Feito com Electron (MIT), three.js (MIT), Manifold (Apache 2.0), meshoptimizer (MIT) e opentype.js (MIT); fontes DejaVu (licença livre).'))), true);
}

// ---------- impressão 3D: diagnóstico e reparo ----------
const cacheDiag = new Map();
function diagDe(no) {
  let r = cacheDiag.get(no.malha.rev);
  if (!r) { r = diagnosticar(lerMalha(no)); cacheDiag.set(no.malha.rev, r); }
  return r;
}
function linhasDiag(g) {
  const L = [];
  const item = (ok, txt) => L.push(el('li', { class: ok ? 'ok' : 'ruim' }, txt));
  item(!g.arestasBorda, g.arestasBorda ? tt`${fmtInt(g.arestasBorda)} arestas de buraco` : tr('Sem buracos'));
  item(!g.naoManifold, g.naoManifold ? tt`${fmtInt(g.naoManifold)} arestas com mais de duas faces` : tr('Arestas bem formadas'));
  item(!g.incoerentes && !g.cascasInvertidas, g.incoerentes || g.cascasInvertidas ? tr('Normais invertidas') : tr('Normais para fora'));
  item(!g.duplicados, g.duplicados ? tt`${fmtInt(g.duplicados)} triângulos duplicados` : tr('Sem triângulos duplicados'));
  if (g.degenerados) item(false, tt`${fmtInt(g.degenerados)} triângulos degenerados`);
  if (g.cascas > 1) item(true, tt`${g.cascas} peças separadas (cascas)`);
  return el('ul', { class: 'diag' }, ...L);
}
const opRep = { fechar: true, volumeMinimo: 1, unir: true };
function painelImpressao(no) {
  const g = diagDe(no);
  painel.append(titulo(tr('Impressão 3D'), 'impressao'),
    el('p', { class: g.ok ? 'estado ok' : 'estado ruim' }, g.ok ? tr('Pronta para imprimir.') : tr('Precisa de reparo antes de imprimir.')),
    linhasDiag(g),
    campo(tr('Fechar buracos'), el('input', { type: 'checkbox', checked: opRep.fechar, onchange: e => (opRep.fechar = e.target.checked) })),
    campo(tr('Unir peças sobrepostas'), el('input', { type: 'checkbox', checked: opRep.unir, onchange: e => (opRep.unir = e.target.checked) })),
    campo(tr('Remover peças soltas menores que (mm³)'), inputNumero(opRep.volumeMinimo, 1, v => { opRep.volumeMinimo = Math.max(0, v); })),
    el('div', { class: 'botoes' }, el('button', { class: g.ok ? '' : 'primario', onclick: () => repararNo(no) }, tr('Reparar para impressão'))));
}
function repararNo(no) {
  mensagem('Reparando…');
  const r = reparar(wasm, lerMalha(no), { fechar: opRep.fechar, volumeMinimo: opRep.volumeMinimo, unirCascas: opRep.unir });
  alterar(() => gravarMalha(no, r.dados));
  mensagem((r.fechada ? tr('Reparada: ') : tr('Reparo parcial (ainda não está fechada): ')) + r.relatorio.join('; ') + '.', !r.fechada);
}

// ---------- consolidar e biblioteca de peças ----------
// Consolidar funde vários objetos numa peça única (malha), rápida de mover e exportar.
// A receita original fica guardada dentro dela: "Voltar à receita" devolve todos os passos.
// ---------- aplicar na face: a peça vai para o ponto clicado, deitada na superfície (inclinada ou não),
// e é projetada nela acompanhando as curvas ----------
let AF = null;
const grupoPreviaAF = new THREE.Group(); cena.add(grupoPreviaAF);
function entrarAplicarFace() {
  if (E.sel.length !== 1) return mensagem(tr('Selecione a peça a aplicar (por exemplo, um texto).'), true);
  encerrarModos(); AF = { id: E.sel[0], alvo: null, giro: 0, escala: 100, timer: 0, modo: 'curva', afundar: 0.3 };
  // durante a escolha e a prévia a peça não fica selecionada: sem alças, cotas nem setas no lugar antigo
  E.sel = []; atualizarVisual(); gizmo.detach(); vista.classList.add('escolhendo');
  montarPainel();
  mensagem(tr('Aplicar na face: clique no ponto da superfície de outra peça onde ela deve ficar (Esc cancela).'));
}
function limparPreviaAF() { for (const o of [...grupoPreviaAF.children]) { o.geometry.dispose(); o.material.dispose(); grupoPreviaAF.remove(o); } }
function sairAplicarFace() {
  if (!AF) return;
  clearTimeout(AF.timer); limparPreviaAF();
  const mA = malhas.get(AF.id); if (mA) mA.visible = true;
  if (!E.sel.length && noPorId(AF.id)) E.sel = [AF.id]; // cancelou: a peça volta a ficar selecionada
  AF = null; vista.classList.remove('escolhendo'); atualizarVisual(); montarPainel(); desenhar();
}
// matriz da peça deitada no ponto escolhido, com o giro (em volta da normal) e o tamanho do painel
function matrizAF() {
  const A = noPorId(AF.id), mA = malhas.get(AF.id), t = A.transformacao, n = AF.n;
  mA.geometry.computeBoundingBox();
  const bl = mA.geometry.boundingBox, k = AF.escala / 100, esc = t.escala.map(x => x * k);
  const tl = bl.getSize(new V3()).multiply(new V3(...esc.map(Math.abs)));
  const ka = [tl.x, tl.y, tl.z].indexOf(Math.min(tl.x, tl.y, tl.z));
  const zL = n.clone();
  let xL = AF.direita.clone().sub(zL.clone().multiplyScalar(AF.direita.dot(zL)));
  if (xL.lengthSq() < 1e-6) xL = new V3(0, 0, 1).cross(zL);
  if (xL.lengthSq() < 1e-6) xL = new V3(1, 0, 0).cross(zL);
  xL.normalize().applyAxisAngle(zL, AF.giro * RAD);
  const dims = [tl.x, tl.y, tl.z], iw = [0, 1, 2].filter(i => i !== ka).sort((a, b) => dims[b] - dims[a])[0], ir = 3 - ka - iw;
  const eL = i => new V3().setComponent(i, 1), loc = new THREE.Matrix4().makeBasis(eL(iw), eL(ir), eL(ka));
  let yL = zL.clone().cross(xL), mundo = new THREE.Matrix4().makeBasis(xL, yL, zL), R = mundo.clone().multiply(loc.clone().transpose());
  if (R.determinant() < 0) { yL.negate(); mundo.makeBasis(xL, yL, zL); R = mundo.clone().multiply(loc.clone().transpose()); }
  const q = new THREE.Quaternion().setFromRotationMatrix(R), cL = bl.getCenter(new V3());
  return new THREE.Matrix4().compose(AF.ponto.clone().addScaledVector(n, tl.getComponent(ka) / 2 + 0.5), q, new V3(...esc))
    .multiply(new THREE.Matrix4().makeTranslation(-cL.x, -cL.y, -cL.z));
}
function copiaPosicionadaAF() { const A = noPorId(AF.id), c = { ...structuredClone(A), transformacao: { ...A.transformacao } }; definirMatriz(c, matrizAF()); return c; }
// prévia: o decalque é calculado de novo (em qualidade mais baixa) a cada ajuste, um instante depois
function agendarPreviaAF(atraso = 120) {
  if (!AF?.alvo) return;
  clearTimeout(AF.timer);
  AF.timer = setTimeout(() => {
    if (!AF?.alvo) return;
    let res;
    try { res = calcularProjecao(copiaPosicionadaAF(), noPorId(AF.alvo), AF.n.clone().negate(), 70, { modo: AF.modo, afundar: AF.afundar }); }
    catch (e) { return mensagem(e.message, true); }
    AF.aviso = res.avisoCurva; const d = dadosMalha(res); res.delete();
    limparPreviaAF();
    const av = document.querySelector('#aviso-curva-af'); if (av) av.hidden = !AF.aviso;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(d.posicoes), 3)); g.setIndex(new THREE.BufferAttribute(new Uint32Array(d.indices), 1)); g.computeVertexNormals();
    const A = noPorId(AF.id);
    grupoPreviaAF.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: A.furo ? 0x8a9399 : A.cor, roughness: 0.6, transparent: true, opacity: A.furo ? 0.55 : 0.92 })));
    malhas.get(AF.id).visible = false;
    desenhar();
  }, atraso);
}
function clicarAF(e) {
  const mA = malhas.get(AF.id);
  const hit = raioDoMouse(e).intersectObjects([...malhas.values()].filter(m => m !== mA), false)[0];
  if (!hit || !hit.face) {
    if (!AF.alvo) { sairAplicarFace(); mensagem(tr('Aplicar na face cancelado.')); }
    return;
  }
  // a "direita" da tela no momento do clique decide para onde o texto corre (fica legível de onde você olha)
  AF.alvo = hit.object.userData.id; AF.ponto = hit.point.clone();
  AF.n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  AF.direita = new V3(1, 0, 0).applyQuaternion(camera.quaternion);
  montarPainel(); agendarPreviaAF(0);
  mensagem(tr('Prévia: ajuste o giro e o tamanho no painel, ou clique em outro ponto. Aplicar confirma; Cancelar (ou Esc) desiste.'));
}
function aplicarAF() {
  if (!AF?.alvo) return;
  const A = noPorId(AF.id), B = noPorId(AF.alvo), c = copiaPosicionadaAF(), dir = AF.n.clone().negate();
  mensagem(tr('Projetando na superfície…'));
  let res;
  try { res = calcularProjecao(c, B, dir, 180, { modo: AF.modo, afundar: AF.afundar }); } catch (e) { return mensagem(e.message, true); }
  sairAplicarFace();
  confirmarProjecao(A, res, c);
}
function painelAplicarFace() {
  const linha = (rotulo, min, max, passo, valor, fim, aoMudar) => {
    const num = el('input', { type: 'number', min, max, step: passo, value: valor, class: 'num-af' });
    const bar = el('input', { type: 'range', min, max, step: passo, value: valor });
    bar.oninput = () => { num.value = bar.value; aoMudar(Number(bar.value)); };
    num.onchange = () => { const v = Math.max(min, Math.min(max, lerNumero(num.value) || 0)); num.value = v; bar.value = v; aoMudar(v); };
    return campo(rotulo, el('div', { class: 'linha-af' }, bar, num, el('span', {}, fim)));
  };
  painel.append(el('h2', {}, tr('Aplicar na face')),
    el('p', { class: 'dica' }, AF.alvo ? tr('A prévia mostra como vai ficar. Clique em outro ponto para mudar o lugar; gire a vista antes de clicar para mudar a direção do texto.') : tr('Clique no ponto da superfície de outra peça onde a peça deve ficar.')));
  if (AF.alvo) painel.append(
    linha(tr('Giro'), -180, 180, 1, AF.giro, '°', v => { AF.giro = v; agendarPreviaAF(); }),
    linha(tr('Tamanho'), 10, 400, 1, AF.escala, '%', v => { AF.escala = v; agendarPreviaAF(); }),
    linha(tr('Afundar'), 0, 3, 0.1, AF.afundar, 'mm', v => { AF.afundar = v; agendarPreviaAF(); }),
    campo(tr('Modo'), el('select', { onchange: e => { AF.modo = e.target.value; agendarPreviaAF(0); } },
      ...[['curva', tr('Acompanhar a curva')], ['suave', tr('Suavizar (ignora dobras pequenas)')], ['reto', tr('Projetar reto (fica plano)')]].map(([v, r]) => el('option', { value: v, selected: AF.modo === v }, r)))),
    el('p', { class: 'caixa-aviso', id: 'aviso-curva-af', hidden: !AF.aviso }, tr('Esta área é curva demais para o tamanho da peça: as letras podem deformar. Diminua o tamanho ou use "Suavizar" ou "Projetar reto".')));
  painel.append(el('div', { class: 'botoes' },
    ...(AF.alvo ? [el('button', { class: 'primario', onclick: aplicarAF }, tr('Aplicar'))] : []),
    el('button', { onclick: () => { sairAplicarFace(); mensagem(tr('Aplicar na face cancelado.')); } }, tr('Cancelar'))));
}

// ---------- projetar uma peça (texto, logotipo…) sobre uma superfície irregular ----------
// Selecione a peça que vai ser aplicada e depois a peça de destino. A peça é "decalcada" na direção da
// sua espessura: cada ponto dela desce (ou avança) até encostar na superfície, acompanhando as curvas.
// Sólido: vira relevo (entra um pouco para colar). Furo: vira gravação na profundidade da espessura.
function projetarNaSuperficie(dirMundo = null) {
  if (!(dirMundo instanceof THREE.Vector3)) dirMundo = null; // chamado por um botão: vem o evento do clique
  if (E.sel.length !== 2) return mensagem(tr('Selecione a peça a aplicar (por exemplo, um texto) e depois a peça de destino, com Shift+clique.'), true);
  const A = noPorId(E.sel[0]), B = noPorId(E.sel[1]);
  if (!A || !malhas.get(B.id)) return;
  mensagem(tr('Projetando na superfície…'));
  let res;
  try { res = calcularProjecao(A, B, dirMundo); } catch (e) { return mensagem(e.message, true); }
  confirmarProjecao(A, res);
}
// Calcula a peça A decalcada na superfície de B (no mundo). Não mexe no projeto. "finura": quantas
// amostras no lado maior (menos = mais rápido, usado na prévia enquanto você ajusta)
// op.modo: 'curva' (acompanha a curva, padrão) · 'reto' (fica plano, só encosta) · 'suave' (acompanha uma
// versão alisada da superfície, ignorando dobras pequenas); op.afundar: quanto entra na superfície (mm)
function calcularProjecao(A, B, dirMundo = null, finura = 180, op = {}) {
  const modo = op.modo || 'curva';
  const mB = malhas.get(B.id);
  let wA = motor.mundo(A);
  // com uma direção dada (superfície inclinada), tudo é girado para um referencial em que a projeção
  // é "de cima para baixo" no Z; no fim o resultado volta para o lugar
  let Rot = null, RotInv = null;
  if (dirMundo) {
    const q = new THREE.Quaternion().setFromUnitVectors(dirMundo.clone().normalize(), new V3(0, 0, -1));
    Rot = new THREE.Matrix4().makeRotationFromQuaternion(q); RotInv = Rot.clone().invert();
    const g = wA.transform(Rot.elements); wA.delete(); wA = g;
  }
  const bb = wA.boundingBox(), mn = bb.min, mx = bb.max, tam = [0, 1, 2].map(i => mx[i] - mn[i]);
  // espessura = menor dimensão; direção = para o lado onde está o destino
  const k = Rot ? 2 : tam.indexOf(Math.min(...tam)), [u, v] = [0, 1, 2].filter(i => i !== k);
  mB.updateMatrixWorld(true);
  const cB = new THREE.Box3().setFromObject(mB, true).getCenter(new V3()).getComponent(k), cA = (mn[k] + mx[k]) / 2;
  const s = Rot ? -1 : (cB >= cA ? 1 : -1), D = tam[k], fundo = s > 0 ? mx[k] : mn[k];
  // mapa de alturas: raios paralelos à espessura, de longe, até a superfície do destino
  const passo = Math.max(0.25, Math.max(tam[u], tam[v]) / finura);
  const nu = Math.ceil(tam[u] / passo) + 3, nv = Math.ceil(tam[v] / passo) + 3, u0 = mn[u] - passo, v0 = mn[v] - passo;
  const mapa = new Float64Array(nu * nv).fill(NaN);
  // triângulos do destino (em coordenadas do mundo), distribuídos numa grade no plano u-v para cada raio
  // testar só os poucos triângulos que passam embaixo dele (antes testava todos: lento em peças grandes)
  const pos = mB.geometry.attributes.position, idx = mB.geometry.index, Mw = Rot ? Rot.clone().multiply(mB.matrixWorld) : mB.matrixWorld;
  const nT = idx ? idx.count / 3 : pos.count / 3, W = new Float64Array(nT * 9), tmp = new V3();
  for (let t = 0; t < nT; t++) for (let c = 0; c < 3; c++) {
    tmp.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + c) : t * 3 + c).applyMatrix4(Mw);
    W[t * 9 + c * 3] = tmp.getComponent(u); W[t * 9 + c * 3 + 1] = tmp.getComponent(v); W[t * 9 + c * 3 + 2] = tmp.getComponent(k);
  }
  const cel = passo * 4, gu = Math.ceil(nu * passo / cel) + 1, gv = Math.ceil(nv * passo / cel) + 1, balde = Array.from({ length: gu * gv }, () => []);
  for (let t = 0; t < nT; t++) {
    const o = t * 9, au = Math.min(W[o], W[o + 3], W[o + 6]), bu = Math.max(W[o], W[o + 3], W[o + 6]), av = Math.min(W[o + 1], W[o + 4], W[o + 7]), bv = Math.max(W[o + 1], W[o + 4], W[o + 7]);
    const i0 = Math.max(0, Math.floor((au - u0) / cel)), i1 = Math.min(gu - 1, Math.floor((bu - u0) / cel)), j0 = Math.max(0, Math.floor((av - v0) / cel)), j1 = Math.min(gv - 1, Math.floor((bv - v0) / cel));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) balde[i * gv + j].push(t);
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const pu = u0 + i * passo, pv = v0 + j * passo, lista = balde[Math.min(gu - 1, Math.floor(i * passo / cel)) * gv + Math.min(gv - 1, Math.floor(j * passo / cel))];
    let melhor = NaN;
    for (const t of lista) {
      const o = t * 9, x1 = W[o], y1 = W[o + 1], x2 = W[o + 3], y2 = W[o + 4], x3 = W[o + 6], y3 = W[o + 7];
      const den = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3); if (Math.abs(den) < 1e-12) continue;
      const l1 = ((y2 - y3) * (pu - x3) + (x3 - x2) * (pv - y3)) / den, l2 = ((y3 - y1) * (pu - x3) + (x1 - x3) * (pv - y3)) / den, l3 = 1 - l1 - l2;
      if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
      const h = l1 * W[o + 2] + l2 * W[o + 5] + l3 * W[o + 8];
      // primeiro encontro vindo do lado da peça (menor h se descendo em +s… o raio anda no sentido s)
      if (Number.isNaN(melhor) || (s > 0 ? h < melhor : h > melhor)) melhor = h;
    }
    mapa[i * nv + j] = melhor;
  }
  // pontos sem superfície embaixo: pegam o valor do vizinho mais perto (preenchimento por camadas)
  let validos = mapa.filter(x => !Number.isNaN(x)).length;
  if (!validos) { wA.delete(); throw new Error(tr('A peça não fica em cima do destino nessa direção: posicione-a de frente para a superfície.')); }
  for (let rodada = 0; rodada < nu + nv && validos < mapa.length; rodada++) {
    const novo = mapa.slice();
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      if (!Number.isNaN(mapa[i * nv + j])) continue;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = i + a, y = j + b; if (x >= 0 && y >= 0 && x < nu && y < nv && !Number.isNaN(mapa[x * nv + y])) { novo[i * nv + j] = mapa[x * nv + y]; validos++; break; } }
    }
    mapa.set(novo);
  }
  // modo suave: alisa o mapa de alturas (média em janela de ~20% do tamanho da peça, 3 passadas)
  if (modo === 'suave') {
    const r = Math.max(1, Math.round(0.2 * Math.min(tam[u], tam[v]) / passo));
    for (let passada = 0; passada < 3; passada++) {
      const tmp = new Float64Array(mapa.length);
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { let sm = 0, c = 0; for (let d = -r; d <= r; d++) { const x = i + d; if (x >= 0 && x < nu) { sm += mapa[x * nv + j]; c++; } } tmp[i * nv + j] = sm / c; }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { let sm = 0, c = 0; for (let d = -r; d <= r; d++) { const y = j + d; if (y >= 0 && y < nv) { sm += tmp[i * nv + y]; c++; } } mapa[i * nv + j] = sm / c; }
    }
  }
  const amostra = (pu, pv) => {
    const fi = Math.max(0, Math.min(nu - 1.001, (pu - u0) / passo)), fj = Math.max(0, Math.min(nv - 1.001, (pv - v0) / passo));
    const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j, M = (x, y) => mapa[x * nv + y];
    return M(i, j) * (1 - a) * (1 - b) + M(i + 1, j) * a * (1 - b) + M(i, j + 1) * (1 - a) * b + M(i + 1, j + 1) * a * b;
  };
  const embute = A.furo ? D - Math.min(0.5, D / 3) : (Number.isFinite(op.afundar) ? Math.min(op.afundar, D * 0.9) : Math.min(0.3, D / 4));
  let res, avisoCurva = false;
  try {
    const fino = wA.refineToLength(passo * 1.5); wA.delete();
    // "decalque de verdade": (1) as distâncias ao longo da superfície são preservadas — o texto acompanha
    // a curva com o mesmo tamanho, em vez de esticar nas partes inclinadas (comprimento de arco medido
    // na linha e na coluna que passam pelo centro); (2) a espessura sai na direção da NORMAL da
    // superfície em cada ponto, e não sempre na mesma direção — assim as letras ficam "em pé" sobre a
    // superfície também nas partes curvas (esfera, meio cilindro).
    const uc = (mn[u] + mx[u]) / 2, vc = (mn[v] + mx[v]) / 2;
    const ic = Math.max(0, Math.min(nu - 1, Math.round((uc - u0) / passo))), jc = Math.max(0, Math.min(nv - 1, Math.round((vc - v0) / passo)));
    const arco = (n, h) => { const A = new Float64Array(n); for (let i = 1; i < n; i++) A[i] = A[i - 1] + Math.hypot(passo, h(i) - h(i - 1)); return A; };
    const AU = arco(nu, i => mapa[i * nv + jc]), AV = arco(nv, j => mapa[ic * nv + j]);
    const AU0 = AU[ic] + ((uc - u0) / passo - ic) * passo, AV0 = AV[jc] + ((vc - v0) / passo - jc) * passo;
    const inverso = (A, alvo, origem) => {
      // posição (na grade) cujo comprimento de arco é "alvo"; fora da grade, segue reto
      if (alvo <= A[0]) return origem + (alvo - A[0]);
      const n = A.length; if (alvo >= A[n - 1]) return origem + (n - 1) * passo + (alvo - A[n - 1]);
      let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m] <= alvo) lo = m; else hi = m; }
      return origem + (lo + (alvo - A[lo]) / (A[hi] - A[lo] || 1)) * passo;
    };
    // aviso: superfície curva demais para o tamanho da peça (normais variando mais de 55° na área dela)
    if (modo === 'curva') {
      let maxAng = 0;
      const grad = (pu, pv) => [(amostra(pu + passo, pv) - amostra(pu - passo, pv)) / (2 * passo), (amostra(pu, pv + passo) - amostra(pu, pv - passo)) / (2 * passo)];
      const g0 = grad((mn[u] + mx[u]) / 2, (mn[v] + mx[v]) / 2), n0 = [-g0[0], -g0[1], 1], l0 = Math.hypot(...n0);
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
        const g = grad(mn[u] + tam[u] * i / 8, mn[v] + tam[v] * j / 8), n1 = [-g[0], -g[1], 1], l1 = Math.hypot(...n1);
        maxAng = Math.max(maxAng, Math.acos(Math.max(-1, Math.min(1, (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]) / (l0 * l1)))));
      }
      avisoCurva = maxAng > 55 * Math.PI / 180;
    }
    if (modo === 'reto') {
      // plano: a peça inteira só desce até encostar no ponto central, sem se deformar
      const hc = amostra((mn[u] + mx[u]) / 2, (mn[v] + mx[v]) / 2);
      res = fino.warp(p => { const t = (fundo - p[k]) * s; p[k] = hc - s * (t - embute); });
    } else res = fino.warp(p => {
      const t = (fundo - p[k]) * s, off = t - embute;
      const pu = inverso(AU, AU0 + (p[u] - uc), u0), pv = inverso(AV, AV0 + (p[v] - vc), v0);
      const h = amostra(pu, pv), hu = (amostra(pu + passo, pv) - amostra(pu - passo, pv)) / (2 * passo), hv = (amostra(pu, pv + passo) - amostra(pu, pv - passo)) / (2 * passo);
      const L = Math.hypot(hu, hv, 1), o = -s; // normal para o lado de fora (onde está a peça)
      p[u] = pu + o * (-hu / L) * off; p[v] = pv + o * (-hv / L) * off; p[k] = h + o * (1 / L) * off;
    });
    fino.delete();
  } catch (e) { throw new Error(tr('Não foi possível projetar: ') + e.message); }
  if (RotInv) { const g = res.transform(RotInv.elements); res.delete(); res = g; }
  res.avisoCurva = avisoCurva;
  return res;
}
function confirmarProjecao(A, res, receitaNo = A) {
  const d = deManifold(res); res.delete();
  const b2 = new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(d.v, 3)), c2 = b2.getCenter(new V3());
  const P = [arred(c2.x), arred(c2.y), arred(b2.min.z)];
  for (let i = 0; i < d.v.length; i += 3) { d.v[i] -= P[0]; d.v[i + 1] -= P[1]; d.v[i + 2] -= P[2]; }
  const Pi = new THREE.Matrix4().makeTranslation(-P[0], -P[1], -P[2]);
  alterar(() => {
    const novo = novaMalha(tt`${A.nome} (na superfície)`, A.cor);
    gravarMalha(novo, d); novo.furo = !!A.furo;
    novo.transformacao = { posicao: P, rotacao: [0, 0, 0], escala: [1, 1, 1] };
    const r = structuredClone(receitaNo); r.id = A.id; definirMatriz(r, Pi.clone().multiply(matrizDoNo(receitaNo))); novo.receita = [r];
    const idx = E.doc.objetos.indexOf(A);
    E.doc.objetos.splice(idx, 1, novo);
    E.sel = [novo.id];
  });
  mensagem(A.furo ? tr('Peça projetada na superfície como gravação. Agrupe com o destino para cortar.') : tr('Peça projetada na superfície como relevo. Agrupe com o destino para unir. "Voltar à receita" desfaz a projeção.'));
}

function consolidar() {
  const alvo = E.sel.length ? selecionados() : [...E.doc.objetos];
  if (!alvo.some(o => !o.furo)) return mensagem(tr('Nada sólido para consolidar.'), true);
  let m;
  try { m = motor.resultadoFinal(alvo); } catch (e) { return mensagem(tr('Não foi possível consolidar: ') + e.message, true); }
  const d = deManifold(m); m.delete();
  // origem da peça no centro da base, para ela ficar fácil de posicionar
  const b = new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(d.v, 3)), c = b.getCenter(new THREE.Vector3());
  const P = [arred(c.x), arred(c.y), arred(b.min.z)];
  for (let i = 0; i < d.v.length; i += 3) { d.v[i] -= P[0]; d.v[i + 1] -= P[1]; d.v[i + 2] -= P[2]; }
  const Pi = new THREE.Matrix4().makeTranslation(-P[0], -P[1], -P[2]);
  const nomeAuto = alvo.length === 1 ? alvo[0].nome : tt`Peça consolidada (${alvo.length} itens)`;
  const ids = new Set(alvo.map(o => o.id));
  let novo;
  alterar(() => {
    novo = novaMalha(nomeAuto, alvo.find(o => !o.furo).cor);
    gravarMalha(novo, d);
    novo.transformacao = { posicao: P, rotacao: [0, 0, 0], escala: [1, 1, 1] };
    novo.receita = alvo.map(o => { const r = structuredClone(o); definirMatriz(r, Pi.clone().multiply(matrizDoNo(o))); return r; });
    const idx = Math.min(...alvo.map(o => E.doc.objetos.indexOf(o)));
    E.doc.objetos = E.doc.objetos.filter(o => !ids.has(o.id));
    E.doc.objetos.splice(idx, 0, novo);
    E.sel = [novo.id];
  });
  mensagem(tt`${alvo.length} item(ns) consolidado(s) numa peça de ${fmtInt(d.t.length / 3)} triângulos. A receita ficou guardada dentro dela.`);
}
function voltarReceita(no) {
  const M = matrizDoNo(no);
  alterar(() => {
    const partes = no.receita.map(r => { const c = clonarComNovosIds(r); definirMatriz(c, M.clone().multiply(matrizDoNo(r))); return c; });
    E.doc.objetos.splice(E.doc.objetos.indexOf(no), 1, ...partes);
    E.sel = partes.map(p => p.id);
  });
  mensagem(tr('Receita restaurada: as peças originais voltaram, editáveis.'));
}
async function salvarNaBiblioteca(no) {
  const nome = (await pedirTexto(tr('Salvar na biblioteca'), tr('Nome da peça'), no.nome) ?? '').trim();
  if (!nome) return;
  if (pecasBib.some(p => p.nome.toLowerCase() === nome.toLowerCase()) && !confirm(tt`Já existe a peça "${nome}". Substituir?`)) return;
  let malha, receita;
  if (no.tipo === 'malha') {
    malha = no.malha;
    receita = no.receita ?? (no.origem ? [{ ...structuredClone(no.origem), transformacao: { posicao: [0, 0, 0], rotacao: [0, 0, 0], escala: no.transformacao.escala } }] : []);
  } else {
    let s; try { s = motor.local(no).scale(no.transformacao.escala); } catch (e) { return mensagem(e.message, true); }
    const tmp = novaMalha(nome, no.cor); gravarMalha(tmp, deManifold(s)); s.delete();
    malha = tmp.malha;
    const r = structuredClone(no); r.transformacao = { posicao: [0, 0, 0], rotacao: [0, 0, 0], escala: no.transformacao.escala };
    receita = [r];
  }
  const tmpM = novaMalha('', no.cor); tmpM.malha = malha;
  const mm = lerMalha(tmpM), mini = miniaturaDeDados('peca|' + malha.rev, { posicoes: mm.v, indices: mm.t }, no.cor);
  const caminho = await anvil.salvarPeca(nome, serializarPeca(nome, malha, receita, no.cor, mini));
  await carregarPecas();
  mensagem(tt`Peça "${nome}" salva na biblioteca (${caminho}).`);
}
let pecasBib = [];
async function carregarPecas() { pecasBib = await anvil.listarPecas(); montarBiblioteca(); }
async function inserirPeca(p, pos = null) {
  novaPecaPreparar();
  let dados;
  try { dados = lerPeca((await anvil.ler(p.caminho)).texto); } catch (e) { return mensagem(tt`Peça "${p.nome}": ${e.message}`, true); }
  const no = novaMalha(dados.nome || p.nome, dados.cor || CORES[E.corIdx++ % CORES.length]);
  no.malha = dados.malha;
  no.transformacao.posicao = pos ?? posicaoNova();
  if (dados.receita?.length) no.receita = dados.receita;
  alterar(() => { E.doc.objetos.push(no); E.sel = [no.id]; });
  mensagem(tt`${no.nome} inserida.${no.receita ? tr(' "Voltar à receita" mostra como ela foi feita.') : ''}`);
}

// Vista por baixo da mesa: a marca some e a mesa fica bem transparente, para ver o que está abaixo dela
function ajustarMesaPorBaixo() {
  const baixo = camera.position.z < 0;
  if (baixo === plano.userData.porBaixo) return;
  plano.userData.porBaixo = baixo;
  plano.traverse(o => {
    if (o.userData.marca) o.visible = !baixo;
    else if (o.userData.chao) o.material.opacity = baixo ? 0.32 : 0.55;
    else if (o.isLineSegments || o.isLine) { o.material.transparent = true; o.material.opacity = baixo ? 0.7 : 1; }
  });
}
// Setas do espelhar: o tamanho acompanha a PEÇA (como as alças), mas sem ficar menor que ~26 px nem maior
// que ~110 px na tela; cada seta fica num lado diferente da peça, afastada na proporção do próprio tamanho
// — com zoom para longe elas não crescem mais que a peça nem se amontoam umas sobre as outras.
function escalarSetasEspelho() {
  const { b, c, t } = grupoEspelho.userData; if (!b) return;
  const alt = renderer.domElement.clientHeight || 600;
  const pxPorMM = p => alt / (2 * camera.position.distanceTo(p) * Math.tan(camera.fov * RAD / 2));
  for (const s of grupoEspelho.children) {
    const e = s.userData.espelho, dimEixo = e === 'x' ? t.x : e === 'y' ? t.y : t.z;
    const px = pxPorMM(c);
    const L = Math.min(110 / px, Math.max(26 / px, Math.max(dimEixo, Math.max(t.x, t.y, t.z) * 0.5) * 0.7));
    const off = Math.max(0.15 * Math.max(t.x, t.y, t.z), L * 0.45, 3 / px * 4);
    if (e === 'x') s.position.set(c.x, b.min.y - off, b.min.z + 0.05);
    else if (e === 'y') s.position.set(b.max.x + off, c.y, b.min.z + 0.05);
    else s.position.set(b.min.x - off, b.min.y - off, c.z);
    // espessura fixa na tela: haste de ~5 px e pontas de ~18 px, como as setas do mover (só afina se a seta for curta)
    const g = Math.min(42 / px, L * 0.9);
    s.scale.set(g, L, g);
  }
}
// Centro do texto nos botões da barra. Medido no print do Windows (Bahnschrift 13px, botão de 30px):
// as maiúsculas ficavam ~2,5 px acima do meio (a fonte sobra espaço embaixo). Com a Bahnschrift o texto
// é empurrado para baixo; com outras fontes (que já centralizam) nada muda.
function ajustarCentroTexto() {
  const temBahn = document.fonts?.check?.('600 13px Bahnschrift') && [...document.fonts].length >= 0 && (() => {
    const c = document.createElement('canvas').getContext('2d'), t = 'HAMEOV';
    c.font = '600 13px Bahnschrift, monospace'; const a = c.measureText(t).width;
    c.font = '600 13px monospace'; return Math.abs(a - c.measureText(t).width) > 0.5;   // a fonte existe de verdade
  })();
  document.documentElement.style.setProperty('--empurra-texto', temBahn ? '5px' : '0px');
  document.documentElement.style.setProperty('--empurra-modo', temBahn ? '5px' : '0px');
  window.__anvilCentroTexto = { bahnschrift: !!temBahn };
}
(document.fonts?.ready ?? Promise.resolve()).then(() => ajustarCentroTexto());
// ---------- área escura dos furos, desenhada pela placa de vídeo a cada quadro ----------
// Em vez de calcular a intersecção sólido × furo (lento: dava saltos e rastro ao arrastar), cada pixel
// de sólido que está DENTRO do volume de algum furo é escurecido, usando o stencil: as faces da frente do
// furo que ficam na frente da superfície somam 1, as de trás que ficam na frente subtraem 1; sobra
// diferente de zero exatamente onde a superfície do sólido está dentro do furo. Funciona ao vivo.
const cenaFuros = new THREE.Scene(), cenaEscurecer = new THREE.Scene(), camTela = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const matFuroFrente = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.FrontSide,
  stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.IncrementWrapStencilOp, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp });
const matFuroTras = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.BackSide,
  stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.DecrementWrapStencilOp, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp });
cenaEscurecer.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthTest: false, depthWrite: false,
  stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.KeepStencilOp, stencilFail: THREE.KeepStencilOp })));
const clonesFuro = new Map();
function desenharAreaFuros() {
  const furos = [];
  for (const [id, m] of malhas) { const no = noPorId(id); if (no?.furo && !m.userData.erro && m.visible) furos.push([id, m]); }
  for (const [id, par] of clonesFuro) if (!furos.some(([i]) => i === id)) { cenaFuros.remove(...par); clonesFuro.delete(id); }
  if (!furos.length) return;
  for (const [id, m] of furos) {
    let par = clonesFuro.get(id);
    if (!par || par[0].geometry !== m.geometry) {
      if (par) cenaFuros.remove(...par);
      par = [new THREE.Mesh(m.geometry, matFuroFrente), new THREE.Mesh(m.geometry, matFuroTras)];
      for (const c of par) c.matrixAutoUpdate = false;
      cenaFuros.add(...par); clonesFuro.set(id, par);
    }
    m.updateMatrixWorld(true);
    for (const c of par) { c.matrix.copy(m.matrixWorld); c.matrixWorldNeedsUpdate = true; }
  }
  const ac = renderer.autoClear; renderer.autoClear = false;
  renderer.clearStencil();
  renderer.render(cenaFuros, camera);
  renderer.render(cenaEscurecer, camTela);
  renderer.autoClear = ac;
}
function desenhar() { ajustarMesaPorBaixo(); if (typeof atualizarSetaZ === 'function') try { atualizarSetaZ(); } catch {} if (ESP && grupoEspelho.children.length) escalarSetasEspelho(); if (window.__alcasOk) { atualizarAlcas(); atualizarCotas(); } if (ALN && grupoPontosAln.children.length) escalarPontosAlinhar(); renderer.render(cena, camera); try { desenharAreaFuros(); } catch (e) { console.warn(e); } }
new ResizeObserver(() => {
  const { clientWidth: w, clientHeight: h } = vista;
  renderer.setSize(w, h); for (const m of Object.values(MAT)) m.resolution.set(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); desenhar();
}).observe(vista);

// ---------- utilidades ----------
const emIngles = () => idiomaAtual() === 'en';
const nomeG = g => (emIngles() && g.en?.nome) || tr(g.nome);
const catG = g => (emIngles() && g.en?.categoria) || tr(g.categoria);
const descG = g => (emIngles() && g.en?.descricao) || tr(g.descricao || g.nome);
const rotuloP = (g, d) => (emIngles() && g?.en?.rotulos?.[d.chave]) || tr(d.rotulo);
const opcaoP = (g, d, val, rot) => (emIngles() && g?.en?.opcoes?.[val]) || tr(rot);
const arred = (v, d = 4) => { const r = Math.round(v * 10 ** d) / 10 ** d; return Object.is(r, -0) ? 0 : r; };
const normAng = a => { a = ((a + 180) % 360 + 360) % 360 - 180; return a === -180 ? 180 : a; };
function fmt(v, casas = 2) { return decimal(v, casas); }
const lerNumero = avaliar;
function mensagem(txt, erro = false) { const m = $('#msg'); m.textContent = txt; m.classList.toggle('erro', erro); }
const noPorId = id => E.doc.objetos.find(o => o.id === id);
const selecionados = () => E.sel.map(noPorId).filter(Boolean);

function matrizDoNo(no) {
  const t = no.transformacao;
  return new THREE.Matrix4().compose(new THREE.Vector3(...t.posicao),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...t.rotacao.map(a => a * RAD), 'XYZ')), new THREE.Vector3(...t.escala));
}
function definirMatriz(no, m) {
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  m.decompose(p, q, s);
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  no.transformacao = {
    posicao: p.toArray().map(v => arred(v)),
    rotacao: [e.x, e.y, e.z].map(a => arred(normAng(arred(a * GRAU, 6)))),
    escala: s.toArray().map(v => arred(v, 6)),
  };
}

// ---------- alterações com histórico ----------
function alterar(fn, { reconstruir = true, painel = true } = {}) {
  if (MA) { try { MA.base?.delete(); } catch {} MA = null; limparGrupoArestas(); }
  hist.registrar(E.doc);
  fn();
  posicionarJuncoes();
  marcarSujo();
  if (reconstruir) reconstruir3d();
  if (ME && !noPorId(ME.id)) { ME = null; limparOverlay(); }
  if (painel) montarPainel();
}
function marcarSujo(v = true) {
  E.sujo = v;
  anvil.informarEstado({ sujo: v, titulo: E.caminho ? E.caminho.split(/[\\/]/).pop() : tr('Sem título') });
}

// ---------- reconstrução da cena ----------
const geoErro = new THREE.BoxGeometry(10, 10, 10).translate(0, 0, 5);
function geometriaPara(no) {
  const k = motor.chave(no) + '|' + motor.resolucao;
  let c = cacheGeo.get(k);
  if (!c) {
    let d, aviso;
    if (no.tipo === 'malha') {
      const m = lerMalha(no); d = { posicoes: m.v, indices: m.t };
      try { motor.local(no); } catch (e) { aviso = e.message; }
    } else { var solido = motor.local(no); d = dadosMalha(solido); aviso = solido.avisoAnvil; }
    let geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(d.posicoes), 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(d.indices), 1));
    const arestas = arestasVisiveis(d.posicoes, d.indices, 25);
    geo = geo.toNonIndexed(); geo.computeVertexNormals(); geo.computeBoundingBox();
    c = { geo, arestas, aviso, caminhos: solido?.caminhos, runIndex: d.runIndex, runOriginalID: d.runOriginalID };
    cacheGeo.set(k, c);
  }
  c.usado = true;
  return c;
}

// ---------- grupos multicoloridos ----------
const ehMulticor = no => (no.tipo === 'grupo' && no.multicor !== false) || (no.tipo === 'acabamento' && no.filhos[0]?.tipo === 'grupo' && no.filhos[0].multicor !== false);
function primeiroSolido(no) {
  for (const f of no.filhos ?? []) if (!f.furo) return f.filhos && f.tipo !== 'acabamento' && f.multicor !== false ? (primeiroSolido(f) ?? f) : f;
  return null;
}
const assinaturaCores = no => JSON.stringify(no.filhos ? [no.cor, no.furo, no.multicor, no.filhos.map(f => JSON.parse(assinaturaCores(f)))] : [no.cor, no.furo]);
function geometriaColorida(no, ent, malha) {
  const sig = assinaturaCores(no) + '|' + ent.geo.uuid;
  if (malha.userData.geoCor?.sig === sig) return malha.userData.geoCor.geo;
  malha.userData.geoCor?.geo.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', ent.geo.attributes.position); g.setAttribute('normal', ent.geo.attributes.normal);
  g.boundingBox = ent.geo.boundingBox; g.boundingSphere = ent.geo.boundingSphere;
  const n = ent.geo.attributes.position.count, cor = new Float32Array(n * 3), c = new THREE.Color();
  const padrao = new THREE.Color((primeiroSolido(no.tipo === 'acabamento' ? no.filhos[0] : no) ?? no).cor);
  for (let i = 0; i < n; i++) cor.set([padrao.r, padrao.g, padrao.b], i * 3);
  const ri = ent.runIndex, ro = ent.runOriginalID;
  if (ri && ro) for (let r = 0; r < ro.length; r++) {
    const cam = ent.caminhos?.get(ro[r]);
    let f = cam ? no : null;
    if (cam) for (const i of cam.split('/')) f = f?.filhos?.[+i];
    if (!f || f.furo) continue;
    c.set(f.cor);
    for (let v = ri[r]; v < ri[r + 1]; v++) cor.set([c.r, c.g, c.b], v * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  malha.userData.geoCor = { sig, geo: g };
  return g;
}

// ---------- área que um furo vai cortar (mostrada mais escura) ----------
const grupoAfetado = new THREE.Group(); cena.add(grupoAfetado);
const cacheAfetado = new Map();
// durante um arraste (mover, girar, redimensionar), a área escura acompanha ao vivo: usa a posição
// atual das malhas na tela em vez da que está gravada no projeto
let afetadasAgendado = 0;
function afetadasAoVivo() {
  if (renderer.getContext().getContextAttributes()?.stencil) return;
  // enquanto o cálculo novo não fica pronto, a área escura já acompanha o furo (sem deixar rastro)
  for (const m of grupoAfetado.children) {
    const mf = malhas.get(m.userData.furoId); if (!mf || !m.userData.base) continue;
    mf.updateMatrix(); m.matrixAutoUpdate = false;
    m.matrix.copy(mf.matrix).multiply(m.userData.base); m.matrixWorldNeedsUpdate = true;
  }
  if (afetadasAgendado) return;
  afetadasAgendado = setTimeout(() => { afetadasAgendado = 0; try { atualizarAfetadas(true); desenhar(); } catch {} }, 50);
}
function atualizarAfetadas(aoVivo = false) {
  grupoAfetado.clear();
  if (renderer.getContext().getContextAttributes()?.stencil) return; // feito por desenharAreaFuros()
  const usados = new Set();
  // todo furo solto que invade um sólido solto: a parte do sólido que vai ser cortada fica mais escura
  const caixas = new Map();
  const caixa = n => { if (!caixas.has(n.id)) { const m = malhas.get(n.id); m.updateMatrixWorld(true); caixas.set(n.id, new THREE.Box3().setFromObject(m, true)); } return caixas.get(n.id); };
  const pares = [];
  let validos = E.doc.objetos.filter(n => malhas.has(n.id) && !E.erros.has(n.id));
  if (aoVivo) validos = validos.map(n => { const m = malhas.get(n.id); m.updateMatrix(); const c = { ...n, transformacao: { ...n.transformacao } }; definirMatriz(c, m.matrix); return c; });
  for (const fur of validos.filter(n => n.furo)) for (const sol of validos.filter(n => !n.furo))
    if (pares.length < 80 && caixa(fur).intersectsBox(caixa(sol))) pares.push([sol, fur]);
  for (const [sol, fur] of pares) {
    const k = motor.chave(sol) + JSON.stringify(sol.transformacao) + '|' + motor.chave(fur) + JSON.stringify(fur.transformacao);
    usados.add(k);
    let ent = cacheAfetado.get(k);
    if (!ent) {
      ent = { geo: null };
      try {
        const a = motor.mundo(sol), b = motor.mundo(fur), x = a.intersect(b); a.delete(); b.delete();
        const d = dadosMalha(x); x.delete();
        if (d.indices.length) {
          let g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(d.posicoes), 3));
          g.setIndex(new THREE.BufferAttribute(new Uint32Array(d.indices), 1));
          g = g.toNonIndexed(); g.computeVertexNormals(); ent.geo = g;
        }
      } catch {}
      cacheAfetado.set(k, ent);
    }
    if (!ent.geo) continue;
    const m = new THREE.Mesh(ent.geo, new THREE.MeshStandardMaterial({
      color: new THREE.Color(sol.cor).multiplyScalar(0.3), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
    m.renderOrder = 3; grupoAfetado.add(m);
    // guarda a posição do furo neste cálculo, para a área poder acompanhá-lo até o próximo
    const mf = malhas.get(fur.id); if (mf) { mf.updateMatrix(); m.userData.furoId = fur.id; m.userData.base = mf.matrix.clone().invert(); }
  }
  for (const [k, e] of cacheAfetado) if (!usados.has(k)) { e.geo?.dispose(); cacheAfetado.delete(k); }
}

function reconstruir3d() {
  motor.iniciarPassada();
  E.erros.clear(); E.avisos.clear();
  for (const c of cacheGeo.values()) c.usado = false;
  let totalTri = 0;
  const vistos = new Set();
  for (const no of E.doc.objetos) {
    vistos.add(no.id);
    let malha = malhas.get(no.id);
    if (!malha) {
      malha = new THREE.Mesh(undefined, new THREE.MeshStandardMaterial());
      malha.add(new THREE.LineSegments(undefined, new THREE.LineBasicMaterial()));
      malha.add(new THREE.LineSegments(undefined, matFioGlobal));
      malha.userData.id = no.id;
      objetos3d.add(malha); malhas.set(no.id, malha);
    }
    let geo = geoErro, arestas = null, ent = null;
    try { ent = geometriaPara(no); geo = ent.geo; arestas = ent.arestas; if (ent.aviso) E.avisos.set(no.id, ent.aviso); }
    catch (e) { E.erros.set(no.id, e.message ?? String(e)); }
    malha.userData.multicor = !!(ent && ent.caminhos && ehMulticor(no));
    malha.geometry = malha.userData.multicor ? geometriaColorida(no, ent, malha) : geo;
    malha.children[0].geometry = arestas ?? new THREE.EdgesGeometry(geoErro);
    malha.userData.erro = E.erros.has(no.id);
    const fio = malha.children[1];
    fio.visible = E.verTri && !!ent;
    if (fio.visible) { ent.fio ??= new THREE.WireframeGeometry(ent.geo); fio.geometry = ent.fio; }
    totalTri += ent ? ent.geo.attributes.position.count / 3 : 0;
    aplicarTransformacao(malha, no.transformacao);
  }
  for (const [id, m] of malhas) if (!vistos.has(id)) { objetos3d.remove(m); malhas.delete(id); }
  for (const [k, c] of cacheGeo) if (!c.usado) { c.geo.dispose(); c.arestas.dispose(); c.fio?.dispose(); cacheGeo.delete(k); }
  $('#tris').textContent = tt`${fmtInt(totalTri)} triângulos`;
  E.sel = E.sel.filter(id => malhas.has(id));
  atualizarAfetadas();
  objetos3d.updateMatrixWorld(true);
  validarModos();
  atualizarVisual();
  if (E.erros.size) mensagem(tt`${E.erros.size} objeto(s) com erro: ${[...E.erros.values()][0]}`, true);
}

// Linhas de aresta (como THREE.EdgesGeometry), mas ignorando "agulhas": triângulos finíssimos que as
// operações às vezes deixam. A normal deles é instável e virava um risco comprido atravessando a face;
// aqui eles não contam, e a dobra é medida entre os triângulos de verdade dos dois lados.
function arestasVisiveis(P, I, limiarGraus = 25) {
  const nT = I.length / 3, normais = new Float32Array(nT * 3), agulha = new Uint8Array(nT);
  for (let t = 0; t < nT; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    const vx = P[c] - P[b], vy = P[c + 1] - P[b + 1], vz = P[c + 2] - P[b + 2];
    let cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx;
    const A2 = cx * cx + cy * cy + cz * cz, L2 = Math.max(ux * ux + uy * uy + uz * uz, wx * wx + wy * wy + wz * wz, vx * vx + vy * vy + vz * vz);
    if (A2 < 1e-14 || A2 / Math.max(L2, 1e-12) < 4e-6) { agulha[t] = 1; continue; }
    const l = Math.sqrt(A2); normais[t * 3] = cx / l; normais[t * 3 + 1] = cy / l; normais[t * 3 + 2] = cz / l;
  }
  const chaveV = i => `${Math.round(P[i * 3] * 1e4)},${Math.round(P[i * 3 + 1] * 1e4)},${Math.round(P[i * 3 + 2] * 1e4)}`;
  const arestas = new Map();
  for (let t = 0; t < nT; t++) {
    if (agulha[t]) continue;
    for (let k = 0; k < 3; k++) {
      const i0 = I[t * 3 + k], i1 = I[t * 3 + (k + 1) % 3], h0 = chaveV(i0), h1 = chaveV(i1);
      if (h0 === h1) continue;
      const ch = h0 < h1 ? h0 + '|' + h1 : h1 + '|' + h0;
      const e = arestas.get(ch); if (e) e.t.push(t); else arestas.set(ch, { i0, i1, t: [t] });
    }
  }
  const cosLim = Math.cos(limiarGraus * Math.PI / 180), pos = [];
  for (const e of arestas.values()) {
    let mostra;
    if (e.t.length === 2) { const [a, b] = e.t; mostra = normais[a * 3] * normais[b * 3] + normais[a * 3 + 1] * normais[b * 3 + 1] + normais[a * 3 + 2] * normais[b * 3 + 2] <= cosLim; }
    else mostra = false; // aresta com um lado só = vizinha de uma agulha (ou malha aberta): não desenha
    if (mostra) pos.push(P[e.i0 * 3], P[e.i0 * 3 + 1], P[e.i0 * 3 + 2], P[e.i1 * 3], P[e.i1 * 3 + 1], P[e.i1 * 3 + 2]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g;
}
function aplicarTransformacao(m, t) {
  m.position.fromArray(t.posicao);
  m.rotation.set(t.rotacao[0] * RAD, t.rotacao[1] * RAD, t.rotacao[2] * RAD, 'XYZ');
  m.scale.fromArray(t.escala);
}

function atualizarVisual() {
  for (const [id, m] of malhas) {
    const no = noPorId(id), sel = E.sel.includes(id), mat = m.material, lin = m.children[0].material;
    if (m.userData.erro) {
      mat.color.set(0xb3261e); mat.wireframe = true; mat.transparent = false; mat.opacity = 1; mat.depthWrite = true;
    } else if (no.furo) {
      mat.color.set(0x8a9399); mat.wireframe = false; mat.transparent = true; mat.opacity = 0.32; mat.depthWrite = false;
    } else {
      const op = (no.opacidade ?? 100) / 100;
      mat.color.set(m.userData.multicor ? 0xffffff : no.cor); mat.wireframe = false;
      mat.transparent = op < 1; mat.opacity = op; mat.depthWrite = op >= 1;
    }
    mat.vertexColors = !!m.userData.multicor && !no.furo && !m.userData.erro;
    mat.flatShading = false; mat.roughness = 0.7; mat.metalness = 0.05;
    mat.polygonOffset = true; mat.polygonOffsetFactor = 1; mat.polygonOffsetUnits = 1;
    mat.emissive.set(ALN && ALN.ref === id ? 0x0a3550 : sel ? 0x3a2a00 : 0x000000);
    lin.color.set(sel ? 0xe0a100 : (no.furo ? 0x5f6a70 : 0x24323a));
    lin.transparent = true; lin.opacity = sel ? 1 : 0.35;
    mat.needsUpdate = true;
  }
  pivoDaSelecao();
  const prim = malhas.get(E.sel[E.sel.length - 1]);
  const preso = E.sel.length === 1 && juncaoAtiva(noPorId(E.sel[0]));
  if (prim && !MA && !ME && !JF && !AL && !FM && !ALN && !ESP && E.modoGizmo === 'girar') { posicionarAjudanteGiro(); gizmo.attach(ajudanteGiro); }
  else if (AF) gizmo.detach();
  else if (prim && !MA && !ME && !JF && !AL && !FM && !ALN && !ESP && !preso && moverPeca) gizmo.detach(); // move arrastando a peça
  else if (prim && !MA && !ME && !JF && !AL && !FM && !ALN && !ESP && !preso) { gizmo.showX = gizmo.showY = gizmo.showZ = true; gizmo.setSize(0.9); gizmo.attach(prim); } // o gizmo de mover tem sempre o tamanho padrão
  else if (!ME) gizmo.detach();
  atualizarMarcador();
  desenhar();
}

// ---------- pivô ----------
function caixaSelecao() {
  const b = new THREE.Box3();
  for (const id of E.sel) { const m = malhas.get(id); if (m) { m.updateMatrixWorld(true); b.expandByObject(m, true); } }
  return b;
}
// O "ponto escolhido" vale só para a seleção em que foi escolhido: ao selecionar outra peça (ou criar
// uma nova), o giro volta para o centro — antes o gizmo continuava no ponto da peça anterior.
function pivoDaSelecao() {
  // qualquer pivô escolhido (base, canto, origem, ponto) vale só para a seleção em que foi escolhido:
  // trocou de peça, de grupo ou de conjunto selecionado, o giro volta para o centro
  const chave = E.sel.join();
  if (E.pivoDono !== chave) { E.pivoDono = chave; if (E.pivo !== 'centro') { E.pivo = 'centro'; localStorage.setItem('pivo', 'centro'); } }
}
// Durante uma sequência de giros da mesma seleção, o pivô fica parado: girar muda a caixa envolvente
// (alinhada aos eixos), e o centro dela "andava" a cada giro, levando o gizmo junto. O pivô só é
// recalculado quando a seleção muda ou quando ela é mexida de outro jeito (mover, redimensionar…).
const assinaturaSel = () => E.sel.map(id => JSON.stringify(noPorId(id)?.transformacao)).join('|');
function pontoPivo() {
  const sel = selecionados();
  if (!sel.length) return null;
  pivoDaSelecao();
  if (E.pivo === 'ponto' || E.pivo === 'origem') return pontoPivoCalculado(sel); // não dependem da caixa
  const chave = E.sel.join() + '|' + E.pivo;
  if (E.pivoFixo?.chave === chave && E.pivoFixo.ass === assinaturaSel()) return E.pivoFixo.ponto.clone();
  const p = pontoPivoCalculado(sel);
  E.pivoFixo = { chave, ponto: p.clone(), ass: assinaturaSel() };
  return p;
}
function pontoPivoCalculado(sel) {
  const b = caixaSelecao(), c = b.getCenter(new THREE.Vector3());
  switch (E.pivo) {
    case 'base': return new THREE.Vector3(c.x, c.y, b.min.z);
    case 'canto': return b.min.clone();
    case 'origem': return new THREE.Vector3(...sel[sel.length - 1].transformacao.posicao);
    case 'ponto': return new THREE.Vector3(...E.pontoPivo);
    default: return c;
  }
}
function atualizarMarcador() {
  if (gizmo.object === ajudanteGiro && !arraste) posicionarAjudanteGiro();
  const p = pontoPivo();
  marcador.visible = !!p;
  if (p) {
    marcador.position.copy(p);
    const d = camera.position.distanceTo(p);
    marcador.scale.setScalar(Math.max(0.3, d / 250));
  }
}
orbita.addEventListener('change', () => { if (marcador.visible) { atualizarMarcador(); } });

// ---------- seleção com o mouse ----------
const ray = new THREE.Raycaster();
let toque = null;
// ---------- mover arrastando a peça (como no Tinkercad) ----------
// Com a preferência ligada (padrão): arrastar a peça a desliza sobre o plano dela; a seta preta no
// topo sobe e desce. O gizmo de setas não aparece. Desligada: só o gizmo move.
let moverPeca = localStorage.getItem('moverPeca') !== '0';
let arrasteCorpo = null;
const setaZ = new THREE.Group();
{
  const mat = new THREE.MeshBasicMaterial({ color: 0x2c3a42, depthTest: false, transparent: true, opacity: 0.8 });
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), mat); haste.position.z = 0.3; haste.rotation.x = Math.PI / 2;
  const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 16), mat); ponta.position.z = 0.82; ponta.rotation.x = Math.PI / 2;
  const pega = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); pega.position.z = 0.6; // área de pegar maior
  setaZ.add(haste, ponta, pega); setaZ.traverse(o => { o.renderOrder = 60; }); setaZ.visible = false; cena.add(setaZ);
}
const podeMoverPeca = () => moverPeca && E.modoGizmo === 'mover' && !MA && !ME && !JF && !AL && !FM && !ALN && !ESP && !AF && !E.escolhendoPonto;
function atualizarSetaZ() {
  const ver = podeMoverPeca() && E.sel.length > 0 && !(E.sel.length === 1 && juncaoAtiva(noPorId(E.sel[0])));
  setaZ.visible = ver;
  if (!ver) return;
  const b = caixaSelecao(); if (b.isEmpty()) { setaZ.visible = false; return; }
  const topo = new V3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.max.z);
  const k = camera.position.distanceTo(topo) * 0.04;
  setaZ.position.copy(topo).add(new V3(0, 0, k * 0.35)); setaZ.scale.setScalar(k);
}
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.shiftKey || e.ctrlKey || !podeMoverPeca()) return;
  const r = raioDoMouse(e);
  let modoZ = false, ponto, ids;
  if (setaZ.visible && r.intersectObject(setaZ, true).length) { modoZ = true; ids = [...E.sel]; ponto = setaZ.position.clone(); }
  else {
    const hit = r.intersectObjects([...malhas.values()], false)[0]; if (!hit) return;
    const id = hit.object.userData.id; if (!id) return;
    var jaSel = E.sel.includes(id);
    if (!jaSel) { E.sel = [id]; atualizarVisual(); montarPainel(); }
    if (E.sel.length === 1 && juncaoAtiva(noPorId(id))) return;  // peça presa: segue o jeito dela de deslizar
    ids = [...E.sel]; ponto = hit.point.clone();
  }
  e.stopImmediatePropagation();
  caixaSel = null; // não começa seleção por área junto com o arraste da peça ou da seta
  orbita.enabled = false;
  const dirCam = camera.getWorldDirection(new V3()).setZ(0); if (dirCam.lengthSq() < 1e-6) dirCam.set(0, 1, 0);
  arrasteCorpo = {
    z: modoZ, sx: e.clientX, sy: e.clientY, moveu: false, ids, p0: ponto,
    plano: modoZ ? new THREE.Plane().setFromNormalAndCoplanarPoint(dirCam.normalize(), ponto) : new THREE.Plane(new V3(0, 0, 1), -ponto.z),
    ini: new Map(ids.map(id => [id, malhas.get(id)?.position.clone()])), d: new V3(), jaSel: !modoZ && jaSel && E.sel.length === 1,
  };
}, false);
window.addEventListener('pointermove', e => {
  const a = arrasteCorpo; if (!a) return;
  if (!a.moveu && Math.hypot(e.clientX - a.sx, e.clientY - a.sy) < 3) return;
  a.moveu = true;
  const P = raioDoMouse(e).ray.intersectPlane(a.plano, new V3()); if (!P) return;
  const d = P.sub(a.p0); if (a.z) d.set(0, 0, d.z); else d.z = 0;
  const passo = Number($('#passo-mov').value) || 0;
  if (passo > 0) d.set(Math.round(d.x / passo) * passo, Math.round(d.y / passo) * passo, Math.round(d.z / passo) * passo);
  a.d.copy(d);
  for (const [id, p] of a.ini) { const m = malhas.get(id); if (m && p) m.position.copy(p).add(d); }
  mostrarCotaMov(a.z ? `Z ${d.z >= 0 ? '+' : ''}${fmt(d.z, 2)} mm` : `X ${d.x >= 0 ? '+' : ''}${fmt(d.x, 2)} mm   Y ${d.y >= 0 ? '+' : ''}${fmt(d.y, 2)} mm`);
  afetadasAoVivo(); atualizarSetaZ(); desenhar();
});
window.addEventListener('pointerup', () => {
  const a = arrasteCorpo; if (!a) return;
  arrasteCorpo = null; orbita.enabled = true; cotaMov.hidden = true; limparCotasMov();
  if (!a.moveu || a.d.lengthSq() === 0) { if (!a.moveu && a.jaSel) comandos.alternarGizmo(); else atualizarVisual(); return; }
  alterar(() => { for (const id of a.ids) { const t = noPorId(id)?.transformacao; if (t) for (let i = 0; i < 3; i++) t.posicao[i] = arred(t.posicao[i] + a.d.getComponent(i)); } });
  mensagem(tr('Movido.'));
});

renderer.domElement.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  toque = { x: e.clientX, y: e.clientY, noGizmo: gizmo.axis !== null && !!gizmo.object && !E.escolhendoPonto && !MA && !JF && !AL && !FM && !ALN };
});
renderer.domElement.addEventListener('pointerup', e => {
  if (e.button !== 0 || !toque) return;
  const moveu = Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 4;
  const t = toque; toque = null;
  if (moveu) return;
  // no modo girar, a esfera do giro livre cobre a peça: um clique SEM arrastar em cima da peça
  // selecionada volta para mover (antes o clique era "engolido" pelo gizmo)
  if (t.noGizmo && !(E.modoGizmo === 'girar' && E.sel.length === 1 && raioDoMouse(e).intersectObject(malhas.get(E.sel[0]) ?? new THREE.Object3D(), false).length)) return;
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hit = ray.intersectObjects([...malhas.values()], false)[0];

  if (E.escolhendoPonto) {
    if (hit) escolherPonto(hit);
    return;
  }
  if (MA) { if (!pincel?.ativo) clicarAresta(e); return; }
  if (ME) { clicarME(e); return; }
  // nos modos: clique num ponto de controle/face age; clique fora conclui (ou cancela) e vale como clique normal
  if (JF) { if (faceSobMouse(e, alvosJF())) { clicarJF(e); return; } sairJF(); mensagem(tr('Juntar faces cancelado.')); }
  else if (AL) { if (linhaSobMouse(e)) { clicarAlinhar(e); return; } sairAlinhar(); mensagem(tr('Junção mantida sem alinhar arestas. Arraste a peça para deslizar sobre a outra.')); }
  else if (FM) { if (faceSobMouse(e, E.sel.map(id => malhas.get(id)).filter(Boolean))) { clicarFM(e); return; } sairFM(); mensagem(tr('Face na mesa cancelado.')); }
  else if (ALN) { if (pontoAlinharSob(e) || (hit && E.sel.includes(hit.object.userData.id))) { clicarALN(e); return; } sairAlinharObj(); mensagem(tr('Alinhar concluído.')); }
  else if (ESP) { if (setaEspelhoSob(e)) { clicarESP(e); return; } sairEspelhar(); mensagem(tr('Espelhar concluído.')); }
  else if (AF) { clicarAF(e); return; }
  const id = hit?.object.userData.id;
  if (!id) { if (!e.shiftKey) E.sel = []; }
  else if (e.shiftKey || e.ctrlKey) E.sel = E.sel.includes(id) ? E.sel.filter(x => x !== id) : [...E.sel, id];
  else if (E.sel.length === 1 && E.sel[0] === id) {
    definirModoGizmo(E.modoGizmo === 'girar' ? 'mover' : 'girar'); montarPainel();
    mensagem(E.modoGizmo === 'girar' ? tr('Modo girar: arraste os anéis. Clique de novo na peça para mover.') : tr('Modo mover.'));
  } else { E.sel = [id]; definirModoGizmo('mover'); }
  atualizarVisual(); montarPainel();
});

function escolherPonto(hit) {
  // encaixa no vértice mais próximo do triângulo clicado se estiver a menos de 2 mm
  let p = hit.point.clone();
  const pos = hit.object.geometry.attributes.position, f = hit.face;
  if (f) {
    let melhor = null, dm = 2;
    for (const i of [f.a, f.b, f.c]) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(hit.object.matrixWorld);
      const d = v.distanceTo(p);
      if (d < dm) { dm = d; melhor = v; }
    }
    if (melhor) p = melhor;
  }
  E.pontoPivo = p.toArray().map(v => arred(v, 2));
  E.pivo = 'ponto'; E.pivoDono = E.pontoPivoDono = E.sel.join(); localStorage.setItem('pivo', 'ponto');
  cancelarEscolha();
  atualizarVisual(); montarPainel();
  mensagem(tt`Pivô em (${E.pontoPivo.map(v => fmt(v)).join('; ')})`);
}
function iniciarEscolha() { E.escolhendoPonto = true; vista.classList.add('escolhendo'); $('#aviso-escolha').hidden = false; gizmo.enabled = false; }
function cancelarEscolha() { E.escolhendoPonto = false; vista.classList.remove('escolhendo'); $('#aviso-escolha').hidden = true; gizmo.enabled = true; }

// ---------- arrastar com o gizmo ----------
let arraste = null;
// gizmo: clique de novo na peça selecionada alterna entre mover e girar (como no Corel)
const cotaMov = el('div', { id: 'cota-mov', hidden: true }); vista.appendChild(cotaMov);
// Giro pelo gizmo: os anéis ficam num "ajudante" posicionado no pivô escolhido no painel
// (padrão: centro da caixa da peça), não mais na base. Peça presa por junção: só o anel da
// normal do contato aparece e girá-lo muda o "Giro na face", sem soltar a junção.
const ajudanteGiro = new THREE.Object3D(); cena.add(ajudanteGiro);
function posicionarAjudanteGiro() {
  const no = noPorId(E.sel[E.sel.length - 1]);
  if (E.sel.length === 1 && juncaoAtiva(no)) {
    const { P, N } = baseJuncao(no), m = malhas.get(no.id);
    let alt = 0;
    if (m) { m.updateMatrixWorld(true); alt = new THREE.Box3().setFromObject(m, true).getCenter(new V3()).sub(P).dot(N); }
    ajudanteGiro.position.copy(P).addScaledVector(N, alt);   // meio da peça, no eixo da normal do contato
    ajudanteGiro.quaternion.setFromUnitVectors(new V3(0, 0, 1), N);
    gizmo.showX = false; gizmo.showY = false; gizmo.showZ = true; gizmo.setSize(1.25);
  } else {
    ajudanteGiro.position.copy(pontoPivo() ?? new V3());
    const m = E.sel.length === 1 ? malhas.get(E.sel[0]) : null;
    if (m) ajudanteGiro.quaternion.copy(m.quaternion); else ajudanteGiro.quaternion.identity();
    gizmo.showX = gizmo.showY = gizmo.showZ = true;
  }
  ajudanteGiro.updateMatrixWorld(true);
  ajustarTamanhoAneis();
}
// Os três anéis de giro ficam do lado de fora da peça (antes ficavam escondidos dentro dela e só um
// aparecia direito): o tamanho do gizmo acompanha o tamanho da seleção e a distância da câmera.
function ajustarTamanhoAneis() {
  if (gizmo.object !== ajudanteGiro) { gizmo.setSize(0.9); return; }
  const b = caixaSelecao(); if (b.isEmpty()) return;
  const raio = b.getBoundingSphere(new THREE.Sphere()).radius;
  const fator = ajudanteGiro.position.distanceTo(camera.position) * Math.min(1.9 * Math.tan(camera.fov * RAD / 2) / camera.zoom, 7) / 4;
  const maxTela = 0.4 * Math.tan(camera.fov * RAD / 2) / (0.5 * Math.min(1.9 * Math.tan(camera.fov * RAD / 2) / camera.zoom, 7) / 4); // anel ≤ 40% da meia-altura da vista
  gizmo.setSize(Math.max(0.9, Math.min(maxTela, (raio * 1.25) / (0.5 * fator))));
}
orbita.addEventListener('change', () => { if (gizmo.object === ajudanteGiro && !arraste) ajustarTamanhoAneis(); });
function definirModoGizmo(m) {
  E.modoGizmo = m;
  if (typeof atualizarVisual === 'function' && malhas.size) setTimeout(() => atualizarVisual(), 0);
  gizmo.setMode(m === 'girar' ? 'rotate' : 'translate');
  gizmo.setSpace(m === 'girar' ? 'local' : 'world');
  const b = $('#bt-modo');
  if (b) {
    // ícone com largura própria e texto separado: trocar o modo não muda o tamanho do botão
    b.replaceChildren(el('span', { class: 'icone-modo' }, m === 'girar' ? '⟳' : '✥'), el('span', {}, tr(m === 'girar' ? 'Girar' : 'Mover')));
    b.classList.toggle('ativo', m === 'girar');
  }
  desenhar();
}
// cotas de deslocamento: linhas de cota a partir da posição inicial, só nos eixos que mudaram
const grupoCotasMov = new THREE.Group(); cena.add(grupoCotasMov);
const camadaCotasMov = el('div', { id: 'cotas-mov' }); vista.appendChild(camadaCotasMov);
const CORES_EIXO = [0xc0392b, 0x2e8b3e, 0x2a62b8];
function limparCotasMov() { for (const o of [...grupoCotasMov.children]) { o.geometry.dispose(); grupoCotasMov.remove(o); } camadaCotasMov.replaceChildren(); }
function desenharCotasMov(p0, d) {
  limparCotasMov();
  const tam = camera.position.distanceTo(p0) * 0.012;
  let a = p0.clone();
  const r = renderer.domElement.getBoundingClientRect(), v = vista.getBoundingClientRect();
  [0, 1, 2].forEach(i => {
    const comp = d.getComponent(i);
    if (Math.abs(comp) < 0.005) return;
    const b = a.clone(); b.setComponent(i, b.getComponent(i) + comp);
    // traço perpendicular nas pontas (perpendicular ao eixo e o mais visível possível)
    const perp = i === 2 ? new V3(1, -1, 0).normalize() : new V3(0, 0, 1);
    const pts = [a, b, a.clone().addScaledVector(perp, -tam), a.clone().addScaledVector(perp, tam), b.clone().addScaledVector(perp, -tam), b.clone().addScaledVector(perp, tam)];
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: CORES_EIXO[i], depthTest: false }));
    l.renderOrder = 50; grupoCotasMov.add(l);
    const meio = a.clone().add(b).multiplyScalar(0.5).project(camera);
    const rot = el('span', { class: 'cota-mov eixo' + 'xyz'[i] }, `${'XYZ'[i]} ${comp > 0 ? '+' : ''}${fmt(comp)} mm`);
    rot.style.left = ((meio.x + 1) / 2 * r.width + r.left - v.left) + 'px';
    rot.style.top = ((1 - meio.y) / 2 * r.height + r.top - v.top) + 'px';
    camadaCotasMov.append(rot);
    a = b;
  });
  // marca a posição de partida
  const g = new THREE.BufferGeometry().setFromPoints([p0.clone().add(new V3(-tam, 0, 0)), p0.clone().add(new V3(tam, 0, 0)), p0.clone().add(new V3(0, -tam, 0)), p0.clone().add(new V3(0, tam, 0))]);
  const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1e2a30, depthTest: false })); m.renderOrder = 50; grupoCotasMov.add(m);
}
function mostrarCotaMov(txt) {
  const p = new THREE.Box3();
  for (const id of E.sel) { const m = malhas.get(id); if (m) { m.updateMatrixWorld(true); p.expandByObject(m, true); } }
  if (p.isEmpty()) return;
  const topo = p.getCenter(new V3()); topo.z = p.max.z;
  const q = topo.project(camera), r = renderer.domElement.getBoundingClientRect(), v = vista.getBoundingClientRect();
  cotaMov.textContent = txt; cotaMov.hidden = false;
  cotaMov.style.left = ((q.x + 1) / 2 * r.width + r.left - v.left) + 'px';
  cotaMov.style.top = ((1 - q.y) / 2 * r.height + r.top - v.top - 34) + 'px';
}
gizmo.addEventListener('mouseDown', () => {
  if (ME) return vertDown();
  arraste = {
    antes: hist.instantaneo(E.doc), girar: E.modoGizmo === 'girar',
    inicio: new Map(E.sel.map(id => [id, malhas.get(id).position.clone()])),
    matrizes: new Map(E.sel.map(id => { const m = malhas.get(id); m.updateMatrix(); return [id, m.matrix.clone()]; })),
    q0: gizmo.object.quaternion.clone(), pivo: gizmo.object.position.clone(),
  };
  if (arraste.girar && gizmo.axis === 'XYZE') {
    arraste.livre = Number($('#passo-giro').value) || 0;
    if (arraste.livre) gizmo.setRotationSnap(null);
  }
  const no = noPorId(E.sel[0]);
  if (arraste.girar && E.sel.length === 1 && juncaoAtiva(no)) arraste.juncao = { no, giro0: no.juncao.giro, N: baseJuncao(no).N };
});
gizmo.addEventListener('objectChange', () => {
  afetadasAoVivo();
  if (ME) return vertChange();
  if (!arraste) return;
  const prim = gizmo.object, idp = prim.userData.id;
  if (arraste.girar) {
    const dq = prim.quaternion.clone().multiply(arraste.q0.clone().invert());
    if (arraste.juncao) {
      // peça presa: o giro vira "Giro na face" em torno da normal do contato
      const { no, giro0, N } = arraste.juncao;
      const ang = 2 * Math.atan2(new V3(dq.x, dq.y, dq.z).dot(N), dq.w) * GRAU;
      no.juncao.giro = arred(normAng(giro0 + ang), 4);
      definirMatriz(no, matrizJuncao(no)); aplicarTransformacao(malhas.get(no.id), no.transformacao);
      mostrarCotaMov(tt`Giro ${fmt(ang, 1)}°`);
    } else {
      const c = arraste.pivo;
      if (arraste.livre) {
        const e = new THREE.Euler().setFromQuaternion(dq, 'XYZ'), st = arraste.livre * RAD;
        dq.setFromEuler(new THREE.Euler(Math.round(e.x / st) * st, Math.round(e.y / st) * st, Math.round(e.z / st) * st, 'XYZ'));
      }
      const G = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(dq)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
      for (const [id, M0] of arraste.matrizes) { const m = malhas.get(id); G.clone().multiply(M0).decompose(m.position, m.quaternion, m.scale); }
      // anel de um eixo: mostra só aquele eixo; giro livre (esfera/anel de tela): mostra X, Y e Z
      const ex = new THREE.Euler().setFromQuaternion(dq, 'XYZ'), a = [ex.x, ex.y, ex.z].map(v => v * GRAU);
      const ax = gizmo.axis;
      if (ax === 'X' || ax === 'Y' || ax === 'Z') {
        const i = 'XYZ'.indexOf(ax), g = 2 * Math.atan2(new V3(dq.x, dq.y, dq.z).dot(new V3(0, 0, 0).setComponent(i, 1).applyQuaternion(arraste.q0)), dq.w) * GRAU;
        mostrarCotaMov(`${ax} ${g >= 0 ? '+' : ''}${fmt(normAng(g), 1)}°`);
      } else mostrarCotaMov(a.map((v, i) => `${'XYZ'[i]} ${v >= 0 ? '+' : ''}${fmt(v, 1)}°`).join('   '));
    }
  } else {
    const d = prim.position.clone().sub(arraste.inicio.get(idp));
    for (const [id, p0] of arraste.inicio) if (id !== idp) malhas.get(id).position.copy(p0).add(d);
    if (!arraste.p0) { const b = new THREE.Box3().setFromObject(prim, true), c = b.getCenter(new V3()); arraste.p0 = new V3(c.x, c.y, b.min.z).sub(d); }
    desenharCotasMov(arraste.p0, d);
  }
  arraste.mudou = true;
  // prévia: as peças presas por junção acompanham já durante o arraste
  if (E.doc.objetos.some(juncaoAtiva)) {
    if (!arraste.juncao) for (const id of arraste.inicio.keys()) { const m = malhas.get(id); m.updateMatrix(); definirMatriz(noPorId(id), m.matrix); }
    previaJuncoes(new Set(arraste.inicio.keys()));
  }
  atualizarMarcador();
});
gizmo.addEventListener('mouseUp', () => {
  if (ME) return vertUp();
  cotaMov.hidden = true; limparCotasMov();
  if (!arraste) return;
  if (arraste.livre) aplicarPassoGiro(); // devolve o encaixe normal dos anéis
  let mudou = false;
  for (const id of arraste.juncao ? [] : arraste.inicio.keys()) {
    const no = noPorId(id), m = malhas.get(id);
    if (arraste.girar) {
      m.updateMatrix();
      if (!m.matrix.equals(arraste.matrizes.get(id))) { definirMatriz(no, m.matrix); mudou = true; }
    } else {
      const p = m.position.toArray().map(v => arred(v));
      if (p.some((v, i) => v !== no.transformacao.posicao[i])) { no.transformacao.posicao = p; mudou = true; }
    }
  }
  if (mudou || arraste.mudou) {
    if (arraste.girar && E.pivoFixo) E.pivoFixo.ass = assinaturaSel();
    hist.registrarTexto(arraste.antes);
    posicionarJuncoes(); reconstruir3d();
    marcarSujo(); montarPainel();
    mensagem(arraste.juncao ? tt`Giro na face: ${fmt(noPorId(E.sel[0]).juncao.giro, 1)}°. A junção continua.` : arraste.girar ? tr('Girado. Clique de novo na peça para voltar a mover.') : tr('Movido.'));
  }
  arraste = null;
});
function aplicarPassoGiro() { const v = Number($('#passo-giro').value); gizmo.setRotationSnap(v ? v * RAD : null); localStorage.setItem('passoGiro', v); }
$('#passo-giro').value = localStorage.getItem('passoGiro') ?? '15';
$('#passo-giro').addEventListener('change', aplicarPassoGiro); aplicarPassoGiro();
function aplicarPassoMov() { const v = Number($('#passo-mov').value); gizmo.setTranslationSnap(v || null); localStorage.setItem('passoMov', v); }
$('#passo-mov').value = localStorage.getItem('passoMov') ?? '1';
$('#passo-mov').addEventListener('change', aplicarPassoMov); aplicarPassoMov();
$('#resolucao').value = localStorage.getItem('resolucao') ?? '0.5';
$('#resolucao').addEventListener('change', () => {
  localStorage.setItem('resolucao', $('#resolucao').value);
  motor.definirResolucao(Number($('#resolucao').value)); reconstruir3d();
});
motor.definirResolucao(Number($('#resolucao').value));

// ---------- operações ----------
function adicionarForma(g, pos = null) {
  novaPecaPreparar();
  const cor = CORES[E.corIdx++ % CORES.length];
  const no = novaForma(g, parametrosPadrao(g), g.cor || cor);
  no.nome = nomeG(g);
  no.transformacao.posicao = pos ?? posicaoNova();
  alterar(() => { E.doc.objetos.push(no); E.sel = [no.id]; });
  mensagem(tt`Nova peça: ${nomeG(g)}.`);
}

function girar(eixo, angulo) {
  const sel = selecionados(); if (!sel.length || !angulo) return;
  const p = pontoPivo();
  const R = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(...{ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[eixo]), angulo * RAD);
  const T = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(R).multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
  alterar(() => { for (const no of sel) definirMatriz(no, T.clone().multiply(matrizDoNo(no))); if (E.pivoFixo) E.pivoFixo.ass = assinaturaSel(); });
  mensagem(tt`Girado ${fmt(angulo, 1)}° em ${eixo.toUpperCase()} em torno de (${p.toArray().map(v => fmt(v)).join('; ')}).`);
}

function espelhar(eixo) {
  const sel = selecionados(); if (!sel.length) return;
  const c = caixaSelecao().getCenter(new THREE.Vector3());
  const s = { x: [-1, 1, 1], y: [1, -1, 1], z: [1, 1, -1] }[eixo];
  const M = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(new THREE.Matrix4().makeScale(...s)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
  alterar(() => { for (const no of sel) definirMatriz(no, M.clone().multiply(matrizDoNo(no))); });
}

function pousar() {
  const sel = selecionados(); if (!sel.length) return;
  alterar(() => {
    for (const no of sel) {
      const m = malhas.get(no.id); m.updateMatrixWorld(true);
      const b = new THREE.Box3().expandByObject(m, true);
      no.transformacao.posicao[2] = arred(no.transformacao.posicao[2] - b.min.z);
    }
  });
}

function agrupar() {
  const sel = selecionados();
  if (sel.length < 2) return mensagem(tr('Selecione dois ou mais objetos para agrupar (Shift+clique).'));
  const b = caixaSelecao(), c = b.getCenter(new THREE.Vector3());
  const G = new THREE.Matrix4().makeTranslation(c.x, c.y, b.min.z), Gi = G.clone().invert();
  alterar(() => {
    const idx = Math.min(...sel.map(n => E.doc.objetos.indexOf(n)));
    const filhos = E.doc.objetos.filter(o => E.sel.includes(o.id));
    for (const f of filhos) definirMatriz(f, Gi.clone().multiply(matrizDoNo(f)));
    const g = novoGrupo(filhos, { posicao: [arred(c.x), arred(c.y), arred(b.min.z)], rotacao: [0, 0, 0], escala: [1, 1, 1] });
    E.doc.objetos = E.doc.objetos.filter(o => !E.sel.includes(o.id));
    E.doc.objetos.splice(idx, 0, g);
    E.sel = [g.id];
  });
}

function desagrupar() {
  const grupos = selecionados().filter(n => n.tipo === 'grupo');
  if (!grupos.length) return mensagem(tr('Selecione um grupo para desagrupar.'));
  alterar(() => {
    const novos = [];
    for (const g of grupos) {
      const G = matrizDoNo(g), idx = E.doc.objetos.indexOf(g);
      for (const f of g.filhos) definirMatriz(f, G.clone().multiply(matrizDoNo(f)));
      E.doc.objetos.splice(idx, 1, ...g.filhos);
      novos.push(...g.filhos.map(f => f.id));
    }
    E.sel = novos;
  });
}

function duplicar() {
  novaPecaPreparar();
  const sel = selecionados(); if (!sel.length) return;
  alterar(() => {
    const copias = sel.map(clonarComNovosIds);
    E.doc.objetos.push(...copias); E.sel = copias.map(c => c.id);
  });
  mensagem(tr('Duplicado no mesmo lugar. Arraste para mover.'));
}
function excluir() {
  if (!E.sel.length) return;
  alterar(() => { E.doc.objetos = E.doc.objetos.filter(o => !E.sel.includes(o.id)); E.sel = []; });
}
function alternarFuro() {
  const sel = selecionados(); if (!sel.length) return;
  const virarFuro = !sel.every(n => n.furo);
  alterar(() => sel.forEach(n => (n.furo = virarFuro)));
}

async function recortar() { if (!E.sel.length) return; await copiar(); excluir(); mensagem(tr('Recortado. Use Ctrl+V para colar.')); }
async function copiar() {
  const sel = selecionados(); if (!sel.length) return;
  await navigator.clipboard.writeText(JSON.stringify({ anvil3dCopia: 1, objetos: sel }));
  mensagem(tt`${sel.length} objeto(s) copiado(s).`);
}
async function colar() {
  novaPecaPreparar();
  let dados;
  try { dados = JSON.parse(await navigator.clipboard.readText()); } catch { return; }
  if (!dados?.anvil3dCopia && !dados?.forja3dCopia) return;
  const novos = carregarDocumento(JSON.stringify({ formato: 'anvil3d', versao: VERSAO_DOC, objetos: dados.objetos })).objetos.map(clonarComNovosIds);
  alterar(() => { E.doc.objetos.push(...novos); E.sel = novos.map(n => n.id); });
}

function moverTeclado(dx, dy, dz) {
  const sel = selecionados(); if (!sel.length) return;
  const passo = Number($('#passo-mov').value) || 0.1;
  alterar(() => sel.forEach(n => {
    const p = n.transformacao.posicao;
    n.transformacao.posicao = [arred(p[0] + dx * passo), arred(p[1] + dy * passo), arred(p[2] + dz * passo)];
  }));
}

// ---------- arquivos ----------
// Antes de trocar de projeto (Novo, Abrir…): a mesma pergunta do fechar a janela — Salvar, Não salvar
// ou Cancelar. Antes aqui era só "Descartar? OK/Cancelar", sem a opção de salvar.
async function confirmarDescarte() {
  if (!E.sujo) return true;
  const r = await anvil.perguntarSalvar();
  if (r === 2) return false;            // Cancelar
  if (r === 0) { await salvar(); return !E.sujo; } // Salvar: só segue se salvou mesmo
  return true;                          // Não salvar
}
function carregarProjeto(doc, caminho) {
  E.doc = doc; E.caminho = caminho; E.sel = []; hist.limpar();
  marcarSujo(false); reconstruir3d(); montarPainel(); enquadrar('iso');
}
async function novo() { if (await confirmarDescarte()) carregarProjeto(novoDocumento(), null); }
async function abrirArquivo(r) {
  try { carregarProjeto(carregarDocumento(r.texto), r.caminho); mensagem(tt`Aberto: ${r.caminho}`); }
  catch (e) { mensagem(e.message, true); alert(e.message); }
}
// ---------- prévia de projetos: miniatura gravada ao salvar e janela "Abrir" com prévia ----------
function renderizarMiniatura(objetos, tam = 256) {
  // objetos: [{ geo, matriz, cor, colorido }]
  if (!objetos.length) return null;
  rendMini ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  rendMini.setPixelRatio(1); rendMini.setSize(tam, tam); rendMini.setClearColor(0, 0);
  const cena2 = new THREE.Scene();
  cena2.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.7));
  const l = new THREE.DirectionalLight(0xffffff, 1.6); l.position.set(60, -100, 160); cena2.add(l);
  const caixa = new THREE.Box3();
  for (const o of objetos) {
    const m = new THREE.Mesh(o.geo, new THREE.MeshStandardMaterial({ color: o.colorido ? 0xffffff : o.cor, vertexColors: !!o.colorido, roughness: 0.6 }));
    m.matrixAutoUpdate = false; m.matrix.copy(o.matriz); m.updateMatrixWorld(true);
    cena2.add(m); caixa.expandByObject(m);
  }
  const esfera = caixa.getBoundingSphere(new THREE.Sphere()), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100000);
  cam.up.set(0, 0, 1);
  cam.position.copy(esfera.center).add(new V3(0.35, -1, 0.8).normalize().multiplyScalar(esfera.radius / Math.sin(15 * RAD) * 1.02));
  cam.lookAt(esfera.center);
  rendMini.render(cena2, cam);
  const url = rendMini.domElement.toDataURL('image/png');
  rendMini.setSize(128, 128);
  for (const o of cena2.children) o.material?.dispose();
  return url;
}
function miniaturaDoProjeto() {
  try {
    return renderizarMiniatura(E.doc.objetos.filter(n => !n.furo && malhas.has(n.id) && !malhas.get(n.id).userData.erro).map(n => {
      const m = malhas.get(n.id); m.updateMatrix();
      return { geo: m.geometry, matriz: m.matrix, cor: n.cor, colorido: !!m.userData.multicor };
    }));
  } catch { return null; }
}
// projeto antigo sem miniatura: monta a prévia avaliando as peças
function miniaturaDeDocumento(doc) {
  const objs = [], descartar = [];
  for (const n of doc.objetos) {
    if (n.furo) continue;
    try {
      let d;
      if (n.tipo === 'malha') { const m = lerMalha(n); d = { posicoes: m.v, indices: m.t }; } else d = dadosMalha(motor.local(n));
      let g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(d.posicoes), 3));
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(d.indices), 1));
      g = g.toNonIndexed(); g.computeVertexNormals(); descartar.push(g);
      objs.push({ geo: g, matriz: matrizDoNo(n), cor: n.cor });
    } catch {}
  }
  const url = renderizarMiniatura(objs);
  descartar.forEach(g => g.dispose());
  return url;
}
const serializarComMiniatura = () => { const mini = miniaturaDoProjeto(); const { miniatura, descricao, ...resto } = E.doc; return serializar({ ...(mini ? { miniatura: mini } : {}), ...(descricao ? { descricao } : {}), ...resto }); };

// ---------- navegador de pastas (usado pelas janelas Abrir e Salvar) ----------
async function montarNavegador({ aoClicarProjeto, aoDuploProjeto }) {
  const { locais, unidades, recentes } = await anvil.locaisPastas();
  const NOMES_LOCAIS = { anvil: tr('Projetos do Anvil3D'), documentos: tr('Documentos'), area: tr('Área de trabalho'), inicio: tr('Pasta pessoal') };
  const caminhoEl = el('div', { class: 'abrir-caminho' }), conteudo = el('div', { class: 'abrir-conteudo' });
  const nav = { dir: null, sep: '\\', elemento: null, irPara: null };
  const linhaProjeto = p => {
    const l = el('button', { class: 'abrir-arquivo', title: p.caminho, ondblclick: () => aoDuploProjeto(p) },
      el('span', { class: 'abrir-mini-p' }, p.miniatura ? el('img', { src: p.miniatura, alt: '' }) : '◆'),
      el('span', { class: 'abrir-nome-p' }, p.nome));
    l.addEventListener('click', () => { for (const c of document.querySelectorAll('.abrir-arquivo')) c.classList.toggle('ativo', c === l); aoClicarProjeto(p, l); });
    return l;
  };
  async function irPara(dir) {
    const r = await anvil.listarPasta(dir);
    nav.dir = r.dir; nav.sep = r.sep;
    const partes = r.dir.split(/[\\/]+/).filter(Boolean), sep = r.sep;
    caminhoEl.replaceChildren(...partes.flatMap((nome, i) => {
      const alvo = (r.dir.startsWith('/') ? '/' : '') + partes.slice(0, i + 1).join(sep) + (i === 0 && sep === '\\' ? '\\' : '');
      return [el('button', { class: 'abrir-trilha', onclick: () => irPara(alvo) }, nome), i < partes.length - 1 ? el('span', { class: 'abrir-sep' }, '›') : null];
    }).filter(Boolean));
    conteudo.replaceChildren(...[
      r.pai ? el('button', { class: 'abrir-pasta', onclick: () => irPara(r.pai) }, el('span', { class: 'abrir-ico' }, '↰'), tr('Pasta acima')) : null,
      ...r.pastas.map(nome => el('button', { class: 'abrir-pasta', onclick: () => irPara(r.dir + (r.dir.endsWith(sep) ? '' : sep) + nome) }, el('span', { class: 'abrir-ico' }, '📁'), nome)),
      ...r.projetos.map(linhaProjeto),
      !r.pastas.length && !r.projetos.length ? el('p', { class: 'dica' }, r.erro ? r.erro : tr('Nenhum projeto nem pasta aqui.')) : null].filter(Boolean));
    for (const b of document.querySelectorAll('.abrir-local')) b.classList.toggle('ativo', b.dataset.caminho === r.dir);
    return r;
  }
  const lateral = el('div', { class: 'abrir-lugares' }, ...[
    el('h3', {}, tr('Locais')),
    ...locais.map(l => el('button', { class: 'abrir-local', 'data-caminho': l.caminho, onclick: () => irPara(l.caminho) }, NOMES_LOCAIS[l.id] ?? l.caminho)),
    unidades.length ? el('h3', {}, tr('Unidades')) : null,
    ...unidades.map(u => el('button', { class: 'abrir-local', 'data-caminho': u, onclick: () => irPara(u) }, u)),
    recentes.length ? el('h3', {}, tr('Recentes')) : null,
    ...recentes.map(p => { const b = linhaProjeto(p); b.classList.add('recente'); return b; })].filter(Boolean));
  nav.elemento = el('div', { class: 'abrir-nav' }, lateral, el('div', { class: 'abrir-pastas' }, caminhoEl, conteudo));
  nav.irPara = irPara;
  nav.inicial = locais.find(l => l.id === 'anvil')?.caminho ?? locais[0]?.caminho;
  nav.recentes = recentes;
  return nav;
}

async function janelaAbrir() {
  if (!(await confirmarDescarte())) return;
  let escolhido = null;
  const grande = el('div', { class: 'abrir-previa-img' }, el('span', {}, tr('Escolha um projeto à esquerda')));
  const info = el('div', { class: 'abrir-info' }), descr = el('div', { class: 'abrir-descricao' });
  const botaoAbrir = el('button', { class: 'primario', disabled: true, onclick: () => abrirEscolhido() }, tr('Abrir'));
  const abrirEscolhido = async () => { if (!escolhido) return; fecharModal(); abrirArquivo(await anvil.ler(escolhido.caminho, true)); };
  async function escolher(p, linha) {
    escolhido = p; botaoAbrir.disabled = false;
    grande.replaceChildren(p.miniatura ? el('img', { src: p.miniatura, alt: '' }) : el('span', { class: 'abrir-carregando' }, tr('Gerando prévia…')));
    info.replaceChildren(el('b', {}, p.nome), el('div', {}, new Date(p.data).toLocaleString(idiomaAtual() === 'en' ? 'en-US' : 'pt-BR')));
    descr.replaceChildren(p.descricao ? el('p', {}, p.descricao) : el('p', { class: 'dica' }, tr('Sem descrição (Arquivo › Propriedades do projeto).')));
    try {
      const doc = carregarDocumento((await anvil.ler(p.caminho)).texto);
      if (escolhido !== p) return;
      info.append(el('div', {}, tt`${doc.objetos.length} objeto(s) no primeiro nível`));
      if (!p.miniatura) {
        await new Promise(r => setTimeout(r, 10));
        p.miniatura = miniaturaDeDocumento(doc);
        if (escolhido === p) grande.replaceChildren(p.miniatura ? el('img', { src: p.miniatura, alt: '' }) : el('span', {}, tr('Sem prévia')));
        const mini = linha?.querySelector('.abrir-mini-p'); if (mini && p.miniatura) mini.replaceChildren(el('img', { src: p.miniatura, alt: '' }));
      }
    } catch (e) { descr.append(el('div', { class: 'caixa-erro' }, e.message)); }
  }
  const nav = await montarNavegador({ aoClicarProjeto: escolher, aoDuploProjeto: p => { escolhido = p; abrirEscolhido(); } });
  abrirModal(tr('Abrir projeto'), el('div', { class: 'abrir' }, nav.elemento,
    el('div', { class: 'abrir-lado' }, grande, info, descr,
      el('div', { class: 'botoes' }, el('button', { onclick: () => fecharModal() }, tr('Cancelar')), botaoAbrir),
      el('button', { class: 'pequeno abrir-procurar', onclick: async () => { fecharModal(); const r = await anvil.abrir(); if (r) abrirArquivo(r); } }, tr('Usar a janela do Windows…')))));
  await nav.irPara(nav.inicial);
  const r0 = document.querySelector('.abrir-arquivo.recente') ?? document.querySelector('.abrir-conteudo .abrir-arquivo');
  if (r0) r0.click();
}

// Salvar / Salvar como no mesmo modelo: pasta à esquerda, prévia do projeto atual, nome e descrição à direita
async function janelaSalvar() {
  return new Promise(async resolve => {
    let feito = false;
    const fim = v => { if (feito) return; feito = true; resolve(v); };
    const nome = el('input', { value: nomeBase(), spellcheck: 'false' });
    const ta = el('textarea', { rows: '5', maxlength: '500', placeholder: tr('Para que serve, medidas principais, material, observações…') });
    ta.value = E.doc.descricao ?? '';
    const mini = miniaturaDoProjeto();
    const nav = await montarNavegador({
      aoClicarProjeto: p => { nome.value = p.nome; },            // clicar num projeto existente usa o nome dele (para substituir)
      aoDuploProjeto: p => { nome.value = p.nome; salvarAqui(); },
    });
    async function salvarAqui() {
      let n = nome.value.trim().replace(/\.(nvl3d|anvil)$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
      if (!n) return nome.focus();
      const caminho = nav.dir + (nav.dir.endsWith(nav.sep) ? '' : nav.sep) + n + '.nvl3d';
      if (caminho.toLowerCase() !== (E.caminho ?? '').toLowerCase() && await anvil.existe(caminho) && !confirm(tt`Já existe "${n}.anvil" nesta pasta. Substituir?`)) return;
      const d = ta.value.trim();
      if (d) E.doc.descricao = d; else delete E.doc.descricao;
      try {
        await anvil.salvar(caminho, serializarComMiniatura());
        E.caminho = caminho; marcarSujo(false); mensagem(tt`Salvo: ${caminho}`);
        fecharModal(); fim(true);
      } catch (e) { mensagem(tr('Não foi possível salvar: ') + e.message, true); }
    }
    nome.addEventListener('keydown', e => { if (e.key === 'Enter') salvarAqui(); });
    abrirModal(E.caminho ? tr('Salvar como') : tr('Salvar projeto'), el('div', { class: 'abrir' }, nav.elemento,
      el('div', { class: 'abrir-lado' },
        el('div', { class: 'abrir-previa-img' }, mini ? el('img', { src: mini, alt: '' }) : el('span', {}, tr('Sem prévia'))),
        campo(tr('Nome do arquivo'), nome, true),
        campo(tr('Descrição'), ta, true),
        el('div', { class: 'botoes' }, el('button', { onclick: () => { fecharModal(); fim(false); } }, tr('Cancelar')), el('button', { class: 'primario', onclick: salvarAqui }, tr('Salvar'))))));
    // pasta inicial: a do projeto atual, senão a de projetos do Anvil3D
    const pastaAtual = E.caminho ? E.caminho.replace(/[\\/][^\\/]*$/, '') : null;
    await nav.irPara(pastaAtual || nav.inicial);
    setTimeout(() => { nome.focus(); nome.select(); }, 0);
    modal.addEventListener('click', function f() { if (modal.hidden) { modal.removeEventListener('click', f); fim(false); } });
  });
}

// Propriedades do projeto: descrição curta (aparece na prévia do Abrir)
function propriedadesProjeto() {
  const ta = el('textarea', { rows: '5', maxlength: '500', placeholder: tr('Para que serve, medidas principais, material, observações…') });
  ta.value = E.doc.descricao ?? '';
  abrirModal(tr('Propriedades do projeto'), el('div', { class: 'sobre' },
    el('p', { class: 'dica' }, E.caminho ?? tr('Projeto ainda não salvo')),
    campo(tr('Descrição'), ta, true),
    el('div', { class: 'botoes' },
      el('button', { onclick: () => fecharModal() }, tr('Cancelar')),
      el('button', { class: 'primario', onclick: () => {
        const novo = ta.value.trim();
        if (novo !== (E.doc.descricao ?? '')) { if (novo) E.doc.descricao = novo; else delete E.doc.descricao; marcarSujo(); mensagem(tr('Descrição do projeto atualizada (salve para gravar).')); }
        fecharModal();
      } }, tr('Aplicar')))), true);
  setTimeout(() => ta.focus(), 0);
}

async function abrir() { return janelaAbrir(); }
async function salvar() {
  if (!E.caminho) return janelaSalvar();
  if (/\.anvil$/i.test(E.caminho)) { // projeto da extensão antiga: grava ao lado, já como .nvl3d
    E.caminho = E.caminho.replace(/\.anvil$/i, '.nvl3d');
    try { await anvil.salvar(E.caminho, serializarComMiniatura()); marcarSujo(false); mensagem(tt`Projeto antigo (.anvil) salvo no formato novo: ${E.caminho}`); return true; }
    catch (e) { mensagem(tr('Não foi possível salvar: ') + e.message, true); return false; }
  }
  try { await anvil.salvar(E.caminho, serializarComMiniatura()); marcarSujo(false); mensagem(tt`Salvo: ${E.caminho}`); return true; }
  catch (e) { mensagem(tr('Não foi possível salvar: ') + e.message, true); return false; }
}
async function salvarComo() { return janelaSalvar(); }
const nomeBase = () => (E.caminho ? E.caminho.split(/[\\/]/).pop().replace(/\.(nvl3d|anvil)$/i, '') : 'projeto');
// Um STL por objeto, todos nas coordenadas da mesa (origem na quina): abrindo os arquivos juntos no
// fatiador, as peças se encaixam como no projeto (útil para multimaterial e para peças separadas).
async function exportarStlPorObjeto() {
  const alvo = (E.sel.length ? selecionados() : E.doc.objetos).filter(o => !o.furo);
  if (!alvo.length) return mensagem(tr('Nada sólido para exportar.'), true);
  const arquivos = [], usados = new Set();
  for (const o of alvo) {
    let d;
    try { const w = motor.mundo(o); d = dadosMalha(w); w.delete(); }
    catch {
      if (o.tipo !== 'malha') continue;
      const mm = lerMalha(o), M = matrizDoNo(o), p = new Float32Array(mm.v.length), v = new THREE.Vector3();
      for (let i = 0; i < p.length; i += 3) { v.set(mm.v[i], mm.v[i + 1], mm.v[i + 2]).applyMatrix4(M); p.set([v.x, v.y, v.z], i); }
      d = { posicoes: p, indices: mm.t };
    }
    let nome = `${nomeBase()} - ${o.nome}`.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_'), n = 2;
    while (usados.has(nome.toLowerCase())) nome = `${nomeBase()} - ${o.nome} (${n++})`.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    usados.add(nome.toLowerCase());
    arquivos.push({ nome: nome + '.stl', bytes: stlBinario(d, o.nome) });
  }
  const pasta = await anvil.exportarVarios(arquivos);
  if (pasta) mensagem(tt`${arquivos.length} arquivo(s) STL salvos em ${pasta}, todos com a mesma origem (quina da mesa): abra-os juntos no fatiador.`);
}

async function exportarStl() {
  const alvo = E.sel.length ? selecionados() : E.doc.objetos;
  if (!alvo.some(o => !o.furo)) return mensagem(tr('Nada sólido para exportar.'), true);
  let m;
  let dados, aviso = '';
  try { m = motor.resultadoFinal(alvo); dados = dadosMalha(m); m.delete(); }
  catch (e) {
    // malha aberta não entra em união: exporta as peças lado a lado, sem fundir
    const pos = [], idx = [];
    for (const o of alvo.filter(o => !o.furo)) {
      let d;
      if (o.tipo === 'malha') { const mm = lerMalha(o); d = { posicoes: mm.v, indices: mm.t }; }
      else { try { const w = motor.local(o); d = dadosMalha(w); } catch { continue; } }
      const M = matrizDoNo(o), base = pos.length / 3, vv = new THREE.Vector3();
      for (let i = 0; i < d.posicoes.length; i += 3) { vv.set(d.posicoes[i], d.posicoes[i + 1], d.posicoes[i + 2]).applyMatrix4(M); pos.push(vv.x, vv.y, vv.z); }
      const espelhado = M.determinant() < 0;
      for (let i = 0; i < d.indices.length; i += 3) espelhado ? idx.push(base + d.indices[i], base + d.indices[i + 2], base + d.indices[i + 1]) : idx.push(base + d.indices[i], base + d.indices[i + 1], base + d.indices[i + 2]);
    }
    dados = { posicoes: new Float32Array(pos), indices: new Uint32Array(idx) };
    aviso = tr(' Atenção: há malha aberta, as peças foram exportadas sem fundir.');
  }
  let minZ = Infinity;
  for (let i = 2; i < dados.posicoes.length; i += 3) minZ = Math.min(minZ, dados.posicoes[i]);
  if (Math.abs(minZ) > 0.01) aviso += tt` Atenção: a peça não está apoiada no plano (ponto mais baixo em Z = ${fmt(minZ)} mm).`;
  const ruins = alvo.filter(o => o.tipo === 'malha' && !diagDe(o).ok).map(o => o.nome);
  if (ruins.length) aviso += tt` Malha com problemas: ${ruins.join(', ')} (use Reparar para impressão).`;
  const bytes = stlBinario(dados, nomeBase());
  const c = await anvil.exportar(nomeBase() + '.stl', bytes, 'stl', 'STL');
  if (c) mensagem(tt`${E.sel.length ? tr('Seleção exportada') : tr('Exportado')}: ${c} (o projeto .nvl3d continua editável).${aviso}`, !!aviso);
}
anvil.aoSalvarEFechar(async () => { if (await salvar()) anvil.fecharAgora(); });

// ---------- câmera ----------
function enquadrar(vistaNome) {
  const b = new THREE.Box3();
  objetos3d.updateMatrixWorld(true);
  for (const m of malhas.values()) b.expandByObject(m, true);
  // vistas prontas mostram a mesa inteira (origem na quina de baixo à esquerda); F enquadra só as peças
  const comMesa = b.isEmpty() || (vistaNome && !localStorage.getItem('teste:origem'));
  if (comMesa) { b.expandByPoint(new THREE.Vector3(0, 0, 0)); b.expandByPoint(new THREE.Vector3(mesaX, mesaY, 20)); }
  const c = b.getCenter(new THREE.Vector3()), r = Math.max(b.getSize(new THREE.Vector3()).length() / 2, 10);
  const dist = r / Math.sin((camera.fov * RAD) / 2) * (comMesa ? 0.95 : 1.1);
  const dir = {
    iso: localStorage.getItem('teste:origem') ? [0.6, -0.75, 0.55] : [0.35, -1, 0.8], topo: [0, -0.0001, 1], frente: [0, -1, 0.0001], direita: [1, 0, 0.0001],
  }[vistaNome] ?? camera.position.clone().sub(orbita.target).normalize().toArray();
  orbita.target.copy(c);
  camera.position.copy(c).add(new THREE.Vector3(...dir).normalize().multiplyScalar(dist));
  camera.near = dist / 100; camera.far = dist * 100; camera.updateProjectionMatrix();
  orbita.update(); atualizarMarcador(); desenhar();
}

// ---------- painel de propriedades ----------
const painel = $('#propriedades');
function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f !== null && f !== undefined && f !== false) e.append(f);
  return e;
}
function inputNumero(valor, casas, aoMudar, attrs = {}) {
  const i = el('input', { value: fmt(valor, casas), spellcheck: 'false', ...attrs });
  i.addEventListener('focus', () => i.select());
  i.addEventListener('keydown', e => { if (e.key === 'Enter') i.blur(); if (e.key === 'Escape') { i.value = fmt(valor, casas); i.blur(); } });
  i.addEventListener('change', () => {
    const v = lerNumero(i.value);
    if (Number.isNaN(v)) { mensagem(tt`Valor inválido: "${i.value}"`, true); i.value = fmt(valor, casas); return; }
    aoMudar(v);
  });
  return i;
}
function campo(rotulo, controle, largo = false) { return el('label', { class: 'campo' + (largo ? ' largo' : '') }, el('span', {}, rotulo), controle); }
function linhaXYZ(valores, casas, aoMudar) {
  return el('div', { class: 'xyz' }, ...['x', 'y', 'z'].flatMap((a, i) => [
    el('b', { class: a }, a.toUpperCase()), inputNumero(valores[i], casas, v => aoMudar(i, v)),
  ]));
}

function atualizarBotoes() {
  const n = E.sel.length, total = E.doc.objetos.length, unico = n === 1 ? noPorId(E.sel[0]) : null;
  const regra = {
    alinhar: n >= 2, juntarFaces: n === 1 && total >= 2, faceNaMesa: n >= 1, espelharModo: n >= 1,
    agrupar: n >= 2, desagrupar: unico?.tipo === 'grupo', alternarFuro: n >= 1, alternarGizmo: n >= 1,
    duplicar: n >= 1, excluir: n >= 1, copiar: n >= 1, recortar: n >= 1, projetar: n === 2, aplicarFace: n === 1, consolidar: total >= 1,
  };
  for (const b of document.querySelectorAll('[data-cmd]')) { const r = regra[b.dataset.cmd]; if (r !== undefined) b.disabled = !r; }
}
function montarPainel() {
  atualizarBotoes();
  painel.replaceChildren();
  if (MA) return painelArestas();
  if (ME) return painelME();
  if (ALN) return painelAlinhar();
  if (ESP) return painelEspelhar();
  if (AF) return painelAplicarFace();
  const sel = selecionados();
  if (!sel.length) {
    painel.append(el('h2', {}, tr('Nada selecionado'), interrog('nada')),
      el('p', { class: 'vazio' }, tr('Clique numa forma da lista à esquerda para colocá-la no plano. Clique num objeto para editá-lo; Shift+clique soma à seleção.')),
      el('p', { class: 'dica' }, tr('Botão direito gira a vista, botão do meio arrasta, roda dá zoom.')));
    return;
  }
  const unico = sel.length === 1 ? sel[0] : null;

  if (unico) {
    const g = unico.tipo === 'forma' ? registro.obter(unico.gerador) : null;
    painel.append(el('h2', {}, unico.tipo === 'grupo' ? tt`Grupo (${unico.filhos.length} peças)` : unico.tipo === 'acabamento' || unico.tipo === 'malha' ? unico.nome : (g ? nomeG(g) : unico.gerador)));
    if (E.erros.has(unico.id)) painel.append(el('div', { class: 'caixa-erro' }, E.erros.get(unico.id)));
    if (E.avisos.has(unico.id)) painel.append(el('div', { class: 'caixa-aviso' }, E.avisos.get(unico.id)));
    painel.append(campo(tr('Nome'), el('input', { value: unico.nome, onchange: e => alterar(() => (unico.nome = e.target.value), { reconstruir: false }) }), true));
  } else {
    painel.append(el('h2', {}, tt`${sel.length} objetos selecionados`));
  }

  // sólido / furo / cor
  const todosFuro = sel.every(n => n.furo), todosSolido = sel.every(n => !n.furo);
  painel.append(titulo(tr('Tipo'), 'tipo'), el('div', { class: 'segmentado botoes' },
    el('button', { class: todosSolido ? 'ativo' : '', onclick: () => alterar(() => sel.forEach(n => (n.furo = false))) }, tr('Sólido')),
    el('button', { class: todosFuro ? 'ativo' : '', onclick: () => alterar(() => sel.forEach(n => (n.furo = true))) }, tr('Furo'))));
  if (!todosFuro) {
    const amostra = el('button', { class: 'amostra-cor', style: `background:${sel[0].cor}`, title: tr('Escolher a cor') });
    amostra.onclick = () => abrirSeletorCor(amostra, sel[0].cor, {
      previa: hex => { amostra.style.background = hex; previaCor(sel, hex); },
      confirmar: hex => { previaCor(sel, null); if (hex.toLowerCase() === String(sel[0].cor).toLowerCase() && sel.every(n => n.cor === sel[0].cor)) return atualizarVisual();
        alterar(() => sel.forEach(n => { n.cor = hex; if (n.tipo === 'grupo') n.multicor = false; if (n.tipo === 'acabamento' && n.filhos[0].tipo === 'grupo') n.filhos[0].multicor = false; })); },
      cancelar: () => { amostra.style.background = sel[0].cor; previaCor(sel, null); },
    });
    painel.append(campo(tr('Cor'), amostra));
  }
  if (!todosFuro) {
    const grupo = unico && (unico.tipo === 'grupo' ? unico : unico.tipo === 'acabamento' && unico.filhos[0].tipo === 'grupo' ? unico.filhos[0] : null);
    if (grupo) painel.append(campo(tr('Multicolorido'), el('input', { type: 'checkbox', checked: grupo.multicor !== false,
      onchange: e => alterar(() => (grupo.multicor = e.target.checked)) })));
    const op = sel.every(n => (n.opacidade ?? 100) === (sel[0].opacidade ?? 100)) ? (sel[0].opacidade ?? 100) : 100;
    const faixa = el('input', { type: 'range', min: '10', max: '100', step: '5', value: String(op), class: 'faixa' });
    const rot = el('span', { class: 'valor-faixa' }, op + '%');
    faixa.addEventListener('input', () => { rot.textContent = faixa.value + '%'; for (const n of sel) { const m = malhas.get(n.id); if (m) { m.material.transparent = +faixa.value < 100; m.material.opacity = faixa.value / 100; m.material.depthWrite = +faixa.value >= 100; m.material.needsUpdate = true; } } desenhar(); });
    faixa.addEventListener('change', () => alterar(() => sel.forEach(n => { if (+faixa.value >= 100) delete n.opacidade; else n.opacidade = +faixa.value; })));
    painel.append(campo(tr('Opacidade'), el('span', { class: 'linha-faixa' }, faixa, rot)));
  }

  // parâmetros do gerador
  if (unico?.tipo === 'forma') {
    const g = registro.obter(unico.gerador);
    if (g) {
      painel.append(titulo(tr('Parâmetros'), 'parametros'));
      for (const d of g.parametros) if (parametroVisivel(d, unico)) painel.append(controleParametro(unico, d));
    } else painel.append(el('p', { class: 'dica' }, tr('O plugin deste objeto não está instalado. Os dados dele continuam guardados no arquivo.')));
  }
  if (unico?.tipo === 'acabamento') {
    const f = unico.filhos[0], gf = f.tipo === 'forma' ? registro.obter(f.gerador) : null;
    painel.append(titulo(tr('Acabamento'), 'acabamento'),
      el('div', { class: 'segmentado botoes' }, ...[['fillet', tr('Fillet')], ['chanfro', tr('Chanfro')]].map(([m, r]) =>
        el('button', { class: unico.modo === m ? 'ativo' : '', onclick: () => alterar(() => { unico.modo = m; unico.nome = `${r} ${fmt(unico.medida, 2).replace(/,?0+$/, '')} mm`; }) }, r))),
      campo(unico.modo === 'chanfro' ? tr('Distância (mm)') : tr('Raio (mm)'), inputNumero(unico.medida, 2, v => {
        if (!(v > 0)) return mensagem(tr('A medida precisa ser maior que zero.'), true);
        alterar(() => { unico.medida = arred(v, 4); unico.nome = `${unico.modo === 'chanfro' ? tr('Chanfro') : tr('Fillet')} ${fmt(v, 2).replace(/,?0+$/, '')} mm`; });
      })),
      el('p', { class: 'dica' }, tt`${unico.arestas.length} aresta(s) em ${f.tipo === 'grupo' ? tr('um grupo') : f.tipo === 'acabamento' ? f.nome : (gf ? nomeG(gf) : f.gerador)}.`),
      el('div', { class: 'botoes' },
        el('button', { onclick: () => iniciarModoAresta(unico.modo) }, tr('Editar arestas')),
        el('button', { onclick: () => removerAcabamento(unico) }, tr('Remover'))));
    if (gf) {
      painel.append(titulo(tt`Parâmetros (${nomeG(gf)})`, 'parametros'));
      for (const d of gf.parametros) if (parametroVisivel(d, f)) painel.append(controleParametro(f, d));
    }
  }
  if (unico?.tipo === 'malha') {
    const d = lerMalha(unico), aberta = bordas(d).length > 0;
    painel.append(...[titulo(tr('Malha'), 'malha'),
      el('p', { class: 'dica' }, tt`${fmtInt(d.t.length / 3)} triângulos, ${fmtInt(d.v.length / 3)} vértices, ${aberta ? tr('aberta') : tr('fechada')}.`),
      el('div', { class: 'botoes' }, el('button', { class: 'primario', onclick: iniciarME }, tr('Editar triângulos e vértices'))),
      aberta ? el('div', { class: 'botoes' }, el('button', { onclick: fecharBuracosSel }, tr('Fechar buracos'))) : null,
      unico.origem ? el('div', { class: 'botoes' }, el('button', { onclick: () => voltarParametrico(unico) }, tr('Voltar ao paramétrico'))) : null,
      unico.receita ? el('div', { class: 'botoes' }, el('button', { onclick: () => voltarReceita(unico) }, tt`Voltar à receita (${unico.receita.length} ${unico.receita.length === 1 ? tr('item') : tr('itens')})`)) : null].filter(Boolean));
    painelImpressao(unico);
    painelSimplificar(unico);
  } else if (unico && !E.erros.has(unico.id)) {
    painel.append(titulo(tr('Malha'), 'malha'), el('div', { class: 'botoes' }, el('button', { onclick: () => converterEmMalha(unico) }, tr('Converter em malha editável'))));
  }
  if (unico && !E.erros.has(unico.id) && unico.tipo !== 'malha') {
    painel.append(titulo(unico.tipo === 'acabamento' ? tr('Outro acabamento por cima') : tr('Arredondar arestas'), 'arestas'),
      el('div', { class: 'botoes' },
        el('button', { onclick: () => iniciarModoAresta('fillet', { novaCamada: true }) }, tr('Fillet…')),
        el('button', { onclick: () => iniciarModoAresta('chanfro', { novaCamada: true }) }, tr('Chanfro…'))));
  }
  if (sel.length >= 2) painel.append(el('div', { class: 'botoes' }, el('button', { class: 'primario', onclick: agrupar }, tr('Agrupar')),
    el('button', { onclick: entrarAlinhar }, tr('Alinhar…')), interrog('grupo')));
  if (sel.length === 2) painel.append(el('div', { class: 'botoes' }, el('button', { onclick: () => projetarNaSuperficie(), title: tr('Aplica a primeira peça selecionada sobre a superfície da segunda, acompanhando as curvas') }, tr('Projetar na superfície'))));
  painel.append(titulo(tr('Consolidar e biblioteca'), 'consolidar'), el('div', { class: 'botoes' },
    el('button', { onclick: consolidar }, sel.length > 1 ? tr('Consolidar seleção') : tr('Consolidar')),
    unico && !E.erros.has(unico.id) ? el('button', { onclick: () => salvarNaBiblioteca(unico) }, tr('Salvar na biblioteca')) : null));
  if (unico?.tipo === 'grupo') painel.append(el('div', { class: 'botoes' }, el('button', { onclick: desagrupar }, tr('Desagrupar'))));

  const presa = juncaoAtiva(unico);
  if (unico?.juncao) {
    const j = unico.juncao, alvo = noPorId(j.alvo);
    painel.append(titulo(tr('Junção'), 'juncao'),
      presa ? el('p', { class: 'dica destaque' }, E.modoGizmo === 'girar'
        ? tr('Modo girar: arraste a peça (ou o anel) para girá-la na face. Clique de novo na peça (ou R) para voltar a deslizar.')
        : tr('Modo mover: arraste a peça para deslizá-la sobre a outra. Clique de novo na peça (ou R) para girar na face.')) : null,
      el('p', { class: 'dica' }, presa ? tt`Presa na face de "${alvo.nome}". Arraste a peça com o mouse para deslizar sobre ela; se "${alvo.nome}" se mover, esta peça acompanha.`
        : tr('A peça de apoio não está solta no projeto (foi agrupada ou excluída). A junção volta a valer se ela voltar.')));
    if (presa) painel.append(
      campo(tr('Giro na face (°)'), inputNumero(j.giro, 1, v => alterar(() => (j.giro = arred(normAng(v), 4))))),
      el('div', { class: 'botoes' }, ...[-90, -15, 15, 90].map(d => el('button', { class: 'pequeno', onclick: () => alterar(() => (j.giro = arred(normAng(j.giro + d), 4))) }, (d > 0 ? '+' : '') + d + '°'))),
      campo(tr('Afastamento (mm)'), inputNumero(j.afastamento ?? 0, 2, v => alterar(() => (j.afastamento = arred(v))))));
    painel.append(el('div', { class: 'botoes' },
      presa ? el('button', { onclick: () => iniciarAlinhar(unico) }, tr('Alinhar arestas')) : null,
      el('button', { onclick: () => alterar(() => delete unico.juncao) }, tr('Soltar junção'))));
  }

  // posição, tamanho, rotação
  if (unico) {
    const t = unico.transformacao, m = malhas.get(unico.id);
    if (!presa) painel.append(titulo(tr('Posição da origem (mm)'), 'posicao'),
      linhaXYZ(t.posicao, 2, (i, v) => alterar(() => (unico.transformacao.posicao[i] = arred(v)))));
    if (m?.geometry?.boundingBox) {
      const base = m.geometry.boundingBox.getSize(new THREE.Vector3()).toArray();
      painel.append(titulo(tr('Tamanho (mm, eixos do objeto)'), 'tamanho'),
        linhaXYZ(base.map((b, i) => b * Math.abs(t.escala[i])), 2, (i, v) => {
          if (v <= 0 || base[i] === 0) return mensagem(tr('O tamanho precisa ser maior que zero.'), true);
          alterar(() => (unico.transformacao.escala[i] = arred(Math.sign(t.escala[i]) * v / base[i], 6)));
        }),
        el('div', { class: 'botoes' },
          el('button', { class: 'pequeno', onclick: () => alterar(() => (unico.transformacao.escala = [1, 1, 1])) }, tr('Escala 100%')),
          el('button', { class: 'pequeno', onclick: pousar }, tr('Pousar no plano'))));
    }
    if (presa) {
      painel.append(el('p', { class: 'dica' }, tr('Ao mudar o tamanho, a face presa continua encostada e a peça cresce para longe dela.')));
      return;
    }
    painel.append(titulo(tr('Rotação absoluta (°, em torno da origem)'), 'rotacao'),
      linhaXYZ(t.rotacao, 1, (i, v) => alterar(() => (unico.transformacao.rotacao[i] = arred(normAng(v))))));
  } else {
    const ids = idsEscalaveis();
    if (ids.length) {
      const b = new THREE.Box3(); for (const id of ids) b.union(caixaDe(id));
      const tam = b.getSize(new V3()).toArray();
      painel.append(titulo(tr('Posição da seleção (mm, canto mínimo)'), 'posicao'),
        linhaXYZ(b.min.toArray(), 2, (i, v) => {
          const d = v - b.min.getComponent(i);
          alterar(() => { for (const id of ids) { const t = noPorId(id).transformacao; t.posicao[i] = arred(t.posicao[i] + d); } });
        }),
        titulo(tr('Tamanho da seleção (mm)'), 'tamanho'),
        linhaXYZ(tam, 2, (i, v) => {
          if (v <= 0 || tam[i] === 0) return mensagem(tr('O tamanho precisa ser maior que zero.'), true);
          escalarSelecaoPara(E.propSelecao ? { 0: tam[0] * v / tam[i], 1: tam[1] * v / tam[i], 2: tam[2] * v / tam[i] } : { [i]: v });
        }),
        campo(tr('Manter proporção'), el('input', { type: 'checkbox', checked: !!E.propSelecao, onchange: e => { E.propSelecao = e.target.checked; } })),
        campo(tr('Escala da seleção (%)'), inputNumero(100, 1, v => { if (v > 0 && Math.abs(v - 100) > 1e-6) escalarSelecaoPara({ 0: tam[0] * v / 100, 1: tam[1] * v / 100, 2: tam[2] * v / 100 }); })),
        el('div', { class: 'botoes' }, el('button', { class: 'pequeno', onclick: pousar }, tr('Pousar no plano'))));
    } else painel.append(el('div', { class: 'botoes' }, el('button', { class: 'pequeno', onclick: pousar }, tr('Pousar no plano'))));
  }

  // girar em torno de um pivô
  painel.append(titulo(tr('Girar em torno de um ponto'), 'pivo'));
  pivoDaSelecao();
  const sPivo = el('select', { onchange: e => {
    E.pivo = e.target.value; E.pivoDono = E.sel.join();
    // "Ponto escolhido" numa peça nova começa no centro DELA (antes herdava o ponto da peça anterior
    // e os anéis pulavam para lá, parecendo que a outra peça tinha sido selecionada)
    if (E.pivo === 'ponto' && E.pontoPivoDono !== E.sel.join()) {
      E.pontoPivo = caixaSelecao().getCenter(new V3()).toArray().map(v => arred(v, 2)); E.pontoPivoDono = E.sel.join();
    }
    if (E.escolhendoPonto && E.pivo !== 'ponto') cancelarEscolha(); // trocou de pivô no meio da escolha: encerra o aviso
    atualizarVisual(); montarPainel(); // reposiciona os anéis do giro na hora (antes ficava o desenho antigo)
  } },
    ...[['centro', tr('Centro da caixa')], ['base', tr('Centro da base')], ['canto', tr('Canto mínimo')], ['origem', tr('Origem do objeto')], ['ponto', tr('Ponto escolhido')]]
      .map(([v, r]) => el('option', { value: v, selected: E.pivo === v }, r)));
  painel.append(campo(tr('Pivô'), sPivo));
  if (E.pivo === 'ponto') {
    painel.append(linhaXYZ(E.pontoPivo, 2, (i, v) => { E.pontoPivo[i] = arred(v, 4); E.pontoPivoDono = E.sel.join(); atualizarVisual(); }),
      el('div', { class: 'botoes' }, el('button', { class: 'pequeno', onclick: iniciarEscolha }, tr('Escolher no modelo'))));
  }
  painel.append(el('div', { class: 'segmentado botoes' }, ...['x', 'y', 'z'].map(a =>
    el('button', { class: E.eixoGiro === a ? 'ativo' : '', onclick: () => { E.eixoGiro = a; montarPainel(); } }, tt`Eixo ${a.toUpperCase()}`))));
  painel.append(campo(tr('Ângulo (°)'), inputNumero(E.anguloGiro, 1, v => { E.anguloGiro = arred(v, 1); localStorage.setItem('anguloGiro', E.anguloGiro); })));
  painel.append(el('div', { class: 'botoes' },
    el('button', { onclick: () => girar(E.eixoGiro, -E.anguloGiro), title: tr('Sentido horário olhando de frente para o eixo') }, tr('↻ Girar −')),
    el('button', { class: 'primario', onclick: () => girar(E.eixoGiro, E.anguloGiro), title: tr('Sentido anti-horário (regra da mão direita)') }, tr('↺ Girar +'))));

  painel.append(titulo(tr('Espelhar'), 'espelhar'), el('div', { class: 'botoes' },
    ...['x', 'y', 'z'].map(a => el('button', { onclick: () => espelhar(a) }, tt`Espelhar ${a.toUpperCase()}`))));
}

// parâmetro com "mostrarSe": { chave: valor | [valores] } só aparece quando o outro parâmetro tem esse valor
// (ex.: no parafuso, "Medida (métrica)" só com rosca métrica). O valor continua guardado.
function parametroVisivel(d, no) {
  if (!d.mostrarSe) return true;
  return Object.entries(d.mostrarSe).every(([k, v]) => { const atual = no.parametros?.[k]; return Array.isArray(v) ? v.includes(atual) : atual === v; });
}
// ---------- seletor de cor próprio, com prévia ao vivo ----------
// Clicar/arrastar já pinta a peça na vista; clicar fora ou Enter confirma; Esc volta a cor original.
// (o seletor do Windows só devolve a cor no fim, sem prévia)
const corOriginal = new WeakMap();
function previaCor(sel, hex) {
  for (const n of sel) {
    const m = malhas.get(n.id); if (!m?.material) continue;
    if (hex === null) { const o = corOriginal.get(m); if (o) { m.material.color.copy(o.cor); m.material.vertexColors = o.vc; m.material.needsUpdate = true; corOriginal.delete(m); } continue; }
    if (!corOriginal.has(m)) corOriginal.set(m, { cor: m.material.color.clone(), vc: m.material.vertexColors });
    m.material.color.set(hex); if (m.material.vertexColors) { m.material.vertexColors = false; m.material.needsUpdate = true; }
  }
  desenhar();
}
const PALETA = ['#d62828', '#f77f00', '#fcbf49', '#e9c46a', '#2a9d8f', '#52b788', '#3a86c8', '#457b9d', '#8338ec', '#c77dff', '#ef476f', '#ff99c8', '#6d4c41', '#8c97a1', '#1d1d1d', '#f1f1f1'];
let seletorAberto = null;
function abrirSeletorCor(ancora, corInicial, { previa, confirmar, cancelar }) {
  if (seletorAberto) seletorAberto.fechar(true);
  // cores lidas direto do texto (#rrggbb, em sRGB): THREE.Color guarda em espaço linear e escurecia a cor
  const rgb = c => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c).trim()); const n = m ? parseInt(m[1], 16) : 0x888888; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const hsv = { h: 0, s: 0, v: 0 };
  { const [r, g, b] = rgb(corInicial || '#888888'), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    hsv.v = mx; hsv.s = mx ? d / mx : 0;
    hsv.h = !d ? 0 : mx === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : mx === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6; }
  const hex = () => { const h = hsv.h * 6, i = Math.floor(h) % 6, f = h - Math.floor(h), v = hsv.v, s = hsv.s, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i]; return '#' + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); };
  const W = 200, Hq = 130;
  const quad = el('canvas', { width: W, height: Hq, class: 'sc-quad' }), barra = el('canvas', { width: W, height: 14, class: 'sc-barra' });
  const campoHex = el('input', { class: 'sc-hex', value: hex(), spellcheck: 'false', maxlength: 7 });
  const amostras = el('div', { class: 'sc-paleta' }, ...PALETA.map(c => el('button', { style: `background:${c}`, title: c, onclick: () => definirHex(c) })));
  const caixa = el('div', { class: 'seletor-cor', tabindex: '-1' }, quad, barra, el('div', { class: 'sc-linha' }, el('span', { class: 'sc-atual' }), campoHex), amostras,
    el('div', { class: 'sc-dica' }, tr('Enter ou clicar fora confirma · Esc desfaz')));
  const desenharSel = () => {
    const g = quad.getContext('2d');
    const base = new THREE.Color().setHSL(hsv.h, 1, 0.5);
    const gh = g.createLinearGradient(0, 0, W, 0); gh.addColorStop(0, '#fff'); gh.addColorStop(1, '#' + base.getHexString()); g.fillStyle = gh; g.fillRect(0, 0, W, Hq);
    const gv = g.createLinearGradient(0, 0, 0, Hq); gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(1, '#000'); g.fillStyle = gv; g.fillRect(0, 0, W, Hq);
    g.strokeStyle = hsv.v > 0.5 ? '#000' : '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(hsv.s * W, (1 - hsv.v) * Hq, 6, 0, Math.PI * 2); g.stroke();
    const b = barra.getContext('2d'), gb = b.createLinearGradient(0, 0, W, 0);
    for (let i = 0; i <= 6; i++) gb.addColorStop(i / 6, `hsl(${i * 60},100%,50%)`);
    b.fillStyle = gb; b.fillRect(0, 0, W, 14); b.strokeStyle = '#fff'; b.lineWidth = 2; b.strokeRect(hsv.h * W - 3, 1, 6, 12); b.strokeStyle = '#000'; b.lineWidth = 1; b.strokeRect(hsv.h * W - 4, 0, 8, 14);
    const hx = hex(); caixa.querySelector('.sc-atual').style.background = hx; if (document.activeElement !== campoHex) campoHex.value = hx;
  };
  const mudou = () => { desenharSel(); previa(hex()); };
  function definirHex(c) {
    const [r, g, b] = rgb(c), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    hsv.v = mx; hsv.s = mx ? d / mx : 0; if (d) hsv.h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : mx === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
    mudou();
  }
  const arrastar = (alvo, fn) => alvo.addEventListener('pointerdown', e => {
    alvo.setPointerCapture(e.pointerId); const r = alvo.getBoundingClientRect();
    const mover = ev => { fn(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))); mudou(); };
    mover(e); alvo.onpointermove = mover; alvo.onpointerup = () => { alvo.onpointermove = null; };
  });
  arrastar(quad, (x, y) => { hsv.s = x; hsv.v = 1 - y; });
  arrastar(barra, x => { hsv.h = Math.min(0.9999, x); });
  campoHex.addEventListener('input', () => { if (/^#?[0-9a-f]{6}$/i.test(campoHex.value.trim())) definirHex('#' + campoHex.value.trim().replace('#', '')); });
  document.body.append(caixa);
  const r = ancora.getBoundingClientRect(), wc = 220, hc = caixa.offsetHeight || 260;
  caixa.style.left = Math.max(8, Math.min(innerWidth - wc - 8, r.right - wc)) + 'px';
  caixa.style.top = (r.bottom + hc + 8 < innerHeight ? r.bottom + 4 : Math.max(8, r.top - hc - 4)) + 'px';
  const fora = e => { if (!caixa.contains(e.target) && e.target !== ancora) fechar(true); };
  const teclas = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(false); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); fechar(true); }
  };
  function fechar(aceitar) {
    if (seletorAberto !== ctrl) return;
    seletorAberto = null; caixa.remove();
    document.removeEventListener('pointerdown', fora, true); window.removeEventListener('keydown', teclas, true);
    if (aceitar) confirmar(hex()); else cancelar();
  }
  const ctrl = { fechar }; seletorAberto = ctrl;
  setTimeout(() => { document.addEventListener('pointerdown', fora, true); window.addEventListener('keydown', teclas, true); }, 0);
  desenharSel(); caixa.focus();
}
function controleParametro(no, d) {
  if (d.tipo === 'oculto') return document.createComment(d.chave);
  const gp = registro.obter(no.gerador);
  const v = no.parametros[d.chave] ?? d.padrao;
  const definir = nv => alterar(() => (no.parametros[d.chave] = nv));
  if (d.tipo === 'booleano') return campo(rotuloP(gp, d), el('input', { type: 'checkbox', checked: !!v, onchange: e => definir(e.target.checked) }));
  if (d.tipo === 'opcao') return campo(rotuloP(gp, d), el('select', { onchange: e => definir(e.target.value) },
    ...(d.opcoes ?? []).map(o => { const [val, rot] = Array.isArray(o) ? o : [o, o]; return el('option', { value: val, selected: val === v }, opcaoP(gp, d, val, rot)); })));
  if (d.tipo === 'fonte') return campo(rotuloP(gp, d), seletorFonte(v, definir), true);
  if (d.tipo === 'texto' && d.multilinha) {
    const ta = el('textarea', { rows: '2', spellcheck: 'false' }); ta.value = v ?? '';
    ta.addEventListener('change', () => definir(ta.value));
    return el('div', {}, campo(rotuloP(gp, d), ta, true), el('p', { class: 'dica' }, tr('Enter quebra a linha. Clique fora para aplicar.')));
  }
  if (d.tipo === 'texto') return campo(rotuloP(gp, d), el('input', { value: v ?? '', onchange: e => definir(e.target.value) }), true);
  if (d.tipo === 'pontos') {
    const ta = el('textarea', { spellcheck: 'false' }); ta.value = v ?? '';
    ta.addEventListener('change', () => definir(ta.value));
    const bloco = el('div', {}, campo(rotuloP(gp, d), ta, true), el('p', { class: 'dica' }, tr('Um ponto por linha. Clique fora para aplicar.')));
    if (d.editor) bloco.append(el('div', { class: 'botoes' }, el('button', { class: 'primario', onclick: () => {
      // reabre o desenho guardado, se ele ainda corresponde ao texto; senão parte dos pontos do texto (como cantos)
      const guardado = no.parametros[d.chave + '__desenho'];
      let controle = null;
      if (Array.isArray(guardado) && textoDoPerfil(amostrarPerfil(guardado, d.editor)) === String(v ?? '').trim()) controle = guardado;
      else { try { controle = lerPontos(v).map(([x, y]) => ({ x, y, s: false })); } catch { controle = []; } }
      abrirEditor2D({ modo: d.editor, controle, tr, el, abrirModal, fecharModal, decimal,
        aoAplicar: pts => alterar(() => { no.parametros[d.chave] = textoDoPerfil(amostrarPerfil(pts, d.editor)); no.parametros[d.chave + '__desenho'] = pts; }) });
    } }, d.editor === 'revolucao' ? tr('✎ Desenhar perfil…') : tr('✎ Desenhar polígono…'))));
    return bloco;
  }
  const casas = d.inteiro ? 0 : (d.casas ?? 2);
  return campo(rotuloP(gp, d), inputNumero(v, casas, nv => {
    if (d.inteiro) nv = Math.round(nv);
    if (d.min !== undefined && nv < d.min) nv = d.min;
    if (d.max !== undefined && nv > d.max) nv = d.max;
    definir(nv);
  }));
}

// ---------- biblioteca ----------
// ---------- fontes para o texto 3D: as do Anvil3D (DejaVu) e as instaladas no Windows ----------
const FONTES_INTERNAS = [['DejaVu Sans', 'DejaVuSans.ttf'], ['DejaVu Sans Bold', 'DejaVuSans-Bold.ttf'], ['DejaVu Sans Condensed Bold', 'DejaVuSansCondensed-Bold.ttf'],
  ['DejaVu Serif', 'DejaVuSerif.ttf'], ['DejaVu Serif Bold', 'DejaVuSerif-Bold.ttf'], ['DejaVu Sans Mono', 'DejaVuSansMono.ttf']];
let fontesSistema = [];
const fontesProntas = new Map(), fontesCarregando = new Map();
function carregarFonte(nome) {
  if (fontesProntas.has(nome)) return Promise.resolve(fontesProntas.get(nome));
  if (fontesCarregando.has(nome)) return fontesCarregando.get(nome);
  const interna = FONTES_INTERNAS.find(f => f[0] === nome), sistema = fontesSistema.find(f => f.nome === nome);
  const p = (async () => {
    let buf;
    if (interna) buf = await (await fetch('app://anvil/app/vendor/fontes/' + interna[1])).arrayBuffer();
    else if (sistema) { const u8 = await anvil.lerFonte(sistema.caminho); buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength); }
    else throw new Error(tt`a fonte "${nome}" não está instalada neste computador; escolha outra`);
    const f = opentype.parse(buf);
    fontesProntas.set(nome, f);
    return f;
  })();
  fontesCarregando.set(nome, p);
  p.catch(() => {}).finally(() => fontesCarregando.delete(nome));
  return p;
}
motor.definirFontes(nome => {
  if (fontesProntas.has(nome)) return fontesProntas.get(nome);
  const erroAntes = fontesCarregando.get(nome);
  carregarFonte(nome).then(() => { reconstruir3d(); montarPainel(); }, e => { fontesFalhas.set(nome, e.message); reconstruir3d(); });
  if (fontesFalhas.has(nome)) throw new Error(fontesFalhas.get(nome));
  throw new Error(tr('carregando a fonte…'));
});
const fontesFalhas = new Map();
async function prepararFontes() {
  try { fontesSistema = await anvil.fontesSistema(); } catch { fontesSistema = []; }
  try { await carregarFonte('DejaVu Sans Bold'); } catch {}
}
function seletorFonte(v, definir) {
  const s = el('select', { onchange: e => definir(e.target.value) },
    el('optgroup', { label: tr('Do Anvil3D') }, ...FONTES_INTERNAS.map(([n]) => el('option', { value: n, selected: n === v }, n))),
    fontesSistema.length ? el('optgroup', { label: tr('Instaladas no computador') }, ...fontesSistema.map(f => el('option', { value: f.nome, selected: f.nome === v }, f.nome))) : null);
  if (v && !FONTES_INTERNAS.some(f => f[0] === v) && !fontesSistema.some(f => f.nome === v)) s.prepend(el('option', { value: v, selected: true }, v + ' ' + tr('(não instalada)')));
  return s;
}

// ---------- miniaturas das formas (renderizadas uma vez, com a cor de cada forma) ----------
let rendMini = null;
const cacheMini = new Map();
function miniaturaDeDados(chave, d, cor) {
  if (cacheMini.has(chave)) return cacheMini.get(chave);
  let url = null;
  try {
    rendMini ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    rendMini.setPixelRatio(1); rendMini.setSize(128, 128); rendMini.setClearColor(0, 0);
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(d.posicoes), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(d.indices), 1));
    const ar = new THREE.EdgesGeometry(g, 25);
    g = g.toNonIndexed(); g.computeVertexNormals(); g.computeBoundingSphere();
    const cena2 = new THREE.Scene();
    cena2.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.7));
    const l = new THREE.DirectionalLight(0xffffff, 1.7); l.position.set(60, -100, 160); cena2.add(l);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: cor || '#3a86c8', roughness: 0.55, metalness: 0.05 }));
    m.add(new THREE.LineSegments(ar, new THREE.LineBasicMaterial({ color: 0x1e2a30, transparent: true, opacity: 0.3 })));
    cena2.add(m);
    const s = g.boundingSphere, cam = new THREE.PerspectiveCamera(30, 1, 0.1, 10000);
    cam.up.set(0, 0, 1);
    cam.position.copy(s.center).add(new THREE.Vector3(1, -1.35, 0.95).normalize().multiplyScalar(s.radius / Math.sin(15 * RAD) * 1.02));
    cam.lookAt(s.center);
    rendMini.render(cena2, cam);
    url = rendMini.domElement.toDataURL('image/png');
    g.dispose(); ar.dispose();
  } catch {}
  cacheMini.set(chave, url);
  return url;
}
function miniaturaGerador(g) {
  const chave = g.id + '|' + g.versao + '|' + g.cor + '|' + g.url;
  if (cacheMini.has(chave)) return cacheMini.get(chave);
  // miniaturas ficam guardadas entre aberturas do programa (gerar todas a cada abertura levava segundos)
  const guardada = (() => { try { return localStorage.getItem('mini:' + chave); } catch { return null; } })();
  if (guardada) { cacheMini.set(chave, guardada); return guardada; }
  try {
    const m = g.gerar(parametrosPadrao(g), motor.ctx); const d = dadosMalha(m); m.delete();
    const url = miniaturaDeDados(chave, d, g.cor);
    if (url) try { localStorage.setItem('mini:' + chave, url); } catch {}
    return url;
  }
  catch { cacheMini.set(chave, null); return null; }
}
function ladrilho(rotulo, imagem, icone, classe, titulo, acao, soltar, fantasma = null) {
  const b = el('button', { class: 'forma ' + classe, title: titulo + '\n' + tr('Clique: põe no centro da mesa. Arraste: solta onde quiser.'), onclick: acao, draggable: 'true' },
    imagem ? el('img', { src: imagem, alt: '', draggable: 'false' }) : el('span', { class: 'icone' }, icone), el('span', { class: 'nome-forma' }, rotulo));
  b.addEventListener('dragstart', e => {
    arrastandoForma = soltar;
    e.dataTransfer.setData('text/x-anvil-forma', '1'); e.dataTransfer.effectAllowed = 'copy';
    // a própria peça segue o mouse na vista; a imagem padrão do arraste fica invisível
    const vazio = new Image(); vazio.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(vazio, 0, 0);
    montarFantasma(fantasma);
  });
  b.addEventListener('dragend', () => { arrastandoForma = null; marcaSoltar.visible = false; fantasmaArraste.visible = false; desenhar(); });
  return b;
}

// ---------- arrastar da biblioteca para a mesa ----------
let arrastandoForma = null;
const marcaSoltar = new THREE.Mesh(new THREE.RingGeometry(3, 4.2, 40), new THREE.MeshBasicMaterial({ color: 0xe0a100, depthTest: false, transparent: true, opacity: 0.9 }));
marcaSoltar.renderOrder = 60; marcaSoltar.visible = false; cena.add(marcaSoltar);
// peça "fantasma" que segue o mouse enquanto você arrasta da biblioteca
const fantasmaArraste = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.6, depthWrite: false, roughness: 0.6 }));
fantasmaArraste.visible = false; fantasmaArraste.renderOrder = 55; cena.add(fantasmaArraste);
function montarFantasma(f) {
  fantasmaArraste.geometry.dispose(); fantasmaArraste.geometry = new THREE.BufferGeometry(); fantasmaArraste.userData.ok = false;
  if (!f) return;
  try {
    const { d, cor } = f();
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(d.posicoes), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(d.indices), 1));
    g = g.toNonIndexed(); g.computeVertexNormals();
    fantasmaArraste.geometry = g; fantasmaArraste.material.color.set(cor || '#3a86c8'); fantasmaArraste.userData.ok = true;
  } catch {}
}
function pontoDeSoltar(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  // sempre na mesa, na altura zero
  const p = ray.ray.intersectPlane(new THREE.Plane(new V3(0, 0, 1), 0), new V3());
  if (!p) return null;
  const passo = Number($('#passo-mov').value) || 0;
  if (passo) { p.x = Math.round(p.x / passo) * passo; p.y = Math.round(p.y / passo) * passo; }
  return [arred(p.x), arred(p.y), arred(p.z)];
}
vista.addEventListener('dragover', e => {
  if (!arrastandoForma) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
  const p = pontoDeSoltar(e);
  const comFantasma = !!p && fantasmaArraste.userData.ok;
  fantasmaArraste.visible = comFantasma; marcaSoltar.visible = !!p && !comFantasma;
  if (p) {
    fantasmaArraste.position.set(p[0], p[1], 0);
    marcaSoltar.position.set(p[0], p[1], 0.05); marcaSoltar.scale.setScalar(Math.max(0.4, camera.position.distanceTo(marcaSoltar.position) / 180));
  }
  desenhar();
});
vista.addEventListener('dragleave', () => { marcaSoltar.visible = false; fantasmaArraste.visible = false; desenhar(); });
vista.addEventListener('drop', e => {
  if (!arrastandoForma) return;
  e.preventDefault();
  const p = pontoDeSoltar(e), f = arrastandoForma;
  arrastandoForma = null; marcaSoltar.visible = false; fantasmaArraste.visible = false;
  if (p) f([p[0], p[1], 0]);
});

// Biblioteca em categorias (ordem fixa, como no Tinkercad), que abrem e fecham, com busca por nome
const ORDEM_CATEGORIAS = ['Básicos', 'Poliedros', 'Símbolos', 'Fixadores', 'Mecânica', 'Encaixes', 'Conectores', 'Tijolos', 'Recipientes', 'Geradores'];
// ao abrir o programa, só os Básicos ficam abertos; dali em diante vale o que a pessoa abrir ou fechar
const catsFechadas = new Set(), catsVistas = new Set();
localStorage.removeItem('catFechadas');
function montarBiblioteca() {
  const lista = $('#lista-formas'); lista.replaceChildren();
  const busca = ($('#busca-formas')?.value ?? '').trim().toLowerCase();
  const casa = (...t) => !busca || t.some(x => String(x ?? '').toLowerCase().includes(busca));
  const cats = new Map();
  for (const g of registro.lista()) {
    if (!casa(nomeG(g), g.nome, g.en?.nome, descG(g), catG(g))) continue;
    const chave = g.categoria || 'Outros';
    if (!cats.has(chave)) cats.set(chave, []); cats.get(chave).push(g);
  }
  const ordem = [...cats.keys()].sort((a, b) => {
    const ia = ORDEM_CATEGORIAS.indexOf(a), ib = ORDEM_CATEGORIAS.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  const secao = (chave, titulo, filhos) => {
    const fechada = !busca && catsFechadas.has(chave);
    const cab = el('button', { class: 'cat-titulo' + (fechada ? ' fechada' : ''), onclick: () => {
      fechada ? catsFechadas.delete(chave) : catsFechadas.add(chave);
      montarBiblioteca();
    } }, el('span', { class: 'seta-cat' }, fechada ? '▸' : '▾'), titulo, el('span', { class: 'qtd-cat' }, String(filhos.length)));
    lista.append(cab);
    if (!fechada) lista.append(el('div', { class: 'grade-formas' }, ...filhos));
  };
  for (const chave of [...ordem, '__pecas']) if (!catsVistas.has(chave)) { catsVistas.add(chave); if (chave !== 'Básicos') catsFechadas.add(chave); }
  for (const chave of ordem) {
    const gs = cats.get(chave).sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || nomeG(a).localeCompare(nomeG(b)));
    secao(chave, catG(gs[0]), gs.map(g =>
      ladrilho(nomeG(g), miniaturaGerador(g), g.icone, g.origem, `${nomeG(g)}\n${descG(g)}\n${g.origem === 'usuario' ? tr('Plugin do usuário') : tr('Interno')} · v${g.versao}`, () => adicionarForma(g), pos => adicionarForma(g, pos),
        () => { const m = g.gerar(parametrosPadrao(g), motor.ctx); const d = dadosMalha(m); m.delete(); return { d, cor: g.cor }; })));
  }
  const pecas = pecasBib.filter(p => casa(p.nome));
  if (pecas.length) secao('__pecas', tr('Minhas peças'), pecas.map(p =>
    ladrilho(p.nome, p.miniatura, '◆', 'peca', p.nome + '\n' + tt`Peça da biblioteca\n${p.caminho}`, () => inserirPeca(p), pos => inserirPeca(p, pos))));
  if (busca && !lista.children.length) lista.append(el('p', { class: 'dica' }, tr('Nenhuma forma com esse nome.')));
  $('#erros-plugins').textContent = registro.erros.map(e => `${e.url.split('/').pop().split('?')[0]}: ${e.erro}`).join('\n');
}
$('#busca-formas')?.addEventListener('input', () => montarBiblioteca());
$('#busca-formas')?.addEventListener('keydown', e => { if (e.key === 'Escape') { e.target.value = ''; montarBiblioteca(); } e.stopPropagation(); });
async function carregarPlugins() {
  registro.limpar();
  for (const p of await anvil.listarPlugins()) {
    try {
      if (p.pedido) throw new Error(tr('este arquivo é o PEDIDO para a IA, não a resposta dela: cole o texto na IA e salve aqui o código que ela devolver'));
      if (p.vazio) throw new Error(tr('o arquivo está vazio (0 bytes): o código não foi gravado; cole a resposta da IA de novo e salve'));
      const mod = await import(p.url);
      // aceita "export default {…}" e também um único objeto de plugin exportado com outro nome
      const pareceplugin = v => v && typeof v === 'object' && typeof v.gerar === 'function';
      const def = pareceplugin(mod.default) ? mod.default : Object.values(mod).find(pareceplugin);
      if (!def) throw new Error(tr('o arquivo não tem "export default { … }" com a função gerar(); confira se copiou só o código da resposta da IA'));
      registro.registrar(def, p);
    }
    catch (e) { registro.erros.push({ url: p.url, erro: e.message ?? String(e) }); }
  }
  motor.limparCache();
  for (const c of cacheGeo.values()) { c.geo.dispose(); c.arestas.dispose(); }
  cacheGeo.clear();
  montarBiblioteca(); reconstruir3d(); montarPainel();
  mensagem(tt`${registro.lista().length} formas carregadas${registro.erros.length ? tt`, ${registro.erros.length} plugin(s) com erro` : ''}.`, !!registro.erros.length);
}

// ---------- comandos e atalhos ----------
const comandos = {
  novo, abrir, salvar, salvarComo, exportarStl, importarStl, importarSvg, exportarStlPorObjeto,
  mesa200: () => trocarMesa(200), mesa220: () => trocarMesa(220), mesa256: () => trocarMesa(256), mesa300: () => trocarMesa(300),
  mesaPersonalizada: () => pedirMesaPersonalizada(),
  grade1: () => trocarGrade(1), grade25: () => trocarGrade(2.5), grade5: () => trocarGrade(5), grade10: () => trocarGrade(10),
  juntarFaces: () => (JF ? sairJF() : entrarJF(false)),
  faceNaMesa: () => (FM ? sairFM() : entrarFM()),
  soltarJuncao: () => {
    const presos = selecionados().filter(n => n.juncao);
    if (!presos.length) return mensagem(tr('Nenhuma peça selecionada está presa por junção.'));
    alterar(() => presos.forEach(n => delete n.juncao));
    mensagem(tt`Junção solta em ${presos.length} peça(s); elas ficaram onde estavam.`);
  },
  alinhar: () => (ALN ? sairAlinharObj() : entrarAlinhar()),
  projetar: () => projetarNaSuperficie(),
  aplicarFace: () => entrarAplicarFace(),
  espelharModo: () => (ESP ? sairEspelhar() : entrarEspelhar()),
  alternarGizmo: () => { definirModoGizmo(E.modoGizmo === 'girar' ? 'mover' : 'girar'); montarPainel(); },
  ajuda: () => abrirAjuda(), sobre: abrirSobre, guiaIA: abrirGuiaIA, propriedades: propriedadesProjeto, consolidar, abrirPastaPecas: () => anvil.abrirPastaPecas(),
  verTriangulos: () => { E.verTri = !E.verTri; localStorage.setItem('verTri', E.verTri ? '1' : '0'); $('#bt-tri').classList.toggle('ativo', E.verTri); reconstruir3d(); },
  desfazer: () => { if (MA) sairModoAresta(); if (ME) sairME(); if (hist.desfazer(E.doc)) { marcarSujo(); reconstruir3d(); montarPainel(); } },
  refazer: () => { if (MA) sairModoAresta(); if (ME) sairME(); if (hist.refazer(E.doc)) { marcarSujo(); reconstruir3d(); montarPainel(); } },
  duplicar, excluir, agrupar, desagrupar, alternarFuro, copiar, colar, recortar,
  moverPeca: () => { moverPeca = !moverPeca; localStorage.setItem('moverPeca', moverPeca ? '1' : '0'); document.querySelector('[data-cmd=moverPeca]')?.classList.toggle('ativo', moverPeca); atualizarVisual(); mensagem(moverPeca ? tr('Mover arrastando a peça: ligado. Arraste a peça; a seta preta no topo sobe e desce.') : tr('Mover arrastando a peça: desligado. Use as setas do gizmo para mover.')); },
  alcasLaterais: () => { alcasLaterais = !alcasLaterais; localStorage.setItem('alcasLaterais', alcasLaterais ? '1' : '0'); document.querySelector('[data-cmd=alcasLaterais]')?.classList.toggle('ativo', alcasLaterais); desenhar(); },
  vistaIso: () => enquadrar('iso'), vistaTopo: () => enquadrar('topo'), vistaFrente: () => enquadrar('frente'),
  vistaDireita: () => enquadrar('direita'), ajustar: () => enquadrar(),
  recarregarPlugins: async () => { await carregarPlugins(); await carregarPecas(); }, abrirPastaPlugins: () => anvil.abrirPastaPlugins(),
};
const CMD_NEUTROS = new Set(['vistaIso', 'vistaTopo', 'vistaFrente', 'vistaDireita', 'ajustar', 'verTriangulos', 'ajuda', 'sobre', 'guiaIA', 'idiomaPt', 'idiomaEn', 'salvar', 'salvarComo', 'exportarStl', 'exportarStlPorObjeto', 'abrirPastaPlugins', 'abrirPastaPecas']);
const CMD_MODO = { juntarFaces: 'JF', faceNaMesa: 'FM', alinhar: 'ALN', espelharModo: 'ESP' };
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cmd]'); if (!b) return;
  if (!CMD_NEUTROS.has(b.dataset.cmd)) encerrarModos(CMD_MODO[b.dataset.cmd] ?? null);
  comandos[b.dataset.cmd]?.();
});

document.addEventListener('keydown', e => {
  if (!modal.hidden) { if (e.key === 'Escape') fecharModal(); return; }
  if (e.key === 'F1') { e.preventDefault(); return abrirAjuda(); }
  if (e.key === 'Escape' && !popdica.hidden) return fecharDica();
  if (e.target.matches?.('input, textarea, select')) return;
  const k = e.key.toLowerCase(), c = e.ctrlKey || e.metaKey;
  const atalho = (
    c && e.shiftKey && k === 's' ? salvarComo : c && k === 's' ? salvar : c && k === 'o' ? abrir : c && k === 'n' ? novo :
    c && k === 'e' ? exportarStl : c && k === 'z' ? comandos.desfazer : c && k === 'y' ? comandos.refazer :
    c && k === 'd' ? duplicar : c && e.shiftKey && k === 'g' ? desagrupar : c && k === 'g' ? agrupar :
    c && k === 'c' ? copiar : c && k === 'v' ? colar : c && k === 'x' ? recortar : c && k === 'a' ? () => { E.sel = E.doc.objetos.map(o => o.id); atualizarVisual(); montarPainel(); } :
    c && k === 'i' ? importarStl : !c && k === 'r' ? comandos.alternarGizmo : !c && e.shiftKey && k === 'j' ? comandos.soltarJuncao : !c && k === 'b' ? comandos.faceNaMesa : !c && k === 'l' ? comandos.alinhar : !c && k === 'm' ? comandos.espelharModo : c && k === 'k' ? consolidar : !c && k === 'j' ? () => { if (!e.repeat) entrarJF(true); } : !c && k === 't' ? comandos.verTriangulos :
    k === 'enter' && AL ? sairAlinhar : k === 'enter' && MA ? aplicarModoAresta : k === 'delete' && ME ? apagarSelecaoME : k === 'delete' && !MA ? excluir : !c && k === 'h' ? alternarFuro : !c && k === 'f' ? () => enquadrar() : k === 'home' ? () => enquadrar('iso') :
    k === 'escape' ? () => { if (menuAberto) fecharMenu(); else if (E.escolhendoPonto) cancelarEscolha(); else if (FM) { sairFM(); mensagem(tr('Face na mesa cancelado.')); } else if (ALN) sairAlinharObj(); else if (ESP) sairEspelhar(); else if (AF) { sairAplicarFace(); mensagem(tr('Aplicar na face cancelado.')); } else if (AL) { sairAlinhar(); mensagem(tr('Junção mantida sem alinhar arestas. Arraste a peça para deslizar sobre a outra.')); } else if (JF) { sairJF(); mensagem(tr('Juntar faces cancelado.')); } else if (MA) sairModoAresta(); else if (ME) sairME(); else { E.sel = []; atualizarVisual(); montarPainel(); } } :
    k === 'arrowleft' ? () => moverTeclado(-1, 0, 0) : k === 'arrowright' ? () => moverTeclado(1, 0, 0) :
    c && k === 'arrowup' ? () => moverTeclado(0, 0, 1) : c && k === 'arrowdown' ? () => moverTeclado(0, 0, -1) :
    k === 'arrowup' ? () => moverTeclado(0, 1, 0) : k === 'arrowdown' ? () => moverTeclado(0, -1, 0) : null);
  if (atalho) {
    e.preventDefault();
    const neutro = k === 'escape' || k === 'f' || k === 'home' || (!c && k === 't') || (k === 'enter' && (AL || MA)) || (k === 'delete' && ME) || (c && (k === 's' || k === 'e'));
    if (!neutro) encerrarModos(atalho === comandos.alinhar ? 'ALN' : atalho === comandos.espelharModo ? 'ESP' : atalho === comandos.faceNaMesa ? 'FM' : (!c && k === 'j') ? 'JF' : null);
    atalho();
  }
});

// acesso para depuração no console (F12) e testes
window.__anvil = { get previaAF() { return grupoPreviaAF.children.length; }, orbita, abrirTexto: (texto, caminho) => abrirArquivo({ texto, caminho }), motor, moverPeca: v => { moverPeca = v; atualizarVisual(); }, alcasLaterais: v => { alcasLaterais = v; desenhar(); }, criarDeSvg: (t, n) => criarDeSvg(t, n), mostrarCotas: (chave = 'todas') => { alcaHover = null; cotasAlca = chave; cotasAte = performance.now() + 60000; desenhar(); }, get espelho() { return ESP; }, arrasteAlcaInfo: () => arrasteAlca, serializarComMiniatura: () => serializarComMiniatura(), selecionar: ids => { E.sel = ids; atualizarVisual(); montarPainel(); }, gizmo, grupoAfetado, get alinharObj() { return ALN; }, get alinhar() { return AL; }, get modoMalha() { return ME; }, THREE, camera, cena, grupoArestas, malhas, estado: E, get modoAresta() { return MA; } };

// ---------- idioma ----------
const originais = new WeakMap();
const fixo = n => n.closest?.('#propriedades, #lista-formas, #cotas, #cota-mov, #msg, #tris, #versao, .conteudo-modal, #erros-plugins, #modal h2, :not(html)[lang]');
function traduzirEstatico() {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    if (!n.data.trim() || fixo(n.parentElement)) continue;
    if (!originais.has(n)) originais.set(n, n.data);
    const o = originais.get(n), k = o.trim();
    n.data = o.replace(k, tr(k));
  }
  for (const e of document.querySelectorAll('[title], [aria-label], [placeholder]')) {
    if (fixo(e)) continue;
    for (const a of ['title', 'aria-label', 'placeholder']) {
      if (!e.hasAttribute(a)) continue;
      if (!e.hasAttribute('data-pt-' + a)) e.setAttribute('data-pt-' + a, e.getAttribute(a));
      e.setAttribute(a, tr(e.getAttribute('data-pt-' + a)));
    }
  }
  $('#bt-pt')?.classList.toggle('ativo', idiomaAtual() === 'pt');
  $('#bt-en')?.classList.toggle('ativo', idiomaAtual() === 'en');
}
function trocarIdioma(l) {
  definirIdioma(l); localStorage.setItem('idioma', idiomaAtual());
  document.documentElement.lang = idiomaAtual() === 'en' ? 'en' : 'pt-BR';
  anvil.definirIdioma(idiomaAtual());
  traduzirEstatico(); montarBiblioteca(); montarPainel(); definirModoGizmo(E.modoGizmo);
  marcarSujo(E.sujo); reconstruir3d();
  mensagem(tr('Pronto.'));
}
comandos.idiomaPt = () => trocarIdioma('pt');
comandos.idiomaEn = () => trocarIdioma('en');
anvil.definirIdioma(idiomaAtual());
traduzirEstatico();

// ---------- início ----------
$('#bt-tri').classList.toggle('ativo', E.verTri);
// a vista aparece sempre no fim, mesmo que algo da abertura dê errado (antes um erro deixava a tela vazia)
try {
  $('#versao').textContent = 'Anvil3D ' + (await anvil.versao());
  await prepararFontes();
  await carregarPlugins();
  await carregarPecas();
  const inicial = await anvil.arquivoInicial();
  if (inicial) {
    try { abrirArquivo(await anvil.ler(inicial)); }
    catch (e) { mensagem(tt`Não foi possível abrir ${inicial}: ${e.message ?? e}`, true); marcarSujo(false); montarPainel(); enquadrar('iso'); }
  } else { marcarSujo(false); montarPainel(); enquadrar('iso'); }
} catch (e) {
  console.error(e); mensagem(tr('Erro ao iniciar: ') + (e.message ?? e), true);
} finally {
  // só mostra quando o layout parou de mudar (fontes carregadas, painéis montados)
  try { await document.fonts?.ready; } catch {}
  let tam = '';
  for (let i = 0; i < 20; i++) {
    await new Promise(r => requestAnimationFrame(r));
    const t = vista.clientWidth + 'x' + vista.clientHeight;
    if (t === tam) break; tam = t;
  }
  try { enquadrar(E.doc.objetos.length ? undefined : 'iso'); } catch {}
  desenhar();
  renderer.domElement.classList.remove('carregando');
  // se a janela mudar de tamanho logo no começo (ex.: maximizar), reenquadra até a pessoa mexer na vista
  let mexeu = false;
  for (const ev of ['pointerdown', 'wheel', 'keydown']) window.addEventListener(ev, () => { mexeu = true; }, { once: true, capture: true });
  new ResizeObserver(() => { if (!mexeu) try { enquadrar(E.doc.objetos.length ? undefined : 'iso'); desenhar(); } catch {} }).observe(vista);
  setTimeout(() => { mexeu = true; }, 4000);
}
