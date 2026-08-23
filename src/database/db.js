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
        starboard_nsfw INTEGER DEFAULT 0,

        -- ══ Música ══════════════════════════════════════════
        music_volume INTEGER DEFAULT 100,
        music_dj_role TEXT,
        music_text_channel TEXT,
        music_max_queue INTEGER DEFAULT 100,
        music_247 INTEGER DEFAULT 0,
        music_autoplay INTEGER DEFAULT 0,
        music_filters_enabled INTEGER DEFAULT 1,
        music_announce INTEGER DEFAULT 1,
        music_leave_timeout INTEGER DEFAULT 300000
        -- ════════════════════════════════════════════════════
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
// 2b. PERFILES DE USUARIO
// ════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS profiles (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id      TEXT NOT NULL,
        user_id       TEXT NOT NULL,
        bio           TEXT DEFAULT '',
        color         TEXT DEFAULT '#5865F2',
        banner_url    TEXT,
        timezone      TEXT DEFAULT 'UTC',
        fav_emoji     TEXT DEFAULT '⭐',
        socials       TEXT DEFAULT '{}',
        birthday_show INTEGER DEFAULT 1,
        UNIQUE(guild_id, user_id)
    )
`).run();


// 3. LOGROS (CORREGIDO CON UNIQUE)
// ══════════════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT,
        key TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        emoji TEXT DEFAULT '🏆',
        condition TEXT NOT NULL,
        threshold INTEGER DEFAULT 1,
        secret INTEGER DEFAULT 0,
        global INTEGER DEFAULT 1,
        UNIQUE(guild_id, key)
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
// 6. MÚSICA — PLAYLISTS GUARDADAS POR USUARIO
// ══════════════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS music_playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        tracks TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(guild_id, user_id, name)
    )
`).run();


// ══════════════════════════════════════════════════════════════════════════════
// 7. MÚSICA — HISTORIAL DE REPRODUCCIÓN
// ══════════════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS music_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        duration INTEGER DEFAULT 0,
        thumbnail TEXT,
        source TEXT DEFAULT 'youtube',
        played_at INTEGER NOT NULL
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// 8. RECORDATORIOS
// ══════════════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS reminders (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    TEXT    NOT NULL,
        guild_id   TEXT,
        channel_id TEXT    NOT NULL,
        message    TEXT    NOT NULL,
        remind_at  INTEGER NOT NULL,
        sent       INTEGER DEFAULT 0,
        timestamp  INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// 9. ENCUESTAS (POLLS)
