// Processo principal do Electron: janela, arquivos, plugins e protocolo app://
const { app, BrowserWindow, protocol, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain; charset=utf-8',
};

const pastaUsuario = () => path.join(app.getPath('documents'), 'Anvil3D');
const pastaPecas = () => path.join(pastaUsuario(), 'pecas');
const pastaPluginsUsuario = () => path.join(pastaUsuario(), 'plugins');

function resolverUrl(u) {
  const url = new URL(u);
  let p = decodeURIComponent(url.pathname);
  let base = __dirname;
  if (p.startsWith('/user-plugins/')) { base = pastaPluginsUsuario(); p = p.slice('/user-plugins'.length); }
  const completo = path.normalize(path.join(base, p));
  return completo.startsWith(path.normalize(base)) ? completo : null;
}

function prepararPastaPlugins() {
  const dir = pastaPluginsUsuario();
  if (fs.existsSync(dir)) {
    // guias novos chegam também para quem já tem a pasta
    for (const g of ['GERAR-FORMAS-COM-IA.md', 'GENERATE-SHAPES-WITH-AI.md', 'LEIA-ME.md'])
      if (!fs.existsSync(path.join(dir, g))) try { fs.copyFileSync(path.join(__dirname, 'plugins', g), path.join(dir, g)); } catch {}
    return;
  }
  const antiga = path.join(app.getPath('documents'), 'Forja3D', 'plugins'); // nome anterior do projeto
  if (fs.existsSync(antiga)) { fs.cpSync(antiga, dir, { recursive: true }); return; }
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'app', 'exemplo-plugin.mjs'), path.join(dir, 'arruela.mjs'));
  for (const g of ['LEIA-ME.md', 'GERAR-FORMAS-COM-IA.md', 'GENERATE-SHAPES-WITH-AI.md']) fs.copyFileSync(path.join(__dirname, 'plugins', g), path.join(dir, g));
}

function listarMjs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return listarMjs(f);
    return e.name.endsWith('.mjs') ? [f] : [];
  });
}

function arquivoInicial(argv) {
  return argv.slice(1).find(a => /\.(nvl3d|anvil)$/i.test(a) && fs.existsSync(a)) || null;
}

// textos dos diálogos do sistema (o idioma vem da janela)
let idioma = 'pt';
const TXT = {
  pt: { projeto: 'Projeto Anvil3D', stl: 'Malha STL', salvar: 'Salvar', naoSalvar: 'Não salvar', cancelar: 'Cancelar', pergunta: t => `Salvar as alterações em ${t}?` },
  en: { projeto: 'Anvil3D project', stl: 'STL mesh', salvar: 'Save', naoSalvar: "Don't save", cancelar: 'Cancel', pergunta: t => `Save changes to ${t}?` },
};
const txt = () => TXT[idioma];
let janela, estado = { sujo: false, titulo: 'Anvil3D' }, fecharForcado = false;

function criarJanela() {
  janela = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600, title: 'Anvil3D', show: false, backgroundColor: '#e3e8ea', icon: path.join(__dirname, 'app', 'icone.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  janela.once('ready-to-show', () => janela.show());
  janela.loadURL('app://anvil/app/index.html');
  // links externos (e-mail, sites) abrem fora do programa
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  janela.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^(https?|mailto):/i.test(url)) shell.openExternal(url); } });
  janela.webContents.on('before-input-event', (e, i) => {
    if (i.type === 'keyDown' && i.key === 'F12') janela.webContents.toggleDevTools();
  });
  janela.on('close', e => {
    if (fecharForcado || !estado.sujo) return;
    e.preventDefault();
    const r = dialog.showMessageBoxSync(janela, {
      type: 'question', buttons: [txt().salvar, txt().naoSalvar, txt().cancelar], defaultId: 0, cancelId: 2,
      message: txt().pergunta(estado.titulo),
    });
    if (r === 0) janela.webContents.send('app:salvarEFechar');
    if (r === 1) { fecharForcado = true; janela.close(); }
  });
}

