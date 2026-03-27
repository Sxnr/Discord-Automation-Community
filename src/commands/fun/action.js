const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ── GIFs de respaldo por acción (anime) ───────────────────────────────────
const FALLBACK_GIFS = {
    hug: [
        'https://media.tenor.com/BBpOgqyHjRoAAAAC/anime-hug.gif',
        'https://media.tenor.com/XMrFHc2gZ6oAAAAC/hug-anime.gif',
        'https://media.tenor.com/p6xMCzRE2HUAAAAC/anime-hug.gif',
        'https://media.tenor.com/PaGSFGb0PxsAAAAC/hug-cuddle.gif',
        'https://media.tenor.com/qyHvRqCHlEoAAAAC/anime-hug.gif',
        'https://media.tenor.com/8Tq0HNQGqygAAAAC/anime-couple.gif',
        'https://media.tenor.com/hnA8KgcoPs8AAAAC/anime-hug.gif',
        'https://media.tenor.com/a_wBcRFVF7QAAAAC/hug-anime.gif',
    ],
    pat: [
        'https://media.tenor.com/N1rpYaCgLTUAAAAC/pat-head-pat.gif',
        'https://media.tenor.com/H4p-pOCeq9IAAAAC/anime-headpat.gif',
        'https://media.tenor.com/NMEfGvULULMAAAAC/head-pat.gif',
        'https://media.tenor.com/yv_YYLN9f1YAAAAC/pat-anime.gif',
        'https://media.tenor.com/q_7JrWjGZ6IAAAAC/head-pat-headpat.gif',
        'https://media.tenor.com/ioB0P4oRkGQAAAAC/anime-pat.gif',
        'https://media.tenor.com/UJkqHy4NZPYAAAAC/headpat.gif',
        'https://media.tenor.com/y-TBFpOC0MIAAAAC/anime-head-pat.gif',
    ],
    slap: [
        'https://media.tenor.com/n7FbNkBgCuAAAAAC/anime-slap.gif',
        'https://media.tenor.com/OeRmULlE1RsAAAAC/slap-anime.gif',
        'https://media.tenor.com/Cr4VLiMbg0QAAAAC/anime-slap.gif',
        'https://media.tenor.com/V1RPJVk0PpQAAAAC/slap.gif',
        'https://media.tenor.com/ZbCMGlAOmDoAAAAC/slap-anime.gif',
        'https://media.tenor.com/0G6jcfJnMGYAAAAC/anime-slap.gif',
        'https://media.tenor.com/hS_MKIZF7j8AAAAC/slap-hit.gif',
        'https://media.tenor.com/sMHfLLOIZXIAAAAC/anime-slap.gif',
    ],
    kiss: [
        'https://media.tenor.com/yJqGFndzNMwAAAAC/anime-kiss.gif',
        'https://media.tenor.com/XNS_9eGHXb8AAAAC/kiss-anime.gif',
        'https://media.tenor.com/HVMJb7gxOicAAAAC/anime-kiss.gif',
        'https://media.tenor.com/3SqEiCoAAAAC/anime-kiss.gif',
        'https://media.tenor.com/UGmT7bOELcUAAAAC/kiss-anime.gif',
        'https://media.tenor.com/Oa6ByBWRK-QAAAAC/anime-kiss.gif',
        'https://media.tenor.com/xHa6cIg6TDUAAAAC/kiss-cute.gif',
        'https://media.tenor.com/qBTjDbbIqxoAAAAC/anime-kiss-forehead.gif',
    ],
    poke: [
        'https://media.tenor.com/q_NdCHhMEz4AAAAC/anime-poke.gif',
        'https://media.tenor.com/qA8W0eTEHxkAAAAC/poke-anime.gif',
        'https://media.tenor.com/8mfnHdSkdIkAAAAC/anime-poke.gif',
        'https://media.tenor.com/W9R7JNkQNtsAAAAC/poke-finger.gif',
        'https://media.tenor.com/hpFiuPsXyGAAAAAC/poke-annoying.gif',
        'https://media.tenor.com/VnvDJzuaQUsAAAAC/anime-boop.gif',
        'https://media.tenor.com/Fn_PToRtNUkAAAAC/anime-poke.gif',
        'https://media.tenor.com/4xvk8gIWUBUAAAAC/poke-cute.gif',
    ],
    wave: [
        'https://media.tenor.com/gAK-ltiWXUMAAAAC/wave-hello.gif',
        'https://media.tenor.com/zrF5ABKGPHUAAAAC/anime-wave.gif',
        'https://media.tenor.com/s0dSAFKCVaoAAAAC/wave-bye.gif',
        'https://media.tenor.com/v5GXZfHX6EQAAAAC/anime-wave.gif',
        'https://media.tenor.com/IsMbWEpHw48AAAAC/wave-hand.gif',
        'https://media.tenor.com/OcvvvYrH9O4AAAAC/anime-wave-hello.gif',
        'https://media.tenor.com/fL6eT_BQKUEAAAAC/wave-greeting.gif',
        'https://media.tenor.com/1CXCM-4BgTIAAAAC/anime-wave.gif',
    ],
    bite: [
        'https://media.tenor.com/kqyRDJJMnCwAAAAC/anime-bite.gif',
        'https://media.tenor.com/v2EKi9OXJRQAAAAC/bite-anime.gif',
        'https://media.tenor.com/MiwPV6RM4owAAAAC/anime-bite.gif',
        'https://media.tenor.com/VfGq6JjCVDkAAAAC/bite-chomp.gif',
        'https://media.tenor.com/xq6yGLxYVPoAAAAC/anime-nom.gif',
        'https://media.tenor.com/L7r8K2geTjMAAAAC/bite-nom.gif',
        'https://media.tenor.com/WvaBwSbkIzAAAAAC/anime-bite.gif',
        'https://media.tenor.com/7UaDGJKKXFMAAAAC/bite-vampire.gif',
    ],
    cry: [
        'https://media.tenor.com/xBYm5HNXR44AAAAC/anime-cry.gif',
        'https://media.tenor.com/E-GCL7fQ_UUAAAAC/crying-anime.gif',
        'https://media.tenor.com/1sDH2gV-Q9MAAAAC/anime-cry.gif',
        'https://media.tenor.com/G5zFzMWuFCwAAAAC/cry-tears.gif',
        'https://media.tenor.com/HafbATHqx9oAAAAC/anime-crying.gif',
        'https://media.tenor.com/mIphvCoLfb0AAAAC/cry-anime.gif',
        'https://media.tenor.com/kBcGLf3SdocAAAAC/anime-cry-sad.gif',
        'https://media.tenor.com/vQRbNJFHvEkAAAAC/cry-tears-crying.gif',
    ],
    cuddle: [
        'https://media.tenor.com/d7jnAO1LARMAAAAC/anime-cuddle.gif',
        'https://media.tenor.com/TqVgzTkyMHwAAAAC/cuddle-anime.gif',
        'https://media.tenor.com/w1l6W9vbMnkAAAAC/anime-cuddle.gif',
        'https://media.tenor.com/4tGQkbPnCfAAAAAC/cuddle-cute.gif',
        'https://media.tenor.com/4-Lc_V8mWd4AAAAC/anime-cuddle.gif',
        'https://media.tenor.com/yKpDiOLkVhYAAAAC/cuddle-snuggle.gif',
    ],
    punch: [
        'https://media.tenor.com/fj-fR5_WoD8AAAAC/anime-punch.gif',
        'https://media.tenor.com/2PUz0AAAAC/punch-anime.gif',
        'https://media.tenor.com/LQxCDFJuPPoAAAAC/anime-punch.gif',
        'https://media.tenor.com/j2EN2oLSmFoAAAAC/punch-hit.gif',
        'https://media.tenor.com/UCzaAsFaFZkAAAAC/hit-punch.gif',
        'https://media.tenor.com/oJIh4HKboSoAAAAC/anime-punch.gif',
        'https://media.tenor.com/V_xmI5X9IcQAAAAC/punch-smack.gif',
        'https://media.tenor.com/8oX6qpIivCYAAAAC/anime-hit.gif',
    ],
    highfive: [
        'https://media.tenor.com/eFdkBMFKt8UAAAAC/anime-high-five.gif',
        'https://media.tenor.com/E8HKujuIVZUAAAAC/high-five-anime.gif',
        'https://media.tenor.com/wJfOjNSJp0QAAAAC/anime-highfive.gif',
        'https://media.tenor.com/NE4oCHRHqMEAAAAC/high-five.gif',
        'https://media.tenor.com/SLBMz3jF9SMAAAAC/highfive-anime.gif',
        'https://media.tenor.com/Kp6xL7YKCXUAAAAC/high5-anime.gif',
    ],
    blush: [
        'https://media.tenor.com/oRFKjBb4OYMAAAAC/anime-blush.gif',
        'https://media.tenor.com/g2P_JlL3txUAAAAC/blush-anime.gif',
        'https://media.tenor.com/ePFAPFnoAMEAAAAC/anime-blush.gif',
        'https://media.tenor.com/CBMiWkFkfnMAAAAC/blush-embarrassed.gif',
        'https://media.tenor.com/7wvL-z77VTsAAAAC/anime-blush.gif',
        'https://media.tenor.com/RcvBuOZIQqgAAAAC/blush-cute.gif',
    ],
};

