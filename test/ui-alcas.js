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
    const mover = async (x, y, b) => { w.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y), ...(b ? { button: 'left', modifiers: ['leftButtonDown'] } : {}) }); await espera(120); };
    const arrastar = async (de, para) => {
      await mover(...de); w.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(de[0]), y: Math.round(de[1]), button: 'left', clickCount: 1 }); await espera(120);
      for (let k = 1; k <= 6; k++) await mover(de[0] + (para[0] - de[0]) * k / 6, de[1] + (para[1] - de[1]) * k / 6, true);
      w.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(para[0]), y: Math.round(para[1]), button: 'left', clickCount: 1 }); await espera(500);
    };
    const tela = v => js(`(()=>{const F=window.__anvil; const p=new F.THREE.Vector3(${v}).project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height];})()`);
    const est = () => js(`(()=>{const o=window.__anvil.estado.doc.objetos[0]; return 'pos='+o.transformacao.posicao.join(',')+' escala='+o.transformacao.escala.join(',')+' | cotas: '+[...document.querySelectorAll('#cotas .cota')].map(c=>c.textContent).join(' / ');})()`);
    for (let i = 0; i < 80 && !(await js(`document.querySelectorAll('.forma').length`)); i++) await espera(250);
  await js(`window.__anvil.moverPeca(false)`);
    await js(`window.__anvil.alcasLaterais(true)`);
    await w.webContents.executeJavaScript("localStorage.setItem('teste:origem','1')");
    try {
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(300);
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      await js(`document.querySelector('[data-cmd=vistaIso]').click()`); await espera(300);
      console.log('inicial:', await est(), '| alças:', await js(`window.__anvil.cena.children.find(g=>g.children?.[0]?.userData?.alca)?.children.length`));
      await foto('25-alcas');
      // alça x+ (meio da aresta de baixo, lado +X) arrastada 10 mm em X
      await arrastar(await tela('10,0,0'), await tela('20,0,0'));
      console.log('alça x+ +10:', await est());
      // cota: digita a altura
      await js(`window.__anvil.mostrarCotas(); (()=>{const c=[...document.querySelectorAll('#cotas .cota')][2]; c.click();})()`); await espera(200);
      await js(`(()=>{const i=document.querySelector('#cotas input'); i.value='35'; i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));})()`); await espera(500);
      console.log('cota Z = 35:', await est());
      // clicar no corpo e arrastar não move mais (só pelo gizmo)
      await arrastar(await tela('8,-10,20'), await tela('38,10,20'));
      console.log('arrasto pelo corpo (não deve mover):', await est());
      await foto('26-depois');
      // o "?" ao lado de Agrupar não estica
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Esfera')).click()`); await espera(200);
      await js(`window.__anvil.estado.sel = window.__anvil.estado.doc.objetos.map(o=>o.id)`);
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['control'] }); await espera(300);
      console.log('largura do ? ao lado de Agrupar:', await js(`[...document.querySelectorAll('#propriedades .botoes')].find(d=>d.textContent.includes('Agrupar')).querySelector('.interrog').getBoundingClientRect().width`));
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
