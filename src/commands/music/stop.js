const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getPlayer, checkDJ, sameChannel } = require('../../music/player');

module.exports = {
    category: 'music',
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('⏹️ Detiene la música y limpia la cola.'),

    async execute(interaction) {
        const queue = getPlayer()?.nodes.get(interaction.guild.id);
        if (!queue?.isPlaying())
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ No hay música reproduciéndose.' }], flags: MessageFlags.Ephemeral });
        if (!checkDJ(interaction))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Necesitas el rol **DJ** para usar este comando.' }], flags: MessageFlags.Ephemeral });
        if (!sameChannel(interaction))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Debes estar en el mismo canal de voz que el bot.' }], flags: MessageFlags.Ephemeral });

        const size = queue.tracks.size;
        queue.delete();

        return interaction.reply({ embeds: [{
            color: 0xED4245,
            description: `⏹️ Música detenida y cola limpiada (${size + 1} canciones eliminadas).`,
        }]});
    },
};
