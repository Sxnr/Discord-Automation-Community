const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
    StringSelectMenuBuilder, MessageFlags
} = require('discord.js');

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('📂 Despliega el panel de asistencia interactivo con todos los comandos.'),

    async execute(interaction) {
        const { client } = interaction;
        const commands    = client.commands;

        const totalCommands = commands.size;
        const adminCount    = commands.filter(cmd => cmd.category === 'admin').size;
        const utilityCount  = commands.filter(cmd => cmd.category === 'utility').size;
        const guildIcon     = interaction.guild.iconURL({ dynamic: true });
        const botAvatar     = client.user.displayAvatarURL();

        const helpMainEmbed = new EmbedBuilder()
            .setTitle(`${client.user.username} • Centro de Comandos`)
            .setColor('#5865F2')
            .setThumbnail(botAvatar)
            .setDescription(
                `**¡Hola, ${interaction.user}!** 👋\n\n` +
                `Bienvenido al panel de asistencia de **${client.user.username}**.\n` +
                `Usa el menú de abajo para explorar los módulos disponibles.\n\n` +
                `> 💡 Selecciona una categoría para ver los comandos detallados.`
            )
            .addFields(
                {
                    name: '📊 Estadísticas del Sistema',
                    value:
                        `\`\`\`\n` +
                        `📦 Comandos totales  →  ${totalCommands}\n` +
                        `🛡️ Administración    →  ${adminCount}\n` +
                        `🛠️ Utilidad          →  ${utilityCount}\n` +
                        `\`\`\``,
                    inline: false
                },
                {
                    name: '🛡️ Administración',
                    value: `Tickets, sorteos, warns, baneos, mutes, automod y configuración.\n> \`${adminCount} comandos\``,
                    inline: true
                },
                {
                    name: '🛠️ Utilidad',
                    value: `Herramientas de diagnóstico, estado y asistencia general.\n> \`${utilityCount} comandos\``,
                    inline: true
                },
                {
                    name: '⚡ Accesos Rápidos',
                    value:
                        `> \`/settings\` — Configuración del servidor\n` +
                        `> \`/setup-tickets\` — Sistema de tickets\n` +
                        `> \`/giveaway start\` — Iniciar un sorteo\n` +
                        `> \`/automod status\` — Estado del automod\n` +
                        `> \`/automod config\` — Configurar automod\n` +
                        `> \`/warn add\` — Advertir a un usuario\n` +
                        `> \`/warn list\` — Ver historial de warns\n` +
                        `> \`/mod ban\` — Banear usuario\n` +
                        `> \`/mod mute\` — Silenciar usuario\n` +
                        `> \`/mod history\` — Historial de moderación`,
                    inline: false
                }
            )
            .setImage('https://media.discordapp.net/attachments/1380335501776654357/1487156050288312330/Floppa_GIF_-_Floppa_-_Discover__Share_GIFs.gif?ex=69c81d80&is=69c6cc00&hm=3038db4586311e89424f249f06ddc2ed1cf3e1ecb74bb57d20526feefb2a725d&=')
            .setFooter({
                text: `${interaction.guild.name}  •  ${totalCommands} comandos disponibles`,
                iconURL: guildIcon
            })
            .setTimestamp();

        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('📂 Selecciona una categoría...')
            .addOptions([
                {
                    label:       'Administración',
                    description: `Tickets, warns, baneos, mutes, automod y más. ${adminCount} comandos.`,
                    value:       'admin',
                    emoji:       '🛡️',
                },
                {
                    label:       'Utilidad',
                    description: `Diagnóstico, estado y asistencia general. ${utilityCount} comandos.`,
                    value:       'utility',
                    emoji:       '🛠️',
                },
            ]);

        const row = new ActionRowBuilder().addComponents(menu);

        await interaction.reply({
            embeds:     [helpMainEmbed],
            components: [row],
            flags:      [MessageFlags.Ephemeral]
        });
    },
};