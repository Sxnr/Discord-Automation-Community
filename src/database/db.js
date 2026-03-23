const Database = require('better-sqlite3');
const path = require('node:path');

const db = new Database(path.join(__dirname, 'database.sqlite'));

// 1. Crear la tabla base si no existe
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

// 2. MIGRACIÓN MANUAL: Intentar añadir la columna nueva si no existe
try {
    db.prepare("ALTER TABLE guild_settings ADD COLUMN ticket_dm_preference INTEGER DEFAULT 1").run();
    console.log("✅ Columna 'ticket_dm_preference' añadida correctamente.");
} catch (error) {
    // Si el error es porque la columna ya existe, simplemente lo ignoramos
    if (!error.message.includes("duplicate column name")) {
        console.error("Error en migración:", error);
    }
}

module.exports = db;