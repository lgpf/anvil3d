# Anvil3D

[English](README.md) · **Português**

O **Anvil3D** é um CAD 3D gratuito e local para **Windows e macOS**, feito para impressão 3D — no
espírito do Tinkercad, mas rodando no seu computador, sem conta e sem internet.

As peças são montadas combinando **sólidos e furos**, com **histórico editável**: cada forma guarda
os seus parâmetros, e dá para voltar e mudar qualquer medida a qualquer momento. O projeto `.nvl3d`
guarda a árvore de construção inteira; STL, OBJ e 3MF são só a exportação.

[⬇ Baixar a última versão](https://github.com/lgpf/anvil3d/releases) · [♥ Apoie no Ko-fi](https://ko-fi.com/anvil3d)

## Recursos

- **Biblioteca de formas em categorias**: básicos, poliedros (inclusive a bola de futebol), símbolos,
  fixadores (parafusos com rosca de verdade, porcas, arruelas), mecânica (engrenagens, cremalheiras,
  polias, molas), encaixes (pinos, rabo de andorinha, juntas esféricas), recipientes e geradores
  (extrusão, revolução de perfil, tubo curvo, SVG).
- **Sólidos e furos**, grupos, grupos multicoloridos e prévia em tempo real do que o furo vai cortar.
- **Fillet e chanfro** em arestas retas e curvas, com linha contínua e cadeia de tangentes. Em peças
  extrudadas (texto, SVG, polígonos) o acabamento é calculado pelo contorno, limpo e rápido, com aviso
  quando a medida é grande demais para as partes finas.
- **Texto 3D** com fontes internas e do Windows, em volta de um cilindro ou **aplicado em qualquer
  face** (rampas, cúpulas, peças curvas, o lado de dentro de tubos), acompanhando a superfície.
- **Importar SVG** como peça extrudada e editável; **importar e exportar STL, OBJ e 3MF** (o 3MF guarda
  uma peça por objeto, cada uma com a sua cor; o STL também pode sair um arquivo por objeto).
- **Juntar faces**, alinhar, espelhar, redimensionar várias peças juntas, mover arrastando (como no Tinkercad).
- **Edição de malha**, simplificação e **reparo para impressão**.
- **Plugins**: crie formas novas em JavaScript — ou peça para uma IA escrever, com o guia incluído.
- Interface e manual em **português e inglês**.

## Como começar

Baixe a última versão em [Releases](https://github.com/lgpf/anvil3d/releases):

| Sistema | Arquivo | Como usar |
|---|---|---|
| Windows | `Anvil3D-Instalador-<versão>.exe` | Instala e cria atalhos. |
| Windows | `Anvil3D-<versão>-windows-x64.zip` | Sem instalar: descompacte em qualquer pasta e rode `Anvil3D.exe`. |
| Windows | `Anvil3D-Portatil-<versão>.exe` | Um arquivo só, roda direto (ex.: de um pendrive). Demora mais para abrir, porque se descompacta a cada vez. |
| macOS 13 ou mais novo | `Anvil3D-Mac-<versão>.dmg` | Abra e arraste o Anvil3D para Aplicativos (Intel e Apple Silicon). |

Projetos, plugins e peças salvas ficam em `Documentos\Anvil3D` (no Mac, `Documentos/Anvil3D`).

**Avisos na primeira vez.** O Anvil3D não tem assinatura paga da Microsoft nem da Apple, então os
sistemas desconfiam dele no começo:
- **Windows:** se o navegador disser que o arquivo é perigoso, escolha **Manter**. Ao abrir, se aparecer
  "O Windows protegeu o computador", clique em **Mais informações › Executar assim mesmo**.
- **Mac:** clique com o botão direito no Anvil3D e escolha **Abrir**. Se o macOS disser que o app está
  "danificado", rode no Terminal: `xattr -cr /Applications/Anvil3D.app`

**Mouse:** botão direito gira a vista, botão do meio arrasta, roda dá zoom. Clique seleciona,
Shift+clique soma à seleção. As setas movem a peça seguindo a vista. **F1** abre o manual completo; os
**?** do painel mostram dicas rápidas. No Mac, os atalhos usam ⌘ no lugar de Ctrl (⌘+clique soma à seleção).

Menu **Preferências**: mover arrastando, alças laterais, tamanho da mesa (200–300 mm) e idioma.

## Desenvolver

    npm install
    npm start            # roda o app
    npm test             # testes do núcleo (geometria, formato, STL)
    npm run dist         # gera os pacotes para Windows (instalador, zip e portátil)
    npm run dist:mac     # gera o app para macOS (precisa de um Mac; no GitHub Actions é automático)

Estrutura:
- `main.js`, `preload.js` — janela, arquivos, protocolo `app://` e pasta de plugins.
- `app/core/` — núcleo sem interface (formato com migrações, motor de geometria Manifold, histórico, STL/OBJ/3MF).
- `app/principal.mjs` — interface 3D.
- `plugins/` — formas internas, com a mesma API dos plugins do usuário (veja `plugins/LEIA-ME.md` e
  `plugins/GERAR-FORMAS-COM-IA.md`).

Feito com Electron, three.js, Manifold, meshoptimizer e opentype.js; fontes DejaVu.

## Apoie o projeto

O Anvil3D é gratuito. Se ele te ajudou, considere apoiar o desenvolvimento:
**[ko-fi.com/anvil3d](https://ko-fi.com/anvil3d)**

## Licença

O Anvil3D é software livre sob a **GNU General Public License v3.0 ou posterior** (arquivo `LICENSE`).
Plugins que usam apenas a API pública de plugins podem usar **qualquer licença** — veja `EXCECAO-PLUGINS.md`.

Criado por **Luiz Pacheco** · luizgpf@gmail.com · [nobetteridea.com](https://nobetteridea.com) · © 2026