// ══════════════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS polls (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id  TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT,
        author_id TEXT NOT NULL,
        question  TEXT NOT NULL,
        options   TEXT NOT NULL DEFAULT '[]',
        votes     TEXT NOT NULL DEFAULT '{}',
        voters    TEXT NOT NULL DEFAULT '[]',
        ended     INTEGER DEFAULT 0,
        ends_at   INTEGER,
        created_at INTEGER NOT NULL
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// 10. REPORTES
// ══════════════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS reports (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        channel_id  TEXT,
        message_id  TEXT,
        author_id   TEXT NOT NULL,
        reported_id TEXT NOT NULL,
        reason      TEXT NOT NULL,
        status      TEXT DEFAULT 'pending',
        handled_by  TEXT,
        created_at  INTEGER NOT NULL
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// 11. EVENTOS DEL SERVIDOR
// ══════════════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS server_events (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id      TEXT NOT NULL,
        channel_id    TEXT,
        message_id    TEXT,
        author_id     TEXT NOT NULL,
        title         TEXT NOT NULL,
        description   TEXT,
        location      TEXT,
        starts_at     INTEGER NOT NULL,
        ends_at       INTEGER,
        max_attendees INTEGER DEFAULT 0,
        attendees     TEXT DEFAULT '[]',
        status        TEXT DEFAULT 'upcoming',
        created_at    INTEGER NOT NULL
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// 12. STARBOARD
// ══════════════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS starboard (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id       TEXT NOT NULL,
        original_msg_id TEXT NOT NULL,
        starboard_msg_id TEXT,
        channel_id     TEXT NOT NULL,
        author_id      TEXT NOT NULL,
        star_count     INTEGER DEFAULT 0,
        UNIQUE(guild_id, original_msg_id)
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// 13. CUMPLEAÑOS
// ══════════════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS birthdays (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id  TEXT NOT NULL,
        month    INTEGER NOT NULL,
        day      INTEGER NOT NULL,
        year     INTEGER,
        notified INTEGER DEFAULT 0,
        UNIQUE(guild_id, user_id)
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// 14. ROLES POR REACCIÓN (REACTION ROLES)
// ══════════════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS reaction_roles (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        emoji      TEXT NOT NULL,
        role_id    TEXT NOT NULL,
        UNIQUE(guild_id, message_id, emoji)
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// 15. ECONOMÍA — TIENDA E INVENTARIO
// ══════════════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS shop_items (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        name        TEXT NOT NULL,
        description TEXT,
        price       INTEGER NOT NULL,
        emoji       TEXT DEFAULT '🛍️',
        role_id     TEXT,
        stock       INTEGER DEFAULT -1,
        type        TEXT DEFAULT 'item',
        available   INTEGER DEFAULT 1,
        timestamp   INTEGER,
        UNIQUE(guild_id, name)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS inventory (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id  TEXT NOT NULL,
        item_id  INTEGER NOT NULL,
        quantity INTEGER DEFAULT 1,
        UNIQUE(guild_id, user_id, item_id)
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

migrateTable('reports', {
    channel_id: 'TEXT',
    message_id: 'TEXT',
});

migrateTable('reminders', {
    sent:      'INTEGER DEFAULT 0',
    timestamp: 'INTEGER',
});

migrateTable('birthdays', {
    notified: 'INTEGER DEFAULT 0',
});

migrateTable('server_events', {
    location: 'TEXT',
    ends_at:  'INTEGER',
});


// Ejecutar migraciones por seguridad
migrateTable('guild_settings', {
    xp_enabled:      'INTEGER DEFAULT 1',
    economy_enabled: 'INTEGER DEFAULT 1',
    starboard_emoji: "TEXT DEFAULT '⭐'",

    // ── Música (migración segura para DBs ya existentes) ────
    music_volume:          'INTEGER DEFAULT 100',
    music_dj_role:         'TEXT',
    music_text_channel:    'TEXT',
    music_max_queue:       'INTEGER DEFAULT 100',
    music_247:             'INTEGER DEFAULT 0',
    music_autoplay:        'INTEGER DEFAULT 0',
    music_filters_enabled: 'INTEGER DEFAULT 1',
    music_announce:        'INTEGER DEFAULT 1',
    music_leave_timeout:   'INTEGER DEFAULT 300000',
    language:               "TEXT DEFAULT 'es'"
    // ────────────────────────────────────────────────────────
    // Añade aquí cualquier columna nueva que inventes en el futuro
});


// ══════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════
// 15b. TRANSACCIONES ECONÓMICAS
// ════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS transactions (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id  TEXT NOT NULL,
        user_id   TEXT NOT NULL,
        type      TEXT NOT NULL,
        amount    INTEGER NOT NULL,
        detail    TEXT,
        timestamp INTEGER NOT NULL
    )
`).run();

// ════════════════════════════════════════════════════════════════════
// 16. MASCOTAS (PETS)
// ════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS pets (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        name        TEXT NOT NULL,
        type        TEXT NOT NULL,
        emoji       TEXT,
        hunger      INTEGER DEFAULT 100,
        happiness   INTEGER DEFAULT 100,
        health      INTEGER DEFAULT 100,
        energy      INTEGER DEFAULT 100,
        level       INTEGER DEFAULT 1,
        xp          INTEGER DEFAULT 0,
        last_feed   INTEGER DEFAULT 0,
        last_play   INTEGER DEFAULT 0,
        last_sleep  INTEGER DEFAULT 0,
        last_heal   INTEGER DEFAULT 0,
        alive       INTEGER DEFAULT 1,
        born_at     INTEGER NOT NULL,
        UNIQUE(guild_id, user_id)
    )
`).run();

// ════════════════════════════════════════════════════════════════════
// 17. ESTADÍSTICAS DE TRIVIA
// ════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS trivia_stats (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        correct     INTEGER DEFAULT 0,
        wrong       INTEGER DEFAULT 0,
        streak      INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        UNIQUE(guild_id, user_id)
    )
`).run();

// ════════════════════════════════════════════════════════════════════
// 18. VERIFICACIÓN DE USUARIOS
// ════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS verifications (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        status      TEXT DEFAULT 'pending',
        method      TEXT,
        code        TEXT,
        attempts    INTEGER DEFAULT 0,
        verified_at INTEGER,
        timestamp   INTEGER,
        UNIQUE(guild_id, user_id)
    )
`).run();

