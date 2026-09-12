// ═══════════════════════════════════════════════════════════════════════════
//  QUERY TRANSFORMER — Convierte SQL incompatible entre motores
//  SQLite → PostgreSQL: AUTOINCREMENT → SERIAL, timestamps → BIGINT, etc.
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

    // ── Columnas de timestamp: INTEGER → BIGINT ──────────────────────────
    // PostgreSQL INTEGER es 32-bit (~2.1B max). Timestamps en ms son ~13 dígitos.
    // Detecta columnas tipo timestamp por nombre: *_at, *_time, last_*, born_*
    const timestampPatterns = [
        /(\w+_at)\s+INTEGER/gi,
        /(\w+_time)\s+INTEGER/gi,
        /(last_\w+)\s+INTEGER/gi,
        /(born_\w+)\s+INTEGER/gi,
        /(ends_at)\s+INTEGER/gi,
        /(starts_at)\s+INTEGER/gi,
        /(created_at)\s+INTEGER/gi,
        /(remind_at)\s+INTEGER/gi,
        /(unlocked_at)\s+INTEGER/gi,
        /(verified_at)\s+INTEGER/gi,
        /(played_at)\s+INTEGER/gi,
        /(end_time)\s+INTEGER/gi,
    ];

    for (const pattern of timestampPatterns) {
        sql = sql.replace(pattern, '$1 BIGINT');
    }

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
        if (!/ON\s+CONFLICT/i.test(sql)) {
            sql = sql.trimEnd().replace(/;?\s*$/, '') +
                ' ON CONFLICT (guild_id) DO UPDATE SET guild_id = EXCLUDED.guild_id';
        }
    }

    // ── strftime('%s', 'now') → EXTRACT(EPOCH FROM NOW())::BIGINT ────────
    sql = sql.replace(
        /strftime\('%s',\s*'now'\)/gi,
        "(EXTRACT(EPOCH FROM NOW())::BIGINT)"
    );

    return sql;
}

module.exports = { transformQuery };
