const Database = require('better-sqlite3');
const path = require('node:path');

const db = new Database(path.join(__dirname, 'database.sqlite'));

// ══════════════════════════════════════════════════════════════════════════════
// TABLAS PRINCIPALES
// ══════════════════════════════════════════════════════════════════════════════

db.prepare(`
    CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id              TEXT PRIMARY KEY,
        welcome_channel       TEXT,
        staff_role            TEXT,
        prefix                TEXT DEFAULT '/',
        ticket_log_channel    TEXT,
        ticket_embed_msg      TEXT,
        ticket_embed_image    TEXT,
        ticket_welcome_msg    TEXT,
        audit_log_channel     TEXT,
        general_log_channel   TEXT,
        ticket_dm_preference  INTEGER DEFAULT 0,
        ticket_category       TEXT,
        ticket_count          INTEGER DEFAULT 0,
        ticket_types          TEXT,
        automod_enabled       INTEGER DEFAULT 0,
        automod_log_channel   TEXT,
        automod_anti_spam     INTEGER DEFAULT 0,
        automod_spam_limit    INTEGER DEFAULT 5,
        automod_spam_interval INTEGER DEFAULT 5000,
        automod_anti_links    INTEGER DEFAULT 0,
        automod_anti_invites  INTEGER DEFAULT 0,
        automod_bad_words     TEXT DEFAULT '[]',
        warn_mute_threshold   INTEGER DEFAULT 3,
        warn_ban_threshold    INTEGER DEFAULT 5,
        warn_mute_duration    INTEGER DEFAULT 3600000
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS giveaways (
        message_id    TEXT PRIMARY KEY,
        guild_id      TEXT,
        channel_id    TEXT,
        host_id       TEXT,
        prize         TEXT,
        winner_count  INTEGER DEFAULT 1,
        end_time      INTEGER,
        participants  TEXT DEFAULT '[]',
        winners       TEXT DEFAULT '[]',
        required_role TEXT,
        ended         INTEGER DEFAULT 0
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS warns (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id     TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason       TEXT NOT NULL,
        timestamp    INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS mod_logs (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id     TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        action       TEXT NOT NULL,
        reason       TEXT NOT NULL,
        duration     TEXT,
        timestamp    INTEGER NOT NULL,
        active       INTEGER DEFAULT 1
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS levels (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT NOT NULL,
        user_id    TEXT NOT NULL,
        xp         INTEGER DEFAULT 0,
        level      INTEGER DEFAULT 0,
        messages   INTEGER DEFAULT 0,
        last_xp    INTEGER DEFAULT 0,
        UNIQUE(guild_id, user_id)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS suggestions (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        channel_id  TEXT NOT NULL,
        message_id  TEXT,
        author_id   TEXT NOT NULL,
        content     TEXT NOT NULL,
        status      TEXT DEFAULT 'pending',
        reason      TEXT,
        votes_up    TEXT DEFAULT '[]',
        votes_down  TEXT DEFAULT '[]',
        timestamp   INTEGER NOT NULL
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS reports (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id     TEXT NOT NULL,
        reporter_id  TEXT NOT NULL,
        reported_id  TEXT NOT NULL,
        reason       TEXT NOT NULL,
        channel_id   TEXT,
        message_id   TEXT,
        status       TEXT DEFAULT 'pending',
        handled_by   TEXT,
        timestamp    INTEGER NOT NULL
    )
`).run();

// ── 🎂 Cumpleaños ──────────────────────────────────────────────────────────
db.prepare(`
    CREATE TABLE IF NOT EXISTS birthdays (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT NOT NULL,
        user_id    TEXT NOT NULL,
        day        INTEGER NOT NULL,
        month      INTEGER NOT NULL,
        notified   INTEGER DEFAULT 0,
        UNIQUE(guild_id, user_id)
    )
`).run();

// ── 📊 Polls ───────────────────────────────────────────────────────────────
db.prepare(`
    CREATE TABLE IF NOT EXISTS polls (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        channel_id  TEXT NOT NULL,
        message_id  TEXT,
        author_id   TEXT NOT NULL,
        question    TEXT NOT NULL,
        options     TEXT NOT NULL,
        votes       TEXT NOT NULL DEFAULT '{}',
        voters      TEXT NOT NULL DEFAULT '[]',
        ends_at     INTEGER,
        ended       INTEGER DEFAULT 0,
        timestamp   INTEGER NOT NULL
    )
`).run();

