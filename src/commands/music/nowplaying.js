const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getPlayer, detectSourceLabel } = require('../../music/player');

module.exports = {
    category: 'music',
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('🎶 Muestra la canción que se está reproduciendo ahora.'),

    async execute(interaction) {
        const queue = getPlayer()?.nodes.get(interaction.guild.id);
        const track = queue?.currentTrack;

        if (!queue?.isPlaying() || !track) {
            return interaction.reply({
                embeds: [{ color: 0xED4245, description: '❌ No hay música reproduciéndose en este momento.' }],
                flags: MessageFlags.Ephemeral,
            });
        }

        const timestamp = queue.node.getTimestamp();
        const progress  = timestamp?.progress ?? 0;
        const filled    = Math.round(progress / 5);
        const bar       = '█'.repeat(filled) + '░'.repeat(20 - filled);
        const loopLabels = ['❌ Desactivado', '🔂 Canción', '🔁 Cola', '🔀 Autoplay'];
        const loopLabel  = loopLabels[queue.repeatMode] ?? '❌ Desactivado';

        const embed = new EmbedBuilder()
            .setColor(0x1DB954)
            .setAuthor({ name: '🎵 Reproduciendo ahora' })
            .setTitle(track.title)
            .setURL(track.url)
            .setThumbnail(track.thumbnail)
            .setDescription(
                `\`${timestamp?.current?.label ?? '0:00'}\` \`[${bar}]\` \`${track.duration}\``
            )
            .addFields(
                { name: '🎤 Artista',    value: track.author ?? 'Desconocido', inline: true },
                { name: '🎵 Fuente',     value: track.url ? (track.url.includes('youtu') ? '▶️ YouTube' : track.url.includes('soundcloud') ? '☁️ SoundCloud' : '🔍 Búsqueda') : '🔍', inline: true },
                { name: '🔁 Loop',       value: loopLabel,  inline: true },
                { name: '👤 Pedido por', value: `<@${track.requestedBy?.id ?? '0'}>`, inline: true },
                { name: '📋 En cola',    value: `${queue.tracks.size} canciones`, inline: true },
                { name: '🔊 Volumen',    value: `${queue.node.volume}%`, inline: true },
            )
            .setFooter({ text: `${Math.round(progress)}% completado` });

        return interaction.reply({ embeds: [embed] });
    },
};
