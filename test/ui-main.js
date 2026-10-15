// Teste de fumaça da interface: xvfb-run electron test/ui-main.js
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
    const clicarBotao = t => js(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(t)} || b.querySelector(':scope > span')?.textContent.trim()===${JSON.stringify(t)}).click()`);
    const campo = (rot, val) => js(`(()=>{const c=[...document.querySelectorAll('#propriedades .campo')].find(c=>c.textContent.startsWith(${JSON.stringify(rot)})); const i=c.querySelector('input,select'); i.value=${JSON.stringify(val)}; i.dispatchEvent(new Event('change'));})()`);
    const msg = () => js(`document.querySelector('#msg').textContent`);
    await espera(2500);
    await w.webContents.executeJavaScript("localStorage.setItem('teste:origem','1')");
    try {
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(300);
      await clicarBotao('Fillet…'); await espera(400);
      console.log('modo:', await msg());
      // clique real numa aresta: projeta o meio de uma aresta vertical e clica no canvas
      const xy = await js(`(()=>{const F=window.__anvil, ma=F.modoAresta; const i=ma.feicoes.findIndex(f=>f.tipo==='reta'&&Math.abs(f.a[2]-f.b[2])>1&&f.a[0]>0&&f.a[1]<0);
        const f=ma.feicoes[i]; const p=new F.THREE.Vector3((f.a[0]+f.b[0])/2,(f.a[1]+f.b[1])/2,(f.a[2]+f.b[2])/2).applyMatrix4(F.grupoArestas.matrixWorld).project(F.camera);
        const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height, i];})()`);
      for (const type of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type, x: Math.round(xy[0]), y: Math.round(xy[1]), button: 'left', clickCount: 1 });
      await espera(400);
      console.log('clique na aresta', xy[2], '-> marcadas:', await js(`[...window.__anvil.modoAresta.sel].join(',')`));
      await clicarBotao('Do topo'); await espera(300);
      await campo('Raio', '3'); await espera(500);
      console.log('contagem:', await js(`document.querySelector('.contagem').textContent`));
      await foto('4-previa-fillet');
      await clicarBotao('Aplicar'); await espera(600);
      console.log('aplicado:', await msg(), '| painel:', await js(`document.querySelector('#propriedades h2').textContent`));
      await campo('Altura (Z)', '35'); await espera(600);
      console.log('após mudar altura, aviso:', await js(`document.querySelector('.caixa-aviso')?.textContent ?? 'nenhum'`));
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      await foto('5-fillet-aplicado');
      // chanfro por cima num cilindro com furo (tubo)
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Tubo')).click()`); await espera(300);
      await js(`(()=>{const i=document.querySelectorAll('#propriedades .xyz')[0].querySelectorAll('input')[0]; i.value='35'; i.dispatchEvent(new Event('change'));})()`); await espera(300);
      await clicarBotao('Chanfro…'); await espera(400);
      await clicarBotao('Todas'); await campo('Distância', '1,5'); await espera(400);
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      await foto('6-previa-chanfro-tubo');
      await clicarBotao('Aplicar'); await espera(500);
      await foto('7-final');
      console.log('final:', await msg());
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
