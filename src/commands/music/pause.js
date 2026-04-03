const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getPlayer, checkDJ, sameChannel } = require('../../music/player');

module.exports = {
    category: 'music',
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('⏸️ Pausa la reproducción actual.'),

    async execute(interaction) {
        const queue = getPlayer()?.nodes.get(interaction.guild.id);
        if (!queue?.isPlaying())
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ No hay música reproduciéndose.' }], flags: MessageFlags.Ephemeral });
        if (!checkDJ(interaction))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Necesitas el rol **DJ** para usar este comando.' }], flags: MessageFlags.Ephemeral });
        if (!sameChannel(interaction))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Debes estar en el mismo canal de voz que el bot.' }], flags: MessageFlags.Ephemeral });
        if (queue.node.isPaused())
            return interaction.reply({ embeds: [{ color: 0xFEE75C, description: '⏸️ La música ya está pausada. Usa `/resume` para continuar.' }], flags: MessageFlags.Ephemeral });

        queue.node.pause();
        return interaction.reply({ embeds: [{
            color: 0xFEE75C,
            description: `⏸️ Pausado: **${queue.currentTrack?.title}**\nUsa \`/resume\` para continuar.`,
        }]});
    },
};
