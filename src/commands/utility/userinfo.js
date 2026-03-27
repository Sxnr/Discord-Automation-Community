const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const statusEmoji = {
    online:    '🟢 En línea',
    idle:      '🌙 Ausente',
    dnd:       '🔴 No molestar',
    offline:   '⚫ Desconectado',
    invisible: '⚫ Invisible'
};

const badges = {
    ActiveDeveloper:           '👨‍💻',
    BugHunterLevel1:           '🐛',
    BugHunterLevel2:           '🐛',
    CertifiedModerator:        '🛡️',
    HypeSquadOnlineHouse1:     '🏠',
    HypeSquadOnlineHouse2:     '🏠',
    HypeSquadOnlineHouse3:     '🏠',
    Hypesquad:                 '🎪',
    Partner:                   '🤝',
    PremiumEarlySupporter:     '⭐',
    Staff:                     '👷',
    VerifiedBot:               '✅',
    VerifiedDeveloper:         '🔷'
};

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Muestra información detallada de un usuario.')
        .addUserOption(opt =>
            opt.setName('usuario')
                .setDescription('Usuario a consultar (deja vacío para verte a ti)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const target = interaction.options.getUser('usuario') || interaction.user;
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        // Fechas
        const createdAt  = Math.floor(target.createdTimestamp / 1000);
        const joinedAt   = member ? Math.floor(member.joinedTimestamp / 1000) : null;

        // Roles (sin @everyone, ordenados por posición descendente)
        const roles = member
            ? member.roles.cache
                .filter(r => r.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => `${r}`)
            : [];

        // Badges
        const userFlags = target.flags?.toArray() || [];
        const userBadges = userFlags.map(f => badges[f]).filter(Boolean).join(' ') || 'Ninguna';

        // Color del rol más alto con color
        const hexColor = member?.displayHexColor !== '#000000'
            ? member.displayHexColor
            : '#5865F2';

        // Avatar
        const avatarURL = target.displayAvatarURL({ size: 1024, dynamic: true });

        // Banner (requiere fetch con force)
        const fetchedUser = await target.fetch(true).catch(() => null);
        const bannerURL = fetchedUser?.bannerURL({ size: 1024, dynamic: true });

        // Estado
        const status = member?.presence?.status || 'offline';

        const embed = new EmbedBuilder()
            .setTitle(`${target.bot ? '🤖' : '👤'} ${target.username}`)
            .setThumbnail(avatarURL)
            .setColor(hexColor)
            .setDescription([
                `> 🪪 **ID:** \`${target.id}\``,
                `> 📛 **Tag:** \`${target.tag}\``,
                `> ${statusEmoji[status] || '⚫ Desconectado'}`,
                target.bot ? '> 🤖 **Es un bot**' : null
            ].filter(Boolean).join('\n'))
            .addFields(
                {
                    name: '📅 Cuenta creada',
                    value: `<t:${createdAt}:F>\n<t:${createdAt}:R>`,
                    inline: true
                },
                {
                    name: '📥 Entró al servidor',
                    value: joinedAt
                        ? `<t:${joinedAt}:F>\n<t:${joinedAt}:R>`
                        : 'No está en el servidor',
                    inline: true
                },
                {
                    name: '\u200b',
                    value: '\u200b',
                    inline: true
                },
                {
                    name: `🏷️ Roles (${roles.length})`,
                    value: roles.length
                        ? roles.slice(0, 10).join(' ') + (roles.length > 10 ? ` y ${roles.length - 10} más...` : '')
                        : 'Sin roles',
                    inline: false
                },
                {
                    name: '🏅 Insignias',
                    value: userBadges,
                    inline: true
                },
                {
                    name: '🎨 Color del rol',
                    value: `\`${hexColor}\``,
                    inline: true
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