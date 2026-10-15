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
    const bt = t => js(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(t)} || b.querySelector(':scope > span')?.textContent.trim()===${JSON.stringify(t)}).click()`);
    const campo = (rot, val) => js(`(()=>{const c=[...document.querySelectorAll('#propriedades .campo')].find(c=>c.textContent.startsWith(${JSON.stringify(rot)})); const i=c.querySelector('input,select'); i.value=${JSON.stringify(String(val))}; i.dispatchEvent(new Event('change'));})()`);
    const xyz = (k, i, v) => js(`(()=>{const x=document.querySelectorAll('#propriedades .xyz')[${k}].querySelectorAll('input')[${i}]; x.value='${v}'; x.dispatchEvent(new Event('change'));})()`);
    const msg = () => js(`document.querySelector('#msg').textContent`);
    const mover = async (x, y, botoes) => { w.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y), ...(botoes ? { button: 'left', modifiers: ['leftButtonDown'] } : {}) }); await espera(150); };
    const clicar = async (x, y) => { await mover(x, y); for (const type of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 }); await espera(400); };
    const tela = expr => js(`(()=>{const F=window.__anvil; const p=(${expr}).project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height];})()`);
    const local = (id, x, y, z) => `(()=>{const m=F.malhas.get(F.estado.doc.objetos[${id}].id); m.updateMatrixWorld(true); return new F.THREE.Vector3(${x},${y},${z}).applyMatrix4(m.matrixWorld);})()`;
    const estado = i => js(`(()=>{const o=window.__anvil.estado.doc.objetos[${i}]; return o.nome+' pos='+o.transformacao.posicao.join(',')+' rot='+o.transformacao.rotacao.join(',')+(o.juncao?' giro='+o.juncao.giro:'');})()`);
    const caixaMundo = i => js(`(()=>{const F=window.__anvil; const m=F.malhas.get(F.estado.doc.objetos[${i}].id); m.updateMatrixWorld(true); const b=new F.THREE.Box3().setFromObject(m,true); return [b.min.toArray().map(v=>v.toFixed(2)).join(','), b.max.toArray().map(v=>v.toFixed(2)).join(',')].join(' → ');})()`);
    await espera(2500);
    await w.webContents.executeJavaScript("localStorage.setItem('teste:origem','1')");
    try {
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Cilindro')).click()`); await espera(300);
      await campo('Diâmetro', 40); await campo('Altura', 20); await espera(300);
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(300);
      await campo('Largura', 6); await campo('Profundidade', 6); await campo('Altura', 6); await xyz(0, 0, 60); await espera(300);
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'J' }); await espera(200);
      await clicar(...await tela(local(1, 3, 0.5, 3)));
      await clicar(...await tela(`new F.THREE.Vector3(5, 5, 20)`));
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); await espera(200);
      const pIni = await tela(local(1, 1.8, 1.8, 6));
      await mover(...pIni);
      w.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(pIni[0]), y: Math.round(pIni[1]), button: 'left', clickCount: 1 }); await espera(150);
      const caminho = [[0, -10, 20], [0, -19, 20]];
      for (let a = -90; a <= 0; a += 15) caminho.push([20 * Math.cos(a * Math.PI / 180), 20 * Math.sin(a * Math.PI / 180), 10]);
      for (const p of caminho) await mover(...await tela(`new F.THREE.Vector3(${p.join(',')})`), true);
      const fim = await tela(`new F.THREE.Vector3(20,0,10)`);
      w.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(fim[0]), y: Math.round(fim[1]), button: 'left', clickCount: 1 }); await espera(500);
      console.log('na lateral curva (x=+20):', await caixaMundo(1));
      // normal da face presa em coordenadas do mundo
      console.log('normal da face presa:', await js(`(()=>{const F=window.__anvil; const o=F.estado.doc.objetos[1]; const m=F.malhas.get(o.id); m.updateMatrixWorld(true); return new F.THREE.Vector3(...o.juncao.face.normal).transformDirection(m.matrixWorld).toArray().map(v=>v.toFixed(3)).join(',');})()`));
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300); await foto('24-curva');
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
