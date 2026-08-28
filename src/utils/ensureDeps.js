const { spawnSync } = require('child_process');

// Dependencias opcionales que el bot necesita pero que el hosting a veces no
// instala al hacer solo "git pull". Se verifican en cada arranque y se instalan
// si faltan, para no depender de un "npm install" manual en el hosting.
const OPTIONAL_DEPS = ['discord-player-youtubei'];

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

    console.log(`[Deps] ⚠️ Faltan: ${missing.join(', ')}. Instalando en segundo plano...`);
    try {
        const res = spawnSync(npm, ['install', ...missing, '--no-audit', '--no-fund', '--prefer-offline'], {
            stdio: 'inherit',
            timeout: 180000,
            env: process.env,
        });
        if (res.error) throw res.error;
        console.log('[Deps] ✅ Instalación de dependencias completada.');
    } catch (e) {
        console.warn('[Deps] ⚠️ No se pudo instalar automáticamente (¿sin red?):', e.message);
        console.warn('[Deps] ⚠️ El bot sigue funcionando, pero YouTube no estará disponible hasta instalarlas.');
    }
}

module.exports = { ensureDependencies };
