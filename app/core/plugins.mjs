// Registro de plugins. API v1: um módulo ES que exporta default { api: 1, tipo: 'gerador', ... }.
// Veja plugins/LEIA-ME.md para o contrato completo.
export const API_PLUGINS = 1;

export class RegistroPlugins {
  constructor() { this.limpar(); }
  limpar() { this.geradores = new Map(); this.erros = []; }

  registrar(def, origem = {}) {
    if (!def || typeof def !== 'object') throw new Error('o módulo não exporta default');
    if (def.api !== API_PLUGINS) throw new Error(`api ${def.api} não suportada (esta versão usa api ${API_PLUGINS})`);
    if ((def.tipo ?? 'gerador') !== 'gerador') throw new Error(`tipo de plugin desconhecido: ${def.tipo}`);
    if (typeof def.id !== 'string' || !/^[a-z0-9._-]+$/i.test(def.id)) throw new Error('id inválido (use letras, números, ponto, hífen)');
    if (typeof def.gerar !== 'function') throw new Error('falta a função gerar(p, ctx)');
    const g = {
      id: def.id, nome: def.nome ?? def.id, categoria: def.categoria ?? 'Outros', icone: def.icone ?? '◆',
      descricao: def.descricao ?? '', versao: def.versao ?? '1.0.0',
      parametros: (def.parametros ?? []).map(p => ({ tipo: 'numero', rotulo: p.chave, ...p })),
      en: def.en ?? null, ordem: Number.isFinite(def.ordem) ? def.ordem : null, cor: typeof def.cor === 'string' ? def.cor : null, gerar: def.gerar, origem: origem.origem ?? 'interno', url: origem.url ?? '',
    };
    if (this.geradores.has(g.id) && g.origem === 'interno') return; // plugin do usuário pode substituir um interno
    this.geradores.set(g.id, g);
  }

  obter(id) { return this.geradores.get(id); }
  lista() { return [...this.geradores.values()]; }
}

export function parametrosPadrao(g) {
  const p = {};
  for (const d of g.parametros) p[d.chave] = d.padrao;
  return p;
}

// Converte texto "x, y" (uma linha por ponto) em [[x,y], ...]
export function lerPontos(txt) {
  return String(txt ?? '').split(/[\n;]+/).map(l => l.trim()).filter(Boolean).map(l => {
    const v = l.split(/[\s,]+/).filter(Boolean).map(Number);
    if (v.length < 2 || v.some(Number.isNaN)) throw new Error(`ponto inválido: "${l}"`);
    return [v[0], v[1]];
  });
}
