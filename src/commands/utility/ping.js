const { SlashCommandBuilder, EmbedBuilder, version } = require('discord.js');
const os = require('node:os');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Muestra el estado técnico detallado del bot.'),
    async execute(interaction) {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        const statusEmbed = new EmbedBuilder()
            .setTitle('📊 Estado del Sistema')
            .setColor('#2ECC71')
            .addFields(
                { name: '🌐 Latencia API', value: `\`${interaction.client.ws.ping}ms\``, inline: true },
                { name: '💻 Node.js', value: `\`${process.version}\``, inline: true },
                { name: '📦 Discord.js', value: `\`v${version}\``, inline: true },
                { name: '⏱️ Uptime', value: `\`${hours}h ${minutes}m\``, inline: true },
                { name: '🧠 Memoria RAM', value: `\`${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\``, inline: true },
                { name: '🖥️ OS', value: `\`${os.platform()} ${os.arch()}\``, inline: true }
            )
            .setFooter({ text: 'Sistema Operacional' })
            .setTimestamp();

        await interaction.reply({ embeds: [statusEmbed] });
    },
};