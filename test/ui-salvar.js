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
    // abre todas as categorias da biblioteca
    for (let k = 0; k < 2; k++) { await w.webContents.executeJavaScript(`[...document.querySelectorAll('.cat-titulo.fechada')].forEach(b=>b.click())`); await new Promise(r => setTimeout(r, 200)); }
    try {
      const pasta = await js(`(async()=>{const l=await window.anvil.listarProjetos(); return l.dirPasta;})()`);
      for (const f of fs.readdirSync(pasta)) if (/\.(anvil|nvl3d)$/.test(f)) fs.unlinkSync(pasta + '/' + f);
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Engrenagem')).click()`); await espera(300);
      // Salvar (projeto novo) abre a janela
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'S', modifiers: ['control'] }); await espera(1000);
      console.log('janela:', await js(`document.querySelector('#modal h2').textContent`), '| nome sugerido:', await js(`document.querySelector('#modal .abrir-lado input').value`), '| prévia:', await js(`!!document.querySelector('#modal .abrir-lado img')`));
      await js(`(()=>{const i=document.querySelector('#modal .abrir-lado input'); i.value='engrenagem do relógio'; const t=document.querySelector('#modal textarea'); t.value='Engrenagem de 20 dentes, módulo 1,5.'; [...document.querySelectorAll('#modal button')].find(b=>b.textContent==='Salvar').click();})()`); await espera(800);
      console.log('salvo:', await js(`document.querySelector('#msg').textContent`), '| arquivo existe:', fs.existsSync(pasta + '/engrenagem do relógio.nvl3d'));
      // Ctrl+S de novo: salva direto, sem janela
      await js(`window.__anvil.estado.sujo=true`); w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'S', modifiers: ['control'] }); await espera(600);
      console.log('Ctrl+S com arquivo: janela aberta?', !(await js(`document.querySelector('#modal').hidden`)));
      // Salvar como: descrição vem preenchida
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'S', modifiers: ['control', 'shift'] }); await espera(1000);
      console.log('Salvar como — descrição:', await js(`document.querySelector('#modal textarea').value`), '| pasta inicial:', await js(`document.querySelector('.abrir-caminho').innerText.replace(/\\n/g,' ')`));
      fs.writeFileSync('/tmp/shots/56-salvar.png', (await w.webContents.capturePage()).toPNG());
      await js(`(()=>{const i=document.querySelector('#modal .abrir-lado input'); i.value='engrenagem v2'; [...document.querySelectorAll('#modal button')].find(b=>b.textContent==='Salvar').click();})()`); await espera(800);
      console.log('arquivos:', fs.readdirSync(pasta).filter(f => f.endsWith('.nvl3d')).join(', '), '| descrição gravada no v2:', JSON.parse(fs.readFileSync(pasta + '/engrenagem v2.nvl3d', 'utf8')).descricao);
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
