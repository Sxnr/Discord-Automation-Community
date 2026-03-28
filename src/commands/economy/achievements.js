const {
    SlashCommandBuilder, EmbedBuilder,
    PermissionFlagsBits, MessageFlags
} = require('discord.js');
const db = require('../../database/db');

// ── Logros globales predefinidos ───────────────────────────────────────────
const GLOBAL_ACHIEVEMENTS = [
    // Economía
    { key: 'first_daily',       name: 'Primer Daily',         emoji: '📅', description: 'Reclama tu primer daily.',                    condition: 'daily_count',    threshold: 1    },
    { key: 'daily_7',           name: 'Semana Constante',     emoji: '🔥', description: 'Reclama el daily 7 días seguidos.',           condition: 'daily_streak',   threshold: 7    },
    { key: 'daily_30',          name: 'Mes de Fuego',         emoji: '🌋', description: 'Reclama el daily 30 días seguidos.',          condition: 'daily_streak',   threshold: 30   },
    { key: 'rich_1k',           name: 'Mil Monedas',          emoji: '💵', description: 'Acumula 1.000 coins en total.',               condition: 'total_earned',   threshold: 1000  },
    { key: 'rich_10k',          name: 'Diez de los Grandes',  emoji: '💴', description: 'Acumula 10.000 coins en total.',              condition: 'total_earned',   threshold: 10000 },
    { key: 'rich_100k',         name: 'Millonario',           emoji: '💎', description: 'Acumula 100.000 coins en total.',             condition: 'total_earned',   threshold: 100000},
    { key: 'first_buy',         name: 'Primera Compra',       emoji: '🛒', description: 'Compra algo en la tienda.',                   condition: 'buy_count',      threshold: 1    },
    { key: 'big_spender',       name: 'Gran Gastador',        emoji: '💸', description: 'Gasta 50.000 coins en total.',                condition: 'total_spent',    threshold: 50000 },
    { key: 'work_10',           name: 'Trabajador',           emoji: '💼', description: 'Trabaja 10 veces.',                           condition: 'work_count',     threshold: 10   },
    { key: 'work_100',          name: 'Obrero Incansable',    emoji: '⚙️', description: 'Trabaja 100 veces.',                          condition: 'work_count',     threshold: 100  },
    { key: 'crime_10',          name: 'Delincuente',          emoji: '🔫', description: 'Comete 10 crímenes.',                         condition: 'crime_count',    threshold: 10   },
    { key: 'rob_5',             name: 'Ladrón Profesional',   emoji: '🦹', description: 'Roba exitosamente a 5 personas.',             condition: 'rob_win_count',  threshold: 5    },

    // XP / Niveles
    { key: 'level_5',           name: 'En Camino',            emoji: '⚡', description: 'Alcanza el nivel 5.',                         condition: 'level',          threshold: 5    },
    { key: 'level_10',          name: 'Nivel 10',             emoji: '🌟', description: 'Alcanza el nivel 10.',                        condition: 'level',          threshold: 10   },
    { key: 'level_25',          name: 'Veterano',             emoji: '🏅', description: 'Alcanza el nivel 25.',                        condition: 'level',          threshold: 25   },
    { key: 'level_50',          name: 'Leyenda',              emoji: '👑', description: 'Alcanza el nivel 50.',                        condition: 'level',          threshold: 50   },
    { key: 'msg_100',           name: 'Charlatán',            emoji: '💬', description: 'Envía 100 mensajes.',                         condition: 'messages',       threshold: 100  },
    { key: 'msg_1000',          name: 'Locutor Oficial',      emoji: '📢', description: 'Envía 1.000 mensajes.',                       condition: 'messages',       threshold: 1000 },
    { key: 'msg_10000',         name: 'No Para de Hablar',    emoji: '🗣️', description: 'Envía 10.000 mensajes.',                     condition: 'messages',       threshold: 10000},

    // Trivia
    { key: 'trivia_first',      name: 'Primer Trivia',        emoji: '❓', description: 'Responde bien tu primera trivia.',            condition: 'trivia_correct', threshold: 1    },
    { key: 'trivia_10',         name: 'Sabelotodo',           emoji: '🧠', description: 'Responde correctamente 10 trivias.',          condition: 'trivia_correct', threshold: 10   },
    { key: 'trivia_50',         name: 'Enciclopedia Humana',  emoji: '📚', description: 'Responde correctamente 50 trivias.',          condition: 'trivia_correct', threshold: 50   },
    { key: 'trivia_streak_5',   name: 'Racha Trivia x5',      emoji: '🔥', description: 'Acierta 5 trivias seguidas.',                 condition: 'trivia_streak',  threshold: 5    },
    { key: 'trivia_streak_10',  name: 'Mente Brillante',      emoji: '✨', description: 'Acierta 10 trivias seguidas.',                condition: 'trivia_streak',  threshold: 10   },

    // Mascota
    { key: 'pet_adopted',       name: 'Adoptante',            emoji: '🐾', description: 'Adopta tu primera mascota.',                  condition: 'has_pet',        threshold: 1    },
    { key: 'pet_level_10',      name: 'Entrenador Experto',   emoji: '🏋️', description: 'Sube a tu mascota al nivel 10.',             condition: 'pet_level',      threshold: 10   },
    { key: 'pet_level_25',      name: 'Maestro Pokémon',      emoji: '🎖️', description: 'Sube a tu mascota al nivel 25.',             condition: 'pet_level',      threshold: 25   },

    // Participación
    { key: 'vote_10',           name: 'Ciudadano Activo',     emoji: '🗳️', description: 'Vota en 10 encuestas.',                      condition: 'poll_votes',     threshold: 10   },
    { key: 'suggest_accepted',  name: 'Buen Ideólogo',        emoji: '💡', description: 'Que una de tus sugerencias sea aceptada.',     condition: 'suggest_accept', threshold: 1    },

    // Secretos
    { key: 'early_bird',        name: '¿Quién Madruga?',      emoji: '🐦', description: '???',                                         condition: 'early_bird',     threshold: 1,   secret: 1 },
    { key: 'night_owl',         name: 'Búho de la Noche',     emoji: '🦉', description: '???',                                         condition: 'night_owl',      threshold: 1,   secret: 1 },
];

