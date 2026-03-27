const {
    SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
    MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder
} = require('discord.js');
const ms = require('ms');
const db = require('../../database/db');

// ══════════════════════════════════════════════════════════
// HELPERS GLOBALES
// ══════════════════════════════════════════════════════════

// Guardar acción en mod_logs
function saveLog(guildId, userId, moderatorId, action, reason, duration = null) {
    db.prepare(`
        INSERT INTO mod_logs (guild_id, user_id, moderator_id, action, reason, duration, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(guildId, userId, moderatorId, action, reason, duration, Date.now());
}

// Log al canal de auditoría
async function sendModLog(interaction, action, target, reason, extra = {}) {
    const settings = db.prepare('SELECT audit_log_channel FROM guild_settings WHERE guild_id = ?').get(interaction.guild.id);
    if (!settings?.audit_log_channel) return;
    const logChannel = interaction.guild.channels.cache.get(settings.audit_log_channel);
    if (!logChannel) return;

    const colors = {
        ban: '#E74C3C', unban: '#2ECC71', kick: '#E67E22',
        mute: '#E67E22', unmute: '#2ECC71', slowmode: '#3498DB',
        clear: '#9B59B6', lock: '#E74C3C', unlock: '#2ECC71', warn: '#F39C12'
    };
    const icons = {
        ban: '🔨', unban: '✅', kick: '👢', mute: '🔇',
        unmute: '🔊', slowmode: '🐢', clear: '🧹',
        lock: '🔒', unlock: '🔓', warn: '⚠️'
    };

    await logChannel.send({
        embeds: [new EmbedBuilder()
            .setTitle(`${icons[action] || '⚙️'} Moderación — ${action.toUpperCase()}`)
            .setColor(colors[action] || '#5865F2')
            .addFields(
                { name: '👤 Usuario',   value: target ? `${target.tag || target.user?.tag || 'N/A'} \`(${target.id})\`` : '`N/A`', inline: true },
                { name: '🛡️ Moderador', value: `${interaction.user.tag} \`(${interaction.user.id})\``, inline: true },
                { name: '📋 Motivo',    value: reason || 'Sin motivo', inline: false },
                ...Object.entries(extra).map(([name, value]) => ({ name, value: String(value), inline: true }))
            )
            .setThumbnail(target?.displayAvatarURL?.() || target?.user?.displayAvatarURL?.() || null)
            .setTimestamp()
        ]
    }).catch(() => null);
}

// DM al usuario afectado
async function notifyUser(user, guildName, action, reason, duration = null) {
    const labels  = { ban: '🔨 Baneado', kick: '👢 Expulsado', mute: '🔇 Silenciado', warn: '⚠️ Advertido' };
    const colors  = { ban: '#E74C3C', kick: '#E67E22', mute: '#E67E22', warn: '#F39C12' };
    try {
        await user.send({
            embeds: [new EmbedBuilder()
                .setTitle(`${labels[action] || '⚙️ Acción'} en ${guildName}`)
                .setColor(colors[action] || '#5865F2')
                .addFields(
                    { name: '📋 Motivo', value: reason || 'Sin motivo', inline: false },
                    ...(duration ? [{ name: '⏱️ Duración', value: duration, inline: true }] : [])
                )
                .setFooter({ text: 'Si crees que fue un error, contacta al staff.' })
                .setTimestamp()
            ]
        });
    } catch { /* DMs cerrados */ }
}

// ══════════════════════════════════════════════════════════
// BUILDER DEL PANEL INTERACTIVO (warns + mod_logs)
// ══════════════════════════════════════════════════════════
const ACTION_ICONS = {
    ban: '🔨', unban: '✅', kick: '👢', mute: '🔇',
    unmute: '🔊', warn: '⚠️', clear: '🧹', lock: '🔒',
    unlock: '🔓', slowmode: '🐢'
};
const ACTION_COLORS = {
    ban: '#E74C3C', unban: '#2ECC71', kick: '#E67E22',
    mute: '#E67E22', unmute: '#2ECC71', warn: '#F39C12',
    clear: '#9B59B6', lock: '#E74C3C', unlock: '#2ECC71'
};

