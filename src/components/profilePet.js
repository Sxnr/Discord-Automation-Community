const { EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../database/db');

module.exports = async function (interaction) {
    const { customId } = interaction;

    if (!interaction.isButton()) return false;

    // ── Profile reset confirm/cancel ──────────────────────────
    if (customId.startsWith('profile_reset_')) {
        const parts = customId.split('_');
        const act = parts[2];          // confirm | cancel
        const owner = parts[3];          // userId

        if (interaction.user.id !== owner) {
            await interaction.reply({ content: '❌ Este botón no es tuyo.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        if (act === 'cancel') {
            await interaction.update({
                embeds: [new EmbedBuilder().setColor('#57F287').setDescription('✅ Reset cancelado.')],
                components: []
            });
            return true;
        }

        if (act === 'confirm') {
            db.prepare(`
                UPDATE profiles SET bio = '', color = '#5865F2', banner_url = NULL,
                timezone = 'UTC', birthday_show = 1, fav_emoji = '⭐', socials = '{}'
                WHERE guild_id = ? AND user_id = ?
            `).run(interaction.guild.id, owner);

            await interaction.update({
                embeds: [new EmbedBuilder().setColor('#57F287').setDescription('🔄 Perfil reseteado correctamente.')],
                components: []
            });
            return true;
        }
    }

    // ── Pet buttons (feed/play/sleep desde /pet status) ──────
    if (customId.startsWith('pet_feed_') ||
        customId.startsWith('pet_play_') ||
        customId.startsWith('pet_sleep_')) {

        const parts = customId.split('_');
        const action = parts[1];   // feed | play | sleep
        const owner = parts[2];

        if (interaction.user.id !== owner) {
            await interaction.reply({ content: '❌ Esta mascota no es tuya.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        // Redirigir al subcommand correspondiente simulando la interacción
        interaction.options = { getSubcommand: () => action, getUser: () => null };
        await require('../commands/economy/pet').execute(interaction);
        return true;
    }

    // ── Pet release confirm/cancel ────────────────────────────
    if (customId.startsWith('pet_release_')) {
        const parts = customId.split('_');
        const action = parts[2];   // confirm | cancel
        const owner = parts[3];

        if (interaction.user.id !== owner) {
            await interaction.reply({ content: '❌ Este botón no es tuyo.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        if (action === 'cancel') {
            await interaction.update({
                embeds: [new EmbedBuilder().setColor('#57F287').setDescription('✅ Cancelado. Tu mascota sigue contigo.')],
                components: []
            });
            return true;
        }

        if (action === 'confirm') {
            const pet = db.prepare('SELECT * FROM pets WHERE guild_id = ? AND user_id = ?').get(interaction.guild.id, owner);
            db.prepare('DELETE FROM pets WHERE guild_id = ? AND user_id = ?').run(interaction.guild.id, owner);
            await interaction.update({
                embeds: [new EmbedBuilder().setColor('#ED4245')
                    .setDescription(`💔 **${pet?.emoji || '🐾'} ${pet?.name || 'Tu mascota'}** fue soltada. Adiós...`)],
                components: []
            });
            return true;
        }
    }

    return false;
};
