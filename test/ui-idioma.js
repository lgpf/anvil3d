const { app } = require('electron');
const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
fs.mkdirSync('/tmp/shots', { recursive: true });
// procura texto visível que ainda esteja em português (acentos ou palavras comuns)
const VARRER = `(() => {
  const pt = /[ãõçáéíóúâêôà]|\\b(da|do|para|com|não|peça|objeto|clique|arestas?|mesa|selecione|furo|sólido|malha|passo)\\b/i;
  const achados = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const e = n.parentElement; if (!n.data.trim() || e.closest('[lang="pt"], #lista-formas .peca, input, textarea, kbd, .sobre a, .guia-ia, .abrir-descricao, .abrir-arquivo, .abrir-nome-p, .abrir-info b, .abrir-trilha')) continue;
    if (e.closest('.menu-itens[hidden]') && false) continue;
    if (pt.test(n.data)) achados.add(n.data.trim().slice(0, 90));
  }
  for (const e of document.querySelectorAll('[title]')) if (pt.test(e.title) && !e.title.includes('.com') && !e.closest('[lang="pt"]')) achados.add('title: ' + e.title.slice(0, 80));
  return [...achados];
})()`;
app.on('browser-window-created', (_, w) => {
  w.webContents.on('console-message', e => { if (e.level !== 'info' && !/Security Warning/.test(e.message)) console.log('[console]', e.level, e.message); });
  w.webContents.on('did-finish-load', async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const js = c => w.webContents.executeJavaScript(c);
    const foto = async n => fs.writeFileSync(`/tmp/shots/${n}.png`, (await w.webContents.capturePage()).toPNG());
    const cmd = c => js(`document.querySelector('[data-cmd=${c}]').click()`);
    const sobras = new Set();
    const vistos = new Set(); const varrer = async rotulo => { for (const x of await js(VARRER)) if (!vistos.has(x)) { vistos.add(x); sobras.add(rotulo + ' » ' + x); } };
    await espera(2500);
    // abre todas as categorias da biblioteca
    for (let k = 0; k < 2; k++) { await w.webContents.executeJavaScript(`[...document.querySelectorAll('.cat-titulo.fechada')].forEach(b=>b.click())`); await new Promise(r => setTimeout(r, 200)); }
    await w.webContents.executeJavaScript("localStorage.setItem('teste:origem','1')");
    try {
      console.log('padrão:', await js(`document.querySelector('.menu-titulo').textContent`), '| status:', await js(`document.querySelector('#msg').textContent`));
      await cmd('idiomaEn'); await espera(400);
      console.log('inglês:', await js(`[...document.querySelectorAll('.menu-titulo')].map(b=>b.textContent).join(' ')`), '| status:', await js(`document.querySelector('#msg').textContent`));
      await varrer('vazio');
      for (const forma of ['Box', 'Cylinder', 'Wedge', 'Simple gear', 'Profile Revolve', 'Washer']) {
        await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes(${JSON.stringify(forma)})).click()`); await espera(250);
        await varrer(forma);
      }
      await foto('31-ingles');
      await js(`document.querySelectorAll('.menu-titulo')[2].click()`); await espera(200); await varrer('menu Objeto'); await foto('32-menu-en');
      await js(`document.querySelectorAll('.menu-titulo')[2].click()`);
      await js(`window.__anvil.estado.sel=[window.__anvil.estado.doc.objetos[0].id]`);
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['control'] }); await espera(300); await varrer('vários');
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); await espera(200);
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Box')).click()`); await espera(250);
      await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Fillet…').click()`); await espera(300); await varrer('fillet');
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); await espera(200);
      await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Convert to editable mesh').click()`); await espera(300); await varrer('malha');
      await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Edit triangles and vertices').click()`); await espera(300); await varrer('editar malha');
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); await espera(200);
      for (const d of ['tipo', 'malha', 'impressao', 'simplificar', 'consolidar', 'posicao', 'tamanho', 'pivo', 'passo', 'passoGiro', 'resolucao', 'formas']) {
        await js(`document.querySelector('[data-dica=${d}]')?.click()`); await espera(80); await varrer('dica ' + d);
        await js(`document.body.click()`);
      }
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Revolve')).click()`); await espera(300);
      await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent.includes('Draw profile')).click()`); await espera(400); await varrer('editor 2D');
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); await js(`document.querySelector('#modal [data-fechar]')?.click()`); await espera(200);
      await js(`window.__anvil.estado.sel = window.__anvil.estado.doc.objetos.map(o=>o.id)`); await cmd('alinhar'); await espera(300); await varrer('alinhar');
      await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Done')?.click()`); await espera(200);
      await cmd('guiaIA'); await espera(500); await varrer('guia IA'); await js(`document.querySelector('#modal [data-fechar]').click()`); await espera(200);
      await js(`window.__anvil.estado.sujo=false`); await cmd('abrir'); await espera(800); await varrer('abrir'); await js(`document.querySelector('#modal [data-fechar]').click()`); await espera(200);
      await cmd('salvarComo'); await espera(800); await varrer('salvar como'); await js(`document.querySelector('#modal [data-fechar]').click()`); await espera(200);
      await cmd('sobre'); await espera(300); await varrer('sobre'); await foto('33-sobre-en');
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); await espera(200);
      await cmd('ajuda'); await espera(1000);
      console.log('manual:', await js(`document.querySelector('#modal iframe').getAttribute('src')`), '|', await js(`document.querySelector('#modal iframe').contentDocument.querySelector('h2').textContent`));
      await foto('34-manual-en');
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); await espera(200);
      console.log('restos em português:', sobras.size); for (const x of sobras) console.log('   ', x);
      await cmd('idiomaPt'); await espera(300);
      console.log('de volta:', await js(`[...document.querySelectorAll('.menu-titulo')].map(b=>b.textContent).join(' ')`), '|', await js(`document.querySelector('#propriedades h2').textContent`));
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
