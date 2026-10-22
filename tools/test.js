// Testy hry Obránce planety v Node (headless). Spuštění: node tools/test.js [adresář pro PNG]
const path = require('path');
const assert = require('assert');
const H = require('/Users/hyman/EngetoAcademy/TizenOS/_kit/headless.js');
const root = path.join(__dirname, '..');
const out = process.argv[2] || '/tmp';
const g = H.load([root + '/js/speccy.js', root + '/js/game.js']);
const GM = g.sandbox.GAME;
const KEY = { left: 37, right: 39, up: 38, down: 40, fire: 32, alt: 88 };
function hold(a, on) { g.key(KEY[a], on); }
function tapFire() { hold('fire', true); g.step(2); hold('fire', false); g.step(1); }
function bad(o, seen) {
    seen = seen || new Set();
    if (typeof o === 'number') return !isFinite(o);
    if (!o || typeof o !== 'object' || seen.has(o)) return false;
    seen.add(o);
    return Object.keys(o).some(k => bad(o[k], seen));
}
function noNaN() { assert(!bad(GM.G), 'NaN ve stavu'); }

// title
g.step(30); assert.strictEqual(GM.state, 'title');
g.png(out + '/title.png', 3);
tapFire(); assert.strictEqual(GM.state, 'play');
const G = GM.G;
assert.strictEqual(G.A.length, 10);
g.step(60); g.png(out + '/play.png', 3); noNaN();

// bot: dokonči první vlnu
function bot() {
    const s = G.ship;
    ['left', 'right', 'up', 'down', 'fire'].forEach(a => hold(a, false));
    let best = null, bd = 1e9;
    G.E.forEach(e => { if (e.type === 'mine') return; const d = Math.abs(GM.wd(e.x, s.x)) + Math.abs(e.y - s.y); if (d < bd) { bd = d; best = e; } });
    if (!best) return;
    const dx = GM.wd(best.x, s.x), dy = best.y - s.y;
    const want = dx > 0 ? 1 : -1;
    if (Math.abs(dx) > 90) hold(want > 0 ? 'right' : 'left', true);
    else if (s.dir !== want) hold(want > 0 ? 'right' : 'left', true);
    else if (Math.abs(dx) < 60) hold(want > 0 ? 'left' : 'right', Math.abs(s.vx) > 1.0 && Math.sign(s.vx) === want);
    if (Math.abs(dy) > 3) hold(dy > 0 ? 'down' : 'up', true);
    if (Math.abs(dy) < 8 && s.dir === want && Math.abs(dx) < 230) hold('fire', true);
}
let ticks = 0, wave1Done = false, mutantsSeen = false, maxLives = 0;
while (ticks < 60000) {
    if (GM.state === 'play') bot();
    g.step(1); ticks++;
    if (ticks % 500 === 0) noNaN();
    if (ticks === 700) g.png(out + '/action.png', 3);
    if (G.E.some(e => e.type === 'mutant')) mutantsSeen = true;
    if (G.wave >= 3) break;
    if (GM.state === 'over') break;
    if (G.wave === 2 && !wave1Done) { wave1Done = true; g.png(out + '/wave2.png', 3); }
}
console.log('bot: ticks', ticks, 'wave', G.wave, 'state', GM.state, 'score', G.score, 'lives', G.lives, 'astro', G.A.filter(a => a.st !== 'dead').length, 'mutants seen', mutantsSeen);
assert(wave1Done, 'bot nedokončil první vlnu');
noNaN();

// záchrana: padající astronaut zachycen lodí a doručen
(function () {
    const g2 = H.load([root + '/js/speccy.js', root + '/js/game.js']);
    const M = g2.sandbox.GAME;
    g2.key(32, true); g2.step(2); g2.key(32, false); g2.step(1);
    const D = M.G; D.E = [];                       // bez nepřátel (konec vlny hned neřeš: přidej ukotvený lander daleko)
    const l = M.spawn('lander', D.ship.x + 700, 60); l.tg = null;
    const a = D.A[0]; a.st = 'falling'; a.x = D.ship.x; a.y = D.ship.y - 40; a.vy = 0; a.fs = a.y - 100; a.hunter = null;
    D.ship.vx = 0;
    for (let i = 0; i < 60 && a.st !== 'held'; i++) g2.step(1);
    assert.strictEqual(a.st, 'held', 'astronaut nezachycen');
    g2.key(40, true);
    for (let i = 0; i < 200 && a.st === 'held'; i++) g2.step(1);
    g2.key(40, false);
    for (let i = 0; i < 100 && a.st !== 'ground'; i++) g2.step(1);
    assert.strictEqual(a.st, 'ground', 'astronaut nedoručen'); console.log('záchrana OK, skóre', D.score);

    // pád z velké výšky = smrt
    const b = D.A[1]; b.st = 'falling'; b.x = D.ship.x + 400; b.y = 40; b.fs = 40; b.vy = 0; b.hunter = null;
    for (let i = 0; i < 400 && b.st === 'falling'; i++) g2.step(1);
    assert.strictEqual(b.st, 'dead', 'astronaut měl zahynout');

    // únos: lander s astronautem nahoře -> mutant
    const c = D.A[2]; const ln = M.spawn('lander', c.x, c.y - 12); ln.tg = c; c.hunter = ln;
    for (let i = 0; i < 1500 && ln.type === 'lander'; i++) g2.step(1);
    assert.strictEqual(ln.type, 'mutant', 'lander se nestal mutantem'); assert.strictEqual(c.st, 'dead');
    console.log('únos -> mutant OK');

    // výbuch planety, když všichni zahynou
    D.A.forEach(x => { x.st = 'dead'; });
    g2.step(3);
    assert.strictEqual(D.planet, false, 'planeta měla explodovat');
    g2.step(30); g2.png(out + '/boom.png', 3);
    assert(!bad(D));
    // smrt lodi: životy -> over -> title
    D.ship.inv = 0; D.EB.push({ x: D.ship.x, y: D.ship.y, vx: 0, vy: 0, life: 50 });
    for (let k = 0; k < 3; k++) {
        D.E.forEach(e => { e.x = (D.ship.x + 700) % M.WW; }); D.ship.inv = 0; D.EB.push({ x: D.ship.x, y: D.ship.y, vx: 0, vy: 0, life: 50 });
        g2.step(2);
        assert.strictEqual(M.state, 'dying');
        for (let i = 0; i < 400 && M.state === 'dying'; i++) g2.step(1);
    }
    assert.strictEqual(M.state, 'over', 'mělo být over, je ' + M.state);
    g2.step(5); g2.png(out + '/over.png', 3);
    for (let i = 0; i < 70; i++) g2.step(1);
    g2.key(32, true); g2.step(2); g2.key(32, false); g2.step(2);
    assert.strictEqual(M.state, 'title');
    console.log('prohra -> over -> title OK, rekord', g2.Z.hi.get('obrana'));
})();
console.log('VŠE OK');
