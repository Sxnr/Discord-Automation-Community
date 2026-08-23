const db = require('../database/db');

// Diccionario de idiomas. Español es el predeterminado y fallback.
const locales = {
    es: {
        'lang.set': '🌐 Idioma del servidor cambiado a **español**.',
        'lang.set.en': '🌐 Server language changed to **English**.',

        'common.noPerm': '❌ No tienes permiso para usar este comando.',
        'common.error': '❌ Ocurrió un error inesperado. Intenta de nuevo.',

        'status.title': '📊 Estado del Bot',
        'status.shard': 'Shard',
        'status.guilds': 'Servidores',
        'status.users': 'Usuarios',
        'status.uptime': 'Tiempo activo',
        'status.ping': 'Latencia',
        'status.ram': 'Memoria',

        'profile.title': '👤 Perfil de {user}',
        'profile.lvl': 'Nivel',
        'profile.xp': 'XP',
        'profile.coins': 'Monedas',
        'profile.rank': 'Puesto',

        'economy.wallet': '👜 Cartera',
        'economy.bank': '🏦 Banco',
        'economy.total': '💎 Total',
        'economy.balanceOf': 'Balance de {user}',

        'vote.claimed': '✅ ¡Voto registrado! Recibiste **{amount}** monedas.',
        'vote.cooldown': '⏳ Ya votaste. Podrás votar de nuevo <t:{ts}:R>.',
        'vote.notFound': '🔗 Aún no se ha configurado el enlace de votación.',

        'game.win': '🎉 ¡Ganaste {amount} monedas!',
        'game.lose': '💸 Perdiste {amount} monedas.',
        'game.betInvalid': '❌ La apuesta debe ser un número mayor a 0.',
        'game.noMoney': '❌ No tienes suficientes monedas para apostar.'
    },
    en: {
        'lang.set': '🌐 Server language changed to **English**.',
        'lang.set.en': '🌐 Server language changed to **English**.',

        'common.noPerm': '❌ You do not have permission to use this command.',
        'common.error': '❌ An unexpected error occurred. Try again.',

        'status.title': '📊 Bot Status',
        'status.shard': 'Shard',
        'status.guilds': 'Servers',
        'status.users': 'Users',
        'status.uptime': 'Uptime',
        'status.ping': 'Latency',
        'status.ram': 'Memory',

        'profile.title': '{user}\'s Profile',
        'profile.lvl': 'Level',
        'profile.xp': 'XP',
        'profile.coins': 'Coins',
        'profile.rank': 'Rank',

        'economy.wallet': '👜 Wallet',
        'economy.bank': '🏦 Bank',
        'economy.total': '💎 Total',
        'economy.balanceOf': '{user}\'s balance',

        'vote.claimed': '✅ Vote registered! You received **{amount}** coins.',
        'vote.cooldown': '⏳ You already voted. You can vote again <t:{ts}:R>.',
        'vote.notFound': '🔗 The vote link has not been configured yet.',

        'game.win': '🎉 You won {amount} coins!',
        'game.lose': '💸 You lost {amount} coins.',
        'game.betInvalid': '❌ The bet must be a number greater than 0.',
        'game.noMoney': '❌ You do not have enough coins to bet.'
    }
};

function getLang(guildId) {
    if (!guildId) return 'es';
    try {
        const r = db.prepare('SELECT language FROM guild_settings WHERE guild_id = ?').get(guildId);
        return (r && r.language) || 'es';
    } catch { return 'es'; }
}

// t(guildId, key, vars) -> string traducida con reemplazo de {var}
function t(guildId, key, vars = {}) {
    const lang = getLang(guildId);
    const str = (locales[lang] && locales[lang][key]) || locales.es[key] || key;
    return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
}

function setLang(guildId, lang) {
    if (!['es', 'en'].includes(lang)) return false;
    db.prepare(`
        INSERT INTO guild_settings (guild_id, language) VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET language = excluded.language
    `).run(guildId, lang);
    return true;
}

module.exports = { locales, getLang, setLang, t };
