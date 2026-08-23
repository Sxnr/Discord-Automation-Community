const { MessageFlags } = require('discord.js');
const db = require('../database/db');

module.exports = async function (interaction) {
    if (!interaction.isButton()) return false;
    const { customId } = interaction;

    if (customId === 'join_giveaway') {
        const giveaway = db.prepare('SELECT participants, ended, required_role FROM giveaways WHERE message_id = ?').get(interaction.message.id);

        if (!giveaway) { await interaction.reply({ content: '❌ No se encontraron datos de este sorteo.', flags: [MessageFlags.Ephemeral] }); return true; }
        if (giveaway.ended) { await interaction.reply({ content: '❌ Este sorteo ya ha finalizado.', flags: [MessageFlags.Ephemeral] }); return true; }

        if (giveaway.required_role && !interaction.member.roles.cache.has(giveaway.required_role)) {
            await interaction.reply({ content: `❌ Necesitas el rol <@&${giveaway.required_role}> para participar.`, flags: [MessageFlags.Ephemeral] });
            return true;
        }

        const participants = JSON.parse(giveaway.participants || '[]');
        if (participants.includes(interaction.user.id)) {
            await interaction.reply({ content: '⚠️ Ya estás participando en este sorteo.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        participants.push(interaction.user.id);
        db.prepare('UPDATE giveaways SET participants = ? WHERE message_id = ?').run(JSON.stringify(participants), interaction.message.id);
        await interaction.reply({ content: '✅ ¡Te has registrado correctamente! Mucha suerte. 🎉', flags: [MessageFlags.Ephemeral] });
        return true;
    }

    return false;
};
