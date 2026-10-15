# Anvil3D

Fontes do texto 3D: DejaVu (licença livre, ver app/vendor/LICENSE-dejavu.txt); leitura de fontes com opentype.js (MIT).

Criado por Luiz Pacheco (luizgpf@gmail.com) · © 2026 · https://nobetteridea.com · https://github.com/lgpf/anvil3d

CAD local no estilo Tinkercad. O projeto `.nvl3d` guarda a árvore de construção inteira
(formas, parâmetros, sólido/furo, grupos, transformações). O STL é só exportação.

## Usar
Descompacte `Anvil3D-<versão>-windows-x64.zip` e rode `Anvil3D.exe`.
Projetos e plugins ficam em `Documentos\Anvil3D`.

Mouse: botão direito gira a vista, botão do meio arrasta, roda dá zoom. Clique seleciona,
Shift+clique soma à seleção.

Atalhos: Ctrl+N/O/S, Ctrl+Shift+S, Ctrl+E (STL), Ctrl+Z/Y, Ctrl+D, Ctrl+G, Ctrl+Shift+G,
Ctrl+C/V (funciona entre janelas), Ctrl+A, Del, H (sólido/furo), J (juntar faces), T (triângulos), Ctrl+I (importar STL), F (enquadrar), Home (iso),
setas movem em X/Y, Ctrl+setas em Z, Esc limpa a seleção. F12 abre o console (útil para plugins).

Campos numéricos aceitam vírgula e contas: `45/2`, `10+3,5`.

## Ajuda
**Ajuda** (F1) abre o manual com todas as funções. Os **?** ao lado dos títulos do painel
mostram uma dica rápida daquela parte, com link para a seção do manual. **Sobre** mostra a
versão e o autor.


## Fillet e chanfro
Selecione um objeto e clique em **Fillet…** ou **Chanfro…** no painel. As arestas ficam
destacadas; clique para marcar (ou use Todas / Do topo / Verticais). A prévia mostra em
vermelho o material que sai e em verde o que entra nos cantos internos. Enter aplica.

O acabamento vira um item da árvore: dá para mudar a medida, trocar as arestas, editar os
parâmetros da forma de dentro (o fillet acompanha) ou remover. Funciona em arestas retas e
em bordas circulares (cilindros, furos, cones). Onde três fillets se encontram o canto fica
com uma pequena quina. A Caixa e o Cilindro também têm bordas arredondadas nos parâmetros.

## Juntar faces e junções
Selecione a peça, aperte **J**, clique na face dela e na face da outra peça: ela encosta e fica
**presa**. Opcionalmente, clique numa aresta de cada uma para alinhar a rotação. Depois disso,
arrastar a peça com o mouse a faz deslizar sobre a outra (acompanhando curvas); se a outra se
move, ela vai junto; ao redimensionar, a face de contato continua encostada. O painel tem giro na
face, afastamento, alinhar arestas e soltar junção.

## Malhas: triângulos, vértices e simplificação
**Triângulos** (tecla T) mostra a malha de todas as peças. **Importar STL** (Ctrl+I) traz uma
malha de fora. Qualquer peça pode virar malha em **Converter em malha editável**; a versão
paramétrica fica guardada e **Voltar ao paramétrico** a restaura.

Em **Editar triângulos e vértices**: clique marca triângulos (Face plana expande para o plano
todo; Del apaga) ou vértices (Shift soma; mova pelo gizmo ou digitando a posição).
**Fechar buracos** tampa as aberturas para a malha voltar a funcionar em grupos e furos.
**Simplificar** reduz os triângulos por colapso de arestas com erro quádrico (meshoptimizer),
com alvo em % e desvio máximo opcional em mm.

## Consolidar e biblioteca de peças
**Consolidar** (Ctrl+K) funde a seleção, ou tudo, numa peça única e leve, com a receita
guardada dentro: **Voltar à receita** devolve os objetos originais, editáveis.
**Salvar na biblioteca** grava a peça em `Documentos\Anvil3D\pecas` (`.nvl3dpeca`); ela aparece
em **Minhas peças** para inserir pronta em qualquer projeto.

## Reparar para impressão
Toda malha mostra a seção **Impressão 3D**: buracos, arestas malformadas, normais invertidas,
duplicados e peças separadas. **Reparar para impressão** solda vértices, remove degenerados e
duplicados, acerta as normais, fecha buracos, remove fragmentos e une cascas sobrepostas num
corpo só. A importação e a exportação de STL avisam quando algo precisa de reparo ou quando a
peça não está apoiada no plano.

## Idioma
Português (padrão) ou inglês em **Ajuda › Português / English**; a interface e o manual trocam
na hora. Para desenvolver: textos novos são escritos em português com `tr('...')` ou
``tt`... ${x}` `` e a versão em inglês vai em `app/core/i18n.mjs`; o manual em inglês é
`app/ajuda-en.html`. O teste `test/ui-idioma.js` varre a tela em inglês procurando restos em
português.

## Desenvolver
    npm install
    npm start            # roda o app
    npm test             # testes do núcleo (geometria, formato, STL)
    npm run dist         # gera instalador + portátil (no Windows)

Com push na branch `main`, o GitHub Actions gera o instalador e o portátil (aba Actions →
artefato `Anvil3D-windows`). Com uma tag `v0.2.0`, publica também uma Release.

## Estrutura
- `main.js`, `preload.js`: janela, arquivos, protocolo `app://` e pasta de plugins.
- `app/core/`: núcleo sem interface (formato com migrações, motor Manifold, histórico, STL).
- `app/principal.mjs`: interface 3D.
- `plugins/`: formas internas; usam a mesma API dos plugins do usuário (veja `plugins/LEIA-ME.md`).

## Apoie o projeto

O Anvil3D é gratuito. Se ele te ajudou, considere apoiar o desenvolvimento: https://ko-fi.com/anvil3d

## Licença

O Anvil3D é software livre sob a **GNU General Public License v3.0 ou posterior** (arquivo `LICENSE`).
Plugins que usam apenas a API pública de plugins podem usar qualquer licença — veja `EXCECAO-PLUGINS.md`.
