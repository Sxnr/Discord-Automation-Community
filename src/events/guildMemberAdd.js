const { Events, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        // Consultamos la configuración de ESTE servidor
        const settings = db.prepare('SELECT welcome_channel FROM guild_settings WHERE guild_id = ?').get(member.guild.id);

        if (!settings || !settings.welcome_channel) return;

        const channel = member.guild.channels.cache.get(settings.welcome_channel);
        if (!channel) return;

        const welcomeEmbed = new EmbedBuilder()
            .setTitle('✨ ¡Bienvenido(a)!')
            .setDescription(`Hola ${member}, bienvenido a **${member.guild.name}**. ¡Disfruta tu estancia!`)
            .setThumbnail(member.user.displayAvatarURL())
            .setColor('#5865F2')
            .setTimestamp();

        channel.send({ embeds: [welcomeEmbed] });
    },
};