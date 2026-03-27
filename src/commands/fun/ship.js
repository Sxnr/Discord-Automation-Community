const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function getShipEmoji(pct) {
    if (pct >= 90) return '💍';
    if (pct >= 70) return '💕';
    if (pct >= 50) return '❤️';
    if (pct >= 30) return '🙂';
    if (pct >= 10) return '😬';
    return '💔';
}

function getShipBar(pct) {
    const filled = Math.round(pct / 10);
    return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function getShipText(pct) {
    if (pct >= 90) return '¡Están hechos el uno para el otro! 💍';
    if (pct >= 70) return '¡Muy buena compatibilidad! 💕';
    if (pct >= 50) return 'Hay química entre ellos. ❤️';
    if (pct >= 30) return 'Podría funcionar con esfuerzo. 🙂';
    if (pct >= 10) return 'La cosa está complicada. 😬';
    return 'Definitivamente no. 💔';
}

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('ship')
        .setDescription('💘 Calcula la compatibilidad entre dos usuarios.')
        .addUserOption(opt => opt.setName('usuario1').setDescription('Primer usuario').setRequired(true))
        .addUserOption(opt => opt.setName('usuario2').setDescription('Segundo usuario (default: tú)').setRequired(false)),

    async execute(interaction) {
        const user1 = interaction.options.getUser('usuario1');
        const user2 = interaction.options.getUser('usuario2') || interaction.user;

        // Seed determinístico basado en IDs para que siempre dé el mismo resultado
        const seed = (BigInt(user1.id) + BigInt(user2.id)) % 101n;
        const pct  = Number(seed);

        const shipName = user1.username.slice(0, Math.ceil(user1.username.length / 2)) +
                         user2.username.slice(Math.floor(user2.username.length / 2));

        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle(`💘 Ship: **${shipName}**`)
                .setColor('#E91E8C')
                .addFields(
                    { name: '👤 Usuario 1', value: `${user1}`,  inline: true },
                    { name: '💞',           value: `${getShipEmoji(pct)}`, inline: true },
                    { name: '👤 Usuario 2', value: `${user2}`,  inline: true },
                    { name: `💘 Compatibilidad: ${pct}%`, value: `\`${getShipBar(pct)}\` **${pct}%**` },
                    { name: '💬 Veredicto', value: getShipText(pct) }
                )
                .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
                .setTimestamp()
            ]
        });
    }
};