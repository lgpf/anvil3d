const { app } = require('electron');
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
    await js(`localStorage.removeItem('teste:origem')`);
    try {
      await js(`document.querySelector('[data-cmd=vistaIso]').click()`); await espera(300);
      // arrasta a Esfera para o ponto (40, 150) da mesa
      const r = await js(`(()=>{const F=window.__anvil; const p=new F.THREE.Vector3(40,150,0).project(F.camera); const c=document.querySelector('#vista canvas').getBoundingClientRect(); return [c.left+(p.x+1)/2*c.width, c.top+(1-p.y)/2*c.height];})()`);
      await js(`(()=>{const t=[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Esfera')); const dt=new DataTransfer();
        t.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));
        const v=document.querySelector('#vista');
        v.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:${r[0]},clientY:${r[1]}}));
        v.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:${r[0]},clientY:${r[1]}}));
        t.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}));})()`);
      await espera(400);
      console.log('esfera solta em:', await js(`window.__anvil.estado.doc.objetos.at(-1).transformacao.posicao.join(',')`), '|', await js(`document.querySelector('#msg').textContent`));
      // solta uma caixa em cima da esfera? (topo de uma face para cima) — em cima de outra caixa
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(300);
      const r2 = await js(`(()=>{const F=window.__anvil; const p=new F.THREE.Vector3(103,104,20).project(F.camera); const c=document.querySelector('#vista canvas').getBoundingClientRect(); return [c.left+(p.x+1)/2*c.width, c.top+(1-p.y)/2*c.height];})()`);
      await js(`(()=>{const t=[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Cone')); const dt=new DataTransfer();
        t.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));
        const v=document.querySelector('#vista');
        v.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:${r2[0]},clientY:${r2[1]}}));
        window.__fantasma = window.__anvil.cena.children.filter(o=>o.isMesh&&o.renderOrder===55&&o.visible).length;
        v.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:${r2[0]},clientY:${r2[1]}}));})()`);
      await espera(400);
      console.log('fantasma visível durante o arraste:', await js('window.__fantasma'));
      console.log('cone solto (sempre em Z=0):', await js(`window.__anvil.estado.doc.objetos.at(-1).transformacao.posicao.join(',')`));
      // revolução de perfil desenhada no sentido horário
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Revolução')).click()`); await espera(300);
      await js(`(()=>{const F=window.__anvil, o=F.estado.doc.objetos.at(-1); o.parametros.perfil='0,0\\n0,24\\n8,24\\n5,20\\n6,4\\n12,2\\n12,0'; F.selecionar([o.id]);})()`);
      await js(`(()=>{const i=[...document.querySelectorAll('#propriedades .campo')].find(c=>c.textContent.startsWith('Ângulo inicial')).querySelector('input'); i.value='0'; i.dispatchEvent(new Event('change'));})()`); await espera(500);
      console.log('perfil horário: erros', await js(`window.__anvil.estado.erros.size`), '| triângulos da peça', await js(`window.__anvil.malhas.get(window.__anvil.estado.doc.objetos.at(-1).id).geometry.attributes.position.count/3`));
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
