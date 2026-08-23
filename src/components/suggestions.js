const db = require('../database/db');
const { buildEmbed, buildVoteRow } = require('../utils/suggestHelpers');

module.exports = async function (interaction) {
    if (!interaction.isButton()) return false;
    const { customId } = interaction;

    if (customId.startsWith('suggest_up_') || customId.startsWith('suggest_down_')) {
        const isUp = customId.startsWith('suggest_up_');
        const id = parseInt(customId.split('_')[2]);
        const userId = interaction.user.id;

        const sug = db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id);
        if (!sug || sug.status !== 'pending') {
            await interaction.reply({ content: '❌ Esta sugerencia ya no está activa.', ephemeral: true });
            return true;
        }

        let up = JSON.parse(sug.votes_up);
        let down = JSON.parse(sug.votes_down);

        up = up.filter(u => u !== userId);
        down = down.filter(u => u !== userId);

        if (isUp) up.push(userId);
        else down.push(userId);

        db.prepare('UPDATE suggestions SET votes_up = ?, votes_down = ? WHERE id = ?')
            .run(JSON.stringify(up), JSON.stringify(down), id);

        const author = await interaction.client.users.fetch(sug.author_id).catch(() => null);

        await interaction.update({
            embeds: [buildEmbed(author, sug.content, id, up, down)],
            components: [buildVoteRow(id, up.length, down.length)]
        });
        return true;
    }

    return false;
};
