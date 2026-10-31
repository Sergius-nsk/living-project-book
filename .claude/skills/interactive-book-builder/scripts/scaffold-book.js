#!/usr/bin/env node
// Создаёт каркас книги: папку book, общий каркас _shared, главы и скрипты.
//
//   node scaffold-book.js --dir "C:\Projects\MyProject" --title "Название книги" --subtitle "Подзаголовок"
//   node scaffold-book.js --dir . --title "..." --chapters 3
//
// По умолчанию создаётся одна глава. Имена папок глав: chapter-01, chapter-02, ...

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const get = (name, fallback) => {
    const item = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (!item) return fallback;
    if (item.includes('=')) return item.slice(item.indexOf('=') + 1);
    const next = args[args.indexOf(item) + 1];
    return next && !next.startsWith('--') ? next : fallback;
};

const targetDir = path.resolve(get('dir', '.'));
const title = get('title', 'Название книги');
const subtitle = get('subtitle', '');
const chapterCount = Number(get('chapters', 1));

if (!Number.isInteger(chapterCount) || chapterCount < 1) {
    console.error('--chapters должен быть целым числом >= 1');
    process.exit(1);
}

const templates = path.join(__dirname, '..', 'assets', 'templates');
const bookDir = path.join(targetDir, 'book');
const sharedDir = path.join(bookDir, '_shared');
const scriptsDir = path.join(targetDir, 'scripts');

for (const dir of [bookDir, sharedDir, scriptsDir]) {
    fs.mkdirSync(dir, { recursive: true });
}

// Общий каркас.
for (const file of ['shell.css', 'shell.js']) {
    fs.copyFileSync(path.join(templates, file), path.join(sharedDir, file));
}

// Обложка — отдельная папка: её правят независимо от каркаса.
const coverDir = path.join(bookDir, 'cover');
fs.mkdirSync(coverDir, { recursive: true });
for (const file of ['cover.css', 'cover.js']) {
    fs.copyFileSync(path.join(templates, 'cover', file), path.join(coverDir, file));
}

// Страница книги.
const indexTemplate = fs.readFileSync(path.join(templates, 'index.html'), 'utf8');
fs.writeFileSync(
    path.join(bookDir, 'index.html'),
    indexTemplate.replace(/BOOK_TITLE/g, title).replace(/BOOK_SUBTITLE/g, subtitle),
    'utf8'
);

// Главы.
const chapterTemplate = fs.readFileSync(path.join(templates, 'chapter.html'), 'utf8');
for (let n = 1; n <= chapterCount; n++) {
    const number = String(n).padStart(2, '0');
    const dir = path.join(bookDir, `chapter-${number}`);
    fs.mkdirSync(dir, { recursive: true });

    let page = chapterTemplate
        .replace(/BOOK_TITLE/g, title)
        .replace(/BOOK_SUBTITLE/g, subtitle)
        .replace(/Глава 1/g, `Глава ${n}`)
        .replace(/"order": 1,/, `"order": ${n},`)
        .replace(/"title": "Название главы одной фразой"/, `"title": "Глава ${n}: черновик"`);

    if (n > 1) {
        // Второй и следующие главы не должны ссылаться на окно exampleModal первой.
        page = page.replace(/\s*<!-- Окна главы[\s\S]*?<!-- CHAPTER-MODALS:END -->/, '\n        <!-- CHAPTER-MODALS:START -->\n        <!-- CHAPTER-MODALS:END -->');
        page = page.replace(/,\n            \{\n              "text": "Тезис со ссылкой[\s\S]*?\n            \}/, '');
    }

    fs.writeFileSync(path.join(dir, 'glava.html'), page, 'utf8');
    fs.writeFileSync(
        path.join(dir, 'content.md'),
        `# Глава ${n}\n\n## Статус: черновик\n\n` +
        `Рабочий файл — \`glava.html\`. Текст правится в JSON-блоке \`chapter-data\`;\n` +
        `окна — между маркерами \`CHAPTER-MODALS\`. \`order\` = ${n}.\n\n` +
        `## Параграфы\n\n- (заполнить)\n`,
        'utf8'
    );
}

// Скрипты сборки и упаковки.
for (const file of ['assemble-book.js', 'package-book.js', 'probe-browser.js']) {
    fs.copyFileSync(path.join(__dirname, file), path.join(scriptsDir, file));
}

console.log('Готово.');
console.log('  книга:   ' + path.relative(process.cwd(), path.join(bookDir, 'index.html')));
console.log('  каркас:  ' + path.relative(process.cwd(), sharedDir));
console.log('  обложка: ' + path.relative(process.cwd(), coverDir));
console.log('  главы:   ' + chapterCount + ' в ' + path.relative(process.cwd(), bookDir));
console.log('  скрипты: ' + path.relative(process.cwd(), scriptsDir));
console.log('\nДальше:');
console.log('  node scripts/assemble-book.js --write --force');
console.log('  node scripts/package-book.js --name моя-книга');
