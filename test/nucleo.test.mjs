// Testes do núcleo (rodam no Node, sem interface): npm test
import Module from 'manifold-3d';
import * as THREE from 'three';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RegistroPlugins, parametrosPadrao } from '../app/core/plugins.mjs';
import { MotorGeometria, dadosMalha } from '../app/core/geometria.mjs';
import { novoDocumento, novaForma, novoGrupo, serializar, carregarDocumento } from '../app/core/documento.mjs';
import { compor } from '../app/core/transform.mjs';
import { stlBinario } from '../app/core/stl.mjs';
import { extrairArestas, descritor } from '../app/core/arestas.mjs';
import { novoAcabamento, novaMalha } from '../app/core/documento.mjs';
import * as M from '../app/core/malha.mjs';
import { lerObj, escreverObj, ler3mf, escrever3mf } from '../app/core/formatos.mjs';
import { MeshoptSimplifier } from '../node_modules/meshoptimizer/meshopt_simplifier.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let falhas = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FALHA ') + msg); if (!c) falhas++; };
const perto = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol;

const wasm = await Module(); wasm.setup();
const reg = new RegistroPlugins();
function arquivos(d) { return readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? arquivos(join(d, e.name)) : e.name.endsWith('.mjs') ? [join(d, e.name)] : []); }
for (const f of [...arquivos(join(raiz, 'plugins')), join(raiz, 'app', 'exemplo-plugin.mjs')]) {
  reg.registrar((await import(pathToFileURL(f))).default, { origem: 'teste' });
}
const motor = new MotorGeometria(wasm, reg);
{ // fonte para o plugin de texto (no app ela vem do carregador de fontes)
  const { default: opentype } = await import('opentype.js');
  const { readFileSync } = await import('node:fs');
  const b = readFileSync(new URL('../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf', import.meta.url));
  const f = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  motor.definirFontes(() => f);
}

console.log('Plugins:');
for (const g of reg.lista()) {
  const no = novaForma(g, parametrosPadrao(g), '#fff');
  let m, erro = null;
  try { m = motor.local(no); } catch (e) { erro = e.message; }
  const bb = m?.boundingBox();
  ok(!erro && m.volume() > 0 && perto(bb.min[2], 0, 1e-6), `${g.id}: volume ${m?.volume().toFixed(1)}, base em z=${bb?.min[2].toFixed(3)} ${erro ?? ''}`);
}

console.log('Matriz igual à do three.js:');
const t = { posicao: [3, -4, 5], rotacao: [12.3, -45.6, 78.9], escala: [1.5, 2, 0.5] };
const m3 = new THREE.Matrix4().compose(new THREE.Vector3(...t.posicao),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(...t.rotacao.map(a => a * Math.PI / 180), 'XYZ')), new THREE.Vector3(...t.escala));
ok(compor(t).every((v, i) => perto(v, m3.elements[i], 1e-9)), 'compor() == Matrix4.compose()');

console.log('Grupo com furo, salvar/abrir e STL:');
const doc = novoDocumento();
const caixa = novaForma(reg.obter('caixa'), { largura: 20, profundidade: 20, altura: 10, raio: 0 }, '#f00');
const furo = novaForma(reg.obter('cilindro'), { diametro: 10, altura: 20, lados: 64 }, '#000');
furo.furo = true; furo.transformacao.posicao = [0, 0, -5];
doc.objetos.push(novoGrupo([caixa, furo]));
const vol = motor.mundo(doc.objetos[0]).volume();
const esperado = 4000 - Math.PI * 25 * 10 * (64 / (2 * Math.PI)) * Math.sin(2 * Math.PI / 64);
ok(perto(vol, esperado, 0.01), `volume caixa - furo = ${vol.toFixed(2)} (esperado ${esperado.toFixed(2)})`);
const doc2 = carregarDocumento(serializar(doc));
ok(doc2.objetos[0].filhos[1].furo === true && doc2.objetos[0].filhos.length === 2, 'árvore preservada após salvar/abrir');
const stl = stlBinario(dadosMalha(motor.resultadoFinal(doc2.objetos)));
const dv = new DataView(stl.buffer);
ok(stl.length === 84 + dv.getUint32(80, true) * 50 && dv.getUint32(80, true) > 0, `STL binário com ${dv.getUint32(80, true)} triângulos`);