// projetos recentes (guardados na pasta de dados do programa)
const arqRecentes = () => path.join(app.getPath('userData'), 'recentes.json');
function lerRecentes() { try { return JSON.parse(fs.readFileSync(arqRecentes(), 'utf8')).filter(c => fs.existsSync(c)); } catch { return []; } }
function lembrar(caminho) {
  if (!caminho) return;
  const l = [caminho, ...lerRecentes().filter(c => c.toLowerCase() !== caminho.toLowerCase())].slice(0, 12);
  try { fs.writeFileSync(arqRecentes(), JSON.stringify(l)); } catch {}
}
// lê só o começo do arquivo: a miniatura é gravada como primeiro campo do projeto
function infoProjeto(caminho) {
  try {
    const st = fs.statSync(caminho), fd = fs.openSync(caminho, 'r'), buf = Buffer.alloc(Math.min(st.size, 400000));
    fs.readSync(fd, buf, 0, buf.length, 0); fs.closeSync(fd);
    const txt = buf.toString('utf8');
    const m = /"miniatura"\s*:\s*"(data:image\/png;base64,[A-Za-z0-9+/=]+)"/.exec(txt);
    const d = /"descricao"\s*:\s*("(?:[^"\\]|\\.)*")/.exec(txt);
    let descricao = ''; try { descricao = d ? JSON.parse(d[1]) : ''; } catch {}
    return { nome: path.basename(caminho).replace(/\.(nvl3d|anvil)$/i, ''), caminho, data: st.mtimeMs, tamanho: st.size, miniatura: m ? m[1] : null, descricao };
  } catch { return null; }
}
function projetosDaPasta(dir, prof = 0) {
  if (!fs.existsSync(dir) || prof > 1) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) return ['plugins', 'pecas'].includes(e.name) ? [] : projetosDaPasta(f, prof + 1);
    return /\.(nvl3d|anvil)$/i.test(e.name) ? [f] : [];
  });
}