function buildHistoryPanel(logs, warns, targetUser, page = 0, filter = 'all') {
    const ITEMS_PER_PAGE = 4;

    // Unificar logs + warns en una sola lista ordenada
    const allEntries = [
        ...logs.map(l => ({ ...l, source: 'mod' })),
        ...warns.map(w => ({ ...w, action: 'warn', source: 'warn' }))
    ].sort((a, b) => b.timestamp - a.timestamp);

    const filtered  = filter === 'all' ? allEntries : allEntries.filter(e => e.action === filter);
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const pageItems  = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

    // Conteo por tipo
    const counts = allEntries.reduce((acc, e) => {
        acc[e.action] = (acc[e.action] || 0) + 1;
        return acc;
    }, {});

    const riskLevel = (counts.ban || 0) > 0 ? '🚨 `CRÍTICO`'
        : (counts.warn || 0) >= 5 ? '🔴 `ALTO`'
        : (counts.warn || 0) >= 3 ? '🟠 `MEDIO`'
        : (counts.warn || 0) >= 1 ? '🟡 `BAJO`'
        : '🟢 `Sin riesgo`';

    const embed = new EmbedBuilder()
        .setTitle(`📜 Historial de Moderación — ${targetUser.username}`)
        .setColor(counts.ban ? '#E74C3C' : counts.warn >= 3 ? '#E67E22' : '#5865F2')
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(
            filtered.length === 0
                ? '✅ Sin acciones de moderación registradas.'
                : pageItems.map(e =>
                    `${ACTION_ICONS[e.action] || '⚙️'} **${e.action.toUpperCase()}** — \`#${e.id}\` — <t:${Math.floor(e.timestamp / 1000)}:d>\n` +
                    `> 📋 ${e.reason}\n` +
                    `> 🛡️ <@${e.moderator_id}>` +
                    (e.duration ? `\n> ⏱️ \`${e.duration}\`` : '')
                ).join('\n\n')
        )
        .addFields(
            {
                name: '📊 Resumen',
                value:
                    Object.entries(counts).map(([a, c]) => `${ACTION_ICONS[a] || '⚙️'} ${a}: \`${c}\``).join('  ') ||
                    '`Sin registros`',
                inline: false
            },
            { name: '⚡ Nivel de Riesgo', value: riskLevel, inline: true },
            { name: '📁 Total Acciones',  value: `\`${allEntries.length}\``, inline: true },
            { name: '🔍 Filtro Activo',   value: `\`${filter}\``,            inline: true }
        )
        .setFooter({ text: `Página ${page + 1} de ${totalPages || 1} • ID: ${targetUser.id}` })
        .setTimestamp();

    const components = [];

    // ── Select para eliminar entrada específica ──
    if (pageItems.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`mod_history_delete:${targetUser.id}:${page}:${filter}`)
            .setPlaceholder('🗑️ Selecciona una entrada para eliminar...')
            .addOptions(pageItems.map(e => ({
                label:       `${e.action.toUpperCase()} #${e.id} — ${e.reason.slice(0, 45)}`,
                description: `${new Date(e.timestamp).toLocaleDateString('es-CL')} por moderador`,
                value:       `${e.source}:${e.id}`,
                emoji:       ACTION_ICONS[e.action] || '⚙️'
            })));
        components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    // ── Select para filtrar por tipo de acción ──
    const filterMenu = new StringSelectMenuBuilder()
        .setCustomId(`mod_history_filter:${targetUser.id}`)
        .setPlaceholder('🔍 Filtrar por tipo de acción...')
        .addOptions([
            { label: 'Todas las acciones', value: 'all',     emoji: '📋' },
            { label: 'Advertencias',       value: 'warn',    emoji: '⚠️' },
            { label: 'Baneos',             value: 'ban',     emoji: '🔨' },
            { label: 'Desbaneos',          value: 'unban',   emoji: '✅' },
            { label: 'Expulsiones',        value: 'kick',    emoji: '👢' },
            { label: 'Silencios',          value: 'mute',    emoji: '🔇' },
            { label: 'Desilencios',        value: 'unmute',  emoji: '🔊' },
        ]);
    components.push(new ActionRowBuilder().addComponents(filterMenu));

    // ── Botones de navegación y acciones ──
    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mod_history_page:${targetUser.id}:${page - 1}:${filter}`)
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),

        new ButtonBuilder()
            .setCustomId(`mod_history_page:${targetUser.id}:${page + 1}:${filter}`)
            .setEmoji('➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1),

        new ButtonBuilder()
            .setCustomId(`mod_history_clear:${targetUser.id}`)
            .setLabel('Borrar Todo')
            .setEmoji('🧹')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(allEntries.length === 0),

        new ButtonBuilder()
            .setCustomId(`mod_history_refresh:${targetUser.id}`)
            .setLabel('Actualizar')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Primary)
    );
    components.push(btnRow);

    return { embed, components };
}

// ══════════════════════════════════════════════════════════
// EXPORTAR buildHistoryPanel para interactionCreate
// ══════════════════════════════════════════════════════════
module.exports = {
    category: 'admin',
    buildHistoryPanel,

    data: new SlashCommandBuilder()
        .setName('mod')
        .setDescription('🛡️ Sistema central de moderación del servidor.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

        .addSubcommand(sub => sub
            .setName('ban')
            .setDescription('🔨 Banea a un usuario del servidor.')
            .addUserOption(opt => opt.setName('usuario').setDescription('👤 Usuario').setRequired(true))
            .addStringOption(opt => opt.setName('razon').setDescription('📋 Motivo').setRequired(true))
            .addIntegerOption(opt => opt.setName('dias_mensajes').setDescription('🗑️ Borrar mensajes de los últimos X días (0-7)').setMinValue(0).setMaxValue(7))
        )
        .addSubcommand(sub => sub
            .setName('unban')
            .setDescription('✅ Desbanea a un usuario por su ID.')
            .addStringOption(opt => opt.setName('usuario_id').setDescription('🆔 ID del usuario').setRequired(true))
            .addStringOption(opt => opt.setName('razon').setDescription('📋 Motivo'))
        )
        .addSubcommand(sub => sub
            .setName('kick')
            .setDescription('👢 Expulsa a un usuario del servidor.')
            .addUserOption(opt => opt.setName('usuario').setDescription('👤 Usuario').setRequired(true))
            .addStringOption(opt => opt.setName('razon').setDescription('📋 Motivo').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('mute')
            .setDescription('🔇 Silencia a un usuario usando timeout.')
            .addUserOption(opt => opt.setName('usuario').setDescription('👤 Usuario').setRequired(true))
            .addStringOption(opt => opt.setName('duracion').setDescription('⏱️ Duración (ej: 10m, 1h, 1d — máx 28d)').setRequired(true))
            .addStringOption(opt => opt.setName('razon').setDescription('📋 Motivo').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('unmute')
            .setDescription('🔊 Quita el silencio a un usuario.')
            .addUserOption(opt => opt.setName('usuario').setDescription('👤 Usuario').setRequired(true))
            .addStringOption(opt => opt.setName('razon').setDescription('📋 Motivo'))
        )
        .addSubcommand(sub => sub
            .setName('clear')
            .setDescription('🧹 Elimina mensajes de un canal en masa.')
            .addIntegerOption(opt => opt.setName('cantidad').setDescription('💬 Cantidad (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
            .addUserOption(opt => opt.setName('usuario').setDescription('👤 Filtrar por usuario'))
        )
        .addSubcommand(sub => sub
            .setName('slowmode')
            .setDescription('🐢 Activa o desactiva el modo lento en un canal.')
            .addIntegerOption(opt => opt.setName('segundos').setDescription('⏱️ Segundos (0 = desactivar)').setRequired(true).setMinValue(0).setMaxValue(21600))
            .addChannelOption(opt => opt.setName('canal').setDescription('📌 Canal objetivo'))
        )
        .addSubcommand(sub => sub
            .setName('lock')
            .setDescription('🔒 Bloquea un canal.')
            .addChannelOption(opt => opt.setName('canal').setDescription('📌 Canal'))
            .addStringOption(opt => opt.setName('razon').setDescription('📋 Motivo'))
        )
        .addSubcommand(sub => sub
            .setName('unlock')
            .setDescription('🔓 Desbloquea un canal bloqueado.')
            .addChannelOption(opt => opt.setName('canal').setDescription('📌 Canal'))
            .addStringOption(opt => opt.setName('razon').setDescription('📋 Motivo'))
        )
        .addSubcommand(sub => sub
            .setName('history')
            .setDescription('📜 Ver historial completo de moderación de un usuario.')
            .addUserOption(opt => opt.setName('usuario').setDescription('👤 Usuario').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // ════════════════════════════════════════
        // BAN
        // ════════════════════════════════════════
        if (sub === 'ban') {
            const target  = interaction.options.getMember('usuario');
            const reason  = interaction.options.getString('razon');
            const delDays = interaction.options.getInteger('dias_mensajes') || 0;

            if (!target)                          return interaction.editReply({ content: '❌ Usuario no encontrado.' });
            if (target.id === interaction.user.id) return interaction.editReply({ content: '❌ No puedes banearte a ti mismo.' });
            if (!target.bannable)                  return interaction.editReply({ content: '❌ No tengo permisos para banear a este usuario.' });

            await notifyUser(target.user, interaction.guild.name, 'ban', reason);
            await target.ban({ reason, deleteMessageSeconds: delDays * 86400 });

            saveLog(guildId, target.id, interaction.user.id, 'ban', reason);
            await sendModLog(interaction, 'ban', target.user, reason, {
                '🗑️ Mensajes borrados': `Últimos \`${delDays}\` día(s)`
            });

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🔨 Usuario Baneado')
                    .setColor('#E74C3C')
                    .setThumbnail(target.user.displayAvatarURL())
                    .addFields(
                        { name: '👤 Usuario', value: `${target.user.tag} \`(${target.id})\``, inline: true },
                        { name: '📋 Motivo',  value: reason,                                   inline: false }
                    )
                    .setFooter({ text: 'Usa /mod history para ver el historial completo.' })
                    .setTimestamp()
                ]
            });
        }

        // ════════════════════════════════════════
        // UNBAN
        // ════════════════════════════════════════
        if (sub === 'unban') {
            const userId = interaction.options.getString('usuario_id').trim();
            const reason = interaction.options.getString('razon') || 'Sin motivo especificado';

            if (!/^\d{17,20}$/.test(userId)) return interaction.editReply({ content: '❌ ID de usuario inválido.' });

            const banList = await interaction.guild.bans.fetch().catch(() => null);
            const banned  = banList?.get(userId);
            if (!banned) return interaction.editReply({ content: `❌ No hay baneo activo para el ID \`${userId}\`.` });

            await interaction.guild.members.unban(userId, reason);

            saveLog(guildId, userId, interaction.user.id, 'unban', reason);
            await sendModLog(interaction, 'unban', banned.user, reason);

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('✅ Usuario Desbaneado')
                    .setColor('#2ECC71')
                    .addFields(
                        { name: '👤 Usuario', value: `${banned.user.tag} \`(${userId})\``, inline: true },
                        { name: '📋 Motivo',  value: reason,                               inline: false }
                    )
                    .setTimestamp()
                ]
            });
        }

        // ════════════════════════════════════════
        // KICK
        // ════════════════════════════════════════
        if (sub === 'kick') {
            const target = interaction.options.getMember('usuario');
            const reason = interaction.options.getString('razon');

            if (!target)                          return interaction.editReply({ content: '❌ Usuario no encontrado.' });
            if (target.id === interaction.user.id) return interaction.editReply({ content: '❌ No puedes expulsarte a ti mismo.' });
            if (!target.kickable)                  return interaction.editReply({ content: '❌ No tengo permisos para expulsar a este usuario.' });

            await notifyUser(target.user, interaction.guild.name, 'kick', reason);
            await target.kick(reason);

            saveLog(guildId, target.id, interaction.user.id, 'kick', reason);
            await sendModLog(interaction, 'kick', target.user, reason);

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('👢 Usuario Expulsado')
                    .setColor('#E67E22')
                    .setThumbnail(target.user.displayAvatarURL())
                    .addFields(
                        { name: '👤 Usuario', value: `${target.user.tag} \`(${target.id})\``, inline: true },
                        { name: '📋 Motivo',  value: reason,                                   inline: false }
                    )
                    .setTimestamp()
                ]
            });
        }

        // ════════════════════════════════════════
        // MUTE
        // ════════════════════════════════════════
        if (sub === 'mute') {
            const target      = interaction.options.getMember('usuario');
            const durationStr = interaction.options.getString('duracion');
            const reason      = interaction.options.getString('razon');

            if (!target)                          return interaction.editReply({ content: '❌ Usuario no encontrado.' });
            if (target.id === interaction.user.id) return interaction.editReply({ content: '❌ No puedes silenciarte a ti mismo.' });

            const durationMs = ms(durationStr);
            if (!durationMs)          return interaction.editReply({ content: '❌ Formato inválido. Usa: `10m`, `1h`, `1d`.' });
            if (durationMs > ms('28d')) return interaction.editReply({ content: '❌ Duración máxima: `28d`.' });
            if (!target.moderatable)  return interaction.editReply({ content: '❌ No tengo permisos para silenciar a este usuario.' });

            await target.timeout(durationMs, reason);
            await notifyUser(target.user, interaction.guild.name, 'mute', reason, durationStr);

            saveLog(guildId, target.id, interaction.user.id, 'mute', reason, durationStr);
            await sendModLog(interaction, 'mute', target, reason, {
                '⏱️ Duración': `\`${durationStr}\``,
                '🕐 Expira':   `<t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`
            });

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🔇 Usuario Silenciado')
                    .setColor('#E67E22')
                    .setThumbnail(target.user.displayAvatarURL())
                    .addFields(
                        { name: '👤 Usuario',  value: `${target.user.tag} \`(${target.id})\``,                 inline: true  },
                        { name: '⏱️ Duración', value: `\`${durationStr}\``,                                     inline: true  },
                        { name: '🕐 Expira',   value: `<t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`, inline: true  },
                        { name: '📋 Motivo',   value: reason,                                                   inline: false }
                    )
                    .setTimestamp()
                ]
            });
        }

        // ════════════════════════════════════════
        // UNMUTE
        // ════════════════════════════════════════
        if (sub === 'unmute') {
            const target = interaction.options.getMember('usuario');
            const reason = interaction.options.getString('razon') || 'Sin motivo especificado';

            if (!target)                                return interaction.editReply({ content: '❌ Usuario no encontrado.' });
            if (!target.isCommunicationDisabled())      return interaction.editReply({ content: '⚠️ Este usuario no está silenciado.' });

            await target.timeout(null, reason);

            saveLog(guildId, target.id, interaction.user.id, 'unmute', reason);
            await sendModLog(interaction, 'unmute', target, reason);

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🔊 Silencio Removido')
                    .setColor('#2ECC71')
                    .addFields(
                        { name: '👤 Usuario', value: `${target.user.tag} \`(${target.id})\``, inline: true },
                        { name: '📋 Motivo',  value: reason,                                   inline: false }
                    )
                    .setTimestamp()
                ]
            });
        }

        // ════════════════════════════════════════
        // CLEAR
        // ════════════════════════════════════════
        if (sub === 'clear') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
                return interaction.editReply({ content: '❌ Necesitas el permiso **Gestionar Mensajes**.' });

            const cantidad = interaction.options.getInteger('cantidad');
            const usuario  = interaction.options.getUser('usuario');

            let messages = await interaction.channel.messages.fetch({ limit: 100 }).catch(() => null);
            if (!messages) return interaction.editReply({ content: '❌ No se pudieron obtener los mensajes.' });

            if (usuario) messages = messages.filter(m => m.author.id === usuario.id);

            const deletable = messages
                .filter(m => Date.now() - m.createdTimestamp < 1_209_600_000)
                .first(cantidad);

            if (!deletable.length) return interaction.editReply({ content: '❌ No hay mensajes recientes para eliminar.' });

            const deleted = await interaction.channel.bulkDelete(deletable, true).catch(() => null);

            saveLog(guildId, usuario?.id || interaction.user.id, interaction.user.id, 'clear',
                `Purga en #${interaction.channel.name} — ${deleted?.size || 0} mensajes eliminados`
            );
            await sendModLog(interaction, 'clear', interaction.member, `Purga en #${interaction.channel.name}`, {
                '💬 Eliminados': `\`${deleted?.size || 0}\` mensajes`,
                '📌 Canal':      `${interaction.channel}`,
                ...(usuario ? { '👤 Filtro': `${usuario.tag}` } : {})
            });

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🧹 Mensajes Eliminados')
                    .setColor('#9B59B6')
                    .addFields(
                        { name: '💬 Eliminados', value: `\`${deleted?.size || 0}\` mensajes`, inline: true },
                        { name: '📌 Canal',      value: `${interaction.channel}`,             inline: true },
                        ...(usuario ? [{ name: '👤 Filtro', value: `${usuario.tag}`, inline: true }] : [])
                    )
                    .setTimestamp()
                ]
            });
        }

        // ════════════════════════════════════════
        // SLOWMODE
        // ════════════════════════════════════════
        if (sub === 'slowmode') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels))
                return interaction.editReply({ content: '❌ Necesitas el permiso **Gestionar Canales**.' });

            const segundos = interaction.options.getInteger('segundos');
            const canal    = interaction.options.getChannel('canal') || interaction.channel;

            await canal.setRateLimitPerUser(segundos);

            saveLog(guildId, interaction.user.id, interaction.user.id, 'slowmode',
                `Slowmode en #${canal.name}: ${segundos === 0 ? 'desactivado' : `${segundos}s`}`
            );
            await sendModLog(interaction, 'slowmode', interaction.member, `Slowmode en #${canal.name}`, {
                '⏱️ Intervalo': segundos === 0 ? '`Desactivado`' : `\`${segundos}s\``
            });

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle(`🐢 Slowmode ${segundos === 0 ? 'Desactivado' : 'Activado'}`)
                    .setColor(segundos === 0 ? '#2ECC71' : '#3498DB')
                    .addFields(
                        { name: '📌 Canal',     value: `${canal}`,                                                    inline: true },
                        { name: '⏱️ Intervalo', value: segundos === 0 ? '`Sin límite`' : `\`${segundos} segundos\``, inline: true }
                    )
                    .setTimestamp()
                ]
            });
        }

        // ════════════════════════════════════════
        // LOCK
        // ════════════════════════════════════════
        if (sub === 'lock') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels))
                return interaction.editReply({ content: '❌ Necesitas el permiso **Gestionar Canales**.' });

            const canal  = interaction.options.getChannel('canal') || interaction.channel;
            const reason = interaction.options.getString('razon') || 'Sin motivo especificado';

            await canal.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });

            saveLog(guildId, interaction.user.id, interaction.user.id, 'lock', `Canal bloqueado: #${canal.name} — ${reason}`);
            await sendModLog(interaction, 'lock', interaction.member, reason, { '📌 Canal': `${canal}` });

            await canal.send({
                embeds: [new EmbedBuilder()
                    .setTitle('🔒 Canal Bloqueado')
                    .setDescription(`Este canal ha sido bloqueado por el staff.\n**Motivo:** ${reason}`)
                    .setColor('#E74C3C')
                    .setFooter({ text: `Bloqueado por ${interaction.user.tag}` })
                    .setTimestamp()
                ]
            });

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🔒 Canal Bloqueado')
                    .setColor('#E74C3C')
                    .addFields(
                        { name: '📌 Canal',   value: `${canal}`, inline: true },
                        { name: '📋 Motivo', value: reason,      inline: false }
                    )
                    .setTimestamp()
                ]
            });
        }

        // ════════════════════════════════════════
        // UNLOCK
        // ════════════════════════════════════════
        if (sub === 'unlock') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels))
                return interaction.editReply({ content: '❌ Necesitas el permiso **Gestionar Canales**.' });

            const canal  = interaction.options.getChannel('canal') || interaction.channel;
            const reason = interaction.options.getString('razon') || 'Sin motivo especificado';

            await canal.permissionOverwrites.edit(interaction.guild.id, { SendMessages: null });

            saveLog(guildId, interaction.user.id, interaction.user.id, 'unlock', `Canal desbloqueado: #${canal.name} — ${reason}`);
            await sendModLog(interaction, 'unlock', interaction.member, reason, { '📌 Canal': `${canal}` });

            await canal.send({
                embeds: [new EmbedBuilder()
                    .setTitle('🔓 Canal Desbloqueado')
                    .setDescription(`¡Canal desbloqueado! Pueden continuar. 🎉`)
                    .setColor('#2ECC71')
                    .setFooter({ text: `Desbloqueado por ${interaction.user.tag}` })
                    .setTimestamp()
                ]
            });

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🔓 Canal Desbloqueado')
                    .setColor('#2ECC71')
                    .addFields(
                        { name: '📌 Canal',   value: `${canal}`, inline: true },
                        { name: '📋 Motivo', value: reason,      inline: false }
                    )
                    .setTimestamp()
                ]
            });
        }

        // ════════════════════════════════════════
        // HISTORY (panel interactivo)
        // ════════════════════════════════════════
        if (sub === 'history') {
            const target = interaction.options.getUser('usuario');

            const logs  = db.prepare('SELECT * FROM mod_logs WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, target.id);
            const warns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, target.id);

            const { embed, components } = buildHistoryPanel(logs, warns, target, 0, 'all');
            return interaction.editReply({ embeds: [embed], components });
        }
    }
};