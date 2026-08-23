const { EmbedBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const db = require('../database/db');

module.exports = async function (interaction) {
    if (!interaction.isButton()) return false;
    const { customId } = interaction;

    if (customId.startsWith('report_resolve_') ||
        customId.startsWith('report_mute_') ||
        customId.startsWith('report_ban_') ||
        customId.startsWith('report_dismiss_')) {

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            await interaction.reply({ content: '❌ Solo el staff puede gestionar reportes.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        const parts = customId.split('_');
        const action = parts[1]; // resolve, mute, ban, dismiss
        const reportId = parseInt(parts[2]);

        const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
        if (!report || report.status !== 'pending') {
            await interaction.reply({ content: '❌ Este reporte ya fue gestionado.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        const statusMap = {
            resolve: { status: 'resolved', label: '✅ Resuelto', color: '#57F287' },
            mute: { status: 'muted', label: '🔇 Muteado', color: '#FEE75C' },
            ban: { status: 'banned', label: '🔨 Baneado', color: '#ED4245' },
            dismiss: { status: 'dismissed', label: '❌ Descartado', color: '#95A5A6' }
        };

        const { status, label, color } = statusMap[action];
        db.prepare('UPDATE reports SET status = ?, handled_by = ? WHERE id = ?').run(status, interaction.user.id, reportId);

        // Ejecutar acción si aplica
        if (action === 'mute' || action === 'ban') {
            const targetMember = await interaction.guild.members.fetch(report.reported_id).catch(() => null);
            if (targetMember) {
                if (action === 'mute') {
                    await targetMember.timeout(10 * 60 * 1000, `Reporte #${reportId} gestionado por ${interaction.user.tag}`).catch(() => null);
                }
                if (action === 'ban') {
                    await targetMember.ban({ reason: `Reporte #${reportId} gestionado por ${interaction.user.tag}` }).catch(() => null);
                }
            }
        }

        // Actualizar embed
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor(color)
            .spliceFields(5, 1, {
                name: '📊 Estado',
                value: `${label} por ${interaction.user}`,
                inline: true
            });

        await interaction.update({ embeds: [updatedEmbed], components: [] });
        return true;
    }

    return false;
};
