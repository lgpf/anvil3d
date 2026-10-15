const { app } = require('electron');
const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
fs.mkdirSync('/tmp/shots', { recursive: true });
app.on('browser-window-created', (_, w) => {
  w.webContents.on('console-message', e => { if (e.level !== 'info' && !/Security Warning/.test(e.message)) console.log('[console]', e.level, e.message); });
  w.webContents.on('did-finish-load', async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const js = c => w.webContents.executeJavaScript(c);
    const campo = (rot, val) => js(`(()=>{const c=[...document.querySelectorAll('#propriedades .campo')].find(c=>c.textContent.startsWith(${JSON.stringify(rot)})); const i=c.querySelector('input,select'); i.value=${JSON.stringify(String(val))}; i.dispatchEvent(new Event('change'));})()`);
    const xyz = (k, i, v) => js(`(()=>{const x=document.querySelectorAll('#propriedades .xyz')[${k}].querySelectorAll('input')[${i}]; x.value='${v}'; x.dispatchEvent(new Event('change'));})()`);
    await espera(2500);
    await js(`localStorage.setItem('teste:origem','1'); localStorage.setItem('arestaContinua','1')`);
    try {
      // cilindro com uma esfera "comida" pela lateral: a borda do corte é uma curva livre feita de muitos trechos retos
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Cilindro')).click()`); await espera(200);
      await campo('Diâmetro', 40); await campo('Altura', 30); await espera(200);
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Esfera')).click()`); await espera(200);
      await campo('Diâmetro', 30); await xyz(0, 0, 22); await xyz(0, 2, 8); await espera(200);
      await js(`[...document.querySelectorAll('#propriedades .segmentado button')].find(b=>b.textContent==='Furo').click()`); await espera(200);

      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['control'] }); await espera(200);
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'G', modifiers: ['control'] }); await espera(600);
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Fillet…').click()`); await espera(600);

      const info = await js(`(()=>{const F=window.__anvil, ma=F.modoAresta; const retas=ma.feicoes.map((f,i)=>[f,i]).filter(([f])=>f.tipo==='reta');
        // um trecho curto (da curva do corte) virado para a câmera
        const [f,i]=retas.filter(([f])=>Math.hypot(f.b[0]-f.a[0],f.b[1]-f.a[1],f.b[2]-f.a[2])<3).sort((x,y)=>y[0].a[2]-x[0].a[2])[0];
        const p=new F.THREE.Vector3((f.a[0]+f.b[0])/2,(f.a[1]+f.b[1])/2,(f.a[2]+f.b[2])/2).applyMatrix4(F.grupoArestas.matrixWorld).project(F.camera);
        const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [retas.length, i, r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height];})()`);
      console.log('trechos retos no objeto:', info[0]);
      const [x, y] = [Math.round(info[2]), Math.round(info[3])];
      w.webContents.sendInputEvent({ type: 'mouseMove', x, y }); await espera(250);
      console.log('destacados ao passar o mouse:', await js(`window.__anvil.modoAresta.hoverSet?.size`));
      for (const t of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type: t, x, y, button: 'left', clickCount: 1 });
      await espera(500);
      console.log('marcados com um clique:', await js(`window.__anvil.modoAresta.sel.size`), '|', await js(`document.querySelector('#msg').textContent`));
      fs.writeFileSync('/tmp/shots/46-continua.png', (await w.webContents.capturePage()).toPNG());
      // Alt+clique: só um trecho
      for (const t of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type: t, x, y, button: 'left', clickCount: 1, modifiers: ['alt'] });
      await espera(400);
      console.log('depois de Alt+clique (desmarca um trecho):', await js(`window.__anvil.modoAresta.sel.size`));
      for (const t of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type: t, x, y, button: 'left', clickCount: 1, modifiers: ['alt'] });
      await espera(300);
      await js(`[...document.querySelectorAll('#propriedades button')].find(b=>b.textContent==='Aplicar').click()`); await espera(2500);
      console.log('aplicado:', await js(`document.querySelector('#msg').textContent`), '| erros:', await js(`window.__anvil.estado.erros.size`), '| avisos:', await js(`[...window.__anvil.estado.avisos.values()].join(';') || 'nenhum'`));
      fs.writeFileSync('/tmp/shots/47-continua-fillet.png', (await w.webContents.capturePage()).toPNG());
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
