#!/usr/bin/env node
// Скриншоты книги для README.
//
//   node scripts/make-screenshots.js
//   node scripts/make-screenshots.js --file Landing-book/index.html --out screenshots
//
// Снимает: обложку, содержание, раскрытую главу, окно с таблицей,
// окно со схемой, окно с фото. Размер окна — 1280×900.

const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome'
].filter(Boolean);

const chromePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!chromePath) {
    console.error('Chrome не найден. Задайте CHROME_PATH.');
    process.exit(1);
}

const argv = process.argv.slice(2);
const get = (name, fallback) => {
    const item = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (!item) return fallback;
    if (item.includes('=')) return item.slice(item.indexOf('=') + 1);
    return argv[argv.indexOf(item) + 1] || fallback;
};

const root = path.resolve(__dirname, '..');
const file = path.resolve(get('file', path.join(root, 'Landing-book', 'index.html')));
const outDir = path.resolve(get('out', path.join(root, 'screenshots')));
const PORT = Number(process.env.CDP_PORT || 9334);

fs.mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitDevtools(timeoutMs = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
        try {
            const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
            if (r.ok) return;
        } catch (e) { /* Chrome ещё стартует */ }
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
    const userDir = path.join(os.tmpdir(), 'shots-' + process.pid);
    const chrome = spawn(chromePath, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, 'about:blank'
    ], { stdio: 'ignore' });

    try {
        await waitDevtools();
        const created = await fetch(
            `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(pathToFileURL(file).href)}`,
            { method: 'PUT' }
        );
        const target = await created.json();
        const cdp = await CDP.connect(target.webSocketDebuggerUrl);
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
        await sleep(1200);

        const shot = async (name) => {
            const data = await cdp.send('Page.captureScreenshot', { format: 'png' });
            const out = path.join(outDir, name);
            fs.writeFileSync(out, Buffer.from(data.data, 'base64'));
            console.log('снимок: ' + path.relative(root, out));
        };

        // 1. Обложка и закрытое содержание.
        await shot('01-cover.png');

        // 2. Содержание: прокручиваем к списку глав, чтобы он попал в кадр целиком.
        await cdp.eval(`document.getElementById('bookCover').click()`);
        await sleep(500);
        await cdp.eval(`window.scrollTo(0, document.getElementById('mainTOC').getBoundingClientRect().top + window.scrollY - 40)`);
        await sleep(400);
        await shot('02-toc.png');

        // 3. Раскрытая глава.
        await cdp.eval(`document.querySelector('.chapter-header').click()`);
        await sleep(500);
        await shot('03-chapter-open.png');

        // 4. Окно с таблицей.
        await cdp.eval(`showModal('businessModal')`);
        await sleep(600);
        await shot('04-modal-table.png');
        await cdp.eval(`hideModal('businessModal')`);
        await sleep(300);

        // 5. Окно со схемой.
        await cdp.eval(`showModal('robotizationModal')`);
        await sleep(600);
        await cdp.eval(`const m = document.getElementById('robotizationModal'); m.scrollTop = 260;`);
        await sleep(500);
        await shot('05-modal-scheme.png');
        await cdp.eval(`hideModal('robotizationModal')`);
        await sleep(300);

        // 6. Окно с фотографиями.
        await cdp.eval(`showModal('whoWeAreModal')`);
        await sleep(700);
        await shot('06-modal-photo.png');
        await cdp.eval(`hideModal('whoWeAreModal')`);

        cdp.ws.close();
        await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
    } finally {
        chrome.kill();
        await sleep(300);
        try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) { /* профиль занят */ }
    }
})().catch((e) => { console.error('ОШИБКА: ' + e.message); process.exit(1); });
