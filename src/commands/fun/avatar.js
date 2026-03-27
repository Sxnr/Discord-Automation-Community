const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('🖼️ Muestra el avatar y banner de un usuario.')
        .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a consultar (default: tú)'))
        .addStringOption(opt => opt
            .setName('tipo')
            .setDescription('Tipo de avatar')
            .addChoices(
                { name: '👤 Global',   value: 'global'  },
                { name: '🏠 Servidor', value: 'server'  }
            )
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('usuario') || interaction.user;
        const tipo   = interaction.options.getString('tipo') || 'global';

        // Forzar fetch para obtener banner
        const fetched = await target.fetch().catch(() => target);
        const member  = interaction.guild.members.cache.get(target.id);

        const globalAvatar = fetched.displayAvatarURL({ size: 4096, extension: 'png', forceStatic: false });
        const serverAvatar = member?.avatarURL({ size: 4096, extension: 'png', forceStatic: false }) || globalAvatar;
        const bannerUrl    = fetched.bannerURL({ size: 4096, extension: 'png', forceStatic: false });
        const bannerColor  = fetched.accentColor ? `#${fetched.accentColor.toString(16).padStart(6, '0')}` : '#5865F2';

        const avatarUrl = tipo === 'server' ? serverAvatar : globalAvatar;

        const embed = new EmbedBuilder()
            .setTitle(`🖼️ ${target.username}`)
            .setColor(bannerColor)
            .setImage(avatarUrl)
            .addFields(
                { name: '👤 Tag',     value: target.tag,                           inline: true },
                { name: '🆔 ID',      value: `\`${target.id}\``,                   inline: true },
                { name: '🤖 Bot',     value: target.bot ? '`Sí`' : '`No`',         inline: true },
                { name: '📅 Cuenta',  value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`, inline: true }
            )
            .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
            .setTimestamp();

        if (bannerUrl) embed.addFields({ name: '🎨 Banner', value: '[Ver banner](' + bannerUrl + ')', inline: true });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Avatar Global').setStyle(ButtonStyle.Link).setURL(globalAvatar).setEmoji('🌐'),
            ...(member?.avatarURL() ? [new ButtonBuilder().setLabel('Avatar Servidor').setStyle(ButtonStyle.Link).setURL(serverAvatar).setEmoji('🏠')] : []),
            ...(bannerUrl ? [new ButtonBuilder().setLabel('Ver Banner').setStyle(ButtonStyle.Link).setURL(bannerUrl).setEmoji('🎨')] : [])
        );

        return interaction.reply({ embeds: [embed], components: [row] });
    }
};