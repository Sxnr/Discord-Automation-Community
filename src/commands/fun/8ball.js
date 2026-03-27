const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const RESPONSES = [
    // Positivas
    { text: '🟢 Sí, definitivamente.',         color: '#57F287' },
    { text: '🟢 Sin duda alguna.',              color: '#57F287' },
    { text: '🟢 Puedes contar con ello.',       color: '#57F287' },
    { text: '🟢 Las señales apuntan que sí.',   color: '#57F287' },
    { text: '🟢 Perspectivas muy buenas.',      color: '#57F287' },
    // Neutrales
    { text: '🟡 Pregunta de nuevo más tarde.',  color: '#FEE75C' },
    { text: '🟡 Mejor no te digo ahora.',       color: '#FEE75C' },
    { text: '🟡 No puedo predecirlo ahora.',    color: '#FEE75C' },
    { text: '🟡 Concéntrate y vuelve a preguntar.', color: '#FEE75C' },
    // Negativas
    { text: '🔴 No cuentes con ello.',          color: '#ED4245' },
    { text: '🔴 Mi respuesta es no.',           color: '#ED4245' },
    { text: '🔴 Las perspectivas no son buenas.', color: '#ED4245' },
    { text: '🔴 Muy dudoso.',                   color: '#ED4245' },
];

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('🎱 Consulta a la bola mágica.')
        .addStringOption(opt => opt
            .setName('pregunta')
            .setDescription('¿Qué quieres saber?')
            .setRequired(true)
            .setMaxLength(200)
        ),

    async execute(interaction) {
        const pregunta = interaction.options.getString('pregunta');
        const response = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];

        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle('🎱 Bola Mágica')
                .setColor(response.color)
                .addFields(
                    { name: '❓ Pregunta', value: pregunta },
                    { name: '🔮 Respuesta', value: `**${response.text}**` }
                )
                .setFooter({ text: `Preguntado por ${interaction.user.tag}` })
                .setTimestamp()
            ]
        });
    }
};