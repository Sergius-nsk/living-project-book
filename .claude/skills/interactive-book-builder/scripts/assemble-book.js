#!/usr/bin/env node
// Сборка книги из файлов глав.
//
//   node scripts/assemble-book.js                — проверка без записи (dry run)
//   node scripts/assemble-book.js --write        — пересобрать index.html
//   node scripts/assemble-book.js --write --force — разрешить меньше глав, чем сейчас в книге
//   --book=<папка>   — папка книги (по умолчанию ./book)
//   --index=<путь>   — собрать в другой файл (для проверки на копии)
//
// Как ищутся главы: любой .html под папкой книги (кроме _shared, _archive, assets),
// содержащий маркеры <!-- CHAPTER-DATA:START --> ... <!-- CHAPTER-DATA:END -->.
// Имя файла и папки значения не имеют.
//
// Что заменяется в index.html:
//   1. Массив chaptersData -> главы, отсортированные по полю order.
//   2. Область <!-- CHAPTER-MODALS:START --> ... <!-- CHAPTER-MODALS:END --> -> окна всех глав.
//      Пути ../assets/ в окнах переписываются на assets/.
//
// Нумерация в книге всегда сквозная: 1, 2, 3, ... — считается по позиции.
// Чтобы вставить главу между существующими, дайте ей дробный order (3.5).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const argv = process.argv.slice(2);
const get = (name, fallback) => {
    const item = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (!item) return fallback;
    if (item.includes('=')) return item.slice(item.indexOf('=') + 1);
    const next = argv[argv.indexOf(item) + 1];
    return next && !next.startsWith('--') ? next : fallback;
};

const doWrite = argv.includes('--write');
const force = argv.includes('--force');
const bookDir = path.resolve(get('book', 'book'));
const indexPath = path.resolve(get('index', path.join(bookDir, 'index.html')));

const SKIP_DIRS = new Set(['_shared', '_archive', 'assets', 'node_modules', '.git']);
const DATA_RE = /<!-- CHAPTER-DATA:START -->([\s\S]*?)<!-- CHAPTER-DATA:END -->/;
const JSON_RE = /<script type="application\/json" id="chapter-data">([\s\S]*?)<\/script>/;
const MODALS_RE = /<!-- CHAPTER-MODALS:START -->([\s\S]*?)<!-- CHAPTER-MODALS:END -->/;

function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            walk(full, out);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
            if (entry.name === 'index.html' || entry.name === 'index-prev.html') continue;
            out.push(full);
        }
    }
    return out;
}

function readChapters() {
    const chapters = [];
    for (const file of walk(bookDir)) {
        const html = fs.readFileSync(file, 'utf8');
        if (!DATA_RE.test(html)) continue;
        const m = html.match(JSON_RE);
        if (!m) throw new Error(`Маркеры данных есть, JSON не найден: ${file}`);
        let data;
        try {
            data = JSON.parse(m[1]);
        } catch (e) {
            throw new Error(`Ошибка JSON в ${file}: ${e.message}`);
        }
        const rel = path.relative(process.cwd(), file);
        if (!Number.isFinite(Number(data.order))) throw new Error(`Не задано числовое "order": ${rel}`);
        if (!data.title) throw new Error(`Не задан "title": ${rel}`);
        const modalsMatch = html.match(MODALS_RE);
        const modals = modalsMatch ? modalsMatch[1].replace(/\.\.\/assets\//g, 'assets/').trim() : '';
        chapters.push({ order: Number(data.order), data, file: rel, modals });
    }
    chapters.sort((a, b) => a.order - b.order);
    return chapters;
}

function findArrayEnd(text, start) {
    let depth = 0, quote = null, lineComment = false, blockComment = false;
    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];
        if (lineComment) { if (ch === '\n') lineComment = false; continue; }
        if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
        if (quote) {
            if (ch === '\\') { i++; continue; }
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
        if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
        if (ch === '[' || ch === '{') depth++;
        else if (ch === ']' || ch === '}') {
            depth--;
            if (depth === 0) return i + 1;
        }
    }
    return -1;
}

function locateChaptersArray(html) {
    const marker = /chaptersData\s*=\s*/.exec(html);
    if (!marker) throw new Error('В index.html не найден chaptersData');
    const bracket = html.indexOf('[', marker.index + marker[0].length);
    const end = findArrayEnd(html, bracket);
    if (bracket === -1 || end === -1) throw new Error('Не удалось разобрать массив chaptersData');
    return { bracket, end };
}

function countCurrent(html) {
    const { bracket, end } = locateChaptersArray(html);
    const literal = html.slice(bracket, end);
    const arr = require('vm').runInNewContext('(' + literal + ')', {}, { timeout: 1000 });
    return arr.length;
}

