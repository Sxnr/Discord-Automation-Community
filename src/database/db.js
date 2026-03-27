const Database = require('better-sqlite3');
const path = require('node:path');

const db = new Database(path.join(__dirname, 'database.sqlite'));

// Tabla base con TODAS las columnas
db.prepare(`
    CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id             TEXT PRIMARY KEY,
        welcome_channel      TEXT,
        staff_role           TEXT,
        prefix               TEXT DEFAULT '/',
        ticket_log_channel   TEXT,
        ticket_embed_msg     TEXT,
        ticket_embed_image   TEXT,
        ticket_welcome_msg   TEXT,
        audit_log_channel    TEXT,
        general_log_channel  TEXT,
        ticket_dm_preference INTEGER DEFAULT 0,
        ticket_category      TEXT,
        ticket_count         INTEGER DEFAULT 0,
        ticket_types         TEXT
    )
`).run();

// ➕ Tabla de sorteos con columnas nuevas
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

// Migración automática guild_settings
const existingColumns = db.prepare("PRAGMA table_info(guild_settings)").all().map(c => c.name);
const requiredColumns = {
    ticket_log_channel:   'TEXT',
    ticket_embed_msg:     'TEXT',
    ticket_embed_image:   'TEXT',
    ticket_welcome_msg:   'TEXT',
    audit_log_channel:    'TEXT',
    general_log_channel:  'TEXT',
    ticket_dm_preference: 'INTEGER DEFAULT 0',
    ticket_category:      'TEXT',
    ticket_count:         'INTEGER DEFAULT 0',
    ticket_types:         'TEXT'
};

for (const [col, type] of Object.entries(requiredColumns)) {
    if (!existingColumns.includes(col)) {
        db.prepare(`ALTER TABLE guild_settings ADD COLUMN ${col} ${type}`).run();
        console.log(`[DB] Columna migrada (guild_settings): ${col}`);
    }
}

// ➕ Migración automática giveaways
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