// ── Definición de acciones ─────────────────────────────────────────────────
const ACTIONS = {
    hug:      { emoji: '🤗', verb: 'abrazó a',        selfVerb: 'se abrazó a sí mismo',       color: '#F39C12' },
    pat:      { emoji: '🥰', verb: 'le dio pat a',     selfVerb: 'se dio pat a sí mismo',      color: '#3498DB' },
    slap:     { emoji: '💢', verb: 'abofeteó a',       selfVerb: 'se abofeteó a sí mismo',     color: '#ED4245' },
    kiss:     { emoji: '💋', verb: 'besó a',           selfVerb: 'se besó a sí mismo',         color: '#E91E8C' },
    poke:     { emoji: '👉', verb: 'pinchó a',         selfVerb: 'se pinchó a sí mismo',       color: '#9B59B6' },
    wave:     { emoji: '👋', verb: 'saludó a',         selfVerb: 'se saludó a sí mismo',       color: '#57F287' },
    bite:     { emoji: '😈', verb: 'mordió a',         selfVerb: 'se mordió a sí mismo',       color: '#E74C3C' },
    cry:      { emoji: '😢', verb: 'lloró con',        selfVerb: 'está llorando solo',         color: '#5DADE2' },
    cuddle:   { emoji: '🫂', verb: 'acurrucó con',     selfVerb: 'se acurrucó solo',           color: '#F7B2BD' },
    punch:    { emoji: '👊', verb: 'le dio un puñetazo a', selfVerb: 'se golpeó a sí mismo',  color: '#C0392B' },
    highfive: { emoji: '🙌', verb: 'chocó los cinco con', selfVerb: 'se chocó los cinco',     color: '#F1C40F' },
    blush:    { emoji: '😳', verb: 'se ruborizó por',  selfVerb: 'se ruborizó solo',           color: '#FF6B9D' },
};

