#!/usr/bin/env node
// Проверка книги в настоящем браузере через Chrome DevTools Protocol.
//
//   node scripts/probe-browser.js --file book/index.html
//   node scripts/probe-browser.js --file book/chapter-01/glava.html
//   CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" node scripts/probe-browser.js --file ...
//
// Что делает: открывает обложку, раскрывает каждую главу, нажимает каждую ссылку-окно,
// проверяет, что окно открылось, и закрывает его Esc. Зависимостей нет.
//
// Выход: JSON с числом глав, параграфов, ссылок и списком ссылок без окна (modal: null).

const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.CDP_PORT || 9333);
const argv = process.argv.slice(2);
const get = (name, fallback) => {
    const item = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (!item) return fallback;
    if (item.includes('=')) return item.slice(item.indexOf('=') + 1);
    return argv[argv.indexOf(item) + 1] || fallback;
};

const file = get('file', '');
const isUrl = /^https?:\/\//i.test(file);
if (!file || (!isUrl && !fs.existsSync(file))) {
    console.error('Укажите существующий файл или адрес: --file book/index.html');
    process.exit(1);
}

const CANDIDATES = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
].filter(Boolean);

const chromePath = CANDIDATES.find((p) => fs.existsSync(p));
if (!chromePath) {
    console.error('Chrome не найден. Задайте CHROME_PATH.');
    process.exit(1);
}

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
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + ((r.exceptionDetails.exception || {}).description || ''));
        return r.result.value;
    }
}

const PROBE = `(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const out = { chapters: [], broken: [] };

  // Ждём загрузку страницы и построение содержания: по сети это дольше, чем локально.
  for (let i = 0; i < 60; i++) {
    if (document.readyState === 'complete' && document.querySelector('.chapter-header')) break;
    await wait(250);
  }

  const cover = document.getElementById('bookCover');
  if (cover) cover.click();
  await wait(250);

  const press = async (link) => {
    link.click();
    await wait(250);
    const open = document.querySelector('.modal-overlay.is-open');
    const entry = {
      label: link.innerText,
      modal: open ? open.id : null,
      images: open ? [...open.querySelectorAll('img')].map(i => i.naturalWidth) : []
    };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wait(150);
    entry.closed = !document.querySelector('.modal-overlay.is-open');
    return entry;
  };

  const headers = [...document.querySelectorAll('.chapter-header')];
  for (const header of headers) {
    const title = header.querySelector('.chapter-title').innerText;
    const chapter = { title, paragraphs: 0, links: [] };

    // Ссылки в заголовке (если заголовок — объект со ссылками).
    for (const link of [...header.querySelectorAll('.interactive-link')]) {
      const entry = await press(link);
      chapter.links.push(entry);
      if (!entry.modal || !entry.closed) out.broken.push({ chapter: title, where: 'title', ...entry });
    }

    header.click();
    await wait(200);
    const content = header.parentElement.querySelector('.chapter-content');
    chapter.paragraphs = content ? content.querySelectorAll('.paragraph').length : 0;
    const links = content ? [...content.querySelectorAll('.interactive-link')] : [];

    for (const link of links) {
      const entry = await press(link);
      chapter.links.push(entry);
      if (!entry.modal || !entry.closed) out.broken.push({ chapter: title, where: 'content', ...entry });
    }
    out.chapters.push(chapter);
  }
  return out;
})()`;

(async () => {
    const userDir = path.join(os.tmpdir(), 'book-probe-' + process.pid);
    const chrome = spawn(chromePath, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, 'about:blank'
    ], { stdio: 'ignore' });

    try {
        await waitDevtools();
        const url = isUrl ? file : pathToFileURL(path.resolve(file)).href;
        const created = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
        const target = await created.json();
        const cdp = await CDP.connect(target.webSocketDebuggerUrl);
        await sleep(900);
        const result = await cdp.eval(PROBE);
        console.log(JSON.stringify(result, null, 2));
        cdp.ws.close();
        await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
        if (result.broken.length) process.exitCode = 2;
    } finally {
        chrome.kill();
        await sleep(300);
        try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) { /* профиль мог остаться */ }
    }
})().catch((e) => {
    console.error('ОШИБКА: ' + e.message);
    process.exit(1);
});
