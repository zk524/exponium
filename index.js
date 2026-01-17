import { initWasm, createGame, isReady } from './wasm.js';

const $ = id => document.getElementById(id);
const state = { game: null, started: false, history: [], size: 128, harvestIdx: 0 };
const [c1, c2] = [$('chart1'), $('chart2')];
const [x1, x2] = [c1.getContext('2d'), c2.getContext('2d')];
let lastT = performance.now();

const replay = () => {
    state.size = +$('size').value || 128;
    state.game?.free();
    state.game = createGame($('rate').value || '1.0', $('cost').value || '1');
    state.game.set_freq($('freq').value || '1');
    Object.assign(state, { started: false, history: [], harvestIdx: 0 });
    updateUI(); draw();
    $('hint').textContent = 'Press [Enter] to start';
};

const updateUI = () => {
    const g = state.game;
    ['time','totl','step','earn','prin','rate','cost','freq'].forEach(k => 
        $('s-'+k).textContent = g[k+'_str']());
    $('freq').value = g.freq_str();
};

const drawChart = (cv, ctx, isLog) => {
    const w = cv.offsetWidth, h = cv.offsetHeight, p = 50;
    ctx.clearRect(0, 0, w, h);
    if (state.history.length < 2) return;
    
    const logs = state.history.map(x => x.neg ? -Math.abs(x.log10) : x.log10);
    const [minL, maxL] = [Math.min(...logs), Math.max(...logs)];
    const range = maxL - minL || 1;
    
    let vals, minV, maxV;
    if (isLog) {
        vals = logs;
        minV = minL - range * 0.05 - 0.1;
        maxV = maxL + range * 0.05 + 0.1;
    } else {
        const absLogs = state.history.map(x => Math.abs(x.log10));
        const minAbs = Math.min(...absLogs);
        vals = state.history.map(x => {
            const rel = Math.abs(x.log10) - minAbs;
            const v = Math.pow(10, Math.min(rel, 300));
            return x.neg ? -v : v;
        });
        minV = Math.min(...vals, 0);
        maxV = Math.max(...vals);
    }
    const rng = maxV - minV || 1;
    const toY = v => p + (h-p*2) * (1 - (v-minV)/rng);
    const toX = i => p + (w-p*2) * i / (vals.length-1);

    ctx.strokeStyle = '#1a2a3a'; ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = p + (h-p*2)*i/5;
        ctx.beginPath(); ctx.moveTo(p, y); ctx.lineTo(w-p, y); ctx.stroke();
    }
    ctx.fillStyle = '#4a5568'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
        const y = p + (h-p*2)*i/5;
        if (isLog) {
            const v = (maxV + range*0.05 + 0.1) - (maxV - minV + range*0.1 + 0.2)*i/5;
            ctx.fillText(v.toFixed(1), p-5, y+3);
        } else {
            const ratio = 1 - i/5;
            const logVal = minL + range * ratio;
            const mantissa = Math.pow(10, logVal - Math.floor(logVal));
            ctx.fillText(mantissa.toFixed(2) + 'e' + Math.floor(logVal), p-5, y+3);
        }
    }

    const zeroY = toY(0);
    if (!isLog && minV < 0 && maxV > 0) {
        ctx.strokeStyle = '#4a5568'; ctx.setLineDash([5,5]);
        ctx.beginPath(); ctx.moveTo(p, zeroY); ctx.lineTo(w-p, zeroY); ctx.stroke();
        ctx.setLineDash([]);
    }

    const grad = ctx.createLinearGradient(0, p, 0, h-p);
    grad.addColorStop(0, 'rgba(0,217,255,0.3)'); grad.addColorStop(1, 'rgba(0,217,255,0)');
    ctx.beginPath();
    vals.forEach((v,i) => i ? ctx.lineTo(toX(i), toY(v)) : ctx.moveTo(toX(i), toY(v)));
    ctx.lineTo(toX(vals.length-1), h-p); ctx.lineTo(p, h-p); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    vals.forEach((v,i) => i ? ctx.lineTo(toX(i), toY(v)) : ctx.moveTo(toX(i), toY(v)));
    ctx.strokeStyle = '#00d9ff'; ctx.lineWidth = 2; ctx.stroke();

    const [lx, ly] = [toX(vals.length-1), toY(vals.at(-1))];
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI*2); ctx.fillStyle = '#00d9ff'; ctx.fill();
};

const draw = () => { drawChart(c1, x1, false); drawChart(c2, x2, true); };

const loop = now => {
    if (state.started && state.game) {
        state.game.tick(String((now - lastT) / 1000));
        const last = state.history.at(-1);
        if (!last || now - last.t > 30) {
            state.history.push({ 
                log10: state.game.totl_log10(), 
                neg: state.game.totl_negative(),
                t: now 
            });
            if (state.history.length > state.size) { state.history.shift(); state.harvestIdx = Math.max(0, state.harvestIdx-1); }
        }
        updateUI(); draw();
    }
    lastT = now;
    requestAnimationFrame(loop);
};

const setup = (cv, ctx) => { cv.width = cv.offsetWidth*2; cv.height = cv.offsetHeight*2; ctx.scale(2, 2); };

window.addEventListener('keydown', e => {
    if (!isReady()) return;
    if (e.code === 'Enter') {
        e.preventDefault();
        if (!state.started) {
            state.started = true;
            state.history.push({ log10: state.game.prin_log10(), neg: false, t: performance.now() });
            $('hint').textContent = '[Enter] Harvest | [Space] Replay';
        } else state.game.harv();
        state.harvestIdx = state.history.length;
    } else if (e.code === 'Space') { e.preventDefault(); replay(); }
    else if (e.code === 'ArrowUp') { e.preventDefault(); state.game.freq_up(); updateUI(); }
    else if (e.code === 'ArrowDown') { e.preventDefault(); state.game.freq_down(); updateUI(); }
    else if (e.code === 'ArrowLeft') {
        e.preventDefault(); state.game.reset_step();
        if (state.harvestIdx > 0) state.history.length = state.harvestIdx;
        updateUI(); draw();
    }
});

['rate','cost'].forEach(id => $(id).addEventListener('input', () => {
    state.game?.free();
    state.game = createGame($('rate').value || '1.0', $('cost').value || '1');
    state.game.set_freq($('freq').value || '1');
}));
$('freq').addEventListener('input', () => { state.game?.set_freq($('freq').value || '1'); updateUI(); });
$('size').addEventListener('input', () => { state.size = +$('size').value || 128; });
window.addEventListener('resize', () => { setup(c1, x1); setup(c2, x2); });
$('replay').addEventListener('click', replay);

setup(c1, x1); setup(c2, x2);
initWasm().then(() => { replay(); $('hint').textContent = 'Press [Enter] to start'; requestAnimationFrame(loop); })
    .catch(e => { $('hint').textContent = 'WASM load failed: ' + e.message; });
