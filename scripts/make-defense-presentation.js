#!/usr/bin/env node
// Собирает презентацию к защите: один HTML-файл со встроенными скриншотами.
//
//   node scripts/make-defense-presentation.js
//
// Вход: screenshots/01-cover.png … 05-modal-scheme.png
// Выход: landing/Презентации/defense-living-project-book.html
//
// Управление: стрелки, пробел, PageUp/PageDown, Home/End. F — полный экран.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const shotsDir = path.join(root, 'screenshots');
const outDir = path.join(root, 'landing', 'Презентации');
const outPath = path.join(outDir, 'defense-living-project-book.html');

const IMAGES = ['01-cover.png', '02-toc.png', '04-modal-table.png', '05-modal-scheme.png'];

function dataUri(name) {
    const file = path.join(shotsDir, name);
    if (!fs.existsSync(file)) throw new Error('Нет скриншота: ' + file);
    return 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
}

const REPO = 'github.com/Sergius-nsk/living-project-book';
const SITE = 'sergius-nsk.github.io/living-project-book';

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Живая книга проекта — защита</title>
<style>
    :root {
        --bg: #050506;
        --surface: #0b0c0d;
        --surface-2: #101214;
        --accent: #a3ff47;
        --accent-dim: rgba(163, 255, 71, 0.14);
        --text: #e8e8e8;
        --dim: #9aa0a6;
        --line: rgba(255, 255, 255, 0.12);
    }

    * { box-sizing: border-box; }

    html, body {
        margin: 0;
        height: 100%;
        background: var(--bg);
        color: var(--text);
        font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
        overflow: hidden;
    }

    .deck {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .stage {
        position: relative;
        width: min(100vw, calc(100vh * 16 / 9));
        height: min(100vh, calc(100vw * 9 / 16));
        background: var(--bg);
        container-type: size;
        overflow: hidden;
        box-shadow: 0 40px 120px rgba(0, 0, 0, 0.8);
    }

    .stage::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
        background-size: 5cqw 5cqw;
        pointer-events: none;
    }

    .slide {
        position: absolute;
        inset: 0;
        display: none;
        flex-direction: column;
        padding: 5cqw 6cqw 4.4cqw;
    }

    .slide.active { display: flex; }

    .label {
        font-family: 'Consolas', 'JetBrains Mono', monospace;
        font-size: 1.15cqw;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: var(--accent);
        display: flex;
        align-items: center;
        gap: 1.2cqw;
    }

    .label::before {
        content: '';
        width: 2.6cqw;
        height: 1px;
        background: var(--accent);
    }

    h1 {
        margin: 2.2cqw 0 1.6cqw;
        font-size: 6.6cqw;
        line-height: 1.02;
        letter-spacing: -0.02em;
        text-transform: uppercase;
        font-weight: 800;
        max-width: 78cqw;
    }

    h2 {
        margin: 1.8cqw 0 2.2cqw;
        font-size: 3.6cqw;
        line-height: 1.12;
        letter-spacing: -0.01em;
        font-weight: 700;
        max-width: 80cqw;
    }

    .accent { color: var(--accent); }
    .dim { color: var(--dim); }

    .lead {
        font-size: 2.05cqw;
        line-height: 1.45;
        color: var(--dim);
        max-width: 72cqw;
    }

    .footer {
        margin-top: auto;
        border-top: 1px solid var(--line);
        padding-top: 1.6cqw;
        font-size: 1.55cqw;
        color: var(--dim);
        display: flex;
        justify-content: space-between;
        gap: 2cqw;
    }

    /* Титул */
    .title-slide { justify-content: center; }
    .title-slide h1 { font-size: 7.6cqw; max-width: 86cqw; }
    .title-sub {
        font-size: 2.3cqw;
        line-height: 1.4;
        color: var(--dim);
        max-width: 64cqw;
        margin-top: 0.4cqw;
    }
    .title-meta {
        margin-top: 4cqw;
        display: flex;
        gap: 3cqw;
        align-items: flex-end;
        flex-wrap: wrap;
    }
    .title-meta .who { font-size: 1.8cqw; line-height: 1.5; }
    .title-meta .who strong { color: var(--text); font-weight: 600; }
    .title-links {
        display: flex;
        flex-direction: column;
        gap: 0.6cqw;
        font-family: 'Consolas', monospace;
        font-size: 1.35cqw;
        color: var(--accent);
    }

    /* Три колонки */
    .cards {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 2.2cqw;
        flex: 1;
        align-content: center;
    }

    .card {
        border: 1px solid var(--line);
        border-radius: 1.2cqw;
        padding: 2.2cqw;
        background: linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0));
        display: flex;
        flex-direction: column;
        gap: 1cqw;
    }

    .card .num {
        font-family: 'Consolas', monospace;
        font-size: 1.2cqw;
        color: var(--accent);
        letter-spacing: 0.18em;
    }

    .card h3 {
        margin: 0;
        font-size: 2.05cqw;
        line-height: 1.2;
        font-weight: 650;
    }

    .card p {
        margin: 0;
        font-size: 1.55cqw;
        line-height: 1.45;
        color: var(--dim);
    }

    /* Решение */
    .statement {
        font-size: 3.1cqw;
        line-height: 1.28;
        max-width: 80cqw;
        margin: 0.6cqw 0 2.6cqw;
    }

    .principles { display: flex; flex-direction: column; gap: 1.5cqw; }
    .principle {
        display: grid;
        grid-template-columns: 0.9cqw 1fr;
        gap: 1.6cqw;
        align-items: start;
        font-size: 1.85cqw;
        line-height: 1.4;
    }
    .principle::before {
        content: '';
        width: 0.9cqw;
        height: 0.9cqw;
        margin-top: 0.75cqw;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 1.2cqw rgba(163,255,71,0.5);
    }
    .principle span.t { color: var(--dim); }

    /* Схема структуры */
    .arch {
        display: grid;
        grid-template-columns: 1.5fr 1fr 1fr;
        gap: 2cqw;
        align-items: stretch;
        flex: 1;
        margin-top: 0.6cqw;
    }
    .arch-col {
        border: 1px solid var(--line);
        border-radius: 1.2cqw;
        padding: 1.8cqw;
        background: var(--surface);
        display: flex;
        flex-direction: column;
        gap: 1cqw;
    }
    .arch-col .head {
        font-family: 'Consolas', monospace;
        font-size: 1.25cqw;
        color: var(--accent);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin-bottom: 0.4cqw;
    }
    .arch-row {
        font-size: 1.45cqw;
        line-height: 1.35;
        color: var(--text);
        display: flex;
        gap: 0.8cqw;
    }
    .arch-row .k { color: var(--dim); min-width: 8.4cqw; }
    .arch-note {
        margin-top: 1.8cqw;
        font-size: 1.55cqw;
        color: var(--dim);
        border-left: 2px solid var(--accent);
        padding-left: 1.2cqw;
    }

    /* Демонстрация */
    .shots {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        gap: 1.6cqw;
        flex: 1;
        min-height: 0;
    }
    .shot {
        position: relative;
        border: 1px solid var(--line);
        border-radius: 1cqw;
        overflow: hidden;
        background: var(--surface);
    }
    .shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .shot.cover img { object-position: center 62%; }
    .shot.toc img { object-position: center top; }
    .shot.table img { object-position: center top; }
    .shot.scheme img { object-position: center top; }
    .shot .cap {
        position: absolute;
        left: 0; right: 0; bottom: 0;
        padding: 0.8cqw 1.1cqw;
        font-size: 1.2cqw;
        color: var(--text);
        background: linear-gradient(0deg, rgba(5,5,6,0.9), rgba(5,5,6,0));
    }

    /* Результаты */
    .stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 2cqw;
        margin: 0.6cqw 0 2.4cqw;
    }
    .stat {
        border-top: 2px solid var(--accent);
        padding-top: 1.2cqw;
    }
    .stat .v { font-size: 4.6cqw; font-weight: 800; line-height: 1; }
    .stat .k { margin-top: 0.7cqw; font-size: 1.45cqw; color: var(--dim); }

    .result-line {
        margin: 1.2cqw 0 1.8cqw;
        font-size: 2cqw;
        line-height: 1.4;
        color: var(--dim);
        max-width: 74cqw;
    }

    .formats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1.4cqw;
        flex: 1;
        align-content: end;
    }
    .format {
        border: 1px solid var(--line);
        border-radius: 1cqw;
        padding: 1.4cqw;
        font-size: 1.4cqw;
        line-height: 1.35;
        background: var(--surface);
    }
    .format strong { display: block; color: var(--accent); margin-bottom: 0.4cqw; font-size: 1.5cqw; }

    /* Ссылки */
    .links {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2cqw;
        margin: 0.6cqw 0 2.4cqw;
    }
    .link-card {
        border: 1px solid var(--line);
        border-radius: 1.2cqw;
        padding: 2cqw;
        background: var(--surface);
    }
    .link-card .k {
        font-family: 'Consolas', monospace;
        font-size: 1.2cqw;
        color: var(--dim);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin-bottom: 0.8cqw;
    }
    .link-card .v {
        font-family: 'Consolas', monospace;
        font-size: 1.6cqw;
        line-height: 1.45;
        color: var(--accent);
    }
    .checks { display: flex; flex-direction: column; gap: 1.1cqw; }
    .check { font-size: 1.65cqw; line-height: 1.4; color: var(--dim); display: flex; gap: 1cqw; }
    .check::before { content: '✓'; color: var(--accent); }

    /* Планы */
    .plans { display: flex; flex-direction: column; gap: 2cqw; flex: 1; justify-content: center; }
    .plan {
        display: grid;
        grid-template-columns: 5cqw 1fr;
        gap: 1.6cqw;
        align-items: start;
        border-bottom: 1px solid var(--line);
        padding-bottom: 1.6cqw;
    }
    .plan:last-child { border-bottom: 0; }
    .plan .n {
        font-family: 'Consolas', monospace;
        font-size: 3.4cqw;
        color: var(--accent-dim);
        font-weight: 700;
        line-height: 1;
    }
    .plan h3 { margin: 0 0 0.5cqw; font-size: 2.2cqw; font-weight: 650; }
    .plan p { margin: 0; font-size: 1.6cqw; color: var(--dim); line-height: 1.4; }

    /* Финал */
    .final-slide { justify-content: center; align-items: flex-start; }
    .final-slide h1 { font-size: 8cqw; margin-bottom: 1.4cqw; }
    .final-links {
        margin-top: 3cqw;
        display: flex;
        gap: 3cqw;
        font-family: 'Consolas', monospace;
        font-size: 1.5cqw;
        color: var(--accent);
        flex-wrap: wrap;
    }
    .final-contacts { margin-top: 1.4cqw; font-size: 1.5cqw; color: var(--dim); }

    /* Интерфейс */
    .hud {
        position: absolute;
        right: 2.2cqw;
        bottom: 1.4cqw;
        display: flex;
        align-items: center;
        gap: 1.2cqw;
        font-family: 'Consolas', monospace;
        font-size: 1.1cqw;
        color: var(--dim);
        z-index: 10;
    }
    .hud button {
        background: none;
        border: 1px solid var(--line);
        color: var(--text);
        width: 2.4cqw;
        height: 2.4cqw;
        border-radius: 50%;
        cursor: pointer;
        font-size: 1.1cqw;
        line-height: 1;
    }
    .hud button:hover { border-color: var(--accent); color: var(--accent); }
    .progress {
        position: absolute;
        left: 0; right: 0; top: 0;
        height: 2px;
        background: rgba(255,255,255,0.06);
        z-index: 10;
    }
    .progress i {
        display: block;
        height: 100%;
        width: 0;
        background: var(--accent);
        transition: width 0.25s ease;
    }

    @page { size: 338.7mm 190.5mm; margin: 0; }

    @media print {
        .hud, .progress { display: none; }
        html, body { overflow: visible; background: var(--bg); }
        .deck { position: static; display: block; }
        .stage { width: 100%; height: auto; box-shadow: none; }
        .slide {
            position: relative;
            display: flex !important;
            page-break-after: always;
            height: 100vh;
            break-after: page;
        }
        .slide:last-of-type { page-break-after: auto; break-after: auto; }
    }