// Respostas de IA coladas inteiras: tira as cercas ```js … ``` e o texto antes/depois do código
function limparCodigoColado(t) {
  t = t.replace(/^\uFEFF/, '');
  const cerca = /```(?:javascript|js|mjs)?[^\n]*\n([\s\S]*?)```/i.exec(t);
  if (cerca && /export\s+default|gerar\s*\(/.test(cerca[1])) return cerca[1];
  return t;
}

const FILTRO_PROJETO = () => [{ name: txt().projeto, extensions: ['nvl3d', 'anvil'] }];

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  try { prepararPastaPlugins(); } catch (e) { console.error(e); }

  protocol.handle('app', async req => {
    const f = resolverUrl(req.url);
    if (!f) return new Response('proibido', { status: 403 });
    try {
      let dados = await fs.promises.readFile(f);
      if (/\.mjs$/i.test(f) && f.startsWith(pastaPluginsUsuario())) dados = Buffer.from(limparCodigoColado(dados.toString('utf8')));
      return new Response(dados, { headers: { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' } });
    } catch { return new Response('não encontrado', { status: 404 }); }
  });

  ipcMain.handle('plugins:listar', () => {
    const internos = listarMjs(path.join(__dirname, 'plugins')).map(f => ({
      url: 'app://anvil/' + path.relative(__dirname, f).split(path.sep).join('/'), origem: 'interno',
    }));
    const base = pastaPluginsUsuario();
    const usuario = listarMjs(base).map(f => ({
      url: 'app://anvil/user-plugins/' + path.relative(base, f).split(path.sep).join('/') + '?v=' + fs.statSync(f).mtimeMs,
      origem: 'usuario', ...(() => { const t = fs.readFileSync(f, 'utf8'); return { vazio: !t.trim(), pedido: /##\s*(A forma que eu quero|The shape I want)/i.test(t) }; })(),
    }));
    return [...internos, ...usuario];
  });
  ipcMain.handle('plugins:abrirPasta', () => { prepararPastaPlugins(); return shell.openPath(pastaPluginsUsuario()); });

  ipcMain.handle('arquivo:abrir', async () => {
    const r = await dialog.showOpenDialog(janela, { filters: FILTRO_PROJETO(), properties: ['openFile'] });
    if (r.canceled) return null;
    lembrar(r.filePaths[0]);
    return { caminho: r.filePaths[0], texto: await fs.promises.readFile(r.filePaths[0], 'utf8') };
  });
  ipcMain.handle('arquivo:ler', async (_, c, lembrarTambem) => { if (lembrarTambem) lembrar(c); return { caminho: c, texto: await fs.promises.readFile(c, 'utf8') }; });
  // navegador de pastas da janela Abrir
  ipcMain.handle('pasta:locais', () => {
    const unidades = process.platform === 'win32'
      ? 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => l + ':\\').filter(u => { try { return fs.existsSync(u); } catch { return false; } })
      : ['/'];
    const locais = [
      { id: 'anvil', caminho: pastaUsuario() },
      { id: 'documentos', caminho: app.getPath('documents') },
      { id: 'area', caminho: app.getPath('desktop') },
      { id: 'inicio', caminho: app.getPath('home') },
    ].filter(l => fs.existsSync(l.caminho));
    return { locais, unidades, recentes: lerRecentes().map(infoProjeto).filter(Boolean) };
  });
  ipcMain.handle('pasta:listar', (_, dir) => {
    try {
      const itens = fs.readdirSync(dir, { withFileTypes: true });
      const pastas = itens.filter(e => { try { return e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('$'); } catch { return false; } }).map(e => e.name).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const projetos = itens.filter(e => e.isFile() && /\.(nvl3d|anvil)$/i.test(e.name)).map(e => infoProjeto(path.join(dir, e.name))).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      const pai = path.dirname(dir);
      return { dir, pai: pai !== dir ? pai : null, pastas, projetos, sep: path.sep };
    } catch (e) { return { dir, pai: path.dirname(dir), pastas: [], projetos: [], erro: e.message, sep: path.sep }; }
  });
  // fontes instaladas (Windows: pasta Fonts do sistema e do usuário); o nome vem do arquivo
  ipcMain.handle('fontes:sistema', () => {
    const dirs = process.platform === 'win32'
      ? [path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Fonts')]
      : ['/usr/share/fonts', path.join(app.getPath('home'), '.fonts')];
    const achadas = [], visto = new Set();
    const andar = (d, prof = 0) => { try { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory() && prof < 3) andar(f, prof + 1);
      else if (/\.(ttf|otf)$/i.test(e.name)) {
        const nome = e.name.replace(/\.(ttf|otf)$/i, '');
        if (!visto.has(nome.toLowerCase())) { visto.add(nome.toLowerCase()); achadas.push({ nome, caminho: f }); }
      } } } catch {} };
    dirs.forEach(d => andar(d));
    return achadas.sort((a, b) => a.nome.localeCompare(b.nome));
  });
  ipcMain.handle('fontes:ler', async (_, c) => new Uint8Array(await fs.promises.readFile(c)));
  ipcMain.handle('arquivo:existe', (_, c) => fs.existsSync(c));
  ipcMain.handle('projetos:listar', () => {
    const recentes = lerRecentes().map(infoProjeto).filter(Boolean);
    const pasta = projetosDaPasta(pastaUsuario()).map(infoProjeto).filter(Boolean).sort((a, b) => b.data - a.data);
    return { recentes, pasta, dirPasta: pastaUsuario() };
  });
  ipcMain.handle('arquivo:salvar', async (_, caminho, texto) => {
    // grava num temporário e troca, para não corromper o projeto se faltar energia
    const tmp = caminho + '.tmp';
    await fs.promises.writeFile(tmp, texto, 'utf8');
    if (fs.existsSync(caminho)) await fs.promises.copyFile(caminho, caminho + '.bak');
    await fs.promises.rename(tmp, caminho);
    lembrar(caminho);
    return caminho;
  });
  ipcMain.handle('arquivo:salvarComo', async (_, sugestao, texto) => {
    const r = await dialog.showSaveDialog(janela, { defaultPath: path.join(pastaUsuario(), sugestao), filters: FILTRO_PROJETO() });
    if (r.canceled) return null;
    await fs.promises.writeFile(r.filePath, texto, 'utf8');
    lembrar(r.filePath);
    return r.filePath;
  });
  ipcMain.handle('arquivo:exportar', async (_, sugestao, bytes, ext, rotulo) => {
    const r = await dialog.showSaveDialog(janela, { defaultPath: path.join(pastaUsuario(), sugestao), filters: [{ name: rotulo, extensions: [ext] }] });
    if (r.canceled) return null;
    await fs.promises.writeFile(r.filePath, Buffer.from(bytes));
    return r.filePath;
  });
  ipcMain.handle('arquivo:importar', async () => {
    const r = await dialog.showOpenDialog(janela, { filters: [{ name: txt().stl, extensions: ['stl'] }], properties: ['openFile'] });
    if (r.canceled) return null;
    return { nome: path.basename(r.filePaths[0]).replace(/\.stl$/i, ''), bytes: await fs.promises.readFile(r.filePaths[0]) };
  });
  ipcMain.handle('arquivo:importarSvg', async () => {
    const r = await dialog.showOpenDialog(janela, { filters: [{ name: 'SVG', extensions: ['svg'] }], properties: ['openFile'] });
    if (r.canceled) return null;
    return { nome: path.basename(r.filePaths[0]).replace(/\.svg$/i, ''), texto: await fs.promises.readFile(r.filePaths[0], 'utf8') };
  });
  ipcMain.handle('pecas:listar', () => {
    const dir = pastaPecas();
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => /\.(nvl3dpeca|anvilpeca)$/i.test(f))
      .map(f => {
        const caminho = path.join(dir, f);
        let miniatura = null;
        try { miniatura = JSON.parse(fs.readFileSync(caminho, 'utf8')).miniatura ?? null; } catch {}
        return { nome: f.replace(/\.(nvl3dpeca|anvilpeca)$/i, ''), caminho, miniatura };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  });
  ipcMain.handle('pecas:salvar', async (_, nome, texto) => {
    fs.mkdirSync(pastaPecas(), { recursive: true });
    const limpo = String(nome).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'peca';
    const caminho = path.join(pastaPecas(), limpo + '.nvl3dpeca');
    await fs.promises.writeFile(caminho, texto, 'utf8');
    return caminho;
  });
  ipcMain.handle('pecas:abrirPasta', () => { fs.mkdirSync(pastaPecas(), { recursive: true }); return shell.openPath(pastaPecas()); });
  ipcMain.handle('arquivo:exportarVarios', async (_, arquivos) => {
    const r = await dialog.showOpenDialog(janela, { defaultPath: pastaUsuario(), properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled) return null;
    for (const a of arquivos) await fs.promises.writeFile(path.join(r.filePaths[0], path.basename(a.nome)), Buffer.from(a.bytes));
    return r.filePaths[0];
  });
  ipcMain.handle('app:arquivoInicial', () => arquivoInicial(process.argv));
  ipcMain.handle('app:versao', () => require('./package.json').version);
  ipcMain.on('app:estado', (_, s) => {
    estado = s;
    janela?.setTitle(`${s.sujo ? '● ' : ''}${s.titulo} — Anvil3D`);
  });
  ipcMain.on('app:idioma', (_, l) => { idioma = l === 'en' ? 'en' : 'pt'; });
  ipcMain.on('app:fecharAgora', () => { fecharForcado = true; janela?.close(); });

  criarJanela();
});

app.on('window-all-closed', () => app.quit());
