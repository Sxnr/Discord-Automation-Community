// ═══════════════════════════════════════════════════════════════════════════
//  DATABASE ADAPTER LAYER
//  Detecta el motor configurado y expone una interfaz unificada.
//  - SQLite (default): sync, sin dependencias externas
//  - PostgreSQL: async, requiere DATABASE_URL
//
//  IMPORTANTE: Para PostgreSQL, todas las operaciones de DB son async.
//  El objeto db se inicializa de forma asíncrona y está listo cuando
//  el módulo termina de cargarse (via init promise).
// ═══════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const path = require('node:path');
const { transformQuery } = require('./transformer');

const DATABASE_URL = process.env.DATABASE_URL;
let adapter;

if (DATABASE_URL && DATABASE_URL.startsWith('postgres')) {
    const PostgresAdapter = require('./adapters/postgres');
    adapter = new PostgresAdapter(DATABASE_URL);
    console.log('[DB] 🐘 Conectado a PostgreSQL');
} else {
    const SqliteAdapter = require('./adapters/sqlite');
    const dbPath = process.env.SQLITE_PATH || path.join(__dirname, 'database.sqlite');
    adapter = new SqliteAdapter(dbPath);
    console.log('[DB] 🗄️ Conectado a SQLite:', dbPath);
}

// ══════════════════════════════════════════════════════════════════════════════
// WRAPPER: Interfaz unificada con transformación de queries
// ══════════════════════════════════════════════════════════════════════════════
const db = {
    engine: adapter.engine,

    prepare(sql) {
        const transformed = transformQuery(sql, adapter.engine);
        const stmt = adapter.prepare(transformed);
        return {
            run(...args)  { return stmt.run(...args); },
            get(...args)  { return stmt.get(...args); },
            all(...args)  { return stmt.all(...args); },
        };
    },

    transaction(fn) {
        return adapter.transaction(fn);
    },

    pragma(sql) {
        if (adapter.pragma) return adapter.pragma(sql);
    },

    exec(sql) {
        return adapter.exec(sql);
    },

    close() {
        return adapter.close();
    },

    tableInfo(tableName) {
        return adapter.tableInfo(tableName);
    },

    tableExists(tableName) {
        return adapter.tableExists(tableName);
    },
};


// ══════════════════════════════════════════════════════════════════════════════
// HELPER: Ejecutar operación sync o async según el motor
// ══════════════════════════════════════════════════════════════════════════════
function execSync(result) {
    // Si es Promise (PostgreSQL), extraemos el valor con .then
    // Pero como necesitamos sync para las migraciones de arranque,
    // usamos un approach diferente: para PostgreSQL usamos queries directas
    if (result && typeof result.then === 'function') {
        // Esto NO es ideal — ver initIIFE para el manejo correcto
        throw new Error('Async operation in sync context — use initIIFE');
    }
    return result;
}


// ══════════════════════════════════════════════════════════════════════════════
// SCHEMA + MIGRACIONES — Ejecutadas vía IIFE asíncrona
// Para PostgreSQL, todas las operaciones son await.
// Para SQLite, el await no afecta (ya retorna valores sync).
// ══════════════════════════════════════════════════════════════════════════════

