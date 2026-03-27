const { Events, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../database/db');

// Mapa en memoria: rastrear mensajes por usuario para anti-spam
// Estructura: Map<guildId_userId, { count, timer }>
const spamTracker = new Map();

// Helper: enviar log al canal de automod
async function sendAutomodLog(guild, logChannelId, embed) {
    if (!logChannelId) return;
    const logChannel = guild.channels.cache.get(logChannelId);
    if (logChannel) await logChannel.send({ embeds: [embed] }).catch(() => null);
}

// Helper: borrar mensaje de forma segura
async function deleteMessage(message, reason) {
    if (message.deletable) await message.delete().catch(() => null);
}

// Helper: notificar al usuario por DM
async function notifyUser(user, guildName, reason) {
    try {
        await user.send({
            embeds: [new EmbedBuilder()
                .setTitle('🤖 Mensaje Eliminado por Automod')
                .setColor('#E74C3C')
                .addFields(
                    { name: '🏠 Servidor', value: guildName, inline: true },
                    { name: '📋 Motivo',   value: reason,    inline: true }
                )
                .setFooter({ text: 'Si crees que fue un error, contacta al staff.' })
                .setTimestamp()
            ]
        });
    } catch { /* DMs cerrados */ }
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignorar bots, DMs y mensajes sin guild
        if (!message.guild || message.author.bot) return;

        const guildId = message.guild.id;
        const config  = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);

        // Si automod está desactivado o no hay config, salir
        if (!config || !config.automod_enabled) return;

        // Ignorar a usuarios con permisos de administrador o gestionar mensajes
        if (message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;

        const content  = message.content || '';
        const logChId  = config.automod_log_channel;

        // =============================================
        // 1. ANTI PALABRAS PROHIBIDAS
        // =============================================
        const badWords = JSON.parse(config.automod_bad_words || '[]');
        if (badWords.length > 0) {
            const contentLower = content.toLowerCase();
            const foundWord    = badWords.find(word => contentLower.includes(word));

            if (foundWord) {
                await deleteMessage(message);
                await notifyUser(message.author, message.guild.name, `Uso de palabra prohibida.`);

                await sendAutomodLog(message.guild, logChId, new EmbedBuilder()
                    .setTitle('🤬 Palabra Prohibida Detectada')
                    .setColor('#E74C3C')
                    .addFields(
                        { name: '👤 Usuario', value: `${message.author.tag} (${message.author.id})`, inline: true },
                        { name: '📌 Canal',   value: `${message.channel}`,                           inline: true },
                        { name: '🔍 Palabra', value: `\`${foundWord}\``,                             inline: true }
                    )
                    .setTimestamp()
                );
                return;
            }
        }

        // =============================================
        // 2. ANTI INVITACIONES DE DISCORD
        // =============================================
        if (config.automod_anti_invites) {
            const inviteRegex = /(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/[a-zA-Z0-9]+/i;
            if (inviteRegex.test(content)) {
                await deleteMessage(message);
                await notifyUser(message.author, message.guild.name, 'No se permiten invitaciones de Discord.');

                await sendAutomodLog(message.guild, logChId, new EmbedBuilder()
                    .setTitle('📩 Invitación Bloqueada')
                    .setColor('#E67E22')
                    .addFields(
                        { name: '👤 Usuario', value: `${message.author.tag} (${message.author.id})`, inline: true },
                        { name: '📌 Canal',   value: `${message.channel}`,                           inline: true }
                    )
                    .setTimestamp()
                );
                return;
            }
        }

        // =============================================
        // 3. ANTI LINKS EXTERNOS
        // =============================================
        if (config.automod_anti_links) {
            const linkRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/i;
            if (linkRegex.test(content)) {
                await deleteMessage(message);
                await notifyUser(message.author, message.guild.name, 'No se permiten links externos en este servidor.');

                await sendAutomodLog(message.guild, logChId, new EmbedBuilder()
                    .setTitle('🔗 Link Externo Bloqueado')
                    .setColor('#E67E22')
                    .addFields(
                        { name: '👤 Usuario', value: `${message.author.tag} (${message.author.id})`, inline: true },
                        { name: '📌 Canal',   value: `${message.channel}`,                           inline: true }
                    )
                    .setTimestamp()
                );
                return;
            }
        }

        // =============================================
        // 4. ANTI SPAM
        // =============================================
        if (config.automod_anti_spam) {
            const spamLimit    = config.automod_spam_limit    || 5;
            const spamInterval = config.automod_spam_interval || 5000;
            const trackerKey   = `${guildId}_${message.author.id}`;
            const now          = Date.now();

            if (!spamTracker.has(trackerKey)) {
                // Primera entrada: guardar timestamps de mensajes
                spamTracker.set(trackerKey, { messages: [now] });
            } else {
                const tracker = spamTracker.get(trackerKey);

                // Filtrar solo los mensajes dentro del intervalo
                tracker.messages = tracker.messages.filter(ts => now - ts < spamInterval);
                tracker.messages.push(now);

                if (tracker.messages.length >= spamLimit) {
                    // Limpiar tracker y borrar mensajes recientes del canal
                    spamTracker.delete(trackerKey);

                    // Borrar los últimos mensajes del usuario en el canal
                    try {
                        const recentMessages = await message.channel.messages.fetch({ limit: 20 });
                        const userMessages   = recentMessages
                            .filter(m => m.author.id === message.author.id)
                            .first(spamLimit);

                        for (const msg of userMessages) {
                            await msg.delete().catch(() => null);
                        }
                    } catch { /* Sin permisos */ }

                    // Timeout temporal por spam (60 segundos)
                    await message.member.timeout(60000, 'Automod: Spam detectado').catch(() => null);
                    await notifyUser(message.author, message.guild.name, `Spam detectado — silenciado por 60 segundos.`);

                    await sendAutomodLog(message.guild, logChId, new EmbedBuilder()
                        .setTitle('🚫 Spam Detectado')
                        .setColor('#C0392B')
                        .addFields(
                            { name: '👤 Usuario',    value: `${message.author.tag} (${message.author.id})`, inline: true },
                            { name: '📌 Canal',      value: `${message.channel}`,                           inline: true },
                            { name: '💬 Mensajes',   value: `\`${spamLimit}\` en \`${spamInterval / 1000}s\``, inline: true },
                            { name: '⏱️ Sanción',    value: '`Timeout 60 segundos`',                        inline: true }
                        )
                        .setTimestamp()
                    );
                    return;
                }

                spamTracker.set(trackerKey, tracker);
            }
        }
    }
};