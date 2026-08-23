// ════════════════════════════════════════════════════════════════════
//  CHEQUEO DE VARIABLES DE ENTORNO AL ARRANQUE
//  Muestra qué keys están presentes y cuáles faltan, para que los
//  comandos que dependen de APIs externas fallen de forma amigable
//  (avisan qué variable falta) en vez de crashear.
// ════════════════════════════════════════════════════════════════════

const OPTIONAL = [
    { key: 'OPENWEATHER_KEY', use: '/clima',        free: 'openweathermap.org/api' },
    { key: 'GNEWS_KEY',       use: '/noticias',     free: 'gnews.io' },
    { key: 'TMDB_KEY',        use: '/peliculas /series', free: 'themoviedb.org/documentation/api' },
    { key: 'GENIUS_TOKEN',    use: '/letra',        free: 'genius.com/developers' },
    { key: 'GIPHY_KEY',       use: '/action (GIFs)',free: 'developers.giphy.com' },
    { key: 'AI_API_KEY',      use: '/aimod (IA)',   free: 'console.groq.com' },
];

function checkEnv() {
    const reqMissing = [];
    if (!process.env.TOKEN)     reqMissing.push('TOKEN');
    if (!process.env.CLIENT_ID) reqMissing.push('CLIENT_ID');

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('  🔎 CHEQUEO DE CONFIGURACIÓN (.env)');
    console.log('════════════════════════════════════════════════════════════════');

    if (reqMissing.length) {
        console.log(`  ❌ FALTAN OBLIGATORIAS: ${reqMissing.join(', ')} — el bot NO arrancará.`);
    } else {
        console.log('  ✅ Variables obligatorias presentes (TOKEN, CLIENT_ID).');
    }

    const ok = [];
    const missing = [];
    for (const o of OPTIONAL) {
        if (process.env[o.key]) ok.push(o);
        else missing.push(o);
    }

    if (ok.length) {
        console.log(`  ✅ APIs externas activas: ${ok.map(o => o.use).join(', ')}`);
    }
    if (missing.length) {
        console.log('  ⚠️  APIs opcionales SIN key (el comando avisará amablemente):');
        for (const o of missing) {
            console.log(`     • ${o.key.padEnd(16)} → ${o.use}  (registro: ${o.free})`);
        }
    }
    console.log('════════════════════════════════════════════════════════════════\n');
    return reqMissing.length === 0;
}

module.exports = { checkEnv };
