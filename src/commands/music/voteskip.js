const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getPlayer, registerSkipVote } = require('../../music/player');

module.exports = {
    category: 'music',
    data: new SlashCommandBuilder()
        .setName('voteskip')
        .setDescription('⏭️ Vota para saltar la canción (mayoría en el canal de voz).'),

    async execute(interaction) {
        const queue = getPlayer()?.nodes.get(interaction.guild.id);
        if (!queue?.isPlaying())
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ No hay música reproduciéndose.' }], flags: MessageFlags.Ephemeral });

        const voiceChannel = queue.voiceChannel;
        if (!voiceChannel?.members.has(interaction.user.id))
            return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Debes estar en el canal de voz para votar.' }], flags: MessageFlags.Ephemeral });

        const members   = voiceChannel.members.filter(m => !m.user.bot).size;
        const { votes, needed, reached } = registerSkipVote(interaction.guild.id, interaction.user.id, members);

        if (reached) {
            await queue.node.skip();
            return interaction.reply({ embeds: [{ color: 0x1DB954, description: `⏭️ Voto alcanzado (${votes}/${needed}). Saltando canción...` }] });
        }

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('⏭️ Vote-Skip')
            .setDescription(`Votos: **${votes}/${needed}** para saltar. Faltan ${needed - votes}.`);

        return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    },
};
