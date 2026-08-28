const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const { ProxyAgent } = require('undici');
const db = require('../database/db');

// Usar el binario de FFmpeg empaquetado (ffmpeg-static) para que la música
// funcione sin instalar FFmpeg en el sistema (Windows, Linux, macOS).
// @discordjs/voice lee la variable de entorno FFMPEG_PATH automáticamente.
try {
    const ffmpegPath = require('ffmpeg-static');
    if (ffmpegPath && !process.env.FFMPEG_PATH) {
        process.env.FFMPEG_PATH = ffmpegPath;
    }
} catch { /* ffmpeg-static no disponible: se usará el FFmpeg del sistema si existe */ }

let _player = null;

// Votos de "vote-skip" por servidor: guildId -> Set<userId>
const skipVotes = new Map();

function registerSkipVote(guildId, userId, voiceMemberCount) {
    const needed = Math.max(1, Math.ceil(voiceMemberCount / 2));
    let set = skipVotes.get(guildId);
    if (!set) { set = new Set(); skipVotes.set(guildId, set); }
    set.add(userId);
    return { votes: set.size, needed, reached: set.size >= needed };
}
function clearSkipVotes(guildId) { skipVotes.delete(guildId); }

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

    // ── YouTube (discord-player v7 NO lo trae en DefaultExtractors) ───────
    // El extractor es opcional: si no está instalado (npm install), el bot
    // sigue funcionando y solo avisa. El proxy de YouTube es un ProxyAgent.
    try {
        const { YoutubeiExtractor } = require('discord-player-youtubei');
        const ytOpts = {};
        if (process.env.YOUTUBE_PROXY) ytOpts.proxy = new ProxyAgent(process.env.YOUTUBE_PROXY);
        _player.extractors.register(YoutubeiExtractor, ytOpts);
        console.log('[Music] ✅ Extractor de YouTube registrado' + (process.env.YOUTUBE_PROXY ? ' (con proxy)' : ''));
    } catch (e) {
        console.warn('[Music] ⚠️ Extractor de YouTube no disponible (faltó npm install):', e.message);
    }

    // ── Proxy para SoundCloud (acepta un string en options.proxy) ─────────
    configureExtractorProxies(_player);

    // ── Spotify real (playlists/álbumes) si hay credenciales ──────────────
    configureSpotify(_player);

    // ── Diagnóstico de FFmpeg ──────────────────────────────────────────────
    // Si FFmpeg no corre en el host, la música no emitirá audio (corte ~120ms).
    logFFmpegStatus();

    // Debug de voz solo si se habilita explícitamente (evita spam en logs).
    if (process.env.MUSIC_DEBUG === 'true') {
        _player.events.on('debug', (queue, message) => {
            console.log(`[Player Debug]: ${message}`);
        });
    }

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
        clearSkipVotes(queue.guild.id);
        const cfg = db.prepare('SELECT music_text_channel FROM guild_settings WHERE guild_id = ?').get(queue.guild.id);
        const embed = { color: 0x5865F2, description: '✅ Cola finalizada. ¡Hasta la próxima!' };
        const ch = cfg?.music_text_channel
            ? queue.guild.channels.cache.get(cfg.music_text_channel)
            : queue.metadata?.channel;
        ch?.send({ embeds: [embed] }).catch(() => {});
    });

    // ── Al terminar/cambiar de canción: limpiar votos de skip ──
    _player.events.on('playerFinish', (queue) => {
        clearSkipVotes(queue.guild.id);
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

    console.log('[Music] ✅ Player inicializado con FFmpeg del sistema');
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

// ── Configuración de hosting ───────────────────────────────────────────────
function configureExtractorProxies(player) {
    // SoundCloud lee el proxy desde options.proxy (string). YouTube se configura
    // en el registro (ProxyAgent), así que aquí solo tocamos SoundCloud.
    try {
        const proxy = process.env.SOUNDCLOUD_PROXY;
        if (!proxy) return;
        for (const ext of player.extractors.store.values()) {
            const id = (ext.identifier || '').toString().toLowerCase();
            if (id.includes('soundcloud')) {
                if (!ext.options) ext.options = {};
                ext.options.proxy = proxy;
                console.log(`[Music] ✅ Proxy SoundCloud aplicado: ${ext.identifier}`);
            }
        }
    } catch (e) {
        console.warn('[Music] No se pudo configurar proxy en extractores:', e.message);
    }
}

function configureSpotify(player) {
    const id = process.env.SPOTIFY_CLIENT_ID, secret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!id || !secret) return;
    try {
        const ext = player.extractors.store.find(e => (e.identifier || '').toLowerCase().includes('spotify'));
        if (ext && typeof ext.setToken === 'function') {
            ext.setToken({ clientId: id, clientSecret: secret });
            console.log('[Music] ✅ Spotify configurado con credenciales (playlists/álbumes completos).');
        }
    } catch (e) {
        console.warn('[Music] No se pudo configurar Spotify:', e.message);
    }
}

function logFFmpegStatus() {
    const bin = process.env.FFMPEG_PATH || 'ffmpeg';
    try {
        const { execFileSync } = require('child_process');
        const out = execFileSync(bin, ['-version'], { timeout: 5000 }).toString().split('\n')[0];
        console.log(`[Music] ✅ FFmpeg disponible: ${out}`);
    } catch (e) {
        console.warn('[Music] ⚠️ FFmpeg NO disponible/ejecutable en este host:', e.message);
        console.warn('[Music] ⚠️ La música no emitirá audio hasta que FFmpeg funcione (usá FFMPEG_PATH o instalá ffmpeg).');
    }
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

module.exports = { initPlayer, getPlayer, checkDJ, sameChannel, detectSourceLabel, registerSkipVote, clearSkipVotes };