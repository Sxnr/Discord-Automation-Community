const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getPlayer, checkDJ, sameChannel } = require('../../music/player');

module.exports = {
    category: 'music',
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('▶️ Reanuda la reproducción pausada.'),

    async execute(interaction) {
        const queue = getPlayer()?.nodes.get(interaction.guild.id);
        if (!queue)
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ No hay cola de música activa.' }], flags: MessageFlags.Ephemeral });
        if (!checkDJ(interaction))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Necesitas el rol **DJ** para usar este comando.' }], flags: MessageFlags.Ephemeral });
        if (!sameChannel(interaction))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Debes estar en el mismo canal de voz que el bot.' }], flags: MessageFlags.Ephemeral });
        if (!queue.node.isPaused())
            return interaction.reply({ embeds: [{ color: 0xFEE75C, description: '▶️ La música no está pausada.' }], flags: MessageFlags.Ephemeral });

        queue.node.resume();
        return interaction.reply({ embeds: [{
            color: 0x1DB954,
            description: `▶️ Reanudado: **${queue.currentTrack?.title}**`,
        }]});
    },
};