// ════════════════════════════════════════════════════════════════════
// 19. PANELES DE ROLES POR REACCIÓN
// ════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS reaction_role_panels (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        channel_id  TEXT NOT NULL,
        message_id  TEXT NOT NULL,
        title       TEXT,
        description TEXT,
        color       TEXT DEFAULT '#5865F2',
        mode        TEXT DEFAULT 'single',
        timestamp   INTEGER,
        UNIQUE(guild_id, message_id)
    )
`).run();


// ════════════════════════════════════════════════════════════════════
// 20. PREGUNTAS DE TRIVIA (PERSONALIZADAS)
// ════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS trivia_questions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        question    TEXT NOT NULL,
        answer      TEXT NOT NULL,
        options     TEXT NOT NULL,
        category    TEXT DEFAULT '💰 General',
        difficulty  TEXT DEFAULT 'medium',
        global      INTEGER DEFAULT 0
    )
`).run();


// ════════════════════════════════════════════════════════════════════
// 21. VOTOS (Top.gg / Disboard) Y RECOMPENSAS
// ════════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS votes (
        user_id     TEXT PRIMARY KEY,
        guild_id    TEXT,
        last_vote   INTEGER DEFAULT 0,
        total       INTEGER DEFAULT 0,
        streak      INTEGER DEFAULT 0
    )
`).run();


// ── Migraciones de tablas renombradas (compatibilidad con el código) ──
function tableExists(name) {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

// shop -> shop_items (esquema correcto, preservando datos)
if (tableExists('shop_items')) {
    const shopCols = db.prepare('PRAGMA table_info(shop_items)').all().map(c => c.name);
    if (shopCols.includes('created_at')) {
        db.prepare('ALTER TABLE shop_items RENAME TO shop_items_old').run();
        console.log('[DB] Migración: shop_items con esquema obsoleto respaldada');
    }
}
if (!tableExists('shop_items')) {
    db.prepare(`
        CREATE TABLE shop_items (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id    TEXT NOT NULL,
            name        TEXT NOT NULL,
            description TEXT,
            price       INTEGER NOT NULL,
            emoji       TEXT DEFAULT '🛍️',
            role_id     TEXT,
            type        TEXT DEFAULT 'item',
            stock       INTEGER DEFAULT -1,
            available   INTEGER DEFAULT 1,
            timestamp   INTEGER,
            UNIQUE(guild_id, name)
        )
    `).run();
}
if (tableExists('shop')) {
    db.prepare(`
        INSERT OR IGNORE INTO shop_items (guild_id, name, description, price, emoji, role_id, stock)
        SELECT guild_id, name, description, price, emoji, role_id, stock FROM shop
    `).run();
    db.prepare('DROP TABLE shop').run();
    console.log('[DB] Migración: datos de "shop" movidos a "shop_items"');
}
migrateTable('shop_items', {
    type:      "TEXT DEFAULT 'item'",
    available: 'INTEGER DEFAULT 1',
    timestamp: 'INTEGER',
});

// inventory: columna 'item' -> 'item_id'
if (tableExists('inventory')) {
    const invCols = db.prepare('PRAGMA table_info(inventory)').all().map(c => c.name);
    if (!invCols.includes('item_id')) {
        db.prepare('ALTER TABLE inventory RENAME TO inventory_old').run();
        db.prepare(`
            CREATE TABLE inventory (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id  TEXT NOT NULL,
                user_id   TEXT NOT NULL,
                item_id   INTEGER NOT NULL,
                quantity  INTEGER DEFAULT 1,
                UNIQUE(guild_id, user_id, item_id)
            )
        `).run();
        console.log('[DB] Migración: "inventory" recreada con columna "item_id"');
    }
}


// 11b. IA — CONFIGURACIÓN DE MODERACIÓN POR IA
// ══════════════════════════════════════════════════════════════════
db.prepare(`
    CREATE TABLE IF NOT EXISTS ai_mod_settings (
        guild_id     TEXT PRIMARY KEY,
        enabled      INTEGER DEFAULT 0,
        log_channel  TEXT,
        action       TEXT    DEFAULT 'log',
        threshold    REAL    DEFAULT 0.7,
        ignore_roles TEXT    DEFAULT '[]'
    )
`).run();


module.exports = db;