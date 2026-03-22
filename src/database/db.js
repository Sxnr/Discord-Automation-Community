const Database = require('better-sqlite3');
const path = require('node:path');

const db = new Database(path.join(__dirname, 'database.sqlite'));

// Esta sentencia DEBE tener todas las columnas
db.prepare(`
    CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        welcome_channel TEXT,
        staff_role TEXT,
        ticket_log_channel TEXT,
        ticket_embed_msg TEXT,
        ticket_embed_image TEXT,
        ticket_welcome_msg TEXT,
        ticket_dm_preference INTEGER DEFAULT 1
    )
`).run();

module.exports = db;