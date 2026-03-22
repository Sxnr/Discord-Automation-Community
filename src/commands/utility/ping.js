const { SlashCommandBuilder } = require('discord.js');
const { execute } = require('../../events/ready');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Responde con el tiempo de latencia del bot.'),
    async execute(interaction) {
        const sent = await interaction.reply({ content: 'Calculando...', fetchReply: true});
        const latency = sent.createdTimestamp - interaction.createdTimestamp;

        await interaction.editReply(`¡Pong! 🏓\nLatencia API: ${interaction.client.ws.ping}ms\nLatencia Bot: ${latency}ms`);
    }
}