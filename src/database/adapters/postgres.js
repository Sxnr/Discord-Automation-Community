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
                } finally {
                    client.release();
                }
            },

            async get(...params) {
                const client = await adapter._pool.connect();
                try {
                    const result = await client.query(pgSql, params);
                    return result.rows[0] || undefined;
                } finally {
                    client.release();
                }
            },

            async all(...params) {
                const client = await adapter._pool.connect();
                try {
                    const result = await client.query(pgSql, params);
                    return result.rows;
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

    exec(sql) {
        return this._pool.query(sql);
    }

    async close() {
        await this._pool.end();
    }

    async tableInfo(tableName) {
        const result = await this._pool.query(
            `SELECT column_name AS name, data_type AS type
             FROM information_schema.columns
             WHERE table_name = $1
             ORDER BY ordinal_position`,
            [tableName]
        );
        return result.rows;
    }

    async tableExists(tableName) {
        const result = await this._pool.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = $1
            )`,
            [tableName]
        );
        return result.rows[0]?.exists ?? false;
    }

    _convertPlaceholders(sql) {
        let idx = 0;
        return sql.replace(/\?/g, () => `$${++idx}`);
    }
}

module.exports = PostgresAdapter;
