// ═══════════════════════════════════════════════════════════════════════════
//  QUERY TRANSFORMER — Convierte SQL incompatible entre motores
//  SQLite → PostgreSQL: AUTOINCREMENT → SERIAL, INSERT OR IGNORE, etc.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convierte un query SQLite al dialecto del motor especificado.
 * @param {string} sql - Query original (sintaxis SQLite)
 * @param {'sqlite'|'postgresql'} engine - Motor de destino
 * @returns {string} Query transformado
 */
function transformQuery(sql, engine) {
    if (engine === 'sqlite') return sql;

    // ── INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY ────────────
    sql = sql.replace(
        /INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi,
        'SERIAL PRIMARY KEY'
    );

    // ── INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING ──────────────
    if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql)) {
        sql = sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+/gi, 'INSERT INTO ');
        if (!/ON\s+CONFLICT/i.test(sql)) {
            sql = sql.trimEnd().replace(/;?\s*$/, '') + ' ON CONFLICT DO NOTHING';
        }
    }

    // ── INSERT OR REPLACE → INSERT ... ON CONFLICT DO UPDATE ──────────────
    if (/INSERT\s+OR\s+REPLACE\s+INTO/i.test(sql)) {
        sql = sql.replace(/INSERT\s+OR\s+REPLACE\s+INTO\s+/gi, 'INSERT INTO ');
        // Agregar ON CONFLICT DO UPDATE si no existe
        if (!/ON\s+CONFLICT/i.test(sql)) {
            sql = sql.trimEnd().replace(/;?\s*$/, '') +
                ' ON CONFLICT (guild_id) DO UPDATE SET guild_id = EXCLUDED.guild_id';
        }
    }

    // ── strftime('%s', 'now') → EXTRACT(EPOCH FROM NOW())::INTEGER ───────
    sql = sql.replace(
        /strftime\('%s',\s*'now'\)/gi,
        "(EXTRACT(EPOCH FROM NOW())::INTEGER)"
    );

    // ── IF NOT EXISTS para CREATE INDEX ya funciona en PostgreSQL ─────────
    // (no necesita transformación)

    // ── PRAGMA table_info → information_schema (se maneja en adapter) ────
    // Los queries PRAGMA se interceptan directamente en el adapter

    return sql;
}

module.exports = { transformQuery };
