const { Events, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        // Manejar reacciones parciales
        if (reaction.partial) {
            try { await reaction.fetch(); } catch { return; }
        }
        if (reaction.message.partial) {
            try { await reaction.message.fetch(); } catch { return; }
        }

        const guildId = reaction.message.guild?.id;
        if (!guildId || user.bot) return;

        db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
        const cfg = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);

        if (!cfg.starboard_enabled || !cfg.starboard_channel) return;

        const starEmoji = cfg.starboard_emoji || '⭐';
        if (reaction.emoji.name !== starEmoji && reaction.emoji.toString() !== starEmoji) return;

        const msg      = reaction.message;
        const authorId = msg.author?.id;

        // Self-star check
        if (!cfg.starboard_self_star && user.id === authorId) {
            await reaction.users.remove(user.id).catch(() => null);
            return;
        }

        // No contar mensajes del canal starboard
        if (msg.channel.id === cfg.starboard_channel) return;

        const count = reaction.count;
        if (count < (cfg.starboard_threshold || 3)) return;

        const existing = db.prepare('SELECT * FROM starboard WHERE guild_id = ? AND original_msg_id = ?').get(guildId, msg.id);
        const starCh   = reaction.message.guild.channels.cache.get(cfg.starboard_channel);
        if (!starCh) return;

        // Construir embed del mensaje estrellado
        const buildEmbed = () => {
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setAuthor({
                    name: msg.author?.username || 'Desconocido',
                    iconURL: msg.author?.displayAvatarURL({ dynamic: true })
                })
                .setDescription(msg.content || null)
                .addFields(
                    { name: '📍 Canal', value: `<#${msg.channel.id}>`, inline: true },
                    { name: '🔗 Ir',    value: `[Ver mensaje](${msg.url})`, inline: true },
                )
                .setTimestamp(msg.createdAt);

            if (msg.attachments.first()) embed.setImage(msg.attachments.first().url);
            if (msg.embeds.length && msg.embeds[0].image) embed.setImage(msg.embeds[0].image.url);

            return embed;
        };

        const header = `${starEmoji} **${count}** | <#${msg.channel.id}>`;

        if (existing?.star_msg_id) {
            // Actualizar mensaje existente
            try {
                const starMsg = await starCh.messages.fetch(existing.star_msg_id);
                await starMsg.edit({ content: header, embeds: [buildEmbed()] });
            } catch {}
            db.prepare('UPDATE starboard SET stars = ? WHERE guild_id = ? AND original_msg_id = ?').run(count, guildId, msg.id);
        } else {
            // Crear nuevo mensaje en starboard
            const starMsg = await starCh.send({ content: header, embeds: [buildEmbed()] }).catch(() => null);
            if (!starMsg) return;

            db.prepare(`
                INSERT OR IGNORE INTO starboard (guild_id, original_msg_id, star_msg_id, channel_id, author_id, content, stars, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(guildId, msg.id, starMsg.id, msg.channel.id, authorId, msg.content?.slice(0, 500), count, Date.now());
        }
    }
};