const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getPlayer } = require('../../music/player');
const db = require('../../database/db');

const MAX_PLAYLISTS  = 10;
const MAX_TRACKS     = 50;

module.exports = {
    category: 'music',
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription('📁 Gestiona tus playlists guardadas.')
        // Guardar cola actual
        .addSubcommand(s => s
            .setName('save')
            .setDescription('Guarda la cola actual como playlist.')
            .addStringOption(o => o.setName('nombre').setDescription('Nombre de la playlist').setRequired(true).setMaxLength(40))
        )
        // Cargar playlist
        .addSubcommand(s => s
            .setName('load')
            .setDescription('Carga una playlist guardada.')
            .addStringOption(o => o.setName('nombre').setDescription('Nombre de la playlist').setRequired(true).setAutocomplete(true))
        )
        // Eliminar playlist
        .addSubcommand(s => s
            .setName('delete')
            .setDescription('Elimina una playlist guardada.')
            .addStringOption(o => o.setName('nombre').setDescription('Nombre de la playlist').setRequired(true).setAutocomplete(true))
        )
        // Ver playlists
        .addSubcommand(s => s
            .setName('list')
            .setDescription('Muestra todas tus playlists.')
        ),

    async autocomplete(interaction) {
        const sub     = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused();
        if (sub !== 'load' && sub !== 'delete') return interaction.respond([]);

        const rows = db.prepare(
            'SELECT name FROM music_playlists WHERE guild_id = ? AND user_id = ? ORDER BY name'
        ).all(interaction.guild.id, interaction.user.id);

        const choices = rows
            .filter(r => r.name.toLowerCase().includes(focused.toLowerCase()))
            .slice(0, 25)
            .map(r => ({ name: r.name, value: r.name }));

        await interaction.respond(choices);
    },

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const userId  = interaction.user.id;
        const now     = Date.now();

        // ── SAVE ──────────────────────────────────────────────
        if (sub === 'save') {
            const name  = interaction.options.getString('nombre');
            const queue = getPlayer()?.nodes.get(guildId);

            if (!queue?.isPlaying()) {
                return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ No hay música reproduciéndose para guardar.' }], flags: MessageFlags.Ephemeral });
            }

            const userPlaylists = db.prepare('SELECT COUNT(*) as c FROM music_playlists WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
            if (userPlaylists.c >= MAX_PLAYLISTS) {
                return interaction.reply({ embeds: [{ color: 0xED4245, description: `❌ Límite de ${MAX_PLAYLISTS} playlists por usuario.` }], flags: MessageFlags.Ephemeral });
            }

            const tracks = [queue.currentTrack, ...queue.tracks.toArray()]
                .filter(Boolean)
                .slice(0, MAX_TRACKS)
                .map(t => ({ title: t.title, url: t.url, duration: t.duration, thumbnail: t.thumbnail }));

            db.prepare(`
                INSERT INTO music_playlists (guild_id, user_id, name, tracks, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, user_id, name)
                DO UPDATE SET tracks = excluded.tracks, updated_at = excluded.updated_at
            `).run(guildId, userId, name, JSON.stringify(tracks), now, now);

            return interaction.reply({ embeds: [{
                color: 0x1DB954,
                description: `✅ Playlist **${name}** guardada con **${tracks.length} canciones**.`,
            }]});
        }

        // ── LOAD ──────────────────────────────────────────────
        if (sub === 'load') {
            const name = interaction.options.getString('nombre');
            const row  = db.prepare('SELECT * FROM music_playlists WHERE guild_id = ? AND user_id = ? AND name = ?').get(guildId, userId, name);

            if (!row) return interaction.reply({ embeds: [{ color: 0xED4245, description: `❌ No encontré la playlist **${name}**.` }], flags: MessageFlags.Ephemeral });

            if (!interaction.member.voice?.channel) {
                return interaction.reply({ embeds: [{ color: 0xED4245, description: '❌ Debes estar en un canal de voz.' }], flags: MessageFlags.Ephemeral });
            }

            await interaction.deferReply();

            const tracks  = JSON.parse(row.tracks ?? '[]');
            const player  = getPlayer();
            const cfg     = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);

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

            let added = 0;
            for (const t of tracks) {
                try {
                    const result = await player.search(t.url ?? t.title, { requestedBy: interaction.user });
                    if (result.hasTracks()) { queue.addTrack(result.tracks[0]); added++; }
                } catch { /* continúa con la siguiente */ }
            }

            if (!queue.isPlaying() && added > 0) await queue.node.play();

            return interaction.editReply({ embeds: [{
                color: 0x1DB954,
                title: `📁 Playlist cargada — ${row.name}`,
                description: `✅ **${added}/${tracks.length}** canciones añadidas a la cola.`,
            }]});
        }

        // ── DELETE ────────────────────────────────────────────
        if (sub === 'delete') {
            const name = interaction.options.getString('nombre');
            const res  = db.prepare('DELETE FROM music_playlists WHERE guild_id = ? AND user_id = ? AND name = ?').run(guildId, userId, name);
            if (res.changes === 0) return interaction.reply({ embeds: [{ color: 0xED4245, description: `❌ No encontré la playlist **${name}**.` }], flags: MessageFlags.Ephemeral });
            return interaction.reply({ embeds: [{ color: 0xED4245, description: `🗑️ Playlist **${name}** eliminada.` }] });
        }

        // ── LIST ──────────────────────────────────────────────
        if (sub === 'list') {
            const rows = db.prepare('SELECT name, tracks, created_at FROM music_playlists WHERE guild_id = ? AND user_id = ? ORDER BY name').all(guildId, userId);
            if (!rows.length) return interaction.reply({ embeds: [{ color: 0x5865F2, description: '📁 No tienes playlists guardadas. Usa `/playlist save` para crear una.' }], flags: MessageFlags.Ephemeral });

            const list = rows.map((r, i) => {
                const count = JSON.parse(r.tracks ?? '[]').length;
                const date  = new Date(r.created_at).toLocaleDateString('es-CL');
                return `\`${i + 1}.\` **${r.name}** — ${count} canciones · ${date}`;
            }).join('\n');

            return interaction.reply({ embeds: [new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`📁 Tus playlists en ${interaction.guild.name}`)
                .setDescription(list)
                .setFooter({ text: `${rows.length}/${MAX_PLAYLISTS} playlists usadas` })
            ]});
        }
    },
};
