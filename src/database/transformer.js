// ═══════════════════════════════════════════════════════════════════════════
//  QUERY TRANSFORMER — Convierte SQL incompatible entre motores
//  - SQLite → PostgreSQL: INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convierte un query SQLite al dialecto del motor especificado.
 * @param {string} sql - Query original (sintaxis SQLite)
 * @param {'sqlite'|'postgresql'} engine - Motor de destino
 * @returns {string} Query transformado
 */
function transformQuery(sql, engine) {
    if (engine === 'sqlite') return sql;

    // ── INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING ──────────────
    // Patrón: INSERT OR IGNORE INTO table (cols) VALUES (vals)
    // Resultado: INSERT INTO table (cols) VALUES (vals) ON CONFLICT DO NOTHING
    const insertOrIgnoreRegex = /INSERT\s+OR\s+IGNORE\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi;

    if (insertOrIgnoreRegex.test(sql)) {
        sql = sql.replace(
            /INSERT\s+OR\s+IGNORE\s+INTO\s+/gi,
            'INSERT INTO '
        );
        // Agregar ON CONFLICT DO NOTHING al final si no existe ya
        if (!/ON\s+CONFLICT/i.test(sql)) {
            sql = sql.trimEnd().replace(/;?\s*$/, '') + ' ON CONFLICT DO NOTHING';
        }
    }

    return sql;
}

module.exports = { transformQuery };
