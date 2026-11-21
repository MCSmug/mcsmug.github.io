(function () {
  'use strict';
  const D = window.RIG_DATA;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const de1 = n => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const de0 = n => Math.round(n).toLocaleString('de-DE');

  // localStorage can throw in private mode or when blocked; the tool must still work.
  const store = {
    get(k, d) { try { const v = localStorage.getItem('rigtool:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('rigtool:' + k, JSON.stringify(v)); } catch (e) { /* not persisted */ } }
  };

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  async function copyText(txt, okMsg) {
    try { await navigator.clipboard.writeText(txt); toast(okMsg || 'Kopiert'); }
    catch (e) { toast('Kopieren blockiert. Text bitte von Hand markieren.'); }
  }

  const savedRig = store.get('hw', {}) || {};
  const state = {
    rig: { gpu: savedRig.gpu || '', cpu: savedRig.cpu || '2', ram: savedRig.ram || '32', mode: savedRig.mode || 'single', res: savedRig.res || '', hz: savedRig.hz || '' },
    goal: store.get('goal', savedRig.goal || 'balanced'),
    overrides: store.get('overrides', {}) || {},
    scan: store.get('scan', null),
    ffb: store.get('ffb', { type: 'dd', nm: 8 }),
    fov: store.get('fov', null),
    checks: store.get('checks', {}) || {}
  };
  const saveRig = () => store.set('hw', state.rig);

  // GPU detection and matching
  const norm = s => String(s).toLowerCase().replace(/geforce|radeon|nvidia|amd|intel|\(r\)|\(tm\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  const gpusByLength = D.GPUS.slice().sort((a, b) => norm(b[0]).length - norm(a[0]).length);
  function matchGpu(name) {
    if (!name) return null;
    const n = ' ' + norm(name) + ' ';
    const hit = gpusByLength.find(g => n.includes(' ' + norm(g[0]) + ' '));
    return hit ? hit[0] : null;
  }
  function browserGpu() {
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : null;
    } catch (e) { return null; }
  }
  const detectedRenderer = browserGpu();
  const detectedGpu = matchGpu(detectedRenderer);
  if (!state.rig.gpu && detectedGpu) state.rig.gpu = detectedGpu;

  const INTEGRATED = /intel\(r\) (uhd|iris|hd)|radeon\(tm\) graphics|microsoft basic|parsec|virtual/i;
  function scanGpu(sc) {
    const list = (sc && sc.gpu) || [];
    return list.find(g => matchGpu(g.name)) || list.find(g => !INTEGRATED.test(g.name || '')) || list[0] || null;
  }
  function cpuTierFromName(n) {
    n = n || '';
    if (/X3D|i9-1[34]\d{3}|Ultra 9|Ryzen 9 [79]\d{3}/i.test(n)) return 4;
    if (/i7-1[2-4]\d{3}|i9-1[12]\d{3}|Ultra 7|Ryzen 7 [579]\d{3}|Ryzen 9 5\d{3}/i.test(n)) return 3;
    if (/i5-1[2-4]\d{3}|i7-1[01]\d{3}|i9-(9|10|11)\d{3}|Ultra 5|Ryzen 5 [579]\d{3}|Ryzen 7 [23]\d{3}|Ryzen 9 3\d{3}/i.test(n)) return 2;
    return 1;
  }
  const wheelOf = sc => ((sc && sc.inputDevices) || []).find(d => D.WHEEL_VENDORS[d.vid]) || null;

  // Rig form
  const gpuSel = $('#gpu');
  gpuSel.innerHTML = '<option value="">Bitte wählen</option>' + ['NVIDIA', 'AMD', 'Intel'].map(b =>
    '<optgroup label="' + b + '">' + D.GPUS.filter(g => g[0].startsWith(b)).map(g => '<option value="' + esc(g[0]) + '">' + esc(g[0].slice(b.length + 1)) + '</option>').join('') + '</optgroup>').join('');
  $('#cpu').innerHTML = D.CPU_TIERS.map(t => '<option value="' + t.id + '">' + t.label + ' · ' + t.hint + '</option>').join('');
  $('#mode').innerHTML = Object.entries(D.DISPLAY).map(([k, v]) => '<option value="' + k + '">' + v.label + '</option>').join('');

  function fillDisplayOptions() {
    const m = state.rig.mode, res = $('#res'), hz = $('#hz');
    res.innerHTML = D.DISPLAY[m].res.map(r => '<option value="' + r[0] + '">' + r[1] + '</option>').join('');
    hz.innerHTML = (m === 'vr' ? D.HZ.vr : D.HZ.flat).map(h => '<option value="' + h + '">' + h + ' Hz</option>').join('');
    addOption(res, state.rig.res, state.rig.res && state.rig.res.includes('x') ? (m === 'triple' ? '3 × ' : '') + state.rig.res.replace('x', ' × ') : state.rig.res);
    addOption(hz, state.rig.hz, state.rig.hz + ' Hz');
    if (![...res.options].some(o => o.value === state.rig.res)) state.rig.res = res.options[0].value;
    if (![...hz.options].some(o => o.value === String(state.rig.hz))) state.rig.hz = m === 'vr' ? '90' : '144';
    res.value = state.rig.res; hz.value = String(state.rig.hz);
    $('#resLabel').textContent = m === 'vr' ? 'Headset' : m === 'triple' ? 'Auflösung pro Monitor' : 'Auflösung';
  }
  function addOption(sel, value, label) {
    if (!value || [...sel.options].some(o => o.value === String(value))) return;
    if (sel.id === 'res' && state.rig.mode === 'vr' ? !D.VR_EYE[value] : sel.id === 'res' && !/^\d+x\d+$/.test(value)) return;
    sel.insertAdjacentHTML('beforeend', '<option value="' + esc(value) + '">' + esc(label) + '</option>');
  }
  function syncRigForm() {
    gpuSel.value = state.rig.gpu; $('#cpu').value = state.rig.cpu; $('#ram').value = state.rig.ram; $('#mode').value = state.rig.mode;
    fillDisplayOptions();
    const d = $('#gpuDetect');
    if (state.scan) d.textContent = 'Werte aus dem System-Scan übernommen. Du kannst sie hier überschreiben.';
    else if (detectedGpu) d.textContent = 'Grafikkarte vom Browser erkannt: ' + detectedGpu + '.';
    else d.textContent = detectedRenderer ? 'Der Browser meldet „' + detectedRenderer + '“. Das lässt sich keiner Karte zuordnen, bitte auswählen.' : 'Der Browser gibt die Grafikkarte nicht preis. Bitte auswählen oder den Scan nutzen.';
  }
  [['gpu', 'gpu'], ['cpu', 'cpu'], ['ram', 'ram'], ['res', 'res'], ['hz', 'hz']].forEach(([id, key]) => $('#' + id).addEventListener('change', e => { state.rig[key] = e.target.value; rigChanged(); }));
  $('#mode').addEventListener('change', e => { state.rig.mode = e.target.value; state.rig.res = ''; fillDisplayOptions(); state.rig.res = $('#res').value; state.rig.hz = $('#hz').value; rigChanged(); });

  function rigChanged() {
    saveRig();
    state.overrides = {}; store.set('overrides', {});
    renderAll();
  }

  // Frame-time model. Units are calibrated so an RTX 4090 at 1440p keeps everything high above 144 FPS.
  const GPU_BASE = 7, CPU_BASE = 4;
  function rigModel() {
    const r = state.rig, gpu = D.GPUS.find(g => g[0] === r.gpu);
    let w, h, screens = 1, overhead = 1, views = 1;
    if (r.mode === 'vr') { [w, h] = D.VR_EYE[r.res] || D.VR_EYE.quest3; screens = 2; overhead = 1.25; views = 1.3; }
    else { [w, h] = (r.res || '1920x1080').split('x').map(Number); if (r.mode === 'triple') { screens = 3; views = 1.35; } }
    const mpix = w * h * screens * overhead / 1e6;
    const cap = (gpu ? gpu[1] : 45) / 6;
    const tier = D.CPU_TIERS.find(t => String(t.id) === String(r.cpu)) || D.CPU_TIERS[1];
    const hz = +r.hz || 60;
    const vram = state.scan && scanGpu(state.scan) ? scanGpu(state.scan).vramGB : null;
    return { gpu, w, h, screens, mpix, msPerUnit: (mpix / 2.0736) / cap, cpuFactor: views / tier.perf, tier, hz, budget: 1000 / hz, vram };
  }
  const goalIdx = () => Math.max(0, D.GOALS.findIndex(g => g.id === state.goal));
  const optG = o => o[1] || 0, optC = o => o[2] || 0;

  function evaluate(levels, m) {
    let g = GPU_BASE * m.msPerUnit, c = CPU_BASE * m.cpuFactor;
    const parts = D.SETTINGS.map(s => {
      const o = s.opts[levels[s.id]];
      const pg = optG(o) * m.msPerUnit, pc = optC(o) * m.cpuFactor;
      g += pg; c += pc;
      return { id: s.id, name: s.name, g: pg, c: pc };
    });
    return { gpuMs: g, cpuMs: c, parts, fps: 1000 / Math.max(g, c) };
  }
  function maxLevel(s, m) {
    if (s.vram && m.vram && m.vram < s.vram) return s.opts.length - 2;
    return s.opts.length - 1;
  }
  // Greedy: always buy the step with the most value per millisecond that still fits the budget.
  function recommend(m) {
    const gi = goalIdx(), limit = m.budget * D.GOALS[gi].headroom;
    const lv = {}; D.SETTINGS.forEach(s => { lv[s.id] = 0; });
    let cur = evaluate(lv, m);
    for (;;) {
      let best = null, bestScore = 0;
      D.SETTINGS.forEach(s => {
        const w = s.w[gi]; if (!w || lv[s.id] >= maxLevel(s, m)) return;
        const a = s.opts[lv[s.id]], b = s.opts[lv[s.id] + 1];
        const dg = (optG(b) - optG(a)) * m.msPerUnit, dc = (optC(b) - optC(a)) * m.cpuFactor;
        if (cur.gpuMs + dg > limit || cur.cpuMs + dc > limit) return;
        const score = (w / (1 + 0.35 * lv[s.id])) / ((dg + dc) / limit + 0.002);
        if (score > bestScore) { bestScore = score; best = s.id; }
      });
      if (!best) break;
      lv[best]++; cur = evaluate(lv, m);
    }
    return lv;
  }
  function currentLevels(rec) {
    const lv = {};
    D.SETTINGS.forEach(s => { const o = state.overrides[s.id]; lv[s.id] = o != null && o < s.opts.length ? o : rec[s.id]; });
    return lv;
  }
  const stateClass = (ms, budget) => ms <= budget * 0.92 ? 'ok' : ms <= budget ? 'tight' : 'over';

  // Views
  let view = store.get('view', 'rig');
  function showView(id) {
    if (!document.getElementById('v-' + id)) id = 'rig';
    view = id; store.set('view', id);
    $$('.rail button').forEach(b => b.setAttribute('aria-current', b.dataset.view === id ? 'true' : 'false'));
    $$('.view').forEach(v => v.classList.toggle('show', v.id === 'v-' + id));
  }
  $$('.rail button').forEach(b => b.addEventListener('click', () => { showView(b.dataset.view); window.scrollTo({ top: 0 }); }));
  document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) { e.preventDefault(); showView(g.dataset.goto); window.scrollTo({ top: 0 }); } });

  function displayLabel(r) {
    if (r.mode === 'vr') { const o = D.DISPLAY.vr.res.find(x => x[0] === r.res); return o ? o[1] : 'VR'; }
    const res = (r.res || '').replace('x', ' × ');
    return (r.mode === 'triple' ? '3 × ' : '') + res;
  }
  function renderRigStrip() {
    const r = state.rig, tier = D.CPU_TIERS.find(t => String(t.id) === String(r.cpu));
    const sc = state.scan, cpuName = sc && sc.cpu && sc.cpu[0] ? sc.cpu[0].name.replace(/\s*\d+-Core Processor/i, '') : null;
    const wheel = wheelOf(sc);
    const cells = [
      ['Grafikkarte', r.gpu ? r.gpu.replace(/^(NVIDIA|AMD|Intel) /, '') : 'nicht gewählt', !r.gpu],
      ['Prozessor', cpuName || (tier ? tier.label : '–')],
      ['Anzeige', displayLabel(r)],
      ['Ziel', r.hz + ' Hz'],
      ['Lenkrad', wheel ? wheel.name : (sc ? 'nicht erkannt' : 'Scan fehlt'), !wheel]
    ];
    $('#rigstrip').innerHTML = cells.map(([k, v, unset]) => '<div class="cell"><div class="k">' + k + '</div><div class="v' + (unset ? ' unset' : '') + '" title="' + esc(v) + '">' + esc(v) + '</div></div>').join('') +
      (view !== 'rig' ? '<button class="btn small edit" data-goto="rig">Rig ändern</button>' : '');
    $('#st-rig').textContent = sc ? 'Scan' : r.gpu ? 'manuell' : 'offen';
    $('#st-rig').className = 'st ' + (r.gpu ? 'ok' : 'tight');
  }

  function renderScanFacts() {
    const sc = state.scan, box = $('#scanFacts');
    if (!sc) { box.innerHTML = ''; return; }
    const g = scanGpu(sc), cpu = sc.cpu && sc.cpu[0], mons = (sc.monitors && sc.monitors.active) || [];
    const rows = [
      ['Stand', new Date(sc.created).toLocaleString('de-DE')],
      ['GPU', g ? g.name + (g.vramGB ? ', ' + g.vramGB + ' GB' : '') + (g.driverDate ? ', Treiber vom ' + new Date(g.driverDate).toLocaleDateString('de-DE') : '') : '–'],
      ['CPU', cpu ? cpu.name + ', ' + cpu.cores + ' Kerne' : '–'],
      ['RAM', sc.ram ? sc.ram.totalGB + ' GB' : '–'],
      ['Monitore', mons.length ? mons.map(m => m.width + ' × ' + m.height + ' @ ' + m.hz + ' Hz').join(', ') : '–'],
      ['Geräte', (sc.inputDevices || []).map(d => d.name).join(', ') || 'keine erkannt'],
      ['VR', sc.vr && sc.vr.openxrRuntime ? sc.vr.openxrRuntime.replace(/\.json$/i, '') : 'keine Umgebung'],
      ['iRacing', sc.iracing && sc.iracing.documentsFound ? 'Ordner gefunden' : 'Ordner nicht gefunden']
    ];
    box.innerHTML = '<dl class="facts">' + rows.map(([k, v]) => '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>').join('') + '</dl>';
  }

  function applyScan(sc) {
    state.scan = sc;
    const g = scanGpu(sc), m = g && matchGpu(g.name);
    if (m) state.rig.gpu = m;
    if (sc.cpu && sc.cpu[0]) state.rig.cpu = String(cpuTierFromName(sc.cpu[0].name));
    if (sc.ram && sc.ram.totalGB) { const t = sc.ram.totalGB; state.rig.ram = t <= 8 ? '8' : t <= 16 ? '16' : t <= 32 ? '32' : '64'; }
    const mons = (sc.monitors && sc.monitors.active) || [];
    if (mons.length) {
      const key = x => x.width + 'x' + x.height, groups = {};
      mons.forEach(x => (groups[key(x)] = groups[key(x)] || []).push(x));
      const triple = Object.values(groups).find(gr => gr.length >= 3);
      const main = triple ? triple[0] : (mons.find(x => x.primary) || mons[0]);
      state.rig.mode = triple ? 'triple' : main.width / main.height >= 2.2 ? 'ultrawide' : 'single';
      state.rig.res = key(main);
      state.rig.hz = String(Math.min(...(triple || [main]).map(x => x.hz || 60)));
      const fv = state.fov || {};
      fv.aspect = nearestAspect(main.width / main.height); state.fov = fv; store.set('fov', fv);
    }
    const files = (sc.iracing && sc.iracing.files) || [];
    files.forEach(f => putFile({ name: f.name, size: f.size, isText: f.isText, text: f.text, hex: f.hex }));
    const wheel = wheelOf(sc);
    if (wheel && /Logitech/.test(D.WHEEL_VENDORS[wheel.vid]) && !/pro/i.test(wheel.name)) { state.ffb.type = 'gear'; store.set('ffb', state.ffb); }
    const slim = JSON.parse(JSON.stringify(sc));
    if (slim.iracing) slim.iracing.files = (slim.iracing.files || []).map(f => ({ name: f.name, size: f.size }));
    store.set('scan', slim);
    syncRigForm(); rigChanged();
  }
  $('#loadScan').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse((await f.text()).replace(/^﻿/, ''));
      if (d.rigtool !== 'system-scan') throw new Error('wrong file');
      applyScan(d); toast('Scan geladen');
    } catch (err) { toast('Das ist keine rigtool-system.json'); }
    e.target.value = '';
  });
  $('#copyCmd').addEventListener('click', () => copyText($('#scanCmd').textContent, 'Befehl kopiert'));

  // Graphics view
  $('#goal').innerHTML = D.GOALS.map(g => '<button data-goal="' + g.id + '">' + g.label + '<small>' + g.hint + '</small></button>').join('');
  $('#goal').addEventListener('click', e => {
    const b = e.target.closest('[data-goal]'); if (!b) return;
    state.goal = b.dataset.goal; store.set('goal', state.goal);
    state.overrides = {}; store.set('overrides', {});
    renderGfx();
  });
  $('#srows').addEventListener('click', e => {
    const b = e.target.closest('[data-set]'); if (!b) return;
    state.overrides[b.dataset.set] = +b.dataset.lv; store.set('overrides', state.overrides);
    renderGfx();
  });
  $('#resetGfx').addEventListener('click', () => { state.overrides = {}; store.set('overrides', {}); renderGfx(); toast('Empfehlung wiederhergestellt'); });
  $('#copyGfx').addEventListener('click', () => copyText(gfxText(), 'Einstellungen kopiert'));

  let lastGfx = null;
  function renderGfx() {
    const m = rigModel(), rec = recommend(m), lv = currentLevels(rec), ev = evaluate(lv, m);
    lastGfx = { m, rec, lv, ev };
    $$('#goal button').forEach(b => b.setAttribute('aria-pressed', b.dataset.goal === state.goal ? 'true' : 'false'));

    const scale = Math.max(m.budget * 1.4, ev.gpuMs, ev.cpuMs) * 1.04;
    const pct = ms => (ms / scale * 100).toFixed(2) + '%';
    const lane = (el, base, key, total) => {
      const segs = ev.parts.filter(p => p[key] > 0.0005);
      let html = '<div class="fill"><i class="base" style="width:' + pct(base) + '" title="Grundlast ' + de1(base) + ' ms"></i>' +
        segs.map(p => '<i style="width:' + pct(p[key]) + '" title="' + esc(p.name) + ': ' + de1(p[key]) + ' ms"></i>').join('') + '</div>';
      if (total > m.budget) html += '<div class="over-zone" style="left:' + pct(m.budget) + ';width:' + pct(total - m.budget) + '"></div>';
      html += '<div class="limit" style="left:' + pct(m.budget) + '"><span>' + de1(m.budget) + ' ms</span></div>';
      el.innerHTML = html;
    };
    lane($('#gpuTrack'), GPU_BASE * m.msPerUnit, 'g', ev.gpuMs);
    lane($('#cpuTrack'), CPU_BASE * m.cpuFactor, 'c', ev.cpuMs);
    $('#gpuMs').innerHTML = '<span class="' + stateClass(ev.gpuMs, m.budget) + '">' + de1(ev.gpuMs) + ' ms</span>';
    $('#cpuMs').innerHTML = '<span class="' + stateClass(ev.cpuMs, m.budget) + '">' + de1(ev.cpuMs) + ' ms</span>';
    $('#gpuLaneName').textContent = m.gpu ? m.gpu[0].replace(/^(NVIDIA|AMD|Intel) /, '') : 'unbekannt, gerechnet als Mittelklasse';
    $('#cpuLaneName').textContent = m.tier.label;
    $('#scale').innerHTML = '<span>0 ms</span><span>' + de1(scale / 2) + ' ms</span><span>' + de1(scale) + ' ms</span>';

    const worst = Math.max(ev.gpuMs, ev.cpuMs), st = stateClass(worst, m.budget);
    const fps = Math.min(ev.fps, 999);
    $('#fpsBig').innerHTML = '<span class="' + st + '">' + de0(fps) + '</span>';
    $('#fpsLbl').innerHTML = 'FPS geschätzt, Ziel ' + m.hz + '<br>' + (st === 'over' ? 'Engpass: ' + (ev.gpuMs > ev.cpuMs ? 'Grafikkarte' : 'Prozessor') : st === 'tight' ? 'knapp im Budget' : 'Reserve: ' + de1(m.budget - worst) + ' ms');
    $('#st-gfx').textContent = de0(fps) + ' FPS'; $('#st-gfx').className = 'st ' + st;

    let html = '', grp = '';
    D.SETTINGS.forEach(s => {
      if (s.group !== grp) { grp = s.group; html += '<div class="sgroup">' + esc(grp) + '</div>'; }
      const cur = lv[s.id], o = s.opts[cur], ms = optG(o) * m.msPerUnit + optC(o) * m.cpuFactor;
      const share = ms / m.budget * 100;
      html += '<div class="srow' + (cur !== rec[s.id] ? ' changed' : '') + '"><div class="name">' + esc(s.name) + (s.note ? '<small>' + esc(s.note) + '</small>' : '') + '</div>' +
        '<div class="seg" role="group" aria-label="' + esc(s.name) + '">' + s.opts.map((op, i) =>
          '<button data-set="' + s.id + '" data-lv="' + i + '" aria-pressed="' + (i === cur) + '"' + (i === rec[s.id] ? ' class="rec" title="Empfehlung"' : '') + (i > maxLevel(s, m) ? ' disabled style="opacity:.4;cursor:not-allowed" title="Zu wenig Grafikspeicher"' : '') + '>' + esc(op[0]) + '</button>').join('') + '</div>' +
        '<div class="cost num">' + (share < 0.5 ? '–' : de0(share) + ' %') + '</div></div>';
    });
    $('#srows').innerHTML = html;
    renderTips(m, ev);
  }

  function renderTips(m, ev) {
    const r = state.rig, sc = state.scan, tips = [];
    if (!m.gpu) tips.push('Wähle unter „Dein Rig“ die Grafikkarte, sonst rechnet das Tool mit einer Mittelklasse-Karte.');
    if (ev.gpuMs > m.budget && lastGfx && Object.keys(state.overrides).length === 0) tips.push('Selbst auf niedrigen Einstellungen reicht das Budget nicht. Eine niedrigere Bildwiederholrate (z. B. ' + (r.mode === 'vr' ? '72 oder 80 Hz' : '100 oder 120 Hz') + ') bringt mehr als jeder einzelne Regler.');
    if (ev.cpuMs > ev.gpuMs && ev.cpuMs > m.budget * 0.85) tips.push('Dein Prozessor ist der Engpass. Weniger gerenderte Fahrzeuge und Spiegel-Fahrzeuge helfen am meisten, Grafik-Regler kaum.');
    if (r.mode === 'triple') tips.push('Triple-Screen-Projektion einschalten und die Werte aus „Sichtfeld“ eintragen. Nur dann stimmen die Seitenbildschirme.');
    if (r.mode === 'vr') tips.push('Über OpenXR starten und die Render-Auflösung zuerst bei 100 % lassen. Erst erhöhen, wenn die FPS im vollen Feld stabil bleiben.');
    if (r.mode !== 'vr') tips.push('FPS-Limit in iRacing auf ' + r.hz + ' setzen. Gleichmäßige Frametimes fühlen sich flüssiger an als schwankende hohe FPS.');
    if (+r.ram <= 8) tips.push('8 GB Arbeitsspeicher sind für iRacing knapp. Ab 16 GB verschwinden Nachladeruckler.');
    if (m.vram && m.vram < 8) tips.push('Deine Karte hat ' + m.vram + ' GB Grafikspeicher. Fahrzeug-Texturen deshalb höchstens auf Mittel.');
    if (sc && sc.vr && sc.vr.openxrRuntime && r.mode !== 'vr') tips.push('Auf deinem PC ist eine VR-Umgebung installiert. Fährst du auch in VR, stell unter „Dein Rig“ auf VR um. Das ergibt eine eigene Empfehlung.');
    tips.push('Teste im vollen Feld, z. B. ein KI-Rennen mit maximaler Fahrzeuganzahl am Start. Das ist der härteste Moment für Prozessor und Grafikkarte.');
    $('#tips').innerHTML = tips.map(t => '<li>' + esc(t) + '</li>').join('');
  }
  function gfxText() {
    if (!lastGfx) renderGfx();
    const { m, lv, ev } = lastGfx, r = state.rig;
    const lines = ['iRacing Grafik (Rig-Tool)', (m.gpu ? m.gpu[0] : 'GPU unbekannt') + ' | ' + displayLabel(r) + ' @ ' + r.hz + ' Hz | Ziel: ' + D.GOALS[goalIdx()].label, 'Geschätzt: ' + de0(Math.min(ev.fps, 999)) + ' FPS (GPU ' + de1(ev.gpuMs) + ' ms, CPU ' + de1(ev.cpuMs) + ' ms, Budget ' + de1(m.budget) + ' ms)', ''];
    lines.push('FPS-Limit: ' + (r.mode === 'vr' ? 'Headset' : r.hz));
    D.SETTINGS.forEach(s => lines.push(s.name + ': ' + s.opts[lv[s.id]][0]));
    return lines.join('\n');
  }

  // Field of view
  const ASPECTS = [1.7778, 1.6, 2.3889, 3.5556];
  const nearestAspect = a => String(ASPECTS.reduce((p, c) => Math.abs(c - a) < Math.abs(p - a) ? c : p));
  function fovInit() {
    const r = state.rig, f = state.fov || {};
    let aspect = f.aspect;
    if (!aspect && r.res && /x/.test(r.res)) { const [w, h] = r.res.split('x').map(Number); aspect = nearestAspect(w / h); }
    $('#fovDiag').value = f.diag || (r.mode === 'ultrawide' ? 34 : 27);
    $('#fovAspect').value = aspect || '1.7778';
    $('#fovDist').value = f.dist || 70;
    $('#fovBezel').value = f.bezel != null ? f.bezel : 10;
  }
  ['fovDiag', 'fovAspect', 'fovDist', 'fovBezel'].forEach(id => $('#' + id).addEventListener('input', () => {
    state.fov = { diag: +$('#fovDiag').value, aspect: $('#fovAspect').value, dist: +$('#fovDist').value, bezel: +$('#fovBezel').value };
    store.set('fov', state.fov); renderFov();
  }));
  const deg = rad => rad * 180 / Math.PI;
  function renderFov() {
    const triple = state.rig.mode === 'triple', vr = state.rig.mode === 'vr';
    $('#bezelWrap').style.display = triple ? '' : 'none';
    const diag = (+$('#fovDiag').value || 27) * 2.54, ar = +$('#fovAspect').value || 1.7778;
    const d = Math.max(20, +$('#fovDist').value || 70), b = (+$('#fovBezel').value || 0) / 10;
    const W = diag * ar / Math.sqrt(ar * ar + 1), H = diag / Math.sqrt(ar * ar + 1);
    const h1 = 2 * Math.atan(W / 2 / d), v = 2 * Math.atan(H / 2 / d);
    const side = 2 * Math.atan((W / 2 + b) / d);
    const out = [];
    if (vr) out.push(['Hinweis', 'In VR bestimmt die Brille das Sichtfeld', true]);
    out.push(['Horizontal' + (triple ? ' pro Bildschirm' : ''), de1(deg(h1)) + '°', !vr]);
    out.push(['Vertikal', de1(deg(v)) + '°']);
    if (triple) { out.push(['Winkel der Seitenbildschirme', de1(deg(side)) + '°']); out.push(['Horizontal gesamt', de0(deg(h1) * 3) + '°']); }
    out.push(['Bildbreite', de1(W) + ' cm']);
    $('#fovOut').innerHTML = out.map(([k, val, main]) => '<div' + (main ? ' class="main-v"' : '') + '><div class="k">' + k + '</div><div class="v">' + val + '</div></div>').join('');
    drawTopdown(W, d, b, triple ? side : 0, triple);
  }
  function drawTopdown(W, d, b, theta, triple) {
    const half = W / 2 + (triple ? b : 0);
    const reach = triple ? half + (W + b) * Math.cos(theta) : W / 2;
    const s = Math.min(170 / reach, 190 / d);
    const ex = 200, ey = 235, P = (x, y) => (ex + x * s).toFixed(1) + ',' + (ey - y * s).toFixed(1);
    const panels = [[[-W / 2, d], [W / 2, d]]];
    if (triple) {
      const dir = [Math.cos(theta), -Math.sin(theta)];
      const j = [half, d];
      panels.push([[j[0] + b * dir[0], j[1] + b * dir[1]], [j[0] + (b + W) * dir[0], j[1] + (b + W) * dir[1]]]);
      panels.push(panels[1].map(([x, y]) => [-x, y]));
    }
    let svg = '';
    panels.forEach(([a, c]) => {
      svg += '<line x1="' + P(0, 0).split(',')[0] + '" y1="' + ey + '" x2="' + P(a[0], a[1]).split(',')[0] + '" y2="' + P(a[0], a[1]).split(',')[1] + '" stroke="#8A93B2" stroke-width="1" stroke-dasharray="3 4"/>';
      svg += '<line x1="' + ex + '" y1="' + ey + '" x2="' + P(c[0], c[1]).split(',')[0] + '" y2="' + P(c[0], c[1]).split(',')[1] + '" stroke="#8A93B2" stroke-width="1" stroke-dasharray="3 4"/>';
      svg += '<polyline points="' + P(a[0], a[1]) + ' ' + P(c[0], c[1]) + '" stroke="#EFEBE2" stroke-width="5" stroke-linecap="square" fill="none"/>';
    });
    svg += '<circle cx="' + ex + '" cy="' + ey + '" r="5" fill="#EFEBE2"/>';
    svg += '<text x="' + (ex + 10) + '" y="' + (ey + 4) + '" fill="#8A93B2" font-family="IBM Plex Mono, monospace" font-size="11">Auge</text>';
    svg += '<text x="' + ex + '" y="' + (ey - d * s - 12).toFixed(1) + '" fill="#8A93B2" font-family="IBM Plex Mono, monospace" font-size="11" text-anchor="middle">' + de0(d) + ' cm</text>';
    if (triple) svg += '<text x="390" y="20" fill="#EFEBE2" font-family="IBM Plex Mono, monospace" font-size="12" text-anchor="end">Winkel ' + de1(deg(theta)) + '°</text>';
    $('#fovSvg').innerHTML = svg;
  }

  // Force feedback
  function renderFfb() {
    const t = state.ffb.type, nm = +state.ffb.nm || 8, wheel = wheelOf(state.scan);
    $('#ffbType').value = t; $('#ffbNm').value = nm;
    $('#ffbNmWrap').style.display = t === 'dd' ? '' : 'none';
    $('#ffbDetected').textContent = wheel ? 'Laut Scan angeschlossen: ' + wheel.name + ' (' + D.WHEEL_VENDORS[wheel.vid] + '). Prüf, ob der Typ oben passt.' : '';
    const rows = [];
    if (t === 'dd') {
      rows.push(['Stärke', 'In iRacing auf der Strecke die Auto-Taste drücken. Sie setzt den Wert so, dass das Signal nicht am Anschlag ist. Willst du mehr Kraft, senk den Wert. Unter ' + de1(nm) + ' Nm (Drehmoment deiner Basis) solltest du nicht gehen, sonst schneidet die Basis Spitzen ab.']);
      rows.push(['Linearer Modus', 'An. Direct-Drive-Basen geben Kraft linear weiter, eine Korrekturkurve braucht es nicht.']);
      rows.push(['Minimale Kraft', '0 %. Eine Direct-Drive-Basis hat keine Totzone um die Mitte.']);
    } else {
      rows.push(['Stärke', 'Auf der Strecke die Auto-Taste drücken und von dort aus anpassen. Bei ' + (t === 'gear' ? 'Zahnrad' : 'Riemen') + '-Lenkrädern kommt das Signal schnell an den Anschlag. Lieber etwas weniger Kraft und dafür Details.']);
      rows.push(['Linearer Modus', 'Aus.']);
      rows.push(['Minimale Kraft', t === 'gear' ? '5 bis 10 %. Überbrückt das Spiel im Getriebe um die Mitte.' : '3 bis 6 %. Überbrückt die kleine Totzone um die Mitte.']);
    }
    rows.push(['Treiber-Software', 'Gesamtkraft auf 100 %. Zusatzeffekte wie Dämpfung, Reibung und Trägheit niedrig beginnen, sie überlagern das Signal aus iRacing.']);
    rows.push(['Lenkwinkel', 'Im Treiber den maximalen Winkel einstellen und das Lenkrad in iRacing kalibrieren. iRacing passt den Lenkanschlag pro Fahrzeug an.']);
    rows.push(['Pro Auto', 'Die Stärke speichert iRacing pro Fahrzeug. Nach einem Fahrzeugwechsel die Auto-Taste erneut drücken.']);
    $('#ffbOut').innerHTML = rows.map(([k, v]) => '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>').join('');
  }
  $('#ffbType').addEventListener('change', e => { state.ffb.type = e.target.value; store.set('ffb', state.ffb); renderFfb(); });
  $('#ffbNm').addEventListener('input', e => { state.ffb.nm = +e.target.value; store.set('ffb', state.ffb); renderFfb(); });

  // Bindings
  const FUNC_NAME = {}, FUNC_KIND = {};
  D.FUNCS.forEach(([, list]) => list.forEach(([id, n, k]) => { FUNC_NAME[id] = n; FUNC_KIND[id] = k; }));
  function loadProfiles() {
    let p = store.get('profiles', null);
    if (!p || typeof p !== 'object' || !Object.keys(p).length) p = { 'Allgemein': {}, 'GT3 / GT4': {}, 'GTP / LMDh': {}, 'Formel': {}, 'Oval': {} };
    const out = {};
    Object.entries(p).forEach(([name, v]) => {
      if (v && v.binds) { out[name] = v; return; }
      const cls = name === 'GT3' ? 'GT3 / GT4' : D.CLASSES[name] ? name : 'Allgemein';
      out[name] = { cls, binds: v || {} };
    });
    return out;
  }
  let profiles = loadProfiles();
  let current = store.get('currentProfile', Object.keys(profiles)[0]);
  if (!profiles[current]) current = Object.keys(profiles)[0];
  let learning = null, baseline = null;
  const saveProfiles = () => { store.set('profiles', profiles); store.set('currentProfile', current); };

  function renderProfileSelect() {
    $('#profile').innerHTML = Object.keys(profiles).map(n => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('');
    $('#profile').value = current;
  }
  const shortDev = id => String(id).replace(/\s*\((Vendor|STANDARD GAMEPAD).*\)\s*$/i, '').replace(/\s+/g, ' ').trim() || id;
  const bindKey = b => b.dev + '|' + b.type + '|' + b.i;
  function bindRow(id, binds, used) {
    const b = binds[id], conflict = b && used[bindKey(b)].length > 1, kind = FUNC_KIND[id];
    const as = learning === id ? '<span class="ok">' + (kind === 'axis' ? 'Achse bewegen …' : 'Taste drücken …') + '</span>'
      : b ? esc(shortDev(b.dev)) + ' · ' + (b.type === 'axis' ? 'Achse ' : 'Taste ') + (b.i + 1) + (conflict ? ' · doppelt' : '') : '<span class="muted">nicht belegt</span>';
    return '<tr class="' + [learning === id ? 'learning' : '', conflict ? 'conflict' : '', b ? '' : 'empty'].join(' ') + '"><td class="fn">' + esc(FUNC_NAME[id]) + '</td><td class="as">' + as + '</td>' +
      '<td class="ctl no-print"><button class="btn small" data-learn="' + id + '">' + (learning === id ? 'Abbrechen' : 'Zuweisen') + '</button>' +
      (b ? ' <button class="btn small del" data-clear="' + id + '" aria-label="' + esc(FUNC_NAME[id]) + ' löschen">Löschen</button>' : '') + '</td></tr>';
  }
  function renderBinds() {
    const prof = profiles[current], binds = prof.binds, wanted = D.CLASSES[prof.cls] || D.CLASSES['Allgemein'];
    const used = {}; Object.entries(binds).forEach(([f, b]) => (used[bindKey(b)] = used[bindKey(b)] || []).push(f));
    const table = ids => {
      let html = '<table class="binds">', grp = '';
      D.FUNCS.forEach(([g, list]) => list.forEach(([id]) => {
        if (!ids.includes(id)) return;
        if (g !== grp) { grp = g; html += '<tr><th colspan="3">' + esc(g) + '</th></tr>'; }
        html += bindRow(id, binds, used);
      }));
      return html + '</table>';
    };
    const others = Object.keys(FUNC_NAME).filter(id => !wanted.includes(id));
    const othersSet = others.filter(id => binds[id]).length;
    $('#bindTables').innerHTML =
      '<div class="fields no-print" style="margin-top:10px"><label class="f">Fahrzeugklasse dieses Profils<select id="profCls">' + Object.keys(D.CLASSES).map(c => '<option' + (c === prof.cls ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select></label></div>' +
      '<h3 style="margin-top:22px">Empfohlen für ' + esc(prof.cls) + '</h3>' + table(wanted) +
      '<details class="more"' + (othersSet ? ' open' : '') + '><summary>Weitere Funktionen (' + others.length + ')</summary>' + table(others) + '</details>';
    const done = wanted.filter(id => binds[id]).length;
    const conflicts = Object.values(used).filter(v => v.length > 1).length;
    $('#bindProgress').innerHTML = '<span class="' + (done === wanted.length ? 'ok' : 'tight') + '">' + done + ' von ' + wanted.length + ' belegt</span>' + (conflicts ? ' · <span class="over">' + conflicts + ' doppelt</span>' : '');
    $('#st-binds').textContent = done + '/' + wanted.length; $('#st-binds').className = 'st ' + (conflicts ? 'over' : done === wanted.length ? 'ok' : '');
  }
  $('#bindTables').addEventListener('change', e => {
    if (e.target.id !== 'profCls') return;
    profiles[current].cls = e.target.value; saveProfiles(); renderBinds(); renderChecks();
  });
  $('#bindTables').addEventListener('click', e => {
    const l = e.target.closest('[data-learn]'), c = e.target.closest('[data-clear]');
    if (l) {
      learning = learning === l.dataset.learn ? null : l.dataset.learn; baseline = snapshot();
      if (learning && !pads().length) toast('Drück zuerst eine Taste am Gerät, damit der Browser es erkennt');
      renderBinds();
    }
    if (c) { delete profiles[current].binds[c.dataset.clear]; saveProfiles(); renderBinds(); renderChecks(); }
  });
  $('#profile').addEventListener('change', e => { current = e.target.value; learning = null; saveProfiles(); renderBinds(); renderChecks(); });
  $('#newProfile').addEventListener('click', () => {
    const n = (prompt('Name des Profils, z. B. „Porsche 963“ oder „Mazda MX-5“:') || '').trim();
    if (!n) return;
    if (profiles[n]) { toast('Dieses Profil gibt es schon'); return; }
    profiles[n] = { cls: profiles[current].cls, binds: JSON.parse(JSON.stringify(profiles[current].binds)) };
    current = n; saveProfiles(); renderProfileSelect(); renderBinds();
    toast('Profil angelegt, Belegung von vorher übernommen');
  });
  $('#delProfile').addEventListener('click', () => {
    if (Object.keys(profiles).length < 2) { toast('Ein Profil muss bleiben'); return; }
    if (!confirm('Profil „' + current + '“ löschen?')) return;
    delete profiles[current]; current = Object.keys(profiles)[0]; saveProfiles(); renderProfileSelect(); renderBinds(); renderChecks();
  });
  $('#clearBinds').addEventListener('click', () => {
    if (!confirm('Alle Zuweisungen in „' + current + '“ löschen?')) return;
    profiles[current].binds = {}; saveProfiles(); renderBinds(); renderChecks();
  });
  $('#printBinds').addEventListener('click', () => window.print());
  $('#exportBinds').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ rigtool: 'profile', name: current, cls: profiles[current].cls, binds: profiles[current].binds }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rigtool-' + current.replace(/[^\w-]+/g, '_') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  });
  $('#importBinds').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d.binds || typeof d.binds !== 'object') throw new Error('no binds');
      let name = d.name || f.name.replace(/\.json$/, '');
      while (profiles[name]) name += ' (Import)';
      profiles[name] = { cls: D.CLASSES[d.cls] ? d.cls : 'Allgemein', binds: d.binds };
      current = name; saveProfiles(); renderProfileSelect(); renderBinds(); toast('Profil importiert');
    } catch (err) { toast('Die Datei ist kein Rig-Tool-Profil'); }
    e.target.value = '';
  });

  const pads = () => [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean);
  function snapshot() { const s = {}; pads().forEach(p => { s[p.index] = p.axes.slice(); }); return s; }
  let prev = {}, devSig = null;
  function renderDevices(list) {
    $('#devices').innerHTML = list.length ? list.map(p =>
      '<div class="dev" data-pad="' + p.index + '"><div class="dev-head"><span class="dev-name">' + esc(shortDev(p.id)) + '</span><span class="muted num">' + p.buttons.length + ' Tasten · ' + p.axes.length + ' Achsen</span></div>' +
      '<div class="btns">' + p.buttons.map((_, i) => '<span class="b" data-b="' + i + '">' + (i + 1) + '</span>').join('') + '</div>' +
      '<div class="axes">' + p.axes.map((_, i) => '<div class="ax">Achse ' + (i + 1) + '<div class="bar"><i data-a="' + i + '"></i></div></div>').join('') + '</div></div>').join('')
      : '<p class="muted" style="margin-top:12px">Noch kein Gerät erkannt. Drück eine Taste am Lenkrad.</p>';
  }
  function poll() {
    const list = pads(), sig = list.map(p => p.index + p.id + p.buttons.length).join('|');
    if (sig !== devSig) { devSig = sig; renderDevices(list); }
    list.forEach(p => {
      const node = document.querySelector('[data-pad="' + p.index + '"]'), pv = prev[p.index] || [];
      p.buttons.forEach((b, i) => {
        if (node && b.pressed !== pv[i]) { const n = node.querySelector('[data-b="' + i + '"]'); if (n) n.classList.toggle('on', b.pressed); }
        if (learning && b.pressed && !pv[i]) assign({ dev: p.id, type: 'btn', i });
      });
      p.axes.forEach((a, i) => {
        if (node) { const n = node.querySelector('[data-a="' + i + '"]'); if (n) n.style.width = ((a + 1) * 50).toFixed(1) + '%'; }
        const base = baseline && baseline[p.index] ? baseline[p.index][i] : a;
        if (learning && Math.abs(a - base) > 0.5) assign({ dev: p.id, type: 'axis', i });
      });
      prev[p.index] = p.buttons.map(x => x.pressed);
    });
    requestAnimationFrame(poll);
  }
  function assign(b) {
    if (!learning) return;
    profiles[current].binds[learning] = b; learning = null; baseline = null;
    saveProfiles(); renderBinds(); renderChecks();
  }
  window.addEventListener('gamepadconnected', () => { devSig = null; });
  window.addEventListener('gamepaddisconnected', () => { devSig = null; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && learning) { learning = null; renderBinds(); } });

  // Checklist: auto() returns [state, text] from scan data, or null when it cannot tell.
  const CHECKS = [
    { id: 'power', t: 'Energiesparplan auf Höchstleistung', d: 'Verhindert, dass die CPU mitten im Rennen heruntertaktet.', auto: sc => sc && sc.windows && sc.windows.powerPlan ? (/höchst|hoch|high|ultimat/i.test(sc.windows.powerPlan) ? ['ok', 'aktiv'] : ['tight', sc.windows.powerPlan]) : null },
    { id: 'gamemode', t: 'Windows-Spielmodus an', d: 'Einstellungen → Spielen → Spielmodus.', auto: sc => sc && sc.windows && sc.windows.gameMode ? (sc.windows.gameMode === 'an' ? ['ok', 'an'] : ['tight', 'aus']) : null },
    { id: 'driver', t: 'Grafiktreiber aktuell', d: 'Neue Treiber bringen bei iRacing oft mehr FPS und beheben VR-Probleme.', auto: sc => { const g = scanGpu(sc); if (!g || !g.driverDate) return null; const age = (Date.now() - new Date(g.driverDate)) / 864e5; return age < 180 ? ['ok', 'aktuell'] : ['tight', 'von ' + new Date(g.driverDate).toLocaleDateString('de-DE')]; } },
    { id: 'hz', t: 'Monitor läuft mit voller Bildwiederholrate', d: 'Windows stellt neue Monitore oft auf 60 Hz. Prüfen unter Anzeige → Erweiterte Anzeige.', auto: sc => { const ms = sc && sc.monitors && sc.monitors.active; if (!ms || !ms.length) return null; const low = ms.filter(m => m.hz <= 60).length; return low ? ['tight', low + '× 60 Hz, prüfen'] : ['ok', ms.map(m => m.hz).join(' / ') + ' Hz']; } },
    { id: 'ram', t: 'Mindestens 16 GB Arbeitsspeicher', d: 'Mit weniger lädt iRacing Strecke und Fahrzeuge während der Fahrt nach.', auto: sc => sc && sc.ram && sc.ram.totalGB ? (sc.ram.totalGB >= 16 ? ['ok', sc.ram.totalGB + ' GB'] : ['tight', sc.ram.totalGB + ' GB']) : null },
    { id: 'fps', t: 'FPS-Limit gesetzt', d: 'In iRacing auf die Bildwiederholrate des Monitors begrenzen.' },
    { id: 'fullscreen', t: 'iRacing im Vollbild', d: 'Im Fenstermodus kostet die Darstellung zusätzlich Leistung.' },
    { id: 'graphics', t: 'Grafik nach Empfehlung eingestellt', d: 'Werte aus dem Bereich Grafik übernommen und im vollen Feld getestet.', go: 'gfx' },
    { id: 'fov', t: 'Sichtfeld eingestellt', d: 'Passend zu Monitorgröße und Sitzabstand.', go: 'fov' },
    { id: 'calibrate', t: 'Lenkrad und Pedale kalibriert', d: 'In iRacing unter Optionen → Steuerung, nach jedem Treiber-Update erneut.' },
    { id: 'ffb', t: 'Force-Feedback-Stärke pro Auto gesetzt', d: 'Auto-Taste auf der Strecke, danach nach Gefühl.', go: 'ffb' },
    { id: 'binds', t: 'Wichtige Tasten belegt', d: 'Mindestens Pit-Limiter, Bremsbalance und Black Box.', go: 'binds', auto: () => { const b = profiles[current].binds; const need = ['limiter', 'bbPlus', 'bbMinus', 'bbxNext']; const miss = need.filter(id => !b[id]).length; return miss ? ['tight', miss + ' fehlen'] : ['ok', 'belegt']; } },
    { id: 'usb', t: 'USB-Energiesparen für Lenkrad aus', d: 'Geräte-Manager → USB-Root-Hub → Energieverwaltung. Verhindert kurze Aussetzer.' },
    { id: 'background', t: 'Unnötige Hintergrund-Apps geschlossen', d: 'RGB-Software, Videos im Browser und nicht benötigte Overlays kosten CPU-Zeit.' }
  ];
  function renderChecks() {
    let done = 0;
    $('#checks').innerHTML = CHECKS.map(c => {
      const a = c.auto ? c.auto(state.scan) : null;
      const user = state.checks[c.id];
      const checked = user != null ? user : !!(a && a[0] === 'ok');
      if (checked) done++;
      return '<li class="' + (checked ? 'done' : '') + '"><input type="checkbox" id="ck-' + c.id + '" data-check="' + c.id + '"' + (checked ? ' checked' : '') + '>' +
        '<label for="ck-' + c.id + '"><div class="t">' + esc(c.t) + '</div><div class="d">' + esc(c.d) + (c.go ? ' <a href="#" data-goto="' + c.go + '">Öffnen</a>' : '') + '</div></label>' +
        '<span class="auto ' + (a ? a[0] : '') + '">' + (a ? esc(a[1]) : '') + '</span></li>';
    }).join('');
    $('#st-checks').textContent = done + '/' + CHECKS.length;
  }
  $('#checks').addEventListener('change', e => {
    const id = e.target.dataset.check; if (!id) return;
    state.checks[id] = e.target.checked; store.set('checks', state.checks); renderChecks();
  });

  // Files
  const loaded = [];
  function putFile(entry) {
    const i = loaded.findIndex(x => x.name.toLowerCase() === entry.name.toLowerCase());
    if (i >= 0) loaded[i] = entry; else loaded.push(entry);
  }
  function parseIni(txt) {
    const out = []; let sec = null;
    txt.split(/\r?\n/).forEach(line => {
      const t = line.trim(); if (!t || t[0] === ';' || t[0] === '#') return;
      const m = t.match(/^\[(.+)\]$/); if (m) { sec = { name: m[1], items: [] }; out.push(sec); return; }
      const kv = t.match(/^([^=]+)=(.*)$/);
      if (kv) { if (!sec) { sec = { name: '', items: [] }; out.push(sec); } sec.items.push([kv[1].trim(), kv[2].split(';')[0].trim()]); }
    });
    return out;
  }
  async function readFile(name, file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const n = Math.min(buf.length, 4096); let printable = 0;
    for (let i = 0; i < n; i++) { const c = buf[i]; if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127) || c >= 160) printable++; }
    const isText = n === 0 || printable / n > 0.9;
    putFile(isText ? { name, size: buf.length, isText, text: new TextDecoder('utf-8').decode(buf) }
      : { name, size: buf.length, isText, hex: [...buf.slice(0, 512)].map(b => b.toString(16).padStart(2, '0')).join(' ') });
  }
  function renderFiles() {
    const box = $('#fileList');
    if (!loaded.length) { box.innerHTML = ''; return; }
    const has = n => loaded.some(f => f.name.toLowerCase() === n);
    let html = '<div class="actions">' + [['rendererdx11monitor.ini', 'Grafik'], ['app.ini', 'Allgemein'], ['controls.cfg', 'Tasten']].map(([f, l]) => '<span class="mono ' + (has(f) ? 'ok' : 'tight') + '">' + l + ': ' + (has(f) ? 'da' : 'fehlt') + '</span>').join('') + '</div>';
    loaded.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(f => {
      let body;
      if (f.isText && /\.ini$/i.test(f.name) && f.text) body = '<table class="ini">' + parseIni(f.text).map(s => (s.name ? '<tr class="sec"><td colspan="2">[' + esc(s.name) + ']</td></tr>' : '') + s.items.map(([k, v]) => '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>').join('')).join('') + '</table>';
      else if (f.isText && f.text) body = '<pre>' + esc(f.text.slice(0, 20000)) + '</pre>';
      else if (f.hex) body = '<p class="muted">Binärdatei. Die ersten 512 Bytes helfen, das Format zu entschlüsseln:</p><pre>' + esc(f.hex) + '</pre>';
      else body = '<p class="muted">Inhalt nicht gespeichert. Scan oder Ordner neu laden.</p>';
      html += '<details class="file"><summary><span>' + esc(f.name) + '</span><span class="muted">' + de1(f.size / 1024) + ' KB</span></summary><div class="body">' + body + '</div></details>';
    });
    box.innerHTML = html;
  }
  const WANTED_FILE = /^(renderer.*\.ini|app\.ini|core\.ini|controls\.cfg|joycalib\.yaml)$/i;
  $('#pickDir').addEventListener('click', async () => {
    if (!window.showDirectoryPicker) { toast('Ordnerauswahl gibt es nur in Chrome und Edge. Nutze „Einzelne Dateien“.'); return; }
    try {
      const dir = await window.showDirectoryPicker({ id: 'iracing', mode: 'read', startIn: 'documents' });
      let count = 0;
      for await (const [name, handle] of dir.entries()) {
        if (handle.kind === 'file' && WANTED_FILE.test(name)) { await readFile(name, await handle.getFile()); count++; }
      }
      renderFiles(); toast(count ? count + ' Dateien eingelesen' : 'Keine iRacing-Dateien in diesem Ordner');
    } catch (e) { if (e && e.name !== 'AbortError') toast('Der Ordner ließ sich nicht lesen'); }
  });
  $('#pickFiles').addEventListener('change', async e => {
    for (const f of e.target.files) await readFile(f.name, f);
    renderFiles(); e.target.value = '';
  });

  $('#makeReport').addEventListener('click', () => {
    const L = ['RIG-TOOL BERICHT · ' + new Date().toLocaleString('de-DE'), ''];
    L.push('Rig: ' + (state.rig.gpu || 'GPU ?') + ' | CPU-Klasse ' + (D.CPU_TIERS.find(t => String(t.id) === String(state.rig.cpu)) || {}).label + ' | ' + state.rig.ram + ' GB | ' + displayLabel(state.rig) + ' @ ' + state.rig.hz + ' Hz');
    L.push('Browser-GPU: ' + (detectedRenderer || 'nicht erkannt'));
    if (state.scan) { const sl = JSON.parse(JSON.stringify(state.scan)); if (sl.iracing) delete sl.iracing.files; L.push('', 'System-Scan:', JSON.stringify(sl, null, 1)); }
    L.push('', gfxText());
    L.push('', 'Force Feedback: ' + $('#ffbType').selectedOptions[0].text + (state.ffb.type === 'dd' ? ', ' + state.ffb.nm + ' Nm' : ''));
    L.push('', 'Geräte im Browser:'); const ps = pads();
    L.push(ps.length ? ps.map(p => p.id + ' (' + p.buttons.length + ' Tasten, ' + p.axes.length + ' Achsen)').join('\n') : 'keine (vorher eine Taste drücken)');
    L.push('', 'Belegung ' + current + ' (' + profiles[current].cls + '):');
    const b = profiles[current].binds;
    L.push(Object.keys(b).length ? Object.entries(b).map(([f, x]) => (FUNC_NAME[f] || f) + ': ' + shortDev(x.dev) + ' ' + (x.type === 'axis' ? 'Achse ' : 'Taste ') + (x.i + 1)).join('\n') : 'noch nichts belegt');
    L.push('', 'Dateien:');
    if (!loaded.length) L.push('keine eingelesen');
    loaded.forEach(f => L.push('', '##### ' + f.name + ' (' + f.size + ' Bytes)', f.isText ? (f.text || '').slice(0, 30000) : 'HEX: ' + (f.hex || '')));
    const txt = L.join('\n');
    $('#report').value = txt; copyText(txt, 'Bericht kopiert');
  });

  function renderAll() {
    renderRigStrip(); renderScanFacts(); renderGfx(); fovInit(); renderFov(); renderFfb(); renderBinds(); renderChecks();
  }
  // re-render the strip so the "Rig ändern" button hides on the rig view
  $$('.rail button').forEach(b => b.addEventListener('click', renderRigStrip));
  document.addEventListener('click', e => { if (e.target.closest('[data-goto]')) renderRigStrip(); });

  syncRigForm();
  renderProfileSelect();
  showView(view);
  renderAll();
  requestAnimationFrame(poll);
})();
