const { open } = require('./harness');
(async () => {
  const h = await open(); const { ev, d, sleep } = h;
  let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
  const set = (id, v) => { d.getElementById(id).value = v; };
  set('animDur', '4');
  const mock = () => ev(`window.__m = { starts: [], frames: 0, fin: 0, canc: 0, modes: [], cleared: [] };
    window.omnia = { pickFolder: async()=>'C:/o', saveFiles: async()=>[], revealFile(p){ window.__m.rev = p; },
      audioSave: async(n, buf)=>{ window.__m.audio = { n, len: buf.byteLength }; return 'a1'; }, audioClear: async(id)=>{ window.__m.cleared.push(id); },
      videoStart: async(dir,name,fps,w,h,audio)=>{ window.__m.starts.push({name,w,h,audio}); window.__m.modes.push(currentMode + '/' + (carouselCtx ? carouselCtx.i + '-' + carouselCtx.n : '-')); return 'j' + window.__m.starts.length; },
      videoFrame: async()=>{ window.__m.frames++; }, videoFinish: async(id)=>{ window.__m.fin++; return 'C:/o/' + id + '.mp4'; }, videoCancel: async()=>{ window.__m.canc++; } };
    localStorage.setItem('omnia.outDir','C:/o')`);
  mock();

  // 1. musica: caricamento (file simulato), parametri passati a FFmpeg
  ev(`(() => { const a = document.createElement('audio'); window.__aud = a; })()`);
  // simula il percorso di caricamento chiamando direttamente le parti dopo la lettura
  ev(`audioEl = { pause(){ window.__paused = true; }, play(){ window.__played = true; return Promise.resolve(); }, volume: 1, currentTime: 0, duration: 30 }; audioId = 'a1';
      document.getElementById('audInfoRow').classList.remove('hidden')`);
  set('audStart', '12.5'); set('audVol', '60'); set('audFade', '1');
  const p = JSON.parse(ev('JSON.stringify(audioForExport(8))'));
  ok(p.id === 'a1' && p.start === 12.5 && Math.abs(p.volume - 0.6) < 1e-9 && p.fadeIn === 0.5 && p.fadeOut > 0 && p.fadeOut <= 1.5 && p.dur === 8, 'parametri audio: partenza, volume, dissolvenze');
  set('audFade', '0'); const p0 = JSON.parse(ev('JSON.stringify(audioForExport(8))')); ok(p0.fadeIn === 0 && p0.fadeOut === 0, 'senza dissolvenze');
  ev('audioId = null'); ok(ev('audioForExport(8)') === null, 'senza musica: null'); ev("audioId = 'a1'"); set('audFade', '1');

  // 2. anteprima sincronizzata con l'animazione
  ev('window.__played = false; window.__paused = false; animPlay()'); ok(ev('window.__played') === true && ev('audioEl.currentTime') === 12.5, 'anteprima: parte la musica dal punto scelto');
  ev('animStop()'); ok(ev('window.__paused') === true, 'stop: la musica si ferma');

  // 3. video singolo con musica
  await ev('exportVideo()');
  let m = JSON.parse(ev('JSON.stringify(window.__m)'));
  ok(m.starts.length === 1 && m.starts[0].audio && m.starts[0].audio.id === 'a1' && m.starts[0].audio.dur === 4, 'export video: musica inclusa con la durata dell\'animazione');

  // 4. carosello video: un MP4 per slide, numerati, modalita' giuste, musica in ognuno
  mock();
  ev("clearCarSlides(); setMode('announce'); addCarSlide(); setMode('roster'); addCarSlide(); setMode('result'); addCarSlide(); setMode('countdown')");
  set('carMedia', 'video'); await ev('exportCarousel()');
  m = JSON.parse(ev('JSON.stringify(window.__m)'));
  ok(m.starts.length === 3 && m.fin === 3 && m.frames === 3 * 120, `carosello video: 3 MP4, ${m.frames} fotogrammi`);
  ok(/CAROSELLO_01di03_ANIM_POST_4x5\.mp4$/.test(m.starts[0].name) && /CAROSELLO_03di03/.test(m.starts[2].name), 'nomi numerati: ' + m.starts[0].name);
  ok(m.modes.join('|') === 'announce/0-3|roster/1-3|result/2-3', 'ogni slide usa la sua modalita: ' + m.modes.join('|'));
  ok(m.starts.every(s => s.audio && s.audio.id === 'a1') && ev('currentMode') === 'countdown' && ev('carouselCtx') === null && ev('animCtx') === null, 'musica in ogni slide, stato ripristinato');
  ok(d.getElementById('loader').classList.contains('hidden'), 'loader chiuso');
  // 5. annullamento a meta' carosello
  mock(); ev("window.omnia.videoFrame = async()=>{ window.__m.frames++; if (window.__m.frames === 130) loadCancelFn(); }");
  await ev('exportCarousel()'); m = JSON.parse(ev('JSON.stringify(window.__m)'));
  ok(m.starts.length === 2 && m.fin === 1 && m.canc === 1, 'annullando: 1 slide finita, 1 cancellata, nessun\'altra avviata');
  // 6. carosello a immagini resta com'era
  mock(); set('carMedia', 'img'); ev("window.omnia.saveFiles = async(dd,f)=>{ window.__m.files = f.length; return f.map(x=>x.name); }"); await ev('exportCarousel()');
  ok(ev('window.__m.files') === 3 && ev('window.__m.starts.length') === 0, 'carosello immagini: 3 PNG, nessun video');
  // 7. rimozione musica e nuovo progetto
  ev("audioEl = { pause(){}, play(){return Promise.resolve()}, volume:1 }; audioId = 'a1'; window.__m.cleared = []");
  await ev('removeAudio()'); ok(ev('audioId') === null && ev('window.__m.cleared[0]') === 'a1' && d.getElementById('audInfoRow').classList.contains('hidden'), 'rimuovi musica pulisce anche il file temporaneo');
  set('audStart', '3'); set('audVol', '40'); set('carMedia', 'video');
  const snap = JSON.parse(ev('snapshot().core'));
  ok(snap.fields.audStart === '3' && snap.fields.audVol === '40' && snap.fields.carMedia === 'video', 'impostazioni musica e carosello nel progetto');
  console.log(fails ? 'FAILS ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
