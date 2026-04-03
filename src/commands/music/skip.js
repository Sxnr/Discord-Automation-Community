const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getPlayer, checkDJ, sameChannel } = require('../../music/player');

module.exports = {
    category: 'music',
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('⏭️ Salta la canción actual.')
        .addIntegerOption(o => o.setName('cantidad').setDescription('Cuántas canciones saltar (1-10)').setMinValue(1).setMaxValue(10)),

    async execute(interaction) {
        const queue = getPlayer()?.nodes.get(interaction.guild.id);
        if (!queue?.isPlaying())
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ No hay música reproduciéndose.' }], flags: MessageFlags.Ephemeral });
        if (!checkDJ(interaction))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Necesitas el rol **DJ** para usar este comando.' }], flags: MessageFlags.Ephemeral });
        if (!sameChannel(interaction))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Debes estar en el mismo canal de voz que el bot.' }], flags: MessageFlags.Ephemeral });

        const amount  = interaction.options.getInteger('cantidad') ?? 1;
        const current = queue.currentTrack?.title ?? 'canción desconocida';

        if (amount > 1) {
            const toRemove = queue.tracks.toArray().slice(0, amount - 1);
            for (const t of toRemove) queue.node.remove(t);
        }

        queue.node.skip();

        return interaction.reply({ embeds: [{
            color: 0x1DB954,
            description: `⏭️ Saltado: **${current}**${amount > 1 ? ` (+ ${amount - 1} canciones más)` : ''}`,
        }]});
    },
};
