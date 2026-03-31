const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

const IDIOMAS = {
    es: { nombre: 'Español',   flag: '🇪🇸' },
    en: { nombre: 'Inglés',    flag: '🇬🇧' },
    fr: { nombre: 'Francés',   flag: '🇫🇷' },
    de: { nombre: 'Alemán',    flag: '🇩🇪' },
    it: { nombre: 'Italiano',  flag: '🇮🇹' },
    pt: { nombre: 'Portugués', flag: '🇵🇹' },
};

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('definicion')
        .setDescription('📖 Busca la definición de una palabra en el diccionario.')
        .addStringOption(o => o
            .setName('palabra')
            .setDescription('Palabra que quieres buscar')
            .setRequired(true)
            .setMaxLength(50)
        )
        .addStringOption(o => o
            .setName('idioma')
            .setDescription('Idioma del diccionario (por defecto: Español)')
            .addChoices(
                { name: '🇪🇸 Español',   value: 'es' },
                { name: '🇬🇧 Inglés',    value: 'en' },
                { name: '🇫🇷 Francés',   value: 'fr' },
                { name: '🇩🇪 Alemán',    value: 'de' },
                { name: '🇮🇹 Italiano',  value: 'it' },
                { name: '🇵🇹 Portugués', value: 'pt' },
            )
        ),

    async execute(interaction) {
        const palabra = interaction.options.getString('palabra').trim().toLowerCase();
        const idioma  = interaction.options.getString('idioma') || 'es';
        const info    = IDIOMAS[idioma];

        await interaction.deferReply();

        let data;
        try {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/${idioma}/${encodeURIComponent(palabra)}`);
            if (!res.ok) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor('#ED4245')
                        .setTitle('❌ Palabra no encontrada')
                        .setDescription(`No encontré **"${palabra}"** en ${info.flag} ${info.nombre}.\nVerifica la ortografía o prueba otro idioma.`)
                    ],
                });
            }
            data = await res.json();
        } catch {
            return interaction.editReply({
                embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('❌ Error al conectar con el diccionario.')],
            });
        }

        const entry    = data[0];
        const phonetic = entry.phonetics?.find(p => p.text)?.text || '';
        const meanings = entry.meanings?.slice(0, 3) || [];

        const embed = new EmbedBuilder()
            .setTitle(`${info.flag} ${palabra}${phonetic ? `  \`${phonetic}\`` : ''}`)
            .setColor('#5865F2')
            .setFooter({ text: `Solicitado por ${interaction.user.username} • dictionaryapi.dev` })
            .setTimestamp();

        for (const meaning of meanings) {
            const pos  = meaning.partOfSpeech || 'definición';
            const defs = meaning.definitions?.slice(0, 2) || [];

            let value = defs.map((d, i) => {
                let text = `**${i + 1}.** ${d.definition}`;
                if (d.example) text += `\n> *"${d.example}"*`;
                return text;
            }).join('\n\n');

            if (meaning.synonyms?.length) value += `\n**Sinónimos:** ${meaning.synonyms.slice(0, 5).join(', ')}`;
            if (value.length > 1024) value = value.slice(0, 1021) + '...';

            embed.addFields({ name: `📌 ${pos.charAt(0).toUpperCase() + pos.slice(1)}`, value });
        }

        return interaction.editReply({ embeds: [embed] });
    },
};