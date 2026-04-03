const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const CATS = {
    general:       { name: 'Generales',       emoji: '📰', color: '#5865F2' },
    technology:    { name: 'Tecnología',      emoji: '💻', color: '#00B0F4' },
    science:       { name: 'Ciencia',         emoji: '🔬', color: '#57F287' },
    sports:        { name: 'Deportes',        emoji: '⚽', color: '#FEE75C' },
    entertainment: { name: 'Entretenimiento', emoji: '🎬', color: '#EB459E' },
    health:        { name: 'Salud',           emoji: '🏥', color: '#3BA55C' },
    business:      { name: 'Negocios',        emoji: '💼', color: '#ED4245' },
};

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('noticias')
        .setDescription('📰 Muestra las noticias más recientes del mundo.')
        .addStringOption(o => o
            .setName('categoria')
            .setDescription('Categoría de noticias (por defecto: Generales)')
            .addChoices(
                { name: '📰 Generales',        value: 'general'       },
                { name: '💻 Tecnología',        value: 'technology'    },
                { name: '🔬 Ciencia',           value: 'science'       },
                { name: '⚽ Deportes',          value: 'sports'        },
                { name: '🎬 Entretenimiento',   value: 'entertainment' },
                { name: '🏥 Salud',             value: 'health'        },
                { name: '💼 Negocios',          value: 'business'      },
            )
        )
        .addStringOption(o => o
            .setName('idioma')
            .setDescription('Idioma de las noticias (por defecto: Español)')
            .addChoices(
                { name: '🇪🇸 Español',   value: 'es' },
                { name: '🇬🇧 Inglés',    value: 'en' },
                { name: '🇵🇹 Portugués', value: 'pt' },
            )
        ),

    async execute(interaction) {
        const cat  = interaction.options.getString('categoria') || 'general';
        const lang = interaction.options.getString('idioma')    || 'es';
        const info = CATS[cat];

        await interaction.deferReply();

        const key = process.env.NEWS_API_KEY;
        let articles;

        try {
            const res  = await fetch(`https://newsapi.org/v2/top-headlines?category=${cat}&language=${lang}&pageSize=6&apiKey=${key}`);
            const data = await res.json();

            if (data.status !== 'ok') throw new Error(data.message || 'Error de API');
            articles = (data.articles || []).filter(a => a.title && a.title !== '[Removed]' && a.url);
        } catch (e) {
            // Fallback: intentar con inglés si el idioma pedido no tiene resultados
            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor('#ED4245')
                    .setTitle('❌ Error al obtener noticias')
                    .setDescription(`${e.message}\n\n💡 Si el error persiste desde el VPS, NewsAPI puede requerir plan pago para producción. Avísame para usar una alternativa gratuita.`)
                ],
            });
        }

        if (!articles.length) {
            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor('#FEE75C')
                    .setDescription(`⚠️ No hay noticias en **${info.name}** para el idioma seleccionado. Prueba con 🇬🇧 Inglés.`)
                ],
            });
        }

        const lines = articles.slice(0, 5).map((a, i) => {
            const time   = a.publishedAt
                ? `<t:${Math.floor(new Date(a.publishedAt).getTime() / 1000)}:R>`
                : '';
            const source = a.source?.name || 'Fuente desconocida';
            const title  = a.title.length > 100 ? a.title.slice(0, 97) + '...' : a.title;
            return `**${i + 1}.** [${title}](${a.url})\n> 📍 ${source} ${time}`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle(`${info.emoji} Noticias — ${info.name}`)
            .setDescription(lines)
            .setColor(info.color)
            .setFooter({ text: `Solicitado por ${interaction.user.username} · NewsAPI` })
            .setTimestamp();

        if (articles[0]?.urlToImage) {
            embed.setThumbnail(articles[0].urlToImage);
        }

        const rows = [];
        if (articles[0]?.url) {
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Ver más noticias')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://news.google.com/search?q=${encodeURIComponent(info.name)}&hl=${lang}`)
                    .setEmoji('🌐'),
            ));
        }

        return interaction.editReply({ embeds: [embed], ...(rows.length ? { components: rows } : {}) });
    },
};