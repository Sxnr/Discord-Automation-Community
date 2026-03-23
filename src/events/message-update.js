const { Events, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        if (oldMessage.partial || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;

        const settings = db.prepare('SELECT audit_log_channel FROM guild_settings WHERE guild_id = ?').get(oldMessage.guild.id);
        if (!settings || !settings.audit_log_channel) return;

        const logChannel = oldMessage.guild.channels.cache.get(settings.audit_log_channel);
        if (!logChannel) return;

        const logEmbed = new EmbedBuilder()
            .setTitle('📝 Mensaje Editado')
            .setColor('#F1C40F')
            .setURL(newMessage.url)
            .addFields(
                { name: '👤 Autor', value: `${oldMessage.author.tag}`, inline: true },
                { name: '📍 Canal', value: `${oldMessage.channel}`, inline: true },
                { name: '❌ Antes', value: `\`\`\`${oldMessage.content.slice(0, 1000)}\`\`\`` },
                { name: '✅ Después', value: `\`\`\`${newMessage.content.slice(0, 1000)}\`\`\`` }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
    },
};