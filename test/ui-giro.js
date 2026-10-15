const { app } = require('electron');
const fs = require('fs');
for (const s of ['enable-unsafe-swiftshader', 'ignore-gpu-blocklist']) app.commandLine.appendSwitch(s);
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.on('browser-window-created', (_, w) => {
  w.webContents.on('console-message', e => { if (e.level !== 'info' && !/Security Warning/.test(e.message)) console.log('[console]', e.level, e.message); });
  w.webContents.on('did-finish-load', async () => {
    const espera = ms => new Promise(r => setTimeout(r, ms));
    const js = c => w.webContents.executeJavaScript(c);
    const caixa = i => js(`(()=>{const F=window.__anvil; const m=F.malhas.get(F.estado.doc.objetos[${i}].id); m.updateMatrixWorld(true); const b=new F.THREE.Box3().setFromObject(m,true); return 'centro '+b.getCenter(new F.THREE.Vector3()).toArray().map(v=>v.toFixed(1)).join(',')+' | min z '+b.min.z.toFixed(1);})()`);
    const girarGizmo = (eixo, graus) => js(`(()=>{const F=window.__anvil, g=F.gizmo, o=g.object; g.dispatchEvent({type:'mouseDown'}); o.rotateOnWorldAxis(new F.THREE.Vector3(${eixo}), ${graus}*Math.PI/180); o.updateMatrixWorld(true); g.dispatchEvent({type:'objectChange'}); g.dispatchEvent({type:'mouseUp'});})()`);
    await espera(2500);
    await js(`window.__anvil.moverPeca(false)`);
    await js(`localStorage.setItem('teste:origem','1'); localStorage.setItem('pivo','centro')`);
    try {
      // 1. cilindro deitado: o giro é em torno do centro da peça, não da base
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Cilindro')).click()`); await espera(300);
      await js(`window.__anvil.estado.pivo='centro'; window.__anvil.selecionar([window.__anvil.estado.doc.objetos[0].id]); document.querySelector('[data-cmd=alternarGizmo]').click()`); await espera(300);
      console.log('antes:', await caixa(0), '| gizmo em', await js(`window.__anvil.gizmo.object.position.toArray().join(',')`));
      await girarGizmo('1,0,0', 90); await espera(400);
      console.log('girado 90° em X:', await caixa(0), '| rotação', await js(`window.__anvil.estado.doc.objetos[0].transformacao.rotacao.join(',')`));
      // 2. peça presa: gira só em torno da normal do contato e continua presa
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(300);
      await js(`(()=>{const F=window.__anvil, [cil, cx]=F.estado.doc.objetos; cx.parametros.largura=10; cx.parametros.profundidade=4; cx.parametros.altura=4; cx.juncao={alvo:cil.id, ponto:[0,0,20], normal:[0,0,1], giro:0, afastamento:0, face:{normal:[0,0,-1], centro:[0,0,0]}};})()`);
      await js(`window.__anvil.selecionar([window.__anvil.estado.doc.objetos[0].id]); window.__anvil.selecionar([window.__anvil.estado.doc.objetos[1].id])`); await espera(300);
      await js(`document.querySelector('[data-cmd=alternarGizmo]').click()`); await espera(300); // peça nova chega no modo mover; volta para girar
      console.log('presa — anéis visíveis X/Y/Z:', await js(`(()=>{const g=window.__anvil.gizmo; return [g.showX,g.showY,g.showZ].join('/')+' modo '+g.mode+' anexado '+!!g.object;})()`));
      const n = await js(`(()=>{const F=window.__anvil; const q=F.gizmo.object.quaternion; return new F.THREE.Vector3(0,0,1).applyQuaternion(q).toArray().map(v=>v.toFixed(2)).join(',');})()`);
      await girarGizmo(n, 30); await espera(400);
      console.log('giro na face:', await js(`window.__anvil.estado.doc.objetos[1].juncao?.giro`), '| ainda presa?', await js(`!!window.__anvil.estado.doc.objetos[1].juncao`), '|', await js(`document.querySelector('#msg').textContent`));
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
