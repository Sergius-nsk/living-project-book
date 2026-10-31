# Сборка пакета книги «ИИ-ферма для BSF» для партнёров.
#
# Запуск из корня проекта:
#   powershell -ExecutionPolicy Bypass -File scripts\build-book-dist.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\build-book-dist.ps1 -PackageName bsf-book-review-2026-10-29-rev3
#
# Что делает:
#   1. Копирует index.html, assets\img и папку cover в dist\<PackageName>.
#   2. Собирает index-standalone.html: cover.css и cover.js встраиваются,
#      ссылки assets/img заменяются на data URI.
#   3. Пакует папку в dist\<PackageName>.zip и пишет README.txt.
#   4. Проверяет, что в одиночной версии не осталось внешних ссылок, и печатает контрольные суммы.
#
# Требования к index.html:
#   - обложка подключается тегами <link ... cover/cover.css> и <script ... cover/cover.js>;
#   - ссылки на изображения встречаются только в атрибутах src и в CSS.
# Кнопки просмотра схем передают this, а не путь (см. openSchemeViewer), иначе одиночная версия теряет схемы.

[CmdletBinding()]
param(
    [string]$PackageName = 'bsf-book-review-2026-10-29'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$book = Join-Path $root 'Landing-book'
$dist = Join-Path $root 'dist'
$out  = Join-Path $dist $PackageName
$zip  = Join-Path $dist "$PackageName.zip"
$indexPath = Join-Path $book 'index.html'

if (-not (Test-Path $indexPath)) { throw "Не найден исходник: $indexPath" }

$imgSrc = Join-Path $book 'assets\img'
$coverSrc = Join-Path $book 'cover'
if (-not (Test-Path $imgSrc)) { throw "Не найдена папка изображений: $imgSrc" }
if (-not (Test-Path $coverSrc)) { throw "Не найдена папка обложки: $coverSrc" }

if (Test-Path $out) { Remove-Item -Path $out -Recurse -Force }
New-Item -ItemType Directory -Force -Path $out | Out-Null

# 1. Копирование: книга, изображения, обложка.
Copy-Item -Path $indexPath -Destination (Join-Path $out 'index.html') -Force

Get-ChildItem -Path $imgSrc -Recurse -File -Force | ForEach-Object {
    $rel  = $_.FullName.Substring($imgSrc.Length).TrimStart('\')
    $dest = Join-Path (Join-Path $out 'assets\img') $rel
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
    Copy-Item -Path $_.FullName -Destination $dest -Force
}

Get-ChildItem -Path $coverSrc -Recurse -File -Force | ForEach-Object {
    $rel  = $_.FullName.Substring($coverSrc.Length).TrimStart('\')
    $dest = Join-Path (Join-Path $out 'cover') $rel
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
    Copy-Item -Path $_.FullName -Destination $dest -Force
}

# 2. README для получателя.
$readmeText = @'
Проект «ИИ-ферма для BSF»
Интерактивная книга для просмотра в браузере

ВАЖНО: НЕ ОТКРЫВАЙТЕ index.html ПРЯМО ИЗ ОКНА ZIP-АРХИВА
Проводник Windows в этом случае извлекает только сам файл без папок,
и книга откроется без оформления и изображений.

КАК ОТКРЫТЬ — ВАРИАНТ 1 (рекомендуемый)
1. Щёлкните по архиву правой кнопкой -> «Извлечь все…».
2. Откройте распакованную папку.
3. Двойной щелчок по index.html — книга откроется в браузере.

КАК ОТКРЫТЬ — ВАРИАНТ 2 (если распаковать нельзя)
Откройте файл index-standalone.html. Это та же книга, но все изображения
и оформление встроены внутрь файла. Она работает даже из ZIP, из почты и из мессенджера.

ИНТЕРНЕТ НЕ НУЖЕН
Книга автономна: изображения и стили лежат в папках assets и cover либо встроены
в index-standalone.html. Шрифты системные.
Внешние ссылки на источники откроются только при наличии интернета — на просмотр книги это не влияет.

НАВИГАЦИЯ
- Щёлкните по обложке — откроется содержание.
- Щёлкните по названию главы — раскроются параграфы.
- Слова, выделенные цветом и пунктиром, открывают дополнительные окна.
- Esc закрывает верхнее окно, затем главу, затем содержание.
- Окна также закрываются крестиком или щелчком по тёмному фону.

РЕКОМЕНДУЕМЫЕ БРАУЗЕРЫ
Chrome, Microsoft Edge, Яндекс Браузер — последние версии.

СОСТАВ ПАПКИ
index.html             — книга
index-standalone.html  — та же книга одним файлом
assets\                — изображения
cover\                 — обложка: стили и разметка
README.txt             — эта инструкция
'@
[System.IO.File]::WriteAllText((Join-Path $out 'README.txt'), $readmeText, (New-Object System.Text.UTF8Encoding($false)))

# 3. Одиночная версия: обложка и изображения внутрь файла.
$html = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)

$coverCss = [System.IO.File]::ReadAllText((Join-Path $coverSrc 'cover.css'), [System.Text.Encoding]::UTF8)
$coverJs  = [System.IO.File]::ReadAllText((Join-Path $coverSrc 'cover.js'), [System.Text.Encoding]::UTF8)

$html = $html.Replace('<link rel="stylesheet" href="cover/cover.css">', "<style>`n$coverCss`n</style>")
$html = $html.Replace('<script src="cover/cover.js"></script>', "<script>`n$coverJs`n</script>")

$mime = @{ '.webp' = 'image/webp'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg' }
$pattern = 'assets/img/[A-Za-z0-9/_.-]+\.(?:webp|png|jpe?g)'

$relPaths = [regex]::Matches($html, $pattern) |
    ForEach-Object { $_.Value } |
    Sort-Object -Unique

foreach ($rel in $relPaths) {
    $file = Join-Path $book ($rel -replace '/', '\')
    if (-not (Test-Path $file)) { throw "Нет файла, на который ссылается index.html: $file" }
    $ext = [System.IO.Path]::GetExtension($file).ToLower()
    if (-not $mime.ContainsKey($ext)) { throw "Неизвестный тип изображения: $ext" }
    $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($file))
    $html = $html.Replace($rel, "data:$($mime[$ext]);base64,$b64")
}

$standalone = Join-Path $out 'index-standalone.html'
[System.IO.File]::WriteAllText($standalone, $html, (New-Object System.Text.UTF8Encoding($false)))

# 4. Проверки целостности одиночной версии.
$left = [regex]::Matches($html, 'assets/img/').Count
if ($left -ne 0) { throw "В index-standalone.html остались ссылки на assets/img: $left" }

$coverLeft = [regex]::Matches($html, '(href|src)="cover/cover\.(css|js)"').Count
if ($coverLeft -ne 0) { throw "В index-standalone.html остались внешние ссылки на обложку: $coverLeft" }

$embedded = [regex]::Matches($html, 'data:image/[a-z]+;base64,').Count

# 5. Упаковка.
if (Test-Path $zip) { Remove-Item -Path $zip -Force }
Compress-Archive -Path (Join-Path $out '*') -DestinationPath $zip -CompressionLevel Optimal -Force

# 6. Отчёт.
$files = @(
    (Join-Path $out 'index.html'),
    $standalone,
    $zip
)

"Собрано: $PackageName"
"Изображений встроено: $embedded (уникальных путей: $($relPaths.Count))"
"Внешних ссылок на assets и cover в одиночной версии: $($left + $coverLeft)"
''
foreach ($f in $files) {
    $item = Get-Item $f
    $hash = (Get-FileHash -Path $f -Algorithm SHA256).Hash
    '{0,-32} {1,12:N0} байт  {2}' -f $item.Name, $item.Length, $hash
}
