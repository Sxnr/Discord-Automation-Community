const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const ms = require('ms');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('🎉 Gestión avanzada de sorteos con persistencia.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // Subcomando: Iniciar
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('🚀 Inicia un nuevo sorteo.')
                .addStringOption(opt => opt.setName('duracion').setDescription('⏳ Ej: 1h, 1d, 30m').setRequired(true))
                .addIntegerOption(opt => opt.setName('ganadores').setDescription('🏆 Número de ganadores').setRequired(true))
                .addStringOption(opt => opt.setName('premio').setDescription('🎁 ¿Qué se sortea?').setRequired(true))
                .addChannelOption(opt => opt.setName('canal').setDescription('📍 Canal del sorteo'))
        )
        // Subcomando: Finalizar forzosamente
        .addSubcommand(sub =>
            sub.setName('end')
                .setDescription('⏹️ Finaliza un sorteo activo inmediatamente.')
                .addStringOption(opt => opt.setName('mensaje_id').setDescription('🆔 ID del mensaje del sorteo').setRequired(true))
        )
        // Subcomando: Relanzar ganadores
        .addSubcommand(sub =>
            sub.setName('reroll')
                .setDescription('🎲 Elige nuevos ganadores para un sorteo finalizado.')
                .addStringOption(opt => opt.setName('mensaje_id').setDescription('🆔 ID del mensaje del sorteo').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        // --- LÓGICA: INICIAR ---
        if (sub === 'start') {
            const durationStr = interaction.options.getString('duracion');
            const winnerCount = interaction.options.getInteger('ganadores');
            const prize = interaction.options.getString('premio');
            const channel = interaction.options.getChannel('canal') || interaction.channel;

            const durationMs = ms(durationStr);
            if (!durationMs) return interaction.reply({ content: '❌ Formato de tiempo inválido.', flags: [MessageFlags.Ephemeral] });

            const endTime = Date.now() + durationMs;

            const giveawayEmbed = new EmbedBuilder()
                .setTitle(`🎉 SORTEO: ${prize}`)
                .setDescription(`>>> Reacciona al botón para participar.\n\n🏆 **Ganadores:** \`${winnerCount}\` \n⏳ **Finaliza:** <t:${Math.floor(endTime / 1000)}:R>`)
                .setColor('#F1C40F')
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/3112/3112946.png')
                .setFooter({ text: `Host: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp(endTime);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('join_giveaway')
                    .setLabel('Participar')
                    .setEmoji('🎉')
                    .setStyle(ButtonStyle.Primary)
            );

            const msg = await channel.send({ embeds: [giveawayEmbed], components: [row] });

            db.prepare(`
                INSERT INTO giveaways (message_id, guild_id, channel_id, prize, winner_count, end_time, participants)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(msg.id, interaction.guild.id, channel.id, prize, winnerCount, endTime, JSON.stringify([]));

            return interaction.reply({ content: `✅ Sorteo iniciado en ${channel}.`, flags: [MessageFlags.Ephemeral] });
        }

        // --- LÓGICA: FINALIZAR (END) ---
        if (sub === 'end') {
            const messageId = interaction.options.getString('mensaje_id');
            const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND ended = 0').get(messageId);

            if (!giveaway) return interaction.reply({ content: '❌ No encontré un sorteo activo con ese ID.', flags: [MessageFlags.Ephemeral] });

            // Forzamos el tiempo de fin a "ahora" para que el Manager lo procese al instante
            db.prepare('UPDATE giveaways SET end_time = ? WHERE message_id = ?').run(Date.now(), messageId);

            return interaction.reply({ content: `⏹️ El sorteo finalizará en breve (procesando telemetría...).`, flags: [MessageFlags.Ephemeral] });
        }

        // --- LÓGICA: RELANZAR (REROLL) ---
        if (sub === 'reroll') {
            const messageId = interaction.options.getString('mensaje_id');
            const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND ended = 1').get(messageId);

            if (!giveaway) return interaction.reply({ content: '❌ El sorteo debe estar finalizado para hacer un reroll.', flags: [MessageFlags.Ephemeral] });

            const participants = JSON.parse(giveaway.participants || '[]');
            if (participants.length === 0) return interaction.reply({ content: '❌ No hay participantes para elegir un nuevo ganador.', flags: [MessageFlags.Ephemeral] });

            const newWinners = participants.sort(() => 0.5 - Math.random()).slice(0, giveaway.winner_count);
            
            const rerollEmbed = new EmbedBuilder()
                .setTitle('🎲 Nuevo Ganador Seleccionado')
                .setColor('#3498DB')
                .setDescription(`>>> **Premio:** ${giveaway.prize}\n\n🏆 **Nuevos Ganadores:**\n${newWinners.map(id => `<@${id}>`).join(', ')}`)
                .setFooter({ text: 'Reroll del sorteo original' })
                .setTimestamp();

            const channel = interaction.guild.channels.cache.get(giveaway.channel_id);
            if (channel) await channel.send({ content: `🎊 ¡Reroll completado! Felicidades ${newWinners.map(id => `<@${id}>`).join(', ')}`, embeds: [rerollEmbed] });

            return interaction.reply({ content: '✅ Se ha ejecutado el reroll correctamente.', flags: [MessageFlags.Ephemeral] });
        }
    }
};