</style>
</head>
<body>

<div class="deck">
    <div class="stage" id="stage">
        <div class="progress"><i id="progress"></i></div>

        <!-- 1. Титул -->
        <section class="slide title-slide active">
            <div class="label">Итоговый проект · Zerocoder</div>
            <h1>Живая книга<br><span class="accent">проекта</span></h1>
            <div class="title-sub">Интерактивная энциклопедия, которая собирается из глав
                и растёт вместе с проектом.</div>
            <div class="title-meta">
                <div class="who">
                    <strong>Сергей Вильчек</strong><br>
                    инженер, к.т.н., инноватор
                </div>
                <div class="title-links">
                    <span>${REPO}</span>
                    <span>${SITE}</span>
                </div>
            </div>
        </section>

        <!-- 2. Проблема -->
        <section class="slide">
            <div class="label">Проблема</div>
            <h2>Проекты живые.<br>Документы — нет.</h2>
            <div class="cards">
                <div class="card">
                    <div class="num">01</div>
                    <h3>Материалы распылены</h3>
                    <p>Исследования в PDF, расчёты в таблицах, презентации и переписка — отдельно.</p>
                </div>
                <div class="card">
                    <div class="num">02</div>
                    <h3>Проекты меняются</h3>
                    <p>Направление, состав и акценты обновляются быстрее, чем документы.</p>
                </div>
                <div class="card">
                    <div class="num">03</div>
                    <h3>Каждая презентация — с нуля</h3>
                    <p>Новая аудитория, формат и тайминг — значит, новая сборка материалов.</p>
                </div>
            </div>
            <div class="footer">
                <span>Нужен единый источник знаний, который обновляется вместе с проектом.</span>
            </div>
        </section>

        <!-- 3. Решение -->
        <section class="slide">
            <div class="label">Решение</div>
            <h2>Энциклопедия проекта,<br>а не отдельный документ</h2>
            <div class="statement">Одна книга. Тринадцать глав.
                <span class="accent">Обновляется вместе с проектом.</span></div>
            <div class="principles">
                <div class="principle"><span>Главы независимы: правлю одну — остальные не трогаю.</span></div>
                <div class="principle"><span>Переиздание одной командой: книга собирается заново из глав.</span></div>
                <div class="principle"><span class="t">Из книги ИИ-агент соберёт презентацию, доклад
                    и короткое резюме под конкретную аудиторию.</span></div>
            </div>
            <div class="footer">
                <span>Первый экземпляр — проект переработки пищевых отходов с помощью чёрной львинки.</span>
            </div>
        </section>

        <!-- 4. Как устроено -->
        <section class="slide">
            <div class="label">Как устроено</div>
            <h2>Книга собирается, а не пишется</h2>
            <div class="arch">
                <div class="arch-col">
                    <div class="head">book/</div>
                    <div class="arch-row"><span class="k">index.html</span><span>книга, собирается</span></div>
                    <div class="arch-row"><span class="k">_shared/</span><span>общий каркас</span></div>
                    <div class="arch-row"><span class="k">cover/</span><span>обложка</span></div>
                    <div class="arch-row"><span class="k">chapter-01…13/</span><span>главы</span></div>
                    <div class="arch-row"><span class="k">assets/</span><span>изображения</span></div>
                </div>
                <div class="arch-col">
                    <div class="head">scripts/</div>
                    <div class="arch-row"><span class="k">assemble</span><span>сборка книги</span></div>
                    <div class="arch-row"><span class="k">package</span><span>пакет для отправки</span></div>
                    <div class="arch-row"><span class="k">probe</span><span>проверка в браузере</span></div>
                </div>
                <div class="arch-col">
                    <div class="head">.claude/skills/</div>
                    <div class="arch-row"><span class="k">builder</span><span>скилл: собрать такую же книгу для другого проекта</span></div>
                </div>
            </div>
            <div class="arch-note">Одна глава — один файл. Новая глава вставляется между
                существующими без перенумерации: порядок задаёт поле order.</div>
            <div class="footer"><span>HTML, CSS, JavaScript, Node.js — без внешних зависимостей.</span></div>
        </section>

        <!-- 5. Демонстрация -->
        <section class="slide">
            <div class="label">Демонстрация</div>
            <h2>Книга в работе</h2>
            <div class="shots">
                <div class="shot cover"><img src="{{IMG:01-cover.png}}" alt="Обложка"><div class="cap">Обложка книги</div></div>
                <div class="shot toc"><img src="{{IMG:02-toc.png}}" alt="Содержание"><div class="cap">Тринадцать глав</div></div>
                <div class="shot table"><img src="{{IMG:04-modal-table.png}}" alt="Окно с таблицей"><div class="cap">Окна: таблицы сравнения</div></div>
                <div class="shot scheme"><img src="{{IMG:05-modal-scheme.png}}" alt="Схема"><div class="cap">Схемы на весь экран</div></div>
            </div>
            <div class="footer"><span>Ссылки в тексте открывают окна со схемами, таблицами, расчётами и фотографиями.</span></div>
        </section>

        <!-- 6. Результаты -->
        <section class="slide">
            <div class="label">Результат</div>
            <h2>Что получилось</h2>
            <div class="stats">
                <div class="stat"><div class="v">13</div><div class="k">глав в первой книге</div></div>
                <div class="stat"><div class="v">38</div><div class="k">окон со схемами и таблицами</div></div>
                <div class="stat"><div class="v">0</div><div class="k">битых ссылок при проверке</div></div>
            </div>
            <div class="result-line">Тринадцать глав — от проблемы отходов до запроса к инвестору.
                Книга собирается заново после каждой правки, поэтому всегда соответствует проекту.</div>
            <div class="formats">
                <div class="format"><strong>Книга в браузере</strong>открывается двойным щелчком</div>
                <div class="format"><strong>Один HTML-файл</strong>для почты и мессенджеров</div>
                <div class="format"><strong>ZIP-архив</strong>для отправки партнёрам</div>
                <div class="format"><strong>Скилл</strong>чтобы собрать такую же книгу для другого проекта</div>
            </div>
            <div class="footer"><span>Сборка, упаковка и проверка — тремя командами.</span></div>
        </section>

        <!-- 7. GitHub -->
        <section class="slide">
            <div class="label">Открытый код</div>
            <h2>Всё опубликовано</h2>
            <div class="links">
                <div class="link-card">
                    <div class="k">Репозиторий</div>
                    <div class="v">github.com/Sergius-nsk/<br>living-project-book</div>
                </div>
                <div class="link-card">
                    <div class="k">Живая книга</div>
                    <div class="v">sergius-nsk.github.io/<br>living-project-book</div>
                </div>
            </div>
            <div class="checks">
                <div class="check">README с описанием, скриншотами и инструкцией запуска</div>
                <div class="check">Исходники глав, обложки и каркаса</div>
                <div class="check">Автоматическая сборка и проверка при каждом изменении</div>
                <div class="check">Скилл interactive-book-builder для повторения на других проектах</div>
            </div>
            <div class="footer"><span>Проект можно открыть, понять, запустить и показать.</span></div>
        </section>

        <!-- 8. Планы -->
        <section class="slide">
            <div class="label">Планы</div>
            <h2>Что дальше</h2>
            <div class="plans">
                <div class="plan">
                    <div class="n">01</div>
                    <div>
                        <h3>Извлечение материалов</h3>
                        <p>ИИ-агент собирает из книги презентацию на десять слайдов, доклад на пять минут
                            или короткое резюме для партнёра.</p>
                    </div>
                </div>
                <div class="plan">
                    <div class="n">02</div>
                    <div>
                        <h3>Шаблоны книг</h3>
                        <p>Разные структуры под разные типы проектов: оборудование, биотехнологии,
                            услуги, исследования.</p>
                    </div>
                </div>
                <div class="plan">
                    <div class="n">03</div>
                    <div>
                        <h3>Тиражирование</h3>
                        <p>Книги для остальных проектов и передача подхода другим инноваторам.</p>
                    </div>
                </div>
            </div>
            <div class="footer"><span>Книга не заканчивается — она переиздаётся.</span></div>
        </section>

        <!-- 9. Финал -->
        <section class="slide final-slide">
            <div class="label">Спасибо</div>
            <h1>Живая книга<br><span class="accent">проекта</span></h1>
            <div class="lead">Открывается в браузере. Собирается одной командой.<br>
                Растёт вместе с проектом.</div>
            <div class="final-links">
                <span>${REPO}</span>
                <span>${SITE}</span>
            </div>
            <div class="final-contacts">Сергей Вильчек · +7 996 545-76-81 · Sv195503@yandex.ru</div>
        </section>

        <div class="hud">
            <button id="prev" aria-label="Назад">←</button>
            <span id="counter">1 / 9</span>
            <button id="next" aria-label="Вперёд">→</button>
        </div>
    </div>