console.log('Gerador ausente não destrói o projeto:');
const fantasma = { ...caixa, id: 'x', gerador: 'nao-existe' };
let msg = ''; try { motor.local(fantasma); } catch (e) { msg = e.message; }
ok(/não está instalado/.test(msg), 'erro claro: ' + msg);
ok(carregarDocumento(serializar({ ...doc, objetos: [fantasma] })).objetos[0].gerador === 'nao-existe', 'dados do nó mantidos');

console.log('Formas com bordas arredondadas:');
for (const [id, p] of [['caixa', { largura: 30, profundidade: 20, altura: 10, arredondar: 'todas', raio: 3 }],
  ['caixa', { largura: 30, profundidade: 20, altura: 10, arredondar: 'topo', raio: 3 }],
  ['cilindro', { diametro: 20, altura: 10, lados: 0, bordaTopo: 'fillet', medidaTopo: 2, bordaBase: 'chanfro', medidaBase: 1 }]]) {
  const m = motor.local(novaForma(reg.obter(id), p, '#fff'));
  ok(m.volume() > 0 && m.genus() === 0, `${id} ${p.arredondar ?? p.bordaTopo}: volume ${m.volume().toFixed(1)}`);
}

console.log('Acabamento (fillet/chanfro por aresta) continua editável:');
const cx = novaForma(reg.obter('caixa'), { largura: 20, profundidade: 20, altura: 20, raio: 0 }, '#f00');
const topo = extrairArestas(motor.local(cx)).filter(f => f.tipo === 'reta' && Math.min(f.a[2], f.b[2]) > 19.9);
const ac = novoAcabamento(cx, 'fillet', 2, topo.map(descritor), cx.transformacao);
cx.transformacao = { posicao: [0, 0, 0], rotacao: [0, 0, 0], escala: [1, 1, 1] };
const v1 = motor.local(ac).volume();
ok(perto(v1, 8000 - 80 * (4 - Math.PI), 3), `fillet 2 mm no topo: ${v1.toFixed(2)}`);
const ac2 = carregarDocumento(serializar({ ...novoDocumento(), objetos: [ac] })).objetos[0];
ac2.filhos[0].parametros.altura = 35;
const m2 = motor.local(ac2);
ok(perto(m2.volume(), 14000 - 80 * (4 - Math.PI), 3) && !m2.avisoAnvil, `altura mudou para 35 e o fillet seguiu o topo: ${m2.volume().toFixed(2)}`);
ac2.filhos[0].parametros.largura = 10; ac2.medida = 1;
ok(motor.local(ac2).volume() > 0, 'mudou largura e medida sem erro');

console.log('Malha editável:');
const esf = novaForma(reg.obter('esfera'), { diametro: 40, segmentos: 96 }, '#0f0');
const ml = novaMalha('Esfera', '#0f0');
M.gravarMalha(ml, M.deManifold(motor.local(esf)));
const nt0 = M.numTriangulos(ml);
ok(motor.local(ml).volume() > 0, `convertida em malha fechada: ${nt0} triângulos`);
const ml2 = carregarDocumento(serializar({ ...novoDocumento(), objetos: [ml] })).objetos[0];
ok(M.numTriangulos(ml2) === nt0 && perto(motor.local(ml2).volume(), motor.local(ml).volume(), 1e-3), 'salvar/abrir preserva a malha');
const ap = M.apagarTriangulos(M.lerMalha(ml), [0, 1, 2]);
M.gravarMalha(ml2, ap);
let me = ''; try { motor.local(ml2); } catch (e) { me = e.message; }
ok(/aberta/.test(me) && M.bordas(ap).length > 0, 'apagar triângulos abre a malha: ' + me);
const fe = M.fecharBuracos(ap); M.gravarMalha(ml2, fe.dados);
ok(fe.buracos >= 1 && M.bordas(fe.dados).length === 0 && motor.local(ml2).volume() > 0, `fechou ${fe.buracos} buraco(s) deixa a malha fechada de novo`);
const s = await M.simplificar(MeshoptSimplifier, M.lerMalha(ml), { proporcao: 0.1 });
M.gravarMalha(ml2, s.dados);
const vs = motor.local(ml2).volume(), v0 = motor.local(ml).volume();
ok(M.numTriangulos(ml2) <= nt0 * 0.11 && Math.abs(vs - v0) / v0 < 0.03, `simplificar 10%: ${nt0} -> ${M.numTriangulos(ml2)} triângulos, volume ${(100 * vs / v0).toFixed(1)}% do original`);
const stlLido = M.lerStl(stlBinario(dadosMalha(motor.local(ml))));
ok(stlLido.t.length / 3 === nt0, 'importar STL binário e soldar vértices');

