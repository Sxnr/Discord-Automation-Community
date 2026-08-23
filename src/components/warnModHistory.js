const db = require('../database/db');
const { buildWarnPanel } = require('../commands/admin/warn');
const { buildHistoryPanel } = require('../commands/admin/mod');

module.exports = async function (interaction) {
    const { customId } = interaction;

    // ── Warn panel: eliminar warn específico (menú) ──
    if (interaction.isStringSelectMenu() && customId.startsWith('warn_delete_select:')) {
        const [, userId, pageStr] = customId.split(':');
        const warnId = parseInt(interaction.values[0]);
        const guildId = interaction.guild.id;

        const warn = db.prepare('SELECT * FROM warns WHERE id = ? AND guild_id = ?').get(warnId, guildId);
        if (!warn) { await interaction.update({ content: '❌ Esta advertencia ya no existe.', embeds: [], components: [] }); return true; }

        db.prepare('DELETE FROM warns WHERE id = ?').run(warnId);

        const target = await interaction.client.users.fetch(userId).catch(() => null);
        if (!target) { await interaction.update({ content: '✅ Advertencia eliminada.', embeds: [], components: [] }); return true; }

        const warns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
        const totalPages = Math.ceil(warns.length / 5);
        const newPage = Math.min(parseInt(pageStr), Math.max(totalPages - 1, 0));
        const { embed, components } = buildWarnPanel(warns, target, newPage);

        await interaction.update({ content: `✅ Advertencia \`#${warnId}\` eliminada.`, embeds: [embed], components });
        return true;
    }

    // ── Mod history: filtrar por tipo (menú) ──────
    if (interaction.isStringSelectMenu() && customId.startsWith('mod_history_filter:')) {
        const [, userId] = customId.split(':');
        const filter = interaction.values[0];
        const guildId = interaction.guild.id;

        const target = await interaction.client.users.fetch(userId).catch(() => null);
        if (!target) { await interaction.update({ content: '❌ Usuario no encontrado.', embeds: [], components: [] }); return true; }

        const logs = db.prepare('SELECT * FROM mod_logs WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
        const warns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
        const { embed, components } = buildHistoryPanel(logs, warns, target, 0, filter);

        await interaction.update({ content: null, embeds: [embed], components });
        return true;
    }

    // ── Mod history: eliminar entrada específica (menú) ──
    if (interaction.isStringSelectMenu() && customId.startsWith('mod_history_delete:')) {
        const [, userId, pageStr, filter] = customId.split(':');
        const [source, id] = interaction.values[0].split(':');
        const guildId = interaction.guild.id;

        if (source === 'mod') db.prepare('DELETE FROM mod_logs WHERE id = ? AND guild_id = ?').run(parseInt(id), guildId);
        if (source === 'warn') db.prepare('DELETE FROM warns WHERE id = ? AND guild_id = ?').run(parseInt(id), guildId);

        const target = await interaction.client.users.fetch(userId).catch(() => null);
        if (!target) { await interaction.update({ content: '✅ Entrada eliminada.', embeds: [], components: [] }); return true; }

        const logs = db.prepare('SELECT * FROM mod_logs WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
        const warns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
        const totalPages = Math.ceil((logs.length + warns.length) / 4);
        const newPage = Math.min(parseInt(pageStr), Math.max(totalPages - 1, 0));
        const { embed, components } = buildHistoryPanel(logs, warns, target, newPage, filter);

        await interaction.update({ content: `✅ Entrada \`#${id}\` eliminada.`, embeds: [embed], components });
        return true;
    }

    if (!interaction.isButton()) return false;

    // ── WARN PANEL ──
    if (customId.startsWith('warn_page:')) {
        const [, userId, pageStr] = customId.split(':');
        const target = await interaction.client.users.fetch(userId).catch(() => null);
        if (!target) { await interaction.update({ content: '❌ Usuario no encontrado.', embeds: [], components: [] }); return true; }

        const warns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(interaction.guild.id, userId);
        const { embed, components } = buildWarnPanel(warns, target, parseInt(pageStr));
        await interaction.update({ content: null, embeds: [embed], components });
        return true;
    }

    if (customId.startsWith('warn_clear_all:')) {
        const [, userId] = customId.split(':');
        const guildId = interaction.guild.id;
        const count = db.prepare('SELECT COUNT(*) as count FROM warns WHERE guild_id = ? AND user_id = ?').get(guildId, userId).count;

        db.prepare('DELETE FROM warns WHERE guild_id = ? AND user_id = ?').run(guildId, userId);

        const target = await interaction.client.users.fetch(userId).catch(() => null);
        if (!target) { await interaction.update({ content: '🧹 Historial de warns limpiado.', embeds: [], components: [] }); return true; }

        const { embed, components } = buildWarnPanel([], target, 0);
        await interaction.update({ content: `🧹 Se eliminaron **${count}** advertencias de **${target.username}**.`, embeds: [embed], components });
        return true;
    }

    if (customId.startsWith('warn_refresh:')) {
        const [, userId] = customId.split(':');
        const target = await interaction.client.users.fetch(userId).catch(() => null);
        if (!target) { await interaction.update({ content: '❌ Usuario no encontrado.', embeds: [], components: [] }); return true; }

        const warns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(interaction.guild.id, userId);
        const { embed, components } = buildWarnPanel(warns, target, 0);
        await interaction.update({ content: null, embeds: [embed], components });
        return true;
    }

    // ── MOD HISTORY ──
    if (customId.startsWith('mod_history_page:')) {
        const [, userId, pageStr, filter] = customId.split(':');
        const guildId = interaction.guild.id;

        const target = await interaction.client.users.fetch(userId).catch(() => null);
        if (!target) { await interaction.update({ content: '❌ Usuario no encontrado.', embeds: [], components: [] }); return true; }

        const logs = db.prepare('SELECT * FROM mod_logs WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
        const warns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
        const { embed, components } = buildHistoryPanel(logs, warns, target, parseInt(pageStr), filter);
        await interaction.update({ content: null, embeds: [embed], components });
        return true;
    }

    if (customId.startsWith('mod_history_clear:')) {
        const [, userId] = customId.split(':');
        const guildId = interaction.guild.id;

        const logsCount = db.prepare('SELECT COUNT(*) as count FROM mod_logs WHERE guild_id = ? AND user_id = ?').get(guildId, userId).count;
        const warnsCount = db.prepare('SELECT COUNT(*) as count FROM warns WHERE guild_id = ? AND user_id = ?').get(guildId, userId).count;

        db.prepare('DELETE FROM mod_logs WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
        db.prepare('DELETE FROM warns WHERE guild_id = ? AND user_id = ?').run(guildId, userId);

        const target = await interaction.client.users.fetch(userId).catch(() => null);
        if (!target) { await interaction.update({ content: '🧹 Historial limpiado completamente.', embeds: [], components: [] }); return true; }

        const { embed, components } = buildHistoryPanel([], [], target, 0, 'all');
        await interaction.update({ content: `🧹 Se eliminaron **${logsCount + warnsCount}** registros de **${target.username}**.`, embeds: [embed], components });
        return true;
    }

    if (customId.startsWith('mod_history_refresh:')) {
        const [, userId] = customId.split(':');
        const guildId = interaction.guild.id;

        const target = await interaction.client.users.fetch(userId).catch(() => null);
        if (!target) { await interaction.update({ content: '❌ Usuario no encontrado.', embeds: [], components: [] }); return true; }

        const logs = db.prepare('SELECT * FROM mod_logs WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
        const warns = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, userId);
        const { embed, components } = buildHistoryPanel(logs, warns, target, 0, 'all');
        await interaction.update({ content: null, embeds: [embed], components });
        return true;
    }

    return false;
};