function titleText(value) {
    return (value && typeof value === 'object') ? (value.text || '') : String(value || '');
}

function renderArray(chapters) {
    return JSON.stringify(chapters.map((ch) => ch.data), null, 4)
        .split('\n')
        .map((line, i) => (i === 0 ? line : '        ' + line))
        .join('\n');
}

function renderModals(chapters) {
    const parts = chapters
        .filter((ch) => ch.modals)
        .map((ch) => `        <!-- Глава ${ch.order}: ${titleText(ch.data.title)} -->\n${ch.modals}`);
    return parts.join('\n\n');
}

(function main() {
    const chapters = readChapters();
    const duplicates = chapters.filter((ch, i) => i > 0 && chapters[i - 1].order === ch.order);
    if (duplicates.length) {
        throw new Error('Повторяются значения order: ' + duplicates.map((d) => `${d.order} (${d.file})`).join(', '));
    }

    const modalIds = [];
    chapters.forEach((ch) => {
        for (const m of ch.modals.matchAll(/<div class="modal-overlay" id="([A-Za-z0-9_-]+)"/g)) {
            modalIds.push({ id: m[1], file: ch.file });
        }
    });
    const dupIds = modalIds.filter((m, i) => modalIds.findIndex((x) => x.id === m.id) !== i);
    if (dupIds.length) {
        throw new Error('Повторяются id модальных окон: ' +
            [...new Set(dupIds.map((d) => `${d.id} (${d.file})`))].join(', '));
    }

    const html = fs.readFileSync(indexPath, 'utf8');
    const currentCount = countCurrent(html);

    // Проверка ссылок: слово label обязано встречаться в тексте тезиса,
    // иначе ссылка молча не отрисуется.
    const missingLinks = [];
    chapters.forEach((ch) => {
        (ch.data.content || []).forEach((para) => {
            (para.theses || []).forEach((t) => {
                if (!t || typeof t !== 'object') return;
                const links = t.links || (t.link ? [t.link] : []);
                links.forEach((link) => {
                    const text = String(t.text || '');
                    if (link && link.label && text.indexOf(link.label) === -1) {
                        missingLinks.push({ chapter: ch.data.title, label: link.label, file: ch.file });
                    }
                });
            });
        });
    });

    console.log(`Найдено глав: ${chapters.length}; в книге сейчас: ${currentCount}`);
    chapters.forEach((ch, i) => {
        console.log(`  ${String(i + 1).padStart(2)}. order=${ch.order}  ${titleText(ch.data.title).slice(0, 60)}`);
        console.log(`      ${ch.file}${ch.modals ? '' : '  (без окон)'}`);
    });

    if (missingLinks.length) {
        console.warn('\nВнимание: ссылка не появится — слова нет в тексте тезиса:');
        missingLinks.forEach((m) => console.warn(`  «${m.label}» — ${m.file}`));
    }

    if (chapters.length < currentCount && !force) {
        console.error(`\nОстановлено: глав в файлах меньше, чем в книге. ` +
            `Пересборка убрала бы ${currentCount - chapters.length} глав(ы). ` +
            `Добавьте файлы остальных глав или запустите с --force.`);
        process.exitCode = 1;
        return;
    }

    const { bracket, end } = locateChaptersArray(html);
    let updated = html.slice(0, bracket) + renderArray(chapters) + html.slice(end);

    const hasMarkers = /<!-- CHAPTER-MODALS:START -->[\s\S]*?<!-- CHAPTER-MODALS:END -->/.test(updated);
    if (hasMarkers) {
        updated = updated.replace(
            /<!-- CHAPTER-MODALS:START -->[\s\S]*?<!-- CHAPTER-MODALS:END -->/,
            '<!-- CHAPTER-MODALS:START -->\n' + renderModals(chapters) + '\n        <!-- CHAPTER-MODALS:END -->'
        );
    } else {
        console.warn('\nВнимание: в index.html нет маркеров CHAPTER-MODALS — окна не обновлены.');
    }

    if (!doWrite) {
        console.log('\nПроверка пройдена. Запись не выполнялась (добавьте --write).');
        return;
    }

    fs.writeFileSync(indexPath, updated, 'utf8');
    const hash = crypto.createHash('sha256').update(updated, 'utf8').digest('hex').toUpperCase();
    console.log('\nЗаписано: ' + path.relative(process.cwd(), indexPath));
    console.log('Глав в книге: ' + chapters.length);
    console.log('Окон в книге: ' + modalIds.length);
    console.log('SHA-256: ' + hash);
})();
