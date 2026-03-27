const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const db = require('../database/db');

async function getLogChannel(guild, type = 'audit') {
    const settings = db.prepare('SELECT audit_log_channel, general_log_channel FROM guild_settings WHERE guild_id = ?').get(guild.id);
    const channelId = type === 'audit' ? settings?.audit_log_channel : settings?.general_log_channel;
    if (!channelId) return null;
    return guild.channels.cache.get(channelId) || null;
}

function logEmbed(color, title, description = null) {
    const embed = new EmbedBuilder().setColor(color).setTitle(title).setTimestamp();
    if (description) embed.setDescription(description);
    return embed;
}

async function fetchExecutor(guild, auditLogEvent, targetId) {
    try {
        await new Promise(res => setTimeout(res, 1000));
        const logs = await guild.fetchAuditLogs({ type: auditLogEvent, limit: 1 });
        const entry = logs.entries.first();
        if (entry && entry.target?.id === targetId) {
            return { executor: entry.executor?.tag || 'Desconocido', reason: entry.reason || null };
        }
    } catch { /* sin permisos */ }
    return { executor: 'Desconocido', reason: null };
}

module.exports = [

    // ══════════════════════════════════════════
    // 📝 MENSAJES
    // ══════════════════════════════════════════

    {
        name: Events.MessageDelete,
        async execute(message) {
            if (!message.guild || message.author?.bot) return;
            const log = await getLogChannel(message.guild, 'audit');
            if (!log) return;

            log.send({ embeds: [logEmbed('#E74C3C', '🗑️ Mensaje Eliminado')
                .setThumbnail(message.author?.displayAvatarURL() ?? null)
                .addFields(
                    { name: '👤 Autor',     value: `${message.author?.tag ?? 'Desconocido'} (<@${message.author?.id}>)`, inline: true },
                    { name: '📌 Canal',     value: `${message.channel}`, inline: true },
                    { name: '🕐 Enviado',   value: `<t:${Math.floor(message.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: '📄 Contenido', value: message.content ? `\`\`\`${message.content.slice(0, 1000)}\`\`\`` : '*Sin texto (adjunto o embed)*' }
                )
                .setFooter({ text: `ID mensaje: ${message.id} | ID canal: ${message.channel.id}` })
            ]});
        }
    },

    {
        name: Events.MessageUpdate,
        async execute(oldMsg, newMsg) {
            if (!newMsg.guild || newMsg.author?.bot) return;
            if (oldMsg.content === newMsg.content) return;
            const log = await getLogChannel(newMsg.guild, 'audit');
            if (!log) return;

            log.send({ embeds: [logEmbed('#F39C12', '✏️ Mensaje Editado')
                .setThumbnail(newMsg.author?.displayAvatarURL() ?? null)
                .addFields(
                    { name: '👤 Autor',     value: `${newMsg.author?.tag} (<@${newMsg.author?.id}>)`, inline: true },
                    { name: '📌 Canal',     value: `${newMsg.channel}`, inline: true },
                    { name: '🔗 Ver',       value: `[Ir al mensaje](${newMsg.url})`, inline: true },
                    { name: '📄 Antes',     value: oldMsg.content ? `\`\`\`${oldMsg.content.slice(0, 500)}\`\`\`` : '*Vacío*' },
                    { name: '📄 Después',   value: newMsg.content ? `\`\`\`${newMsg.content.slice(0, 500)}\`\`\`` : '*Vacío*' }
                )
                .setFooter({ text: `ID: ${newMsg.id}` })
            ]});
        }
    },

    {
        name: Events.MessageBulkDelete,
        async execute(messages, channel) {
            if (!channel.guild) return;
            const log = await getLogChannel(channel.guild, 'audit');
            if (!log) return;

            log.send({ embeds: [logEmbed('#C0392B', '🗑️ Eliminación Masiva')
                .addFields(
                    { name: '📌 Canal',    value: `${channel}`, inline: true },
                    { name: '🔢 Cantidad', value: `**${messages.size}** mensajes`, inline: true }
                )
            ]});
        }
    },

    // ══════════════════════════════════════════
    // 👥 MIEMBROS
    // ══════════════════════════════════════════

    {
        name: Events.GuildMemberAdd,
        async execute(member) {
            const log = await getLogChannel(member.guild, 'general');
            if (!log) return;

            const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
            const isNew   = ageDays < 7;

            log.send({ embeds: [logEmbed(isNew ? '#E67E22' : '#2ECC71', '📥 Nuevo Miembro')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '👤 Usuario',       value: `${member.user.tag}\n<@${member.user.id}>`, inline: true },
                    { name: '🔢 Miembro N°',    value: `**${member.guild.memberCount}**`, inline: true },
                    { name: '📅 Cuenta creada', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>${isNew ? '\n⚠️ **Cuenta nueva**' : ''}`, inline: true }
                )
                .setFooter({ text: `ID: ${member.user.id}` })
            ]});
        }
    },

    {
        name: Events.GuildMemberRemove,
        async execute(member) {
            const log = await getLogChannel(member.guild, 'general');
            if (!log) return;

            const roles = member.roles.cache
                .filter(r => r.id !== member.guild.id)
                .map(r => r.toString())
                .join(' ') || '*Sin roles*';

            log.send({ embeds: [logEmbed('#E74C3C', '📤 Miembro Salió')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '👤 Usuario',    value: `${member.user.tag}\n<@${member.user.id}>`, inline: true },
                    { name: '📅 Se unió',    value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Desconocido', inline: true },
                    { name: '🎭 Roles',      value: roles.slice(0, 1000) }
                )
                .setFooter({ text: `ID: ${member.user.id}` })
            ]});
        }
    },

    {
        name: Events.GuildMemberUpdate,
        async execute(oldMember, newMember) {
            const log = await getLogChannel(newMember.guild, 'audit');
            if (!log) return;

            // Apodo
            if (oldMember.nickname !== newMember.nickname) {
                log.send({ embeds: [logEmbed('#9B59B6', '✏️ Apodo Cambiado')
                    .addFields(
                        { name: '👤 Usuario',  value: `${newMember.user.tag}`, inline: true },
                        { name: '📛 Antes',    value: oldMember.nickname || '*Sin apodo*', inline: true },
                        { name: '📛 Después',  value: newMember.nickname || '*Sin apodo*', inline: true }
                    )
                ]});
            }

            // Roles añadidos
            const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
            if (addedRoles.size > 0) {
                log.send({ embeds: [logEmbed('#27AE60', '🎭 Rol Añadido')
                    .addFields(
                        { name: '👤 Usuario',        value: `${newMember.user.tag}`, inline: true },
                        { name: '➕ Roles añadidos', value: addedRoles.map(r => r.toString()).join(' '), inline: true }
                    )
                ]});
            }

            // Roles removidos
            const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
            if (removedRoles.size > 0) {
                log.send({ embeds: [logEmbed('#E67E22', '🎭 Rol Removido')
                    .addFields(
                        { name: '👤 Usuario',         value: `${newMember.user.tag}`, inline: true },
                        { name: '➖ Roles removidos', value: removedRoles.map(r => r.toString()).join(' '), inline: true }
                    )
                ]});
            }

            // Timeout aplicado
            if (!oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil) {
                log.send({ embeds: [logEmbed('#ED4245', '🔇 Timeout Aplicado')
                    .addFields(
                        { name: '👤 Usuario', value: `${newMember.user.tag} (<@${newMember.user.id}>)`, inline: true },
                        { name: '⏱️ Hasta',   value: `<t:${Math.floor(newMember.communicationDisabledUntil.getTime() / 1000)}:F>`, inline: true }
                    )
                ]});
            }

            // Timeout removido
            if (oldMember.communicationDisabledUntil && !newMember.communicationDisabledUntil) {
                log.send({ embeds: [logEmbed('#57F287', '🔊 Timeout Removido')
                    .addFields(
                        { name: '👤 Usuario', value: `${newMember.user.tag} (<@${newMember.user.id}>)`, inline: true }
                    )
                ]});
            }
        }
    },

    // ══════════════════════════════════════════
    // 🔨 BANS
    // ══════════════════════════════════════════

    {
        name: Events.GuildBanAdd,
        async execute(ban) {
            const log = await getLogChannel(ban.guild, 'audit');
            if (!log) return;

            const { executor, reason } = await fetchExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);

            log.send({ embeds: [logEmbed('#C0392B', '🔨 Usuario Baneado')
                .setThumbnail(ban.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Usuario',    value: `${ban.user.tag}\n<@${ban.user.id}>`, inline: true },
                    { name: '🛡️ Moderador', value: executor, inline: true },
                    { name: '📋 Razón',      value: reason || ban.reason || '*Sin razón especificada*' }
                )
                .setFooter({ text: `ID: ${ban.user.id}` })
            ]});
        }
    },

    {
        name: Events.GuildBanRemove,
        async execute(ban) {
            const log = await getLogChannel(ban.guild, 'audit');
            if (!log) return;

            const { executor } = await fetchExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);

            log.send({ embeds: [logEmbed('#57F287', '✅ Ban Removido')
                .setThumbnail(ban.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Usuario',    value: `${ban.user.tag}\n<@${ban.user.id}>`, inline: true },
                    { name: '🛡️ Moderador', value: executor, inline: true }
                )
                .setFooter({ text: `ID: ${ban.user.id}` })
            ]});
        }
    },

    // ══════════════════════════════════════════
    // 📢 CANALES
    // ══════════════════════════════════════════

    {
        name: Events.ChannelCreate,
        async execute(channel) {
            if (!channel.guild) return;
            const log = await getLogChannel(channel.guild, 'audit');
            if (!log) return;

            const { executor } = await fetchExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
            const typeMap = { 0: 'Texto', 2: 'Voz', 4: 'Categoría', 5: 'Anuncios', 13: 'Escenario', 15: 'Foro' };

            log.send({ embeds: [logEmbed('#2ECC71', '📁 Canal Creado')
                .addFields(
                    { name: '📌 Canal',      value: `${channel} (\`${channel.name}\`)`, inline: true },
                    { name: '📂 Tipo',       value: typeMap[channel.type] ?? `${channel.type}`, inline: true },
                    { name: '🛡️ Creado por', value: executor, inline: true }
                )
                .setFooter({ text: `ID: ${channel.id}` })
            ]});
        }
    },

    {
        name: Events.ChannelDelete,
        async execute(channel) {
            if (!channel.guild) return;
            const log = await getLogChannel(channel.guild, 'audit');
            if (!log) return;

            const { executor } = await fetchExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);

            log.send({ embeds: [logEmbed('#E74C3C', '🗑️ Canal Eliminado')
                .addFields(
                    { name: '📌 Nombre',       value: `#${channel.name}`, inline: true },
                    { name: '🛡️ Eliminado por', value: executor, inline: true }
                )
                .setFooter({ text: `ID: ${channel.id}` })
            ]});
        }
    },

    {
        name: Events.ChannelUpdate,
        async execute(oldCh, newCh) {
            if (!newCh.guild) return;
            if (oldCh.name === newCh.name && oldCh.topic === newCh.topic && oldCh.rateLimitPerUser === newCh.rateLimitPerUser) return;
            const log = await getLogChannel(newCh.guild, 'audit');
            if (!log) return;

            const embed = logEmbed('#F39C12', '⚙️ Canal Actualizado')
                .addFields({ name: '📌 Canal', value: `${newCh}`, inline: true });

            if (oldCh.name !== newCh.name) embed.addFields(
                { name: '📛 Nombre antes',   value: oldCh.name, inline: true },
                { name: '📛 Nombre después', value: newCh.name, inline: true }
            );
            if (oldCh.topic !== newCh.topic) embed.addFields(
                { name: '📝 Tema antes',   value: oldCh.topic || '*Sin tema*' },
                { name: '📝 Tema después', value: newCh.topic || '*Sin tema*' }
            );
            if (oldCh.rateLimitPerUser !== newCh.rateLimitPerUser) embed.addFields(
                { name: '⏱️ Slowmode antes',   value: `${oldCh.rateLimitPerUser}s`, inline: true },
                { name: '⏱️ Slowmode después', value: `${newCh.rateLimitPerUser}s`, inline: true }
            );

            log.send({ embeds: [embed] });
        }
    },

    // ══════════════════════════════════════════
    // 🧵 HILOS
    // ══════════════════════════════════════════

    {
        name: Events.ThreadCreate,
        async execute(thread) {
            if (!thread.guild) return;
            const log = await getLogChannel(thread.guild, 'audit');
            if (!log) return;

            log.send({ embeds: [logEmbed('#1ABC9C', '🧵 Hilo Creado')
                .addFields(
                    { name: '🧵 Hilo',   value: `${thread} (\`${thread.name}\`)`, inline: true },
                    { name: '📌 Canal',  value: thread.parent ? `${thread.parent}` : 'Desconocido', inline: true }
                )
                .setFooter({ text: `ID: ${thread.id}` })
            ]});
        }
    },

    {
        name: Events.ThreadDelete,
        async execute(thread) {
            if (!thread.guild) return;
            const log = await getLogChannel(thread.guild, 'audit');
            if (!log) return;

            log.send({ embeds: [logEmbed('#E74C3C', '🧵 Hilo Eliminado')
                .addFields(
                    { name: '🧵 Nombre', value: `\`${thread.name}\``, inline: true },
                    { name: '📌 Canal',  value: thread.parent ? `${thread.parent}` : 'Desconocido', inline: true }
                )
                .setFooter({ text: `ID: ${thread.id}` })
            ]});
        }
    },

    // ══════════════════════════════════════════
    // 🎭 ROLES
    // ══════════════════════════════════════════

    {
        name: Events.GuildRoleCreate,
        async execute(role) {
            const log = await getLogChannel(role.guild, 'audit');
            if (!log) return;

            const { executor } = await fetchExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);

            log.send({ embeds: [logEmbed('#2ECC71', '🎭 Rol Creado')
                .addFields(
                    { name: '🏷️ Nombre',    value: role.name, inline: true },
                    { name: '🎨 Color',     value: role.hexColor, inline: true },
                    { name: '🛡️ Creado por', value: executor, inline: true }
                )
                .setFooter({ text: `ID: ${role.id}` })
            ]});
        }
    },

    {
        name: Events.GuildRoleDelete,
        async execute(role) {
            const log = await getLogChannel(role.guild, 'audit');
            if (!log) return;

            const { executor } = await fetchExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);

            log.send({ embeds: [logEmbed('#E74C3C', '🗑️ Rol Eliminado')
                .addFields(
                    { name: '🏷️ Nombre',      value: role.name, inline: true },
                    { name: '🎨 Color',       value: role.hexColor, inline: true },
                    { name: '🛡️ Eliminado por', value: executor, inline: true }
                )
                .setFooter({ text: `ID: ${role.id}` })
            ]});
        }
    },

    {
        name: Events.GuildRoleUpdate,
        async execute(oldRole, newRole) {
            if (oldRole.name === newRole.name && oldRole.hexColor === newRole.hexColor && oldRole.permissions.bitfield === newRole.permissions.bitfield) return;
            const log = await getLogChannel(newRole.guild, 'audit');
            if (!log) return;

            const embed = logEmbed('#9B59B6', '⚙️ Rol Actualizado')
                .addFields({ name: '🏷️ Rol', value: `${newRole}`, inline: true });

            if (oldRole.name !== newRole.name) embed.addFields(
                { name: '📛 Antes',   value: oldRole.name, inline: true },
                { name: '📛 Después', value: newRole.name, inline: true }
            );
            if (oldRole.hexColor !== newRole.hexColor) embed.addFields(
                { name: '🎨 Color antes',   value: oldRole.hexColor, inline: true },
                { name: '🎨 Color después', value: newRole.hexColor, inline: true }
            );

            log.send({ embeds: [embed] });
        }
    },

    // ══════════════════════════════════════════
    // 😄 EMOJIS & STICKERS
    // ══════════════════════════════════════════

    {
        name: Events.GuildEmojiCreate,
        async execute(emoji) {
            const log = await getLogChannel(emoji.guild, 'audit');
            if (!log) return;

            log.send({ embeds: [logEmbed('#F1C40F', '😄 Emoji Añadido')
                .setThumbnail(emoji.url)
                .addFields(
                    { name: '🏷️ Nombre', value: `:${emoji.name}:`, inline: true },
                    { name: '🔗 Vista',  value: `<:${emoji.name}:${emoji.id}>`, inline: true }
                )
                .setFooter({ text: `ID: ${emoji.id}` })
            ]});
        }
    },

    {
        name: Events.GuildEmojiDelete,
        async execute(emoji) {
            const log = await getLogChannel(emoji.guild, 'audit');
            if (!log) return;

            log.send({ embeds: [logEmbed('#E74C3C', '🗑️ Emoji Eliminado')
                .addFields({ name: '🏷️ Nombre', value: `:${emoji.name}:`, inline: true })
                .setFooter({ text: `ID: ${emoji.id}` })
            ]});
        }
    },

    {
        name: Events.GuildEmojiUpdate,
        async execute(oldEmoji, newEmoji) {
            if (oldEmoji.name === newEmoji.name) return;
            const log = await getLogChannel(newEmoji.guild, 'audit');
            if (!log) return;

            log.send({ embeds: [logEmbed('#F39C12', '✏️ Emoji Renombrado')
                .addFields(
                    { name: '📛 Antes',   value: `:${oldEmoji.name}:`, inline: true },
                    { name: '📛 Después', value: `:${newEmoji.name}:`, inline: true }
                )
                .setFooter({ text: `ID: ${newEmoji.id}` })
            ]});
        }
    },

    {
        name: Events.GuildStickerCreate,
        async execute(sticker) {
            const log = await getLogChannel(sticker.guild, 'audit');
            if (!log) return;

            log.send({ embeds: [logEmbed('#F1C40F', '🎨 Sticker Añadido')
                .addFields({ name: '🏷️ Nombre', value: sticker.name, inline: true })
                .setFooter({ text: `ID: ${sticker.id}` })
            ]});
        }
    },

    {
        name: Events.GuildStickerDelete,
        async execute(sticker) {
            const log = await getLogChannel(sticker.guild, 'audit');
            if (!log) return;

            log.send({ embeds: [logEmbed('#E74C3C', '🗑️ Sticker Eliminado')
                .addFields({ name: '🏷️ Nombre', value: sticker.name, inline: true })
                .setFooter({ text: `ID: ${sticker.id}` })
            ]});
        }
    },

    // ══════════════════════════════════════════
    // 🔊 VOZ
    // ══════════════════════════════════════════

    {
        name: Events.VoiceStateUpdate,
        async execute(oldState, newState) {
            const log = await getLogChannel(newState.guild, 'general');
            if (!log) return;
            const member = newState.member;
            if (!member) return;

            if (!oldState.channel && newState.channel) {
                return log.send({ embeds: [logEmbed('#1ABC9C', '🔊 Entró a Voz')
                    .addFields(
                        { name: '👤 Usuario', value: `${member.user.tag}`, inline: true },
                        { name: '🔊 Canal',   value: newState.channel.name, inline: true }
                    )
                ]});
            }

            if (oldState.channel && !newState.channel) {
                return log.send({ embeds: [logEmbed('#95A5A6', '🔇 Salió de Voz')
                    .addFields(
                        { name: '👤 Usuario', value: `${member.user.tag}`, inline: true },
                        { name: '🔊 Canal',   value: oldState.channel.name, inline: true }
                    )
                ]});
            }

            if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
                return log.send({ embeds: [logEmbed('#3498DB', '🔀 Cambió de Canal de Voz')
                    .addFields(
                        { name: '👤 Usuario',  value: `${member.user.tag}`, inline: true },
                        { name: '⬅️ Antes',   value: oldState.channel.name, inline: true },
                        { name: '➡️ Después', value: newState.channel.name, inline: true }
                    )
                ]});
            }

            // Mute/deafen por servidor
            if (!oldState.serverMute && newState.serverMute) {
                return log.send({ embeds: [logEmbed('#ED4245', '🔇 Silenciado por Servidor')
                    .addFields({ name: '👤 Usuario', value: `${member.user.tag}`, inline: true })
                ]});
            }
            if (oldState.serverMute && !newState.serverMute) {
                return log.send({ embeds: [logEmbed('#57F287', '🔊 Silencio Removido')
                    .addFields({ name: '👤 Usuario', value: `${member.user.tag}`, inline: true })
                ]});
            }
        }
    },

    // ══════════════════════════════════════════
    // 🛡️ SERVIDOR
    // ══════════════════════════════════════════

    {
        name: Events.GuildUpdate,
        async execute(oldGuild, newGuild) {
            const log = await getLogChannel(newGuild, 'audit');
            if (!log) return;

            const embed = logEmbed('#F39C12', '⚙️ Servidor Actualizado');
            const fields = [];

            if (oldGuild.name !== newGuild.name)
                fields.push({ name: '📛 Nombre antes', value: oldGuild.name, inline: true },
                             { name: '📛 Nombre después', value: newGuild.name, inline: true });

            if (oldGuild.iconURL() !== newGuild.iconURL())
                fields.push({ name: '🖼️ Ícono', value: 'Actualizado', inline: true });

            if (oldGuild.verificationLevel !== newGuild.verificationLevel)
                fields.push({ name: '🔒 Verificación antes', value: `${oldGuild.verificationLevel}`, inline: true },
                             { name: '🔒 Verificación después', value: `${newGuild.verificationLevel}`, inline: true });

            if (oldGuild.premiumTier !== newGuild.premiumTier)
                fields.push({ name: '💎 Boost Tier', value: `Nivel ${oldGuild.premiumTier} → Nivel ${newGuild.premiumTier}`, inline: true });

            if (fields.length === 0) return;
            embed.addFields(fields);
            log.send({ embeds: [embed] });
        }
    },

    {
        name: Events.InviteCreate,
        async execute(invite) {
            const log = await getLogChannel(invite.guild, 'audit');
            if (!log) return;

            log.send({ embeds: [logEmbed('#2ECC71', '🔗 Invitación Creada')
                .addFields(
                    { name: '👤 Creador',       value: invite.inviter?.tag || 'Desconocido', inline: true },
                    { name: '🔗 Código',        value: `\`${invite.code}\``, inline: true },
                    { name: '📌 Canal',         value: invite.channel ? `${invite.channel}` : 'Desconocido', inline: true },
                    { name: '⏱️ Expira',        value: invite.maxAge ? `En ${invite.maxAge / 3600}h` : 'Nunca', inline: true },
                    { name: '🔢 Usos máximos',  value: `${invite.maxUses || '∞'}`, inline: true }
                )
            ]});
        }
    },

    {
        name: Events.InviteDelete,
        async execute(invite) {
            const log = await getLogChannel(invite.guild, 'audit');
            if (!log) return;

            log.send({ embeds: [logEmbed('#E74C3C', '🔗 Invitación Eliminada')
                .addFields(
                    { name: '🔗 Código',  value: `\`${invite.code}\``, inline: true },
                    { name: '📌 Canal',   value: invite.channel ? `${invite.channel}` : 'Desconocido', inline: true }
                )
            ]});
        }
    }
];