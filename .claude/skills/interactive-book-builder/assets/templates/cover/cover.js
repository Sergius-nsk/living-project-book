// Обложка книги. Одна на книгу и на все главы.
// Вставляет разметку на место заглушки <div id="cover-host"></div>
// и включает клавиатуру: Enter и пробел открывают/закрывают содержание.
//
// Название и подзаголовок берутся из атрибутов <body>:
//   <body data-book-title="Название книги" data-book-subtitle="Подзаголовок">
//
// Правка обложки — только здесь и в cover.css.

(function () {
    const host = document.getElementById('cover-host');
    if (!host) return;

    const title = document.body.getAttribute('data-book-title') || 'Название книги';
    const subtitle = document.body.getAttribute('data-book-subtitle') || '';

    host.outerHTML = `
        <div class="cover" id="bookCover" role="button" tabindex="0" aria-controls="mainTOC" aria-expanded="false" onclick="toggleTOC()">
            <div class="visual-container">
                <div class="waste-cloud"></div>
                <div class="waste-cloud" style="left: 80px; top: 20px; width: 120px; height: 120px; opacity: 0.5; animation-delay: -2s;"></div>
                <div class="visual-engineer">
                    <svg class="cyber-larva" viewBox="0 0 600 200">
                        <path d="M50,100 Q80,50 120,100 T200,100 T280,100 T360,100 T440,100 T520,100" />
                        <circle cx="50" cy="100" r="4" fill="var(--accent-color)" />
                        <circle cx="520" cy="100" r="4" fill="var(--accent-color)" />
                        <line x1="120" y1="100" x2="120" y2="40" stroke="var(--accent-color)" stroke-width="0.5" stroke-opacity="0.3" />
                        <line x1="280" y1="100" x2="280" y2="160" stroke="var(--accent-color)" stroke-width="0.5" stroke-opacity="0.3" />
                        <line x1="440" y1="100" x2="440" y2="40" stroke="var(--accent-color)" stroke-width="0.5" stroke-opacity="0.3" />
                    </svg>
                    <div class="ui-elements">
                        <div class="ui-dot" style="top: 20%; left: 20%;"></div>
                        <div class="ui-dot" style="top: 80%; left: 40%;"></div>
                        <div class="ui-dot" style="top: 30%; left: 60%;"></div>
                        <div class="ui-dot" style="top: 70%; left: 80%;"></div>
                    </div>
                </div>
                <div class="protein-glow">
                    <div class="protein-core"></div>
                </div>
            </div>
            <h1 class="title"></h1>
            <div class="subtitle"></div>
        </div>
    `;

    const cover = document.getElementById('bookCover');
    cover.querySelector('.title').textContent = title;
    cover.querySelector('.subtitle').textContent = subtitle;

    cover.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (typeof window.toggleTOC === 'function') window.toggleTOC();
        }
    });
})();
