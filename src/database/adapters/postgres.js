// ═══════════════════════════════════════════════════════════════════════════
//  ADAPTADOR PostgreSQL — Interfaz compatible con better-sqlite3
//  Usa pg Pool con conversión de placeholders (? → $1, $2, ...)
//  Soporta transacciones con cliente dedicado y RETURNING para INSERTs.
// ═══════════════════════════════════════════════════════════════════════════

const { Pool } = require('pg');

class PostgresAdapter {
    constructor(connectionString) {
        this._pool = new Pool({
            connectionString,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });
        this.engine = 'postgresql';
        // Cliente dedicado para transacciones (se asigna durante transaction())
        this._txClient = null;
    }

    // ── Conversión de placeholders: ? → $1, $2, ... ──────────────────────
    _convertPlaceholders(sql) {
        let idx = 0;
        return sql.replace(/\?/g, () => `$${++idx}`);
    }

    // ── Detecta si un INSERT necesita RETURNING id ───────────────────────
    _needsReturning(sql) {
        return /^\s*INSERT\s+INTO\s+/i.test(sql) &&
               !/RETURNING/i.test(sql) &&
               !/ON\s+CONFLICT/i.test(sql);
    }

    // ── Interfaz compatible con better-sqlite3 ────────────────────────────
    prepare(rawSql) {
        const adapter = this;

        // Agregar RETURNING id si es un INSERT simple (sin ON CONFLICT)
        let pgSql;
        if (this._needsReturning(rawSql)) {
            pgSql = this._convertPlaceholders(rawSql.replace(/;?\s*$/, '')) + ' RETURNING id';
        } else {
            pgSql = this._convertPlaceholders(rawSql);
        }

        return {
            async run(...params) {
                // Si hay un cliente de transacción activo, usarlo
                const client = adapter._txClient || await adapter._pool.connect();
                const mustRelease = !adapter._txClient;
                try {
                    const result = await client.query(pgSql, params);
                    return {
                        changes: result.rowCount,
                        lastInsertRowid: result.rows?.[0]?.id ?? null,
                    };
                } catch (err) {
                    if (err.code === '42P01') {
                        return { changes: 0, lastInsertRowid: null };
                    }
                    throw err;
                } finally {
                    if (mustRelease) client.release();
                }
            },

            async get(...params) {
                const client = adapter._txClient || await adapter._pool.connect();
                const mustRelease = !adapter._txClient;
                try {
                    const result = await client.query(pgSql, params);
                    return result.rows[0] || undefined;
                } catch (err) {
                    if (err.code === '42P01') return undefined;
                    throw err;
                } finally {
                    if (mustRelease) client.release();
                }
            },

            async all(...params) {
                const client = adapter._txClient || await adapter._pool.connect();
                const mustRelease = !adapter._txClient;
                try {
                    const result = await client.query(pgSql, params);
                    return result.rows;
                } catch (err) {
                    if (err.code === '42P01') return [];
                    throw err;
                } finally {
                    if (mustRelease) client.release();
                }
            },
        };
    }

    // ── Transacción: usa cliente dedicado para todas las operaciones ──────
    transaction(fn) {
        const adapter = this;
        return async function () {
            const client = await adapter._pool.connect();
            try {
                adapter._txClient = client;
                await client.query('BEGIN');
                const result = await fn();
                await client.query('COMMIT');
                return result;
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                adapter._txClient = null;
                client.release();
            }
        };
    }

    pragma() { /* noop en PostgreSQL */ }

    async exec(sql) {
        try {
            await this._pool.query(sql);
        } catch (err) {
            if (err.code === '42P01') return;
            throw err;
        }
    }

    async close() {
        await this._pool.end();
    }

    async tableInfo(tableName) {
        try {
            const result = await this._pool.query(
                `SELECT column_name AS name, data_type AS type
                 FROM information_schema.columns
                 WHERE table_name = $1
                 ORDER BY ordinal_position`,
                [tableName]
            );
            return result.rows;
        } catch {
            return [];
        }
    }

    async tableExists(tableName) {
        try {
            const result = await this._pool.query(
                `SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_name = $1
                )`,
                [tableName]
            );
            return result.rows[0]?.exists ?? false;
        } catch {
            return false;
        }
    }
}

module.exports = PostgresAdapter;
