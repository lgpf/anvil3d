# Como pedir a uma IA uma forma nova para o Anvil3D

Copie tudo a partir da linha "INÍCIO DO PEDIDO" e cole em qualquer IA (Claude, ChatGPT, Gemini…).
No fim, troque o texto entre colchetes pela descrição da forma que você quer. Salve a resposta
como arquivo `.mjs` em `Documentos\Anvil3D\plugins` e clique em **Recarregar** no Anvil3D.

---------------------------------------------------------------------- INÍCIO DO PEDIDO

Você vai escrever um plugin de forma paramétrica para o Anvil3D, um CAD local que usa a biblioteca
de geometria Manifold (manifold-3d, em JavaScript). Siga TODAS as regras abaixo.

## Formato da resposta
- Responda com UM único bloco de código JavaScript (módulo ES), sem explicações antes ou depois.
- Na primeira linha, um comentário com o nome sugerido do arquivo, ex.: `// suporte-l.mjs`.
- O objeto do plugin TEM que ser exportado exatamente assim: `export default { ... };` (não use `export const`, `module.exports` nem `exports.`).
- Não use `import`, `require`, `fetch`, DOM, arquivos nem bibliotecas externas: só o que vem em `ctx`.

## Contrato do plugin (os nomes dos campos são em português e obrigatórios)
```js
export default {
  api: 1,                         // sempre 1
  id: 'meu.nome-da-forma',        // único, minúsculas, sem espaços; use prefixo "meu."
  nome: 'Nome em português',
  categoria: 'Meus plugins',
  icone: '◆',                     // um caractere
  cor: '#3a86c8',                 // cor da miniatura e das peças novas
  versao: '1.0.0',
  descricao: 'Uma frase dizendo o que a forma é',
  en: {                           // textos em inglês
    nome: 'Name in English', categoria: 'My plugins', descricao: '...',
    rotulos: { /* chave: 'Label' para cada parâmetro */ },
    opcoes: { /* valor: 'Label' para cada opção dos parâmetros de opção */ },
  },
  parametros: [ /* veja abaixo */ ],
  gerar(p, ctx) { /* devolve UM Manifold */ },
};
```

## Parâmetros
Cada item de `parametros` é um objeto com `chave` (identificador), `rotulo` (texto em português) e `padrao`
(valor inicial que já gera uma peça bonita e válida). Tipos:
- número (padrão): `{ chave: 'largura', rotulo: 'Largura (mm)', padrao: 30, min: 1, max: 500 }`;
  use `inteiro: true` para contagens e `casas: 1` para mostrar só uma casa decimal.
- `{ tipo: 'booleano', ... padrao: false }` — caixa de marcar.
- `{ tipo: 'opcao', opcoes: [['a', 'Leve'], ['b', 'Reforçado']], padrao: 'a' }`.
- `{ tipo: 'texto', ... padrao: '' }`.
- `{ tipo: 'pontos', ... padrao: '0,0\n10,0\n0,10' }` — lista "x, y" por linha; converta com `ctx.pontos(p.chave)`.
  Acrescente `editor: 'plano'` (polígono livre) ou `editor: 'revolucao'` (perfil r, z ao lado de um eixo)
  para o usuário poder desenhar a lista num editor 2D.
Prefira parâmetros com significado físico (medidas em mm, ângulos em graus, quantidades) a escalas genéricas.

## gerar(p, ctx)
- `p` traz os valores dos parâmetros. `ctx` traz: `Manifold`, `CrossSection`, `segmentos(raio)` (número
  bom de lados para um círculo daquele raio) e `pontos(texto)` (converte o tipo 'pontos' em [[x, y], ...]).
- Unidades em milímetros. A peça deve ficar CENTRADA em X e Y e APOIADA em Z = 0 (nada abaixo de zero).
- Devolva um único sólido fechado (Manifold). Nunca devolva vazio: se os valores forem impossíveis,
  lance um erro curto em português explicando, ex.: `throw new Error('o furo é maior que a peça')`.
- Valide as combinações de parâmetros (furo maior que o diâmetro, espessura maior que a peça, etc.).
- Chame `.delete()` nos sólidos e seções intermediários que não forem devolvidos (libera memória).
- Use `ctx.segmentos(r)` para cilindros, esferas e círculos, em vez de números fixos.

