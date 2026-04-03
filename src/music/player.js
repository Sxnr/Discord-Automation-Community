const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const db = require('../database/db');

// IMPORTANTE: Aquí NO debe haber ninguna línea que mencione 'ffmpeg-static'

let _player = null;

async function initPlayer(client) {
    if (_player) return _player;

    _player = new Player(client, { 
        skipFFmpeg: false,
        ytdlOptions: {
            quality: 'highestaudio',
            highWaterMark: 1 << 25 
        }
    });

    await _player.extractors.loadMulti(DefaultExtractors);
    
    // ── Evento de Debug (Vital para ver por qué se corta el audio) ──
    _player.events.on('debug', (queue, message) => {
        console.log(`[Player Debug]: ${message}`);
    });

    // ── Evento: canción comienza ───────────────────────────────
    _player.events.on('playerStart', (queue, track) => {
        const cfg = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(queue.guild.id);
        if (!cfg || cfg.music_announce === 0) return;

        const embed = {
            color: 0x1DB954,
            author: { name: '▶️  Reproduciendo ahora' },
            title: track.title,
            url: track.url,
            thumbnail: { url: track.thumbnail },
            fields: [
                { name: '⏱ Duración',   value: track.duration,                        inline: true },
                { name: '🎵 Fuente',     value: detectSourceLabel(track.url),          inline: true },
                { name: '👤 Pedido por', value: `<@${track.requestedBy?.id ?? '0'}>`, inline: true },
            ],
            footer: { text: `${queue.tracks.size} canciones restantes en cola` },
        };

        try {
            db.prepare(`
                INSERT INTO music_history
                    (guild_id, user_id, title, url, duration, thumbnail, source, played_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                queue.guild.id,
                track.requestedBy?.id ?? '0',
                track.title, track.url,
                track.durationMS ?? 0,
                track.thumbnail ?? null,
                detectSource(track.url),
                Date.now()
            );
        } catch { /* historial no crítico */ }

        const target = cfg.music_text_channel
            ? queue.guild.channels.cache.get(cfg.music_text_channel)
            : queue.metadata?.channel;
        target?.send({ embeds: [embed] }).catch(() => {});
    });

    // ── Cola vacía ─────────────────────────────────────────────
    _player.events.on('emptyQueue', (queue) => {
        const cfg = db.prepare('SELECT music_text_channel FROM guild_settings WHERE guild_id = ?').get(queue.guild.id);
        const embed = { color: 0x5865F2, description: '✅ Cola finalizada. ¡Hasta la próxima!' };
        const ch = cfg?.music_text_channel
            ? queue.guild.channels.cache.get(cfg.music_text_channel)
            : queue.metadata?.channel;
        ch?.send({ embeds: [embed] }).catch(() => {});
    });

    // ── Canal vacío ────────────────────────────────────────────
    _player.events.on('emptyChannel', (queue) => {
        queue.metadata?.channel?.send({
            embeds: [{ color: 0xFEE75C, description: '👋 Canal de voz vacío. Desconectando...' }]
        }).catch(() => {});
    });

    // ── Errores ────────────────────────────────────────────────
    _player.events.on('playerError', (queue, error) => {
        console.error('[Music:playerError]', error);
        queue.metadata?.channel?.send({
            embeds: [{ color: 0xED4245, description: `❌ Error de reproducción: \`${error.message}\`` }]
        }).catch(() => {});
    });

    _player.events.on('error', (queue, error) => {
        console.error('[Music:error]', error);
    });

    console.log('[Music] ✅ Player inicializado y configurado para DAVE/FFmpeg');
    return _player;
}

function getPlayer() { return _player; }

function detectSource(url = '') {
    if (url.includes('youtu')) return 'youtube';
    if (url.includes('soundcloud.com')) return 'soundcloud';
    return 'search';
}

function detectSourceLabel(url = '') {
    if (url.includes('youtu')) return '▶️ YouTube';
    if (url.includes('soundcloud.com')) return '☁️ SoundCloud';
    return '🔍 Búsqueda';
}

function checkDJ(interaction) {
    const cfg = db.prepare('SELECT music_dj_role FROM guild_settings WHERE guild_id = ?').get(interaction.guild.id);
    if (!cfg?.music_dj_role) return true;
    return interaction.member.roles.cache.has(cfg.music_dj_role)
        || interaction.member.permissions.has('ManageGuild');
}

function sameChannel(interaction) {
    const botVC  = interaction.guild.members.me?.voice?.channelId;
    const userVC = interaction.member.voice?.channelId;
    if (!botVC) return true;
    return botVC === userVC;
}

module.exports = { initPlayer, getPlayer, checkDJ, sameChannel, detectSourceLabel };