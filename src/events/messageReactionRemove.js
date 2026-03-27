const { Events } = require('discord.js');
const db = require('../database/db');

module.exports = {
    name: Events.MessageReactionRemove,
    async execute(reaction, user) {
        if (reaction.partial) { try { await reaction.fetch(); } catch { return; } }
        if (reaction.message.partial) { try { await reaction.message.fetch(); } catch { return; } }

        const guildId = reaction.message.guild?.id;
        if (!guildId || user.bot) return;

        const cfg = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
        if (!cfg?.starboard_enabled || !cfg.starboard_channel) return;

        const starEmoji = cfg.starboard_emoji || '⭐';
        if (reaction.emoji.name !== starEmoji && reaction.emoji.toString() !== starEmoji) return;

        const msg      = reaction.message;
        const count    = reaction.count;
        const existing = db.prepare('SELECT * FROM starboard WHERE guild_id = ? AND original_msg_id = ?').get(guildId, msg.id);
        if (!existing?.star_msg_id) return;

        const starCh = reaction.message.guild.channels.cache.get(cfg.starboard_channel);
        if (!starCh) return;

        if (count < (cfg.starboard_threshold || 3)) {
            // Eliminar del starboard si baja del mínimo
            try {
                const starMsg = await starCh.messages.fetch(existing.star_msg_id);
                await starMsg.delete();
            } catch {}
            db.prepare('DELETE FROM starboard WHERE guild_id = ? AND original_msg_id = ?').run(guildId, msg.id);
        } else {
            // Actualizar contador
            try {
                const starMsg = await starCh.messages.fetch(existing.star_msg_id);
                await starMsg.edit({ content: `${starEmoji} **${count}** | <#${msg.channel.id}>` });
            } catch {}
            db.prepare('UPDATE starboard SET stars = ? WHERE guild_id = ? AND original_msg_id = ?').run(count, guildId, msg.id);
        }
    }
};