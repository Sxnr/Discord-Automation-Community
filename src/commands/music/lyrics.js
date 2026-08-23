const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { brandFooter } = require('../../utils/embeds');
const { getPlayer } = require('../../music/player');

const GENIUS = process.env.GENIUS_TOKEN;

async function searchGenius(query) {
    const res = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${GENIUS}` },
    });
    const data = await res.json();
    if (data.meta?.status !== 200) throw new Error(data.meta?.message || 'Error API');
    return data.response?.hits?.filter(h => h.type === 'song') || [];
}

module.exports = {
    category: 'music',
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setDescription('🎤 Busca la letra de la canción que suena o de una específica (Genius).')
        .addStringOption(o => o.setName('cancion').setDescription('Canción (opcional si hay música sonando)').setRequired(false).setMaxLength(150))
        .addStringOption(o => o.setName('artista').setDescription('Artista (opcional)').setRequired(false).setMaxLength(80)),
    async execute(interaction) {
        const cancion = interaction.options.getString('cancion');
        const artista = interaction.options.getString('artista') || '';

        let query;
        if (cancion) {
            query = artista ? `${artista} ${cancion}` : cancion;
        } else {
            const queue = getPlayer()?.nodes.get(interaction.guildId);
            const track = queue?.currentTrack;
            if (!track) return interaction.reply({ content: '❌ Proporciona una canción o reproduce música primero.', flags: [MessageFlags.Ephemeral] });
            query = `${track.author} ${track.title}`;
        }

        if (!GENIUS) return interaction.reply({ content: '❌ Falta `GENIUS_TOKEN` en `.env`.', flags: [MessageFlags.Ephemeral] });

        await interaction.deferReply();
        let hits;
        try {
            hits = await searchGenius(query);
        } catch (e) {
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription(`❌ ${e.message}`)] });
        }

        if (!hits.length) {
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ED4245').setTitle('❌ No encontrado').setDescription(`No hallé **"${query}"** en Genius.`)] });
        }

        const song = hits[0].result;
        const embed = new EmbedBuilder()
            .setTitle(`🎤 ${song.title} — ${song.primary_artist?.name || '—'}`)
            .setColor('#FFFF64')
            .setFooter(brandFooter(interaction.client));

        if (song.song_art_image_url) embed.setThumbnail(song.song_art_image_url);
        if (song.url) embed.setDescription(`📝 Letra completa en Genius:\n${song.url}`);

        const components = [];
        if (song.url) {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Ver letra en Genius').setStyle(ButtonStyle.Link).setURL(song.url).setEmoji('🎵')
            ));
        }
        if (hits.length > 1) {
            embed.addFields({ name: '🔍 Otros resultados', value: hits.slice(1, 4).map((h, i) => `**${i + 2}.** ${h.result.title} — ${h.result.primary_artist?.name || '?'}`).join('\n') });
        }

        return interaction.editReply({ embeds: [embed], components });
    }
};
