const { SlashCommandBuilder, EmbedBuilder, version } = require('discord.js');
const os = require('node:os');

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('🖥️ Muestra el monitor de rendimiento y estado técnico del sistema.'),
    async execute(interaction) {
        // 1. Cálculos de Tiempo de Actividad (Uptime)
        const totalSeconds = process.uptime();
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const uptimeString = `\`${days}d ${hours}h ${minutes}m ${seconds}s\``;

        // 2. Telemetría de Recursos y Red
        const ramUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const ramTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
        const ping = interaction.client.ws.ping;
        
        // Indicadores visuales dinámicos
        const getStatusEmoji = (ms) => ms < 100 ? '🟢' : ms < 250 ? '🟡' : '🔴';
        const getStatusColor = (ms) => ms < 100 ? '#2ECC71' : ms < 250 ? '#F1C40F' : '#E74C3C';

        const statusEmbed = new EmbedBuilder()
            .setTitle('🖥️ Sistema de Diagnóstico | Estado Global')
            .setColor(getStatusColor(ping))
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setDescription(
                `>>> **Reporte técnico del núcleo del sistema.**\n` +
                `El bot se está ejecutando sobre una arquitectura de tipo \`${os.platform()} ${os.arch()}\` con un entorno de ejecución optimizado.`
            )
            .addFields(
                { 
                    name: '🛰️ Red & Latencia', 
                    value: `**Websocket:** \`Estable\`\n**Latencia API:** \`${ping}ms\` ${getStatusEmoji(ping)}`, 
                    inline: true 
                },
                { 
                    name: '💾 Hardware & RAM', 
                    value: `**Uso:** \`${ramUsed} MB\`\n**Capacidad:** \`${ramTotal} GB\``, 
                    inline: true 
                },
                { 
                    name: '⏳ Ciclo de Vida', 
                    value: `**Uptime:** ${uptimeString}\n**Estado:** \`OPERATIVO\``, 
                    inline: true 
                }
            )
            .addFields(
                {
                    name: '📦 Entorno de Software',
                    value: `> **Discord.js:** \`v${version}\`\n> **Node.js:** \`${process.version}\`\n> **Host OS:** \`${os.type()}\``
                }
            )
            .setFooter({ 
                text: `Diagnóstico solicitado por: ${interaction.user.tag} • v2.1.0`, 
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
            })
            .setTimestamp();

        // Respondemos de forma pública para que todos vean la salud del bot
        await interaction.reply({ embeds: [statusEmbed] });
    },
};