// Reference data for the Rig-Tool. All performance numbers are estimates, not benchmarks.
window.RIG_DATA = (function () {
  // Relative raster performance, RTX 4090 = 100.
  const GPUS = [
    ['NVIDIA RTX 5090', 130], ['NVIDIA RTX 5080', 85], ['NVIDIA RTX 5070 Ti', 75], ['NVIDIA RTX 5070', 60], ['NVIDIA RTX 5060 Ti', 45], ['NVIDIA RTX 5060', 40],
    ['NVIDIA RTX 4090', 100], ['NVIDIA RTX 4080 Super', 80], ['NVIDIA RTX 4080', 78], ['NVIDIA RTX 4070 Ti Super', 68], ['NVIDIA RTX 4070 Ti', 63], ['NVIDIA RTX 4070 Super', 58], ['NVIDIA RTX 4070', 50], ['NVIDIA RTX 4060 Ti', 38], ['NVIDIA RTX 4060', 32],
    ['NVIDIA RTX 3090 Ti', 62], ['NVIDIA RTX 3090', 57], ['NVIDIA RTX 3080 Ti', 55], ['NVIDIA RTX 3080', 50], ['NVIDIA RTX 3070 Ti', 42], ['NVIDIA RTX 3070', 39], ['NVIDIA RTX 3060 Ti', 35], ['NVIDIA RTX 3060', 27], ['NVIDIA RTX 3050', 18],
    ['NVIDIA RTX 2080 Ti', 40], ['NVIDIA RTX 2080 Super', 34], ['NVIDIA RTX 2080', 32], ['NVIDIA RTX 2070 Super', 30], ['NVIDIA RTX 2070', 27], ['NVIDIA RTX 2060 Super', 25], ['NVIDIA RTX 2060', 22],
    ['NVIDIA GTX 1660 Ti', 18], ['NVIDIA GTX 1660 Super', 18], ['NVIDIA GTX 1660', 16], ['NVIDIA GTX 1650', 11], ['NVIDIA GTX 1080 Ti', 28], ['NVIDIA GTX 1080', 22], ['NVIDIA GTX 1070 Ti', 20], ['NVIDIA GTX 1070', 18], ['NVIDIA GTX 1060', 13],
    ['AMD RX 9070 XT', 72], ['AMD RX 9070', 62], ['AMD RX 7900 XTX', 82], ['AMD RX 7900 XT', 70], ['AMD RX 7900 GRE', 58], ['AMD RX 7800 XT', 52], ['AMD RX 7700 XT', 43], ['AMD RX 7600 XT', 30], ['AMD RX 7600', 28],
    ['AMD RX 6950 XT', 56], ['AMD RX 6900 XT', 52], ['AMD RX 6800 XT', 48], ['AMD RX 6800', 42], ['AMD RX 6750 XT', 36], ['AMD RX 6700 XT', 34], ['AMD RX 6650 XT', 28], ['AMD RX 6600 XT', 27], ['AMD RX 6600', 24], ['AMD RX 5700 XT', 23], ['AMD RX 580', 11],
    ['Intel Arc B580', 30], ['Intel Arc A770', 27], ['Intel Arc A750', 24]
  ];

  // Single-thread speed relative to tier 1. iRacing's main thread decides how many cars stay smooth.
  const CPU_TIERS = [
    { id: 1, label: 'Einsteiger', hint: 'z. B. i5-8400, Ryzen 5 2600', perf: 1.0 },
    { id: 2, label: 'Mittelklasse', hint: 'z. B. i5-12600K, Ryzen 5 5600X', perf: 1.45 },
    { id: 3, label: 'Oberklasse', hint: 'z. B. i7-13700K, Ryzen 7 7700X', perf: 1.8 },
    { id: 4, label: 'Top', hint: 'z. B. Ryzen 7 7800X3D / 9800X3D, i9-14900K', perf: 2.3 }
  ];

  const DISPLAY = {
    single: { label: 'Ein Monitor', res: [['1920x1080', '1920 × 1080'], ['2560x1440', '2560 × 1440'], ['3840x2160', '3840 × 2160']] },
    ultrawide: { label: 'Ultrawide', res: [['2560x1080', '2560 × 1080'], ['3440x1440', '3440 × 1440'], ['3840x1600', '3840 × 1600'], ['5120x1440', '5120 × 1440'], ['5120x2160', '5120 × 2160']] },
    triple: { label: 'Triple-Screen', res: [['1920x1080', '3 × 1920 × 1080'], ['2560x1440', '3 × 2560 × 1440'], ['3840x2160', '3 × 3840 × 2160']] },
    vr: { label: 'VR', res: [['quest3', 'Meta Quest 3 / 3S'], ['quest2', 'Meta Quest 2'], ['pico4', 'Pico 4 / 4 Ultra'], ['g2', 'HP Reverb G2'], ['index', 'Valve Index'], ['crystal', 'Pimax Crystal / Light'], ['beyond2', 'Bigscreen Beyond 2'], ['aero', 'Varjo Aero']] }
  };
  const VR_EYE = { quest3: [2064, 2208], quest2: [1832, 1920], pico4: [2160, 2160], g2: [2160, 2160], index: [1440, 1600], crystal: [2880, 2880], beyond2: [2560, 2560], aero: [2880, 2720] };
  const HZ = { flat: [60, 75, 100, 120, 144, 165, 180, 240], vr: [72, 80, 90, 120] };

  // g = GPU cost units per option, c = CPU ms per option.
  // w = value of one step up for [race, balanced, looks]; 0 means the optimizer never raises it.
  const SETTINGS = [
    { id: 'msaa', group: 'Bild', name: 'Kantenglättung (MSAA)', opts: [['Aus', 0], ['2x', 1.5], ['4x', 3], ['8x', 5.5]], w: [2, 3, 3], note: 'Kostet bei Triple-Screen und VR besonders viel.' },
    { id: 'af', group: 'Bild', name: 'Anisotrope Filterung', opts: [['2x', 0], ['4x', 0.2], ['8x', 0.4], ['16x', 0.6]], w: [3, 3, 3], note: 'Schärft Strecke und Curbs in der Ferne. Fast kostenlos.' },
    { id: 'post', group: 'Bild', name: 'Post-Processing / HDR', opts: [['Aus', 0], ['An', 1.2]], w: [0, 1, 2.5], note: 'Reine Optik.' },
    { id: 'haze', group: 'Bild', name: 'Hitzeflimmern', opts: [['Aus', 0], ['An', 0.6]], w: [0, 0.3, 1.5], note: 'Lenkt im Rennen ab.' },
    { id: 'shadow', group: 'Schatten', name: 'Schattenqualität', opts: [['Niedrig', 0], ['Mittel', 1.5], ['Hoch', 3], ['Sehr hoch', 5]], w: [1, 2, 3], note: 'Einer der größten FPS-Fresser.' },
    { id: 'carshadow', group: 'Schatten', name: 'Dynamische Fahrzeugschatten', opts: [['Aus', 0], ['An', 1.5, 0.3]], w: [0.5, 1.5, 2], note: 'Kostet pro Fahrzeug, spürbar in vollen Feldern.' },
    { id: 'cars', group: 'Fahrzeuge', name: 'Gerenderte Fahrzeuge', opts: [['12', 0, 0], ['20', 0.2, 0.6], ['30', 0.4, 1.4], ['45', 0.6, 2.6], ['63', 0.8, 4.0]], w: [3, 2.5, 2], note: 'Wichtigster Regler für die CPU. Bei Rucklern am Start zuerst hier senken.' },
    { id: 'detail', group: 'Fahrzeuge', name: 'Detaillierte Fahrzeuge', opts: [['4', 0, 0], ['6', 0.3, 0.2], ['10', 0.6, 0.5], ['15', 0.9, 0.9], ['20', 1.2, 1.3]], w: [1.5, 1.5, 2], note: 'Nur die nächsten Autos brauchen volle Details.' },
    { id: 'cartex', group: 'Fahrzeuge', name: 'Fahrzeug-Details / Texturen', opts: [['Niedrig', 0], ['Mittel', 0.8], ['Hoch', 1.6]], w: [1, 2, 2.5], vram: 8, note: 'Hoch braucht mindestens 8 GB Grafikspeicher.' },
    { id: 'mirrorcars', group: 'Spiegel', name: 'Spiegel: Fahrzeuge', opts: [['4', 0, 0], ['6', 0.2, 0.2], ['8', 0.4, 0.4], ['12', 0.6, 0.7], ['16', 0.8, 1.0]], w: [2.5, 1.2, 1], note: 'Im Rennen reichen 8 bis 12.' },
    { id: 'mirrorq', group: 'Spiegel', name: 'Spiegel: Qualität', opts: [['Niedrig', 0], ['Mittel', 1], ['Hoch', 2]], w: [1.5, 1.5, 1.5], note: 'Mit Spotter-Overlay kann der Cockpit-Spiegel weiter runter.' },
    { id: 'track', group: 'Umgebung', name: 'Strecken-Details', opts: [['Niedrig', 0], ['Mittel', 1], ['Hoch', 2], ['Sehr hoch', 3]], w: [1.5, 2, 2.5], note: '' },
    { id: 'sky', group: 'Umgebung', name: 'Himmel & Wolken', opts: [['Niedrig', 0], ['Mittel', 1], ['Hoch', 2], ['Sehr hoch', 3.5]], w: [0.3, 1.5, 2.5], note: 'Volumetrische Wolken sind teuer, besonders in VR.' },
    { id: 'grass', group: 'Umgebung', name: 'Gras', opts: [['Aus', 0], ['Niedrig', 0.3], ['Mittel', 0.7], ['Hoch', 1.2]], w: [0.2, 1, 1.5], note: '' },
    { id: 'crowd', group: 'Umgebung', name: 'Zuschauer', opts: [['Aus', 0, 0], ['Niedrig', 0.3, 0.3], ['Mittel', 0.6, 0.6], ['Hoch', 0.9, 1.0]], w: [0, 0.5, 1.5], note: 'Kostet CPU und bringt im Rennen nichts.' },
    { id: 'pit', group: 'Umgebung', name: 'Boxenobjekte & Crew', opts: [['Aus', 0, 0], ['Niedrig', 0.2, 0.2], ['Mittel', 0.4, 0.35], ['Hoch', 0.6, 0.5]], w: [0, 0.5, 1], note: '' },
    { id: 'fx', group: 'Umgebung', name: 'Partikel & Effekte', opts: [['Niedrig', 0], ['Mittel', 0.5], ['Hoch', 1]], w: [0.3, 1, 1.5], note: 'Regen-Gischt bleibt auch auf Niedrig sichtbar.' }
  ];

  const GOALS = [
    { id: 'race', label: 'Rennen', hint: 'stabile FPS, wenig Ablenkung', headroom: 0.8 },
    { id: 'balanced', label: 'Ausgewogen', hint: 'Rennen und Optik', headroom: 0.85 },
    { id: 'looks', label: 'Optik', hint: 'Replays, Stream, Screenshots', headroom: 0.95 }
  ];

  const FUNCS = [
    ['Fahren', [['steer', 'Lenkung', 'axis'], ['throttle', 'Gas', 'axis'], ['brake', 'Bremse', 'axis'], ['clutch', 'Kupplung', 'axis'], ['up', 'Hochschalten'], ['down', 'Runterschalten'], ['handbrake', 'Handbremse']]],
    ['Fahrhilfen', [['bbPlus', 'Bremsbalance +'], ['bbMinus', 'Bremsbalance −'], ['tcPlus', 'Traktionskontrolle +'], ['tcMinus', 'Traktionskontrolle −'], ['absPlus', 'ABS +'], ['absMinus', 'ABS −'], ['mapPlus', 'Motor-Map +'], ['mapMinus', 'Motor-Map −']]],
    ['Hybrid & Formel', [['deployPlus', 'Hybrid-Deploy +'], ['deployMinus', 'Hybrid-Deploy −'], ['migPlus', 'Bremsmigration +'], ['migMinus', 'Bremsmigration −'], ['p2p', 'Push-to-Pass / Overtake'], ['diffPlus', 'Differenzial +'], ['diffMinus', 'Differenzial −']]],
    ['Fahrzeug', [['limiter', 'Pit-Limiter'], ['lights', 'Scheinwerfer'], ['flash', 'Lichthupe'], ['wipers', 'Scheibenwischer'], ['ignition', 'Zündung'], ['starter', 'Starter']]],
    ['Black Box', [['bbxNext', 'Black Box weiter'], ['bbxPrev', 'Black Box zurück'], ['selUp', 'Auswahl hoch'], ['selDown', 'Auswahl runter'], ['valUp', 'Wert +'], ['valDown', 'Wert −'], ['pitBox', 'Boxenstopp-Menü'], ['relative', 'Relative']]],
    ['Funk & Sicht', [['ptt', 'Push-to-Talk'], ['chat', 'Chat'], ['lookL', 'Blick links'], ['lookR', 'Blick rechts']]]
  ];

  // Which functions a car class realistically needs on the wheel. Suggestions, not iRacing rules.
  const BASICS = ['steer', 'throttle', 'brake', 'up', 'down', 'limiter', 'bbxNext', 'bbxPrev', 'valUp', 'valDown', 'pitBox', 'ptt'];
  const CLASSES = {
    'Allgemein': BASICS.concat(['clutch', 'bbPlus', 'bbMinus', 'flash', 'relative']),
    'GT3 / GT4': BASICS.concat(['bbPlus', 'bbMinus', 'tcPlus', 'tcMinus', 'absPlus', 'absMinus', 'mapPlus', 'mapMinus', 'flash', 'lights', 'wipers', 'relative']),
    'GTP / LMDh': BASICS.concat(['bbPlus', 'bbMinus', 'tcPlus', 'tcMinus', 'deployPlus', 'deployMinus', 'migPlus', 'migMinus', 'flash', 'lights', 'wipers', 'relative']),
    'Formel': BASICS.concat(['bbPlus', 'bbMinus', 'p2p', 'diffPlus', 'diffMinus', 'mapPlus', 'mapMinus', 'relative']),
    'Oval': BASICS.concat(['bbPlus', 'bbMinus', 'relative', 'lookL', 'lookR']),
    'Straßenauto / MX-5': BASICS.concat(['clutch', 'flash', 'lookL', 'lookR', 'relative'])
  };

  const WHEEL_VENDORS = { '0EB7': 'Fanatec', '346E': 'Moza', '046D': 'Logitech', '044F': 'Thrustmaster', '16D0': 'Simucube', '2433': 'Asetek', '3670': 'Simagic', '30B7': 'Heusinkveld', '1DD2': 'Leo Bodnar', '3416': 'Cammus' };

  return { GPUS, CPU_TIERS, DISPLAY, VR_EYE, HZ, SETTINGS, GOALS, FUNCS, CLASSES, WHEEL_VENDORS };
})();
