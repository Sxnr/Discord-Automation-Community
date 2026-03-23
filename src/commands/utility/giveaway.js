const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const ms = require('ms'); // Asegúrate de tener 'ms' instalado: npm install ms

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('🎉 Gestiona sorteos profesionales en el servidor.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('🚀 Inicia un nuevo sorteo.')
                .addStringOption(opt => opt.setName('duracion').setDescription('⏳ Ej: 1h, 1d, 30m').setRequired(true))
                .addIntegerOption(opt => opt.setName('ganadores').setDescription('🏆 Número de ganadores').setRequired(true))
                .addStringOption(opt => opt.setName('premio').setDescription('🎁 ¿Qué se sortea?').setRequired(true))
                .addChannelOption(opt => opt.setName('canal').setDescription('📍 Canal del sorteo'))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'start') {
            const durationStr = interaction.options.getString('duracion');
            const winnerCount = interaction.options.getInteger('ganadores');
            const prize = interaction.options.getString('premio');
            const channel = interaction.options.getChannel('canal') || interaction.channel;

            const durationMs = ms(durationStr);
            if (!durationMs) return interaction.reply({ content: '❌ Formato de tiempo inválido (Ej: 1h, 10m, 1d).', ephemeral: true });

            const endTime = Date.now() + durationMs;

            const giveawayEmbed = new EmbedBuilder()
                .setTitle(`🎉 SORTEO: ${prize}`)
                .setDescription(`>>> Reacciona al botón de abajo para participar.\n\n🏆 **Ganadores:** ${winnerCount}\n⏳ **Finaliza:** <t:${Math.floor(endTime / 1000)}:R>`)
                .setColor('#F1C40F')
                .setFooter({ text: `Organizado por: ${interaction.user.username}` })
                .setTimestamp(endTime);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('join_giveaway')
                    .setLabel('Participar')
                    .setEmoji('🎉')
                    .setStyle(ButtonStyle.Primary)
            );

            const msg = await channel.send({ embeds: [giveawayEmbed], components: [row] });

            // Guardar en la base de datos para persistencia
            db.prepare(`
                INSERT INTO giveaways (message_id, guild_id, channel_id, prize, winner_count, end_time, participants)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(msg.id, interaction.guild.id, channel.id, prize, winnerCount, endTime, JSON.stringify([]));

            await interaction.reply({ content: `✅ Sorteo iniciado en ${channel}.`, ephemeral: true });
        }
    }
};