## API do Manifold (só use estas)
Sólidos (`Manifold`):
- `Manifold.cube([x, y, z], centrado)`; `Manifold.cylinder(altura, raioBase, raioTopo, lados)` (base em z=0);
  `Manifold.sphere(raio, lados)` (centro na origem); `Manifold.hull([sólidos ou pontos [x,y,z]])`.
- `Manifold.union([...])`, `Manifold.difference([a, b, ...])`, `Manifold.intersection([...])`.
- `Manifold.extrude(secao, altura, divisoes, torcaoGraus, [escalaX, escalaY])` (a escala do topo sempre como par [x, y]), `Manifold.revolve(secao, lados, graus)`.
- Métodos: `.translate([x, y, z])`, `.rotate([gx, gy, gz])` (graus), `.scale([x, y, z])`, `.mirror([nx, ny, nz])`,
  `.add(b)`, `.subtract(b)`, `.intersect(b)`, `.hull()`, `.boundingBox()` (→ {min, max}), `.trimByPlane([nx,ny,nz], d)`.
Seções 2D (`CrossSection`):
- `new CrossSection([[ [x,y], [x,y], ... ]], 'NonZero')` (polígonos; o segundo argumento aceita qualquer sentido),
  `CrossSection.square([x, y], centrado)`, `CrossSection.circle(raio, lados)`.
- Métodos: `.translate([x, y])`, `.rotate(graus)`, `.scale([x, y])`, `.mirror([nx, ny])`,
  `.offset(distancia, 'Round' | 'Square' | 'Miter', 2, lados)`, `.add(b)`, `.subtract(b)`, `.intersect(b)`, `.hull()`,
  `.extrude(altura, divisoes, torcao, [escalaX, escalaY])`, `.revolve(lados, graus)`.
- `revolve` gira a seção em torno do eixo Y dela, que vira o Z do sólido (x = raio, y = altura).

## Exemplo completo (arruela com chanfro opcional)
```js
// arruela.mjs
export default {
  api: 1, id: 'meu.arruela', nome: 'Arruela', categoria: 'Meus plugins', icone: '◌', cor: '#b8a03a', versao: '1.0.0',
  descricao: 'Arruela lisa com chanfro opcional na borda',
  en: { nome: 'Washer', categoria: 'My plugins', descricao: 'Flat washer with optional edge chamfer',
        rotulos: { externo: 'Outer diameter', interno: 'Inner diameter', espessura: 'Thickness', chanfro: 'Edge chamfer' } },
  parametros: [
    { chave: 'externo', rotulo: 'Diâmetro externo', padrao: 16, min: 0.1 },
    { chave: 'interno', rotulo: 'Diâmetro interno', padrao: 8.4, min: 0 },
    { chave: 'espessura', rotulo: 'Espessura', padrao: 1.6, min: 0.1 },
    { chave: 'chanfro', rotulo: 'Chanfro na borda', tipo: 'booleano', padrao: false },
  ],
  gerar(p, { Manifold, segmentos }) {
    const re = p.externo / 2, ri = p.interno / 2, h = p.espessura;
    if (ri >= re) throw new Error('o furo é maior que a arruela');
    const c = p.chanfro ? Math.min(h / 3, (re - ri) / 3) : 0;
    const corpo = c > 0
      ? Manifold.union([Manifold.cylinder(h - c, re, re, segmentos(re)), Manifold.cylinder(c, re, re - c, segmentos(re)).translate([0, 0, h - c])])
      : Manifold.cylinder(h, re, re, segmentos(re));
    const furo = Manifold.cylinder(h + 2, ri, ri, segmentos(re)).translate([0, 0, -1]);
    const r = corpo.subtract(furo);
    corpo.delete(); furo.delete();
    return r;
  },
};
```

## Antes de responder, confira
1. Com os valores `padrao`, a peça é válida, fechada, centrada em X/Y e apoiada em Z = 0.
2. Todos os parâmetros têm `rotulo` em português e um rótulo em `en.rotulos`.
3. Nada além de `ctx` é usado; não há `import`.
4. Intermediários recebem `.delete()`.

## A forma que eu quero
[DESCREVA AQUI A FORMA: para que serve, medidas principais, o que deve ser ajustável, detalhes como furos,
encaixes, chanfros, textos de exemplo de uso. Quanto mais concreto, melhor.]