console.log('Projeto antigo (origem no centro da mesa):');
{
  const v1 = JSON.stringify({ formato: 'anvil3d', versao: 1, objetos: [{ id: 'a', tipo: 'forma', gerador: 'caixa', parametros: {}, transformacao: { posicao: [0, 0, 0], rotacao: [0, 0, 0], escala: [1, 1, 1] } }] });
  const d = carregarDocumento(v1);
  ok(d.versao === 2 && d.objetos[0].transformacao.posicao.join() === '100,100,0', 'migrado para a origem na quina: ' + d.objetos[0].transformacao.posicao.join());
}

console.log('Reparo para impressão:');
{
  const { Manifold } = wasm;
  const junta = ps => { const v = [], t = []; for (const p of ps) { const b = v.length / 3; v.push(...p.v); t.push(...[...p.t].map(x => x + b)); } return { v: new Float32Array(v), t: new Uint32Array(t) }; };
  const inv = M.deManifold(Manifold.cube([20, 20, 20]).translate([60, 0, 0]));
  for (let i = 0; i < inv.t.length; i += 3) [inv.t[i + 1], inv.t[i + 2]] = [inv.t[i + 2], inv.t[i + 1]];
  const d = junta([M.deManifold(Manifold.cube([20, 20, 20])), M.deManifold(Manifold.cube([20, 20, 20]).translate([10, 0, 0])), inv,
    M.apagarTriangulos(M.deManifold(Manifold.cylinder(10, 5, 5, 32).translate([120, 0, 0])), [0, 1]),
    M.deManifold(Manifold.cube([0.3, 0.3, 0.3]).translate([200, 0, 0]))]);
  const t2 = new Uint32Array([...d.t, ...d.t.slice(0, 9)]);
  const sopa = { v: new Float32Array(t2.length * 3), t: new Uint32Array(t2.length).map((_, i) => i) };
  t2.forEach((vi, i) => sopa.v.set(d.v.subarray(vi * 3, vi * 3 + 3), i * 3));
  ok(!M.diagnosticar(sopa).ok, 'diagnóstico acusa o STL estragado');
  const r = M.reparar(wasm, sopa);
  const vol = M.paraManifold(wasm, r.dados).volume(), esp = 12000 + 8000 + Manifold.cylinder(10, 5, 5, 32).volume();
  ok(r.fechada && M.diagnosticar(r.dados).ok && perto(vol, esp, 0.5), `reparado: ${r.relatorio.length} correções, volume ${vol.toFixed(1)} (esperado ${esp.toFixed(1)})`);
}

{
  console.log('formatos OBJ e 3MF');
  const cubo = { posicoes: new Float32Array([0,0,0,10,0,0,10,10,0,0,10,0,0,0,10,10,0,10,10,10,10,0,10,10]),
    indices: new Uint32Array([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]) };
  const o = lerObj(escreverObj(cubo));
  ok(o.v.length === 24 && o.t.length === 36 && M.diagnosticar(o).ok, 'OBJ: ida e volta mantém o cubo fechado');
  const r = await ler3mf(await escrever3mf([{ nome: 'a', cor: '#ff0000', dados: cubo }, { nome: 'b', cor: '#00ff00', dados: cubo }]));
  ok(r.length === 2 && r[1].nome === 'b' && r.every(x => x.d.t.length === 36 && M.diagnosticar(x.d).ok), '3MF: duas peças, nomes e malhas preservados');
}

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
