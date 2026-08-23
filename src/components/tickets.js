const {
    ChannelType, PermissionsBitField, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, StringSelectMenuBuilder
} = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const db = require('../database/db');


// ════════════════════════════════════════════════════════════
// HELPER: Crear canal de ticket
// ════════════════════════════════════════════════════════════
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


module.exports = async function (interaction) {
    const { customId } = interaction;

    // ── Tipo de ticket (menú desplegable) ────────────────────
    if (interaction.isStringSelectMenu() && customId === 'ticket_type_select') {
        await interaction.deferUpdate();
        const ticketTypeValue = interaction.values[0];
        const settings = db.prepare('SELECT ticket_welcome_msg, staff_role, ticket_category, ticket_count, ticket_types FROM guild_settings WHERE guild_id = ?').get(interaction.guild.id);

        const typeLabel = settings?.ticket_types
            ? settings.ticket_types.split(',').map(t => t.trim()).find(t => t.toLowerCase().replace(/\s/g, '_') === ticketTypeValue) || ticketTypeValue
            : ticketTypeValue;

        const channel = await createTicketChannel(interaction, settings, typeLabel);
        await interaction.editReply({ content: `✅ Ticket abierto en ${channel}`, components: [] });
        return true;
    }

    if (!interaction.isButton()) return false;

    // ── Abrir ticket ─────────────────────────────────────────
    if (customId === 'open_ticket') {
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
                await interaction.editReply({ content: '**¿Cuál es el motivo de tu ticket?**', components: [new ActionRowBuilder().addComponents(selectMenu)] });
                return true;
            }
        }

        const channel = await createTicketChannel(interaction, settings, null);
        await interaction.editReply({ content: `✅ Ticket abierto en ${channel}` });
        return true;
    }

    // ── Reclamar ticket ──────────────────────────────────────
    if (customId === 'claim_ticket') {
        const settings = db.prepare('SELECT staff_role FROM guild_settings WHERE guild_id = ?').get(interaction.guild.id);
        if (settings?.staff_role && !interaction.member.roles.cache.has(settings.staff_role)) {
            await interaction.reply({ content: '❌ Solo el staff puede reclamar tickets.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        const updatedRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_ticket').setLabel(`Reclamado por ${interaction.user.username}`).setStyle(ButtonStyle.Secondary).setEmoji('✅').setDisabled(true),
            new ButtonBuilder().setCustomId('close_ticket_request').setLabel('Cerrar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await interaction.message.edit({ components: [updatedRow] });
        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setDescription(`✋ **Ticket reclamado** por ${interaction.user} — El equipo de soporte ya está al tanto.`)
                .setColor('#3498DB')
                .setTimestamp()
            ]
        });
        return true;
    }

    // ── Solicitar cierre ─────────────────────────────────────
    if (customId === 'close_ticket_request') {
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_close').setLabel('Cerrar y Transcribir').setStyle(ButtonStyle.Danger).setEmoji('📄'),
            new ButtonBuilder().setCustomId('close_only').setLabel('Solo Cerrar').setStyle(ButtonStyle.Secondary).setEmoji('🔒'),
            new ButtonBuilder().setCustomId('cancel_action').setLabel('Cancelar').setStyle(ButtonStyle.Success).setEmoji('↩️')
        );
        await interaction.reply({
            embeds: [new EmbedBuilder().setTitle('🛠️ Gestión del Ticket').setDescription('¿Qué acción deseas realizar?').setColor('#E74C3C')],
            components: [actionRow]
        });
        return true;
    }

    // ── Cerrar y transcribir ─────────────────────────────────
    if (customId === 'confirm_close') {
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
        setTimeout(() => channel.delete().catch(() => null), 5000);
        return true;
    }

    // ── Solo cerrar ──────────────────────────────────────────
    if (customId === 'close_only') {
        await interaction.deferUpdate();
        await interaction.followUp({ content: '🔒 Cerrando sin transcript. El canal se eliminará en 5 segundos.' });
        setTimeout(() => interaction.channel.delete().catch(() => null), 5000);
        return true;
    }

    // ── Cancelar acción ──────────────────────────────────────
    if (customId === 'cancel_action') {
        await interaction.message.delete();
        return true;
    }

    return false;
};
