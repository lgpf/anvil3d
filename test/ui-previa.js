const { app } = require('electron');
const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => {
  w.webContents.on('console-message', e => { if (e.level !== 'info' && !/Security Warning/.test(e.message)) console.log('[console]', e.level, e.message); });
  w.webContents.on('did-finish-load', async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const js = c => w.webContents.executeJavaScript(c);
    const campo = (rot, val) => js(`(()=>{const c=[...document.querySelectorAll('#propriedades .campo')].find(c=>c.textContent.startsWith(${JSON.stringify(rot)})); const i=c.querySelector('input'); i.value=${JSON.stringify(String(val))}; i.dispatchEvent(new Event('change'));})()`);
    const malhaPequena = () => js(`(()=>{const F=window.__anvil; const m=F.malhas.get(F.estado.doc.objetos[1].id); return m.position.toArray().map(v=>v.toFixed(1)).join(',');})()`);
    await espera(2500);
    await js(`window.__anvil.moverPeca(false)`);
    await js(`localStorage.setItem('teste:origem','1')`);
    try {
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(200);
      await campo('Largura', 40); await espera(200);
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(200);
      await campo('Largura', 10); await campo('Profundidade', 10); await campo('Altura', 10); await espera(200);
      // prende a pequena no topo da grande, perto da ponta +X
      await js(`(()=>{const F=window.__anvil,[g,p]=F.estado.doc.objetos; p.juncao={alvo:g.id, ponto:[15,0,20], normal:[0,0,1], giro:0, afastamento:0, face:{normal:[0,0,-1], centro:[0,0,0]}};})()`);
      await campo('Altura', 10); await espera(400);
      console.log('pequena presa em:', await malhaPequena());
      // seleciona a grande e gira 90° em Z pelo gizmo (eventos do próprio gizmo)
      await js(`(()=>{const F=window.__anvil; F.estado.sel=[F.estado.doc.objetos[0].id];})()`);
      await js(`document.querySelector('[data-cmd=desfazer]')`); // nada
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); await espera(100);
      await js(`(()=>{const F=window.__anvil; F.estado.sel=[F.estado.doc.objetos[0].id];})()`);
      await js(`(()=>{const F=window.__anvil; F.selecionar([F.estado.doc.objetos[0].id]); document.querySelector('[data-cmd=alternarGizmo]').click();})()`); await espera(200);
      await js(`(()=>{const F=window.__anvil, g=F.gizmo; g.dispatchEvent({type:'mouseDown'}); g.object.rotation.z = Math.PI/2; g.object.updateMatrix(); g.dispatchEvent({type:'objectChange'});})()`); await espera(200);
      console.log('durante o giro (antes de soltar):', await malhaPequena());
      await js(`window.__anvil.gizmo.dispatchEvent({type:'mouseUp'})`); await espera(400);
      console.log('depois de soltar:', await malhaPequena(), '| pequena no documento:', await js(`window.__anvil.estado.doc.objetos[1].transformacao.posicao.join(',')`));
      // redimensiona a grande pela cota de X: a pequena acompanha (comprimento 40 -> 60)
      // (via alterar direto no estado, como faz a alça)
      // Shift+J com a pequena selecionada
      await js(`(()=>{const F=window.__anvil; F.estado.sel=[F.estado.doc.objetos[1].id];})()`);
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'J', modifiers: ['shift'] }); await espera(300);
      console.log('Shift+J:', await js(`document.querySelector('#msg').textContent`), '| ainda presa?', await js(`!!window.__anvil.estado.doc.objetos[1].juncao`));
      console.log('menu tem Soltar junção:', await js(`!!document.querySelector('.menu-itens [data-cmd=soltarJuncao]')`));
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
