# Exceção para plugins / Plugin exception

**Português**

O Anvil3D é distribuído sob a GNU General Public License, versão 3 ou (a seu critério) qualquer versão
posterior (veja o arquivo `LICENSE`).

Como exceção adicional (seção 7 da GPL-3.0), Luiz Pacheco, autor do Anvil3D, concede a seguinte permissão:

> Plugins de formas e outros módulos que se comunicam com o Anvil3D **apenas pela API pública de plugins**
> (os arquivos `.mjs` carregados da pasta de plugins, que recebem os parâmetros e o objeto `ctx` e devolvem
> uma geometria) **não são considerados obras derivadas do Anvil3D** e podem ser distribuídos sob **qualquer
> licença**, inclusive fechada, comercial ou de domínio público.

Isto vale também para formas geradas com ajuda de IA a partir do guia `plugins/GERAR-FORMAS-COM-IA.md`.
A exceção não se aplica a alterações no próprio código do Anvil3D (pastas `app/`, `main.js`, `preload.js`
e os plugins internos da pasta `plugins/`), que continuam sob a GPL.

**English**

Anvil3D is distributed under the GNU General Public License, version 3 or (at your option) any later version
(see the `LICENSE` file).

As an additional permission (section 7 of the GPL-3.0), Luiz Pacheco, author of Anvil3D, grants the following:

> Shape plugins and other modules that talk to Anvil3D **only through the public plugin API** (the `.mjs`
> files loaded from the plugins folder, which receive the parameters and the `ctx` object and return a
> geometry) **are not considered derivative works of Anvil3D** and may be distributed under **any license**,
> including closed-source, commercial or public domain.

This also applies to shapes generated with AI help from the `plugins/GENERATE-SHAPES-WITH-AI.md` guide.
The exception does not apply to changes to Anvil3D's own code (the `app/` folder, `main.js`, `preload.js`
and the built-in plugins in the `plugins/` folder), which remain under the GPL.
