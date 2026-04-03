const https = require('https');

const PATTERNS = {
    track:    /open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]+)/,
    playlist: /open\.spotify\.com\/(?:intl-[a-z]+\/)?playlist\/([A-Za-z0-9]+)/,
    album:    /open\.spotify\.com\/(?:intl-[a-z]+\/)?album\/([A-Za-z0-9]+)/,
};

/**
 * Detecta si la query es una URL de Spotify.
 * @returns {{ type: string, id: string } | null}
 */
function detectSpotify(query) {
    if (!query.includes('spotify.com')) return null;
    for (const [type, regex] of Object.entries(PATTERNS)) {
        const match = query.match(regex);
        if (match) return { type, id: match[1] };
    }
    return null;
}

/**
 * Obtiene info de una canción de Spotify usando el endpoint público oEmbed.
 * No requiere API key. Devuelve { searchQuery, title, artist, thumbnail } o null.
 */
function getSpotifyTrackInfo(spotifyUrl) {
    return new Promise((resolve) => {
        const endpoint = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`;
        const req = https.get(endpoint, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                try {
                    const data = JSON.parse(raw);
                    // El título viene como "Canción · Artista" o solo "Canción"
                    const parts = (data.title ?? '').split(' · ');
                    resolve({
                        title:       parts[0]?.trim() ?? data.title,
                        artist:      parts[1]?.trim() ?? '',
                        thumbnail:   data.thumbnail_url ?? null,
                        searchQuery: parts.join(' ').trim(),
                    });
                } catch { resolve(null); }
            });
        });
        req.setTimeout(5000, () => { req.destroy(); resolve(null); });
        req.on('error', () => resolve(null));
    });
}

module.exports = { detectSpotify, getSpotifyTrackInfo };
