const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getPlayer, checkDJ, sameChannel } = require('../../music/player');
const { detectSpotify, getSpotifyTrackInfo } = require('../../music/spotifyHelper');
const db = require('../../database/db');

module.exports = {
    category: 'music',
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('🎵 Reproduce una canción, playlist de YouTube o URL de SoundCloud/Spotify.')
        .addStringOption(o => o
            .setName('cancion')
            .setDescription('Nombre, URL de YouTube, SoundCloud o Spotify')
            .setRequired(true)
            .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused();
        if (!focused || focused.length < 2) return interaction.respond([]);
        try {
            const player = getPlayer();
            if (!player) return interaction.respond([]);
            const results = await player.search(focused, { requestedBy: interaction.user });
            const choices = results.tracks.slice(0, 5).map(t => ({
                name: `${t.title} — ${t.author}`.slice(0, 100),
                value: t.url,
            }));
            await interaction.respond(choices);
        } catch { await interaction.respond([]); }
    },

    async execute(interaction) {
        const cfg = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(interaction.guild.id);

        if (cfg?.music_text_channel && interaction.channelId !== cfg.music_text_channel) {
            return interaction.reply({
                embeds: [{ color: 0xED4245, description: `❌ Usa los comandos de música en <#${cfg.music_text_channel}>` }],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (!interaction.member.voice?.channel) {
            return interaction.reply({
                embeds: [{ color: 0xED4245, description: '❌ Debes estar en un canal de voz para usar este comando.' }],
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply();

        const player = getPlayer();
        if (!player) return interaction.editReply({ content: '❌ El sistema de música no está inicializado.' });

        let query = interaction.options.getString('cancion');
        let isSpotify = false;

        const spotifyDetect = detectSpotify(query);
        if (spotifyDetect) {
            if (spotifyDetect.type !== 'track') {
                return interaction.editReply({ embeds: [{
                    color: 0xFFA500,
                    title: '⚠️ Spotify sin API Key',
                    description: 'Solo se soportan **canciones individuales** de Spotify sin API Key.'
                }]});
            }
            const info = await getSpotifyTrackInfo(query);
            // Si el helper falla, no detenemos el proceso, buscamos la URL original
            if (info) {
                query = info.searchQuery;
                isSpotify = true;
            }
        }

        try {
            const result = await player.search(query, { requestedBy: interaction.user });
            if (!result.hasTracks()) {
                return interaction.editReply({ embeds: [{
                    color: 0xED4245,
                    description: `❌ No se encontraron resultados para \`${query}\``,
                }]});
            }

            const maxQ = cfg?.music_max_queue ?? 100;
            const queue = player.nodes.create(interaction.guild, {
                metadata: { channel: interaction.channel },
                selfDeaf: true,
                volume: cfg?.music_volume ?? 100,
                leaveOnEmpty: true,
                leaveOnEmptyCooldown: cfg?.music_leave_timeout ?? 300000,
                leaveOnEnd: !cfg?.music_247,
                leaveOnEndCooldown: cfg?.music_leave_timeout ?? 300000,
            });

            try {
                if (!queue.connection) await queue.connect(interaction.member.voice.channel);
            } catch (connErr) {
                console.error("Error conectando al canal:", connErr);
                return interaction.editReply({ content: "❌ No pude unirme a tu canal de voz." });
            }

            const isPlaylist = !!result.playlist;
            let addedCount = 0;

            if (isPlaylist) {
                const toAdd = result.tracks.slice(0, Math.max(0, maxQ - queue.tracks.size));
                if (toAdd.length === 0) {
                    return interaction.editReply({ embeds: [{ color: 0xED4245, description: `❌ Cola llena (máx. ${maxQ}).` }]});
                }
                queue.addTrack(toAdd);
                addedCount = toAdd.length;
            } else {
                if (queue.tracks.size >= maxQ) {
                    return interaction.editReply({ embeds: [{ color: 0xED4245, description: `❌ Cola llena (máx. ${maxQ}).` }]});
                }
                queue.addTrack(result.tracks[0]);
                addedCount = 1;
            }

            if (!queue.isPlaying()) await queue.node.play();

            const track = result.tracks[0];
            const embed = new EmbedBuilder()
                .setColor(0x1DB954)
                .setAuthor({ name: isPlaylist ? `✅ Playlist añadida (${addedCount} canciones)` : '✅ Añadido a la cola' })
                .setTitle(isPlaylist ? (result.playlist?.title ?? 'Playlist') : track.title)
                .setURL(track.url)
                .setThumbnail(track.thumbnail)
                .addFields(
                    { name: '⏱ Duración',    value: isPlaylist ? `${addedCount} canciones` : track.duration, inline: true },
                    { name: '📋 Posición',    value: queue.tracks.size > 0 ? `#${queue.tracks.size}` : '▶️ Ahora', inline: true },
                    { name: '👤 Pedido por',  value: `<@${interaction.user.id}>`, inline: true },
                );

            if (isSpotify) embed.setFooter({ text: '🎵 Spotify resuelto vía YouTube/SoundCloud' });

            return interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[Music:play]', err);
            return interaction.editReply({ embeds: [{ color: 0xED4245, description: `❌ Error: ${err.message}` }]});
        }
    },
};