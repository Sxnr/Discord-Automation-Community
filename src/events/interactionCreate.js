const { Events, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
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
                console.error('❌ Error en comando:', error);

                // FIX: Si el comando ya hizo deferReply(), usamos followUp en vez de reply
                const replyFn = interaction.deferred || interaction.replied
                    ? interaction.followUp.bind(interaction)
                    : interaction.reply.bind(interaction);

                await replyFn({ 
                    content: 'Error ejecutando comando.', 
                    flags: [MessageFlags.Ephemeral] 
                });
            }
            return;
        }


        // 2. LÓGICA DE MENÚS DESPLEGABLES (HELP)
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'help_menu') {
                const category = interaction.values[0];
                const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
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
            return;
        }


        // 3. LÓGICA DE BOTONES (TICKETS Y SORTEOS CONSOLIDADOS)
        if (interaction.isButton()) {
            try {
                // --- SECCIÓN: TICKETS ---
                
                // Abrir Ticket
                if (interaction.customId === 'open_ticket') {
                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });


                    const existingChannel = interaction.guild.channels.cache.find(
                        c => c.name === `ticket-${interaction.user.username.toLowerCase()}` && c.type === ChannelType.GuildText
                    );


                    if (existingChannel) {
                        return interaction.editReply({ content: `⚠️ Ya tienes un ticket abierto: ${existingChannel}.` });
                    }


                    const settings = db.prepare('SELECT ticket_welcome_msg, staff_role FROM guild_settings WHERE guild_id = ?').get(interaction.guild.id);


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
                        new ButtonBuilder().setCustomId('close_ticket_request').setLabel('Cerrar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                    );


                    await channel.send({
                        content: settings?.staff_role ? `<@&${settings.staff_role}>` : null,
                        embeds: [welcomeEmbed],
                        components: [closeRow]
                    });


                    return await interaction.editReply({ content: `✅ Ticket abierto en ${channel}` });
                }


                // Solicitar Cierre
                if (interaction.customId === 'close_ticket_request') {
                    const confirmEmbed = new EmbedBuilder()
                        .setTitle('🛠️ Gestión del Ticket')
                        .setDescription('¿Qué acción deseas realizar?')
                        .setColor('#E74C3C');


                    const actionRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('confirm_close').setLabel('Cerrar y Transcribir').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('cancel_action').setLabel('Cancelar').setStyle(ButtonStyle.Success)
                    );


                    return await interaction.reply({ embeds: [confirmEmbed], components: [actionRow] });
                }


                // Confirmar Cierre Final
                if (interaction.customId === 'confirm_close') {
                    await interaction.deferUpdate();
                    const channel = interaction.channel;
                    const settings = db.prepare('SELECT ticket_log_channel, ticket_dm_preference FROM guild_settings WHERE guild_id = ?').get(interaction.guild.id);


                    const attachment = await discordTranscripts.createTranscript(channel, {
                        limit: -1,
                        fileName: `Respaldo-${channel.name}.html`,
                        saveImages: true,
                        poweredBy: false
                    });


                    const logEmbed = new EmbedBuilder()
                        .setTitle('📄 Nuevo Transcript Generado')
                        .addFields(
                            { name: '👤 Usuario', value: `${interaction.user.tag}`, inline: true },
                            { name: '📂 Canal', value: `${channel.name}`, inline: true }
                        )
                        .setColor('#F1C40F')
                        .setTimestamp();


                    if (settings?.ticket_log_channel) {
                        const logChannel = interaction.guild.channels.cache.get(settings.ticket_log_channel);
                        if (logChannel) await logChannel.send({ embeds: [logEmbed], files: [attachment] });
                    }


                    if (settings?.ticket_dm_preference === 1) {
                        try {
                            await interaction.user.send({
                                content: `👋 Aquí tienes el respaldo de tu consulta en **${interaction.guild.name}**.`,
                                files: [attachment]
                            });
                        } catch (e) { console.log("DM Bloqueado por el usuario."); }
                    }


                    await interaction.followUp({ content: '✅ Proceso finalizado. El canal se borrará en 5 segundos.' });
                    return setTimeout(() => channel.delete().catch(() => null), 5000);
                }


                // Cancelar Acción de Ticket
                if (interaction.customId === 'cancel_action') {
                    return await interaction.message.delete();
                }


                // --- SECCIÓN: SORTEOS ---
                
                // Participar en Sorteo
                if (interaction.customId === 'join_giveaway') {
                    const giveaway = db.prepare('SELECT participants, ended FROM giveaways WHERE message_id = ?').get(interaction.message.id);


                    if (!giveaway) {
                        return interaction.reply({ 
                            content: '❌ No se encontraron datos de este sorteo.', 
                            flags: [MessageFlags.Ephemeral] 
                        });
                    }


                    if (giveaway.ended) {
                        return interaction.reply({ 
                            content: '❌ Este sorteo ya ha finalizado.', 
                            flags: [MessageFlags.Ephemeral] 
                        });
                    }


                    let participants = JSON.parse(giveaway.participants || '[]');


                    if (participants.includes(interaction.user.id)) {
                        return interaction.reply({ 
                            content: '⚠️ Ya estás participando en este sorteo.', 
                            flags: [MessageFlags.Ephemeral] 
                        });
                    }


                    participants.push(interaction.user.id);
                    db.prepare('UPDATE giveaways SET participants = ? WHERE message_id = ?').run(JSON.stringify(participants), interaction.message.id);


                    return await interaction.reply({ 
                        content: '✅ ¡Te has registrado correctamente! Mucha suerte. 🎉', 
                        flags: [MessageFlags.Ephemeral] 
                    });
                }


            } catch (error) {
                console.error('❌ Error en interacción de botón:', error);
                const errorFeedback = { 
                    content: '❌ Error técnico al procesar esta acción. Contacta al staff.', 
                    flags: [MessageFlags.Ephemeral] 
                };
                
                if (interaction.replied || interaction.deferred) await interaction.editReply(errorFeedback);
                else await interaction.reply(errorFeedback);
            }
        }
    },
};