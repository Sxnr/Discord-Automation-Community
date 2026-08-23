const { MessageFlags } = require('discord.js');
const db = require('../database/db');

module.exports = async function (interaction) {
    if (!interaction.isButton()) return false;
    const { customId } = interaction;

    if (customId.startsWith('rr_')) {
        const parts = customId.split('_');
        const msgId = parts[1];
        const roleId = parts[2];
        const guildId = interaction.guild.id;

        const panel = db.prepare('SELECT * FROM reaction_role_panels WHERE guild_id = ? AND message_id = ?').get(guildId, msgId);
        if (!panel) { await interaction.reply({ content: '❌ Este panel ya no existe.', flags: [MessageFlags.Ephemeral] }); return true; }

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) return true;

        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) { await interaction.reply({ content: '❌ El rol ya no existe.', flags: [MessageFlags.Ephemeral] }); return true; }

        const hasRole = member.roles.cache.has(roleId);

        if (panel.mode === 'unique') {
            // Quitar todos los roles del panel antes de asignar el nuevo
            const allRoles = db.prepare('SELECT role_id FROM reaction_roles WHERE guild_id = ? AND message_id = ?').all(guildId, msgId);
            for (const r of allRoles) {
                if (member.roles.cache.has(r.role_id)) {
                    await member.roles.remove(r.role_id).catch(() => null);
                }
            }
            if (!hasRole) {
                await member.roles.add(roleId).catch(() => null);
                await interaction.reply({ content: `✅ Se te asignó el rol **${role.name}**.`, flags: [MessageFlags.Ephemeral] });
                return true;
            }
            await interaction.reply({ content: `✅ Rol **${role.name}** removido.`, flags: [MessageFlags.Ephemeral] });
            return true;
        }

        if (panel.mode === 'add') {
            if (hasRole) { await interaction.reply({ content: `ℹ️ Ya tienes el rol **${role.name}**.`, flags: [MessageFlags.Ephemeral] }); return true; }
            await member.roles.add(roleId).catch(() => null);
            await interaction.reply({ content: `✅ Se te asignó el rol **${role.name}**.`, flags: [MessageFlags.Ephemeral] });
            return true;
        }

        // toggle (default)
        if (hasRole) {
            await member.roles.remove(roleId).catch(() => null);
            await interaction.reply({ content: `✅ Rol **${role.name}** removido.`, flags: [MessageFlags.Ephemeral] });
            return true;
        } else {
            await member.roles.add(roleId).catch(() => null);
            await interaction.reply({ content: `✅ Se te asignó el rol **${role.name}**.`, flags: [MessageFlags.Ephemeral] });
            return true;
        }
    }

    return false;
};
