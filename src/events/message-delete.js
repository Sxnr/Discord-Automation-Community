const { Events, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        if (message.partial || message.author?.bot) return;

        const settings = db.prepare('SELECT audit_log_channel FROM guild_settings WHERE guild_id = ?').get(message.guild.id);
        if (!settings || !settings.audit_log_channel) return;

        const logChannel = message.guild.channels.cache.get(settings.audit_log_channel);
        if (!logChannel) return;

        const logEmbed = new EmbedBuilder()
            .setTitle('🗑️ Mensaje Eliminado')
            .setColor('#E74C3C')
            .addFields(
                { name: '👤 Autor', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
                { name: '📍 Canal', value: `${message.channel}`, inline: true },
                { name: '📄 Contenido', value: `\`\`\`${message.content || 'Sin contenido de texto (posible imagen/embed)'}\`\`\`` }
            )
            .setTimestamp()
            .setFooter({ text: 'Sistema de Auditoría Global' });

        await logChannel.send({ embeds: [logEmbed] });
    },
};