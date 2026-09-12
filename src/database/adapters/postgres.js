// ═══════════════════════════════════════════════════════════════════════════
//  ADAPTADOR PostgreSQL — Implementa la interfaz del adapter usando pg
//  NOTA: Este adaptador es ASÍNCRONO. Para migrar de SQLite a PostgreSQL,
//  los archivos que usan db.prepare().run() necesitan ser convertidos a async.
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
    }

    // ── Interfaz compatible con better-sqlite3 ──────────────────────────────
    // better-sqlite3 usa `?` como placeholder. PostgreSQL usa $1, $2, etc.
    // Si la tabla no existe, retorna valores por defecto en vez de lanzar error.

    prepare(rawSql) {
        const adapter = this;
        const pgSql = this._convertPlaceholders(rawSql);

        return {
            async run(...params) {
                const client = await adapter._pool.connect();
                try {
                    const result = await client.query(pgSql, params);
                    return {
                        changes: result.rowCount,
                        lastInsertRowid: result.rows?.[0]?.id ?? null,
                    };
                } catch (err) {
                    // Si la tabla no existe, retorna cambio 0 en vez de crashear
                    if (err.code === '42P01') {
                        return { changes: 0, lastInsertRowid: null };
                    }
                    throw err;
                } finally {
                    client.release();
                }
            },

            async get(...params) {
                const client = await adapter._pool.connect();
                try {
                    const result = await client.query(pgSql, params);
                    return result.rows[0] || undefined;
                } catch (err) {
                    if (err.code === '42P01') return undefined;
                    throw err;
                } finally {
                    client.release();
                }
            },

            async all(...params) {
                const client = await adapter._pool.connect();
                try {
                    const result = await client.query(pgSql, params);
                    return result.rows;
                } catch (err) {
                    if (err.code === '42P01') return [];
                    throw err;
                } finally {
                    client.release();
                }
            },
        };
    }

    // Transacción: ejecuta un callback con un cliente único
    transaction(fn) {
        return async () => {
            const client = await this._pool.connect();
            try {
                await client.query('BEGIN');
                const result = await fn(client);
                await client.query('COMMIT');
                return result;
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        };
    }

    pragma() { /* noop en PostgreSQL */ }

    async exec(sql) {
        try {
            await this._pool.query(sql);
        } catch (err) {
            if (err.code === '42P01') return; // tabla no existe aún
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

    _convertPlaceholders(sql) {
        let idx = 0;
        return sql.replace(/\?/g, () => `$${++idx}`);
    }
}

module.exports = PostgresAdapter;
