const { Events, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const db = require('../database/db');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {

        // 1. MANEJO DE COMANDOS SLASH
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'Error ejecutando comando.', ephemeral: true });
            }
            return;
        }

        // 2. LÓGICA DE BOTONES
        if (interaction.isButton()) {

            // --- BOTÓN: ABRIR TICKET ---
            if (interaction.customId === 'open_ticket') {
                await interaction.deferReply({ ephemeral: true });

                // VALIDACIÓN ANTI-SPAM: Verificar si ya existe un canal con el nombre del usuario
                const existingChannel = interaction.guild.channels.cache.find(
                    c => c.name === `ticket-${interaction.user.username.toLowerCase()}` && c.type === ChannelType.GuildText
                );

                if (existingChannel) {
                    return interaction.editReply({
                        content: `⚠️ Ya tienes un ticket abierto en este servidor: ${existingChannel}.`,
                        ephemeral: true
                    });
                }

                // Obtener configuración personalizada de la DB
                const settings = db.prepare('SELECT ticket_welcome_msg, staff_role FROM guild_settings WHERE guild_id = ?')
                    .get(interaction.guild.id);

                try {
                    const channel = await interaction.guild.channels.create({
                        name: `ticket-${interaction.user.username}`,
                        type: ChannelType.GuildText,
                        permissionOverwrites: [
                            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                            { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                            ...(settings?.staff_role ? [{ id: settings.staff_role, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }] : [])
                        ],
                    });

                    const welcomeEmbed = new EmbedBuilder()
                        .setTitle('Atención Iniciada')
                        .setDescription(settings?.ticket_welcome_msg || 'Bienvenido, un moderador te atenderá pronto.')
                        .setColor('#2ECC71')
                        .setFooter({ text: 'Usa el botón de abajo para gestionar el cierre.' });

                    const closeRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('close_ticket_request')
                            .setLabel('Cerrar Ticket')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔒')
                    );

                    await channel.send({
                        content: settings?.staff_role ? `<@&${settings.staff_role}>` : null,
                        embeds: [welcomeEmbed],
                        components: [closeRow]
                    });

                    await interaction.editReply({ content: `✅ Ticket abierto en ${channel}` });
                } catch (error) {
                    console.error(error);
                    await interaction.editReply({ content: '❌ Error crítico al crear el canal.' });
                }
            }

            // --- BOTÓN: SOLICITAR CIERRE ---
            if (interaction.customId === 'close_ticket_request') {
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('🛠️ Gestión del Ticket')
                    .setDescription('¿Qué acción deseas realizar?')
                    .setColor('#E74C3C');

                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_close').setLabel('Cerrar y Transcribir').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('cancel_action').setLabel('Cancelar').setStyle(ButtonStyle.Success)
                );

                await interaction.reply({ embeds: [confirmEmbed], components: [actionRow] });
            }

            // --- BOTÓN: CONFIRMAR CIERRE FINAL ---
            if (interaction.customId === 'confirm_close') {
                await interaction.deferUpdate();

                const channel = interaction.channel;
                const settings = db.prepare('SELECT ticket_log_channel, ticket_dm_preference FROM guild_settings WHERE guild_id = ?').get(interaction.guild.id);

                const attachment = await discordTranscripts.createTranscript(channel, {
                    limit: -1,
                    fileName: `Respaldo-${channel.name}.html`,
                    saveImages: true,
                    poweredBy: false // Más profesional, quita la marca de agua
                });

                const logEmbed = new EmbedBuilder()
                    .setTitle('📄 Nuevo Transcript Generado')
                    .addFields(
                        { name: '👤 Usuario', value: `${interaction.user.tag}`, inline: true },
                        { name: '🆔 ID', value: `${interaction.user.id}`, inline: true },
                        { name: '📂 Canal', value: `${channel.name}`, inline: true }
                    )
                    .setColor('#F1C40F')
                    .setTimestamp();

                // 1. SIEMPRE al canal de staff (si está configurado)
                if (settings?.ticket_log_channel) {
                    const logChannel = interaction.guild.channels.cache.get(settings.ticket_log_channel);
                    if (logChannel) await logChannel.send({ embeds: [logEmbed], files: [attachment] });
                }

                // 2. Al DM solo si el Admin lo activó en el /setup-tickets
                if (settings?.ticket_dm_preference === 1) {
                    try {
                        await interaction.user.send({
                            content: `👋 Hola! Aquí tienes el respaldo de tu consulta en **${interaction.guild.name}**.`,
                            files: [attachment]
                        });
                    } catch (e) {
                        console.log("DM Bloqueado por el usuario.");
                    }
                }

                await interaction.followUp({ content: '✅ Proceso finalizado. El canal se borrará en 5 segundos.' });
                setTimeout(() => channel.delete().catch(() => null), 5000);
            }

            if (interaction.customId === 'cancel_action') {
                await interaction.message.delete();
            }
            return;
        }

        // 3. LÓGICA DE MENÚS DESPLEGABLES (HELP)
        if (interaction.isStringSelectMenu()) {
            if (interaction.isStringSelectMenu() && interaction.customId === 'help_menu') {
                const category = interaction.values[0];
                const categoryName = category.charAt(0).toUpperCase() + category.slice(1);

                // Iconos dinámicos por categoría
                const icons = { admin: '🛡️', utility: '🛠️' };

                const displayCommands = interaction.client.commands
                    .filter(cmd => cmd.category === category)
                    .map(cmd => `> \`/${cmd.data.name}\` \n ${cmd.data.description}`)
                    .join('\n\n');

                const helpEmbed = new EmbedBuilder()
                    .setTitle(`${icons[category] || '📁'} Categoría: ${categoryName}`)
                    .setDescription(displayCommands || '*No hay comandos registrados en esta sección.*')
                    .setColor('#5865F2')
                    .setFooter({ text: `Solicitado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();

                await interaction.update({ embeds: [helpEmbed] });
            }
        }
    },
};