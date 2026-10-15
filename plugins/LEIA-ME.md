# Plugins do Anvil3D (API 1)

Um plugin é um arquivo `.mjs` (módulo JavaScript) que ensina uma forma nova ao Anvil3D.
Coloque-o em `Documentos\Anvil3D\plugins` (subpastas valem) e clique em **Recarregar** na
lista de formas. Se o plugin tiver erro, a mensagem aparece embaixo da lista.

```js
export default {
  api: 1,                       // versão do contrato de plugins
  id: 'meu.suporte',            // único e estável: fica gravado nos projetos .nvl3d
  nome: 'Suporte em L',         // nome na lista
  categoria: 'Meus plugins',    // agrupamento na lista
  icone: '⌐',                   // um caractere
  versao: '1.0.0',
  parametros: [
    { chave: 'largura', rotulo: 'Largura', padrao: 30, min: 1 },
    { chave: 'furos', rotulo: 'Furos', padrao: 2, min: 0, inteiro: true },
    { chave: 'chanfro', rotulo: 'Chanfro', tipo: 'booleano', padrao: false },
    { chave: 'modelo', rotulo: 'Modelo', tipo: 'opcao', opcoes: [['a','Leve'],['b','Reforçado']], padrao: 'a' },
    { chave: 'perfil', rotulo: 'Perfil', tipo: 'pontos', padrao: '0,0\n10,0\n0,10' },
  ],
  gerar(p, ctx) {
    // p: valores dos parâmetros. ctx: { Manifold, CrossSection, segmentos(raio), pontos(texto) }
    // Devolva um Manifold. Convenção: centrado em X/Y e apoiado em Z = 0.
    return ctx.Manifold.cube([p.largura, 10, 10], true).translate([0, 0, 5]);
  },
};
```

Textos em inglês (opcional): acrescente um bloco `en` e o plugin aparece traduzido quando o
Anvil3D estiver em inglês.

```js
  en: { nome: 'Bracket', categoria: 'My plugins', descricao: '...',
        rotulos: { largura: 'Width' }, opcoes: { a: 'Light', b: 'Heavy' } },
```

Tipos de parâmetro: `numero` (padrão; aceita `min`, `max`, `inteiro`, `casas`), `booleano`,
`opcao`, `texto` e `pontos` (texto "x, y" por linha; converta com `ctx.pontos(p.perfil)`).

`ctx.Manifold` e `ctx.CrossSection` são a biblioteca Manifold (manifold-3d). Os mais usados:
`Manifold.cube`, `cylinder`, `sphere`, `extrude`, `revolve`, `hull`, `union`, e nos objetos
`.translate`, `.rotate`, `.scale`, `.add`, `.subtract`, `.intersect`. Chame `.delete()` nos
sólidos intermediários que não devolver, para liberar memória.

Regras que mantêm seus projetos seguros:

- Não mude o `id` de um plugin depois de usá-lo em projetos.
- Ao renomear um parâmetro, aceite o nome antigo também (`p.novo ?? p.antigo`).
- Um plugin do usuário com o mesmo `id` de um interno o substitui.
- Se um plugin sumir, o projeto abre mesmo assim: o objeto aparece em vermelho e seus dados
  continuam no arquivo até o plugin voltar.

## Texto e fontes
- Parâmetro `{ tipo: 'fonte', padrao: 'DejaVu Sans Bold' }` mostra a lista de fontes (as do Anvil3D e as instaladas).
- `{ tipo: 'texto', multilinha: true }` vira uma caixa de várias linhas.
- Em `gerar`, `ctx.texto(nomeDaFonte, texto, { tamanho, espacamento })` devolve `{ letras, min, max }`:
  `letras` é uma lista com os contornos de cada letra (use `new CrossSection(contornos, 'EvenOdd')`),
  e `tamanho` é a altura das maiúsculas em mm. Veja `plugins/basicos/texto.mjs`.

---
Anvil3D · © 2026 Luiz Pacheco · luizgpf@gmail.com · https://nobetteridea.com · https://github.com/lgpf/anvil3d

## Licença dos seus plugins

O Anvil3D é GPL-3.0, mas os seus plugins **podem usar qualquer licença** (inclusive fechada ou comercial), desde que usem apenas a API pública de plugins. Detalhes em `EXCECAO-PLUGINS.md`, na pasta do programa.