</div>

<script>
    (function () {
        const slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
        const counter = document.getElementById('counter');
        const progress = document.getElementById('progress');
        let current = 0;

        function show(index) {
            if (index < 0) index = 0;
            if (index > slides.length - 1) index = slides.length - 1;
            current = index;
            slides.forEach(function (slide, i) {
                slide.classList.toggle('active', i === current);
            });
            counter.textContent = (current + 1) + ' / ' + slides.length;
            progress.style.width = ((current + 1) / slides.length * 100) + '%';
            if (location.hash !== '#' + (current + 1)) {
                history.replaceState(null, '', '#' + (current + 1));
            }
        }

        document.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
                event.preventDefault();
                show(current + 1);
            } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
                event.preventDefault();
                show(current - 1);
            } else if (event.key === 'Home') {
                event.preventDefault();
                show(0);
            } else if (event.key === 'End') {
                event.preventDefault();
                show(slides.length - 1);
            } else if (event.key === 'f' || event.key === 'F') {
                if (document.fullscreenElement) document.exitFullscreen();
                else document.documentElement.requestFullscreen();
            }
        });

        document.getElementById('prev').addEventListener('click', function () { show(current - 1); });
        document.getElementById('next').addEventListener('click', function () { show(current + 1); });

        const fromHash = parseInt(location.hash.replace('#', ''), 10);
        show(Number.isFinite(fromHash) && fromHash > 0 ? fromHash - 1 : 0);
    })();
</script>
</body>
</html>
`;

let result = html;
for (const name of IMAGES) {
    result = result.split('{{IMG:' + name + '}}').join(dataUri(name));
}

const missing = result.match(/\{\{IMG:[^}]+\}\}/g);
if (missing) throw new Error('Не встроены изображения: ' + missing.join(', '));

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, result, 'utf8');

console.log('Презентация: ' + path.relative(root, outPath));
console.log('Размер: ' + (Buffer.byteLength(result, 'utf8') / 1024 / 1024).toFixed(2) + ' МБ');
console.log('Слайдов: 9');
