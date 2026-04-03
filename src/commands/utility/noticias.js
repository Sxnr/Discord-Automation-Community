const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// GNews API — gratis, sin restricción de host, 100 req/día
// Registro gratuito en: https://gnews.io (no requiere tarjeta)
const GNEWS = 'https://gnews.io/api/v4';

const CATS = {
    general:        { name: 'Generales',        emoji: '📰', color: '#5865F2', gnews: 'general'       },
    technology:     { name: 'Tecnología',       emoji: '💻', color: '#00B0F4', gnews: 'technology'    },
    science:        { name: 'Ciencia',          emoji: '🔬', color: '#57F287', gnews: 'science'       },
    sports:         { name: 'Deportes',         emoji: '⚽', color: '#FEE75C', gnews: 'sports'        },
    entertainment:  { name: 'Entretenimiento',  emoji: '🎬', color: '#EB459E', gnews: 'entertainment' },
    health:         { name: 'Salud',            emoji: '🏥', color: '#3BA55C', gnews: 'health'        },
    business:       { name: 'Negocios',         emoji: '💼', color: '#ED4245', gnews: 'business'      },
    world:          { name: 'Mundo',            emoji: '🌍', color: '#6C5CE7', gnews: 'world'         },
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
                { name: '🌍 Mundo',             value: 'world'         },
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

        const key = process.env.GNEWS_KEY;

        if (!key) {
            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor('#ED4245')
                    .setTitle('⚙️ API no configurada')
                    .setDescription('Falta la variable `GNEWS_KEY` en el `.env`.\n\n**Registro gratuito en:** https://gnews.io\n(No requiere tarjeta de crédito)')
                ],
            });
        }

        let articles;
        try {
            const url = `${GNEWS}/top-headlines?category=${info.gnews}&lang=${lang}&max=6&apikey=${key}`;
            const res  = await fetch(url);
            const data = await res.json();

            if (data.errors) throw new Error(Array.isArray(data.errors) ? data.errors.join(', ') : JSON.stringify(data.errors));
            articles = data.articles || [];
        } catch (e) {
            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor('#ED4245')
                    .setTitle('❌ Error al obtener noticias')
                    .setDescription(`${e.message}\n\n💡 Verifica que \`GNEWS_KEY\` en tu \`.env\` sea correcta.`)
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
            .setFooter({ text: `Solicitado por ${interaction.user.username} · GNews` })
            .setTimestamp();

        const firstImg = articles.find(a => a.image)?.image;
        if (firstImg) embed.setThumbnail(firstImg);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Ver más noticias')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://news.google.com/search?q=${encodeURIComponent(info.name)}&hl=${lang}`)
                .setEmoji('🌐'),
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
    },
};