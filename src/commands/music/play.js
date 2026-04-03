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

        // Canal de música restringido
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

        // ── Manejo de Spotify ────────────────────────────────
        const spotifyDetect = detectSpotify(query);
        if (spotifyDetect) {
            if (spotifyDetect.type !== 'track') {
                return interaction.editReply({ embeds: [{
                    color: 0xFFA500,
                    title: '⚠️ Spotify sin API Key',
                    description:
                        'Solo se soportan **canciones individuales** de Spotify.\n\n' +
                        'Las **playlists y álbumes** de Spotify requieren API Key.\n\n' +
                        '💡 **Alternativas:**\n' +
                        '• Pega la playlist de **YouTube** equivalente\n' +
                        '• Escribe el nombre de la canción directamente',
                }]});
            }
            const info = await getSpotifyTrackInfo(query);
            if (!info) {
                return interaction.editReply({ embeds: [{
                    color: 0xED4245,
                    description: '❌ No se pudo obtener información de Spotify. Intenta con el nombre de la canción directamente.',
                }]});
            }
            query = info.searchQuery;
            isSpotify = true;
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

            if (!queue.connection) await queue.connect(interaction.member.voice.channel);

            const isPlaylist = !!result.playlist;
            let addedCount = 0;

            if (isPlaylist) {
                const toAdd = result.tracks.slice(0, Math.max(0, maxQ - queue.tracks.size));
                if (toAdd.length === 0) {
                    return interaction.editReply({ embeds: [{
                        color: 0xED4245, description: `❌ La cola está llena (máximo ${maxQ} canciones).`,
                    }]});
                }
                queue.addTrack(toAdd);
                addedCount = toAdd.length;
            } else {
                if (queue.tracks.size >= maxQ) {
                    return interaction.editReply({ embeds: [{
                        color: 0xED4245, description: `❌ La cola está llena (máximo ${maxQ} canciones).`,
                    }]});
                }
                queue.addTrack(result.tracks[0]);
                addedCount = 1;
            }

            if (!queue.isPlaying()) await queue.node.play();

            const track = result.tracks[0];
            const playing = queue.tracks.size === 0 && queue.isPlaying();

            const embed = new EmbedBuilder()
                .setColor(0x1DB954)
                .setAuthor({ name: isPlaylist ? `✅ Playlist añadida (${addedCount} canciones)` : playing ? '▶️ Reproduciendo' : '✅ Añadido a la cola' })
                .setTitle(isPlaylist ? (result.playlist?.title ?? 'Playlist') : track.title)
                .setURL(isPlaylist ? (result.playlist?.url ?? track.url) : track.url)
                .setThumbnail(isPlaylist ? (result.playlist?.thumbnail ?? track.thumbnail) : track.thumbnail)
                .addFields(
                    { name: '⏱ Duración',    value: isPlaylist ? `${addedCount} canciones` : track.duration, inline: true },
                    { name: '📋 Posición',    value: queue.tracks.size > 0 ? `#${queue.tracks.size}` : '▶️ Ahora', inline: true },
                    { name: '👤 Pedido por',  value: `<@${interaction.user.id}>`, inline: true },
                );

            if (isSpotify) embed.setFooter({ text: '🎵 URL de Spotify → buscado en YouTube automáticamente' });

            return interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[Music:play]', err);
            return interaction.editReply({ embeds: [{
                color: 0xED4245, description: `❌ Error: ${err.message}`,
            }]});
        }
    },
};
