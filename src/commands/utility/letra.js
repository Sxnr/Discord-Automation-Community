const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('letra')
        .setDescription('🎵 Busca información y letra de una canción en Genius.')
        .addStringOption(o => o
            .setName('cancion')
            .setDescription('Nombre de la canción')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption(o => o
            .setName('artista')
            .setDescription('Nombre del artista (opcional, mejora la búsqueda)')
            .setMaxLength(80)
        ),

    async execute(interaction) {
        const cancion  = interaction.options.getString('cancion');
        const artista  = interaction.options.getString('artista') || '';
        const query    = artista ? `${artista} ${cancion}` : cancion;
        const token    = process.env.GENIUS_TOKEN;

        await interaction.deferReply();

        let hits;
        try {
            const res  = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();

            if (data.meta?.status !== 200) throw new Error(data.meta?.message || 'Error API');
            hits = data.response?.hits?.filter(h => h.type === 'song') || [];
        } catch (e) {
            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor('#ED4245')
                    .setDescription(`❌ Error al conectar con Genius: ${e.message}`)
                ],
            });
        }

        if (!hits.length) {
            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor('#ED4245')
                    .setTitle('❌ Canción no encontrada')
                    .setDescription(`No encontré **"${query}"** en Genius.\nIntenta con el nombre exacto o en inglés.`)
                ],
            });
        }

        const song       = hits[0].result;
        const title      = song.title || '—';
        const artist     = song.primary_artist?.name || '—';
        const album      = song.album?.name || null;
        const year       = song.release_date_components?.year || null;
        const views      = song.stats?.pageviews ? song.stats.pageviews.toLocaleString('es-CL') : null;
        const featArtist = song.featured_artists?.map(a => a.name).join(', ') || null;
        const lyricsUrl  = song.url || null;
        const thumb      = song.song_art_image_url || song.header_image_thumbnail_url || null;
        const img        = song.header_image_url || null;

        const desc = [
            `🎤 **Artista:** ${artist}`,
            album      ? `💿 **Álbum:** ${album}`           : null,
            year       ? `📅 **Año:** ${year}`              : null,
            featArtist ? `🎶 **Featuring:** ${featArtist}`  : null,
            views      ? `👁️ **Vistas en Genius:** ${views}` : null,
        ].filter(Boolean).join('\n');

        const embed = new EmbedBuilder()
            .setTitle(`🎵 ${title} — ${artist}`)
            .setDescription(desc)
            .setColor('#FFFF64')
            .setFooter({ text: `Solicitado por ${interaction.user.username} · Genius · La letra completa está en el botón` })
            .setTimestamp();

        if (thumb) embed.setThumbnail(thumb);
        if (img)   embed.setImage(img);

        const components = [];
        if (lyricsUrl) {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Ver letra completa en Genius')
                    .setStyle(ButtonStyle.Link)
                    .setURL(lyricsUrl)
                    .setEmoji('🎵'),
            ));
        }

        // Mostrar otros resultados si hay más de 1
        if (hits.length > 1) {
            const otrosLines = hits.slice(1, 4).map((h, i) =>
                `**${i + 2}.** [${h.result.title}](${h.result.url}) — ${h.result.primary_artist?.name || '?'}`
            ).join('\n');

            embed.addFields({ name: '🔍 Otros resultados', value: otrosLines });
        }

        return interaction.editReply({ embeds: [embed], components });
    },
};