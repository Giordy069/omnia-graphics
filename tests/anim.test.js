const crypto = require('crypto');
const { open } = require('./harness');
(async () => {
  const h = await open(); const { ev, d, sleep } = h;
  let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
  const set = (id, v) => { d.getElementById(id).value = v; };
  const hash = () => { ev('renderGraphic(true)'); return crypto.createHash('md5').update(d.getElementById('graphicCanvas').__nc.toBuffer('image/png')).digest('hex'); };

  // 1. a t=0 gli elementi non si vedono, alla fine la grafica e' identica a quella statica
  const still = hash();
  ev("animCtx = {effect:'rise',dur:8,step:0.35,t:0,frame:0}"); const t0 = hash();
  ev("animCtx = {effect:'rise',dur:8,step:0.35,t:2,frame:60}"); const t2 = hash();
  ev("animCtx = {effect:'rise',dur:8,step:0.35,t:8,frame:240}"); const tEnd = hash();
  ev('animCtx = null');
  ok(t0 !== still && t2 !== t0 && t2 !== tEnd, 'fotogrammi diversi in momenti diversi');
  // la grana vibra: confronto con grana a 0 per escluderla
  set('inputGrain', '0'); set('animBg', 'none');
  const still0 = hash();
  ev("animCtx = {effect:'rise',dur:8,step:0.35,t:8,frame:240}"); const end0 = hash(); ev('animCtx = null');
  ok(end0 === still0, 'a fine animazione la grafica coincide con quella statica');
  set('inputGrain', '14'); set('animBg', 'glow');

  // 2. tutti gli effetti, in tutte le modalita', senza errori e con ordine dall'alto
  let bad = [];
  for (const eff of ['rise', 'fade', 'slide', 'zoom', 'pop', 'mix']) for (const m of JSON.parse(ev('JSON.stringify(MODES.map(m=>m.id))'))) for (const f of ['post', 'story']) {
    try { ev(`setMode('${m}'); setFormat('${f}'); animCtx={effect:'${eff}',dur:6,step:0.35,t:1.3,frame:39}; renderGraphic(true); animCtx=null`); } catch (e) { bad.push(`${eff}/${m}/${f}: ${e.message.split('\n')[0]}`); }
  }
  ok(bad.length === 0, 'effetti x modalita x formati senza errori' + (bad.length ? ' ' + bad[0] : ''));
  ev("setMode('announce'); setFormat('post')");

  // 3. ritmo: con molti elementi tutti compaiono prima della fine (alpha=1 a dur-0.8)
  ev("animCtx={effect:'fade',dur:4,step:0.5,t:3.2,frame:96}");
  const alphas = JSON.parse(ev('JSON.stringify((()=>{renderGraphic(true); const n=layerList.filter(l=>!l.hidden).length; return Array.from({length:n},(_,r)=>animState(r,n).a)})())'));
  ev('animCtx = null');
  ok(alphas.length > 3 && alphas.every(a => a === 1), `tutti i ${alphas.length} elementi visibili prima del finale`);

  // 4. anteprima: scrub e stop
  set('animDur', '6');
  d.getElementById('animScrub').value = '500'; d.getElementById('animScrub').dispatchEvent(new h.w.Event('input'));
  ok(ev('animCtx') && Math.abs(ev('animCtx.t') - 3) < 0.01 && /3\.0/.test(d.getElementById('animTime').textContent), 'scrub a meta durata');
  ev('animStop()'); ok(ev('animCtx') === null && d.getElementById('animScrub').value === '0', 'stop torna alla modifica');
  ev("animShow(1); setMode('roster')"); ok(ev('animCtx') === null, 'cambio modalita ferma l\'anteprima');
  ev("setMode('announce')");

  // 5. stato nel progetto
  set('animEffect', 'pop'); set('animStep', '0.2');
  const snap = JSON.parse(ev('snapshot().core'));
  ok(snap.fields.animEffect === 'pop' && snap.fields.animDur === '6' && snap.fields.animStep === '0.2', 'impostazioni animazione nel progetto');
  await ev('newProject()'); await sleep(100);
  ok(d.getElementById('animEffect').value === 'rise' && d.getElementById('animDur').value === '8', 'new resetta animazione');

  // 6. export video: fotogrammi, formato e annullamento (app simulata)
  set('animDur', '4');
  ev(`window.__v = {start:null, frames:0, sizes:[], fin:0, canc:0};
      window.omnia = { pickFolder: async()=>'C:/o', saveFiles: async()=>[], revealFile(p){ window.__v.rev=p; },
        videoStart: async(dir,name,fps,w,h)=>{ window.__v.start={dir,name,fps,w,h}; return 'j1'; },
        videoFrame: async(id,url)=>{ window.__v.frames++; window.__v.jpeg = url.startsWith('data:image/jpeg'); window.__v.cw = canvas.width; return window.__v.frames; },
        videoFinish: async()=>{ window.__v.fin++; return 'C:/o/video.mp4'; },
        videoCancel: async()=>{ window.__v.canc++; } };
      localStorage.setItem('omnia.outDir','C:/o')`);
  await ev('exportVideo()');
  const v = JSON.parse(ev('JSON.stringify(window.__v)'));
  ok(v.frames === 120 && v.start.fps === 30 && v.start.w === 1080 && v.start.h === 1350 && /_ANIM_POST_4x5\.mp4$/.test(v.start.name), `export post: ${v.frames} fotogrammi, ${v.start.name}`);
  ok(v.jpeg && v.cw === 1080 && v.fin === 1 && v.rev === 'C:/o/video.mp4', 'JPEG 1080 px, un solo finish, rivelato');
  ok(ev('animCtx') === null && d.getElementById('loader').classList.contains('hidden') && d.getElementById('graphicCanvas').width === 1080, 'stato ripristinato dopo export');
  ev("setFormat('story'); window.__v.frames=0"); await ev('exportVideo()');
  ok(JSON.parse(ev('JSON.stringify(window.__v.start)')).h === 1920, 'storia: 1080x1920');
  ev("setFormat('post'); window.__v.frames=0; window.__v.fin=0; window.__v.canc=0; window.omnia.videoFrame = async(id,url)=>{ window.__v.frames++; if (window.__v.frames===10) loadCancelFn(); return 1; }");
  await ev('exportVideo()');
  ok(ev('window.__v.canc') === 1 && ev('window.__v.fin') === 0 && ev('window.__v.frames') <= 11, 'annulla: ferma, cancella il file, nessun finish (' + ev('window.__v.frames') + ' fotogrammi)');
  ev("window.omnia.videoFrame = async()=>{ throw new Error('boom'); }; window.__v.canc=0; window.alert=()=>{}"); await ev('exportVideo()');
  ok(ev('window.__v.canc') === 1 && d.getElementById('loader').classList.contains('hidden'), 'errore: job cancellato e loader chiuso');
  ev('delete window.omnia'); await ev('exportVideo()');
  console.log(fails ? 'FAILS ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
