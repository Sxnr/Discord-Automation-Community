const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getPlayer, checkDJ, sameChannel } = require('../../music/player');

module.exports = {
    category: 'music',
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('🔀 Mezcla aleatoriamente la cola de canciones.'),

    async execute(interaction) {
        const queue = getPlayer()?.nodes.get(interaction.guild.id);
        if (!queue?.isPlaying())
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ No hay música reproduciéndose.' }], flags: MessageFlags.Ephemeral });
        if (!checkDJ(interaction))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Necesitas el rol **DJ** para usar este comando.' }], flags: MessageFlags.Ephemeral });
        if (!sameChannel(interaction))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Debes estar en el mismo canal de voz que el bot.' }], flags: MessageFlags.Ephemeral });
        if (queue.tracks.size < 2)
            return interaction.reply({ embeds: [{ color: 0xFEE75C, description: '⚠️ Necesitas al menos 2 canciones en la cola para mezclar.' }], flags: MessageFlags.Ephemeral });

        queue.tracks.shuffle();
        return interaction.reply({ embeds: [{
            color: 0x1DB954,
            description: `🔀 Cola mezclada — **${queue.tracks.size} canciones** en nuevo orden aleatorio.`,
        }]});
    },
};
