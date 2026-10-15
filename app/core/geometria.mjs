// Motor de geometria: avalia a árvore de construção com o Manifold (WASM).
// Funciona tanto no app quanto no Node (usado pelos testes).
import { contornosDoTexto } from './texto.mjs';
import { compor, ehIdentidade } from './transform.mjs';
import { lerPontos } from './plugins.mjs';
import { tr, tt } from './i18n.mjs';
import { lerMalha, paraManifold, bordas } from './malha.mjs';
import { extrairArestas, casarArestas, aplicarAcabamento } from './arestas.mjs';

export class MotorGeometria {
  constructor(wasm, registro) {
    this.wasm = wasm; this.registro = registro;
    this.cache = new Map();
    this.resolucao = 0.5; // mm por segmento em curvas
    const self = this;
    this.ctx = {
      Manifold: wasm.Manifold, CrossSection: wasm.CrossSection, Mesh: wasm.Mesh,
      segmentos(raio, min = 16) {
        return Math.max(min, Math.min(360, Math.ceil((2 * Math.PI * Math.abs(raio)) / self.resolucao / 4) * 4));
      },
      pontos: lerPontos,
      // texto 3D: contornos por letra; a fonte vem de quem usa o motor (definirFontes)
      texto(nomeFonte, texto, opcoes) {
        if (!self.fontes) throw new Error('nenhuma fonte disponível');
        return contornosDoTexto(self.fontes(nomeFonte), texto, opcoes);
      },
    };
  }

  definirFontes(f) { this.fontes = f; }
  limparCache() { for (const m of this.cache.values()) m.delete(); this.cache.clear(); }
  definirResolucao(r) { if (r !== this.resolucao) { this.resolucao = r; this.limparCache(); } }
  iniciarPassada() { if (this.cache.size > 400) this.limparCache(); }

  chave(no) {
    if (no.tipo === 'grupo') return 'g' + JSON.stringify(no.filhos.map(f => [this.chave(f), f.furo, f.transformacao]));
    if (no.tipo === 'malha') return 'm' + no.malha.rev;
    if (no.tipo === 'acabamento') return 'a' + JSON.stringify([this.chave(no.filhos[0]), no.filhos[0].transformacao, no.modo, no.medida, no.arestas]);
    return 'f' + JSON.stringify([no.gerador, no.parametros]);
  }

  // Sólido no referencial local do nó (sem a transformação dele). Pertence ao cache: não chame delete().
  local(no) {
    const k = this.chave(no);
    let m = this.cache.get(k);
    if (!m) { m = this.construir(no); this.cache.set(k, m); }
    return m;
  }

  construir(no) {
    const { Manifold } = this.wasm;
    if (no.tipo === 'grupo') {
      // cada peça folha ganha um ID de origem; o mapa ID -> caminho ("0/2") permite pintar o grupo
      // com as cores das peças (o caminho não depende das cores, então o cache continua valendo)
      const solidos = [], furos = [], caminhos = new Map();
      no.filhos.forEach((f, i) => {
        let w = this.mundo(f);
        const sub = this.local(f).caminhos;
        if (sub && (f.tipo !== 'grupo' || f.multicor !== false)) for (const [k, c] of sub) caminhos.set(k, i + '/' + c);
        else { const o = w.asOriginal(); w.delete(); w = o; caminhos.set(w.originalID(), String(i)); }
        (f.furo ? furos : solidos).push(w);
      });
      const s = Manifold.union(solidos);
      solidos.forEach(m => m.delete());
      let r = s;
      if (furos.length) {
        const h = Manifold.union(furos);
        furos.forEach(m => m.delete());
        r = s.subtract(h); s.delete(); h.delete();
      }
      r.caminhos = caminhos;
      return r;
    }
    if (no.tipo === 'malha') {
      const d = lerMalha(no);
      try { return paraManifold(this.wasm, d); }
      catch {
        const b = bordas(d).length;
        throw new Error(b ? tt`Malha aberta (${b} arestas soltas): use "Fechar buracos" para usá-la em grupos e furos`
          : tr('Malha com defeito (auto-interseção ou arestas com mais de duas faces)'));
      }
    }
    if (no.tipo === 'acabamento') {
      const base = this.mundo(no.filhos[0]);
      try {
        const feicoes = extrairArestas(base);
        const { indices, faltando } = casarArestas(feicoes, no.arestas);
        const { solido, erros } = aplicarAcabamento(this.wasm, base, indices.map(i => feicoes[i]), no.modo, no.medida, this.ctx.segmentos);
        const avisos = [...(faltando ? [tt`${faltando} aresta(s) não encontrada(s) depois da mudança`] : []), ...new Set(erros.map(x => tr(x)))];
        if (avisos.length) solido.avisoAnvil = avisos.join('; ');
        const sub = this.local(no.filhos[0]).caminhos;
        if (sub) solido.caminhos = new Map([...sub].map(([k, c]) => [k, '0/' + c]));
        return solido;
      } finally { base.delete(); }
    }
    const g = this.registro.obter(no.gerador);
    if (!g) throw new Error(tt`Gerador "${no.gerador}" não está instalado`);
    let r;
    try { r = g.gerar({ ...no.parametros }, this.ctx); }
    catch (e) { throw new Error(`${tr(g.nome)}: ${tr(String(e.message ?? e))}`); }
    if (!r || typeof r.getMesh !== 'function') throw new Error(tt`${tr(g.nome)}: gerar() não devolveu um sólido`);
    if (r.isEmpty()) { r.delete(); throw new Error(tt`${tr(g.nome)}: a forma ficou vazia com esses valores`); }
    return r;
  }

  // Sólido já transformado para o referencial do pai. Novo objeto: quem chama deve dar delete().
  mundo(no) {
    const l = this.local(no);
    return ehIdentidade(no.transformacao) ? l.translate([0, 0, 0]) : l.transform(compor(no.transformacao));
  }

  // União de todos os sólidos de primeiro nível (furos soltos não cortam, como no Tinkercad).
  resultadoFinal(objetos) {
    const solidos = objetos.filter(o => !o.furo).map(o => this.mundo(o));
    const r = this.wasm.Manifold.union(solidos);
    solidos.forEach(m => m.delete());
    return r;
  }
}

export function dadosMalha(manifold) {
  const m = manifold.getMesh();
  const n = m.numProp, nv = m.vertProperties.length / n;
  let pos = m.vertProperties;
  if (n !== 3) {
    pos = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) { pos[i * 3] = m.vertProperties[i * n]; pos[i * 3 + 1] = m.vertProperties[i * n + 1]; pos[i * 3 + 2] = m.vertProperties[i * n + 2]; }
  }
  return { posicoes: pos, indices: m.triVerts, runIndex: m.runIndex, runOriginalID: m.runOriginalID };
}
