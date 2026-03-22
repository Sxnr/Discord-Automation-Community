const Database = require('better-sqlite3');
const path = require('node:path');

// Creamos o abrimos el archivo de la base de datos
const db = new Database(path.join(__dirname, 'database.sqlite'));

// Creamos la tabla de configuraciones si no existe
db.prepare(`
    CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        welcome_channel TEXT,
        staff_role TEXT,
        ticket_log_channel TEXT,
        ticket_embed_msg TEXT,
        ticket_embed_image TEXT,
        ticket_welcome_msg TEXT
    )
`).run();

module.exports = db;