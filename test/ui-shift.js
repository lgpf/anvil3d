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
    const foto = async n => fs.writeFileSync(`/tmp/shots/${n}.png`, (await w.webContents.capturePage()).toPNG());
    const ev = async (type, x, y, mods = []) => { w.webContents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, modifiers: mods }); await espera(70); };
    const tela = v => js(`(()=>{const F=window.__anvil; const p=new F.THREE.Vector3(${v}).project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height];})()`);
    const est = () => js(`(()=>{const o=window.__anvil.estado.doc.objetos[0]; return 'pos='+o.transformacao.posicao.join(',')+' escala='+o.transformacao.escala.join(',')+' | cotas: '+[...document.querySelectorAll('#cotas .cota')].map(c=>c.textContent).join(' / ');})()`);
    for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`window.__anvil.moverPeca(false)`);
    await js(`window.__anvil.alcasLaterais(true)`);
    await w.webContents.executeJavaScript("localStorage.setItem('teste:origem','1')");
    try {
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(300);
      await js(`document.querySelector('[data-cmd=vistaIso]').click()`); await espera(300);
      // canto x+y- com Shift
      const canto = await tela('10,-10,0'), alvo = await tela('20,-20,0');
      await ev('mouseMove', ...canto);
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Shift', modifiers: ['shift'] }); await espera(200);
      await ev('mouseMove', ...canto, ['shift']);
      console.log('alça sob o mouse com Shift:', await js(`(()=>{const g=window.__anvil.cena.children.find(g=>g.children?.[0]?.userData?.alca); const h=g.children.find(h=>h.userData.alca==='x+y-'); return '#'+h.material.color.getHexString();})()`));
      await foto('41-shift-alca');
      await ev('mouseDown', ...canto, ['shift']);
      for (let k = 1; k <= 6; k++) await ev('mouseMove', canto[0] + (alvo[0] - canto[0]) * k / 6, canto[1] + (alvo[1] - canto[1]) * k / 6, ['shift', 'leftButtonDown']);
      await ev('mouseUp', ...alvo, ['shift']); await espera(300);
      console.log('canto com Shift:', await est());
      console.log('cotas azuis com Shift:', await js(`window.__anvil.mostrarCotas(); document.querySelectorAll('#cotas .cota.proporcional').length`));
      // cota com Shift: altura 15 -> tudo na mesma proporção
      await js(`window.__anvil.mostrarCotas(); (()=>{const c=[...document.querySelectorAll('#cotas .cota')][2]; c.dispatchEvent(new MouseEvent('click',{bubbles:true, shiftKey:true}));})()`); await espera(200);
      console.log('campo proporcional:', await js(`document.querySelector('#cotas input.cota.proporcional') ? 'sim' : 'não'`));
      await js(`(()=>{const i=document.querySelector('#cotas input'); i.value='15'; i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));})()`); await espera(400);
      w.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Shift' }); await espera(200);
      console.log('cota Z=15 proporcional:', await est());
      // mover pelo gizmo: dispara os eventos do próprio gizmo, movendo em X e Z
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      await js(`(()=>{const g=window.__anvil.gizmo; g.dispatchEvent({type:'mouseDown'}); g.object.position.x += 25; g.object.position.y += 10; g.object.position.z += 8; g.dispatchEvent({type:'objectChange'});})()`); await espera(200);
      console.log('durante o arraste, cotas:', await js(`window.__anvil.mostrarCotas(); [...document.querySelectorAll('#cotas-mov .cota-mov')].map(c=>c.textContent).join(' | ')`), '| etiqueta delta visível?', !(await js(`document.querySelector('#cota-mov').hidden`)));
      await js(`document.querySelector('[data-cmd=vistaIso]')`); await espera(900); await foto('42-cotas-mov');
      await js(`window.__anvil.gizmo.dispatchEvent({type:'mouseUp'})`); await espera(300);
      console.log('depois de soltar:', await js(`window.__anvil.mostrarCotas(); document.querySelectorAll('#cotas-mov .cota-mov').length`), 'cotas |', await est());
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
