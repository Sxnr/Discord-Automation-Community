const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const db = require('../../database/db');

function xpForLevel(level) {
    return 5 * (level ** 2) + 50 * level + 100;
}

function buildLeaderboard(entries, guild, page = 0) {
    const ITEMS_PER_PAGE = 10;
    const totalPages     = Math.ceil(entries.length / ITEMS_PER_PAGE);
    const pageEntries    = entries.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

    const medals = ['🥇', '🥈', '🥉'];

    const description = pageEntries.length === 0
        ? '*No hay usuarios en el ranking todavía.*'
        : pageEntries.map((e, i) => {
            const globalIndex = page * ITEMS_PER_PAGE + i;
            const medal       = medals[globalIndex] || `\`#${globalIndex + 1}\``;
            let totalXp       = e.xp;
            for (let l = 0; l < e.level; l++) totalXp += xpForLevel(l);

            return `${medal} <@${e.user_id}>\n` +
                   `> 🏅 Nivel \`${e.level}\` • ⭐ \`${e.xp}/${xpForLevel(e.level)} XP\` • 💎 \`${totalXp.toLocaleString()} XP total\``;
        }).join('\n\n');

    const embed = new EmbedBuilder()
        .setTitle(`🏆 Leaderboard — ${guild.name}`)
        .setColor('#F1C40F')
        .setThumbnail(guild.iconURL())
        .setDescription(description)
        .setFooter({ text: `Página ${page + 1} de ${totalPages || 1} • ${entries.length} usuarios rankeados` })
        .setTimestamp();

    const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`lb_page:${page - 1}`)
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(`lb_page:${page + 1}`)
            .setEmoji('➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId('lb_refresh')
            .setLabel('Actualizar')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Primary)
    );

    return { embed, components: [btnRow] };
}

module.exports = {
    category: 'utility',
    buildLeaderboard,
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('🏆 Muestra el ranking de niveles del servidor.'),

    async execute(interaction) {
        await interaction.deferReply();
        const guildId = interaction.guild.id;

        const entries = db.prepare(`
            SELECT * FROM levels WHERE guild_id = ?
            ORDER BY level DESC, xp DESC
        `).all(guildId);

        if (entries.length === 0) {
            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🏆 Leaderboard')
                    .setDescription('*Nadie ha ganado XP todavía. ¡Empieza a chatear!*')
                    .setColor('#F1C40F')
                ]
            });
        }

        const { embed, components } = buildLeaderboard(entries, interaction.guild, 0);
        return interaction.editReply({ embeds: [embed], components });
    }
};