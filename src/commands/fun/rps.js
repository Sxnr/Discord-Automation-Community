const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const CHOICES = {
    piedra:   { emoji: '🪨', beats: 'tijera' },
    papel:    { emoji: '📄', beats: 'piedra' },
    tijera:   { emoji: '✂️', beats: 'papel'  }
};

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('✂️ Juega Piedra, Papel o Tijera contra el bot.')
        .addStringOption(opt => opt
            .setName('eleccion')
            .setDescription('Tu elección')
            .setRequired(true)
            .addChoices(
                { name: '🪨 Piedra', value: 'piedra' },
                { name: '📄 Papel',  value: 'papel'  },
                { name: '✂️ Tijera', value: 'tijera' }
            )
        ),

    async execute(interaction) {
        const userChoice = interaction.options.getString('eleccion');
        const botKey     = Object.keys(CHOICES)[Math.floor(Math.random() * 3)];
        const botChoice  = CHOICES[botKey];
        const userDef    = CHOICES[userChoice];

        let result, color;
        if (userChoice === botKey) {
            result = '🤝 ¡Empate!';
            color  = '#FEE75C';
        } else if (userDef.beats === botKey) {
            result = '🎉 ¡Ganaste!';
            color  = '#57F287';
        } else {
            result = '😔 ¡Perdiste!';
            color  = '#ED4245';
        }

        return interaction.reply({
            embeds: [new EmbedBuilder()
                .setTitle('✂️ Piedra, Papel o Tijera')
                .setColor(color)
                .addFields(
                    { name: `${interaction.user.username}`, value: `${userDef.emoji} **${userChoice.charAt(0).toUpperCase() + userChoice.slice(1)}**`, inline: true },
                    { name: 'VS',                           value: '⚔️',                                                                              inline: true },
                    { name: 'Bot',                          value: `${botChoice.emoji} **${botKey.charAt(0).toUpperCase() + botKey.slice(1)}**`,       inline: true }
                )
                .setDescription(`## ${result}`)
                .setFooter({ text: `${interaction.user.tag}` })
                .setTimestamp()
            ]
        });
    }
};