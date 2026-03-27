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
                const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
                const icons = { admin: '🛡️', utility: '🛠️' };

                const displayCommands = interaction.client.commands
                    .filter(cmd => cmd.category === category)
                    .map(cmd => `> \`/${cmd.data.name}\`\n ${cmd.data.description}`)
                    .join('\n\n');

                const helpEmbed = new EmbedBuilder()
                    .setTitle(`${icons[category] || '📁'} Categoría: ${categoryName}`)
                    .setDescription(displayCommands || '*No hay comandos registrados en esta sección.*')
                    .setColor('#5865F2')
                    .setFooter({ text: `Solicitado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();

                return interaction.update({ embeds: [helpEmbed] });
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

            } catch (error) {
                console.error('❌ Error en interacción:', error);
                const errorFeedback = { content: '❌ Error técnico. Contacta al staff.', flags: [MessageFlags.Ephemeral] };
                if (interaction.replied || interaction.deferred) await interaction.editReply(errorFeedback);
                else await interaction.reply(errorFeedback);
            }
        }
    },
};