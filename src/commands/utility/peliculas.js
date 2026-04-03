const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const TMDB   = 'https://api.themoviedb.org/3';
const IMG    = 'https://image.tmdb.org/t/p/w500';
const STARS  = n => '⭐'.repeat(Math.round(n / 2)) || '—';

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('pelicula')
        .setDescription('🎬 Busca información de una película.')
        .addStringOption(o => o
            .setName('titulo')
            .setDescription('Título de la película a buscar')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption(o => o
            .setName('idioma')
            .setDescription('Idioma de la respuesta (por defecto: Español)')
            .addChoices(
                { name: '🇪🇸 Español', value: 'es-MX' },
                { name: '🇬🇧 Inglés',  value: 'en-US' },
            )
        ),

    async execute(interaction) {
        const titulo = interaction.options.getString('titulo');
        const lang   = interaction.options.getString('idioma') || 'es-MX';
        const key    = process.env.TMDB_KEY;

        await interaction.deferReply();

        // 1. Buscar
        let movie;
        try {
            const res  = await fetch(`${TMDB}/search/movie?query=${encodeURIComponent(titulo)}&api_key=${key}&language=${lang}&page=1`);
            const data = await res.json();
            if (!data.results?.length) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setTitle('❌ Película no encontrada')
                        .setDescription(`No encontré **"${titulo}"** en TMDB.\nIntenta con el título original en inglés.`)
                    ],
                });
            }
            movie = data.results[0];
        } catch {
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('❌ Error al conectar con TMDB.')] });
        }

        // 2. Detalle completo (géneros, runtime, etc.)
        let detail, credits;
        try {
            const [dRes, cRes] = await Promise.all([
                fetch(`${TMDB}/movie/${movie.id}?api_key=${key}&language=${lang}`),
                fetch(`${TMDB}/movie/${movie.id}/credits?api_key=${key}&language=${lang}`),
            ]);
            detail  = await dRes.json();
            credits = await cRes.json();
        } catch {
            detail  = movie;
            credits = null;
        }

        const genres   = detail.genres?.map(g => g.name).join(', ') || '—';
        const runtime  = detail.runtime ? `${Math.floor(detail.runtime / 60)}h ${detail.runtime % 60}min` : '—';
        const rating   = detail.vote_average ? detail.vote_average.toFixed(1) : '—';
        const votes    = detail.vote_count?.toLocaleString('es-CL') || '—';
        const year     = detail.release_date?.slice(0, 4) || '—';
        const budget   = detail.budget > 0 ? `$${(detail.budget / 1e6).toFixed(1)}M` : null;
        const revenue  = detail.revenue > 0 ? `$${(detail.revenue / 1e6).toFixed(1)}M` : null;
        const director = credits?.crew?.find(c => c.job === 'Director')?.name || '—';
        const cast     = credits?.cast?.slice(0, 5).map(c => c.name).join(', ') || '—';
        const overview = detail.overview?.length > 400
            ? detail.overview.slice(0, 397) + '...'
            : detail.overview || '_Sin descripción disponible_';

        const embed = new EmbedBuilder()
            .setTitle(`🎬 ${detail.title}${detail.original_title !== detail.title ? ` *(${detail.original_title})*` : ''}`)
            .setDescription(overview)
            .setColor('#032541')
            .addFields(
                { name: '📅 Año',        value: year,    inline: true },
                { name: '⏱️ Duración',   value: runtime, inline: true },
                { name: '⭐ Puntuación', value: `**${rating}** / 10 (${votes} votos)\n${STARS(Number(rating))}`, inline: true },
                { name: '🎭 Géneros',    value: genres, inline: false },
                { name: '🎥 Director',   value: director, inline: true },
                { name: '🎭 Reparto',    value: cast, inline: false },
                ...(budget  ? [{ name: '💰 Presupuesto', value: budget,  inline: true }] : []),
                ...(revenue ? [{ name: '💵 Recaudación', value: revenue, inline: true }] : []),
                ...(detail.status ? [{ name: '📌 Estado', value: detail.status, inline: true }] : []),
            )
            .setFooter({ text: `Solicitado por ${interaction.user.username} · TMDB` })
            .setTimestamp();

        if (detail.poster_path)   embed.setThumbnail(`${IMG}${detail.poster_path}`);
        if (detail.backdrop_path) embed.setImage(`https://image.tmdb.org/t/p/w1280${detail.backdrop_path}`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Ver en TMDB')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://www.themoviedb.org/movie/${movie.id}`)
                .setEmoji('🎬'),
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
    },
};