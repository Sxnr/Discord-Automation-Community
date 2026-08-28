const db = require('../database/db');
const { getPlayer } = require('../music/player');

// Permite pedir música escribiendo el nombre/URL directo en el canal de música
// configurado (guild_settings.music_text_channel), sin usar /play.
module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot || !message.guild) return;
        if (!message.content || message.content.startsWith('/')) return;

        const cfg = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(message.guild.id);
        if (!cfg?.music_text_channel || message.channel.id !== cfg.music_text_channel) return;

        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) return; // quien pide debe estar en un canal de voz

        const player = getPlayer();
        if (!player) return;

        let result;
        try {
            result = await player.search(message.content, { requestedBy: message.author });
        } catch { return; }

        if (!result?.hasTracks()) {
            return message.reply({ content: '❌ No encontré resultados para eso.' }).catch(() => {});
        }

        try {
            let queue = player.nodes.get(message.guild.id);
            if (!queue || !queue.connection) {
                queue = player.nodes.create(message.guild, {
                    metadata: { channel: message.channel },
                    selfDeaf: true,
                    volume: cfg?.music_volume ?? 100,
                    leaveOnEmpty: true,
                    leaveOnEmptyCooldown: cfg?.music_leave_timeout ?? 300000,
                    leaveOnEnd: !cfg?.music_247,
                    leaveOnEndCooldown: cfg?.music_leave_timeout ?? 300000,
                });
                await queue.connect(voiceChannel);
            }

            queue.addTrack(result.tracks[0]);
            if (!queue.isPlaying()) await queue.node.play();

            await message.reply({ content: `🎶 Añadido a la cola: **${result.tracks[0].title}**` }).catch(() => {});
        } catch (e) {
            console.error('[Music:chatRequest]', e);
        }
    },
};
