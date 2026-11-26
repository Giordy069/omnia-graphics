const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true,
  beforeParse(w) {
    const noop = new Proxy(function(){}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createPattern' ? () => ({}) : noop), apply: () => noop, set: (t,k,v) => { if (k==="font") (global.__fonts=global.__fonts||[]).push(v); if (k==="textAlign") (global.__al=global.__al||[]).push(v); if (k==="fillStyle") (global.__fills=global.__fills||[]).push(typeof v === "string" ? v : ""); return true; } });
    w.HTMLCanvasElement.prototype.getContext = () => noop;
    w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
    w.Image = class { set src(v) { this._s = v; this.width = 10; this.height = 10; setTimeout(() => this.onload && this.onload(), 0); } get src() { return this._s; } };
    w.document.fonts = { load: () => Promise.resolve(), ready: Promise.resolve() };
    w.__saved=null; w.omnia={pickFolder:async()=>'C:/out',saveFiles:async(d,f)=>{w.__saved={d,f};return f.map(x=>d+'/'+x.name)},revealFile(){}}; w.matchMedia = () => ({ matches: false, addEventListener(){} }); w.confirm = () => true; w.__dialogAuto = true; w.alert = (m) => console.log('ALERT', m);
    w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
  } });
const w = dom.window; const d = w.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const set = (id, v) => { const e = d.getElementById(id); e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); };
const ev = (s) => w.eval(s);
(async () => {
  let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
  await sleep(900);
  ok(ev('history.length') >= 1, 'baseline snapshot');
  set('inputTitle', 'ALPHA'); await sleep(600);
  set('inputTitle', 'BETA'); await sleep(600);
  ok(ev('histIdx') >= 2, 'history grows ' + ev('histIdx'));
  ev('undo()'); await sleep(200);
  ok(d.getElementById('inputTitle').value === 'ALPHA', 'undo -> ALPHA');
  ev('redo()'); await sleep(200);
  ok(d.getElementById('inputTitle').value === 'BETA', 'redo -> BETA');
  ok(JSON.parse(w.localStorage.getItem('omnia.autosave').replace(/^$/, '{}')).core.includes('BETA'), 'autosave has BETA');
  // offsets/mode
  ev("elementOffsets.heroTitle={x:40,y:-20,s:1.5}; setMode('roster')"); await sleep(600);
  ev('undo()'); await sleep(200);
  ok(ev('currentMode') === 'announce', 'undo mode');
  // team preset
  set('rosterTeamName', 'TEAM X'); ev("rosterPlayers[0].name='ZZ'; saveTeamPreset(0)");
  ok(JSON.parse(w.localStorage.getItem('omnia.presets')).teams[0].players[0].name === 'ZZ', 'team preset saved');
  ev("rosterPlayers[0].name='QQ'"); d.getElementById('teamPresetSel0').value = 'TEAM X';
  await ev('loadTeamPreset(0)'); ok(ev('rosterPlayers[0].name') === 'ZZ', 'team preset loaded');
  // sponsor preset w/ logo
  set('inputSponsor', 'ACME'); ev("sponsorLogoImg={src:'data:image/png;base64,QQ',width:1,height:1}; saveSponsorPreset()");
  ev("sponsorLogoImg=null; set=0"); d.getElementById('sponsorPresetSel').value = 'ACME';
  await ev('loadSponsorPreset()'); ok(ev('!!sponsorLogoImg'), 'sponsor logo restored');
  // save file + open
  let blobText = null; const origBlob = w.Blob; w.Blob = class { constructor(p) { blobText = p[0]; } };
  await ev('saveProjectFile()'); w.Blob = origBlob;
  const data = JSON.parse(blobText); ok(data.app === 'omnia-graphics' && data.core.fields.inputTitle === 'BETA', 'save file content');
  set('inputTitle', 'CHANGED'); await sleep(500);
  await ev('applyState(' + JSON.stringify(data.core) + ',' + JSON.stringify(data.imgs) + ')');
  ok(d.getElementById('inputTitle').value === 'BETA', 'open restores');
  await ev('newProject()'); await sleep(100);
  ok(d.getElementById('inputTitle').value === 'GAUNTLET', 'new project resets');
  ev("currentMode='announce'");
  await ev('exportBoth()');
  ok(w.__saved && w.__saved.f.length === 2, 'exportBoth saves 2 files');
  ok(w.__saved.f[0].name.endsWith('POST_4x5.png') && w.__saved.f[1].name.endsWith('STORIA_9x16.png'), 'names ' + w.__saved.f.map(f => f.name));
  ok(ev('currentFormat') === 'post', 'format restored');
  await ev('downloadPNG()'); ok(w.__saved.f.length === 1, 'single export');
  global.__fonts = [];
  ok(ev("F('title','400 200px \"Anton\", sans-serif')").includes('Anton'), 'F auto keeps original');
  d.getElementById('font-title').value = 'mono'; d.getElementById('font-title').dispatchEvent(new w.Event('change'));
  ev("renderGraphic(true)");
  ok(global.__fonts.some(f => /^400 \d+px "JetBrains Mono"/.test(f)), 'title rendered with mono: ' + global.__fonts.filter(f=>/px "JetBrains/.test(f)).slice(0,2));
  ok(ev("F('title','800 30px \"Barlow Condensed\", sans-serif')").startsWith('700 30px "JetBrains Mono"'), 'weight clamp mono');
  ok(ev("F('title','900 30px \"Barlow Condensed\", sans-serif')") === '700 30px "JetBrains Mono", monospace', 'weight clamp 900->700');
  ev("fontChoice.title='barlow'"); ok(ev("F('title','400 20px \"Anton\", sans-serif')") === '700 20px "Barlow Condensed", sans-serif', 'barlow weight');
  // fx state roundtrip
  d.getElementById('font-title').value = 'mono';
  ev("setFx('subject','rot','45'); toggleFx('subject','flipH'); toggleFx('sponsor','flipV')");
  const snap = JSON.parse(ev('snapshot().core'));
  ok(snap.fx.subject.rot === 45 && snap.fx.subject.flipH && snap.fields['font-title'] === 'mono', 'state has fx + font');
  await ev('newProject()'); await sleep(100);
  ok(d.getElementById('font-title').value === 'auto' && ev('imgFx.subject.rot') === 0, 'new resets font+fx');
  await ev('applyState(' + JSON.stringify(snap) + ', {})');
  ok(ev('imgFx.subject.rot') === 45 && ev('imgFx.subject.flipH') && d.getElementById('font-title').value === 'mono', 'restore fx+font');
  ok(d.querySelector('#fx-subject button') !== null && d.querySelectorAll('#fontGrid select').length === 10, 'controls rendered');

  // ---- nocturne contrast ----
  await ev('newProject()'); await sleep(100);
  ev("setTheme('night'); setMode('roster')");
  global.__fills = []; ev('renderGraphic(true)');
  ok(!global.__fills.some(f => /rgba\(15,20,25/.test(f)), 'night roster: nessun testo scuro su surface');
  ok(global.__fills.some(f => /rgba\(248,250,252,0\.72\)/.test(f)), 'night roster: ruoli chiari');
  ev("setTheme('vctDark')"); global.__fills = []; ev('renderGraphic(true)');
  ok(global.__fills.some(f => /rgba\(14,20,27,0\.72\)/.test(f)), 'vctDark roster: ruoli scuri su surface chiara');
  // ---- LoL ----
  ev("setMode('announce'); setTheme('paper')");
  ev("setGame('lol')");
  ok(ev('currentGame') === 'lol', 'game lol');
  ok(d.getElementById('inputKicker').value === 'LEAGUE OF LEGENDS SERIES', 'kicker lol');
  ok(d.getElementById('theme-vctDark').textContent === 'Hextech Gold', 'theme label');
  ok(d.getElementById('font-title').value === 'cinzel', 'title font cinzel');
  ok(ev('rosterPlayers[0].role') === 'TOP' && ev('rosterPlayers[1].role') === 'JUNGLE', 'role remap ' + ev('rosterPlayers[0].role'));
  ok(ev('eveningGames[0].meta').includes("SUMMONER'S RIFT") && ev('eveningGames[1].meta').includes('HOWLING ABYSS'), 'maps remap');
  ok([...d.querySelectorAll('#rosterPlayersContainer select')][0].innerHTML.includes('SUPPORT'), 'role select lol');
  ok(ev('getTheme().accent') === '#0B7A8A', 'lol theme');
  ev("setMode('announce')"); global.__fonts = []; ev('renderGraphic(true)');
  ok(global.__fonts.some(f => /"Cinzel"/.test(f)), 'cinzel used in render'); ev("setMode('roster')");
  ok(ev('exportFileName("post")') === 'OMNIA_GAUNTLET_LOL_ROSTER_POST_4x5.png', 'filename ' + ev('exportFileName("post")'));
  const snap2 = JSON.parse(ev('snapshot().core'));
  ok(snap2.game === 'lol', 'state has game');
  await ev('newProject()'); await sleep(100);
  ok(ev('currentGame') === 'valorant' && d.getElementById('theme-paper').textContent === 'Swiss Paper', 'new -> valorant');
  await ev('applyState(' + JSON.stringify(snap2) + ', {})');
  ok(ev('currentGame') === 'lol' && d.getElementById('game-lol').className.includes('bg-[#ff4655]') && ev('rosterPlayers[0].role') === 'TOP', 'restore lol');
  ev("setGame('valorant')");
  ok(d.getElementById('inputKicker').value === 'VALORANT SERIES' && ev('rosterPlayers[0].role') === 'DUELIST' && d.getElementById('font-title').value === 'auto', 'back to valorant');

  // ---- titolo multi-riga ----
  await ev('newProject()'); await sleep(100);
  ev("setMode('announce')");
  const rec = []; 
  global.__texts = []; 
  ok(JSON.stringify(ev("parseTitle('ab\\ncd\\n\\n  ef ', 'X')")) === '["AB","CD","EF"]', 'parseTitle');
  ok(ev("parseTitle('', 'GAUNTLET').length") === 1 && ev("parseTitle('a\\nb\\nc\\nd\\ne','X').length") === 4, 'parseTitle fallback/cap');
  ev("document.getElementById('inputTitle').value='RIGA UNO\\nRIGA DUE\\nRIGA TRE'");
  ev("renderGraphic(true)");
  const hb = JSON.parse(ev("JSON.stringify(hitBoxes.find(b=>b.id==='heroTitle'))"));
  ok(hb && hb.h > 300 && hb.y > 100, 'hitbox titolo multiriga ' + JSON.stringify(hb));
  const sz = ev("fitTitleSize(['A','B','C'], 205, 900, 400)");
  ok(sz <= 400 / (0.8 + 0.92 * 2) + 1, 'fit altezza ' + sz);
  ev("setLayout('poster'); renderGraphic(true)");
  ok(ev("hitBoxes.some(b=>b.id==='heroTitle')"), 'impact multiriga');
  ev("setLayout('editorial'); setMode('matchday'); document.getElementById('matchdayTitle').value='SERATA\\nFINALE'; renderGraphic(true)");
  ok(ev("hitBoxes.find(b=>b.id==='heroTitle').h") > 88, 'matchday multiriga');
  ev("setFormat('story'); setMode('announce'); renderGraphic(true); setFormat('post')");
  // ---- TFT ----
  ev("setGame('tft')");
  ok(d.getElementById('rosterPlayerCount').value === '8', 'tft 8 giocatori');
  ok(ev('rosterPlayers[0].role') === 'PLAYER' && ev('rosterPlayers.length') >= 8, 'tft ruoli ' + ev('rosterPlayers[0].role'));
  ok(d.getElementById('game-tft').className.includes('bg-[#ff4655]') && d.getElementById('theme-vctDark').textContent === 'Tactician Gold', 'tft ui');
  ok(d.getElementById('inputKicker').value === 'TEAMFIGHT TACTICS SERIES' && d.getElementById('font-title').value === 'cinzel', 'tft testi');
  ev("setMode('roster'); renderGraphic(true)");
  ok(d.querySelectorAll('#rosterPlayersContainer select').length === 8, 'tft 8 righe roster');
  ev("setGame('valorant')");
  ok(d.getElementById('rosterPlayerCount').value === '5' && ev('rosterPlayers[0].role') !== 'PLAYER', 'ritorno valorant ' + ev('rosterPlayers[0].role'));
  // ---- Omnia standard ----
  ev("setGame('omnia')");
  ok(d.querySelectorAll('#themeButtons button').length === 8, 'omnia 8 palette');
  ok(d.getElementById('customPalette').classList.contains('hidden'), 'custom nascosta');
  ev("setTheme('custom')");
  ok(!d.getElementById('customPalette').classList.contains('hidden'), 'custom visibile');
  d.getElementById('palBg').value = '#112233'; d.getElementById('palInk').value = '#eeeeee'; d.getElementById('palAccent').value = '#ff8800';
  const th = JSON.parse(ev('JSON.stringify(getTheme())'));
  ok(th.bg === '#112233' && th.accent === '#ff8800' && th.isLight === false && th.surface === '#eeeeee', 'tema custom derivato ' + JSON.stringify(th));
  ev("setMode('announce'); renderGraphic(true)");
  ev("setTheme('ember')"); ok(ev('getTheme().accent') === '#FF7A1A', 'ember');
  ok(d.getElementById('inputKicker').value === 'OMNIA SERIES' && ev('exportFileName("post")').includes('STANDARD'), 'omnia testi/file');
  const snap3 = JSON.parse(ev('snapshot().core'));
  ok(snap3.game === 'omnia' && snap3.fields.palBg === '#112233', 'stato omnia');
  await ev('newProject()'); await sleep(100);
  await ev('applyState(' + JSON.stringify(snap3) + ', {})');
  ok(ev('currentGame') === 'omnia' && ev('currentTheme') === 'ember' && d.getElementById('palBg').value === '#112233', 'restore omnia');
  ev("setGame('valorant')");
  ok(ev('currentTheme') === 'paper', 'tema fallback dopo cambio gioco: ' + ev('currentTheme'));
  // ---- sezioni ----
  ok(d.querySelectorAll('details.sec').length === 12 && d.querySelectorAll('details.sec[open]').length === 2, 'sezioni 12, 2 aperte');
  ok(!!d.querySelector('details.sec[data-sec="content"] #panel-announce') && !!d.querySelector('details.sec[data-sec="palette"] #themeButtons'), 'contenuti nelle sezioni');
  // vecchi progetti a 6 giocatori
  const old = JSON.parse(ev('snapshot().core')); old.roster1 = old.roster1.slice(0, 6); old.roster2 = old.roster2.slice(0, 6);
  await ev('applyState(' + JSON.stringify(old) + ', {})'); ok(ev('rosterPlayers.length') >= 8, 'padding 8 giocatori');

  // ---- allineamento ----
  await ev('newProject()'); await sleep(100);
  ev("setGame('valorant'); setMode('announce'); setLayout('editorial')");
  ok(d.querySelectorAll('#alignGrid input[type=hidden]').length === 4 && d.querySelectorAll('#alignbtns-title button').length === 4, 'controlli allineamento');
  ok(ev("A('title','left')") === 'left' && ev("alignX('right',50,150)") === 150 && ev("alignX('center',50,150)") === 100, 'helper A/alignX');
  ev("setAlign('title','right')");
  ok(d.getElementById('align-title').value === 'right' && [...d.querySelectorAll('#alignbtns-title button')][3].className.includes('bg-[#ff4655]'), 'setAlign');
  global.__al = []; ev('renderGraphic(true)');
  ok(global.__al.includes('right'), 'titolo disegnato a destra');
  const snapA = JSON.parse(ev('snapshot().core'));
  ok(snapA.fields['align-title'] === 'right', 'stato allineamento');
  await ev('newProject()'); await sleep(100);
  ok(d.getElementById('align-title').value === 'auto', 'new resetta allineamento');
  await ev('applyState(' + JSON.stringify(snapA) + ', {})');
  ok(d.getElementById('align-title').value === 'right' && ev('A("title","left")') === 'right', 'restore allineamento');
  ev("setAlign('cta','center'); setAlign('info','right'); setAlign('subtitle','right'); document.getElementById('inputExtraInfo').value='NOTE LUNGHE'");
  for (const lay of ['editorial', 'poster']) for (const m of ['announce', 'matchday']) { ev(`setLayout('${lay}'); setMode('${m}'); document.getElementById('inputPrize').value='PREMIO'; renderGraphic(true)`); }
  ok(true, 'render tutte le combinazioni senza errori');
  ev("resetAlign()"); ok(d.getElementById('align-cta').value === 'auto', 'reset allineamento');

  // ---- livelli ----
  await ev('newProject()'); await sleep(100);
  ev("setGame('valorant'); setMode('announce'); setLayout('editorial'); renderGraphic(true)");
  const ids0 = JSON.parse(ev('JSON.stringify(layerList.map(l=>l.id))'));
  ok(ids0.includes('heroTitle') && ids0.includes('scheduleCard') && ids0.length >= 6, 'lista livelli: ' + ids0.join(','));
  ok(d.querySelectorAll('#layersList .layer-row').length === ids0.length, 'righe pannello');
  ok(ev("hitBoxes.some(b=>b.id==='heroTitle')"), 'titolo presente');
  ev("toggleLayer('heroTitle','hidden')");
  ok(!ev("hitBoxes.some(b=>b.id==='heroTitle')") && ev("layerList.find(l=>l.id==='heroTitle').hidden"), 'nascosto: niente hitbox, ancora in lista');
  ok(d.querySelector('#layersList .layer-row.off') !== null, 'riga barrata');
  ev("showAllLayers()");
  ok(ev("hitBoxes.some(b=>b.id==='heroTitle')"), 'mostra tutto');
  // ordine z: le frecce saltano oltre l'elemento con cui ci si SOVRAPPONE
  ev("renderGraphic(true)");
  ok(ev("layerTarget('heroTitle',1)") === -1 && ev("layerTarget('heroTitle',-1)") === -1, 'senza sovrapposizione le frecce non fanno nulla');
  ev("elementOffsets.heroTitle={x:0,y:560,s:1}; renderGraphic(true)");
  const before = JSON.parse(ev('JSON.stringify(layerList.map(l=>l.id))'));
  const tgtF = ev("layerTarget('heroTitle',1)");
  ok(tgtF >= 0, 'con sovrapposizione il target esiste ' + tgtF);
  const k = before.filter(x => x !== 'subject').indexOf('heroTitle');
  ev("moveLayer('heroTitle',1)");
  const after = JSON.parse(ev('JSON.stringify(layerList.map(l=>l.id))'));
  ok(after.indexOf('heroTitle') > before.indexOf('heroTitle'), 'porta avanti ' + before.indexOf('heroTitle') + '->' + after.indexOf('heroTitle'));
  const hbOrder = JSON.parse(ev('JSON.stringify(hitBoxes.map(b=>b.id))'));
  ok(hbOrder.indexOf('heroTitle') === after.indexOf('heroTitle'), 'ordine hitbox = ordine livelli');
  ev("moveLayer('heroTitle',-1,true)");
  ok(JSON.parse(ev('JSON.stringify(layerList.map(l=>l.id))'))[0] === 'heroTitle', 'Maiusc: in fondo');
  ev("moveLayer('heroTitle',1,true)");
  const lst = JSON.parse(ev('JSON.stringify(layerList.map(l=>l.id))'));
  ok(lst[lst.length - 1] === 'heroTitle', 'Maiusc: in primo piano');
  ev("elementOffsets.heroTitle={x:0,y:0,s:1}");
  ev("resetLayerOrder()");
  // blocco
  ev("toggleLayer('scheduleCard','locked')");
  const sb = JSON.parse(ev("JSON.stringify(hitBoxes.find(b=>b.id==='scheduleCard'))"));
  ok(sb.locked === true, 'bloccato ma presente in hitBoxes');
  const hit = ev(`(()=>{const h=hitTest({x:${sb.x + 5},y:${sb.y + 5}}); return h?h.id:null})()`);
  ok(hit !== 'scheduleCard', 'bloccato: non cliccabile (' + hit + ')');
  ev("unlockAllLayers()");
  // stato
  ev("elementOffsets.heroTitle={x:0,y:560,s:1}; renderGraphic(true); moveLayer('heroTitle',1,true); toggleLayer('footerCta','hidden')");
  const snapL = JSON.parse(ev('snapshot().core'));
  ok(snapL.z && snapL.z['announce:editorial'] && snapL.offsets.footerCta.hidden === true, 'stato livelli');
  await ev('newProject()'); await sleep(100);
  ok(!ev("layerList.some(l=>l.hidden)") && Object.keys(ev('zCustom')).length === 0, 'new resetta livelli');
  await ev('applyState(' + JSON.stringify(snapL) + ', {})');
  ok(ev("layerList.find(l=>l.id==='footerCta').hidden") === true, 'restore livelli');
  ev("resetAllOffsets()");
  ok(!ev("layerList.some(l=>l.hidden)"), 'reset layout rimuove nascosti');
  // tutte le modalita' con i livelli
  for (const lay of ['editorial', 'poster']) for (const m of ['announce', 'roster', 'matchday']) { ev(`setLayout('${lay}'); setMode('${m}'); renderGraphic(true)`); ok(ev('layerList.length') > 3, `livelli ${lay}/${m}: ` + ev('layerList.length')); }
  // sfondo mappa
  ev("subjectImg={width:10,height:10,src:'x'}; subjectMode='backdrop'; setMode('announce'); renderGraphic(true)");
  ok(ev("layerList[0].id") === 'subject' && ev("layerList[0].fixed") === true, 'mappa in fondo e fissa');
  ev("toggleLayer('subject','hidden')");
  ok(!ev("hitBoxes.some(b=>b.id==='subject')"), 'mappa nascosta');
  ev("toggleLayer('subject','hidden'); subjectImg=null");
  // ---- zoom ----
  ok(ev('zoomMode') === 'fit', 'zoom di partenza = adatta');
  ev('zoomActual()'); ok(ev('effZoom()') === 1 && d.getElementById('zoomLabel').textContent === '100%', 'zoom 100%');
  ev('zoomIn()'); ok(ev('effZoom()') === 1.25 && ev('canvas.style.width') === '1350px', 'zoom in ' + ev('canvas.style.width'));
  ev('zoomOut(); zoomOut()'); ok(ev('effZoom()') === 0.75, 'zoom out x2');
  ev('zoomFit()'); ok(ev('zoomMode') === 'fit' && d.getElementById('zoomFitBtn').className.includes('on'), 'adatta');
  ev("setZoom(3); zoomIn()"); ok(ev('effZoom()') === 3, 'zoom massimo');
  ev("setZoom(0.1); zoomOut()"); ok(ev('effZoom()') === 0.1, 'zoom minimo');
  const wheel = new w.WheelEvent('wheel', { ctrlKey: true, deltaY: -100, bubbles: true, cancelable: true });
  ev("setZoom(1)"); d.getElementById('stage').dispatchEvent(wheel);
  ok(ev('effZoom()') > 1 && wheel.defaultPrevented, 'ctrl+rotella ingrandisce');
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: '0', ctrlKey: true, bubbles: true }));
  ok(ev('zoomMode') === 'fit', 'Ctrl+0 = adatta');
  ev("setFormat('story')"); ok(ev("canvas.dataset.size") === '1080x1920', 'cambio formato ricalcola zoom');
  ev("setFormat('post')");

  // ---- frecce da tastiera ----
  await ev('newProject()'); await sleep(100);
  ev("setMode('announce'); setLayout('editorial'); renderGraphic(true); selectedId='heroTitle'");
  const kd = (key, opts = {}) => d.dispatchEvent(new w.KeyboardEvent('keydown', Object.assign({ key, bubbles: true, cancelable: true }, opts)));
  kd('ArrowRight'); kd('ArrowDown'); kd('ArrowDown', { shiftKey: true });
  ok(ev('elementOffsets.heroTitle.x') === 1 && ev('elementOffsets.heroTitle.y') === 11, 'frecce spostano ' + JSON.stringify(ev('elementOffsets.heroTitle')));
  ev("selectedId='subject'; subjectImg={width:1,height:1,src:'x'}"); const ix0 = parseInt(d.getElementById('imgX').value); kd('ArrowLeft', { shiftKey: true });
  ok(parseInt(d.getElementById('imgX').value) === ix0 - 10, 'frecce spostano agente'); ev("subjectImg=null; selectedId=null");
  ev("selectedId='scheduleCard'; toggleLayer('scheduleCard','locked'); selectedId='scheduleCard'");
  const ox = ev("getOffset('scheduleCard').x"); kd('ArrowRight'); ok(ev("getOffset('scheduleCard').x") === ox, 'bloccato: le frecce non lo spostano');
  ev("unlockAllLayers(); selectedId=null");
  // ---- testi liberi ----
  await ev('newProject()'); await sleep(100);
  ev("addFreeText(); addFreeText()");
  ok(ev('freeTexts.length') === 2 && d.querySelectorAll('#freeTextsList textarea').length === 2, 'aggiungi testi');
  ev("updateFree(0,'text','CIAO'+String.fromCharCode(10)+'MONDO'); updateFree(0,'align','right'); updateFree(0,'font','mono'); updateFree(0,'size','90'); updateFree(0,'color','accent')");
  ev('renderGraphic(true)');
  ok(ev("layerList.some(l=>l.id==='freeText_0')") && ev("layerList.some(l=>l.id==='freeText_1')"), 'livelli testo libero');
  const fb = JSON.parse(ev("JSON.stringify(hitBoxes.find(b=>b.id==='freeText_0'))"));
  ok(fb && fb.w >= 10 && fb.h > 150, 'hitbox testo libero ' + JSON.stringify(fb));
  global.__fonts = []; global.__al = []; ev('renderGraphic(true)');
  ok(global.__fonts.some(f => /^700 90px "JetBrains Mono"/.test(f)), 'font libero mono 90');
  ok(global.__al.includes('right'), 'allineamento libero a destra');
  const snapF = JSON.parse(ev('snapshot().core'));
  ok(snapF.free.length === 2 && snapF.free[0].align === 'right', 'stato testi liberi');
  ev("elementOffsets.freeText_1={x:5,y:6,s:1}; removeFreeText(0)");
  ok(ev('freeTexts.length') === 1 && ev("elementOffsets.freeText_0.x") === 5, 'rimozione sposta le posizioni');
  await ev('newProject()'); await sleep(100);
  ok(ev('freeTexts.length') === 0, 'new azzera testi liberi');
  await ev('applyState(' + JSON.stringify(snapF) + ', {})');
  ok(ev('freeTexts.length') === 2 && d.querySelectorAll('#freeTextsList textarea').length === 2, 'restore testi liberi');
  for (let n = 0; n < 8; n++) ev('addFreeText()'); ok(ev('freeTexts.length') === 8 && d.getElementById('btnAddFree').disabled, 'massimo 8');
  console.log(fails ? 'FAILS ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
})();
