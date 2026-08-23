const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const db = require('../database/db');

// Maneja el botón de aceptación de reglas (onboarding).
module.exports = async (interaction) => {
    if (!interaction.isButton()) return false;
    if (interaction.customId !== 'rules_accept') return false;

    const gid = interaction.guildId;
    const cfg = db.prepare('SELECT verify_role FROM guild_settings WHERE guild_id = ?').get(gid);
    const roleId = cfg && cfg.verify_role;

    try {
        if (roleId && !interaction.member.roles.cache.has(roleId)) {
            await interaction.member.roles.add(roleId);
        }

        const row = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(interaction.component)
                .setDisabled(true)
                .setLabel('✅ Reglas aceptadas')
                .setStyle(ButtonStyle.Secondary)
        );
        await interaction.message.edit({ components: [row] });
        await interaction.reply({ content: '✅ ¡Gracias por aceptar las reglas!', flags: [MessageFlags.Ephemeral] });
    } catch (e) {
        console.error('[rules] Error al asignar rol:', e);
        await interaction.reply({ content: '❌ No pude asignar el rol. Verifica los permisos del bot.', flags: [MessageFlags.Ephemeral] });
    }
    return true;
};
