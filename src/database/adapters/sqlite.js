// ═══════════════════════════════════════════════════════════════════════════
//  ADAPTADOR SQLite — Envuelve better-sqlite3 con la interfaz del adapter
// ═══════════════════════════════════════════════════════════════════════════

const Database = require('better-sqlite3');
const path = require('node:path');

class SqliteAdapter {
    constructor(dbPath) {
        this._db = new Database(dbPath);
        this._db.pragma('journal_mode = WAL');
        this.engine = 'sqlite';
    }

    prepare(sql) {
        const stmt = this._db.prepare(sql);
        const adapter = this;

        return {
            run(...params) {
                return stmt.run(...params);
            },
            get(...params) {
                return stmt.get(...params);
            },
            all(...params) {
                return stmt.all(...params);
            },
        };
    }

    transaction(fn) {
        return this._db.transaction(fn);
    }

    pragma(sql) {
        return this._db.pragma(sql);
    }

    exec(sql) {
        return this._db.exec(sql);
    }

    close() {
        return this._db.close();
    }

    // Compatibilidad: information_schema para reemplazar PRAGMA table_info
    tableInfo(tableName) {
        const rows = this._db.prepare(`PRAGMA table_info(${tableName})`).all();
        return rows.map(r => ({ name: r.name, type: r.type }));
    }

    tableExists(tableName) {
        const row = this._db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
        ).get(tableName);
        return !!row;
    }
}

module.exports = SqliteAdapter;
