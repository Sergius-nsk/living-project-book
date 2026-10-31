// Движок книги и страницы главы.
//
// Два режима, выбор автоматический:
//   1. Страница главы: на странице есть <script type="application/json" id="chapter-data">.
//      Рендерится одна глава; номер берётся из поля order (целое), дробный не показывается.
//   2. Книга: на странице объявлен window.chaptersData = [...]. Рендерятся все главы,
//      нумерация сквозная по позиции: 1, 2, 3, ...
//
// Обеспечивает: содержание, раскрытие главы, модальные окна, Esc, возврат фокуса.

(function () {
    const dataBlock = document.getElementById('chapter-data');
    let chapters;

    if (dataBlock) {
        chapters = [JSON.parse(dataBlock.textContent)];
    } else if (Array.isArray(window.chaptersData)) {
        chapters = window.chaptersData;
    } else {
        return;
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    // Тезис — строка или объект { text, links: [{ label, modal }] }.
    // Ссылка ставится по вхождению label в text.
    function thesisWithLink(thesis) {
        const text = thesis.text || '';
        const links = thesis.links || (thesis.link ? [thesis.link] : []);
        const marks = [];
        links.forEach((link) => {
            const pos = text.indexOf(link.label);
            if (pos !== -1) marks.push({ pos: pos, link: link });
        });
        marks.sort((a, b) => a.pos - b.pos);
        let result = '';
        let cursor = 0;
        marks.forEach((mark) => {
            if (mark.pos < cursor) return;
            result += escapeHtml(text.slice(cursor, mark.pos));
            result += `<span class="interactive-link" role="link" tabindex="0" onclick="event.stopPropagation(); showModal('${mark.link.modal}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault(); this.click();}">${escapeHtml(mark.link.label)}</span>`;
            cursor = mark.pos + mark.link.label.length;
        });
        result += escapeHtml(text.slice(cursor));
        return result;
    }

    const modalStack = [];

    window.showModal = function (id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modalStack.push({ id: id, trigger: document.activeElement, scrollY: window.scrollY });
        modal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        const focusTarget = modal.querySelector('.modal-close');
        if (focusTarget) focusTarget.focus();
    };

    window.hideModal = function (id, options) {
        const modal = document.getElementById(id);
        if (!modal) return;
        const restoreFocus = !options || options.restoreFocus !== false;
        modal.classList.remove('is-open');
        if (!restoreFocus && modal.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        const index = modalStack.map((entry) => entry.id).lastIndexOf(id);
        const entry = index !== -1 ? modalStack.splice(index, 1)[0] : null;
        const stillOpen = document.querySelector('.modal-overlay.is-open');
        if (restoreFocus && entry && entry.trigger && document.contains(entry.trigger) && entry.trigger !== document.body) {
            entry.trigger.focus({ preventScroll: Boolean(stillOpen) });
        } else if (!stillOpen && entry) {
            window.scrollTo(0, entry.scrollY);
        }
        if (!stillOpen) document.body.style.overflow = '';
    };

    window.toggleTOC = function () {
        const toc = document.getElementById('mainTOC');
        if (toc) toc.classList.toggle('is-open');
    };

    // Полноэкранный просмотр схемы: берём уже отображённую картинку из карточки,
    // поэтому работает и с путём к файлу, и со встроенным data URI.
    window.openSchemeViewer = function (trigger, title) {
        const image = document.getElementById('schemeViewerImage');
        const heading = document.getElementById('schemeViewerTitle');
        const figure = trigger && trigger.closest ? trigger.closest('.scheme-card') : null;
        const source = figure ? figure.querySelector('img') : null;
        if (image && source) {
            image.src = source.currentSrc || source.src;
            image.alt = title;
        }
        if (heading) heading.textContent = title;
        showModal('schemeViewerModal');
    };

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const openOverlays = document.querySelectorAll('.modal-overlay.is-open');
        if (openOverlays.length) {
            hideModal(openOverlays[openOverlays.length - 1].id, { restoreFocus: false });
            return;
        }
        const openChapter = document.querySelector('.chapter-content.is-open');
        if (openChapter) {
            openChapter.classList.remove('is-open');
            const header = openChapter.parentElement.querySelector('.chapter-header');
            if (header) header.setAttribute('aria-expanded', 'false');
            return;
        }
        const toc = document.getElementById('mainTOC');
        if (toc) toc.classList.remove('is-open');
    });

    function toggleChapter(chapterDiv) {
        const content = chapterDiv.querySelector('.chapter-content');
        if (!content) return;
        const willOpen = !content.classList.contains('is-open');
        document.querySelectorAll('.chapter-content').forEach((c) => {
            c.classList.remove('is-open');
            const cHeader = c.parentElement ? c.parentElement.querySelector('.chapter-header') : null;
            if (cHeader) cHeader.setAttribute('aria-expanded', 'false');
        });
        content.classList.toggle('is-open', willOpen);
        const header = chapterDiv.querySelector('.chapter-header');
        if (header) header.setAttribute('aria-expanded', String(willOpen));
    }

    function buildChapter(chapter, prefix, index) {
        const chapterDiv = document.createElement('div');
        chapterDiv.className = 'chapter';

        const header = document.createElement('div');
        header.className = 'chapter-header';
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'false');
        const contentId = `chapter-content-${index + 1}`;
        header.setAttribute('aria-controls', contentId);
        const activate = () => toggleChapter(chapterDiv);
        header.addEventListener('click', activate);
        header.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activate();
            }
        });

        const titleSpan = document.createElement('span');
        titleSpan.className = 'chapter-title';
        if (chapter.title && typeof chapter.title === 'object') {
            titleSpan.innerHTML = prefix + thesisWithLink(chapter.title);
        } else {
            titleSpan.innerText = prefix + chapter.title;
        }
        header.appendChild(titleSpan);

        const statusSpan = document.createElement('span');
        statusSpan.className = 'chapter-status ' + (chapter.ready ? 'status-ready' : '');
        statusSpan.innerText = chapter.ready ? 'Готово' : 'Ожидание';
        header.appendChild(statusSpan);

        chapterDiv.appendChild(header);

        if (chapter.ready && Array.isArray(chapter.content)) {
            const contentDiv = document.createElement('div');
            contentDiv.className = 'chapter-content';
            contentDiv.id = contentId;
            chapter.content.forEach((para) => {
                const pDiv = document.createElement('div');
                pDiv.className = 'paragraph';
                const tList = document.createElement('div');
                tList.className = 'thesis-list';
                (para.theses || []).forEach((t) => {
                    const tDiv = document.createElement('div');
                    tDiv.className = 'thesis';
                    if (t && typeof t === 'object' && (t.link || t.links)) {
                        tDiv.innerHTML = thesisWithLink(t);
                    } else {
                        tDiv.innerText = (t && typeof t === 'object') ? t.text : t;
                    }
                    tList.appendChild(tDiv);
                });
                pDiv.appendChild(tList);
                contentDiv.appendChild(pDiv);
            });
            chapterDiv.appendChild(contentDiv);
        }

        return chapterDiv;
    }

    function initTOC() {
        const toc = document.getElementById('mainTOC');
        if (!toc) return;

        const singleChapter = chapters.length === 1;

        chapters.forEach((chapter, index) => {
            const order = Number(chapter.order);
            const prefix = singleChapter
                ? (Number.isInteger(order) ? `${order}. ` : '')
                : `${index + 1}. `;
            toc.appendChild(buildChapter(chapter, prefix, index));
        });
    }

    window.addEventListener('load', initTOC);
})();
