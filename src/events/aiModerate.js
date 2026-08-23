const { Events, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../database/db');
const { analyzeText } = require('../utils/aiModeration');

// Cooldown por usuario para no saturar el LLM (4s)
const cooldowns = new Map();
const COOLDOWN_MS = 4000;

function sendLog(guild, logChannelId, embed) {
    if (!logChannelId) return;
    const ch = guild.channels.cache.get(logChannelId);
    if (ch) ch.send({ embeds: [embed] }).catch(() => null);
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (!message.guild || message.author.bot) return;
        if (!message.content || message.content.startsWith('/')) return;

        const guildId = message.guild.id;
        const cfg = db.prepare('SELECT * FROM ai_mod_settings WHERE guild_id = ?').get(guildId);
        if (!cfg || !cfg.enabled) return;

        const member = message.member;
        if (member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

        const ignoreRoles = JSON.parse(cfg.ignore_roles || '[]');
        if (ignoreRoles.some(r => member?.roles.cache.has(r))) return;

        // Cooldown
        const key = `${guildId}_${message.author.id}`;
        const now = Date.now();
        if (cooldowns.has(key) && now - cooldowns.get(key) < COOLDOWN_MS) return;
        cooldowns.set(key, now);

        let result;
        try {
            result = await analyzeText(message.content);
        } catch {
            return;
        }

        const threshold = cfg.threshold ?? 0.7;
        if (!result.toxic || result.score < threshold) return;

        const action = cfg.action || 'log';

        // Eliminar el mensaje salvo que solo sea 'log'
        if (action !== 'log' && message.deletable) {
            await message.delete().catch(() => null);
        }

        // Sanciones adicionales
        if (action === 'warn') {
            db.prepare(`
                INSERT INTO warns (guild_id, user_id, moderator_id, reason, timestamp)
                VALUES (?, ?, ?, ?, ?)
            `).run(guildId, message.author.id, message.client.user.id, `IA: ${result.reason}`, Date.now());

            db.prepare(`
                INSERT INTO mod_logs (guild_id, user_id, moderator_id, action, reason, timestamp, active)
                VALUES (?, ?, ?, 'AI Auto-Warn', ?, ?, 1)
            `).run(guildId, message.author.id, message.client.user.id, `IA: ${result.reason}`, Date.now());
        }

        if (action === 'timeout' && member) {
            await member.timeout(10 * 60 * 1000, `IA: ${result.reason}`).catch(() => null);
        }

        sendLog(message.guild, cfg.log_channel, new EmbedBuilder()
            .setTitle('🧠 Contenido Tóxico Detectado por IA')
            .setColor('#E74C3C')
            .addFields(
                { name: '👤 Usuario', value: `${message.author.tag} (${message.author.id})`, inline: true },
                { name: '📌 Canal',   value: `${message.channel}`,                           inline: true },
                { name: '🛡️ Acción',  value: `\`${action}\``,                                inline: true },
                { name: '📊 Score',    value: `\`${result.score}\``,                          inline: true },
                { name: '🏷️ Categorías', value: result.categories.length ? result.categories.map(c => `\`${c}\``).join(', ') : '`ninguna`', inline: true },
                { name: '🤖 Motor',    value: `\`${result.method}\``,                         inline: true },
                { name: '📝 Razón',    value: result.reason,                                  inline: false },
                { name: '💬 Mensaje',  value: message.content.slice(0, 1000) || '`(sin texto)`', inline: false },
            )
            .setTimestamp()
        );
    }
};
