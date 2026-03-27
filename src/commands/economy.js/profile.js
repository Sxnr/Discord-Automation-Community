const {
    SlashCommandBuilder, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionFlagsBits, MessageFlags
} = require('discord.js');
const db = require('../../database/db');

// ── Helpers ────────────────────────────────────────────────────────────────
function getProfile(guildId, userId) {
    db.prepare(`
        INSERT OR IGNORE INTO profiles (guild_id, user_id) VALUES (?, ?)
    `).run(guildId, userId);
    return db.prepare('SELECT * FROM profiles WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

function getEconomy(guildId, userId) {
    db.prepare(`INSERT OR IGNORE INTO economy (guild_id, user_id) VALUES (?, ?)`).run(guildId, userId);
    return db.prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

function getLevels(guildId, userId) {
    return db.prepare('SELECT * FROM levels WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

function getAchievements(guildId, userId) {
    return db.prepare(`
        SELECT a.emoji, a.name FROM user_achievements ua
        JOIN achievements a ON ua.achievement_key = a.key AND (a.guild_id = ? OR a.global = 1)
        WHERE ua.guild_id = ? AND ua.user_id = ?
        ORDER BY ua.unlocked_at DESC LIMIT 6
    `).all(guildId, guildId, userId);
}

function getSettings(guildId) {
    db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
    return db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
}

function xpForLevel(level) {
    return 100 * Math.pow(level + 1, 1.5);
}

function fmt(guildId, amount) {
    const s     = getSettings(guildId);
    const emoji = s?.economy_currency_emoji || '💰';
    const name  = s?.economy_currency       || 'coins';
    return `${emoji} ${amount.toLocaleString('es-CL')} ${name}`;
}

const VALID_TIMEZONES = [
    'UTC', 'America/Santiago', 'America/Argentina/Buenos_Aires',
    'America/Bogota', 'America/Lima', 'America/Mexico_City',
    'America/New_York', 'America/Los_Angeles', 'Europe/Madrid',
    'Europe/London', 'America/Sao_Paulo',
];

const VALID_COLORS = [
    '#5865F2','#57F287','#FEE75C','#ED4245','#EB459E',
    '#FF7043','#00BCD4','#9C27B0','#FF9800','#FFFFFF',
];

// ══════════════════════════════════════════════════════════════════════════════
module.exports = {
    category: 'economy',
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('👤 Perfil personalizable del usuario.')

        // view
        .addSubcommand(s => s
            .setName('view')
            .setDescription('Ver el perfil de un usuario.')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario a ver'))
        )
        // edit
        .addSubcommand(s => s
            .setName('edit')
            .setDescription('Editar tu perfil.')
            .addStringOption(o => o
                .setName('campo')
                .setDescription('Qué editar')
                .setRequired(true)
                .addChoices(
                    { name: '📝 Biografía',      value: 'bio'           },
                    { name: '🎨 Color de embed', value: 'color'         },
                    { name: '🖼️ Banner (URL)',   value: 'banner'        },
                    { name: '🌎 Zona horaria',   value: 'timezone'      },
                    { name: '⭐ Emoji favorito', value: 'fav_emoji'     },
                    { name: '🔗 Redes sociales', value: 'socials'       },
                    { name: '🎂 Mostrar cumple', value: 'birthday_show' },
                )
            )
            .addStringOption(o => o.setName('valor').setDescription('Nuevo valor').setRequired(true))
        )
        // reset
        .addSubcommand(s => s
            .setName('reset')
            .setDescription('Resetear tu perfil al estado por defecto.')
        )
        // badges (admin)
        .addSubcommand(s => s
            .setName('badge-add')
            .setDescription('[Admin] Otorgar un logro manualmente a un usuario.')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
            .addStringOption(o => o.setName('key').setDescription('Key del logro').setRequired(true))
        ),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const userId  = interaction.user.id;

        // ══════════════════════════════════════════════════════════════════
        // VIEW
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'view') {
            await interaction.deferReply();

            const target  = interaction.options.getUser('usuario') || interaction.user;
            const member  = await interaction.guild.members.fetch(target.id).catch(() => null);
            const profile = getProfile(guildId, target.id);
            const eco     = getEconomy(guildId, target.id);
            const lvl     = getLevels(guildId, target.id);
            const achvs   = getAchievements(guildId, target.id);
            const cfg     = getSettings(guildId);

            // Rank global por coins
            const ecoRank = db.prepare(`
                SELECT COUNT(*) as r FROM economy
                WHERE guild_id = ? AND (wallet + bank) > ?
            `).get(guildId, eco.wallet + eco.bank).r + 1;

            // Rank XP
            const xpRank = lvl ? db.prepare(`
                SELECT COUNT(*) as r FROM levels WHERE guild_id = ? AND xp > ?
            `).get(guildId, lvl.xp).r + 1 : null;

            // Badges recientes (máx 6)
            const badgeLine = achvs.length
                ? achvs.map(a => `${a.emoji}`).join(' ')
                : '_Sin logros aún_';

            // XP progress bar
            let xpBar = '_Sin datos de XP_';
            let xpLine = '';
            if (lvl) {
                const needed   = Math.floor(xpForLevel(lvl.level));
                const progress = Math.min(lvl.xp / needed, 1);
                const filled   = Math.round(progress * 10);
                xpBar  = '█'.repeat(filled) + '░'.repeat(10 - filled);
                xpLine = `Nivel **${lvl.level}** · ${lvl.xp.toLocaleString()}/${needed.toLocaleString()} XP`;
            }

            // Socials
            let socials = {};
            try { socials = JSON.parse(profile.socials || '{}'); } catch {}
            const socialLines = Object.entries(socials)
                .map(([k, v]) => `**${k}:** ${v}`)
                .join('\n');

            // Fecha de ingreso al servidor
            const joinedAt = member?.joinedAt
                ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D>`
                : '_Desconocido_';

            // Zona horaria → hora actual
            let localTime = '';
            try {
                localTime = new Intl.DateTimeFormat('es-CL', {
                    timeZone: profile.timezone || 'UTC',
                    hour: '2-digit', minute: '2-digit', hour12: false
                }).format(new Date());
            } catch { localTime = '—'; }

            // Cumpleaños
            let bdayLine = '_No configurado_';
            if (profile.birthday_show) {
                const bday = db.prepare('SELECT day, month FROM birthdays WHERE guild_id = ? AND user_id = ?').get(guildId, target.id);
                if (bday) bdayLine = `${String(bday.day).padStart(2,'0')}/${String(bday.month).padStart(2,'0')}`;
            }

            const embed = new EmbedBuilder()
                .setTitle(`${profile.fav_emoji || '⭐'} Perfil de ${target.username}`)
                .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
                .setColor(profile.color || '#5865F2')
                .setDescription(profile.bio ? `*${profile.bio}*` : '_Sin biografía_')
                .addFields(
                    // Fila 1 — Economía
                    {
                        name:   '💰 Economía',
                        value:  `Cartera: **${fmt(guildId, eco.wallet)}**\nBanco: **${fmt(guildId, eco.bank)}**\nRanking: **#${ecoRank}**`,
                        inline: true
                    },
                    // Fila 2 — Nivel
                    {
                        name:   '⚡ Nivel',
                        value:  lvl
                            ? `${xpLine}\n\`${xpBar}\`\nRanking XP: **#${xpRank}**`
                            : '_Sin actividad de XP_',
                        inline: true
                    },
                    // Fila 3 — Info
                    {
                        name:   '📋 Info',
                        value:  [
                            `📅 Unido: ${joinedAt}`,
                            `🌎 Hora local: **${localTime}** (${profile.timezone || 'UTC'})`,
                            `🎂 Cumpleaños: **${bdayLine}**`,
                            `💬 Mensajes: **${lvl?.messages?.toLocaleString() || 0}**`,
                        ].join('\n'),
                        inline: false
                    },
                    // Fila 4 — Logros
                    {
                        name:   `🏆 Logros recientes (${achvs.length})`,
                        value:  badgeLine,
                        inline: false
                    },
                    // Fila 5 — Redes
                    ...(socialLines ? [{
                        name:   '🔗 Redes sociales',
                        value:  socialLines,
                        inline: false
                    }] : [])
                )
                .setFooter({ text: `ID: ${target.id}` })
                .setTimestamp();

            if (profile.banner_url) embed.setImage(profile.banner_url);

            return interaction.editReply({ embeds: [embed] });
        }

        // ══════════════════════════════════════════════════════════════════
        // EDIT
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'edit') {
            const campo = interaction.options.getString('campo');
            const valor = interaction.options.getString('valor');

            getProfile(guildId, userId);

            switch (campo) {
                case 'bio': {
                    if (valor.length > 200) {
                        return interaction.reply({ content: '❌ La bio no puede superar **200 caracteres**.', flags: [MessageFlags.Ephemeral] });
                    }
                    db.prepare('UPDATE profiles SET bio = ? WHERE guild_id = ? AND user_id = ?').run(valor, guildId, userId);
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Bio actualizada:\n*${valor}*`)],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                case 'color': {
                    const hex = valor.startsWith('#') ? valor : `#${valor}`;
                    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                        const opts = VALID_COLORS.map(c => `\`${c}\``).join(', ');
                        return interaction.reply({
                            content: `❌ Color inválido. Usa formato HEX: \`#RRGGBB\`\nColores sugeridos: ${opts}`,
                            flags: [MessageFlags.Ephemeral]
                        });
                    }
                    db.prepare('UPDATE profiles SET color = ? WHERE guild_id = ? AND user_id = ?').run(hex, guildId, userId);
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor(hex).setDescription(`✅ Color actualizado a \`${hex}\`.`)],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                case 'banner': {
                    const isUrl = /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(valor);
                    if (!isUrl && valor.toLowerCase() !== 'none') {
                        return interaction.reply({
                            content: '❌ URL inválida. Debe terminar en `.png`, `.jpg`, `.gif` o `.webp`.\nEscribe `none` para eliminar el banner.',
                            flags: [MessageFlags.Ephemeral]
                        });
                    }
                    const url = valor.toLowerCase() === 'none' ? null : valor;
                    db.prepare('UPDATE profiles SET banner_url = ? WHERE guild_id = ? AND user_id = ?').run(url, guildId, userId);
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('#57F287')
                            .setDescription(url ? `✅ Banner actualizado.` : '✅ Banner eliminado.')
                            .setImage(url || null)
                        ],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                case 'timezone': {
                    if (!VALID_TIMEZONES.includes(valor)) {
                        return interaction.reply({
                            content: `❌ Zona horaria no válida.\nOpciones disponibles:\n${VALID_TIMEZONES.map(t => `\`${t}\``).join(', ')}`,
                            flags: [MessageFlags.Ephemeral]
                        });
                    }
                    db.prepare('UPDATE profiles SET timezone = ? WHERE guild_id = ? AND user_id = ?').run(valor, guildId, userId);
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Zona horaria actualizada a \`${valor}\`.`)],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                case 'fav_emoji': {
                    const emojiRegex = /\p{Emoji}/u;
                    if (!emojiRegex.test(valor) || valor.length > 8) {
                        return interaction.reply({ content: '❌ Ingresa un emoji válido.', flags: [MessageFlags.Ephemeral] });
                    }
                    db.prepare('UPDATE profiles SET fav_emoji = ? WHERE guild_id = ? AND user_id = ?').run(valor, guildId, userId);
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Emoji favorito actualizado a ${valor}.`)],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                case 'socials': {
                    // Formato esperado: "twitter:@usuario" o "github:usuario"
                    const parts = valor.split(':');
                    if (parts.length < 2 || !parts[0] || !parts[1]) {
                        return interaction.reply({
                            content: '❌ Formato inválido.\nUsa `plataforma:usuario`, ej: `twitter:@FranCarrera` o escribe `reset` para limpiar.',
                            flags: [MessageFlags.Ephemeral]
                        });
                    }

                    const profile  = getProfile(guildId, userId);
                    let socials    = {};
                    try { socials = JSON.parse(profile.socials || '{}'); } catch {}

                    if (valor.toLowerCase() === 'reset') {
                        db.prepare('UPDATE profiles SET socials = ? WHERE guild_id = ? AND user_id = ?').run('{}', guildId, userId);
                        return interaction.reply({
                            embeds: [new EmbedBuilder().setColor('#57F287').setDescription('✅ Redes sociales limpiadas.')],
                            flags: [MessageFlags.Ephemeral]
                        });
                    }

                    const platform = parts[0].toLowerCase().slice(0, 20);
                    const handle   = parts.slice(1).join(':').slice(0, 60);

                    if (Object.keys(socials).length >= 5) {
                        return interaction.reply({ content: '❌ Máximo **5 redes sociales** permitidas.', flags: [MessageFlags.Ephemeral] });
                    }

                    socials[platform] = handle;
                    db.prepare('UPDATE profiles SET socials = ? WHERE guild_id = ? AND user_id = ?').run(JSON.stringify(socials), guildId, userId);

                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('#57F287')
                            .setDescription(`✅ Red social agregada: **${platform}** → \`${handle}\``)],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                case 'birthday_show': {
                    const show = ['1','si','sí','true','on','mostrar'].includes(valor.toLowerCase()) ? 1 : 0;
                    db.prepare('UPDATE profiles SET birthday_show = ? WHERE guild_id = ? AND user_id = ?').run(show, guildId, userId);
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('#57F287')
                            .setDescription(`✅ Visibilidad de cumpleaños: **${show ? 'visible' : 'oculto'}**.`)],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                default:
                    return interaction.reply({ content: '❌ Campo inválido.', flags: [MessageFlags.Ephemeral] });
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // RESET
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'reset') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`profile_reset_confirm_${userId}`).setLabel('Sí, resetear').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`profile_reset_cancel_${userId}`).setLabel('Cancelar').setStyle(ButtonStyle.Secondary),
            );

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#ED4245')
                    .setTitle('⚠️ ¿Resetear perfil?')
                    .setDescription('Se borrará tu **bio, color, banner, emoji, socials y zona horaria**.\nEsto no afecta tu economía ni XP.')
                ],
                components: [row],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // BADGE-ADD (Admin)
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'badge-add') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Necesitas **Gestionar Servidor**.', flags: [MessageFlags.Ephemeral] });
            }

            const target = interaction.options.getUser('usuario');
            const key    = interaction.options.getString('key');
            const achv   = db.prepare(`
                SELECT * FROM achievements WHERE key = ? AND (guild_id = ? OR global = 1)
            `).get(key, guildId);

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
    }
};