const Database = require('better-sqlite3');
const path = require('node:path');

const db = new Database(path.join(__dirname, 'database.sqlite'));

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

// ── 📅 Eventos del servidor ────────────────────────────────────────────────
db.prepare(`
    CREATE TABLE IF NOT EXISTS server_events (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id     TEXT NOT NULL,
        author_id    TEXT NOT NULL,
        channel_id   TEXT NOT NULL,
        message_id   TEXT,
        title        TEXT NOT NULL,
        description  TEXT,
        location     TEXT,
        starts_at    INTEGER NOT NULL,
        ends_at      INTEGER,
        max_attendees INTEGER DEFAULT 0,
        attendees    TEXT DEFAULT '[]',
        status       TEXT DEFAULT 'upcoming',
        timestamp    INTEGER NOT NULL
    )
`).run();

// ── Migración: guild_settings ──────────────────────────────────────────────
const existingColumns = db.prepare("PRAGMA table_info(guild_settings)").all().map(c => c.name);
const requiredColumns = {
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
    automod_enabled:       'INTEGER DEFAULT 0',
    automod_log_channel:   'TEXT',
    automod_anti_spam:     'INTEGER DEFAULT 0',
    automod_spam_limit:    'INTEGER DEFAULT 5',
    automod_spam_interval: 'INTEGER DEFAULT 5000',
    automod_anti_links:    'INTEGER DEFAULT 0',
    automod_anti_invites:  'INTEGER DEFAULT 0',
    automod_bad_words:     "TEXT DEFAULT '[]'",
    warn_mute_threshold:   'INTEGER DEFAULT 3',
    warn_ban_threshold:    'INTEGER DEFAULT 5',
    warn_mute_duration:    'INTEGER DEFAULT 3600000',
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
    suggest_channel:       'TEXT',
    suggest_log_channel:   'TEXT',
    report_channel:        'TEXT',
    report_cooldown:       'INTEGER DEFAULT 300',
    // Bienvenida mejorada
    welcome_message:       "TEXT DEFAULT '¡Bienvenido {user} a {server}!'",
    welcome_background:    'TEXT',
    welcome_color:         "TEXT DEFAULT '#5865F2'",
    welcome_role:          'TEXT',
    welcome_enabled:       'INTEGER DEFAULT 1',
    // 🎂 Cumpleaños
    birthday_channel:      'TEXT',
    birthday_role:         'TEXT',
    birthday_message:      "TEXT DEFAULT '🎂 ¡Hoy es el cumpleaños de {user}! ¡Felicidades!'",
    birthday_hour: 'INTEGER DEFAULT 8',
    // 📊 Polls
    poll_channel:          'TEXT',
    // ⏰ Recordatorios
    reminder_max:          'INTEGER DEFAULT 10',
    // 📅 Eventos
    events_channel:        'TEXT',
    events_log_channel:    'TEXT'
};

for (const [col, type] of Object.entries(requiredColumns)) {
    if (!existingColumns.includes(col)) {
        db.prepare(`ALTER TABLE guild_settings ADD COLUMN ${col} ${type}`).run();
        console.log(`[DB] Columna migrada (guild_settings): ${col}`);
    }
}

// ── Migración: mod_logs ────────────────────────────────────────────────────
const existingModLogColumns = db.prepare("PRAGMA table_info(mod_logs)").all().map(c => c.name);
const requiredModLogColumns = { duration: 'TEXT', active: 'INTEGER DEFAULT 1' };

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