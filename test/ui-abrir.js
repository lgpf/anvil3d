const { app } = require('electron');
const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => {
  w.webContents.on('console-message', e => { if (e.level !== 'info' && !/Security Warning/.test(e.message)) console.log('[console]', e.level, e.message); });
  w.webContents.on('did-finish-load', async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const js = c => w.webContents.executeJavaScript(c);
    await espera(2500);
    try {
      const pasta = await js(`(async()=>{const l=await window.anvil.listarProjetos(); return l.dirPasta;})()`);
      fs.rmSync(pasta + '/meus projetos', { recursive: true, force: true }); fs.mkdirSync(pasta + '/meus projetos', { recursive: true });
      for (const f of fs.readdirSync(pasta)) if (/\.(anvil|forja)$/.test(f)) fs.unlinkSync(pasta + '/' + f);
      // projeto com descrição, salvo pelo app
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Toroide')).click()`); await espera(200);
      await js(`document.querySelector('[data-cmd=propriedades]').click()`); await espera(300);
      await js(`(()=>{const t=document.querySelector('#modal textarea'); t.value='Suporte de teste para o toroide, 20 mm.'; document.querySelector('#modal .primario').click();})()`); await espera(200);
      await js(`(async()=>{await window.anvil.salvar(${JSON.stringify(pasta + '/meus projetos/toroide.anvil')}, window.__anvil.serializarComMiniatura());})()`);
      fs.writeFileSync(pasta + '/velho.forja', '{}');
      await js(`window.__anvil.estado.sujo = false; document.querySelector('[data-cmd=abrir]').click()`); await espera(1000);
      console.log('locais:', await js(`[...document.querySelectorAll('.abrir-local')].map(b=>b.textContent).join(' | ')`));
      console.log('na pasta do Anvil3D:', await js(`[...document.querySelectorAll('.abrir-conteudo > button')].map(b=>b.textContent).join(' | ')`));
      await js(`[...document.querySelectorAll('.abrir-pasta')].find(b=>b.textContent.includes('meus projetos')).click()`); await espera(500);
      console.log('trilha:', await js(`document.querySelector('.abrir-caminho').innerText.replace(/\\n/g,' ')`), '| itens:', await js(`[...document.querySelectorAll('.abrir-conteudo > button')].map(b=>b.textContent).join(' | ')`));
      await js(`document.querySelector('.abrir-conteudo .abrir-arquivo').click()`); await espera(800);
      console.log('descrição na prévia:', await js(`document.querySelector('.abrir-descricao').textContent`));
      fs.writeFileSync('/tmp/shots/55-abrir.png', (await w.webContents.capturePage()).toPNG());
      await js(`[...document.querySelectorAll('.abrir-lado button')].find(b=>b.textContent==='Abrir').click()`); await espera(600);
      console.log('aberto com descrição:', await js(`window.__anvil.estado.doc.descricao`));
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