// ── Seed logros globales ───────────────────────────────────────────────────
function seedGlobalAchievements() {
    // 1. Limpiamos los globales existentes para evitar que se acumulen duplicados de sesiones anteriores
    db.prepare('DELETE FROM achievements WHERE global = 1').run();

    // 2. Preparamos la inserción limpia
    const insert = db.prepare(`
        INSERT OR IGNORE INTO achievements
        (guild_id, key, name, description, emoji, condition, threshold, secret, global)
        VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const insertMany = db.transaction(() => {
        for (const a of GLOBAL_ACHIEVEMENTS) {
            insert.run(a.key, a.name, a.description, a.emoji, a.condition, a.threshold, a.secret || 0);
        }
    });

    insertMany();
    console.log(`✅ Se han sincronizado ${GLOBAL_ACHIEVEMENTS.length} logros globales.`);
}

seedGlobalAchievements();

// ── Unlock helper (llamado desde otros módulos) ────────────────────────────
function checkAndUnlock(guildId, userId, condition, value, client = null) {
    const candidates = db.prepare(`
        SELECT * FROM achievements
        WHERE condition = ? AND threshold <= ? AND (guild_id = ? OR global = 1)
    `).all(condition, value, guildId);

    for (const achv of candidates) {
        const already = db.prepare(`
            SELECT id FROM user_achievements
            WHERE guild_id = ? AND user_id = ? AND achievement_key = ?
        `).get(guildId, userId, achv.key);

        if (!already) {
            db.prepare(`
                INSERT INTO user_achievements (guild_id, user_id, achievement_key, unlocked_at)
                VALUES (?, ?, ?, ?)
            `).run(guildId, userId, achv.key, Date.now());

            // Notificar al usuario via DM si hay client disponible
            if (client) {
                client.users.fetch(userId).then(user => {
                    user.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#FFD700')
                            .setTitle(`🏆 ¡Nuevo logro desbloqueado!`)
                            .setDescription(
                                achv.secret
                                    ? `${achv.emoji} **${achv.name}**\n_Logro secreto revelado_`
                                    : `${achv.emoji} **${achv.name}**\n${achv.description}`
                            )
                            .setFooter({ text: 'Revisa tus logros con /achievements list' })
                            .setTimestamp()
                        ]
                    }).catch(() => null);
                }).catch(() => null);
            }
        }
    }
}

module.exports.checkAndUnlock = checkAndUnlock;

// ══════════════════════════════════════════════════════════════════════════════
module.exports = {
    ...module.exports,
    category: 'economy',
    data: new SlashCommandBuilder()
        .setName('achievements')
        .setDescription('🏆 Sistema de logros y badges.')

        // list
        .addSubcommand(s => s
            .setName('list')
            .setDescription('Ver todos los logros disponibles.')
            .addStringOption(o => o
                .setName('filtro')
                .setDescription('Filtrar por estado')
                .addChoices(
                    { name: '✅ Desbloqueados', value: 'unlocked' },
                    { name: '🔒 Bloqueados',    value: 'locked'   },
                    { name: '📋 Todos',         value: 'all'      },
                )
            )
            .addIntegerOption(o => o.setName('pagina').setDescription('Página').setMinValue(1))
        )
        // stats
        .addSubcommand(s => s
            .setName('stats')
            .setDescription('Ver tu progreso de logros.')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario a consultar'))
        )
        // leaderboard
        .addSubcommand(s => s
            .setName('leaderboard')
            .setDescription('Ranking de logros del servidor.')
        )
        // create (Admin)
        .addSubcommand(s => s
            .setName('create')
            .setDescription('[Admin] Crear un logro personalizado para el servidor.')
            .addStringOption(o => o.setName('key').setDescription('Identificador único').setRequired(true).setMaxLength(30))
            .addStringOption(o => o.setName('nombre').setDescription('Nombre del logro').setRequired(true).setMaxLength(50))
            .addStringOption(o => o.setName('descripcion').setDescription('Descripción').setRequired(true).setMaxLength(150))
            .addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(true))
            .addStringOption(o => o
                .setName('condicion')
                .setDescription('Condición de desbloqueo automático')
                .addChoices(
                    { name: 'Total ganado (coins)',  value: 'total_earned'   },
                    { name: 'Nivel XP',              value: 'level'          },
                    { name: 'Mensajes enviados',     value: 'messages'       },
                    { name: 'Trivias correctas',     value: 'trivia_correct' },
                    { name: 'Racha trivia',          value: 'trivia_streak'  },
                    { name: 'Manual (solo admin)',   value: 'manual'         },
                )
            )
            .addIntegerOption(o => o.setName('umbral').setDescription('Valor requerido para desbloquear').setMinValue(1))
            .addBooleanOption(o => o.setName('secreto').setDescription('¿Logro secreto?'))
        )
        // delete (Admin)
        .addSubcommand(s => s
            .setName('delete')
            .setDescription('[Admin] Eliminar un logro personalizado.')
            .addStringOption(o => o.setName('key').setDescription('Key del logro').setRequired(true))
        )
        // grant (Admin)
        .addSubcommand(s => s
            .setName('grant')
            .setDescription('[Admin] Otorgar un logro a un usuario.')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
            .addStringOption(o => o.setName('key').setDescription('Key del logro').setRequired(true))
        )
        // revoke (Admin)
        .addSubcommand(s => s
            .setName('revoke')
            .setDescription('[Admin] Quitar un logro a un usuario.')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
            .addStringOption(o => o.setName('key').setDescription('Key del logro').setRequired(true))
        ),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const userId  = interaction.user.id;

        // ══════════════════════════════════════════════════════════════════
        // LIST
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'list') {
            const filtro   = interaction.options.getString('filtro') || 'all';
            const page     = (interaction.options.getInteger('pagina') || 1) - 1;
            const pageSize = 8;

            // Todos los logros disponibles en el servidor
            const allAchvs = db.prepare(`
                SELECT * FROM achievements WHERE guild_id IS NULL OR guild_id = ?
                ORDER BY global DESC, key ASC
            `).all(guildId);

            // Los que el usuario ya desbloqueó
            const unlockedKeys = new Set(
                db.prepare('SELECT achievement_key FROM user_achievements WHERE guild_id = ? AND user_id = ?')
                    .all(guildId, userId).map(r => r.achievement_key)
            );

            let pool = allAchvs;
            if (filtro === 'unlocked') pool = allAchvs.filter(a => unlockedKeys.has(a.key));
            if (filtro === 'locked')   pool = allAchvs.filter(a => !unlockedKeys.has(a.key));

            const total   = pool.length;
            const paged   = pool.slice(page * pageSize, (page + 1) * pageSize);
            const pages   = Math.max(1, Math.ceil(total / pageSize));

            if (!paged.length) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('❌ No hay logros en esta página.')],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const lines = paged.map(a => {
                const done   = unlockedKeys.has(a.key);
                const status = done ? '✅' : '🔒';
                const name   = (a.secret && !done) ? '???' : a.name;
                const desc   = (a.secret && !done) ? '_Logro secreto_' : a.description;
                return `${status} ${a.emoji} **${name}** · \`${a.key}\`\n> ${desc}`;
            });

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🏆 Logros del Servidor')
                    .setColor('#FFD700')
                    .setDescription(lines.join('\n\n'))
                    .setFooter({ text: `Página ${page + 1}/${pages} · ${unlockedKeys.size}/${allAchvs.length} desbloqueados · Filtro: ${filtro}` })
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // STATS
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'stats') {
            await interaction.deferReply({ ephemeral: true });

            const target    = interaction.options.getUser('usuario') || interaction.user;
            const allAchvs  = db.prepare(`
                SELECT * FROM achievements WHERE guild_id IS NULL OR guild_id = ?
            `).all(guildId);

            const unlocked  = db.prepare(`
                SELECT ua.achievement_key, ua.unlocked_at, a.name, a.emoji, a.secret
                FROM user_achievements ua
                JOIN achievements a ON ua.achievement_key = a.key
                WHERE ua.guild_id = ? AND ua.user_id = ?
                ORDER BY ua.unlocked_at DESC
            `).all(guildId, target.id);

            const pct     = allAchvs.length > 0 ? Math.round((unlocked.length / allAchvs.length) * 100) : 0;
            const bar     = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
            const recents = unlocked.slice(0, 5).map(u =>
                `${u.emoji} **${u.secret ? '???' : u.name}** · <t:${Math.floor(u.unlocked_at / 1000)}:R>`
            );

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle(`🏆 Logros de ${target.username}`)
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                    .setColor('#FFD700')
                    .addFields(
                        {
                            name:   '📊 Progreso',
                            value:  `\`${bar}\` **${pct}%**\n${unlocked.length}/${allAchvs.length} logros`,
                            inline: false
                        },
                        {
                            name:   '🕐 Últimos desbloqueados',
                            value:  recents.length ? recents.join('\n') : '_Ninguno aún_',
                            inline: false
                        }
                    )
                    .setFooter({ text: 'Usa /achievements list para ver todos los logros.' })
                    .setTimestamp()
                ]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // LEADERBOARD
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'leaderboard') {
            await interaction.deferReply();

            const top = db.prepare(`
                SELECT user_id, COUNT(*) as total
                FROM user_achievements
                WHERE guild_id = ?
                GROUP BY user_id
                ORDER BY total DESC
                LIMIT 10
            `).all(guildId);

            if (!top.length) return interaction.editReply({ content: '❌ Nadie tiene logros aún.' });

            const medals = ['🥇','🥈','🥉'];
            const lines  = await Promise.all(top.map(async (row, i) => {
                const user = await interaction.client.users.fetch(row.user_id).catch(() => null);
                const name = user?.username || `Usuario (${row.user_id.slice(0,6)})`;
                const icon = medals[i] || `**${i + 1}.**`;
                return `${icon} **${name}** — 🏆 ${row.total} logros`;
            }));

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🏆 Ranking de Logros')
                    .setColor('#FFD700')
                    .setDescription(lines.join('\n'))
                    .setTimestamp()
                ]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // CREATE (Admin)
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'create') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Necesitas **Gestionar Servidor**.', flags: [MessageFlags.Ephemeral] });
            }

            const key       = interaction.options.getString('key').toLowerCase().replace(/\s+/g, '_');
            const nombre    = interaction.options.getString('nombre');
            const desc      = interaction.options.getString('descripcion');
            const emoji     = interaction.options.getString('emoji');
            const condicion = interaction.options.getString('condicion') || 'manual';
            const umbral    = interaction.options.getInteger('umbral') || 1;
            const secreto   = interaction.options.getBoolean('secreto') ? 1 : 0;

            const exists = db.prepare('SELECT id FROM achievements WHERE key = ? AND guild_id = ?').get(key, guildId);
            if (exists) return interaction.reply({ content: `❌ Ya existe un logro con la key \`${key}\`.`, flags: [MessageFlags.Ephemeral] });

            db.prepare(`
                INSERT INTO achievements (guild_id, key, name, description, emoji, condition, threshold, secret, global)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            `).run(guildId, key, nombre, desc, emoji, condicion, umbral, secreto);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle('✅ Logro Creado')
                    .addFields(
                        { name: '🆔 Key',         value: `\`${key}\``,       inline: true },
                        { name: `${emoji} Nombre`, value: nombre,             inline: true },
                        { name: '⚙️ Condición',   value: condicion,           inline: true },
                        { name: '🎯 Umbral',       value: `${umbral}`,         inline: true },
                        { name: '🔒 Secreto',      value: secreto ? 'Sí' : 'No', inline: true },
                    )
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // DELETE (Admin)
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'delete') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Necesitas **Gestionar Servidor**.', flags: [MessageFlags.Ephemeral] });
            }

            const key  = interaction.options.getString('key');
            const achv = db.prepare('SELECT * FROM achievements WHERE key = ? AND guild_id = ?').get(key, guildId);
            if (!achv) return interaction.reply({ content: `❌ Logro \`${key}\` no encontrado o es global.`, flags: [MessageFlags.Ephemeral] });

            db.prepare('DELETE FROM achievements WHERE key = ? AND guild_id = ?').run(key, guildId);
            db.prepare('DELETE FROM user_achievements WHERE achievement_key = ? AND guild_id = ?').run(key, guildId);

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#ED4245')
                    .setDescription(`🗑️ Logro **${achv.emoji} ${achv.name}** eliminado.`)],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // GRANT (Admin)
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'grant') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Necesitas **Gestionar Servidor**.', flags: [MessageFlags.Ephemeral] });
            }

            const target = interaction.options.getUser('usuario');
            const key    = interaction.options.getString('key');
            const achv   = db.prepare('SELECT * FROM achievements WHERE key = ? AND (guild_id = ? OR global = 1)').get(key, guildId);

            if (!achv) return interaction.reply({ content: `❌ Logro \`${key}\` no encontrado.`, flags: [MessageFlags.Ephemeral] });

            db.prepare(`
                INSERT OR IGNORE INTO user_achievements (guild_id, user_id, achievement_key, unlocked_at)
                VALUES (?, ?, ?, ?)
            `).run(guildId, target.id, key, Date.now());

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287')
                    .setDescription(`✅ Logro **${achv.emoji} ${achv.name}** otorgado a **${target.username}**.`)],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // REVOKE (Admin)
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'revoke') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Necesitas **Gestionar Servidor**.', flags: [MessageFlags.Ephemeral] });
            }

            const target = interaction.options.getUser('usuario');
            const key    = interaction.options.getString('key');

            const info = db.prepare(`
                DELETE FROM user_achievements
                WHERE guild_id = ? AND user_id = ? AND achievement_key = ?
            `).run(guildId, target.id, key);

            if (!info.changes) {
                return interaction.reply({ content: `❌ **${target.username}** no tiene el logro \`${key}\`.`, flags: [MessageFlags.Ephemeral] });
            }

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#FEE75C')
                    .setDescription(`✅ Logro \`${key}\` quitado a **${target.username}**.`)],
                flags: [MessageFlags.Ephemeral]
            });
        }
    }
};