// ── ⏰ Recordatorios ───────────────────────────────────────────────────────
db.prepare(`
    CREATE TABLE IF NOT EXISTS reminders (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        channel_id  TEXT NOT NULL,
        message     TEXT NOT NULL,
        remind_at   INTEGER NOT NULL,
        sent        INTEGER DEFAULT 0,
        timestamp   INTEGER NOT NULL
    )
`).run();

// ── 📅 Eventos ────────────────────────────────────────────────────────────
db.prepare(`
    CREATE TABLE IF NOT EXISTS server_events (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id      TEXT NOT NULL,
        author_id     TEXT NOT NULL,
        channel_id    TEXT NOT NULL,
        message_id    TEXT,
        title         TEXT NOT NULL,
        description   TEXT,
        location      TEXT,
        starts_at     INTEGER NOT NULL,
        ends_at       INTEGER,
        max_attendees INTEGER DEFAULT 0,
        attendees     TEXT DEFAULT '[]',
        status        TEXT DEFAULT 'upcoming',
        timestamp     INTEGER NOT NULL
    )
`).run();

// ── ❓ Trivia ──────────────────────────────────────────────────────────────
db.prepare(`
    CREATE TABLE IF NOT EXISTS trivia_questions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT,
        question   TEXT NOT NULL,
        answer     TEXT NOT NULL,
        options    TEXT NOT NULL,
        category   TEXT DEFAULT 'General',
        difficulty TEXT DEFAULT 'medium',
        global     INTEGER DEFAULT 0
    )
`).run();

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

// ══════════════════════════════════════════════════════════════════════════════
// 💰 ECONOMÍA
// ══════════════════════════════════════════════════════════════════════════════

