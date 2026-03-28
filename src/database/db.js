const Database = require('better-sqlite3');
const path = require('node:path');

const db = new Database(path.join(__dirname, 'database.sqlite'));

// Habilitar el modo WAL para mejor rendimiento en escrituras simultáneas
db.pragma('journal_mode = WAL');

// ══════════════════════════════════════════════════════════════════════════════
// 1. CONFIGURACIÓN DEL SERVIDOR (GUILD SETTINGS)
// ══════════════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        welcome_channel TEXT,
        staff_role TEXT,
        prefix TEXT DEFAULT '/',
        
        -- Tickets
        ticket_log_channel TEXT,
        ticket_embed_msg TEXT,
        ticket_embed_image TEXT,
        ticket_welcome_msg TEXT,
        ticket_category TEXT,
        ticket_count INTEGER DEFAULT 0,
        ticket_types TEXT,
        ticket_dm_preference INTEGER DEFAULT 0,

        -- Logs Generales
        audit_log_channel TEXT,
        general_log_channel TEXT,

        -- AutoMod
        automod_enabled INTEGER DEFAULT 0,
        automod_log_channel TEXT,
        automod_anti_spam INTEGER DEFAULT 0,
        automod_spam_limit INTEGER DEFAULT 5,
        automod_spam_interval INTEGER DEFAULT 5000,
        automod_anti_links INTEGER DEFAULT 0,
        automod_anti_invites INTEGER DEFAULT 0,
        automod_bad_words TEXT DEFAULT '[]',

        -- Moderación / Warns
        warn_mute_threshold INTEGER DEFAULT 3,
        warn_ban_threshold INTEGER DEFAULT 5,
        warn_mute_duration INTEGER DEFAULT 3600000,

        -- XP / Niveles
        xp_enabled INTEGER DEFAULT 1,
        xp_channel TEXT,
        xp_ignored_channels TEXT DEFAULT '[]',
        xp_min INTEGER DEFAULT 15,
        xp_max INTEGER DEFAULT 25,
        xp_cooldown INTEGER DEFAULT 60,
        xp_multiplier REAL DEFAULT 1.0,
        xp_level_roles TEXT DEFAULT '{}',
        xp_levelup_msg TEXT DEFAULT '¡Felicitaciones {user}! 🎊 Has alcanzado el nivel **{level}**',
        xp_levelup_img TEXT,

        -- Sugerencias / Reportes
        suggest_channel TEXT,
        suggest_log_channel TEXT,
        report_channel TEXT,
        report_cooldown INTEGER DEFAULT 300,

        -- Bienvenida
        welcome_message TEXT DEFAULT '¡Bienvenido {user} a {server}!',
        welcome_background TEXT,
        welcome_color TEXT DEFAULT '#5865F2',
        welcome_role TEXT,
        welcome_enabled INTEGER DEFAULT 1,

        -- Cumpleaños
        birthday_channel TEXT,
        birthday_role TEXT,
        birthday_message TEXT DEFAULT '🎂 ¡Hoy es el cumpleaños de {user}! ¡Felicidades!',
        birthday_hour INTEGER DEFAULT 8,

        -- Economía Config
        economy_enabled INTEGER DEFAULT 1,
        economy_currency TEXT DEFAULT 'coins',
        economy_currency_emoji TEXT DEFAULT '💰',
        economy_daily_amount INTEGER DEFAULT 200,
        economy_daily_streak_bonus INTEGER DEFAULT 50,
        economy_work_min INTEGER DEFAULT 50,
        economy_work_max INTEGER DEFAULT 200,
        economy_work_cooldown INTEGER DEFAULT 3600000,
        economy_crime_min INTEGER DEFAULT 100,
        economy_crime_max INTEGER DEFAULT 500,
        economy_crime_cooldown INTEGER DEFAULT 7200000,
        economy_crime_fail_pct INTEGER DEFAULT 35,
        economy_rob_enabled INTEGER DEFAULT 1,
        economy_log_channel TEXT,

        -- Otros
        poll_channel TEXT,
        events_channel TEXT,
        events_log_channel TEXT,
        reminder_max INTEGER DEFAULT 10,
        rr_max_panels INTEGER DEFAULT 10,
        
        -- Verificación
        verify_enabled INTEGER DEFAULT 0,
        verify_role TEXT,
        verify_channel TEXT,
        verify_log_channel TEXT,
        verify_method TEXT DEFAULT 'button',
        verify_message TEXT DEFAULT 'Haz clic en el botón para verificarte.',
        verify_kick_unverified INTEGER DEFAULT 0,
        verify_kick_after INTEGER DEFAULT 86400000,

        -- Starboard
        starboard_enabled INTEGER DEFAULT 0,
        starboard_channel TEXT,
        starboard_threshold INTEGER DEFAULT 3,
        starboard_emoji TEXT DEFAULT '⭐',
        starboard_self_star INTEGER DEFAULT 0,
        starboard_nsfw INTEGER DEFAULT 0
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// 2. ECONOMÍA Y PROGRESO
// ══════════════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS economy (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        wallet INTEGER DEFAULT 0,
        bank INTEGER DEFAULT 0,
        daily_streak INTEGER DEFAULT 0,
        last_daily INTEGER DEFAULT 0,
        last_work INTEGER DEFAULT 0,
        last_crime INTEGER DEFAULT 0,
        total_earned INTEGER DEFAULT 0,
        total_spent INTEGER DEFAULT 0,
        UNIQUE(guild_id, user_id)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS levels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 0,
        messages INTEGER DEFAULT 0,
        last_xp INTEGER DEFAULT 0,
        UNIQUE(guild_id, user_id)
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// 3. LOGROS (CORREGIDO CON UNIQUE)
// ══════════════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT, -- NULL para globales
        key TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        emoji TEXT DEFAULT '🏆',
        condition TEXT NOT NULL,
        threshold INTEGER DEFAULT 1,
        secret INTEGER DEFAULT 0,
        global INTEGER DEFAULT 1,
        UNIQUE(guild_id, key) -- Evita duplicados por servidor/llave
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS user_achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        achievement_key TEXT NOT NULL,
        unlocked_at INTEGER NOT NULL,
        UNIQUE(guild_id, user_id, achievement_key)
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// 4. MODERACIÓN Y LOGS
// ══════════════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS warns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        timestamp INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS mod_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        duration TEXT,
        timestamp INTEGER NOT NULL,
        active INTEGER DEFAULT 1
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// 5. SISTEMAS VARIOS (GIVEAWAYS, POLLS, SUGGESTIONS)
// ══════════════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS giveaways (
        message_id TEXT PRIMARY KEY,
        guild_id TEXT,
        channel_id TEXT,
        host_id TEXT,
        prize TEXT,
        winner_count INTEGER DEFAULT 1,
        end_time INTEGER,
        participants TEXT DEFAULT '[]',
        winners TEXT DEFAULT '[]',
        required_role TEXT,
        ended INTEGER DEFAULT 0
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT,
        author_id TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        reason TEXT,
        votes_up TEXT DEFAULT '[]',
        votes_down TEXT DEFAULT '[]',
        timestamp INTEGER NOT NULL
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// MIGRACIONES DINÁMICAS (Para actualizaciones futuras sin borrar la DB)
// ══════════════════════════════════════════════════════════════════════════════
function migrateTable(tableName, columns) {
    const info = db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
    for (const [col, type] of Object.entries(columns)) {
        if (!info.includes(col)) {
            try {
                db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${col} ${type}`).run();
                console.log(`[DB] Migración: Columna '${col}' añadida a '${tableName}'`);
            } catch (e) {
                console.error(`[DB] Error migrando '${col}' en '${tableName}':`, e.message);
            }
        }
    }
}

// Ejecutar migraciones por seguridad
migrateTable('guild_settings', {
    xp_enabled: 'INTEGER DEFAULT 1',
    economy_enabled: 'INTEGER DEFAULT 1',
    starboard_emoji: "TEXT DEFAULT '⭐'"
    // Añade aquí cualquier columna nueva que inventes en el futuro
});

module.exports = db;