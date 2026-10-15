// Formato de arquivo .nvl3d (antes .anvil): JSON legível com a árvore de construção completa.
// O STL é só exportação; a "receita" fica sempre aqui.
import { tr, tt } from './i18n.mjs';
import { transformacaoPadrao } from './transform.mjs';

export const FORMATO = 'anvil3d';
export const VERSAO = 2;

// Migrações: chave = versão de origem, função leva o doc para versão+1.
// Ao mudar o formato no futuro, acrescente aqui (ex.: 1: doc => {...; doc.versao = 2; return doc}).
const migracoes = {
  // v2: a origem passou do centro da mesa de 200 mm para a quina da frente à esquerda
  1: doc => {
    for (const o of doc.objetos ?? []) if (o.transformacao?.posicao) { o.transformacao.posicao[0] += 100; o.transformacao.posicao[1] += 100; }
    doc.versao = 2; return doc;
  },
};

export const novoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function novoDocumento() {
  return { formato: FORMATO, versao: VERSAO, unidades: 'mm', objetos: [] };
}

export function novaForma(gerador, parametros, cor) {
  return {
    id: novoId(), nome: gerador.nome, tipo: 'forma', gerador: gerador.id,
    parametros: { ...parametros }, furo: false, cor, transformacao: transformacaoPadrao(),
  };
}

export function novoGrupo(filhos, transformacao) {
  const primeiroSolido = filhos.find(f => !f.furo);
  return {
    id: novoId(), nome: tr('Grupo'), tipo: 'grupo', furo: false,
    cor: primeiroSolido ? primeiroSolido.cor : '#9aa3a8',
    transformacao: transformacao || transformacaoPadrao(), filhos,
  };
}

function normalizarNo(n) {
  n.id ??= novoId();
  n.nome ??= n.tipo === 'grupo' ? 'Grupo' : (n.gerador || 'Forma');
  n.furo = !!n.furo;
  n.cor ??= '#3a86c8';
  const t = n.transformacao ?? {};
  n.transformacao = {
    posicao: t.posicao ?? [0, 0, 0], rotacao: t.rotacao ?? [0, 0, 0], escala: t.escala ?? [1, 1, 1],
  };
  if (n.tipo === 'grupo' || n.tipo === 'acabamento') n.filhos = (n.filhos ?? []).map(normalizarNo);
  else n.parametros ??= {};
  if (n.tipo === 'acabamento') { n.modo ??= 'fillet'; n.medida ??= 1; n.arestas ??= []; }
  return n;
}

export function carregarDocumento(texto) {
  let doc;
  try { doc = JSON.parse(texto); } catch { throw new Error(tr('O arquivo não é um projeto Anvil3D válido (JSON corrompido).')); }
  if (doc.formato === 'forja3d') doc.formato = FORMATO; // projetos do nome antigo
  if (doc.formato !== FORMATO) throw new Error(tr('O arquivo não é um projeto Anvil3D.'));
  if (doc.versao > VERSAO) throw new Error(tt`Projeto salvo numa versão mais nova do formato (${doc.versao}). Atualize o Anvil3D.`);
  while (doc.versao < VERSAO) {
    const m = migracoes[doc.versao];
    if (!m) throw new Error(`Sem migração da versão ${doc.versao} do formato.`);
    doc = m(doc);
  }
  doc.objetos = (doc.objetos ?? []).map(normalizarNo);
  return doc;
}

export const serializar = doc => JSON.stringify(doc, null, 2);

export function novoAcabamento(alvo, modo, medida, arestas, transformacao) {
  return {
    id: novoId(), nome: `${tr(modo === 'chanfro' ? 'Chanfro' : 'Fillet')} ${medida} mm`,
    tipo: 'acabamento', modo, medida, arestas, furo: alvo.furo, cor: alvo.cor, transformacao, filhos: [alvo],
  };
}

export function novaMalha(nome, cor) {
  return { id: novoId(), nome, tipo: 'malha', furo: false, cor, transformacao: transformacaoPadrao(), malha: null };
}

// Peça da biblioteca (.nvl3dpeca; antes .anvilpeca): a forma pronta (malha) + a receita completa que a gerou.
export const FORMATO_PECA = 'anvil3d-peca';
export function serializarPeca(nome, malha, receita, cor, miniatura) {
  return JSON.stringify({ formato: FORMATO_PECA, versao: VERSAO, nome, cor, miniatura, malha, receita });
}
export function lerPeca(texto) {
  let p;
  try { p = JSON.parse(texto); } catch { throw new Error(tr('arquivo de peça corrompido')); }
  if (p.formato !== FORMATO_PECA || !p.malha?.v) throw new Error(tr('não é uma peça do Anvil3D'));
  p.receita = (p.receita ?? []).map(normalizarNo);
  return p;
}

export function clonarComNovosIds(no) {
  const c = structuredClone(no);
  (function renomear(n) { n.id = novoId(); (n.filhos ?? []).forEach(renomear); })(c);
  return c;
}