db.prepare(`
    CREATE TABLE IF NOT EXISTS economy (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id     TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        wallet       INTEGER DEFAULT 0,
        bank         INTEGER DEFAULT 0,
        daily_streak INTEGER DEFAULT 0,
        last_daily   INTEGER DEFAULT 0,
        last_work    INTEGER DEFAULT 0,
        last_crime   INTEGER DEFAULT 0,
        total_earned INTEGER DEFAULT 0,
        total_spent  INTEGER DEFAULT 0,
        UNIQUE(guild_id, user_id)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS shop_items (
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
        timestamp   INTEGER NOT NULL
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

// ══════════════════════════════════════════════════════════════════════════════
// 👤 PERFIL PERSONALIZABLE
// ══════════════════════════════════════════════════════════════════════════════

db.prepare(`
    CREATE TABLE IF NOT EXISTS profiles (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id      TEXT NOT NULL,
        user_id       TEXT NOT NULL,
        bio           TEXT DEFAULT '',
        color         TEXT DEFAULT '#5865F2',
        banner_url    TEXT,
        timezone      TEXT DEFAULT 'UTC',
        birthday_show INTEGER DEFAULT 1,
        fav_emoji     TEXT DEFAULT '⭐',
        socials       TEXT DEFAULT '{}',
        UNIQUE(guild_id, user_id)
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// 🏆 LOGROS Y BADGES
// ══════════════════════════════════════════════════════════════════════════════

db.prepare(`
    CREATE TABLE IF NOT EXISTS achievements (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT,
        key         TEXT NOT NULL,
        name        TEXT NOT NULL,
        description TEXT NOT NULL,
        emoji       TEXT DEFAULT '🏆',
        condition   TEXT NOT NULL,
        threshold   INTEGER DEFAULT 1,
        secret      INTEGER DEFAULT 0,
        global      INTEGER DEFAULT 1,
        UNIQUE(guild_id, key)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS user_achievements (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id     TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        achievement_key TEXT NOT NULL,
        unlocked_at  INTEGER NOT NULL,
        UNIQUE(guild_id, user_id, achievement_key)
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// 🐾 MASCOTA VIRTUAL
// ══════════════════════════════════════════════════════════════════════════════

db.prepare(`
    CREATE TABLE IF NOT EXISTS pets (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        name        TEXT NOT NULL,
        type        TEXT NOT NULL,
        emoji       TEXT NOT NULL,
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

// ══════════════════════════════════════════════════════════════════════════════
// 📌 REACTION ROLES
// ══════════════════════════════════════════════════════════════════════════════

db.prepare(`
    CREATE TABLE IF NOT EXISTS reaction_roles (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        emoji      TEXT NOT NULL,
        role_id    TEXT NOT NULL,
        mode       TEXT DEFAULT 'toggle',
        label      TEXT,
        UNIQUE(guild_id, message_id, emoji)
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS reaction_role_panels (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        channel_id  TEXT NOT NULL,
        message_id  TEXT NOT NULL,
        title       TEXT NOT NULL,
        description TEXT,
        color       TEXT DEFAULT '#5865F2',
        mode        TEXT DEFAULT 'toggle',
        timestamp   INTEGER NOT NULL
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// ✅ VERIFICACIÓN
// ══════════════════════════════════════════════════════════════════════════════

db.prepare(`
    CREATE TABLE IF NOT EXISTS verifications (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        status      TEXT DEFAULT 'pending',
        method      TEXT NOT NULL,
        code        TEXT,
        attempts    INTEGER DEFAULT 0,
        verified_at INTEGER,
        timestamp   INTEGER NOT NULL,
        UNIQUE(guild_id, user_id)
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// ⭐ STARBOARD
// ══════════════════════════════════════════════════════════════════════════════

db.prepare(`
    CREATE TABLE IF NOT EXISTS starboard (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id        TEXT NOT NULL,
        original_msg_id TEXT NOT NULL,
        star_msg_id     TEXT,
        channel_id      TEXT NOT NULL,
        author_id       TEXT NOT NULL,
        content         TEXT,
        stars           INTEGER DEFAULT 1,
        timestamp       INTEGER NOT NULL,
        UNIQUE(guild_id, original_msg_id)
    )
`).run();

// ══════════════════════════════════════════════════════════════════════════════
// MIGRACIONES — guild_settings
// ══════════════════════════════════════════════════════════════════════════════

const existingColumns  = db.prepare("PRAGMA table_info(guild_settings)").all().map(c => c.name);
const requiredColumns  = {
    // tickets
    ticket_log_channel:    'TEXT',
    ticket_embed_msg:      'TEXT',
    ticket_embed_image:    'TEXT',
    ticket_welcome_msg:    'TEXT',
    audit_log_channel:     'TEXT',
    general_log_channel:   'TEXT',
    ticket_dm_preference:  'INTEGER DEFAULT 0',
    ticket_category:       'TEXT',
    ticket_count:          'INTEGER DEFAULT 0',
    ticket_types:          'TEXT',
    // automod
    automod_enabled:       'INTEGER DEFAULT 0',
    automod_log_channel:   'TEXT',
    automod_anti_spam:     'INTEGER DEFAULT 0',
    automod_spam_limit:    'INTEGER DEFAULT 5',
    automod_spam_interval: 'INTEGER DEFAULT 5000',
    automod_anti_links:    'INTEGER DEFAULT 0',
    automod_anti_invites:  'INTEGER DEFAULT 0',
    automod_bad_words:     "TEXT DEFAULT '[]'",
    // warns
    warn_mute_threshold:   'INTEGER DEFAULT 3',
    warn_ban_threshold:    'INTEGER DEFAULT 5',
    warn_mute_duration:    'INTEGER DEFAULT 3600000',
    // xp
    xp_enabled:            'INTEGER DEFAULT 1',
    xp_channel:            'TEXT',
    xp_ignored_channels:   "TEXT DEFAULT '[]'",
    xp_min:                'INTEGER DEFAULT 15',
    xp_max:                'INTEGER DEFAULT 25',
    xp_cooldown:           'INTEGER DEFAULT 60',
    xp_multiplier:         'REAL DEFAULT 1.0',
    xp_level_roles:        "TEXT DEFAULT '{}'",
    xp_levelup_msg:        "TEXT DEFAULT '¡Felicitaciones {user}! 🎊 Has alcanzado el nivel **{level}**'",
    xp_levelup_img:        'TEXT',
    // sugerencias
    suggest_channel:       'TEXT',
    suggest_log_channel:   'TEXT',
    // reportes
    report_channel:        'TEXT',
    report_cooldown:       'INTEGER DEFAULT 300',
    // bienvenida
    welcome_message:       "TEXT DEFAULT '¡Bienvenido {user} a {server}!'",
    welcome_background:    'TEXT',
    welcome_color:         "TEXT DEFAULT '#5865F2'",
    welcome_role:          'TEXT',
    welcome_enabled:       'INTEGER DEFAULT 1',
    // cumpleaños
    birthday_channel:      'TEXT',
    birthday_role:         'TEXT',
    birthday_message:      "TEXT DEFAULT '🎂 ¡Hoy es el cumpleaños de {user}! ¡Felicidades!'",
    birthday_hour:         'INTEGER DEFAULT 8',
    // polls
    poll_channel:          'TEXT',
    // recordatorios
    reminder_max:          'INTEGER DEFAULT 10',
    // eventos
    events_channel:        'TEXT',
    events_log_channel:    'TEXT',
    // 💰 economía
    economy_enabled:       'INTEGER DEFAULT 1',
    economy_currency:      "TEXT DEFAULT 'coins'",
    economy_currency_emoji: "TEXT DEFAULT '💰'",
    economy_daily_amount:  'INTEGER DEFAULT 200',
    economy_daily_streak_bonus: 'INTEGER DEFAULT 50',
    economy_work_min:      'INTEGER DEFAULT 50',
    economy_work_max:      'INTEGER DEFAULT 200',
    economy_work_cooldown: 'INTEGER DEFAULT 3600000',
    economy_crime_min:     'INTEGER DEFAULT 100',
    economy_crime_max:     'INTEGER DEFAULT 500',
    economy_crime_cooldown:'INTEGER DEFAULT 7200000',
    economy_crime_fail_pct:'INTEGER DEFAULT 35',
    economy_rob_enabled:   'INTEGER DEFAULT 1',
    economy_log_channel:   'TEXT',
    // 📌 reaction roles
    rr_max_panels:         'INTEGER DEFAULT 10',
    // ✅ verificación
    verify_enabled:        'INTEGER DEFAULT 0',
    verify_role:           'TEXT',
    verify_channel:        'TEXT',
    verify_log_channel:    'TEXT',
    verify_method:         "TEXT DEFAULT 'button'",
    verify_message:        "TEXT DEFAULT 'Haz clic en el botón para verificarte.'",
    verify_kick_unverified:'INTEGER DEFAULT 0',
    verify_kick_after:     'INTEGER DEFAULT 86400000',
    // ⭐ starboard
    starboard_enabled:     'INTEGER DEFAULT 0',
    starboard_channel:     'TEXT',
    starboard_threshold:   'INTEGER DEFAULT 3',
    starboard_emoji:       "TEXT DEFAULT '⭐'",
    starboard_self_star:   'INTEGER DEFAULT 0',
    starboard_nsfw:        'INTEGER DEFAULT 0',
};

for (const [col, type] of Object.entries(requiredColumns)) {
    if (!existingColumns.includes(col)) {
        db.prepare(`ALTER TABLE guild_settings ADD COLUMN ${col} ${type}`).run();
        console.log(`[DB] Columna migrada (guild_settings): ${col}`);
    }
}

// ── Migración: mod_logs ────────────────────────────────────────────────────
const existingModLogColumns  = db.prepare("PRAGMA table_info(mod_logs)").all().map(c => c.name);
const requiredModLogColumns  = { duration: 'TEXT', active: 'INTEGER DEFAULT 1' };

for (const [col, type] of Object.entries(requiredModLogColumns)) {
    if (!existingModLogColumns.includes(col)) {
        db.prepare(`ALTER TABLE mod_logs ADD COLUMN ${col} ${type}`).run();
        console.log(`[DB] Columna migrada (mod_logs): ${col}`);
    }
}

// ── Migración: giveaways ───────────────────────────────────────────────────
const existingGiveawayColumns = db.prepare("PRAGMA table_info(giveaways)").all().map(c => c.name);
const requiredGiveawayColumns = {
    host_id:       'TEXT',
    winners:       "TEXT DEFAULT '[]'",
    required_role: 'TEXT'
};

for (const [col, type] of Object.entries(requiredGiveawayColumns)) {
    if (!existingGiveawayColumns.includes(col)) {
        db.prepare(`ALTER TABLE giveaways ADD COLUMN ${col} ${type}`).run();
        console.log(`[DB] Columna migrada (giveaways): ${col}`);
    }
}

module.exports = db;