const _schemaReady = (async () => {

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS guild_settings (
            guild_id TEXT PRIMARY KEY,
            welcome_channel TEXT,
            staff_role TEXT,
            prefix TEXT DEFAULT '/',
            ticket_log_channel TEXT,
            ticket_embed_msg TEXT,
            ticket_embed_image TEXT,
            ticket_welcome_msg TEXT,
            ticket_category TEXT,
            ticket_count INTEGER DEFAULT 0,
            ticket_types TEXT,
            ticket_dm_preference INTEGER DEFAULT 0,
            audit_log_channel TEXT,
            general_log_channel TEXT,
            automod_enabled INTEGER DEFAULT 0,
            automod_log_channel TEXT,
            automod_anti_spam INTEGER DEFAULT 0,
            automod_spam_limit INTEGER DEFAULT 5,
            automod_spam_interval INTEGER DEFAULT 5000,
            automod_anti_links INTEGER DEFAULT 0,
            automod_anti_invites INTEGER DEFAULT 0,
            automod_bad_words TEXT DEFAULT '[]',
            warn_mute_threshold INTEGER DEFAULT 3,
            warn_ban_threshold INTEGER DEFAULT 5,
            warn_mute_duration INTEGER DEFAULT 3600000,
            xp_enabled INTEGER DEFAULT 1,
            xp_channel TEXT,
            xp_ignored_channels TEXT DEFAULT '[]',
            xp_min INTEGER DEFAULT 15,
            xp_max INTEGER DEFAULT 25,
            xp_cooldown INTEGER DEFAULT 60,
            xp_multiplier REAL DEFAULT 1.0,
            xp_level_roles TEXT DEFAULT '{}',
            xp_levelup_msg TEXT DEFAULT '¡Felicitaciones {user}! 🎊 Has alcanzado el nivel **{level}**',
            xp_levelup_img TEXT,
            suggest_channel TEXT,
            suggest_log_channel TEXT,
            report_channel TEXT,
            report_cooldown INTEGER DEFAULT 300,
            welcome_message TEXT DEFAULT '¡Bienvenido {user} a {server}!',
            welcome_background TEXT,
            welcome_color TEXT DEFAULT '#5865F2',
            welcome_role TEXT,
            welcome_enabled INTEGER DEFAULT 1,
            birthday_channel TEXT,
            birthday_role TEXT,
            birthday_message TEXT DEFAULT '🎂 ¡Hoy es el cumpleaños de {user}! ¡Felicidades!',
            birthday_hour INTEGER DEFAULT 8,
            economy_enabled INTEGER DEFAULT 1,
            economy_currency TEXT DEFAULT 'coins',
            economy_currency_emoji TEXT DEFAULT '💰',
            economy_daily_amount INTEGER DEFAULT 200,
            economy_daily_streak_bonus INTEGER DEFAULT 50,
            economy_work_min INTEGER DEFAULT 50,
            economy_work_max INTEGER DEFAULT 200,
            economy_work_cooldown INTEGER DEFAULT 3600000,
            economy_crime_min INTEGER DEFAULT 100,
            economy_crime_max INTEGER DEFAULT 500,
            economy_crime_cooldown INTEGER DEFAULT 7200000,
            economy_crime_fail_pct INTEGER DEFAULT 35,
            economy_rob_enabled INTEGER DEFAULT 1,
            economy_log_channel TEXT,
            poll_channel TEXT,
            events_channel TEXT,
            events_log_channel TEXT,
            reminder_max INTEGER DEFAULT 10,
            rr_max_panels INTEGER DEFAULT 10,
            verify_enabled INTEGER DEFAULT 0,
            verify_role TEXT,
            verify_channel TEXT,
            verify_log_channel TEXT,
            verify_method TEXT DEFAULT 'button',
            verify_message TEXT DEFAULT 'Haz clic en el botón para verificarte.',
            verify_kick_unverified INTEGER DEFAULT 0,
            verify_kick_after INTEGER DEFAULT 86400000,
            starboard_enabled INTEGER DEFAULT 0,
            starboard_channel TEXT,
            starboard_threshold INTEGER DEFAULT 3,
            starboard_emoji TEXT DEFAULT '⭐',
            starboard_self_star INTEGER DEFAULT 0,
            starboard_nsfw INTEGER DEFAULT 0,
            music_volume INTEGER DEFAULT 100,
            music_dj_role TEXT,
            music_text_channel TEXT,
            music_max_queue INTEGER DEFAULT 100,
            music_247 INTEGER DEFAULT 0,
            music_autoplay INTEGER DEFAULT 0,
            music_filters_enabled INTEGER DEFAULT 1,
            music_announce INTEGER DEFAULT 1,
            music_leave_timeout INTEGER DEFAULT 300000
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS economy (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            wallet INTEGER DEFAULT 0,
            bank INTEGER DEFAULT 0,
            daily_streak INTEGER DEFAULT 0,
            last_daily INTEGER DEFAULT 0,
            last_work INTEGER DEFAULT 0,
            last_crime INTEGER DEFAULT 0,
            total_earned INTEGER DEFAULT 0,
            total_spent INTEGER DEFAULT 0,
            UNIQUE(guild_id, user_id)
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS levels (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 0,
            messages INTEGER DEFAULT 0,
            last_xp INTEGER DEFAULT 0,
            UNIQUE(guild_id, user_id)
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS profiles (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            bio TEXT DEFAULT '',
            color TEXT DEFAULT '#5865F2',
            banner_url TEXT,
            timezone TEXT DEFAULT 'UTC',
            fav_emoji TEXT DEFAULT '⭐',
            socials TEXT DEFAULT '{}',
            birthday_show INTEGER DEFAULT 1,
            UNIQUE(guild_id, user_id)
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS achievements (
            id SERIAL PRIMARY KEY,
            guild_id TEXT,
            key TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            emoji TEXT DEFAULT '🏆',
            condition TEXT NOT NULL,
            threshold INTEGER DEFAULT 1,
            secret INTEGER DEFAULT 0,
            global INTEGER DEFAULT 1,
            UNIQUE(guild_id, key)
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS user_achievements (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            achievement_key TEXT NOT NULL,
            unlocked_at INTEGER NOT NULL,
            UNIQUE(guild_id, user_id, achievement_key)
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS warns (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            moderator_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS mod_logs (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            moderator_id TEXT NOT NULL,
            action TEXT NOT NULL,
            reason TEXT NOT NULL,
            duration TEXT,
            timestamp INTEGER NOT NULL,
            active INTEGER DEFAULT 1
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS giveaways (
            message_id TEXT PRIMARY KEY,
            guild_id TEXT,
            channel_id TEXT,
            host_id TEXT,
            prize TEXT,
            winner_count INTEGER DEFAULT 1,
            end_time INTEGER,
            participants TEXT DEFAULT '[]',
            winners TEXT DEFAULT '[]',
            required_role TEXT,
            ended INTEGER DEFAULT 0
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS suggestions (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            message_id TEXT,
            author_id TEXT NOT NULL,
            content TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            reason TEXT,
            votes_up TEXT DEFAULT '[]',
            votes_down TEXT DEFAULT '[]',
            timestamp INTEGER NOT NULL
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS music_playlists (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            tracks TEXT NOT NULL DEFAULT '[]',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            UNIQUE(guild_id, user_id, name)
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS music_history (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            duration INTEGER DEFAULT 0,
            thumbnail TEXT,
            source TEXT DEFAULT 'youtube',
            played_at INTEGER NOT NULL
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS reminders (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            guild_id TEXT,
            channel_id TEXT NOT NULL,
            message TEXT NOT NULL,
            remind_at INTEGER NOT NULL,
            sent INTEGER DEFAULT 0,
            timestamp INTEGER,
            created_at INTEGER DEFAULT 0
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS polls (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            message_id TEXT,
            author_id TEXT NOT NULL,
            question TEXT NOT NULL,
            options TEXT NOT NULL DEFAULT '[]',
            votes TEXT NOT NULL DEFAULT '{}',
            voters TEXT NOT NULL DEFAULT '[]',
            ended INTEGER DEFAULT 0,
            ends_at INTEGER,
            created_at INTEGER NOT NULL
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS reports (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            channel_id TEXT,
            message_id TEXT,
            author_id TEXT NOT NULL,
            reported_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            handled_by TEXT,
            created_at INTEGER NOT NULL
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS server_events (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            channel_id TEXT,
            message_id TEXT,
            author_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            location TEXT,
            starts_at INTEGER NOT NULL,
            ends_at INTEGER,
            max_attendees INTEGER DEFAULT 0,
            attendees TEXT DEFAULT '[]',
            status TEXT DEFAULT 'upcoming',
            created_at INTEGER NOT NULL
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS starboard (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            original_msg_id TEXT NOT NULL,
            starboard_msg_id TEXT,
            channel_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            star_count INTEGER DEFAULT 0,
            UNIQUE(guild_id, original_msg_id)
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS birthdays (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            month INTEGER NOT NULL,
            day INTEGER NOT NULL,
            year INTEGER,
            notified INTEGER DEFAULT 0,
            UNIQUE(guild_id, user_id)
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS reaction_roles (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            emoji TEXT NOT NULL,
            role_id TEXT NOT NULL,
            UNIQUE(guild_id, message_id, emoji)
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS shop_items (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            price INTEGER NOT NULL,
            emoji TEXT DEFAULT '🛍️',
            role_id TEXT,
            stock INTEGER DEFAULT -1,
            type TEXT DEFAULT 'item',
            available INTEGER DEFAULT 1,
            timestamp INTEGER,
            UNIQUE(guild_id, name)
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS inventory (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            quantity INTEGER DEFAULT 1,
            UNIQUE(guild_id, user_id, item_id)
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            amount INTEGER NOT NULL,
            detail TEXT,
            timestamp INTEGER NOT NULL
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS pets (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            emoji TEXT,
            hunger INTEGER DEFAULT 100,
            happiness INTEGER DEFAULT 100,
            health INTEGER DEFAULT 100,
            energy INTEGER DEFAULT 100,
            level INTEGER DEFAULT 1,
            xp INTEGER DEFAULT 0,
            last_feed INTEGER DEFAULT 0,
            last_play INTEGER DEFAULT 0,
            last_sleep INTEGER DEFAULT 0,
            last_heal INTEGER DEFAULT 0,
            alive INTEGER DEFAULT 1,
            born_at INTEGER NOT NULL,
            UNIQUE(guild_id, user_id)
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS trivia_stats (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            correct INTEGER DEFAULT 0,
            wrong INTEGER DEFAULT 0,
            streak INTEGER DEFAULT 0,
            best_streak INTEGER DEFAULT 0,
            UNIQUE(guild_id, user_id)
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS verifications (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            method TEXT,
            code TEXT,
            attempts INTEGER DEFAULT 0,
            verified_at INTEGER,
            timestamp INTEGER,
            UNIQUE(guild_id, user_id)
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS reaction_role_panels (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            title TEXT,
            description TEXT,
            color TEXT DEFAULT '#5865F2',
            mode TEXT DEFAULT 'single',
            timestamp INTEGER,
            UNIQUE(guild_id, message_id)
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS trivia_questions (
            id SERIAL PRIMARY KEY,
            guild_id TEXT NOT NULL,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            options TEXT NOT NULL,
            category TEXT DEFAULT '💰 General',
            difficulty TEXT DEFAULT 'medium',
            global INTEGER DEFAULT 0
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS votes (
            user_id TEXT PRIMARY KEY,
            guild_id TEXT,
            last_vote INTEGER DEFAULT 0,
            total INTEGER DEFAULT 0,
            streak INTEGER DEFAULT 0
        )
    `).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS command_stats (
            guild_id TEXT,
            command TEXT,
            user_id TEXT,
            used_at INTEGER
        )
    `).run();

    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_cmdstats_guild ON command_stats(guild_id, used_at)`).run();

    await db.prepare(`
        CREATE TABLE IF NOT EXISTS ai_mod_settings (
            guild_id TEXT PRIMARY KEY,
            enabled INTEGER DEFAULT 0,
            log_channel TEXT,
            action TEXT DEFAULT 'log',
            threshold REAL DEFAULT 0.7,
            ignore_roles TEXT DEFAULT '[]'
        )
    `).run();


    // ════════════════════════════════════════════════════════════════════════
    // MIGRACIONES DINÁMICAS
    // ════════════════════════════════════════════════════════════════════════
    async function migrateTable(tableName, columns) {
        let existingCols;
        if (db.engine === 'postgresql') {
            const rows = await db.tableInfo(tableName);
            existingCols = rows.map(c => c.name);
        } else {
            const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
            existingCols = rows.map(c => c.name);
        }

        for (const [col, type] of Object.entries(columns)) {
            if (!existingCols.includes(col)) {
                try {
                    await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${col} ${type}`).run();
                    console.log(`[DB] Migración: Columna '${col}' añadida a '${tableName}'`);
                } catch (e) {
                    console.error(`[DB] Error migrando '${col}' en '${tableName}':`, e.message);
                }
            }
        }
    }

    await migrateTable('reports', { channel_id: 'TEXT', message_id: 'TEXT' });
    await migrateTable('reminders', { sent: 'INTEGER DEFAULT 0', timestamp: 'INTEGER' });
    await migrateTable('birthdays', { notified: 'INTEGER DEFAULT 0' });
    await migrateTable('server_events', { location: 'TEXT', ends_at: 'INTEGER' });

    await migrateTable('guild_settings', {
        xp_enabled: 'INTEGER DEFAULT 1',
        economy_enabled: 'INTEGER DEFAULT 1',
        starboard_emoji: "TEXT DEFAULT '⭐'",
        music_volume: 'INTEGER DEFAULT 100',
        music_dj_role: 'TEXT',
        music_text_channel: 'TEXT',
        music_max_queue: 'INTEGER DEFAULT 100',
        music_247: 'INTEGER DEFAULT 0',
        music_autoplay: 'INTEGER DEFAULT 0',
        music_filters_enabled: 'INTEGER DEFAULT 1',
        music_announce: 'INTEGER DEFAULT 1',
        music_leave_timeout: 'INTEGER DEFAULT 300000',
        language: "TEXT DEFAULT 'es'"
    });

    // ── Migraciones de compatibilidad (shop, inventory) ────────────────────
    async function tableExistsLocal(name) {
        if (db.engine === 'postgresql') {
            return await db.tableExists(name);
        }
        return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
    }

    if (await tableExistsLocal('shop_items')) {
        let shopCols;
        if (db.engine === 'postgresql') {
            shopCols = (await db.tableInfo('shop_items')).map(c => c.name);
        } else {
            shopCols = db.prepare('PRAGMA table_info(shop_items)').all().map(c => c.name);
        }
        if (shopCols.includes('created_at')) {
            await db.prepare('ALTER TABLE shop_items RENAME TO shop_items_old').run();
            console.log('[DB] Migración: shop_items con esquema obsoleto respaldada');
        }
    }
    if (!(await tableExistsLocal('shop_items'))) {
        await db.prepare(`
            CREATE TABLE shop_items (
                id SERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                price INTEGER NOT NULL,
                emoji TEXT DEFAULT '🛍️',
                role_id TEXT,
                type TEXT DEFAULT 'item',
                stock INTEGER DEFAULT -1,
                available INTEGER DEFAULT 1,
                timestamp INTEGER,
                UNIQUE(guild_id, name)
            )
        `).run();
    }
    if (await tableExistsLocal('shop')) {
        await db.prepare(`
            INSERT INTO shop_items (guild_id, name, description, price, emoji, role_id, stock)
            SELECT guild_id, name, description, price, emoji, role_id, stock FROM shop
            ON CONFLICT DO NOTHING
        `).run();
        await db.prepare('DROP TABLE shop').run();
        console.log('[DB] Migración: datos de "shop" movidos a "shop_items"');
    }
    await migrateTable('shop_items', {
        type: "TEXT DEFAULT 'item'",
        available: 'INTEGER DEFAULT 1',
        timestamp: 'INTEGER',
    });

    if (await tableExistsLocal('inventory')) {
        let invCols;
        if (db.engine === 'postgresql') {
            invCols = (await db.tableInfo('inventory')).map(c => c.name);
        } else {
            invCols = db.prepare('PRAGMA table_info(inventory)').all().map(c => c.name);
        }
        if (!invCols.includes('item_id')) {
            await db.prepare('ALTER TABLE inventory RENAME TO inventory_old').run();
            await db.prepare(`
                CREATE TABLE inventory (
                    id SERIAL PRIMARY KEY,
                    guild_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    item_id INTEGER NOT NULL,
                    quantity INTEGER DEFAULT 1,
                    UNIQUE(guild_id, user_id, item_id)
                )
            `).run();
            console.log('[DB] Migración: "inventory" recreada con columna "item_id"');
        }
    }

    console.log('[DB] ✅ Schema y migraciones completadas');

})();


// ══════════════════════════════════════════════════════════════════════════════
// EXPORT: db + promise de inicialización
// ══════════════════════════════════════════════════════════════════════════════
db.ready = _schemaReady;

module.exports = db;
