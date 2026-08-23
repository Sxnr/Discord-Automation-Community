const { PermissionsBitField, MessageFlags } = require('discord.js');
const db = require('../database/db');

module.exports = async function (interaction) {
    if (!interaction.isButton()) return false;
    const { customId } = interaction;

    if (customId.startsWith('poll_vote_')) {
        const parts = customId.split('_');  // poll_vote_{id}_{idx}
        const pollId = parseInt(parts[2]);
        const optIdx = parseInt(parts[3]);

        const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
        if (!poll || poll.ended) {
            await interaction.reply({ content: '❌ Esta encuesta ya está cerrada.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        const voters = JSON.parse(poll.voters);
        const votes = JSON.parse(poll.votes);
        const userId = interaction.user.id;

        // Quitar voto anterior si ya votó
        for (const key of Object.keys(votes)) {
            votes[key] = votes[key].filter(u => u !== userId);
        }

        // Verificar si ya votó por la misma opción (toggle)
        const alreadyVoted = voters.includes(userId) && !votes[String(optIdx)].includes(userId);

        if (!voters.includes(userId)) voters.push(userId);
        votes[String(optIdx)].push(userId);

        db.prepare('UPDATE polls SET votes = ?, voters = ? WHERE id = ?')
            .run(JSON.stringify(votes), JSON.stringify(voters), pollId);

        const updated = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
        const opts = JSON.parse(updated.options);

        const { buildPollEmbed, buildPollButtons } = require('../commands/utility/poll');

        await interaction.update({
            embeds: [buildPollEmbed(updated, interaction.guild)],
            components: buildPollButtons(pollId, opts)
        });
        return true;
    }

    if (customId.startsWith('poll_results_')) {
        const pollId = parseInt(customId.split('_')[2]);
        const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
        if (!poll) { await interaction.reply({ content: '❌ Encuesta no encontrada.', flags: [MessageFlags.Ephemeral] }); return true; }

        const { buildPollEmbed } = require('../commands/utility/poll');
        await interaction.reply({
            embeds: [buildPollEmbed(poll, interaction.guild)],
            flags: [MessageFlags.Ephemeral]
        });
        return true;
    }

    if (customId.startsWith('poll_close_')) {
        const pollId = parseInt(customId.split('_')[2]);
        const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
        if (!poll || poll.ended) { await interaction.reply({ content: '❌ Esta encuesta ya está cerrada.', flags: [MessageFlags.Ephemeral] }); return true; }

        if (poll.author_id !== interaction.user.id && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            await interaction.reply({ content: '❌ Solo el autor o un moderador puede cerrar esta encuesta.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        db.prepare('UPDATE polls SET ended = 1 WHERE id = ?').run(pollId);
        const updated = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
        const opts = JSON.parse(updated.options);

        const { buildPollEmbed, buildPollButtons } = require('../commands/utility/poll');

        await interaction.update({
            embeds: [buildPollEmbed(updated, interaction.guild)],
            components: buildPollButtons(pollId, opts, true)
        });
        return true;
    }

    return false;
};
