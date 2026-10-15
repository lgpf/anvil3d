// Teste da edição de malha: xvfb-run electron test/ui-malha.js
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
    const campo = (rot, val) => js(`(()=>{const c=[...document.querySelectorAll('#propriedades .campo')].find(c=>c.textContent.startsWith(${JSON.stringify(rot)})); const i=c.querySelector('input,select'); i.value=${JSON.stringify(val)}; i.dispatchEvent(new Event('change'));})()`);
    const msg = () => js(`document.querySelector('#msg').textContent`);
    const dica = () => js(`document.querySelector('#propriedades .dica').textContent`);
    const clicar = async (x, y) => { for (const type of ['mouseDown', 'mouseUp']) w.webContents.sendInputEvent({ type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 }); await espera(400); };
    const projetar = expr => js(`(()=>{const F=window.__anvil; const p=(${expr}).project(F.camera); const r=document.querySelector('#vista canvas').getBoundingClientRect(); return [r.left+(p.x+1)/2*r.width, r.top+(1-p.y)/2*r.height];})()`);
    await espera(2500);
    await w.webContents.executeJavaScript("localStorage.setItem('teste:origem','1')");
    try {
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Caixa')).click()`); await espera(300);
      await bt('Converter em malha editável'); await espera(400);
      console.log('convertida:', await js(`[...document.querySelectorAll('#propriedades .dica')].map(d=>d.textContent).join(' / ')`));
      await js(`document.querySelector('[data-cmd=verTriangulos]').click()`); await espera(300);
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      await bt('Editar triângulos e vértices'); await espera(400);
      // clica no topo da caixa (ponto 10,5,20 levemente fora do centro)
      await clicar(...await projetar(`new F.THREE.Vector3(3,4,20)`));
      console.log('após clique:', await js(`document.querySelector('.contagem').textContent`));
      await bt('Face plana'); await espera(300);
      console.log('face plana:', await js(`document.querySelector('.contagem').textContent`));
      await foto('8-tri-selecionados');
      await bt('Apagar triângulos (Del)'); await espera(400);
      console.log('apagou:', await msg(), '|', await dica());
      await foto('9-apagado');
      await bt('Fechar buracos'); await espera(400);
      console.log('fechou:', await msg(), '|', await dica());
      await bt('Vértices'); await espera(400);
      await clicar(...await projetar(`new F.THREE.Vector3(10,-10,20)`));
      console.log('vértice:', await js(`document.querySelector('.contagem').textContent`), await js(`[...document.querySelectorAll('#propriedades .xyz input')].map(i=>i.value).join(' | ')`));
      await js(`(()=>{const i=document.querySelectorAll('#propriedades .xyz input')[2]; i.value='30'; i.dispatchEvent(new Event('change'));})()`); await espera(500);
      console.log('movido para z=30:', await js(`[...document.querySelectorAll('#propriedades .xyz input')].map(i=>i.value).join(' | ')`), '|', await dica());
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      await foto('10-vertice-movido');
      await bt('Concluir'); await espera(300);
      // esfera densa -> simplificar
      await js(`[...document.querySelectorAll('.forma')].find(b=>b.textContent.includes('Esfera')).click()`); await espera(300);
      await campo('Segmentos', '128'); await espera(400);
      await js(`(()=>{const i=document.querySelectorAll('#propriedades .xyz')[0].querySelectorAll('input')[0]; i.value='35'; i.dispatchEvent(new Event('change'));})()`); await espera(300);
      await bt('Converter em malha editável'); await espera(500);
      await campo('Manter', '5'); await bt('Simplificar'); await espera(1500);
      console.log('simplificou:', await msg());
      await js(`document.querySelector('[data-cmd=ajustar]').click()`); await espera(300);
      await foto('11-simplificado');
      console.log('status tris:', await js(`document.querySelector('#tris').textContent`));
    } catch (e) { console.log('ERRO TESTE', e); }
    app.exit(0);
  });
});
require('../main.js');
