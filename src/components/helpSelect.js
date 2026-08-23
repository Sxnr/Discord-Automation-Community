const {
    EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder
} = require('discord.js');

const CATEGORY_META = {
    admin: { label: 'Administración', emoji: '🛡️', color: 0xED4245 },
    utility: { label: 'Utilidad', emoji: '🛠️', color: 0x5865F2 },
    economy: { label: 'Economía', emoji: '💰', color: 0xF1C40F },
    fun: { label: 'Diversión', emoji: '🎮', color: 0x57F287 },
    music: { label: 'Música', emoji: '🎵', color: 0x1DB954 },
};

module.exports = async function (interaction) {
    if (!interaction.isStringSelectMenu()) return false;
    if (interaction.customId !== 'help_menu') return false;

    const category = interaction.values[0];

    const meta = CATEGORY_META[category]
        ?? { label: category.charAt(0).toUpperCase() + category.slice(1), emoji: '📁', color: 0x99AAB5 };

    const cmds = interaction.client.commands.filter(cmd => cmd.category === category);
    const displayCommands = cmds.size
        ? cmds.map(cmd => `> \`/${cmd.data.name}\`\n> ${cmd.data.description}`).join('\n\n')
        : '*No hay comandos registrados en esta sección.*';

    // Reconstruir menú con la opción activa marcada como default
    const categoryCounts = {};
    interaction.client.commands.forEach(cmd => {
        const cat = cmd.category ?? 'sin categoría';
        categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    });
    const ORDER = ['admin', 'utility', 'economy', 'fun', 'music'];
    const sortedCats = [
        ...ORDER.filter(c => categoryCounts[c] !== undefined),
        ...Object.keys(categoryCounts).filter(c => !ORDER.includes(c)).sort(),
    ];
    const menuOptions = sortedCats.map(cat => {
        const m = CATEGORY_META[cat]
            ?? { label: cat.charAt(0).toUpperCase() + cat.slice(1), emoji: '📁' };
        return {
            label: m.label,
            description: `${categoryCounts[cat]} comando${categoryCounts[cat] !== 1 ? 's' : ''} disponibles.`,
            value: cat,
            emoji: m.emoji,
            default: cat === category,
        };
    });

    const helpEmbed = new EmbedBuilder()
        .setTitle(`${meta.emoji} ${meta.label} — ${cmds.size} comando${cmds.size !== 1 ? 's' : ''}`)
        .setDescription(displayCommands)
        .setColor(meta.color)
        .setFooter({ text: `Solicitado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

    await interaction.update({
        embeds: [helpEmbed],
        components: [new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('help_menu')
                .setPlaceholder('📂 Selecciona una categoría...')
                .addOptions(menuOptions)
        )],
    });
    return true;
};
