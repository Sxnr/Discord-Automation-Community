const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('dice')
        .setDescription('🎲 Lanza dados y ruleta.')
        .addSubcommand(sub => sub
            .setName('roll')
            .setDescription('🎲 Lanza uno o varios dados.')
            .addIntegerOption(opt => opt.setName('cantidad').setDescription('Cantidad de dados (1-10)').setMinValue(1).setMaxValue(10))
            .addIntegerOption(opt => opt.setName('caras').setDescription('Caras del dado (2-100)').setMinValue(2).setMaxValue(100))
        )
        .addSubcommand(sub => sub
            .setName('ruleta')
            .setDescription('🎰 Gira la ruleta y cae en un número.')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'roll') {
            const cantidad = interaction.options.getInteger('cantidad') ?? 1;
            const caras    = interaction.options.getInteger('caras') ?? 6;

            const rolls  = Array.from({ length: cantidad }, () => Math.floor(Math.random() * caras) + 1);
            const total  = rolls.reduce((a, b) => a + b, 0);
            const isCrit = rolls.every(r => r === caras);
            const isFail = rolls.every(r => r === 1);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle(`🎲 Dado${cantidad > 1 ? 's' : ''} de ${caras} caras`)
                    .setColor(isCrit ? '#F1C40F' : isFail ? '#ED4245' : '#5865F2')
                    .setDescription(
                        isCrit ? '✨ **¡CRÍTICO!** ¡Todos al máximo!' :
                        isFail ? '💀 **¡FALLO TOTAL!** Todos en 1.' : ''
                    )
                    .addFields(
                        { name: `🎲 Resultado${cantidad > 1 ? 's' : ''}`, value: rolls.map(r => `\`${r}\``).join(' '), inline: true },
                        ...(cantidad > 1 ? [{ name: '➕ Total', value: `**${total}**`, inline: true }] : [])
                    )
                    .setFooter({ text: `${interaction.user.tag} · ${cantidad}d${caras}` })
                ]
            });
        }

        if (sub === 'ruleta') {
            const number = Math.floor(Math.random() * 37); // 0-36
            const isRed  = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(number);
            const color  = number === 0 ? '🟢' : isRed ? '🔴' : '⚫';
            const hex    = number === 0 ? '#57F287' : isRed ? '#ED4245' : '#2C3E50';

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🎰 Ruleta')
                    .setColor(hex)
                    .setDescription(`## ${color} **${number}**`)
                    .setFooter({ text: `${interaction.user.tag}` })
                    .setTimestamp()
                ]
            });
        }
    }
};