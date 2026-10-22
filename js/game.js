// Obránce planety – hra ve stylu Defender (Williams) na sadě Z (speccy.js).
(function () {
    'use strict';

    var WW = 1536;          // šířka světa (6 obrazovek), svět se opakuje
    var TOP = 33, BOT = 166; // svislé meze lodi
    var MMW = 104;          // šířka minimapy
    var HI_KEY = 'obrana';

    function mod(a, n) { return ((a % n) + n) % n; }
    function wd(a, b) { return mod(a - b + WW / 2, WW) - WW / 2; }   // vzdálenost po obvodu planety (a - b)
    function fl(v) { return Math.floor(v); }

    // ---------- Povrch planety
    var GH = [];
    (function () {
        for (var x = 0; x < WW; x++) {
            var a = x / WW * 6.2832;
            GH[x] = Math.round(175 - (6 * Math.sin(a * 2) + 3.5 * Math.sin(a * 7 + 1) + 2.5 * Math.sin(a * 13 + 2)));
        }
    })();
    function gy(x) { return GH[fl(mod(x, WW))]; }

    // ---------- Sprity
    var PAL = { w: 15, y: 14, r: 10, R: 2, c: 13, C: 5, g: 12, G: 4, m: 11, M: 3, b: 9, B: 1, o: 6 };
    var SHIP = [
        '.ww..........',
        '.wwwcc.......',
        'wwwwwwwwwwyy.',
        '.rrRRRRwwwwww',
        '..RRRRRRyy...',
        '...r..r......'
    ];
    var LANDER = [
        '...gggg...',
        '..gGGGGg..',
        '.gggwwggg.',
        'gg.GGGG.gg',
        'g..gggg..g',
        '...y..y...',
        '..y....y..'
    ];
    var MUTANT = [
        'm..mm..m',
        '.mmmmmm.',
        'mmwmmwmm',
        '.mmmmmm.',
        '..MmmM..',
        '.m.MM.m.',
        'm..mm..m'
    ];
    var BOMBER = [
        '.cccccc.',
        'cbbbbbbc',
        'cbyBByBc',
        'cbbbbbbc',
        '.cccccc.'
    ];
    var BAITER = [
        '...rrrrrr...',
        '.yyyyyyyyyy.',
        'rrwrrwrrwrrr',
        '..yyyyyyyy..'
    ];
    var ASTRO = [
        '.cc.',
        '.cc.',
        'wccw',
        '.CC.',
        '.CC.',
        '.w.w'
    ];
    var ICON = [
        '.ww.......',
        '.wwcc.....',
        'wwwwwwwwy.',
        '.rrRRwwww.'
    ];

    // ---------- Stav hry
    var state = 'title';
    var G = null;            // stav probíhající hry
    var R = Z.rng(777);
    var stars = [], t = 0;
    var sr = Z.rng(4242);
    for (var si = 0; si < 56; si++) { stars.push({ x: fl(sr() * 768), y: 34 + fl(sr() * 118), c: sr() < 0.3 ? 13 : sr() < 0.5 ? 6 : 7 }); }
    var overT = 0;

    function newGame() {
        R = Z.rng((Date.now() & 0xfffff) | 1);
        G = {
            score: 0, lives: 3, bombs: 3, wave: 0, nextLife: 10000, planet: true,
            ship: { x: 400, y: 90, vx: 0, vy: 0, dir: 1, cool: 0, inv: 0, held: null },
            camOff: 80, cam: 320, E: [], EB: [], shots: [], parts: [], pops: [], A: [],
            banner: 0, bannerText: '', bannerSub: '', endT: 0, boomT: 0, flash: 0, waveT: 0, dieT: 0, shake: 0, ids: 0
        };
        for (var i = 0; i < 10; i++) { addAstro(i, 10); }
        startWave();
        state = 'play';
    }

    function addAstro(i, n) {
        var x = i * WW / n + R() * 60;
        G.A.push({ x: x, y: gy(x) - 4, vy: 0, st: 'ground', dir: R() < 0.5 ? -1 : 1, wt: fl(R() * 120), hunter: null, fs: 0 });
    }

    function aliveAstros() { return G.A.filter(function (a) { return a.st !== 'dead'; }).length; }

    function startWave() {
        G.wave++;
        G.E = []; G.EB = []; G.waveT = 0; G.endT = 0; G.boomT = 0;
        var alive = aliveAstros();
        if (!G.planet || G.wave > 1) {
            if (!G.planet) { G.A = []; alive = 0; }
            var want = G.planet ? Math.min(10, alive + 3) : 10;
            var cur = G.A.filter(function (a) { return a.st !== 'dead'; });
            G.A = cur;
            for (var k = cur.length; k < want; k++) { addAstro(k, 10); }
        }
        G.planet = true;
        G.A.forEach(function (a) { a.st = 'ground'; a.hunter = null; a.y = gy(a.x) - 4; a.vy = 0; });
        G.ship.held = null;
        var nl = Math.min(3 + G.wave * 2, 16), nb = G.wave >= 2 ? Math.min(G.wave - 1, 5) : 0;
        for (var i = 0; i < nl; i++) { spawn('lander'); }
        for (var j = 0; j < nb; j++) { spawn('bomber'); }
        if (G.wave > 1 && G.bombs < 6) { G.bombs++; }
        G.banner = 130; G.bannerText = 'VLNA ' + G.wave; G.bannerSub = G.wave === 1 ? 'OBRAN ASTRONAUTY!' : 'POZOR NA MINY A MUTANTY!';
        Z.snd.seq([262, 330, 392, 523], 0.09);
    }

    function spawn(type, x, y) {
        var s = G.ship;
        var sx = x !== undefined ? x : mod(s.x + (R() < 0.5 ? -1 : 1) * (280 + R() * 450), WW);
        var e = { type: type, x: sx, y: y !== undefined ? y : 40 + R() * 55, id: ++G.ids, fire: 100 + fl(R() * 160), vx: R() < 0.5 ? -1 : 1, carry: null, tg: null, ph: R() * 6, life: 0 };
        if (type === 'baiter') { e.fire = 40; }
        if (type === 'bomber') { e.mt = 60 + fl(R() * 60); e.base = 50 + R() * 70; e.vx *= 0.5 + R() * 0.3; }
        G.E.push(e);
        return e;
    }

    var SIZE = { lander: [5, 4], mutant: [4, 4], bomber: [4, 3], baiter: [7, 3], mine: [3, 3] };
    var PTS = { lander: 150, mutant: 150, bomber: 250, baiter: 200, mine: 25 };

    function addScore(n) {
        G.score += n;
        while (G.score >= G.nextLife) {
            G.nextLife += 10000; G.lives++; G.bombs++;
            Z.snd.win();
            pop(G.ship.x, G.ship.y - 10, 'EXTRA LOD');
        }
    }
    function pop(x, y, txt) { G.pops.push({ x: x, y: y, txt: String(txt), life: 60 }); }

    function burst(x, y, n, cols, sp) {
        for (var i = 0; i < n; i++) {
            var a = R() * 6.2832, v = (0.3 + R()) * (sp || 1.6);
            G.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 22 + fl(R() * 28), c: cols[fl(R() * cols.length)] });
        }
    }

    function releaseCarried(e) {
        if (e.carry) {
            var a = e.carry;
            a.st = 'falling'; a.vy = 0; a.fs = a.y; a.hunter = null;
            e.carry = null;
        }
    }

    function destroy(e, pts) {
        releaseCarried(e);
        var i = G.E.indexOf(e);
        if (i >= 0) { G.E.splice(i, 1); }
        if (e.type === 'mine') { burst(e.x, e.y, 5, [14, 15], 1.2); }
        else { burst(e.x, e.y, 14, e.type === 'lander' ? [12, 14, 15] : e.type === 'mutant' ? [11, 15, 14] : [13, 14, 10, 15], 1.8); }
        Z.snd.boom();
        if (pts !== false) { addScore(PTS[e.type]); if (e.type !== 'mine') { pop(e.x, e.y - 6, PTS[e.type]); } }
    }

    function toMutant(e) { e.type = 'mutant'; e.carry = null; e.tg = null; e.fire = 60 + fl(R() * 100); }

    // ---------- Střelba nepřátel
    function aimShot(e, sp) {
        if (G.EB.length >= 9) { return; }
        var s = G.ship, dx = wd(s.x, e.x), dy = s.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        var err = Math.max(0.03, 0.35 - G.wave * 0.04) * (R() - 0.5) * 2;
        var c = Math.cos(err), sn = Math.sin(err);
        var ux = dx / d, uy = dy / d;
        G.EB.push({ x: e.x, y: e.y, vx: (ux * c - uy * sn) * sp, vy: (ux * sn + uy * c) * sp, life: 220 });
        Z.snd.beep(500, 0.08, 200, 0.02);
    }

    // ---------- Ovládání lodi
    function shipControl() {
        var s = G.ship, I = Z.input;
        var l = I.down('left'), r = I.down('right');
        if (l && !r) { s.dir = -1; s.vx -= s.vx > 0 ? 0.22 : 0.13; }
        else if (r && !l) { s.dir = 1; s.vx += s.vx < 0 ? 0.22 : 0.13; }
        else { s.vx *= 0.975; }
        s.vx = Z.clamp(s.vx, -3.4, 3.4);
        var u = I.down('up'), d = I.down('down');
        s.vy = u && !d ? -2.1 : d && !u ? 2.1 : 0;
        s.x = mod(s.x + s.vx, WW);
        s.y = Z.clamp(s.y + s.vy, TOP, BOT);
        if (s.cool > 0) { s.cool--; }
        if (s.inv > 0) { s.inv--; }
        if (I.down('fire') && s.cool <= 0 && G.shots.length < 5) {
            G.shots.push({ x: mod(s.x + s.dir * 14, WW), y: s.y, vx: s.dir * 7 + s.vx * 0.5, life: 30 });
            s.cool = 7; Z.snd.shoot();
        }
        if (I.hit('alt') && G.bombs > 0) { smartBomb(); }
        // záchrana astronauta: padající se zachytí
        if (!s.held) {
            for (var i = 0; i < G.A.length; i++) {
                var a = G.A[i];
                if (a.st === 'falling' && !a.deliver && Math.abs(wd(a.x, s.x)) < 10 && Math.abs(a.y - (s.y + 6)) < 10) {
                    a.st = 'held'; s.held = a; addScore(250); pop(a.x, a.y - 8, 250); Z.snd.coin(); break;
                }
            }
        } else {
            var h = s.held;
            if (s.y >= gy(s.x) - 28) {
                h.st = 'falling'; h.vy = 0.3; h.fs = h.y; s.held = null;
                h.deliver = true;
            }
        }
    }

    function smartBomb() {
        G.bombs--; G.flash = 12; G.shake = 14;
        var cx = G.cam + 128;
        for (var i = G.E.length - 1; i >= 0; i--) {
            var e = G.E[i];
            if (Math.abs(wd(e.x, cx)) < 132) { destroy(e); }
        }
        G.EB = G.EB.filter(function (b) { return Math.abs(wd(b.x, cx)) >= 132; });
        Z.snd.noise(0.6, 0.09);
        Z.snd.beep(900, 0.4, 60, 0.05);
    }

    // ---------- Aktualizace světa
    function updateAstros() {
        var s = G.ship;
        G.A.forEach(function (a) {
            if (a.st === 'ground') {
                a.wt--;
                if (a.wt <= 0) { a.wt = 60 + fl(R() * 140); a.dir = R() < 0.35 ? 0 : (R() < 0.5 ? -1 : 1); }
                a.x = mod(a.x + a.dir * 0.12, WW);
                a.y = gy(a.x) - 4;
            } else if (a.st === 'carried') {
                // poloha se nastavuje v unášeči
            } else if (a.st === 'falling') {
                a.vy = Math.min(a.vy + 0.03, 2.0);
                a.y += a.vy;
                var g = gy(a.x) - 4;
                if (a.y >= g) {
                    a.y = g;
                    if (a.y - a.fs > 78 && !a.deliver) {
                        a.st = 'dead'; burst(a.x, a.y, 10, [15, 10, 2], 1.2); Z.snd.hit(); pop(a.x, a.y - 8, 'X');
                    } else {
                        a.st = 'ground'; a.hunter = null; a.wt = 40;
                        if (a.deliver) { addScore(500); pop(a.x, a.y - 8, 500); Z.snd.win(); a.deliver = false; }
                    }
                }
            } else if (a.st === 'held') {
                a.x = s.x; a.y = s.y + 9;
            }
        });
    }

    function pickTarget(e) {
        var best = null, bd = 1e9;
        G.A.forEach(function (a) {
            if (a.st !== 'ground') { return; }
            if (a.hunter && a.hunter !== e && G.E.indexOf(a.hunter) >= 0 && a.hunter.tg === a) { return; }
            var d = Math.abs(wd(a.x, e.x));
            if (d < bd) { bd = d; best = a; }
        });
        if (best) { best.hunter = e; }
        return best;
    }

    function updateEnemies() {
        var s = G.ship, sp0 = Math.min(0.55 + G.wave * 0.04, 1.0);
        for (var i = G.E.length - 1; i >= 0; i--) {
            var e = G.E[i];
            e.life++;
            var dx = wd(s.x, e.x), dy = s.y - e.y;
            if (e.type === 'lander') {
                if (!G.planet) { toMutant(e); continue; }
                if (e.carry) {
                    e.y -= 0.38;
                    e.carry.x = e.x; e.carry.y = e.y + 9;
                    if (e.y <= TOP) {
                        e.carry.st = 'dead'; e.carry = null; toMutant(e);
                        Z.snd.beep(200, 0.5, 900, 0.05);
                        burst(e.x, e.y, 10, [11, 15], 1.4);
                    }
                } else {
                    if (!e.tg || e.tg.st !== 'ground') { e.tg = pickTarget(e); }
                    if (e.tg) {
                        var tx = wd(e.tg.x, e.x);
                        e.x = mod(e.x + Z.clamp(tx, -sp0, sp0), WW);
                        if (Math.abs(tx) < 5) {
                            e.y += 0.5;
                            if (e.y >= e.tg.y - 9) {
                                e.carry = e.tg; e.tg.st = 'carried'; e.tg.hunter = e; e.tg = null;
                                Z.snd.beep(700, 0.25, 300, 0.04);
                            }
                        } else if (e.y > 85) { e.y -= 0.3; }
                    } else {
                        e.x = mod(e.x + e.vx * 0.4, WW);
                        e.y = 60 + Math.sin((e.life + e.ph * 30) / 40) * 20;
                    }
                }
                e.fire--;
                if (e.fire <= 0) {
                    e.fire = Math.max(70, 220 + fl(R() * 180) - G.wave * 18);
                    if (Math.abs(dx) < 170) { aimShot(e, 1.0 + G.wave * 0.04); }
                }
            } else if (e.type === 'mutant') {
                var sp = Math.min(0.85 + G.wave * 0.05, 1.5);
                var wob = 0.6 + 0.5 * Math.sin(e.life / 9 + e.ph);
                e.x = mod(e.x + Z.clamp(dx, -sp, sp) * wob + (R() - 0.5) * 1.6, WW);
                e.y = Z.clamp(e.y + Z.clamp(dy, -sp * 0.7, sp * 0.7) * wob + (R() - 0.5) * 1.6, TOP - 2, BOT + 8);
                e.fire--;
                if (e.fire <= 0) {
                    e.fire = Math.max(60, 150 + fl(R() * 120) - G.wave * 10);
                    if (Math.abs(dx) < 190) { aimShot(e, 1.3 + G.wave * 0.05); }
                }
            } else if (e.type === 'bomber') {
                e.x = mod(e.x + e.vx, WW);
                e.y = e.base + Math.sin(e.life / 30 + e.ph) * 14;
                e.mt--;
                if (e.mt <= 0) {
                    e.mt = 80 + fl(R() * 70);
                    if (Math.abs(dx) < 420 && G.E.length < 40) { var m = spawn('mine', e.x, e.y + 4); m.ttl = 900; }
                }
            } else if (e.type === 'mine') {
                if (--e.ttl <= 0) { G.E.splice(i, 1); }
            } else if (e.type === 'baiter') {
                var bs = Math.min(1.9 + G.wave * 0.06, 2.8);
                var tdx = wd(s.x + s.vx * 25, e.x), tdy = s.y - e.y;
                var dd = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
                e.x = mod(e.x + tdx / dd * bs, WW);
                e.y = Z.clamp(e.y + tdy / dd * bs * 0.6, TOP - 2, BOT);
                e.fire--;
                if (e.fire <= 0) {
                    e.fire = 55 + fl(R() * 40);
                    if (Math.abs(dx) < 200) { aimShot(e, 1.8); }
                }
            }
        }
    }

    function updateBullets() {
        var s = G.ship;
        // laser
        for (var i = G.shots.length - 1; i >= 0; i--) {
            var b = G.shots[i];
            b.x = mod(b.x + b.vx, WW);
            if (--b.life <= 0) { G.shots.splice(i, 1); continue; }
            var hit = false;
            for (var j = G.E.length - 1; j >= 0; j--) {
                var e = G.E[j], sz = SIZE[e.type];
                if (Math.abs(wd(b.x, e.x)) < sz[0] + 6 && Math.abs(b.y - e.y) < sz[1] + 2) { destroy(e); hit = true; break; }
            }
            if (hit) { G.shots.splice(i, 1); }
        }
        // nepřátelské střely
        for (var k = G.EB.length - 1; k >= 0; k--) {
            var q = G.EB[k];
            q.x = mod(q.x + q.vx, WW); q.y += q.vy;
            if (--q.life <= 0 || q.y < 30 || q.y > 192) { G.EB.splice(k, 1); }
        }
    }

    function shipHit() {
        var s = G.ship;
        if (s.inv > 0 || state !== 'play') { return false; }
        for (var i = 0; i < G.E.length; i++) {
            var e = G.E[i], sz = SIZE[e.type];
            if (Math.abs(wd(e.x, s.x)) < sz[0] + 6 && Math.abs(e.y - s.y) < sz[1] + 3) { destroy(e); return true; }
        }
        for (var k = 0; k < G.EB.length; k++) {
            var q = G.EB[k];
            if (Math.abs(wd(q.x, s.x)) < 8 && Math.abs(q.y - s.y) < 5) { G.EB.splice(k, 1); return true; }
        }
        return false;
    }

    function killShip() {
        var s = G.ship;
        burst(s.x, s.y, 36, [15, 14, 10, 13], 2.4);
        if (s.held) { s.held.st = 'falling'; s.held.vy = 0; s.held.fs = s.held.y; s.held = null; }
        Z.snd.die(); Z.snd.noise(0.7, 0.08);
        G.lives--; G.dieT = 110; G.shake = 14;
        state = 'dying';
    }

    function planetBoom() {
        G.planet = false; G.boomT = 160; G.shake = 40;
        for (var i = 0; i < 70; i++) {
            var x = G.cam + R() * 256;
            G.parts.push({ x: x, y: 165 + R() * 25, vx: (R() - 0.5) * 2.5, vy: -R() * 2.6, life: 50 + fl(R() * 80), c: [14, 10, 2, 15][fl(R() * 4)] });
        }
        G.E.forEach(function (e) { if (e.type === 'lander') { toMutant(e); } });
        Z.snd.noise(1.4, 0.12); Z.snd.beep(300, 1.2, 30, 0.06);
        G.bannerText = 'PLANETA EXPLODOVALA!'; G.bannerSub = 'ASTRONAUTI ZAHYNULI'; G.banner = 140;
    }

    function updateFx() {
        for (var i = G.parts.length - 1; i >= 0; i--) {
            var p = G.parts[i];
            p.x = mod(p.x + p.vx, WW); p.y += p.vy;
            if (!G.planet) { p.vy += 0.02; }
            if (--p.life <= 0) { G.parts.splice(i, 1); }
        }
        for (var j = G.pops.length - 1; j >= 0; j--) {
            G.pops[j].y -= 0.3;
            if (--G.pops[j].life <= 0) { G.pops.splice(j, 1); }
        }
        if (G.flash > 0) { G.flash--; }
        if (G.shake > 0) { G.shake--; }
        if (G.banner > 0) { G.banner--; }
        if (G.boomT > 0) {
            G.boomT--;
            if (G.boomT % 3 === 0) {
                G.parts.push({ x: G.cam + R() * 256, y: 170 + R() * 20, vx: (R() - 0.5), vy: -R() * 1.8, life: 30 + fl(R() * 30), c: [14, 10, 6][fl(R() * 3)] });
            }
        }
    }

    function updateCam() {
        var s = G.ship;
        var target = s.dir > 0 ? 80 : 176;
        G.camOff += Z.clamp(target - G.camOff, -2.5, 2.5);
        G.cam = mod(s.x - G.camOff, WW);
    }

    function updateWorld() {
        updateAstros();
        updateEnemies();
        updateBullets();
        updateFx();
        // exploze planety
        if (G.planet && aliveAstros() === 0 && G.endT === 0) { planetBoom(); }
        // baitery, když se hráč zdržuje
        G.waveT++;
        if (G.endT === 0 && G.waveT > 1800 && G.waveT % 450 === 0) {
            if (G.E.filter(function (e) { return e.type === 'baiter'; }).length < 3) {
                var b = spawn('baiter', mod(G.ship.x + 300, WW), 60);
                b.fire = 60;
                Z.snd.beep(1500, 0.3, 500, 0.04);
            }
        }
        // konec vlny
        if (G.endT === 0 && !G.E.some(function (e) { return e.type === 'lander' || e.type === 'mutant' || e.type === 'bomber'; })) {
            G.E = []; G.EB = [];
            var n = aliveAstros(), bonus = G.planet ? n * 100 : 0;
            addScore(bonus);
            G.endT = 190; G.banner = 190;
            G.bannerText = 'VLNA ' + G.wave + ' ZDOLÁNA';
            G.bannerSub = G.planet ? 'BONUS ' + bonus + ' (' + n + ' ASTR.)' : 'PLANETA SE OBNOVÍ';
            Z.snd.win();
        }
        if (G.endT > 0 && --G.endT === 0) { startWave(); }
    }

    // ---------- Tick
    function tick() {
        t++;
        if (state === 'title') {
            Z.pauseOk = false;
            if (Z.input.hit('fire') || Z.input.hit('alt')) { newGame(); Z.snd.coin(); }
            return;
        }
        if (state === 'over') {
            Z.pauseOk = false;
            overT++;
            updateFx();
            if ((overT > 60 && Z.input.hit('fire')) || overT > 600) { state = 'title'; }
            return;
        }
        Z.pauseOk = true;
        if (state === 'play') {
            shipControl();
            updateCam();
            updateWorld();
            if (shipHit()) { killShip(); }
        } else if (state === 'dying') {
            updateCam();
            updateWorld();
            if (--G.dieT <= 0) {
                if (G.lives > 0) {
                    var s = G.ship;
                    s.vx = 0; s.y = 90; s.inv = 200; s.cool = 0;
                    G.EB = [];
                    G.E = G.E.filter(function (e) { return e.type === 'mine' ? Math.abs(wd(e.x, s.x)) > 80 : true; });
                    state = 'play';
                } else {
                    Z.hi.submit(HI_KEY, G.score);
                    state = 'over'; overT = 0; Z.snd.over();
                }
            }
        }
    }

    // ---------- Kreslení
    function sxOf(wx) { return mod(wx - G.cam + 64, WW) - 64; }

    function drawStars() {
        var c3 = G.cam / 3;
        stars.forEach(function (s) {
            var x = mod(s.x - c3, 256);
            Z.pix(x, s.y, s.c);
        });
    }

    function drawGround() {
        if (!G.planet) { return; }
        var ox = fl(G.cam);
        for (var x = 0; x < 256; x++) {
            var y = gy(ox + x);
            Z.rect(x, y, 1, 2, 14);
            Z.rect(x, y + 2, 1, 192 - y, (((ox + x) >> 3) & 1) ? 2 : 10);
        }
        if (G.boomT === 0) {
            // zvýraznění dálkových kopců
        }
    }

    function spr(rows, wx, y, pal, flip) {
        var w = rows[0].length, h = rows.length;
        Z.spriteC(Math.round(sxOf(wx) - w / 2), Math.round(y - h / 2), rows, pal || PAL, flip);
    }

    function drawEnemies() {
        G.E.forEach(function (e) {
            var x = sxOf(e.x);
            if (x < -20 || x > 276) { return; }
            if (e.type === 'lander') { spr(LANDER, e.x, e.y); }
            else if (e.type === 'mutant') { spr(MUTANT, e.x, e.y, null, (e.life >> 3) & 1); }
            else if (e.type === 'bomber') { spr(BOMBER, e.x, e.y); }
            else if (e.type === 'baiter') { spr(BAITER, e.x, e.y); }
            else if (e.type === 'mine') {
                var c = (t >> 3) & 1 ? 14 : 10;
                Z.rect(Math.round(x) - 1, Math.round(e.y) - 1, 3, 3, c);
                Z.pix(Math.round(x), Math.round(e.y), 15);
            }
        });
        G.EB.forEach(function (q) {
            var x = sxOf(q.x);
            if (x < -4 || x > 260) { return; }
            Z.rect(Math.round(x) - 1, Math.round(q.y) - 1, 2, 2, (t >> 1) & 1 ? 14 : 15);
        });
    }

    function drawAstros() {
        G.A.forEach(function (a) {
            if (a.st === 'dead') { return; }
            var x = sxOf(a.x);
            if (x < -10 || x > 266) { return; }
            spr(ASTRO, a.x, a.y);
        });
    }

    function drawShip() {
        var s = G.ship;
        if (state === 'dying') { return; }
        if (s.inv > 0 && (t >> 2) & 1) { return; }
        var x = sxOf(s.x);
        var flip = s.dir < 0;
        Z.spriteC(Math.round(x - 6), Math.round(s.y - 3), SHIP, PAL, flip);
        if (Z.input.down('left') || Z.input.down('right')) {
            var fx = Math.round(x) + (flip ? 7 : -8);
            Z.rect(fx + (flip ? 0 : -(1 + (t & 3))), Math.round(s.y) + 1, 2 + (t & 3), 1, (t >> 1) & 1 ? 14 : 10);
        }
    }

    function drawShots() {
        G.shots.forEach(function (b) {
            var x = Math.round(sxOf(b.x)), d = b.vx > 0 ? -1 : 1, y = Math.round(b.y);
            Z.rect(Math.min(x, x + d * 14), y, 14, 1, 15);
            Z.rect(Math.min(x, x + d * 8), y - 1, 8, 1, (t >> 1) & 1 ? 13 : 12);
            Z.rect(Math.min(x, x + d * 8), y + 1, 8, 1, (t >> 1) & 1 ? 12 : 13);
        });
    }

    function drawParts() {
        G.parts.forEach(function (p) {
            var x = sxOf(p.x);
            if (x < 0 || x > 255) { return; }
            Z.pix(x, p.y, p.life < 10 && (t & 1) ? 2 : p.c);
        });
    }

    function drawPops() {
        G.pops.forEach(function (p) {
            var x = sxOf(p.x);
            if (x < -20 || x > 270) { return; }
            Z.text(x, p.y - 4, p.txt, 15, { align: 'center' });
        });
    }

    function drawMinimap() {
        var s = G.ship, mx0 = 76, my0 = 9, mh = 21;
        Z.rect(mx0, my0, MMW + 2, mh, 0);
        Z.frame(mx0 - 1, my0 - 1, MMW + 4, mh + 2, 5);
        function mmY(y) { return Math.round(my0 + 1 + (y - TOP) * (mh - 3) / (192 - TOP)); }
        function mmX(wx) { return mx0 + 1 + MMW / 2 + wd(wx, s.x) * MMW / WW; }
        if (G.planet) {
            for (var i = 0; i < MMW; i++) {
                var wx = s.x + (i - MMW / 2) * WW / MMW;
                Z.pix(mx0 + 1 + i, mmY(gy(wx)), 6);
            }
        }
        // výřez obrazovky
        var vx = mmX(G.cam + 128), vw = 256 * MMW / WW;
        Z.frame(Math.round(vx - vw / 2), my0, Math.round(vw), mh - 1, 3);
        G.A.forEach(function (a) { if (a.st !== 'dead') { Z.pix(mmX(a.x), mmY(a.y), 15); } });
        G.E.forEach(function (e) {
            var c = e.type === 'lander' ? 12 : e.type === 'mutant' ? 11 : e.type === 'bomber' ? 13 : e.type === 'baiter' ? 10 : 6;
            if (e.type === 'mine') { return; }
            Z.pix(mmX(e.x), mmY(e.y), c);
            if (e.type === 'lander' || e.type === 'mutant') { Z.pix(mmX(e.x) + 1, mmY(e.y), c); }
        });
        if (state !== 'dying') { Z.rect(Math.round(mmX(s.x)) - 1, mmY(s.y), 3, 1, 15); }
    }

    function drawHud() {
        Z.rect(0, 0, 256, 32, 0);
        Z.text(2, -1, Z.pad(G.score, 6), 15);
        Z.text(254, -1, Z.pad(Math.max(Z.hi.get(HI_KEY), G.score), 6), 6, { align: 'right' });
        for (var i = 0; i < Math.min(G.lives - (state === 'dying' ? 0 : 1), 5); i++) {
            Z.spriteC(2 + i * 12, 10, ICON, PAL, false);
        }
        for (var b = 0; b < Math.min(G.bombs, 6); b++) {
            Z.disc(4 + b * 8, 24, 2, 14); Z.pix(4 + b * 8, 24, 10);
        }
        Z.text(254, 10, 'VLNA ' + G.wave, 13, { align: 'right' });
        Z.text(254, 20, 'ASTR. ' + aliveAstros(), 15, { align: 'right' });
    }

    function drawPlay() {
        Z.cls(0, 7);
        var sh = G.shake > 0 ? (G.shake & 1 ? 1 : -1) : 0;
        Z.border = G.flash > 0 ? 7 : G.boomT > 0 && (t >> 2) & 1 ? 2 : 0;
        drawStars();
        drawGround();
        drawAstros();
        drawEnemies();
        drawShots();
        drawShip();
        drawParts();
        drawPops();
        if (G.flash > 8) { for (var y = TOP; y < 192; y += 2) { Z.rect(0, y, 256, 1, 15); } }
        drawHud();
        drawMinimap();
        if (G.banner > 0 && state !== 'over') {
            Z.text(128, 66, G.bannerText, 14, { align: 'center', scale: 2 });
            Z.text(128, 88, G.bannerSub, 15, { align: 'center' });
        }
        if (sh) { /* otřes: posun HUD ne, jen okraj */ Z.border = Z.border || 1; }
    }

    function drawTitle() {
        Z.cls(0, 7);
        Z.border = 0;
        var i;
        for (i = 0; i < stars.length; i++) { Z.pix((stars[i].x + (t >> 3)) % 256, stars[i].y + 4, stars[i].c); }
        Z.text(128, 8, 'OBRÁNCE', 11, { align: 'center', scale: 3 });
        Z.text(128, 31, 'PLANETY', 14, { align: 'center', scale: 3 });
        // legenda
        var lx = 40, ly = 62;
        Z.spriteC(lx, ly, LANDER, PAL); Z.text(lx + 18, ly - 1, 'UNOSCE 150 - UNÁŠÍ LIDI', 15);
        Z.spriteC(lx + 1, ly + 12, ASTRO, PAL); Z.text(lx + 18, ly + 11, 'ASTRONAUT - CHYŤ HO!', 13);
        Z.spriteC(lx, ly + 24, MUTANT, PAL); Z.text(lx + 18, ly + 23, 'MUTANT 150 - HONÍ TĚ', 11);
        Z.spriteC(lx, ly + 35, BOMBER, PAL); Z.text(lx + 18, ly + 34, 'MINOVAČ 250 - ŠÍŘÍ MINY', 13);
        Z.spriteC(lx - 2, ly + 46, BAITER, PAL); Z.text(lx + 18, ly + 45, 'PODRAZ 200 - ZDRŽÍŠ-LI SE', 10);
        Z.text(128, 120, 'ŠIPKY - LET A OTOČENÍ', 7, { align: 'center' });
        Z.text(128, 130, 'MEZERNÍK/Z - LASER  X - SMART BOMBA', 7, { align: 'center' });
        Z.text(128, 140, 'P - PAUZA  M - ZVUK', 7, { align: 'center' });
        Z.text(128, 150, 'SESTŘEL UNOSCE S ASTRONAUTEM,', 6, { align: 'center' });
        Z.text(128, 159, 'PADAJÍCÍHO ZACHYŤ. BEZ LIDÍ PLANETA ZAHYNE', 6, { align: 'center' });
        if ((t >> 5) & 1) { Z.text(128, 172, 'STISKNI OHEŇ PRO START', 15, { align: 'center' }); }
        Z.text(128, 183, 'REKORD ' + Z.pad(Z.hi.get(HI_KEY), 6), 14, { align: 'center' });
        // loď létající nahoře
        var sx = (t * 2) % 330 - 40;
        Z.spriteC(sx, 56 - 12, SHIP, PAL, false);
    }

    function drawOver() {
        drawPlay();
        Z.rect(48, 70, 160, 54, 0); Z.frame(48, 70, 160, 54, 10);
        Z.text(128, 76, 'KONEC HRY', 10, { align: 'center', scale: 2 });
        Z.text(128, 96, 'SKÓRE ' + Z.pad(G.score, 6), 15, { align: 'center' });
        var hi = Z.hi.get(HI_KEY);
        Z.text(128, 106, G.score >= hi && G.score > 0 ? 'NOVÝ REKORD!' : 'REKORD ' + Z.pad(hi, 6), 14, { align: 'center' });
        if (overT > 60 && (t >> 5) & 1) { Z.text(128, 138, 'STISKNI OHEŇ', 7, { align: 'center' }); }
    }

    function draw() {
        if (state === 'title') { drawTitle(); }
        else if (state === 'over') { drawOver(); }
        else { drawPlay(); }
    }

    window.GAME = {
        get state() { return state; }, get G() { return G; },
        newGame: newGame, wd: wd, gy: gy, mod: mod, WW: WW, spawn: spawn, planetBoom: planetBoom,
        setState: function (s) { state = s; }
    };

    Z.init({
        title: 'Obránce planety',
        touch: [
            { act: 'left', label: '◀' }, { act: 'right', label: '▶' },
            { act: 'up', label: '▲' }, { act: 'down', label: '▼' },
            { act: 'alt', label: 'BOMBA' }, { act: 'fire', label: 'OHEŇ', cls: 'big' }
        ]
    });
    Z.run({ tick: tick, draw: draw });
})();
