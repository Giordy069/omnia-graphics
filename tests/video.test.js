const crypto = require('crypto');
const { open } = require('./harness');
(async () => {
  const h = await open(); const { ev, d, sleep } = h;
  let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
  const set = (id, v) => { d.getElementById(id).value = v; };
  const hash = () => { ev('renderGraphic(true)'); return crypto.createHash('md5').update(d.getElementById('graphicCanvas').__nc.toBuffer('image/png')).digest('hex'); };

  // video finto: una canvas che cambia colore con il tempo, con le proprieta' di un <video>
  ev(`(() => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    const paint = () => { const x = c.getContext('2d'); x.fillStyle = 'hsl(' + ((c.currentTime || 0) * 60 % 360) + ',80%,50%)'; x.fillRect(0, 0, 320, 180); };
    const ls = {};
    Object.assign(c, { videoWidth: 320, videoHeight: 180, duration: 5, readyState: 4, seeks: [],
      addEventListener(n, f) { (ls[n] = ls[n] || []).push(f); }, removeEventListener(n, f) { ls[n] = (ls[n] || []).filter(x => x !== f); }, pause() {}, removeAttribute() {} });
    let t = 0;
    Object.defineProperty(c, 'currentTime', { get() { return t; }, set(v) { t = v; c.seeks.push(v); paint(); setTimeout(() => (ls.seeked || []).slice().forEach(f => f()), 0); } });
    paint(); window.__fakeVideo = c;
    attachBgVideo(c, 'blob:fake', 'finto.mp4');
  })()`);
  ok(!d.getElementById('vidInfoRow').classList.contains('hidden') && /finto\.mp4 · 5\.0 s · 320×180/.test(d.getElementById('vidName').textContent), 'video caricato: nome, durata, dimensioni');

  // tempi: partenza, ricomincia, ultimo fotogramma
  set('vidStart', '1'); set('vidLoop', '1');
  ok(Math.abs(ev('videoTimeFor(0)') - 1) < 1e-9 && Math.abs(ev('videoTimeFor(2)') - 3) < 1e-9, 'parte dal secondo scelto');
  ok(Math.abs(ev('videoTimeFor(4)') - 1) < 1e-9 && Math.abs(ev('videoTimeFor(5)') - 2) < 1e-9, 'ricomincia quando finisce (clip di 4 s)');
  set('vidLoop', '0');
  ok(ev('videoTimeFor(10)') > 4.9 && ev('videoTimeFor(10)') < 5, 'resta sull\'ultimo fotogramma');
  set('vidStart', '99'); ok(ev('videoTimeFor(0)') <= 4.9, 'partenza oltre la durata: limitata');
  set('vidStart', '0'); set('vidLoop', '1');

  // disegno: il video cambia l'immagine, il velo e l'opacita' pure
  ev('removeBgVideo(true)'); const noVideo = hash();
  ev('attachBgVideo(window.__fakeVideo, "blob:fake", "finto.mp4")'); set('vidDim', '0'); set('vidOp', '100');
  const withVideo = hash(); ok(withVideo !== noVideo, 'il video appare sullo sfondo');
  set('vidDim', '60'); const dimmed = hash(); ok(dimmed !== withVideo, 'il velo cambia il risultato');
  set('vidOp', '30'); ok(hash() !== dimmed, 'opacita\' regolabile');
  set('vidDim', '25'); set('vidOp', '100');

  // fotogrammi diversi in momenti diversi (il video si muove)
  await ev('seekVideoExact(0.5)'); const a = hash(); await ev('seekVideoExact(2.5)'); const b = hash();
  ok(a !== b, 'fotogrammi del video diversi nel tempo');
  ok(await ev('seekVideoExact(2.5)') === undefined, 'seek gia\' al punto giusto: nessuna attesa');

  // anteprima animata: il video segue il tempo
  set('animDur', '4'); ev('window.__fakeVideo.seeks.length = 0; animShow(2)');
  ok(Math.abs(ev('window.__fakeVideo.seeks[0]') - 2) < 0.01, 'scrub sposta il video a t=2');

  // export: un seek per fotogramma, ai tempi attesi, nessun ridisegno extra
  ev(`window.__v = {frames:0};
      window.omnia = { pickFolder: async()=>'C:/o', saveFiles: async()=>[], revealFile(){},
        videoStart: async()=>'j', videoFrame: async()=>{ window.__v.frames++; }, videoFinish: async()=>'C:/o/v.mp4', videoCancel: async()=>{} };
      localStorage.setItem('omnia.outDir','C:/o'); window.__fakeVideo.seeks.length = 0; document.getElementById('vidStart').value = '1'`);
  await ev('exportVideo()');
  const seeks = JSON.parse(ev('JSON.stringify(window.__fakeVideo.seeks)'));
  ok(ev('window.__v.frames') === 120 && seeks.length >= 100, `export: 120 fotogrammi, ${seeks.length} spostamenti del video`);
  ok(Math.abs(seeks[1] - 1.0333) < 0.01 && seeks.every(s => s >= 1 && s <= 5), 'tempi del video corretti e dentro la durata');
  ok(ev('videoExporting') === false && ev('animCtx') === null, 'stato ripristinato');

  // rimozione e nuovo progetto
  ev('removeBgVideo()'); ok(ev('bgVideo') === null && d.getElementById('vidInfoRow').classList.contains('hidden'), 'rimuovi video');
  ev('attachBgVideo(window.__fakeVideo, "blob:fake", "x")'); await ev('newProject()'); await sleep(100);
  ok(ev('bgVideo') === null, 'nuovo progetto toglie il video');
  // impostazioni nel progetto, video escluso
  set('vidStart', '2.5'); set('vidLoop', '0'); set('vidDim', '40');
  const snap = JSON.parse(ev('snapshot().core'));
  ok(snap.fields.vidStart === '2.5' && snap.fields.vidLoop === '0' && snap.fields.vidDim === '40' && !JSON.stringify(snap).includes('blob:'), 'impostazioni salvate, video no');
  // sfondi animati e sostituzione con il video
  ev('removeBgVideo(true)'); set('finBg','vertical'); set('animBg','none'); const base = hash();
  const kinds = ['glow','lines','dots','scan']; const hs = {};
  for (const k of kinds) { set('animBg', k); hs[k] = hash(); }
  ok(kinds.every(k => hs[k] !== base) && new Set(Object.values(hs)).size === 4, 'i 4 sfondi animati sono diversi tra loro e dallo sfondo piatto');
  set('animBg','lines'); ev('animCtx={effect:"rise",dur:8,step:0.35,t:1,frame:30}'); const l1 = hash(); ev('animCtx={effect:"rise",dur:8,step:0.35,t:3,frame:90}'); const l3 = hash(); ev('animCtx=null');
  ok(l1 !== l3, 'lo sfondo animato cambia nel tempo');
  ok(d.getElementById('animBg').value === 'lines' && JSON.parse(ev('snapshot().core')).fields.animBg === 'lines', 'sfondo animato nel progetto');
  ev('attachBgVideo(window.__fakeVideo, "blob:fake", "v")'); const wv = hash();
  set('animBg','dots'); set('finBg','radial'); set('animBgAmt','100');
  ok(hash() === wv, 'con il video lo sfondo vecchio (animato, sfumatura) non si vede piu');
  ok(!d.getElementById('animBgNote').classList.contains('hidden'), 'avviso di sostituzione visibile');
  ev('removeBgVideo(true)'); ok(d.getElementById('animBgNote').classList.contains('hidden') && hash() !== wv, 'senza video torna lo sfondo scelto');
  await ev('newProject()'); await sleep(100);
  ok(d.getElementById('animBg').value === 'glow', 'default: alone luminoso');
  console.log(fails ? 'FAILS ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
