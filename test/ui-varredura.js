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
    await js(`localStorage.setItem('teste:origem','1')`);
    try {
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Esfera')).click()`); await espera(200);
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Extrusão')).click()`); await espera(200);
      await js(`(()=>{const F=window.__anvil,[e,x]=F.estado.doc.objetos; e.parametros.diametro=40; x.parametros.pontos='-4,-30\\n30,-30\\n30,30\\n-4,30'; x.parametros.altura=40; x.parametros.torcao=180; x.furo=true; F.selecionar([e.id,x.id]);})()`);
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'G', modifiers: ['control'] }); await espera(1500);
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(600);
      fs.writeFileSync('/tmp/shots/51-base.png', (await w.webContents.capturePage()).toPNG());
      await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Fillet…').click()`); await espera(1500);
      console.log('ângulos:', await js(`(()=>{const ma=window.__anvil.modoAresta; const h={}; for(const f of ma.feicoes){const k=Math.round((f.angulo??0)/15)*15; h[k]=(h[k]||0)+1;} return JSON.stringify(h);})()`));
      await js(`(()=>{const ma=window.__anvil.modoAresta; ma.sel=new Set(ma.feicoes.map((f,i)=>f.tipo==='reta'&&f.angulo<150?i:-1).filter(i=>i>=0));})()`);
      await js(`(()=>{const i=[...document.querySelectorAll('#propriedades .campo')].find(c=>c.textContent.startsWith('Raio')).querySelector('input'); i.value='1,5'; i.dispatchEvent(new Event('change'));})()`); await espera(3000);
      fs.writeFileSync('/tmp/shots/49-previa-varredura.png', (await w.webContents.capturePage()).toPNG());
      await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Aplicar').click()`); await espera(6000);
      console.log(await js(`document.querySelector('#msg').textContent`), '| erros', await js(`window.__anvil.estado.erros.size`));
      fs.writeFileSync('/tmp/shots/50-varredura.png', (await w.webContents.capturePage()).toPNG());
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
