#!/usr/bin/env node
// Сборка пакета книги для передачи читателю: папка + ZIP + одиночная версия.
//
//   node scripts/package-book.js --name моя-книга
//   node scripts/package-book.js --name моя-книга --book book --out dist
//
// Что получается:
//   dist/<имя>/index.html              — книга с папками _shared и assets
//   dist/<имя>/index-standalone.html   — всё в одном файле (стили, скрипты, картинки)
//   dist/<имя>/README.txt              — инструкция для получателя
//   dist/<имя>.zip                     — архив
//
// Одиночная версия нужна для отправки почтой и мессенджерами: браузеры не дают
// странице читать соседние файлы, поэтому всё встраивается в один HTML.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const argv = process.argv.slice(2);
const get = (name, fallback) => {
    const item = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (!item) return fallback;
    if (item.includes('=')) return item.slice(item.indexOf('=') + 1);
    const next = argv[argv.indexOf(item) + 1];
    return next && !next.startsWith('--') ? next : fallback;
};

const bookDir = path.resolve(get('book', 'book'));
const name = get('name', 'book');
const outRoot = path.resolve(get('out', 'dist'));
const outDir = path.join(outRoot, name);
const zipPath = outDir + '.zip';
const indexPath = path.join(bookDir, 'index.html');

if (!fs.existsSync(indexPath)) {
    console.error('Не найден ' + indexPath);
    process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// 1. Копия книги как есть.
fs.copyFileSync(indexPath, path.join(outDir, 'index.html'));
for (const dir of ['_shared', 'cover', 'assets']) {
    const src = path.join(bookDir, dir);
    if (fs.existsSync(src)) {
        fs.cpSync(src, path.join(outDir, dir), { recursive: true });
    }
}

// 2. Одиночная версия.
const MIME = {
    '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml'
};

function inlineFile(relPath) {
    const file = path.join(bookDir, relPath);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

let standalone = fs.readFileSync(indexPath, 'utf8');

for (const [tag, file] of [
    ['shell.css', '_shared/shell.css'],
    ['cover.css', 'cover/cover.css'],
    ['cover.js', 'cover/cover.js'],
    ['shell.js', '_shared/shell.js']
]) {
    const content = inlineFile(file);
    if (!content) continue;
    if (tag.endsWith('.css')) {
        standalone = standalone.replace(
            new RegExp(`<link[^>]*href="[^"]*${tag}"[^>]*>`),
            `<style>\n${content}\n</style>`
        );
    } else {
        standalone = standalone.replace(
            new RegExp(`<script[^>]*src="[^"]*${tag}"[^>]*></script>`),
            `<script>\n${content}\n</script>`
        );
    }
}

const imageRe = /assets\/[A-Za-z0-9/_.-]+\.(?:webp|png|jpe?g|gif|svg)/g;
const images = [...new Set(standalone.match(imageRe) || [])];
for (const rel of images) {
    const file = path.join(bookDir, rel);
    if (!fs.existsSync(file)) {
        console.warn('Нет файла изображения: ' + rel);
        continue;
    }
    const ext = path.extname(file).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const data = fs.readFileSync(file).toString('base64');
    standalone = standalone.split(rel).join(`data:${mime};base64,${data}`);
}

const standalonePath = path.join(outDir, 'index-standalone.html');
fs.writeFileSync(standalonePath, standalone, 'utf8');

// 3. README.
const titleMatch = standalone.match(/data-book-title="([^"]*)"/);
const title = titleMatch ? titleMatch[1] : name;
fs.writeFileSync(path.join(outDir, 'README.txt'),
`${title}
Интерактивная книга для просмотра в браузере

ВАЖНО: НЕ ОТКРЫВАЙТЕ index.html ПРЯМО ИЗ ОКНА ZIP-АРХИВА
Проводник Windows в этом случае извлекает только сам файл без папок,
и книга откроется без оформления.

КАК ОТКРЫТЬ — ВАРИАНТ 1 (рекомендуемый)
1. Щёлкните по архиву правой кнопкой -> "Извлечь все...".
2. Откройте распакованную папку.
3. Двойной щелчок по index.html.

КАК ОТКРЫТЬ — ВАРИАНТ 2 (если распаковать нельзя)
Откройте index-standalone.html — та же книга одним файлом,
все стили и изображения внутри. Работает прямо из архива и из почты.

НАВИГАЦИЯ
- Щёлкните по обложке — откроется содержание.
- Щёлкните по названию главы — раскроются параграфы.
- Слова, выделенные цветом и пунктиром, открывают дополнительные окна.
- Esc закрывает верхнее окно, затем главу, затем содержание.

СОСТАВ ПАПКИ
index.html             — книга с папками _shared, cover и assets
index-standalone.html  — та же книга одним файлом
_shared\\                — общие стили и скрипты
cover\\                 — обложка: стили и разметка
assets\\                — изображения
README.txt             — эта инструкция
`, 'utf8');

// 4. Архив.
if (process.platform === 'win32') {
    const ps = `Compress-Archive -Path '${path.join(outDir, '*')}' -DestinationPath '${zipPath}' -Force`;
    const res = spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
    if (res.status !== 0) console.warn('Не удалось создать ZIP через PowerShell.');
} else {
    const res = spawnSync('zip', ['-r', '-q', zipPath, '.'], { cwd: outDir, stdio: 'inherit' });
    if (res.status !== 0) console.warn('Не удалось создать ZIP через zip.');
}

// 5. Отчёт.
console.log('Пакет: ' + outDir);
for (const file of [path.join(outDir, 'index.html'), standalonePath, zipPath]) {
    if (!fs.existsSync(file)) continue;
    const data = fs.readFileSync(file);
    const hash = crypto.createHash('sha256').update(data).digest('hex').toUpperCase();
    console.log(`  ${path.basename(file).padEnd(24)} ${String(data.length).padStart(10)} Б  ${hash.slice(0, 16)}...`);
}
console.log('Изображений встроено: ' + images.length);
