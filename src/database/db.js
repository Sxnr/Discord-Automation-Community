const Database = require('better-sqlite3');
const path = require('node:path');

const db = new Database(path.join(__dirname, 'database.sqlite'));

// Tabla base con TODAS las columnas
db.prepare(`
    CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id            TEXT PRIMARY KEY,
        welcome_channel     TEXT,
        staff_role          TEXT,
        prefix              TEXT DEFAULT '/',
        ticket_log_channel  TEXT,
        ticket_embed_msg    TEXT,
        ticket_embed_image  TEXT,
        ticket_welcome_msg  TEXT,
        audit_log_channel   TEXT,
        general_log_channel TEXT
    )
`).run();

// Migración automática: agrega columnas faltantes sin borrar datos
const existingColumns = db.prepare("PRAGMA table_info(guild_settings)").all().map(c => c.name);
const requiredColumns = {
    ticket_log_channel:  'TEXT',
    ticket_embed_msg:    'TEXT',
    ticket_embed_image:  'TEXT',
    ticket_welcome_msg:  'TEXT',
    audit_log_channel:   'TEXT',
    general_log_channel: 'TEXT'
};

for (const [col, type] of Object.entries(requiredColumns)) {
    if (!existingColumns.includes(col)) {
        db.prepare(`ALTER TABLE guild_settings ADD COLUMN ${col} ${type}`).run();
        console.log(`[DB] Columna migrada: ${col}`);
    }
}

module.exports = db;