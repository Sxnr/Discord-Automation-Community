const { Events, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const { guild } = member;

        // 1. Consulta de configuración optimizada
        const settings = db.prepare('SELECT welcome_channel FROM guild_settings WHERE guild_id = ?').get(guild.id);

        // Cláusula de guardia: Si no hay configuración o canal definido, abortamos silenciosamente
        if (!settings || !settings.welcome_channel) return;

        const channel = guild.channels.cache.get(settings.welcome_channel);
        if (!channel) return;

        // 2. Preparación de datos dinámicos
        const memberCount = guild.memberCount;
        const userMention = member.toString();
        
        // 3. Construcción del Embed de Bienvenida (Nivel Premium)
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('✨ ¡Una nueva estrella ha aterrizado!')
            .setAuthor({ 
                name: `Bienvenido(a), ${member.user.username}`, 
                iconURL: member.user.displayAvatarURL({ dynamic: true }) 
            })
            .setDescription(
                `>>> **¡Hola ${userMention}!** Nos alegra mucho tenerte en **${guild.name}**.\n` +
                `Te invitamos a leer las normas y disfrutar de nuestra comunidad tecnológica.`
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setColor('#5865F2')
            .addFields(
                { 
                    name: '👥 Posición de Miembro', 
                    value: `Eres nuestro integrante número **#${memberCount}**`, 
                    inline: true 
                },
                { 
                    name: '🆔 Identificador', 
                    value: `\`${member.id}\``, 
                    inline: true 
                }
            )
            .setImage(guild.bannerURL({ size: 1024 }) || null) // Si el server tiene banner, lo usamos como decoración
            .setFooter({ 
                text: `Sincronizado con el sistema global • ${guild.name}`, 
                iconURL: guild.iconURL({ dynamic: true }) 
            })
            .setTimestamp();

        // 4. Envío del mensaje con gestión de errores básica
        try {
            await channel.send({ 
                content: `🎊 ¡Atención! ${userMention} se ha unido al servidor.`,
                embeds: [welcomeEmbed] 
            });
        } catch (error) {
            console.error(`❌ Error al enviar bienvenida en ${guild.name}:`, error);
        }
    },
};