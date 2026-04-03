const {
    Events, ChannelType, PermissionsBitField, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, StringSelectMenuBuilder
} = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const db = require('../database/db');
const { buildWarnPanel } = require('../commands/admin/warn');
const { buildHistoryPanel } = require('../commands/admin/mod');
const { buildLeaderboard } = require('../commands/utility/leaderboard');
const { buildEmbed, buildVoteRow } = require('../utils/suggestHelpers');
const { checkAndUnlock } = require('../commands/economy/achievements');


// ══════════════════════════════════════════════════════════
// HELPER: Crear canal de ticket
// ══════════════════════════════════════════════════════════
async function createTicketChannel(interaction, settings, ticketType = null) {
    db.prepare('UPDATE guild_settings SET ticket_count = ticket_count + 1 WHERE guild_id = ?').run(interaction.guild.id);
    const updated = db.prepare('SELECT ticket_count FROM guild_settings WHERE guild_id = ?').get(interaction.guild.id);
    const ticketNumber = String(updated?.ticket_count || 1).padStart(4, '0');

    const channel = await interaction.guild.channels.create({
        name: `ticket-${ticketNumber}`,
        type: ChannelType.GuildText,
        topic: `Ticket de ${interaction.user.tag} | ID: ${interaction.user.id}${ticketType ? ` | Tipo: ${ticketType}` : ''}`,
        parent: settings?.ticket_category || null,
        permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            ...(settings?.staff_role ? [{ id: settings.staff_role, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : [])
        ],
    });

    const welcomeEmbed = new EmbedBuilder()
        .setTitle(`🎫 Ticket #${ticketNumber}`)
        .setDescription(settings?.ticket_welcome_msg || 'Bienvenido, un moderador te atenderá pronto.')
        .setColor('#2ECC71')
        .addFields(
            { name: '👤 Usuario', value: `${interaction.user}`, inline: true },
            ...(ticketType ? [{ name: '📋 Tipo', value: ticketType, inline: true }] : [])
        )
        .setFooter({ text: 'Usa los botones de abajo para gestionar el ticket.' })
        .setTimestamp();

    const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_ticket').setLabel('Reclamar').setStyle(ButtonStyle.Primary).setEmoji('👋'),
        new ButtonBuilder().setCustomId('close_ticket_request').setLabel('Cerrar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
    );

    await channel.send({
        content: settings?.staff_role ? `<@&${settings.staff_role}>` : null,
        embeds: [welcomeEmbed],
        components: [closeRow]
    });

    return channel;
}


// ══════════════════════════════════════════════════════════
// EVENTO PRINCIPAL
// ══════════════════════════════════════════════════════════
module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {


        // ════════════════════════════════════════
        // 1. COMANDOS SLASH
        // ════════════════════════════════════════
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error('❌ Error en comando:', error);
                const replyFn = interaction.deferred || interaction.replied
                    ? interaction.followUp.bind(interaction)
                    : interaction.reply.bind(interaction);
                await replyFn({ content: '❌ Error ejecutando comando.', flags: [MessageFlags.Ephemeral] });
            }
            return;
        }


        // ════════════════════════════════════════
        // 2. MENÚS DESPLEGABLES
        // ════════════════════════════════════════
        if (interaction.isStringSelectMenu()) {

            // ── Help ──────────────────────────────
            if (interaction.customId === 'help_menu') {
                const category = interaction.values[0];

                const CATEGORY_META = {
                    admin: { label: 'Administración', emoji: '🛡️', color: 0xED4245 },
                    utility: { label: 'Utilidad', emoji: '🛠️', color: 0x5865F2 },
                    economy: { label: 'Economía', emoji: '💰', color: 0xF1C40F },
                    fun: { label: 'Diversión', emoji: '🎮', color: 0x57F287 },
                    music: { label: 'Música', emoji: '🎵', color: 0x1DB954 },
                };
                const meta = CATEGORY_META[category]
                    ?? { label: category.charAt(0).toUpperCase() + category.slice(1), emoji: '📁', color: 0x99AAB5 };

                const cmds = interaction.client.commands.filter(cmd => cmd.category === category);
                const displayCommands = cmds.size
                    ? cmds.map(cmd => `> \`/${cmd.data.name}\`\n> ${cmd.data.description}`).join('\n\n')
                    : '*No hay comandos registrados en esta sección.*';

                // Reconstruir menú con la opción activa marcada como default
                const categoryCounts = {};
                interaction.client.commands.forEach(cmd => {
                    const cat = cmd.category ?? 'sin categoría';
                    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
                });
                const ORDER = ['admin', 'utility', 'economy', 'fun', 'music'];
                const sortedCats = [
                    ...ORDER.filter(c => categoryCounts[c] !== undefined),
                    ...Object.keys(categoryCounts).filter(c => !ORDER.includes(c)).sort(),
                ];
                const menuOptions = sortedCats.map(cat => {
                    const m = CATEGORY_META[cat]
                        ?? { label: cat.charAt(0).toUpperCase() + cat.slice(1), emoji: '📁' };
                    return {
                        label: m.label,
                        description: `${categoryCounts[cat]} comando${categoryCounts[cat] !== 1 ? 's' : ''} disponibles.`,
                        value: cat,
                        emoji: m.emoji,
                        default: cat === category,
                    };
                });

                const helpEmbed = new EmbedBuilder()
                    .setTitle(`${meta.emoji} ${meta.label} — ${cmds.size} comando${cmds.size !== 1 ? 's' : ''}`)
                    .setDescription(displayCommands)
                    .setColor(meta.color)
                    .setFooter({ text: `Solicitado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();

                return interaction.update({
                    embeds: [helpEmbed],
                    components: [new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('help_menu')
                            .setPlaceholder('📂 Selecciona una categoría...')
                            .addOptions(menuOptions)
                    )],
                });
            }

            // ── Tipo de ticket ────────────────────
            if (interaction.customId === 'ticket_type_select') {
                await interaction.deferUpdate();
                const ticketTypeValue = interaction.values[0];
                const settings = db.prepare('SELECT ticket_welcome_msg, staff_role, ticket_category, ticket_count, ticket_types FROM guild_settings WHERE guild_id = ?').get(interaction.guild.id);

                const typeLabel = settings?.ticket_types
                    ? settings.ticket_types.split(',').map(t => t.trim()).find(t => t.toLowerCase().replace(/\s/g, '_') === ticketTypeValue) || ticketTypeValue
                    : ticketTypeValue;

                const channel = await createTicketChannel(interaction, settings, typeLabel);
                return interaction.editReply({ content: `✅ Ticket abierto en ${channel}`, components: [] });
            }

            // ── Warn panel: eliminar warn específico ──
            if (interaction.customId.startsWith('warn_delete_select:')) {
                const [, userId, pageStr] = interaction.customId.split(':');
                const warnId = parseInt(interaction.values[0]);
                const guildId = interaction.guild.id;

                const warn = db.prepare('SELECT * FROM warns WHERE id = ? AND guild_id = ?').get(warnId, guildId);
                if (!warn) return interaction.update({ content: '❌ Esta advertencia ya no existe.', embeds: [], components: [] });

                db.prepare('DELETE FROM warns WHERE id = ?').run(warnId);

                const target = await interaction.client.users.fetch(userId).catch(() => null);
                if (!target) return interaction.update({ content: '✅ Advertencia eliminada.', embeds: [], components: [] });

                const warns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
                const totalPages = Math.ceil(warns.length / 5);
                const newPage = Math.min(parseInt(pageStr), Math.max(totalPages - 1, 0));
                const { embed, components } = buildWarnPanel(warns, target, newPage);

                return interaction.update({ content: `✅ Advertencia \`#${warnId}\` eliminada.`, embeds: [embed], components });
            }

            // ── Mod history: filtrar por tipo ──────
            if (interaction.customId.startsWith('mod_history_filter:')) {
                const [, userId] = interaction.customId.split(':');
                const filter = interaction.values[0];
                const guildId = interaction.guild.id;

                const target = await interaction.client.users.fetch(userId).catch(() => null);
                if (!target) return interaction.update({ content: '❌ Usuario no encontrado.', embeds: [], components: [] });

                const logs = db.prepare('SELECT * FROM mod_logs WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
                const warns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
                const { embed, components } = buildHistoryPanel(logs, warns, target, 0, filter);

                return interaction.update({ content: null, embeds: [embed], components });
            }

            // ── Mod history: eliminar entrada específica ──
            if (interaction.customId.startsWith('mod_history_delete:')) {
                const [, userId, pageStr, filter] = interaction.customId.split(':');
                const [source, id] = interaction.values[0].split(':');
                const guildId = interaction.guild.id;

                if (source === 'mod') db.prepare('DELETE FROM mod_logs WHERE id = ? AND guild_id = ?').run(parseInt(id), guildId);
                if (source === 'warn') db.prepare('DELETE FROM warns WHERE id = ? AND guild_id = ?').run(parseInt(id), guildId);

                const target = await interaction.client.users.fetch(userId).catch(() => null);
                if (!target) return interaction.update({ content: '✅ Entrada eliminada.', embeds: [], components: [] });

                const logs = db.prepare('SELECT * FROM mod_logs WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
                const warns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
                const totalPages = Math.ceil((logs.length + warns.length) / 4);
                const newPage = Math.min(parseInt(pageStr), Math.max(totalPages - 1, 0));
                const { embed, components } = buildHistoryPanel(logs, warns, target, newPage, filter);

                return interaction.update({ content: `✅ Entrada \`#${id}\` eliminada.`, embeds: [embed], components });
            }

            return;
        }


        // ════════════════════════════════════════
        // 3. BOTONES
        // ════════════════════════════════════════
        if (interaction.isButton()) {
            try {

                // ── TICKETS ──────────────────────────────────────────────

                if (interaction.customId === 'open_ticket') {
                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

                    const existingChannel = interaction.guild.channels.cache.find(
                        c => c.topic?.includes(`ID: ${interaction.user.id}`) && c.type === ChannelType.GuildText
                    );
                    if (existingChannel) return interaction.editReply({ content: `⚠️ Ya tienes un ticket abierto: ${existingChannel}.` });

                    const settings = db.prepare('SELECT ticket_welcome_msg, staff_role, ticket_category, ticket_count, ticket_types FROM guild_settings WHERE guild_id = ?').get(interaction.guild.id);

                    if (settings?.ticket_types) {
                        const types = settings.ticket_types.split(',').map(t => t.trim()).filter(Boolean);
                        if (types.length > 0) {
                            const selectMenu = new StringSelectMenuBuilder()
                                .setCustomId('ticket_type_select')
                                .setPlaceholder('📋 Selecciona el motivo de tu consulta...')
                                .addOptions(types.map(t => ({
                                    label: t,
                                    value: t.toLowerCase().replace(/\s/g, '_'),
                                    emoji: '🎫'
                                })));
                            return interaction.editReply({ content: '**¿Cuál es el motivo de tu ticket?**', components: [new ActionRowBuilder().addComponents(selectMenu)] });
                        }
                    }

                    const channel = await createTicketChannel(interaction, settings, null);
                    return interaction.editReply({ content: `✅ Ticket abierto en ${channel}` });
                }

                if (interaction.customId === 'claim_ticket') {
                    const settings = db.prepare('SELECT staff_role FROM guild_settings WHERE guild_id = ?').get(interaction.guild.id);
                    if (settings?.staff_role && !interaction.member.roles.cache.has(settings.staff_role)) {
                        return interaction.reply({ content: '❌ Solo el staff puede reclamar tickets.', flags: [MessageFlags.Ephemeral] });
                    }

                    const updatedRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('claim_ticket').setLabel(`Reclamado por ${interaction.user.username}`).setStyle(ButtonStyle.Secondary).setEmoji('✅').setDisabled(true),
                        new ButtonBuilder().setCustomId('close_ticket_request').setLabel('Cerrar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                    );

                    await interaction.message.edit({ components: [updatedRow] });
                    return interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setDescription(`✋ **Ticket reclamado** por ${interaction.user} — El equipo de soporte ya está al tanto.`)
                            .setColor('#3498DB')
                            .setTimestamp()
                        ]
                    });
                }

                if (interaction.customId === 'close_ticket_request') {
                    const actionRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('confirm_close').setLabel('Cerrar y Transcribir').setStyle(ButtonStyle.Danger).setEmoji('📄'),
                        new ButtonBuilder().setCustomId('close_only').setLabel('Solo Cerrar').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
                        new ButtonBuilder().setCustomId('cancel_action').setLabel('Cancelar').setStyle(ButtonStyle.Success).setEmoji('↩️')
                    );
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setTitle('🛠️ Gestión del Ticket').setDescription('¿Qué acción deseas realizar?').setColor('#E74C3C')],
                        components: [actionRow]
                    });
                }

                if (interaction.customId === 'confirm_close') {
                    await interaction.deferUpdate();
                    const channel = interaction.channel;
                    const settings = db.prepare('SELECT ticket_log_channel, ticket_dm_preference FROM guild_settings WHERE guild_id = ?').get(interaction.guild.id);

                    const attachment = await discordTranscripts.createTranscript(channel, {
                        limit: -1, fileName: `Respaldo-${channel.name}.html`, saveImages: true, poweredBy: false
                    });

                    const ownerId = channel.topic?.match(/ID: (\d+)/)?.[1];
                    const logEmbed = new EmbedBuilder()
                        .setTitle('📄 Transcript Generado')
                        .addFields(
                            { name: '👤 Propietario', value: ownerId ? `<@${ownerId}>` : 'Desconocido', inline: true },
                            { name: '🔒 Cerrado por', value: interaction.user.tag, inline: true },
                            { name: '📂 Canal', value: channel.name, inline: true }
                        )
                        .setColor('#F1C40F').setTimestamp();

                    if (settings?.ticket_log_channel) {
                        const logChannel = interaction.guild.channels.cache.get(settings.ticket_log_channel);
                        if (logChannel) await logChannel.send({ embeds: [logEmbed], files: [attachment] });
                    }

                    if (settings?.ticket_dm_preference === 1) {
                        try {
                            const owner = ownerId ? await interaction.client.users.fetch(ownerId).catch(() => null) : interaction.user;
                            if (owner) await owner.send({ content: `👋 Aquí tienes el respaldo de tu consulta en **${interaction.guild.name}**.`, files: [attachment] });
                        } catch { console.log('DM bloqueado.'); }
                    }

                    await interaction.followUp({ content: '✅ Proceso finalizado. El canal se borrará en 5 segundos.' });
                    return setTimeout(() => channel.delete().catch(() => null), 5000);
                }

                if (interaction.customId === 'close_only') {
                    await interaction.deferUpdate();
                    await interaction.followUp({ content: '🔒 Cerrando sin transcript. El canal se eliminará en 5 segundos.' });
                    return setTimeout(() => interaction.channel.delete().catch(() => null), 5000);
                }

                if (interaction.customId === 'cancel_action') {
                    return interaction.message.delete();
                }

                // ── SORTEOS ──────────────────────────────────────────────

                if (interaction.customId === 'join_giveaway') {
                    const giveaway = db.prepare('SELECT participants, ended, required_role FROM giveaways WHERE message_id = ?').get(interaction.message.id);

                    if (!giveaway) return interaction.reply({ content: '❌ No se encontraron datos de este sorteo.', flags: [MessageFlags.Ephemeral] });
                    if (giveaway.ended) return interaction.reply({ content: '❌ Este sorteo ya ha finalizado.', flags: [MessageFlags.Ephemeral] });

                    if (giveaway.required_role && !interaction.member.roles.cache.has(giveaway.required_role)) {
                        return interaction.reply({ content: `❌ Necesitas el rol <@&${giveaway.required_role}> para participar.`, flags: [MessageFlags.Ephemeral] });
                    }

                    const participants = JSON.parse(giveaway.participants || '[]');
                    if (participants.includes(interaction.user.id)) {
                        return interaction.reply({ content: '⚠️ Ya estás participando en este sorteo.', flags: [MessageFlags.Ephemeral] });
                    }

                    participants.push(interaction.user.id);
                    db.prepare('UPDATE giveaways SET participants = ? WHERE message_id = ?').run(JSON.stringify(participants), interaction.message.id);
                    return interaction.reply({ content: '✅ ¡Te has registrado correctamente! Mucha suerte. 🎉', flags: [MessageFlags.Ephemeral] });
                }

                // ── WARN PANEL ───────────────────────────────────────────

                if (interaction.customId.startsWith('warn_page:')) {
                    const [, userId, pageStr] = interaction.customId.split(':');
                    const target = await interaction.client.users.fetch(userId).catch(() => null);
                    if (!target) return interaction.update({ content: '❌ Usuario no encontrado.', embeds: [], components: [] });

                    const warns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(interaction.guild.id, userId);
                    const { embed, components } = buildWarnPanel(warns, target, parseInt(pageStr));
                    return interaction.update({ content: null, embeds: [embed], components });
                }

                if (interaction.customId.startsWith('warn_clear_all:')) {
                    const [, userId] = interaction.customId.split(':');
                    const guildId = interaction.guild.id;
                    const count = db.prepare('SELECT COUNT(*) as count FROM warns WHERE guild_id = ? AND user_id = ?').get(guildId, userId).count;

                    db.prepare('DELETE FROM warns WHERE guild_id = ? AND user_id = ?').run(guildId, userId);

                    const target = await interaction.client.users.fetch(userId).catch(() => null);
                    if (!target) return interaction.update({ content: '🧹 Historial de warns limpiado.', embeds: [], components: [] });

                    const { embed, components } = buildWarnPanel([], target, 0);
                    return interaction.update({ content: `🧹 Se eliminaron **${count}** advertencias de **${target.username}**.`, embeds: [embed], components });
                }

                if (interaction.customId.startsWith('warn_refresh:')) {
                    const [, userId] = interaction.customId.split(':');
                    const target = await interaction.client.users.fetch(userId).catch(() => null);
                    if (!target) return interaction.update({ content: '❌ Usuario no encontrado.', embeds: [], components: [] });

                    const warns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(interaction.guild.id, userId);
                    const { embed, components } = buildWarnPanel(warns, target, 0);
                    return interaction.update({ content: null, embeds: [embed], components });
                }

                // ── MOD HISTORY ──────────────────────────────────────────

                if (interaction.customId.startsWith('mod_history_page:')) {
                    const [, userId, pageStr, filter] = interaction.customId.split(':');
                    const guildId = interaction.guild.id;

                    const target = await interaction.client.users.fetch(userId).catch(() => null);
                    if (!target) return interaction.update({ content: '❌ Usuario no encontrado.', embeds: [], components: [] });

                    const logs = db.prepare('SELECT * FROM mod_logs WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
                    const warns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
                    const { embed, components } = buildHistoryPanel(logs, warns, target, parseInt(pageStr), filter);
                    return interaction.update({ content: null, embeds: [embed], components });
                }

                if (interaction.customId.startsWith('mod_history_clear:')) {
                    const [, userId] = interaction.customId.split(':');
                    const guildId = interaction.guild.id;

                    const logsCount = db.prepare('SELECT COUNT(*) as count FROM mod_logs WHERE guild_id = ? AND user_id = ?').get(guildId, userId).count;
                    const warnsCount = db.prepare('SELECT COUNT(*) as count FROM warns WHERE guild_id = ? AND user_id = ?').get(guildId, userId).count;

                    db.prepare('DELETE FROM mod_logs WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
                    db.prepare('DELETE FROM warns WHERE guild_id = ? AND user_id = ?').run(guildId, userId);

                    const target = await interaction.client.users.fetch(userId).catch(() => null);
                    if (!target) return interaction.update({ content: '🧹 Historial limpiado completamente.', embeds: [], components: [] });

                    const { embed, components } = buildHistoryPanel([], [], target, 0, 'all');
                    return interaction.update({ content: `🧹 Se eliminaron **${logsCount + warnsCount}** registros de **${target.username}**.`, embeds: [embed], components });
                }

                if (interaction.customId.startsWith('mod_history_refresh:')) {
                    const [, userId] = interaction.customId.split(':');
                    const guildId = interaction.guild.id;

                    const target = await interaction.client.users.fetch(userId).catch(() => null);
                    if (!target) return interaction.update({ content: '❌ Usuario no encontrado.', embeds: [], components: [] });

                    const logs = db.prepare('SELECT * FROM mod_logs WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
                    const warns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
                    const { embed, components } = buildHistoryPanel(logs, warns, target, 0, 'all');
                    return interaction.update({ content: null, embeds: [embed], components });
                }

                // ── LEADERBOARD ──────────────────────────────────────────

                if (interaction.customId.startsWith('lb_page:')) {
                    const page = parseInt(interaction.customId.split(':')[1]);
                    const guildId = interaction.guild.id;

                    const entries = db.prepare('SELECT * FROM levels WHERE guild_id = ? ORDER BY level DESC, xp DESC').all(guildId);
                    const { embed, components } = buildLeaderboard(entries, interaction.guild, page);
                    return interaction.update({ embeds: [embed], components });
                }

                if (interaction.customId === 'lb_refresh') {
                    const guildId = interaction.guild.id;
                    const entries = db.prepare('SELECT * FROM levels WHERE guild_id = ? ORDER BY level DESC, xp DESC').all(guildId);
                    const { embed, components } = buildLeaderboard(entries, interaction.guild, 0);
                    return interaction.update({ embeds: [embed], components });
                }

                // ── SUGERENCIAS ──────────────────────────────────────────

                if (interaction.customId.startsWith('suggest_up_') || interaction.customId.startsWith('suggest_down_')) {
                    const isUp = interaction.customId.startsWith('suggest_up_');
                    const id = parseInt(interaction.customId.split('_')[2]);
                    const userId = interaction.user.id;

                    const sug = db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id);
                    if (!sug || sug.status !== 'pending') {
                        return interaction.reply({ content: '❌ Esta sugerencia ya no está activa.', ephemeral: true });
                    }

                    let up = JSON.parse(sug.votes_up);
                    let down = JSON.parse(sug.votes_down);

                    up = up.filter(u => u !== userId);
                    down = down.filter(u => u !== userId);

                    if (isUp) up.push(userId);
                    else down.push(userId);

                    db.prepare('UPDATE suggestions SET votes_up = ?, votes_down = ? WHERE id = ?')
                        .run(JSON.stringify(up), JSON.stringify(down), id);

                    const author = await interaction.client.users.fetch(sug.author_id).catch(() => null);

                    return interaction.update({
                        embeds: [buildEmbed(author, sug.content, id, up, down)],
                        components: [buildVoteRow(id, up.length, down.length)]
                    });
                }

                // ── REPORTES ─────────────────────────────────────────────

                if (interaction.customId.startsWith('report_resolve_') ||
                    interaction.customId.startsWith('report_mute_') ||
                    interaction.customId.startsWith('report_ban_') ||
                    interaction.customId.startsWith('report_dismiss_')) {

                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                        return interaction.reply({ content: '❌ Solo el staff puede gestionar reportes.', flags: [MessageFlags.Ephemeral] });
                    }

                    const parts = interaction.customId.split('_');
                    const action = parts[1]; // resolve, mute, ban, dismiss
                    const reportId = parseInt(parts[2]);

                    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
                    if (!report || report.status !== 'pending') {
                        return interaction.reply({ content: '❌ Este reporte ya fue gestionado.', flags: [MessageFlags.Ephemeral] });
                    }

                    const statusMap = {
                        resolve: { status: 'resolved', label: '✅ Resuelto', color: '#57F287' },
                        mute: { status: 'muted', label: '🔇 Muteado', color: '#FEE75C' },
                        ban: { status: 'banned', label: '🔨 Baneado', color: '#ED4245' },
                        dismiss: { status: 'dismissed', label: '❌ Descartado', color: '#95A5A6' }
                    };

                    const { status, label, color } = statusMap[action];
                    db.prepare('UPDATE reports SET status = ?, handled_by = ? WHERE id = ?').run(status, interaction.user.id, reportId);

                    // Ejecutar acción si aplica
                    if (action === 'mute' || action === 'ban') {
                        const targetMember = await interaction.guild.members.fetch(report.reported_id).catch(() => null);
                        if (targetMember) {
                            if (action === 'mute') {
                                await targetMember.timeout(10 * 60 * 1000, `Reporte #${reportId} gestionado por ${interaction.user.tag}`).catch(() => null);
                            }
                            if (action === 'ban') {
                                await targetMember.ban({ reason: `Reporte #${reportId} gestionado por ${interaction.user.tag}` }).catch(() => null);
                            }
                        }
                    }

                    // Actualizar embed
                    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor(color)
                        .spliceFields(5, 1, {
                            name: '📊 Estado',
                            value: `${label} por ${interaction.user}`,
                            inline: true
                        });

                    await interaction.update({ embeds: [updatedEmbed], components: [] });
                }

                // ── POLLS ─────────────────────────────────────────────────────────────────

                if (interaction.customId.startsWith('poll_vote_')) {
                    const parts = interaction.customId.split('_');  // poll_vote_{id}_{idx}
                    const pollId = parseInt(parts[2]);
                    const optIdx = parseInt(parts[3]);

                    const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
                    if (!poll || poll.ended) {
                        return interaction.reply({ content: '❌ Esta encuesta ya está cerrada.', flags: [MessageFlags.Ephemeral] });
                    }

                    const voters = JSON.parse(poll.voters);
                    const votes = JSON.parse(poll.votes);
                    const userId = interaction.user.id;

                    // Quitar voto anterior si ya votó
                    for (const key of Object.keys(votes)) {
                        votes[key] = votes[key].filter(u => u !== userId);
                    }

                    // Verificar si ya votó por la misma opción (toggle)
                    const alreadyVoted = voters.includes(userId) && !votes[String(optIdx)].includes(userId);

                    if (!voters.includes(userId)) voters.push(userId);
                    votes[String(optIdx)].push(userId);

                    db.prepare('UPDATE polls SET votes = ?, voters = ? WHERE id = ?')
                        .run(JSON.stringify(votes), JSON.stringify(voters), pollId);

                    const updated = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
                    const opts = JSON.parse(updated.options);

                    const { buildPollEmbed, buildPollButtons } = require('../commands/utility/poll');

                    return interaction.update({
                        embeds: [buildPollEmbed(updated, interaction.guild)],
                        components: buildPollButtons(pollId, opts)
                    });
                }

                if (interaction.customId.startsWith('poll_results_')) {
                    const pollId = parseInt(interaction.customId.split('_')[2]);
                    const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
                    if (!poll) return interaction.reply({ content: '❌ Encuesta no encontrada.', flags: [MessageFlags.Ephemeral] });

                    const { buildPollEmbed } = require('../commands/utility/poll');
                    return interaction.reply({
                        embeds: [buildPollEmbed(poll, interaction.guild)],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                if (interaction.customId.startsWith('poll_close_')) {
                    const pollId = parseInt(interaction.customId.split('_')[2]);
                    const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
                    if (!poll || poll.ended) return interaction.reply({ content: '❌ Esta encuesta ya está cerrada.', flags: [MessageFlags.Ephemeral] });

                    if (poll.author_id !== interaction.user.id && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                        return interaction.reply({ content: '❌ Solo el autor o un moderador puede cerrar esta encuesta.', flags: [MessageFlags.Ephemeral] });
                    }

                    db.prepare('UPDATE polls SET ended = 1 WHERE id = ?').run(pollId);
                    const updated = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
                    const opts = JSON.parse(updated.options);

                    const { buildPollEmbed, buildPollButtons } = require('../commands/utility/poll');

                    return interaction.update({
                        embeds: [buildPollEmbed(updated, interaction.guild)],
                        components: buildPollButtons(pollId, opts, true)
                    });
                }

                // ── EVENTOS ───────────────────────────────────────────────────────────────

                if (interaction.customId.startsWith('event_join_') ||
                    interaction.customId.startsWith('event_leave_') ||
                    interaction.customId.startsWith('event_attendees_') ||
                    interaction.customId.startsWith('event_start_') ||
                    interaction.customId.startsWith('event_finish_') ||
                    interaction.customId.startsWith('event_cancel_')) {

                    const parts = interaction.customId.split('_');
                    const action = parts[1];
                    const eventId = parseInt(parts[2]);
                    const userId = interaction.user.id;

                    const event = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);
                    if (!event) return interaction.reply({ content: '❌ Evento no encontrado.', flags: [MessageFlags.Ephemeral] });

                    const { buildEventEmbed, buildEventButtons } = require('../commands/utility/event');
                    const attendees = JSON.parse(event.attendees || '[]');

                    // ── Asistir ──
                    if (action === 'join') {
                        if (['finished', 'cancelled'].includes(event.status))
                            return interaction.reply({ content: '❌ Este evento ya no acepta asistentes.', flags: [MessageFlags.Ephemeral] });
                        if (attendees.includes(userId))
                            return interaction.reply({ content: '⚠️ Ya estás inscrito en este evento.', flags: [MessageFlags.Ephemeral] });
                        if (event.max_attendees > 0 && attendees.length >= event.max_attendees)
                            return interaction.reply({ content: '❌ Este evento ya está lleno.', flags: [MessageFlags.Ephemeral] });

                        attendees.push(userId);
                        db.prepare('UPDATE server_events SET attendees = ? WHERE id = ?').run(JSON.stringify(attendees), eventId);
                        const updated = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);
                        await interaction.update({ embeds: [buildEventEmbed(updated, interaction.guild)], components: buildEventButtons(eventId, updated.status, userId, event.author_id) });
                        return interaction.followUp({ content: '✅ ¡Te has inscrito en el evento!', flags: [MessageFlags.Ephemeral] });
                    }

                    // ── Cancelar asistencia ──
                    if (action === 'leave') {
                        if (!attendees.includes(userId))
                            return interaction.reply({ content: '⚠️ No estás inscrito en este evento.', flags: [MessageFlags.Ephemeral] });

                        const newAttendees = attendees.filter(id => id !== userId);
                        db.prepare('UPDATE server_events SET attendees = ? WHERE id = ?').run(JSON.stringify(newAttendees), eventId);
                        const updated = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);
                        await interaction.update({ embeds: [buildEventEmbed(updated, interaction.guild)], components: buildEventButtons(eventId, updated.status, userId, event.author_id) });
                        return interaction.followUp({ content: '✅ Has cancelado tu asistencia.', flags: [MessageFlags.Ephemeral] });
                    }

                    // ── Ver asistentes ──
                    if (action === 'attendees') {
                        if (!attendees.length)
                            return interaction.reply({ content: '❌ Nadie se ha inscrito todavía.', flags: [MessageFlags.Ephemeral] });

                        const list = attendees.map((id, i) => `${i + 1}. <@${id}>`).join('\n');
                        return interaction.reply({
                            embeds: [new EmbedBuilder()
                                .setTitle(`👥 Asistentes — ${event.title}`)
                                .setColor('#5865F2')
                                .setDescription(list.slice(0, 2000))
                                .setFooter({ text: `${attendees.length} inscrito(s)` })
                            ],
                            flags: [MessageFlags.Ephemeral]
                        });
                    }

                    // ── Iniciar ──
                    if (action === 'start') {
                        if (event.author_id !== userId && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageEvents))
                            return interaction.reply({ content: '❌ Solo el organizador puede iniciar este evento.', flags: [MessageFlags.Ephemeral] });
                        if (event.status !== 'upcoming')
                            return interaction.reply({ content: '❌ Este evento no puede iniciarse.', flags: [MessageFlags.Ephemeral] });

                        db.prepare("UPDATE server_events SET status = 'ongoing' WHERE id = ?").run(eventId);
                        const updated = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);
                        return interaction.update({ embeds: [buildEventEmbed(updated, interaction.guild)], components: buildEventButtons(eventId, 'ongoing', userId, event.author_id) });
                    }

                    // ── Finalizar ──
                    if (action === 'finish') {
                        if (event.author_id !== userId && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageEvents))
                            return interaction.reply({ content: '❌ Solo el organizador puede finalizar este evento.', flags: [MessageFlags.Ephemeral] });
                        if (event.status !== 'ongoing')
                            return interaction.reply({ content: '❌ Solo se puede finalizar un evento en curso.', flags: [MessageFlags.Ephemeral] });

                        db.prepare("UPDATE server_events SET status = 'finished' WHERE id = ?").run(eventId);
                        const updated = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);
                        return interaction.update({ embeds: [buildEventEmbed(updated, interaction.guild)], components: buildEventButtons(eventId, 'finished', userId, event.author_id) });
                    }

                    // ── Cancelar ──
                    if (action === 'cancel') {
                        if (event.author_id !== userId && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageEvents))
                            return interaction.reply({ content: '❌ Solo el organizador puede cancelar este evento.', flags: [MessageFlags.Ephemeral] });
                        if (['finished', 'cancelled'].includes(event.status))
                            return interaction.reply({ content: '❌ Este evento ya está finalizado o cancelado.', flags: [MessageFlags.Ephemeral] });

                        db.prepare("UPDATE server_events SET status = 'cancelled' WHERE id = ?").run(eventId);
                        const updated = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);
                        return interaction.update({ embeds: [buildEventEmbed(updated, interaction.guild)], components: buildEventButtons(eventId, 'cancelled', userId, event.author_id) });
                    }
                }

                // ── AHORCADO ──────────────────────────────────────────────────────────────
                if (interaction.customId.startsWith('hm_letter_')) {
                    const parts = interaction.customId.split('_');
                    const gameId = `${parts[2]}_${parts[3]}`;
                    const letter = parts[4];

                    const { sessions, buildEmbed, buildLetterRows } = require('../commands/fun/hangman');
                    const state = sessions.get(gameId);

                    if (!state) return interaction.reply({ content: '❌ Esta partida ya no está activa.', flags: [MessageFlags.Ephemeral] });
                    if (state.userId !== interaction.user.id) return interaction.reply({ content: '❌ Esta no es tu partida.', flags: [MessageFlags.Ephemeral] });

                    state.guessed.push(letter);
                    if (!state.word.includes(letter)) {
                        state.failed.push(letter);
                        state.stage++;
                    }

                    const isWin = state.word.split('').every(l => state.guessed.includes(l));
                    const isLose = state.stage >= 6;

                    const embed = buildEmbed(state);
                    const rows = isWin || isLose
                        ? []
                        : buildLetterRows(gameId, state.guessed, state.failed);

                    if (isWin || isLose) sessions.delete(gameId);

                    return interaction.update({ embeds: [embed], components: rows });
                }

                // ── TICTACTOE ─────────────────────────────────────────────────────────────
                if (interaction.customId.startsWith('ttt_move_')) {
                    const parts = interaction.customId.split('_');
                    const gameId = `${parts[2]}_${parts[3]}`;
                    const cell = parseInt(parts[4]);

                    const { games, buildBoard, buildEmbed, checkWin } = require('../commands/fun/tictactoe');
                    const state = games.get(gameId);

                    if (!state) return interaction.reply({ content: '❌ Esta partida ya no está activa.', flags: [MessageFlags.Ephemeral] });
                    if (interaction.user.id !== state.turn.id) return interaction.reply({ content: '❌ No es tu turno.', flags: [MessageFlags.Ephemeral] });
                    if (state.board[cell]) return interaction.reply({ content: '❌ Esa celda ya está ocupada.', flags: [MessageFlags.Ephemeral] });

                    const mark = state.marks[interaction.user.id];
                    state.board[cell] = mark;

                    const isWin = checkWin(state.board, mark);
                    const isDraw = !isWin && state.board.every(c => c !== null);

                    if (isWin) {
                        state.winner = interaction.user;
                        games.delete(gameId);
                        return interaction.update({
                            content: `🏆 ¡**${interaction.user.username}** ganó la partida!`,
                            embeds: [buildEmbed(state, 'win')],
                            components: buildBoard(gameId, state.board, true)
                        });
                    }

                    if (isDraw) {
                        games.delete(gameId);
                        return interaction.update({
                            content: '🤝 ¡Empate!',
                            embeds: [buildEmbed(state, 'draw')],
                            components: buildBoard(gameId, state.board, true)
                        });
                    }

                    // Cambiar turno
                    state.turn = state.turn.id === state.p1.id ? state.p2 : state.p1;

                    return interaction.update({
                        content: `Turno de ${state.turn} ${state.marks[state.turn.id]}`,
                        embeds: [buildEmbed(state)],
                        components: buildBoard(gameId, state.board)
                    });
                }

                // ── TRIVIA ────────────────────────────────────────────────────────────────
                if (interaction.customId.startsWith('trivia_ans_')) {
                    const parts = interaction.customId.split('_');
                    const sessionId = `${parts[2]}_${parts[3]}`;
                    const optIdx = parseInt(parts[4]);

                    const { activeSessions } = require('../commands/fun/trivia');
                    const session = activeSessions.get(sessionId);

                    if (!session) return interaction.reply({ content: '❌ Esta pregunta ya expiró.', flags: [MessageFlags.Ephemeral] });
                    if (session.userId !== interaction.user.id) return interaction.reply({ content: '❌ Esta no es tu pregunta.', flags: [MessageFlags.Ephemeral] });
                    if (session.answered) return interaction.reply({ content: '⚠️ Ya respondiste.', flags: [MessageFlags.Ephemeral] });

                    session.answered = true;
                    activeSessions.delete(sessionId);

                    const chosen = session.shuffled[optIdx];
                    const isRight = String(chosen) === String(session.answer);
                    const timeTaken = ((Date.now() - session.startTime) / 1000).toFixed(1);
                    const guildId = interaction.guild.id;
                    const userId = interaction.user.id;

                    // Actualizar stats
                    if (isRight) {
                        db.prepare(`
            INSERT INTO trivia_stats (guild_id, user_id, correct, streak, best_streak)
            VALUES (?, ?, 1, 1, 1)
            ON CONFLICT(guild_id, user_id) DO UPDATE SET
                correct     = correct + 1,
                streak      = streak + 1,
                best_streak = MAX(best_streak, streak + 1)
        `).run(guildId, userId);
                    } else {
                        db.prepare(`
            INSERT INTO trivia_stats (guild_id, user_id, wrong, streak)
            VALUES (?, ?, 1, 0)
            ON CONFLICT(guild_id, user_id) DO UPDATE SET wrong = wrong + 1, streak = 0
        `).run(guildId, userId);
                    }

                    const stats = db.prepare('SELECT streak, best_streak FROM trivia_stats WHERE guild_id = ? AND user_id = ?').get(guildId, userId);

                    const embed = new EmbedBuilder()
                        .setTitle(`${session.question.cat} — Trivia`)
                        .setColor(isRight ? '#57F287' : '#ED4245')
                        .setDescription(
                            `## ${session.question.q}\n\n` +
                            (isRight ? `✅ **¡Correcto!**` : `❌ **Incorrecto.** La respuesta era: **${session.answer}**`)
                        )
                        .addFields(
                            { name: '🎯 Tu respuesta', value: `\`${chosen}\``, inline: true },
                            { name: '⏱️ Tiempo', value: `\`${timeTaken}s\``, inline: true },
                            { name: '🔥 Racha', value: `\`${stats?.streak || 0}\``, inline: true }
                        )
                        .setFooter({ text: interaction.user.tag })
                        .setTimestamp();

                    if (isRight) {
                        const triviaStats = db.prepare('SELECT correct, streak FROM trivia_stats WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
                        checkAndUnlock(guildId, userId, 'trivia_correct', triviaStats?.correct || 1, interaction.client);
                        checkAndUnlock(guildId, userId, 'trivia_streak', triviaStats?.streak || 1, interaction.client);
                    }

                    return interaction.update({ embeds: [embed], components: [] });
                }

                // ── Profile reset confirm/cancel ──────────────────────────────────────────
                if (interaction.customId.startsWith('profile_reset_')) {
                    const [, , action, , ownerId] = interaction.customId.split('_');
                    // Realmente: profile_reset_confirm_userId → split da ['profile','reset','confirm',userId]
                    const parts = interaction.customId.split('_');
                    const act = parts[2];          // confirm | cancel
                    const owner = parts[3];          // userId

                    if (interaction.user.id !== owner) {
                        return interaction.reply({ content: '❌ Este botón no es tuyo.', flags: [MessageFlags.Ephemeral] });
                    }

                    if (act === 'cancel') {
                        return interaction.update({
                            embeds: [new EmbedBuilder().setColor('#57F287').setDescription('✅ Reset cancelado.')],
                            components: []
                        });
                    }

                    if (act === 'confirm') {
                        db.prepare(`
                        UPDATE profiles SET bio = '', color = '#5865F2', banner_url = NULL,
                        timezone = 'UTC', birthday_show = 1, fav_emoji = '⭐', socials = '{}'
                        WHERE guild_id = ? AND user_id = ?
                        `).run(interaction.guild.id, owner);

                        return interaction.update({
                            embeds: [new EmbedBuilder().setColor('#57F287').setDescription('🔄 Perfil reseteado correctamente.')],
                            components: []
                        });
                    }
                }

                // ── Pet buttons (feed/play/sleep desde /pet status) ───────────────────────
                if (interaction.customId.startsWith('pet_feed_') ||
                    interaction.customId.startsWith('pet_play_') ||
                    interaction.customId.startsWith('pet_sleep_')) {

                    const parts = interaction.customId.split('_');
                    const action = parts[1];   // feed | play | sleep
                    const owner = parts[2];

                    if (interaction.user.id !== owner) {
                        return interaction.reply({ content: '❌ Esta mascota no es tuya.', flags: [MessageFlags.Ephemeral] });
                    }

                    // Redirigir al subcommand correspondiente simulando la interacción
                    interaction.options = { getSubcommand: () => action, getUser: () => null };
                    return require('../commands/economy/pet').execute(interaction);
                }

                // ── Pet release confirm/cancel ─────────────────────────────────────────────
                if (interaction.customId.startsWith('pet_release_')) {
                    const parts = interaction.customId.split('_');
                    const action = parts[2];   // confirm | cancel
                    const owner = parts[3];

                    if (interaction.user.id !== owner) {
                        return interaction.reply({ content: '❌ Este botón no es tuyo.', flags: [MessageFlags.Ephemeral] });
                    }

                    if (action === 'cancel') {
                        return interaction.update({
                            embeds: [new EmbedBuilder().setColor('#57F287').setDescription('✅ Cancelado. Tu mascota sigue contigo.')],
                            components: []
                        });
                    }

                    if (action === 'confirm') {
                        const pet = db.prepare('SELECT * FROM pets WHERE guild_id = ? AND user_id = ?').get(interaction.guild.id, owner);
                        db.prepare('DELETE FROM pets WHERE guild_id = ? AND user_id = ?').run(interaction.guild.id, owner);
                        return interaction.update({
                            embeds: [new EmbedBuilder().setColor('#ED4245')
                                .setDescription(`💔 **${pet?.emoji || '🐾'} ${pet?.name || 'Tu mascota'}** fue soltada. Adiós...`)],
                            components: []
                        });
                    }
                }

                // ── Reaction Roles button handler ─────────────────────────────────────────
                if (interaction.customId.startsWith('rr_')) {
                    const parts = interaction.customId.split('_');
                    const msgId = parts[1];
                    const roleId = parts[2];
                    const guildId = interaction.guild.id;

                    const panel = db.prepare('SELECT * FROM reaction_role_panels WHERE guild_id = ? AND message_id = ?').get(guildId, msgId);
                    if (!panel) return interaction.reply({ content: '❌ Este panel ya no existe.', flags: [MessageFlags.Ephemeral] });

                    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
                    if (!member) return;

                    const role = interaction.guild.roles.cache.get(roleId);
                    if (!role) return interaction.reply({ content: '❌ El rol ya no existe.', flags: [MessageFlags.Ephemeral] });

                    const hasRole = member.roles.cache.has(roleId);

                    if (panel.mode === 'unique') {
                        // Quitar todos los roles del panel antes de asignar el nuevo
                        const allRoles = db.prepare('SELECT role_id FROM reaction_roles WHERE guild_id = ? AND message_id = ?').all(guildId, msgId);
                        for (const r of allRoles) {
                            if (member.roles.cache.has(r.role_id)) {
                                await member.roles.remove(r.role_id).catch(() => null);
                            }
                        }
                        if (!hasRole) {
                            await member.roles.add(roleId).catch(() => null);
                            return interaction.reply({ content: `✅ Se te asignó el rol **${role.name}**.`, flags: [MessageFlags.Ephemeral] });
                        }
                        return interaction.reply({ content: `✅ Rol **${role.name}** removido.`, flags: [MessageFlags.Ephemeral] });
                    }

                    if (panel.mode === 'add') {
                        if (hasRole) return interaction.reply({ content: `ℹ️ Ya tienes el rol **${role.name}**.`, flags: [MessageFlags.Ephemeral] });
                        await member.roles.add(roleId).catch(() => null);
                        return interaction.reply({ content: `✅ Se te asignó el rol **${role.name}**.`, flags: [MessageFlags.Ephemeral] });
                    }

                    // toggle (default)
                    if (hasRole) {
                        await member.roles.remove(roleId).catch(() => null);
                        return interaction.reply({ content: `✅ Rol **${role.name}** removido.`, flags: [MessageFlags.Ephemeral] });
                    } else {
                        await member.roles.add(roleId).catch(() => null);
                        return interaction.reply({ content: `✅ Se te asignó el rol **${role.name}**.`, flags: [MessageFlags.Ephemeral] });
                    }
                }

                // ── Verify button ──────────────────────────────────────────────────────────
                if (interaction.customId.startsWith('verify_start_')) {
                    const guildId = interaction.guild.id;
                    const userId = interaction.user.id;

                    db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
                    const cfg = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);

                    if (!cfg.verify_enabled) {
                        return interaction.reply({ content: '❌ La verificación está desactivada.', flags: [MessageFlags.Ephemeral] });
                    }

                    const member = await interaction.guild.members.fetch(userId).catch(() => null);
                    if (cfg.verify_role && member?.roles.cache.has(cfg.verify_role)) {
                        return interaction.reply({ content: '✅ Ya estás verificado.', flags: [MessageFlags.Ephemeral] });
                    }

                    // Método: botón simple
                    if (cfg.verify_method === 'button') {
                        if (cfg.verify_role) await member?.roles.add(cfg.verify_role).catch(() => null);

                        db.prepare(`
            INSERT INTO verifications (guild_id, user_id, status, method, verified_at, timestamp)
            VALUES (?, ?, 'verified', 'button', ?, ?)
            ON CONFLICT(guild_id, user_id) DO UPDATE SET status = 'verified', method = 'button', verified_at = ?
        `).run(guildId, userId, Date.now(), Date.now(), Date.now());

                        // Log
                        if (cfg.verify_log_channel) {
                            const logCh = interaction.client.channels.cache.get(cfg.verify_log_channel);
                            logCh?.send({
                                embeds: [new EmbedBuilder()
                                    .setColor('#57F287')
                                    .setTitle('✅ Usuario Verificado')
                                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                                    .addFields(
                                        { name: '👤 Usuario', value: `${interaction.user.tag} (${userId})`, inline: true },
                                        { name: '🔧 Método', value: 'Botón', inline: true },
                                        { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
                                    )
                                    .setTimestamp()
                                ]
                            }).catch(() => null);
                        }

                        return interaction.reply({
                            embeds: [new EmbedBuilder().setColor('#57F287')
                                .setTitle('✅ ¡Verificado!')
                                .setDescription('Bienvenido al servidor. Ya tienes acceso completo.')
                            ],
                            flags: [MessageFlags.Ephemeral]
                        });
                    }

                    // Método: captcha
                    if (cfg.verify_method === 'captcha') {
                        const code = Math.floor(1000 + Math.random() * 9000).toString();

                        db.prepare(`
            INSERT INTO verifications (guild_id, user_id, status, method, code, attempts, timestamp)
            VALUES (?, ?, 'pending', 'captcha', ?, 0, ?)
            ON CONFLICT(guild_id, user_id) DO UPDATE SET status = 'pending', code = ?, attempts = 0
        `).run(guildId, userId, code, Date.now(), code);

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`verify_captcha_${guildId}_${userId}`)
                                .setLabel('🔢 Ingresar código')
                                .setStyle(ButtonStyle.Primary)
                        );

                        return interaction.reply({
                            embeds: [new EmbedBuilder()
                                .setColor('#FEE75C')
                                .setTitle('🔐 Captcha de verificación')
                                .setDescription(
                                    `Tu código de verificación es:\n\n` +
                                    `## \`${code.split('').join(' ')}\`\n\n` +
                                    `Haz clic en el botón e ingresa el código exacto.`
                                )
                                .setFooter({ text: 'Tienes 3 intentos.' })
                            ],
                            components: [row],
                            flags: [MessageFlags.Ephemeral]
                        });
                    }
                }

                // ── Verify captcha modal trigger ──────────────────────────────────────────
                if (interaction.customId.startsWith('verify_captcha_')) {
                    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
                    const parts = interaction.customId.split('_');
                    const guildId = parts[2];
                    const userId = parts[3];

                    const modal = new ModalBuilder()
                        .setCustomId(`verify_modal_${guildId}_${userId}`)
                        .setTitle('Verificación Captcha');

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('captcha_input')
                                .setLabel('Ingresa el código de 4 dígitos')
                                .setStyle(TextInputStyle.Short)
                                .setMinLength(4)
                                .setMaxLength(4)
                                .setRequired(true)
                        )
                    );

                    return interaction.showModal(modal);
                }

                // ── Verify captcha modal submit ───────────────────────────────────────────
                if (interaction.customId.startsWith('verify_modal_')) {
                    const parts = interaction.customId.split('_');
                    const guildId = parts[2];
                    const userId = parts[3];
                    const input = interaction.fields.getTextInputValue('captcha_input');

                    const record = db.prepare('SELECT * FROM verifications WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
                    if (!record) return interaction.reply({ content: '❌ Sesión expirada.', flags: [MessageFlags.Ephemeral] });

                    if (record.attempts >= 3) {
                        return interaction.reply({ content: '❌ Demasiados intentos fallidos. Usa el botón de verificación de nuevo.', flags: [MessageFlags.Ephemeral] });
                    }

                    if (input.trim() !== record.code) {
                        db.prepare('UPDATE verifications SET attempts = attempts + 1 WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
                        const left = 3 - (record.attempts + 1);
                        return interaction.reply({
                            content: `❌ Código incorrecto. Te quedan **${left}** intento(s).`,
                            flags: [MessageFlags.Ephemeral]
                        });
                    }

                    const cfg = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
                    const member = await interaction.guild.members.fetch(userId).catch(() => null);
                    if (cfg?.verify_role) await member?.roles.add(cfg.verify_role).catch(() => null);

                    db.prepare(`
                    UPDATE verifications SET status = 'verified', verified_at = ? WHERE guild_id = ? AND user_id = ?
                    `).run(Date.now(), guildId, userId);

                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('#57F287')
                            .setTitle('✅ ¡Código correcto!')
                            .setDescription('Has sido verificado. ¡Bienvenido al servidor!')
                        ],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                if (interaction.isButton()) {
                    // --- Botón "Otro meme" ---
                    if (interaction.customId.startsWith('meme_otro_')) {
                        const memeCmd = interaction.client.commands.get('meme');
                        if (memeCmd?.handleButton) return memeCmd.handleButton(interaction);
                    }
                }

            } catch (error) {
                console.error('❌ Error en interacción:', error);
                const errorFeedback = { content: '❌ Error técnico. Contacta al staff.', flags: [MessageFlags.Ephemeral] };
                if (interaction.replied || interaction.deferred) await interaction.editReply(errorFeedback);
                else await interaction.reply(errorFeedback);
            }
        }
    },
};