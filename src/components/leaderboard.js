const db = require('../database/db');
const { buildLeaderboard } = require('../commands/utility/leaderboard');

module.exports = async function (interaction) {
    if (!interaction.isButton()) return false;
    const { customId } = interaction;

    if (customId.startsWith('lb_page:')) {
        const page = parseInt(customId.split(':')[1]);
        const guildId = interaction.guild.id;

        const entries = db.prepare('SELECT * FROM levels WHERE guild_id = ? ORDER BY level DESC, xp DESC').all(guildId);
        const { embed, components } = buildLeaderboard(entries, interaction.guild, page);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    if (customId === 'lb_refresh') {
        const guildId = interaction.guild.id;
        const entries = db.prepare('SELECT * FROM levels WHERE guild_id = ? ORDER BY level DESC, xp DESC').all(guildId);
        const { embed, components } = buildLeaderboard(entries, interaction.guild, 0);
        await interaction.update({ embeds: [embed], components });
        return true;
    }

    return false;
};
