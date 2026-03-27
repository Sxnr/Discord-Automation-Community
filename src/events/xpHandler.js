const { Events, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

const cooldowns = new Map();

function xpForLevel(level) {
    return 5 * (level ** 2) + 50 * level + 100;
}

function progressBar(current, total, length = 14) {
    const pct    = Math.min(current / total, 1);
    const filled = Math.round(pct * length);
    const empty  = length - filled;
    return `${'█'.repeat(Math.max(0, filled))}${'░'.repeat(Math.max(0, empty))}`;
}

// Reemplaza variables del mensaje personalizado
function parseMessage(template, user, level, guild) {
    return template
        .replace(/{user}/g,     `<@${user.id}>`)
        .replace(/{username}/g, user.username)
        .replace(/{level}/g,    String(level))
        .replace(/{guild}/g,    guild.name);
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (!message.guild || message.author.bot) return;

        const guildId = message.guild.id;
        const userId  = message.author.id;

        const config = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
        if (!config || config.xp_enabled === 0) return;

        const ignoredChannels = JSON.parse(config.xp_ignored_channels || '[]');
        if (ignoredChannels.includes(message.channel.id)) return;

        const cooldownKey = `${guildId}_${userId}`;
        const cooldownMs  = (config.xp_cooldown || 60) * 1000;
        if (Date.now() - (cooldowns.get(cooldownKey) || 0) < cooldownMs) return;
        cooldowns.set(cooldownKey, Date.now());

        const xpMin    = config.xp_min || 15;
        const xpMax    = config.xp_max || 25;
        const multi    = config.xp_multiplier || 1.0;
        const xpGained = Math.floor((Math.random() * (xpMax - xpMin + 1) + xpMin) * multi);

        db.prepare(`
            INSERT INTO levels (guild_id, user_id, xp, level, messages, last_xp)
            VALUES (?, ?, ?, 0, 1, ?)
            ON CONFLICT(guild_id, user_id) DO UPDATE SET
                xp       = xp + ?,
                messages = messages + 1,
                last_xp  = ?
        `).run(guildId, userId, xpGained, Date.now(), xpGained, Date.now());

        const userData = db.prepare('SELECT * FROM levels WHERE guild_id = ? AND user_id = ?').get(guildId, userId);

        let currentLevel = userData.level;
        let currentXp    = userData.xp;
        let leveledUp    = false;

        while (currentXp >= xpForLevel(currentLevel)) {
            currentXp    -= xpForLevel(currentLevel);
            currentLevel += 1;
            leveledUp     = true;
        }

        if (!leveledUp) return;

        db.prepare('UPDATE levels SET level = ?, xp = ? WHERE guild_id = ? AND user_id = ?').run(currentLevel, currentXp, guildId, userId);

        // Rol de nivel
        const levelRoles = JSON.parse(config.xp_level_roles || '{}');
        const roleId     = levelRoles[String(currentLevel)];
        if (roleId) {
            const member = message.guild.members.cache.get(userId);
            const role   = message.guild.roles.cache.get(roleId);
            if (member && role) await member.roles.add(role).catch(() => null);
        }

        // Mensaje personalizado
        const msgTemplate = config.xp_levelup_msg || '¡Felicitaciones {user}! 🎊 Has alcanzado el nivel **{level}**';
        const customMsg   = parseMessage(msgTemplate, message.author, currentLevel, message.guild);

        const xpNeeded = xpForLevel(currentLevel);
        const progress = progressBar(currentXp, xpNeeded);
        const percent  = Math.floor((currentXp / xpNeeded) * 100);

        // Calcular XP total
        let totalXp = currentXp;
        for (let i = 0; i < currentLevel; i++) totalXp += xpForLevel(i);

        const levelEmbed = new EmbedBuilder()
            .setTitle('🎉 ¡Nuevo Nivel Alcanzado!')
            .setColor('#F1C40F')
            .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
            .setDescription(
                `${customMsg}\n\n` +
                `\`\`\`\n` +
                `  Nivel ${currentLevel - 1}  ${progress}  Nivel ${currentLevel}\n` +
                `  ${' '.repeat(8)}${percent}% completado\n` +
                `\`\`\``
            )
            .addFields(
                { name: '🏅 Nivel Actual',  value: `\`${currentLevel}\``,              inline: true },
                { name: '⭐ XP Actual',     value: `\`${currentXp} / ${xpNeeded}\``,   inline: true },
                { name: '💎 XP Total',      value: `\`${totalXp.toLocaleString()}\``,  inline: true },
                ...(roleId ? [{ name: '🎭 Rol Desbloqueado', value: `<@&${roleId}>`, inline: true }] : [])
            )
            .setFooter({ text: `${message.guild.name} • Sistema de Niveles`, iconURL: message.guild.iconURL() })
            .setTimestamp();

        // Imagen personalizada si está configurada
        if (config.xp_levelup_img) levelEmbed.setImage(config.xp_levelup_img);

        const notifChannel = config.xp_channel
            ? message.guild.channels.cache.get(config.xp_channel)
            : message.channel;

        if (notifChannel) await notifChannel.send({ embeds: [levelEmbed] }).catch(() => null);
    }
};