// ── Frases dinámicas por acción ────────────────────────────────────────────
const PHRASES = {
    hug:      ['¡Abrazo apretado!', '¡Qué tierno! 🥺', '¡El mejor abrazo del día!', '¡No te suelto! 🤗'],
    pat:      ['*pat pat pat*', '¡Eres muy bueno/a! 🥰', '¡Allá va ese pat!', '*te da palmaditas en la cabeza*'],
    slap:     ['¡TOMA!', '¡Se lo tenía merecido!', '💥 SMACK', '¡Eso dolió!'],
    kiss:     ['💋 *mwah*', '¡Qué romántico! 💕', '¡Sorpresa!', '*beso en la mejilla*'],
    poke:     ['*poke poke*', '¡Oye! 👉', '¡Despierta!', '*te pincha repetidamente*'],
    wave:     ['¡Hola! 👋', '¡Adiós!', '¡Buenos días!', '¡Yoo!'],
    bite:     ['¡NOM NOM!', '¡Estás tan rico/a! 😈', '*mordisco suave*', '¡CHOMP!'],
    cry:      ['😭 *sniff sniff*', '¡Qué triste!', '*llora a mares*', '¡Las lágrimas no paran!'],
    cuddle:   ['*se acurruca contigo*', '¡Tan calientito! 🫂', '¡No te vayas!', '*snuggle*'],
    punch:    ['¡POW!', '¡KO!', '¡Eso fue un gancho!', '💥 ¡Directo a la mandíbula!'],
    highfive: ['¡CHÓCALA!', '¡Team work! 🙌', '¡Vamos!', '¡Eso es compañerismo!'],
    blush:    ['*se pone rojo/a*', '¡Qué vergüenza! 😳', '¡Para, me haces sonrojar!', '*esconde la cara*'],
};

