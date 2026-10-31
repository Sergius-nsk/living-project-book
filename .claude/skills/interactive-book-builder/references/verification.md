# Проверка книги

## Быстрый чек-лист

1. `node scripts/assemble-book.js` — dry run: главы найдены, порядок верный, нет предупреждений.
2. `node scripts/probe-browser.js --file book/index.html` — автоматический проход по главам и ссылкам.
3. Глазами: обложка, раскрытие главы, окно, Esc, крестик.
4. `node scripts/package-book.js --name ...` — пакет собран.
5. Открыть `dist/<имя>/index-standalone.html` в одиночку (без соседних папок).

## Автоматическая проверка в браузере

`probe-browser.js` запускает headless Chrome через DevTools Protocol без зависимостей
и делает то, что делал бы человек:

- открывает обложку;
- раскрывает каждую главу;
- нажимает каждую ссылку;
- фиксирует `id` открывшегося окна и размеры картинок;
- закрывает окно клавишей Esc и проверяет, что оно закрылось.

Выход — JSON. Ищите:

- `broken: []` — пусто значит, что все ссылки открывают окна и окна закрываются;
- `modal: null` — ссылка не нашла окно (нет такого `id` или слово `label` не совпало);
- `images: [0, ...]` — картинка не загрузилась (неверный путь).

Код возврата `2` — есть сломанные ссылки, `1` — ошибка запуска.

Chrome ищется автоматически в типовых местах; если не найден, задайте путь:

```bash
CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" node scripts/probe-browser.js --file book/index.html
```

## Проверка синтаксиса скриптов

Быстрый способ без браузера — скомпилировать встроенные `<script>` блоки:

```js
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync('book/index.html', 'utf8');
const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let m, i = 0;
while ((m = re.exec(html))) {
    if (!m[1].trim()) continue;
    i++;
    try { new vm.Script(m[1]); console.log('блок ' + i + ': OK'); }
    catch (e) { console.log('блок ' + i + ': ОШИБКА — ' + e.message); }
}
```

Блоки `<script type="application/json">` этим способом не проверяются — это не JavaScript.
Их валидность проверяет сборщик через `JSON.parse`.

## Что проверять в пакете

- `index.html` открывается из распакованной папки; картинки на месте.
- `index-standalone.html` открывается из пустой папки; картинки тоже на месте.
- В одиночной версии не осталось ссылок `_shared/` и `assets/`:

```bash
grep -c "_shared/\|cover/\|assets/img/" dist/<имя>/index-standalone.html
```

Должно быть `0`.

## Проверка сборки перед публикацией

```bash
node scripts/assemble-book.js            # сколько глав найдено и в каком порядке
node scripts/package-book.js --name …    # размеры и контрольные суммы
```

Если число глав в сборке меньше, чем вы ожидаете, — скорее всего у новой папки нет
маркеров `CHAPTER-DATA`, либо файл не `.html`, либо лежит в исключённой папке
(`_shared`, `_archive`, `assets`).
