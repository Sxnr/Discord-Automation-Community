const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const db = require('../../database/db');

function xpForLevel(level) {
    return 5 * (level ** 2) + 50 * level + 100;
}

function progressBar(current, total, length = 14) {
    const filled = Math.round((current / total) * length);
    const empty  = length - filled;
    return `${'█'.repeat(Math.max(0, filled))}${'░'.repeat(Math.max(0, empty))}`;
}

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('🏆 Muestra tu perfil de nivel y XP en el servidor.')
        .addUserOption(opt => opt.setName('usuario').setDescription('👤 Usuario a consultar (opcional)')),

    async execute(interaction) {
        await interaction.deferReply();
        const target  = interaction.options.getUser('usuario') || interaction.user;
        const guildId = interaction.guild.id;

        // Obtener datos del usuario
        let userData = db.prepare('SELECT * FROM levels WHERE guild_id = ? AND user_id = ?').get(guildId, target.id);

        // Si no tiene datos, crear entrada vacía
        if (!userData) {
            db.prepare('INSERT OR IGNORE INTO levels (guild_id, user_id, xp, level, messages) VALUES (?, ?, 0, 0, 0)').run(guildId, target.id);
            userData = { xp: 0, level: 0, messages: 0 };
        }

        // Calcular ranking global del servidor
        const rank = db.prepare(`
            SELECT COUNT(*) + 1 as rank FROM levels
            WHERE guild_id = ? AND (level > ? OR (level = ? AND xp > ?))
        `).get(guildId, userData.level, userData.level, userData.xp);

        // Calcular datos de progreso
        const xpNeeded  = xpForLevel(userData.level);
        const xpCurrent = userData.xp;
        const progress  = progressBar(xpCurrent, xpNeeded);
        const percent   = Math.floor((xpCurrent / xpNeeded) * 100);

        // XP total acumulado (suma de todos los niveles anteriores)
        let totalXp = userData.xp;
        for (let i = 0; i < userData.level; i++) totalXp += xpForLevel(i);

        const member = await interaction.guild.members.fetch(target.id).catch(() => null);

        const rankEmbed = new EmbedBuilder()
            .setTitle(`🏆 Perfil de ${target.username}`)
            .setColor(member?.displayHexColor || '#F1C40F')
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .setDescription(
                `> ${progress} \`${percent}%\`\n` +
                `> **${xpCurrent}** / **${xpNeeded}** XP para el nivel **${userData.level + 1}**`
            )
            .addFields(
                { name: '🏅 Nivel',          value: `\`${userData.level}\``,             inline: true },
                { name: '⭐ XP Actual',      value: `\`${xpCurrent} / ${xpNeeded}\``,    inline: true },
                { name: '💎 XP Total',       value: `\`${totalXp.toLocaleString()}\``,   inline: true },
                { name: '🥇 Ranking',        value: `\`#${rank.rank}\` en el servidor`,  inline: true },
                { name: '💬 Mensajes',       value: `\`${userData.messages?.toLocaleString() || 0}\``, inline: true },
                { name: '📅 En servidor',    value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : '`Desconocido`', inline: true }
            )
            .setFooter({ text: `${interaction.guild.name} • Sistema de Niveles`, iconURL: interaction.guild.iconURL() })
            .setTimestamp();

        return interaction.editReply({ embeds: [rankEmbed] });
    }
};