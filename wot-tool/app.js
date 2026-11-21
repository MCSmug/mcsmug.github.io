(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------- tabs ---------- */
  var tabs = document.querySelectorAll('.tabs button');
  function show(view) {
    tabs.forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.view === view)); });
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('show', v.id === 'v-' + view); });
    try { localStorage.setItem('wot-view', view); } catch (e) {}
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    window.scrollTo(0, 0);
  }
  tabs.forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.view); }); });

  /* ---------- graphics ---------- */
  var LV = ['Minimum', 'Niedrig', 'Mittel', 'Hoch', 'Maximal'];
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function gfx() {
    var gpu = +$('gpu').value, cpu = +$('cpu').value, res = $('res').value, hz = +$('hz').value;
    var goal = $('goal').value, vrr = $('sync').value === 'vrr';
    var comp = goal === 'comp';

    // performance headroom on a 0..4 scale
    var p = gpu + 1.5;
    p -= { '1080': 0, '1440': 0.75, uw: 1.25, '2160': 2 }[res];
    if (hz >= 144) p -= comp ? 0.75 : 0.25;
    if (hz >= 240) p -= 0.5;
    if (goal === 'pretty') p += 0.75;
    if (comp) p -= 0.25;
    var L = clamp(Math.round(p), 0, 4);
    var Lc = clamp(L + (cpu - 1), 0, 4);   // CPU-bound settings
    var target = hz >= 144 ? (comp ? hz : Math.min(hz, 120)) : hz;
    if (gpu === 0 && hz > 75) target = Math.min(hz, comp ? 100 : 75);

    var legacy = gpu === 0 && cpu === 0;
    var renderScale = 100;
    if (gpu === 0 && res !== '1080') renderScale = 85;
    if (gpu <= 1 && res === '2160') renderScale = 75;
    if (gpu === 2 && res === '2160' && comp) renderScale = 90;

    var aa = L >= 3 ? 'TSSAA-HQ' : L >= 2 ? 'SMAA (hoch)' : L >= 1 ? 'FXAA' : 'Aus';
    if (res === '2160' && L < 3) aa = 'FXAA';

    var rows = [
      ['Anzeige', [
        ['Bildschirmmodus', 'Vollbild', 'Geringste Eingabeverzögerung. Fenster ohne Rahmen nur, wenn du oft mit Alt+Tab wechselst.', true],
        ['Vertikale Synchronisation', 'Aus', vrr ? 'G-Sync/FreeSync übernimmt das ohne Verzögerung.' : 'VSync verzögert das Zielen spürbar.', true],
        ['Dreifachpufferung', 'Aus', 'Nur mit VSync sinnvoll.'],
        ['FPS-Begrenzung', vrr ? (hz - 3) + ' FPS' : (target >= hz ? hz + ' FPS' : target + ' FPS'), vrr ? 'Knapp unter der Bildwiederholrate bleibt G-Sync/FreeSync immer aktiv.' : 'Gleichmäßige FPS sind beim Zielen wichtiger als Spitzenwerte.'],
      ]],
      ['Qualität', [
        ['Grafik', legacy ? 'Standard' : 'Verbessert', legacy ? 'Der alte Renderer läuft auf schwacher Hardware deutlich flüssiger.' : 'Moderner Renderer, auf deiner Hardware kein Nachteil.', legacy],
        ['Renderauflösung', renderScale + ' %', renderScale < 100 ? 'Spart viel Leistung, das Bild wird etwas weicher.' : 'Volle Schärfe für Schwachstellen auf Distanz.'],
        ['Dynamische Änderung der Renderauflösung', 'Aus', 'Sonst wird das Bild genau in hektischen Momenten unscharf.', true],
        ['Kantenglättung', aa, 'TSSAA sieht am ruhigsten aus, kostet aber am meisten.'],
        ['Texturqualität', LV[clamp(gpu + 2, 2, 4)], 'Kostet kaum FPS, nur Grafikspeicher.'],
        ['Objektdetails', LV[clamp(L, 1, 4)], ''],
        ['Baumdetails', LV[clamp(L, 1, 4)], ''],
        ['Landschaftsqualität', LV[clamp(L, 1, 4)], ''],
        ['Wasserqualität', LV[clamp(L - 1, 0, 3)], 'Bringt im Gefecht nichts.'],
        ['Beleuchtungsqualität', LV[clamp(L, 1, 4)], ''],
        ['Schattenqualität', LV[clamp(comp ? L - 2 : L - 1, 0, 3)], 'Einer der teuersten Regler. Im Gefecht kaum ein Nutzen.'],
        ['Umgebungsverdeckung (Ambient Occlusion)', comp || L < 3 ? 'Aus' : 'An', 'Schöne Tiefe, kostet aber spürbar.'],
        ['Zusätzliche Effekte', comp ? 'Niedrig' : LV[clamp(L - 1, 0, 3)], 'Weniger Rauch und Staub vor dem Ziel nach Einschlägen.', comp],
        ['Zusätzliche Effekte im Scharfschützenmodus', comp ? 'Aus' : 'Niedrig', 'Klarer Blick durch die Zieloptik.', comp],
        ['Anzahl der Pflanzen', comp ? 'Niedrig' : LV[clamp(L - 1, 0, 3)], 'Weniger Gras und Kleinzeug im Bild.'],
        ['Nachbearbeitung', comp ? 'Aus' : LV[clamp(L - 1, 0, 3)], 'Farbfilter und Unschärfe aus der Szene.'],
        ['Bewegungsunschärfe', 'Aus', 'Verwischt Ziele beim Schwenken.', true],
        ['Sichtweite (Darstellungsdistanz)', LV[clamp(Lc + 1, 2, 4)], 'Gelände und Deckung in der Ferne früher sichtbar. Belastet vor allem den Prozessor.'],
        ['Kettenspuren und Effekte der Fahrzeuge', 'Aus', 'Nur Optik.'],
        ['Gras im Scharfschützenmodus', comp ? 'Aus' : 'An', comp ? 'Gras verdeckt beim Zielen sonst Wannen und Ketten.' : 'Für Optik an, für bessere Sicht aus.', true],
      ]],
    ];

    var html = '';
    var text = 'WoT-Grafik\n';
    rows.forEach(function (g) {
      html += '<div class="group"><h4>' + esc(g[0]) + '</h4><table class="rows"><thead><tr><th>Einstellung</th><th>Wert</th><th>Warum</th></tr></thead><tbody>';
      text += '\n[' + g[0] + ']\n';
      g[1].forEach(function (r) {
        html += '<tr><td>' + esc(r[0]) + (r[3] ? '<span class="tag key">wichtig</span>' : '') + '</td><td class="val">' + esc(r[1]) + '</td><td class="why">' + esc(r[2]) + '</td></tr>';
        text += r[0] + ': ' + r[1] + '\n';
      });
      html += '</tbody></table></div>';
    });
    $('gfxTable').innerHTML = html;
    $('copyGfx').dataset.text = text;

    var preset = ['Minimum', 'Niedrig', 'Mittel', 'Hoch', 'Ultra'][L];
    $('gfxSummary').innerHTML =
      cell('Leistungsstufe', preset) + cell('Ziel-FPS', 'stabil ' + target) + cell('Renderauflösung', renderScale + ' %') + cell('Renderer', legacy ? 'Standard' : 'Verbessert');

    var tips = [];
    if (gpu === 0) tips.push('Schalte im Windows-Energiemodus auf „Beste Leistung“ und bei Laptops das Netzteil ein. Sonst taktet die Grafik herunter.');
    if (cpu === 0) tips.push('Dein Prozessor bremst vor allem bei vielen Panzern auf dem Bildschirm. Sichtweite und Objektdetails sind dann die Regler, die helfen.');
    if (hz >= 144 && gpu <= 1) tips.push('Unter 100 FPS fühlt sich ein 144-Hz-Monitor kaum besser an als 75 Hz. Lieber Schatten und Effekte senken als die Auflösung.');
    if (!vrr && hz > 60) tips.push('Ohne G-Sync/FreeSync kann es leicht reißen. Teste die FPS-Begrenzung auf genau ' + hz + ' FPS oder ein Vielfaches.');
    if (res === '2160') tips.push('Bei 4K bringt die Renderauflösung den größten Gewinn. 85 % sind kaum von nativ zu unterscheiden.');
    tips.push('Nach dem Ändern ein Trainingsgefecht oder Gefecht auf einer Stadtkarte spielen. Dort fallen die FPS am stärksten.');
    tips.push('Grafiktreiber aktuell halten. Im NVIDIA- oder AMD-Treiber den Modus „Niedrige Latenz“ einschalten.');
    $('gfxTips').innerHTML = tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
  }
  function cell(k, v) { return '<div class="cell"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div></div>'; }

  ['gpu', 'cpu', 'res', 'hz', 'goal', 'sync'].forEach(function (id) { $(id).addEventListener('change', gfx); });
  $('copyGfx').addEventListener('click', function () {
    var b = this;
    navigator.clipboard.writeText(b.dataset.text || '').then(function () {
      b.textContent = 'Kopiert'; setTimeout(function () { b.textContent = 'Als Text kopieren'; }, 1500);
    });
  });

  /* ---------- game settings ---------- */
  var GAME = [
    ['Kampf', [
      ['Dynamische Kamera', 'Aus', 'Die Kamera wackelt sonst bei Treffern und beim Fahren.', true],
      ['Horizontale Stabilisierung im Scharfschützenmodus', 'An', 'Das Visier bleibt beim Fahren ruhiger auf dem Ziel.', true],
      ['Optischer Effekt im Scharfschützenmodus', 'Aus', 'Mehr Bildfläche beim Zielen.'],
      ['Zusätzliche Zoomstufen (x16, x25)', 'An', 'Schwachstellen auf große Distanz treffen.'],
      ['Letzte Zoomstufe merken', 'An', 'Spart beim Wechsel in den Scharfschützenmodus das Nachstellen.'],
      ['Server-Fadenkreuz', 'An', 'Zeigt, wohin die Kanone wirklich zielt. Minimal verzögert, dafür ehrlich.'],
    ]],
    ['Minikarte', [
      ['Kreis der Sichtweite', 'An', 'Zeigt, wie weit du selbst aufklärst.', true],
      ['Kreis der maximalen Sichtweite (445 m)', 'An', 'Weiter kann niemand aufklären.'],
      ['Kreis der Darstellungsdistanz', 'An', 'Bis dahin werden Panzer überhaupt angezeigt.'],
      ['Schussrichtung der Artillerie', 'An', 'Du siehst, woher die Artillerie schießt.'],
      ['Namen der Fahrzeuge', 'An', 'Du erkennst Panzertypen, ohne zu zoomen.'],
      ['Größe der Minikarte', 'Größer stellen', 'Im Gefecht mit + und − auf der Tastatur. Die Minikarte ist deine wichtigste Informationsquelle.', true],
    ]],
    ['Markierungen', [
      ['Gegner: Lebenspunkte', 'Als Zahl', 'Du weißt sofort, ob dein nächster Schuss tötet.', true],
      ['Gegner: Fahrzeugname', 'An', ''],
      ['Mit Alt-Taste', 'Zusätzlich Spielername und Lebensbalken', 'Bei Bedarf mehr Details, sonst ein ruhiges Bild.'],
      ['Schadensanzeige', 'Richtung und Wert', 'Du siehst, woher der Treffer kam.'],
    ]],
    ['Steuerung', [
      ['Mausempfindlichkeit im Scharfschützenmodus', 'Niedriger als im Normalmodus', 'Feinere Kontrolle auf Schwachstellen.'],
      ['Rechte Maustaste halten', 'Turm stoppen', 'Wichtig zum Schrägstellen: Wanne drehen, Kanone bleibt aufs Ziel gerichtet.', true],
      ['Rechte Maustaste kurz klicken', 'Automatisches Zielen', 'Nur für nahe Ziele in Bewegung. Zielt immer auf die Mitte.'],
      ['Shift', 'Scharfschützenmodus', 'Oder das Mausrad.'],
    ]],
    ['Ton', [
      ['Sechster Sinn', 'Deutlicher Ton an', 'Du weißt sofort, dass du aufgeklärt bist.', true],
      ['Effekte', 'Laut', 'Treffer- und Einschlaggeräusche geben dir Infos.'],
      ['Musik', 'Leise oder aus', ''],
      ['Tonprofil', 'Kopfhörer, wenn du welche nutzt', 'Bessere Richtungsortung.'],
    ]],
  ];
  function renderGame() {
    $('gameGroups').innerHTML = GAME.map(function (g) {
      return '<div class="panel"><h3>' + esc(g[0]) + '</h3><table class="rows"><thead><tr><th>Einstellung</th><th>Wert</th><th>Warum</th></tr></thead><tbody>' +
        g[1].map(function (r) {
          return '<tr><td>' + esc(r[0]) + (r[3] ? '<span class="tag key">wichtig</span>' : '') + '</td><td class="val">' + esc(r[1]) + '</td><td class="why">' + esc(r[2]) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }).join('') + '<p class="muted" style="font-size:.85rem;margin-top:14px">Die genauen Bezeichnungen können je nach Spielversion leicht abweichen.</p>';
  }

  /* ---------- tank setup ---------- */
  // category: which special slot an item fits (Improved items fit none)
  var EQ = {
    rammer: ['Ansetzer', 'Rammer', 'Feuerkraft', 'Schnelleres Nachladen.'],
    gld: ['Richtantrieb', 'Gun Laying Drive', 'Feuerkraft', 'Schnelleres Zielen.'],
    vstab: ['Vertikalstabilisator', 'Vertical Stabilizer', 'Feuerkraft', 'Weniger Streuung beim Fahren und Turmdrehen.'],
    optics: ['Vergütete Optik', 'Coated Optics', 'Aufklärung', 'Mehr Sichtweite.'],
    camo: ['Tarnnetz', 'Camouflage Net', 'Tarnung', 'Bessere Tarnung im Stand.'],
    turbo: ['Turbolader', 'Turbocharger', 'Mobilität', 'Mehr Motorleistung und Endgeschwindigkeit.'],
    rot: ['Verbesserter Drehmechanismus', 'Improved Rotation Mechanism', 'Mobilität', 'Wanne und Turm drehen schneller.'],
    hard: ['Verbesserte Härtung', 'Improved Hardening', 'Überlebensfähigkeit', 'Mehr Lebenspunkte.'],
    vents: ['Verbesserte Belüftung', 'Improved Ventilation', 'Verbessert', 'Alle Crew-Fähigkeiten etwas besser.'],
  };
  var STYLES = {
    lt: [['passive', 'Passiv aufklären (Busch)'], ['active', 'Aktiv aufklären und flankieren']],
    mt: [['all', 'Allrounder (Distanz und Mitte)'], ['brawl', 'Nahkampf / Druck machen']],
    ht: [['front', 'Frontlinie, viel Panzerung'], ['support', 'Zweite Reihe, Schaden machen']],
    td: [['snipe', 'Aus der Ferne, getarnt'], ['assault', 'Angriff, stark gepanzert']],
    spg: [['std', 'Standard']],
  };
  var BUILDS = {
    'lt-passive': [['optics', 'camo', 'vents'], 'turbo'],
    'lt-active': [['optics', 'turbo', 'vents'], 'rot'],
    'mt-all': [['rammer', 'gld', 'optics'], 'vstab'],
    'mt-brawl': [['rammer', 'vstab', 'vents'], 'gld'],
    'ht-front': [['rammer', 'vstab', 'hard'], 'vents'],
    'ht-support': [['rammer', 'gld', 'vents'], 'optics'],
    'td-snipe': [['rammer', 'gld', 'camo'], 'optics'],
    'td-assault': [['rammer', 'vstab', 'hard'], 'vents'],
    'spg-std': [['rammer', 'gld', 'vents'], 'rot'],
  };
  var SPECIAL = { lt: 'Aufklärung', mt: 'Mobilität', ht: 'Überlebensfähigkeit', td: 'Feuerkraft', spg: 'Feuerkraft' };

  function fillStyles() {
    var c = $('cls').value;
    $('style').innerHTML = STYLES[c].map(function (s) { return '<option value="' + s[0] + '">' + esc(s[1]) + '</option>'; }).join('');
  }

  function tank() {
    var c = $('cls').value, s = $('style').value, tier = +$('tier').value, gun = $('gun').value;
    var badAim = $('badAim').checked, lowView = $('lowView').checked, slow = $('slow').checked;
    var b = BUILDS[c + '-' + s], items = b[0].slice(), alt = b[1];
    var notes = [];

    function swap(from, to) {
      var i = items.indexOf(from);
      if (i >= 0 && items.indexOf(to) < 0) items[i] = to;
    }
    if (gun !== 'single' && items.indexOf('rammer') >= 0) {
      var rep = items.indexOf('vstab') < 0 ? 'vstab' : (items.indexOf('vents') < 0 ? 'vents' : 'optics');
      swap('rammer', rep);
      notes.push(['warn', 'Bei Magazin- und Autolader-Kanonen lässt sich der Ansetzer meist gar nicht einbauen oder bringt wenig. Darum steht er hier nicht.']);
    }
    if (badAim && c !== 'spg' && items.indexOf('gld') < 0 && items.indexOf('vstab') < 0) swap(items[2], 'vstab');
    if (badAim && items.indexOf('gld') < 0) {
      if (items.indexOf('vents') >= 0) swap('vents', 'gld'); else if (c !== 'lt') swap(items[2], 'gld');
    }
    if (lowView && (c === 'mt' || c === 'lt' || c === 'ht') && items.indexOf('optics') < 0) {
      swap(items.indexOf('vents') >= 0 ? 'vents' : items[2], 'optics');
    }
    if (slow && c === 'ht' && s === 'support') swap('vents', 'hard');
    if (items.indexOf(alt) >= 0) alt = Object.keys(EQ).filter(function (k) { return items.indexOf(k) < 0 && k !== 'turbo'; })[0];

    var cls = ['Klasse 3', 'Klasse 2', 'Klasse 1'][3 - tier];
    $('eqIntro').textContent = 'Stufe ' + ['', 'VIII–X', 'V–VII', 'II–IV'][tier] + ': Standard-Ausrüstung ' + cls + '. Den Spezial-Slot erkennst du im Ausrüstungsfenster an der Farbmarkierung. Ein passendes Teil dort wirkt stärker. Bei vielen Panzern dieser Klasse ist es „' + SPECIAL[c] + '“.';

    $('eqSlots').innerHTML = items.map(function (k, i) {
      var e = EQ[k], fits = e[2] === SPECIAL[c];
      return '<div class="slot' + (fits ? ' special' : '') + '"><div class="n">Slot ' + (i + 1) + ' · ' + esc(e[2]) + (fits ? ' · passt in Spezial-Slot' : '') + '</div><div class="item">' + esc(e[0]) + '</div><div class="alt">' + esc(e[3]) + ' <span class="mono">(' + esc(e[1]) + ')</span></div></div>';
    }).join('') +
      '<div class="slot"><div class="n">Alternative</div><div class="item">' + esc(EQ[alt][0]) + '</div><div class="alt">Statt Slot 3, wenn er zu deinem Spielstil besser passt.</div></div>';

    if (c === 'spg') notes.push(['warn', 'Bei Artillerie zählt Zielzeit am meisten. Richtantrieb und Ansetzer haben Vorrang.']);
    if (tier === 3) notes.push(['warn', 'Auf Stufe II–IV lohnt sich Ausrüstung nur auf Panzern, die du länger spielst. Spar Silber für die höheren Stufen.']);
    notes.push(['warn', 'Erst montieren, wenn du sicher bist. Ausbauen kostet Gold oder ein Demontage-Kit. Gekauftes kannst du aber auf jeden Panzer derselben Ausrüstungsklasse umbauen, zum Beispiel auf alle Stufe-VIII–X-Panzer.']);
    $('eqWarn').innerHTML = notes.map(function (n) { return '<div class="' + n[0] + '">' + esc(n[1]) + '</div>'; }).join('');

    // consumables
    var big = tier === 1;
    var third;
    if (c === 'ht' || (c === 'td' && s === 'assault')) third = big ? ['Automatischer Feuerlöscher', 'Löscht Brände sofort. Lohnt sich, wenn du viel Beschuss abbekommst.'] : ['Feuerlöscher', 'Günstig und rettet dich bei Motorbränden.'];
    else third = big ? ['Verpflegung der Nation (Booster)', 'Zum Beispiel Schokolade oder Kaffee: Die ganze Crew wird besser, solange das Gefecht läuft.'] : ['Feuerlöscher', 'Günstig und rettet dich bei Motorbränden.'];
    var cons = [
      [big ? 'Großes Reparaturset' : 'Kleines Reparaturset', big ? 'Repariert alle Module auf einmal und lädt sich wieder auf.' : 'Für Ketten und Module. Reicht auf dieser Stufe.'],
      [big ? 'Großes Erste-Hilfe-Set' : 'Kleines Erste-Hilfe-Set', big ? 'Heilt die ganze Crew und schützt eine Zeit lang.' : 'Heilt ein Crew-Mitglied.'],
      third,
    ];
    $('consSlots').innerHTML = cons.map(function (x, i) {
      return '<div class="slot"><div class="n">Platz ' + (i + 1) + '</div><div class="item">' + esc(x[0]) + '</div><div class="alt">' + esc(x[1]) + '</div></div>';
    }).join('');

    // ammo
    var ammo = [];
    if (c === 'spg') {
      ammo.push('Hauptsächlich Sprenggranaten. Panzerbrechende nur, wenn die Artillerie welche hat und du gezielt gepanzerte Ziele triffst.');
    } else {
      ammo.push('Standardmunition als Hauptmunition. Damit verdienst du am meisten Silber.');
      if (tier === 1) ammo.push(c === 'lt' ? 'Etwa 20–30 % Premium-Munition für Fälle, in denen du gegen Panzerung schießen musst.' : 'Etwa 25–35 % Premium-Munition für schwer gepanzerte Ziele. Nur laden, wenn die Standardmunition nicht durchschlägt.');
      else ammo.push('10–20 % Premium-Munition reichen meistens. Auf niedrigeren Stufen schlägt Standardmunition fast alles durch.');
      ammo.push('Ein paar Sprenggranaten für Gegner mit wenig Lebenspunkten, Artillerie und offene Fahrzeuge.');
      if (gun === 'clip') ammo.push('Bei Magazinen gemischt laden: die ersten Schuss Standard, die letzten Premium, je nach Ziel.');
    }
    ammo.push('Premium-Munition kostet Silber, kein Gold. Trotzdem ist sie der größte Kostenfaktor auf Stufe VIII–X.');
    $('ammo').innerHTML = ammo.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');

    // crew basics, system-independent
    var crew = [
      'Zuerst die Hauptqualifikation aller Crew-Mitglieder auf 100 % bringen. Alles darunter verschlechtert Zielen, Nachladen und Fahren spürbar.',
      'Die Crew mit dem Panzer weiterziehen, wenn du eine Linie hochspielst. Dann musst du keine neue Crew teuer ausbilden.',
      'Fähigkeiten passend zur Spielweise oben wählen: ' + {
        lt: 'Tarnung und Sichtweite',
        mt: 'Feuerkraft und Sicht, dazu Beweglichkeit',
        ht: 'Überleben, Reparatur und Nachladen',
        td: 'Tarnung und Feuerkraft',
        spg: 'Zielen, Nachladen und Tarnung',
      }[c] + '.',
      'Nach großen Crew-Updates bietet Wargaming meist ein kostenloses Zurücksetzen der Fähigkeiten an. Gold dafür nur ausgeben, wenn es nicht anders geht.',
      'Verbesserte Belüftung und Verpflegung stärken alle Fähigkeiten. Das hilft besonders einer jungen Crew.',
    ];
    $('crew').innerHTML = crew.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
  }
  $('cls').addEventListener('change', function () { fillStyles(); tank(); });
  ['tier', 'style', 'gun', 'badAim', 'lowView', 'slow'].forEach(function (id) { $(id).addEventListener('change', tank); });

  /* ---------- money ---------- */
  var MONEY = [
    ['Ausrüstung', [
      'Vor dem Montieren entscheiden. Ausbauen kostet Gold oder ein Demontage-Kit, Einbauen ist kostenlos.',
      'Demontage-Kits gibt es oft gratis aus Missionen, dem Battle Pass und Events. Sammeln statt Gold ausgeben.',
      'Wargaming macht regelmäßig Aktionen mit kostenlosem Ausbau. Große Umbauten dann erledigen.',
      'Gute Teile wie Ansetzer, Richtantrieb und Belüftung nur einmal kaufen und zwischen den Panzern umbauen.',
      'Beim Verkauf eines Panzers im Verkaufsfenster prüfen, dass die Ausrüstung ins Depot geht und nicht mitverkauft wird.',
    ]],
    ['Silber verdienen', [
      'Stufe X verliert ohne Premium-Konto oft Silber. Verdient wird auf Stufe VI–VIII.',
      'Premium-Panzer der Stufe VIII bringen am meisten Silber pro Gefecht.',
      'Schaden durch Aufklärung und Ketten-Schüsse für Verbündete zählt mit. Aufklären lohnt sich.',
      'Tägliche Missionen und der erste Sieg des Tages geben viel Bonus.',
      'Alte Module und Ausrüstung im Depot verkaufen, wenn du sie sicher nicht mehr brauchst.',
    ]],
    ['Kosten senken', [
      'Premium-Munition nur bei Bedarf laden. Ein volles Magazin Premium auf Stufe X kostet oft mehr, als das Gefecht einbringt.',
      'Automatischen Nachkauf von Verbrauchsgütern auf Silber stellen, nicht auf Gold.',
      'Große Reparatur- und Erste-Hilfe-Sets erst ab Stufe VIII nutzen. Vorher reichen die kleinen.',
      'Kein Gold für Crew-Training ausgeben. Crew-Bücher aus Events und Missionen reichen meist.',
      'Freie Erfahrung nur in Events umwandeln, wenn es Rabatt gibt.',
    ]],
    ['Kostenlose Quellen', [
      'Offizielle Panzer-Handbücher von Wargaming: empfohlene Ausrüstung und Fähigkeiten pro Panzer.',
      'Die Werte im Spiel selbst: Im Garagen-Vergleich siehst du sofort, was ein Ausrüstungsteil an Nachladezeit oder Sichtweite bringt.',
      'Trainingsraum mit Freunden: Durchschlag und Schwachstellen kostenlos ausprobieren.',
    ]],
  ];
  function renderMoney() {
    $('moneyGroups').innerHTML = MONEY.map(function (g) {
      return '<div class="panel"><h3>' + esc(g[0]) + '</h3><ul class="tips">' + g[1].map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
    }).join('');
  }

  /* ---------- PC: driver, Windows, mouse, network, sound ---------- */
  function pcGroups() {
    var vrr = $('sync').value === 'vrr', hz = +$('hz').value;
    var vendor = $('pcVendor').value;
    var drv = vendor === 'nv' ? ['NVIDIA-Systemsteuerung', 'Unter 3D-Einstellungen → Programmeinstellungen „WorldOfTanks.exe“ auswählen, damit nur WoT betroffen ist.', [
      ['Energieverwaltungsmodus', 'Maximale Leistung bevorzugen', 'Verhindert, dass die Grafikkarte mitten im Gefecht heruntertaktet.', true],
      ['Modus für geringe Latenz', 'Ein', 'Kürzere Verzögerung zwischen Maus und Bild.', true],
      ['Vertikale Synchronisierung', vrr ? 'Ein' : 'Aus', vrr ? 'Zusammen mit G-Sync und der FPS-Begrenzung im Spiel: kein Reißen und keine spürbare Verzögerung. Im Spiel selbst bleibt VSync aus.' : 'Ohne G-Sync verzögert VSync das Zielen.'],
      ['G-SYNC einrichten', vrr ? 'Für Vollbild aktivieren' : 'Nicht vorhanden', vrr ? 'Unter Anzeige → G-SYNC einrichten.' : ''],
      ['Maximale Bildfrequenz', 'Aus', 'Die Begrenzung im Spiel reicht. Zwei Begrenzungen stören sich.'],
      ['Texturfilterung – Qualität', 'Hohe Leistung', 'Kaum sichtbar, etwas mehr FPS.'],
      ['Bildschärfe', 'Optional, 0,3–0,5', 'Hilft, wenn das Bild mit TSSAA zu weich wirkt.'],
    ]] : ['AMD Software: Adrenalin', 'Unter Gaming → Spiele → World of Tanks ein eigenes Profil anlegen.', [
      ['Radeon Anti-Lag', 'Ein', 'Kürzere Verzögerung zwischen Maus und Bild.', true],
      ['Radeon Chill', 'Aus', 'Senkt sonst die FPS, wenn du wenig bewegst, also genau beim Zielen.', true],
      ['Radeon Boost', 'Aus', 'Senkt beim Schwenken die Auflösung.'],
      ['Enhanced Sync', 'Aus', 'Kann zu Rucklern führen.'],
      ['Warten auf vertikale Aktualisierung', vrr ? 'Aus, außer die Anwendung bestimmt' : 'Aus', ''],
      ['AMD FreeSync', vrr ? 'Ein' : 'Nicht vorhanden', vrr ? 'Unter Anzeige. Im Spiel FPS knapp unter ' + hz + ' begrenzen.' : ''],
      ['Radeon Image Sharpening', 'Optional, 40–60 %', 'Hilft, wenn das Bild mit TSSAA zu weich wirkt.'],
    ]];
    return [drv,
      ['Windows', '', [
        ['Bildwiederholrate des Monitors', hz + ' Hz', 'Einstellungen → System → Anzeige → Erweiterte Anzeige. Steht oft noch auf 60 Hz, obwohl der Monitor mehr kann.', true],
        ['Spielmodus', 'Ein', 'Einstellungen → Spielen → Spielmodus.'],
        ['Hardwarebeschleunigte GPU-Planung', 'Ein', 'Einstellungen → System → Anzeige → Grafik. Danach neu starten.'],
        ['Energiemodus', 'Beste Leistung', 'Einstellungen → System → Netzbetrieb. Bei Laptops nur mit Netzteil.'],
        ['Zeigerbeschleunigung verbessern', 'Aus', 'Systemsteuerung → Maus → Zeigeroptionen. Sonst hängt der Weg des Fadenkreuzes vom Tempo der Hand ab.', true],
        ['Xbox Game Bar: Aufnahmen im Hintergrund', 'Aus', 'Nimmt sonst ständig auf und kostet Leistung.'],
        ['Overlays (Discord, Steam usw.)', 'Für WoT aus', 'Weniger Ruckler. Discord-Sprache funktioniert trotzdem.'],
      ]],
      ['Maus', '', [
        ['DPI', '800–1600', 'Genug für feines Zielen, ohne dass das Fadenkreuz zittert.'],
        ['Abfragerate (Polling Rate)', '1000 Hz', 'In der Software der Maus.'],
        ['Empfindlichkeit im Spiel, normale Ansicht', 'Mittel', 'Ein Wisch über das Mauspad sollte den Turm etwa einmal ganz herumdrehen lassen.'],
        ['Empfindlichkeit im Scharfschützenmodus', 'Niedriger als normal', 'Bei x8 und x16 sonst zu unruhig.', true],
        ['Seitentasten', 'Belegen', 'Zum Beispiel mit Reparatur, Erste Hilfe oder Munitionswechsel. Dann musst du die Hand nicht von WASD nehmen.'],
      ]],
      ['Netzwerk', '', [
        ['Verbindung', 'LAN-Kabel statt WLAN', 'WLAN verursacht Paketverlust. Das sieht man im Spiel als Ruckeln von Gegnern.', true],
        ['Server', 'Der mit dem niedrigsten Ping', 'In der Serverauswahl vor dem Login wird der Ping angezeigt.'],
        ['Downloads im Hintergrund', 'Pausieren', 'Steam, Windows Update und das Wargaming Game Center laden sonst während des Gefechts.'],
      ]],
      ['Sound am PC', '', [
        ['Windows-Raumklang (Sonic, Dolby Atmos usw.)', 'Aus, wenn im Spiel das Kopfhörer-Profil an ist', 'Sonst wird der Ton doppelt bearbeitet und die Richtung ungenau.'],
        ['Crew-Ansagen im Spiel', 'An', '„Ketten beschädigt“ oder „Munitionslager getroffen“ sind wichtige Informationen.'],
        ['Kopfhörer', 'Stereo-Kopfhörer reicht', 'Für die Richtung von Schüssen besser als Lautsprecher.'],
      ]],
    ];
  }
  function renderPc() {
    $('pcGroups').innerHTML = pcGroups().map(function (g) {
      return '<div class="panel"><h3>' + esc(g[0]) + '</h3>' + (g[1] ? '<p class="muted">' + esc(g[1]) + '</p>' : '') +
        '<table class="rows"><thead><tr><th>Einstellung</th><th>Wert</th><th>Warum</th></tr></thead><tbody>' +
        g[2].map(function (r) {
          return '<tr><td>' + esc(r[0]) + (r[3] ? '<span class="tag key">wichtig</span>' : '') + '</td><td class="val">' + esc(r[1]) + '</td><td class="why">' + esc(r[2]) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }).join('');
  }
  $('pcVendor').addEventListener('change', renderPc);
  ['hz', 'sync'].forEach(function (id) { $(id).addEventListener('change', renderPc); });

  /* ---------- preferences.xml check (read only, in browser) ---------- */
  var GFX_NAMES = {
    TEXTURE_QUALITY: 'Texturqualität', SHADOWS_QUALITY: 'Schattenqualität', TERRAIN_QUALITY: 'Landschaftsqualität',
    LIGHTING_QUALITY: 'Beleuchtungsqualität', OBJECT_LOD: 'Objektdetails', SPEEDTREE_QUALITY: 'Baumdetails',
    FLORA_QUALITY: 'Anzahl der Pflanzen', EFFECTS_QUALITY: 'Zusätzliche Effekte', SNIPER_MODE_EFFECTS_QUALITY: 'Effekte im Scharfschützenmodus',
    POST_PROCESSING_QUALITY: 'Nachbearbeitung', MOTION_BLUR_QUALITY: 'Bewegungsunschärfe', WATER_QUALITY: 'Wasserqualität',
    FAR_PLANE: 'Sichtweite', CUSTOM_AA_MODE: 'Kantenglättung', DECALS_QUALITY: 'Decals', TRACK_PHYSICS_QUALITY: 'Kettenphysik',
    VEHICLE_DUST_ENABLED: 'Staub der Fahrzeuge', VEHICLE_TRACES_ENABLED: 'Kettenspuren', SNIPER_MODE_GRASS_ENABLED: 'Gras im Scharfschützenmodus',
    SEMITRANSPARENT_LEAVES_ENABLED: 'Durchsichtige Blätter', RENDER_PIPELINE: 'Renderer (Standard/Verbessert)', HAVOK_ENABLED: 'Zerstörungsphysik',
  };
  function readPrefs(txt) {
    var hz = +$('hz').value, out = [], m;
    function tag(name) {
      var r = new RegExp('<' + name + '>\\s*([^<]*?)\\s*</' + name + '>', 'i').exec(txt);
      return r ? r[1] : null;
    }
    function bool(v) { return v !== null && /^(true|1)$/i.test(v); }
    if (!/<graphicsPreferences>|<devicePreferences>/i.test(txt)) {
      $('prefOut').innerHTML = '<div class="warn bad">Das sieht nicht nach der preferences.xml von World of Tanks aus. Sie liegt unter %APPDATA%\\Wargaming.net\\WorldOfTanks\\.</div>';
      return;
    }
    var checks = [];
    var refresh = tag('fullscreenRefresh'), w = tag('fullscreenWidth'), h = tag('fullscreenHeight');
    var windowed = tag('windowed'), vs = tag('waitVSync'), tb = tag('tripleBuffering');
    if (w && h) checks.push(['Auflösung', w + ' × ' + h, 'ok', '']);
    if (refresh !== null) {
      var r = +refresh;
      checks.push(['Bildwiederholrate im Spiel', r + ' Hz', r && r < hz - 1 ? 'bad' : 'ok',
        r && r < hz - 1 ? 'Dein Monitor kann ' + hz + ' Hz (Angabe im Grafik-Bereich). Im Spiel unter Grafik → Bildschirm die Bildwiederholrate hochsetzen.' : '']);
    }
    if (windowed !== null) checks.push(['Fenstermodus', bool(windowed) ? 'Fenster' : 'Vollbild', bool(windowed) ? 'warn' : 'ok', bool(windowed) ? 'Vollbild hat die geringste Verzögerung.' : '']);
    if (vs !== null) checks.push(['VSync', bool(vs) ? 'An' : 'Aus', bool(vs) ? 'bad' : 'ok', bool(vs) ? 'Im Spiel ausschalten. Mit G-Sync/FreeSync stattdessen die FPS knapp unter der Bildwiederholrate begrenzen.' : '']);
    if (tb !== null) checks.push(['Dreifachpufferung', bool(tb) ? 'An' : 'Aus', bool(tb) ? 'warn' : 'ok', bool(tb) ? 'Ohne VSync unnötig, ausschalten.' : '']);

    var entries = [], re = /<entry>\s*<label>\s*([^<]+?)\s*<\/label>\s*<activeOption>\s*(-?\d+)\s*<\/activeOption>/gi;
    while ((m = re.exec(txt))) entries.push([m[1], +m[2]]);

    var html = '';
    if (checks.length) {
      html += '<div class="panel"><h3>Bildschirm</h3><table class="rows"><thead><tr><th>Einstellung</th><th>Bei dir</th><th>Hinweis</th></tr></thead><tbody>' +
        checks.map(function (c) {
          var mark = { ok: '<span class="tag" style="color:var(--c-ok);border-color:var(--c-ok)">passt</span>', warn: '<span class="tag key">prüfen</span>', bad: '<span class="tag" style="color:var(--c-bad);border-color:var(--c-bad)">ändern</span>' }[c[2]];
          return '<tr><td>' + esc(c[0]) + mark + '</td><td class="val">' + esc(c[1]) + '</td><td class="why">' + esc(c[3]) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    if (entries.length) {
      html += '<div class="panel"><h3>Grafik-Einträge</h3><p class="muted">Gefundene Einträge mit der gespeicherten Stufe. Die Zahl ist der Index im Auswahlmenü des Spiels, nicht der Name. Vergleiche ihn mit der Tabelle im Grafik-Bereich.</p>' +
        '<table class="rows"><thead><tr><th>Einstellung</th><th>Gespeicherter Index</th><th>Eintrag in der Datei</th></tr></thead><tbody>' +
        entries.map(function (e) {
          return '<tr><td>' + esc(GFX_NAMES[e[0]] || e[0]) + '</td><td class="val mono">' + e[1] + '</td><td class="why mono">' + esc(e[0]) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    if (!html) html = '<div class="warn">Die Datei wurde gelesen, aber keine bekannten Einträge gefunden.</div>';
    var bad = checks.filter(function (c) { return c[2] === 'bad'; }).length;
    $('prefOut').innerHTML = '<div class="' + (bad ? 'warn bad' : 'warn') + '">' + (bad ? bad + ' Punkt(e) solltest du ändern. Am einfachsten direkt im Spiel, nicht in der Datei.' : 'Keine groben Fehler bei Bildschirm und Synchronisation gefunden.') + ' ' + entries.length + ' Grafik-Einträge gelesen.</div>' + html;
  }
  $('prefFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    if (f.size > 5e6) { $('prefOut').innerHTML = '<div class="warn bad">Die Datei ist zu groß für eine preferences.xml.</div>'; return; }
    var rd = new FileReader();
    rd.onload = function () { readPrefs(String(rd.result)); };
    rd.readAsText(f);
    this.value = '';
  });

  /* ---------- init ---------- */
  fillStyles();
  gfx(); renderGame(); tank(); renderMoney(); renderPc();
  var start = (location.hash || '').slice(1);
  if (!document.getElementById('v-' + start)) { try { start = localStorage.getItem('wot-view') || 'gfx'; } catch (e) { start = 'gfx'; } }
  if (!document.getElementById('v-' + start)) start = 'gfx';
  show(start);
})();
