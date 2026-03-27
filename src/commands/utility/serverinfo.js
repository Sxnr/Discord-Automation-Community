const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const verificationLevels = {
    0: '🔓 Ninguna',
    1: '📧 Baja — Email verificado',
    2: '⏱️ Media — 5 min en Discord',
    3: '🏠 Alta — 10 min en el servidor',
    4: '📱 Máxima — Teléfono verificado'
};

const boostTiers = {
    0: 'Sin nivel',
    1: '🥈 Nivel 1',
    2: '🥇 Nivel 2',
    3: '💎 Nivel 3'
};

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Muestra información detallada del servidor.'),

    async execute(interaction) {
        await interaction.deferReply();

        const guild = interaction.guild;
        await guild.fetch();

        // Miembros
        const totalMembers  = guild.memberCount;
        const bots          = guild.members.cache.filter(m => m.user.bot).size;
        const humans        = totalMembers - bots;

        // Canales
        const textChannels  = guild.channels.cache.filter(c => c.type === 0).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
        const categories    = guild.channels.cache.filter(c => c.type === 4).size;
        const forums        = guild.channels.cache.filter(c => c.type === 15).size;

        // Roles (sin @everyone)
        const roleCount     = guild.roles.cache.size - 1;

        // Emojis y stickers
        const emojis        = guild.emojis.cache.size;
        const stickers      = guild.stickers.cache.size;

        // Fechas
        const createdAt     = Math.floor(guild.createdTimestamp / 1000);

        // Dueño
        const owner         = await guild.fetchOwner().catch(() => null);

        // Boost
        const boostTier     = guild.premiumTier;
        const boostCount    = guild.premiumSubscriptionCount || 0;

        const iconURL       = guild.iconURL({ size: 1024, dynamic: true });
        const bannerURL     = guild.bannerURL({ size: 1024, dynamic: true });

        const embed = new EmbedBuilder()
            .setTitle(`🏰 ${guild.name}`)
            .setThumbnail(iconURL)
            .setColor('#5865F2')
            .setDescription([
                `> 🪪 **ID:** \`${guild.id}\``,
                `> 👑 **Dueño:** ${owner ? `${owner.user.tag}` : 'Desconocido'}`,
                `> 📅 **Creado:** <t:${createdAt}:F> (<t:${createdAt}:R>)`
            ].join('\n'))
            .addFields(
                {
                    name: '👥 Miembros',
                    value: [
                        `> 🧑 Humanos: \`${humans}\``,
                        `> 🤖 Bots: \`${bots}\``,
                        `> 📊 Total: \`${totalMembers}\``
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '💬 Canales',
                    value: [
                        `> 📝 Texto: \`${textChannels}\``,
                        `> 🔊 Voz: \`${voiceChannels}\``,
                        `> 📁 Categorías: \`${categories}\``,
                        forums ? `> 💬 Foros: \`${forums}\`` : null
                    ].filter(Boolean).join('\n'),
                    inline: true
                },
                {
                    name: '✨ Extras',
                    value: [
                        `> 🏷️ Roles: \`${roleCount}\``,
                        `> 😄 Emojis: \`${emojis}\``,
                        `> 🎨 Stickers: \`${stickers}\``
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🚀 Boosts',
                    value: [
                        `> ${boostTiers[boostTier] || 'Sin nivel'}`,
                        `> 💜 Boosts: \`${boostCount}\``
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🛡️ Verificación',
                    value: `> ${verificationLevels[guild.verificationLevel] || 'Desconocido'}`,
                    inline: true
                },
                {
                    name: '📌 Descripción',
                    value: guild.description ? `> ${guild.description}` : '> Sin descripción',
                    inline: false
                }
            )
            .setFooter({
                text: `Solicitado por ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();

        if (bannerURL) embed.setImage(bannerURL);

        await interaction.editReply({ embeds: [embed] });
    }
};