// ── Helper ─────────────────────────────────────────────────────────────────
function getRandomFallback(action) {
    const list = FALLBACK_GIFS[action];
    if (!list?.length) return null;
    return list[Math.floor(Math.random() * list.length)];
}

function getRandomPhrase(action) {
    const list = PHRASES[action];
    if (!list?.length) return '';
    return list[Math.floor(Math.random() * list.length)];
}

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('action')
        .setDescription('🎭 Realiza una acción hacia otro usuario con GIF animado.')
        .addStringOption(opt => opt
            .setName('accion')
            .setDescription('Acción a realizar')
            .setRequired(true)
            .addChoices(
                { name: '🤗 Abrazar',        value: 'hug'      },
                { name: '🥰 Pat',             value: 'pat'      },
                { name: '💢 Abofetear',       value: 'slap'     },
                { name: '💋 Besar',           value: 'kiss'     },
                { name: '👉 Pinchar',         value: 'poke'     },
                { name: '👋 Saludar',         value: 'wave'     },
                { name: '😈 Morder',          value: 'bite'     },
                { name: '😢 Llorar',          value: 'cry'      },
                { name: '🫂 Acurrucarse',     value: 'cuddle'   },
                { name: '👊 Puñetazo',        value: 'punch'    },
                { name: '🙌 Chocar los cinco',value: 'highfive' },
                { name: '😳 Sonrojarse',      value: 'blush'    }
            )
        )
        .addUserOption(opt => opt
            .setName('usuario')
            .setDescription('Usuario objetivo (si no se pone, la acción es al aire)')
            .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const accion  = interaction.options.getString('accion');
        const target  = interaction.options.getUser('usuario');
        const action  = ACTIONS[accion];
        const phrase  = getRandomPhrase(accion);

        // ── Obtener GIF ───────────────────────────────────────────────────
        let gifUrl = null;

        // 1. Intentar nekos.best (gratis, sin API key, solo anime)
        try {
            const res  = await fetch(`https://nekos.best/api/v2/${accion}?amount=10`);
            const data = await res.json();
            const results = data?.results || [];
            if (results.length) {
                const pick = results[Math.floor(Math.random() * results.length)];
                gifUrl = pick.url || null;
            }
        } catch { /* nekos.best no disponible */ }

        // 2. Tenor si hay API key
        if (!gifUrl && process.env.TENOR_API_KEY) {
            try {
                const queries = {
                    hug:      'anime hug',
                    pat:      'anime head pat',
                    slap:     'anime slap',
                    kiss:     'anime kiss',
                    poke:     'anime poke',
                    wave:     'anime wave hello',
                    bite:     'anime bite nom',
                    cry:      'anime cry sad',
                    cuddle:   'anime cuddle snuggle',
                    punch:    'anime punch',
                    highfive: 'anime high five',
                    blush:    'anime blush embarrassed',
                };
                const q   = queries[accion] || `anime ${accion}`;
                const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${process.env.TENOR_API_KEY}&limit=20&media_filter=gif`);
                const data = await res.json();
                const results = data?.results || [];
                if (results.length) {
                    const pick = results[Math.floor(Math.random() * results.length)];
                    gifUrl = pick.media_formats?.gif?.url || null;
                }
            } catch { /* sin conexión o key inválida */ }
        }

        // 3. Fallback hardcodeado
        if (!gifUrl) gifUrl = getRandomFallback(accion);

        // ── Construir descripción ─────────────────────────────────────────
        const isSelf      = target?.id === interaction.user.id;
        const targetText  = target ? `${target}` : '';
        let description;

        if (!target) {
            description = `${interaction.user} **${action.verb.replace(' a', '')}** ${action.emoji}\n*${phrase}*`;
        } else if (isSelf) {
            description = `${interaction.user} **${action.selfVerb}** ${action.emoji}\n*${phrase}*`;
        } else {
            description = `${interaction.user} **${action.verb}** ${targetText} ${action.emoji}\n*${phrase}*`;
        }

        // ── Embed ─────────────────────────────────────────────────────────
        const embed = new EmbedBuilder()
            .setDescription(description)
            .setColor(action.color)
            .setFooter({ text: `${interaction.user.tag}${target && !isSelf ? ` → ${target.tag}` : ''}` })
            .setTimestamp();

        if (gifUrl) embed.setImage(gifUrl);

        return interaction.editReply({ embeds: [embed] });
    }
};