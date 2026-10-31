// Синтаксическая проверка встроенных скриптов без их выполнения.
const fs = require('fs');
const vm = require('vm');

for (const file of process.argv.slice(2)) {
    const html = fs.readFileSync(file, 'utf8');
    const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let m, i = 0, failed = 0;
    while ((m = re.exec(html))) {
        i++;
        if (!m[1].trim()) continue;
        try {
            new vm.Script(m[1], { filename: `${file}#block${i}` });
            console.log(`${file} блок ${i}: OK (${m[1].length} символов)`);
        } catch (e) {
            failed++;
            console.log(`${file} блок ${i}: ОШИБКА — ${e.message}`);
        }
    }
    if (failed) process.exitCode = 1;
}
