const { SlashCommandBuilder, EmbedBuilder, version } = require('discord.js');
const os = require('node:os');

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('🖥️ Muestra el monitor de rendimiento y estado técnico del sistema.'),
    async execute(interaction) {
        // Cálculos de tiempo de actividad (Uptime)
        const totalSeconds = process.uptime();
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);

        const uptimeString = `\`${days}d ${hours}h ${minutes}m ${seconds}s\``;

        // Cálculos de Memoria y Latencia
        const ramUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const ping = interaction.client.ws.ping;
        
        // Indicador visual de salud del sistema
        const statusEmoji = ping < 100 ? '🟢' : ping < 200 ? '🟡' : '🔴';

        const statusEmbed = new EmbedBuilder()
            .setTitle('🖥️ Monitor de Sistema | Global Status')
            .setColor(ping < 150 ? '#2ECC71' : '#E74C3C')
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setDescription(`>>> **Estado actual del núcleo del bot.**\nEl sistema se encuentra operando bajo un entorno \`${os.platform()} ${os.arch()}\`.`)
            .addFields(
                { 
                    name: '🛰️ Conectividad', 
                    value: `**Latencia API:** \`${ping}ms\` ${statusEmoji}\n**Websocket:** \`Estable\``, 
                    inline: true 
                },
                { 
                    name: '💾 Recursos', 
                    value: `**RAM:** \`${ramUsed} MB\`\n**Node.js:** \`${process.version}\``, 
                    inline: true 
                },
                { 
                    name: '📦 Versiones', 
                    value: `**Discord.js:** \`v${version}\`\n**Sistema:** \`v2.0.4\``, 
                    inline: true 
                },
                { 
                    name: '⏳ Tiempo de Actividad', 
                    value: uptimeString, 
                    inline: false 
                }
            )
            .setFooter({ 
                text: `Solicitado por: ${interaction.user.tag}`, 
                iconURL: interaction.user.displayAvatarURL() 
            })
            .setTimestamp();

        await interaction.reply({ embeds: [statusEmbed] });
    },
};