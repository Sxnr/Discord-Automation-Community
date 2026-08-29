const { spawnSync } = require('child_process');
const path = require('path');

// Dependencias opcionales que el bot necesita pero que el hosting a veces no
// instala al hacer solo "git pull". Se verifican en cada arranque y se instalan
// si faltan, para no depender de un "npm install" manual en el hosting.
const OPTIONAL_DEPS = ['discord-player-youtubei', 'youtube-dl-exec'];

// Raíz del proyecto (este archivo está en src/utils -> subimos dos niveles).
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function isInstalled(mod) {
    try { require.resolve(mod); return true; } catch { return false; }
}

function ensureDependencies() {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const missing = OPTIONAL_DEPS.filter(m => !isInstalled(m));

    if (missing.length === 0) {
        console.log('[Deps] ✅ Dependencias opcionales presentes.');
        return;
    }

    console.log(`[Deps] ⚠️ Faltan: ${missing.join(', ')}. Instalando...`);
    try {
        // Forzamos cwd a la raíz del bot para evitar que npm instale en un
        // node_modules padre (hoisting) cuando hay package.json en carpetas superiores.
        const res = spawnSync(npm, ['install', ...missing, '--no-audit', '--no-fund', '--prefer-offline'], {
            stdio: 'inherit',
            timeout: 180000,
            cwd: PROJECT_ROOT,
            env: process.env,
        });
        if (res.error) throw res.error;

        if (isInstalled(missing[0])) {
            console.log('[Deps] ✅ Instalación de dependencias completada.');
        } else {
            console.warn('[Deps] ⚠️ Se instaló pero el módulo sigue sin resolverse. Reintentando con install completo...');
            const res2 = spawnSync(npm, ['install', '--no-audit', '--no-fund', '--prefer-offline'], {
                stdio: 'inherit', timeout: 180000, cwd: PROJECT_ROOT, env: process.env,
            });
            if (res2.error) throw res2.error;
            console.log('[Deps] ✅ Instalación completa finalizada.');
        }
    } catch (e) {
        console.warn('[Deps] ⚠️ No se pudo instalar automáticamente (¿sin red?):', e.message);
        console.warn('[Deps] ⚠️ El bot sigue funcionando, pero YouTube no estará disponible hasta instalarlas.');
    }
}

module.exports = { ensureDependencies };
