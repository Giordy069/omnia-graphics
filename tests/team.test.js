const { open } = require('./harness');
(async () => {
  const h = await open(); const { ev, d, sleep } = h;
  let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
  const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  // libreria
  ev(`localStorage.setItem(LIB_KEY, JSON.stringify([{name:'Logo A',src:'${PX}'},{name:'Logo B',src:'${PX}'}])); renderLibraryUI()`);
  ok(d.querySelectorAll('#libGrid img').length === 2, 'libreria mostra 2 immagini');
  for (const t of ['team1', 'team2', 'sponsor', 'subject', 'bg']) {
    await ev(`useLibImage(0,'${t}')`); await sleep(60);
  }
  ok(ev('!!teamLogoImg && !!teamLogo2Img && !!sponsorLogoImg && !!subjectImg && !!bgImg'), 'applica a team1/2, sponsor, agente, sfondo');
  ev('renderGraphic(true)');
  await ev("deleteLibImage(1)");
  ok(ev('loadLibrary().length') === 1, 'elimina dalla libreria');

  // preset: export -> import su archivio vuoto
  ev("storePresets({teams:[{name:'ALFA',tag:'AL',players:[],logo:null}],sponsors:[{name:'SPX',logo:null}]})");
  let blobText = null;
  const data = JSON.parse(ev(`JSON.stringify({app:'omnia-graphics-presets',version:1,teams:loadPresets().teams,sponsors:loadPresets().sponsors,library:loadLibrary()})`));
  ev("localStorage.clear()");
  ok(ev('loadPresets().teams.length') === 0 && ev('loadLibrary().length') === 0, 'archivio svuotato');
  ev('importPresetsData(' + JSON.stringify(data) + ')');
  ok(ev('loadPresets().teams[0].name') === 'ALFA' && ev('loadPresets().sponsors.length') === 1 && ev('loadLibrary().length') === 1, 'import ripristina team, sponsor, libreria');
  ev('importPresetsData(' + JSON.stringify(data) + ')');
  ok(ev('loadPresets().teams.length') === 1 && ev('loadLibrary().length') === 1, 'import non duplica (aggiorna per nome)');
  ok(d.getElementById('teamPresetSel0').options.length === 2, 'select preset aggiornata');
  let threw = false; try { ev("importPresetsData({app:'altro'})"); } catch (e) { threw = true; }
  ok(threw, 'rifiuta file non valido');

  // progetti recenti + home
  ev("document.getElementById('inputTitle').value='TORNEO PROVA'; recordRecent()");
  ok(ev('loadRecents().length') === 1 && /TORNEO PROVA/.test(ev('loadRecents()[0].name')), 'recente registrato');
  ev("document.getElementById('inputTitle').value='ALTRO'; recordRecent('Secondo')");
  ev("recordRecent('Secondo')"); ok(ev('loadRecents().length') === 2, 'stesso nome non duplica');
  for (let i = 0; i < 8; i++) ev(`recordRecent('P${i}')`);
  ok(ev('loadRecents().length') === 6, 'max 6 recenti');
  ev('showWelcome()');
  ok(!d.getElementById('welcome').classList.contains('hidden') && d.querySelectorAll('#recentGrid button').length === 6, 'home mostra recenti');
  ev("document.getElementById('inputTitle').value='CAMBIATO'; renderGraphic()");
  await ev('openRecent(0)'); await sleep(100);
  ok(d.getElementById('welcome').classList.contains('hidden'), 'apri recente chiude la home');
  ok(ev("document.getElementById('inputTitle').value") === 'ALTRO' || ev("document.getElementById('inputTitle').value") === 'ALTRO', 'apri recente ripristina il contenuto');
  console.log(fails ? 'FAILS ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
