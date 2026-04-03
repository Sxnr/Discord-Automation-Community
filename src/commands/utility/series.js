const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TMDB  = 'https://api.themoviedb.org/3';
const IMG   = 'https://image.tmdb.org/t/p/w500';
const STARS = n => '⭐'.repeat(Math.round(n / 2)) || '—';

const STATUS_ES = {
    'Returning Series': '🟢 En emisión',
    'Ended':            '🔴 Finalizada',
    'Canceled':         '⛔ Cancelada',
    'In Production':    '🟡 En producción',
    'Planned':          '📋 Planeada',
    'Pilot':            '🎬 Piloto',
};

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('serie')
        .setDescription('📺 Busca información de una serie de TV.')
        .addStringOption(o => o
            .setName('titulo')
            .setDescription('Título de la serie a buscar')
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
        let show;
        try {
            const res  = await fetch(`${TMDB}/search/tv?query=${encodeURIComponent(titulo)}&api_key=${key}&language=${lang}&page=1`);
            const data = await res.json();

            if (!data.results?.length) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setTitle('❌ Serie no encontrada')
                        .setDescription(`No encontré **"${titulo}"** en TMDB.\nIntenta con el título original en inglés.`)
                    ],
                });
            }
            show = data.results[0];
        } catch {
            return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('❌ Error al conectar con TMDB.')] });
        }

        // 2. Detalle completo
        let detail, credits;
        try {
            const [dRes, cRes] = await Promise.all([
                fetch(`${TMDB}/tv/${show.id}?api_key=${key}&language=${lang}`),
                fetch(`${TMDB}/tv/${show.id}/credits?api_key=${key}&language=${lang}`),
            ]);
            detail  = await dRes.json();
            credits = await cRes.json();
        } catch {
            detail  = show;
            credits = null;
        }

        const genres   = detail.genres?.map(g => g.name).join(', ') || '—';
        const rating   = detail.vote_average ? detail.vote_average.toFixed(1) : '—';
        const votes    = detail.vote_count?.toLocaleString('es-CL') || '—';
        const year     = detail.first_air_date?.slice(0, 4) || '—';
        const lastYear = detail.last_air_date?.slice(0, 4);
        const yearsStr = lastYear && lastYear !== year ? `${year} – ${lastYear}` : year;
        const seasons  = detail.number_of_seasons || '—';
        const episodes = detail.number_of_episodes || '—';
        const epRuntime = detail.episode_run_time?.[0] ? `~${detail.episode_run_time[0]} min` : '—';
        const network   = detail.networks?.map(n => n.name).join(', ') || '—';
        const status    = STATUS_ES[detail.status] || detail.status || '—';
        const creators  = detail.created_by?.map(c => c.name).join(', ') || '—';
        const cast      = credits?.cast?.slice(0, 5).map(c => c.name).join(', ') || '—';
        const overview  = detail.overview?.length > 400
            ? detail.overview.slice(0, 397) + '...'
            : detail.overview || '_Sin descripción disponible_';

        const embed = new EmbedBuilder()
            .setTitle(`📺 ${detail.name}${detail.original_name !== detail.name ? ` *(${detail.original_name})*` : ''}`)
            .setDescription(overview)
            .setColor('#01B4E4')
            .addFields(
                { name: '📅 Años',         value: yearsStr,          inline: true },
                { name: '⭐ Puntuación',   value: `**${rating}** / 10 (${votes} votos)\n${STARS(Number(rating))}`, inline: true },
                { name: '📌 Estado',       value: status,            inline: true },
                { name: '🎭 Géneros',      value: genres,            inline: false },
                { name: '📦 Temporadas',   value: `${seasons}`,      inline: true },
                { name: '🎞️ Episodios',    value: `${episodes}`,     inline: true },
                { name: '⏱️ Por episodio', value: epRuntime,         inline: true },
                { name: '📡 Red / Canal',  value: network,           inline: true },
                ...(creators !== '—' ? [{ name: '✍️ Creador(es)', value: creators, inline: true }] : []),
                { name: '🎭 Reparto',      value: cast,              inline: false },
            )
            .setFooter({ text: `Solicitado por ${interaction.user.username} · TMDB` })
            .setTimestamp();

        if (detail.poster_path)   embed.setThumbnail(`${IMG}${detail.poster_path}`);
        if (detail.backdrop_path) embed.setImage(`https://image.tmdb.org/t/p/w1280${detail.backdrop_path}`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Ver en TMDB')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://www.themoviedb.org/tv/${show.id}`)
                .setEmoji('📺'),
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
    },
};