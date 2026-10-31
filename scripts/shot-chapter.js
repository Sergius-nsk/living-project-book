// Снимки страницы главы: содержание с раскрытой главой и открытое окно.
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitDevtools(timeoutMs = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
        try {
            const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
            if (r.ok) return await r.json();
        } catch (e) { /* старт */ }
        await sleep(200);
    }
    throw new Error('DevTools не поднялся');
}

class CDP {
    constructor(ws) {
        this.ws = ws; this.id = 0; this.pending = new Map();
        ws.addEventListener('message', (ev) => {
            const m = JSON.parse(ev.data);
            if (m.id && this.pending.has(m.id)) {
                const { res, rej } = this.pending.get(m.id);
                this.pending.delete(m.id);
                m.error ? rej(new Error(m.error.message)) : res(m.result);
            }
        });
    }
    static connect(url) {
        return new Promise((res, rej) => {
            const ws = new WebSocket(url);
            ws.addEventListener('open', () => res(new CDP(ws)));
            ws.addEventListener('error', () => rej(new Error('Ошибка WebSocket')));
        });
    }
    send(method, params = {}) {
        const id = ++this.id;
        return new Promise((res, rej) => {
            this.pending.set(id, { res, rej });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }
    async eval(expression) {
        const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
        return r.result.value;
    }
}

(async () => {
    const [file, outDir] = process.argv.slice(2);
    const prefix = path.basename(path.dirname(path.resolve(file)));
    const userDir = path.join(__dirname, 'chrome-profile');
    const chrome = spawn(CHROME, [
        '--headless=new', '--disable-gpu', '--window-size=1280,900',
        '--no-first-run', '--no-default-browser-check',
        `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, 'about:blank'
    ], { stdio: 'ignore' });

    try {
        await waitDevtools();
        const url = pathToFileURL(path.resolve(file)).href;
        const created = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
        const target = await created.json();
        const cdp = await CDP.connect(target.webSocketDebuggerUrl);
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
        await sleep(1000);

        await cdp.eval(`document.getElementById('bookCover').click(); document.querySelector('.chapter-header').click();`);
        await sleep(500);
        let shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(outDir, `${prefix}-toc.png`), Buffer.from(shot.data, 'base64'));

        const modalIds = await cdp.eval(`[...document.querySelectorAll('.interactive-link')].map((a, i) => i)`);
        for (const index of modalIds) {
            await cdp.eval(`document.querySelectorAll('.interactive-link')[${index}].click()`);
            await sleep(500);
            shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
            const open = await cdp.eval(`(document.querySelector('.modal-overlay.is-open') || {}).id || 'none'`);
            fs.writeFileSync(path.join(outDir, `${prefix}-modal-${index + 1}-${open}.png`), Buffer.from(shot.data, 'base64'));
            await cdp.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
            await sleep(250);
        }

        console.log('Снимки записаны в ' + outDir);
        cdp.ws.close();
        await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
    } finally {
        chrome.kill();
    }
})().catch((e) => { console.error('ОШИБКА: ' + e.message); process.exit(1); });
