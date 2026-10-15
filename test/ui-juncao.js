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
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(300);
      await campo('Largura', 60); await campo('Profundidade', 40); await campo('Altura', 10); await espera(300);
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(300);
      await campo('Largura', 10); await campo('Profundidade', 10); await campo('Altura', 10);
      await xyz(0, 0, 80); await xyz(2, 2, 30); await espera(300);
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'J' }); await espera(200);
      await clicar(...await tela(local(1, 5, 1, 5)));
      await clicar(...await tela(`new F.THREE.Vector3(10, 5, 10)`));
      console.log('1)', await msg());
      console.log('   pequena:', await estado(1), '| caixa', await caixaMundo(1));
      // alinhar arestas: aresta da pequena no plano de contato e a aresta de cima-frente da grande (y=-20)
      const al = await js(`(()=>{const A=window.__anvil.alinhar; const io=A.fo.findIndex(f=>Math.abs(f.a.z-10)<0.01&&Math.abs(f.b.z-10)<0.01); const ia=A.fa.findIndex(f=>Math.abs(f.a.y+20)<0.01&&Math.abs(f.b.y+20)<0.01&&f.a.z>9&&f.b.z>9); return [io, ia, A.fo[io].a.clone().add(A.fo[io].b).multiplyScalar(0.5).toArray(), A.fa[ia].a.clone().add(A.fa[ia].b).multiplyScalar(0.5).toArray()];})()`);
      await clicar(...await tela(`new F.THREE.Vector3(${al[2].join(',')})`));
      await clicar(...await tela(`new F.THREE.Vector3(${al[3].join(',')})`));
      console.log('2)', await msg());
      console.log('   pequena:', await estado(1), '| caixa', await caixaMundo(1));
      await foto('21-alinhada');
      // deslizar: arrasta a peça pelo topo da grande e depois para a lateral da frente (y = -20)
      const ini = await tela(local(1, 0, 0, 0).replace('new F.THREE.Vector3(0,0,0)', 'new F.THREE.Vector3(0,0,0)'));
      const pIni = await tela(`new F.THREE.Vector3(3,-12,20)`);
      await mover(...pIni);
      w.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(pIni[0]), y: Math.round(pIni[1]), button: 'left', clickCount: 1 }); await espera(150);
      for (const p of [[-5, -5, 10], [-15, -10, 10], [-20, -20, 6]]) await mover(...await tela(`new F.THREE.Vector3(${p.join(',')})`), true);
      const fim = await tela(`new F.THREE.Vector3(-20,-20,6)`);
      w.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(fim[0]), y: Math.round(fim[1]), button: 'left', clickCount: 1 }); await espera(500);
      console.log('3) deslizou para a lateral da frente:', await estado(1), '| caixa', await caixaMundo(1));
      await foto('22-lateral');
      // a grande se move: a pequena acompanha
      await js(`window.__anvil.estado.sel=[window.__anvil.estado.doc.objetos[0].id]`);
      w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); await espera(200);
      await clicar(...await tela(`new F.THREE.Vector3(20, 10, 10)`));
      await xyz(0, 0, 25); await espera(400);
      console.log('4) grande movida +25 em X; pequena:', await caixaMundo(1));
      // a pequena cresce: a face presa continua encostada
      await clicar(...await tela(local(1, 0, 0, 5)));
      await campo('Altura', 30); await espera(400);
      console.log('5) pequena com altura 30:', await caixaMundo(1));
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      await foto('23-final');
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
