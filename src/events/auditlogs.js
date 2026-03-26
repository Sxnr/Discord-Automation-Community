const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const db = require('../database/db');

// Helper: obtiene el canal de logs desde la DB
async function getLogChannel(guild, type = 'audit') {
    const settings = db.prepare('SELECT audit_log_channel, general_log_channel FROM guild_settings WHERE guild_id = ?').get(guild.id);
    const channelId = type === 'audit' ? settings?.audit_log_channel : settings?.general_log_channel;
    if (!channelId) return null;
    return guild.channels.cache.get(channelId) || null;
}

// Helper: crea embed base de log
function logEmbed(color, title, description = null) {
    const embed = new EmbedBuilder().setColor(color).setTitle(title).setTimestamp();
    if (description) embed.setDescription(description);
    return embed;
}

module.exports = [

    // =========================================================
    // 📝 MENSAJES
    // =========================================================

    {
        name: Events.MessageDelete,
        async execute(message) {
            if (!message.guild || message.author?.bot) return;
            const logChannel = await getLogChannel(message.guild, 'audit');
            if (!logChannel) return;

            const embed = logEmbed('#E74C3C', '🗑️ Mensaje Eliminado')
                .addFields(
                    { name: '👤 Autor', value: `${message.author?.tag || 'Desconocido'} (${message.author?.id || 'N/A'})`, inline: true },
                    { name: '📌 Canal', value: `${message.channel}`, inline: true },
                    { name: '📄 Contenido', value: message.content ? `\`\`\`${message.content.slice(0, 1000)}\`\`\`` : '*Sin texto (imagen o embed)*' }
                )
                .setFooter({ text: `ID del mensaje: ${message.id}` });

            await logChannel.send({ embeds: [embed] });
        }
    },

    {
        name: Events.MessageUpdate,
        async execute(oldMessage, newMessage) {
            if (!newMessage.guild || newMessage.author?.bot) return;
            if (oldMessage.content === newMessage.content) return;
            const logChannel = await getLogChannel(newMessage.guild, 'audit');
            if (!logChannel) return;

            const embed = logEmbed('#F39C12', '✏️ Mensaje Editado')
                .addFields(
                    { name: '👤 Autor', value: `${newMessage.author?.tag} (${newMessage.author?.id})`, inline: true },
                    { name: '📌 Canal', value: `${newMessage.channel}`, inline: true },
                    { name: '🔗 Ver Mensaje', value: `[Click aquí](${newMessage.url})`, inline: true },
                    { name: '📄 Antes', value: oldMessage.content ? `\`\`\`${oldMessage.content.slice(0, 500)}\`\`\`` : '*Vacío*' },
                    { name: '📄 Después', value: newMessage.content ? `\`\`\`${newMessage.content.slice(0, 500)}\`\`\`` : '*Vacío*' }
                )
                .setFooter({ text: `ID del mensaje: ${newMessage.id}` });

            await logChannel.send({ embeds: [embed] });
        }
    },

    {
        name: Events.MessageBulkDelete,
        async execute(messages, channel) {
            if (!channel.guild) return;
            const logChannel = await getLogChannel(channel.guild, 'audit');
            if (!logChannel) return;

            const embed = logEmbed('#C0392B', '🗑️ Eliminación Masiva de Mensajes')
                .addFields(
                    { name: '📌 Canal', value: `${channel}`, inline: true },
                    { name: '🔢 Cantidad', value: `${messages.size} mensajes`, inline: true }
                );

            await logChannel.send({ embeds: [embed] });
        }
    },

    // =========================================================
    // 👥 MIEMBROS
    // =========================================================

    {
        name: Events.GuildMemberAdd,
        async execute(member) {
            const logChannel = await getLogChannel(member.guild, 'general');
            if (!logChannel) return;

            const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
            const isNew = accountAge < 7;

            const embed = logEmbed('#2ECC71', '📥 Nuevo Miembro')
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Usuario', value: `${member.user.tag} (${member.user.id})`, inline: true },
                    { name: '🔢 Miembro N°', value: `${member.guild.memberCount}`, inline: true },
                    { name: '📅 Cuenta Creada', value: `${accountAge} días atrás ${isNew ? '⚠️ Cuenta Nueva' : ''}`, inline: true }
                )
                .setFooter({ text: `ID: ${member.user.id}` });

            await logChannel.send({ embeds: [embed] });
        }
    },

    {
        name: Events.GuildMemberRemove,
        async execute(member) {
            const logChannel = await getLogChannel(member.guild, 'general');
            if (!logChannel) return;

            const roles = member.roles.cache
                .filter(r => r.id !== member.guild.id)
                .map(r => r.toString())
                .join(', ') || '*Sin roles*';

            const embed = logEmbed('#E74C3C', '📤 Miembro Salió / Fue Expulsado')
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Usuario', value: `${member.user.tag} (${member.user.id})`, inline: true },
                    { name: '🎭 Roles que tenía', value: roles.slice(0, 1000) }
                )
                .setFooter({ text: `ID: ${member.user.id}` });

            await logChannel.send({ embeds: [embed] });
        }
    },

    {
        name: Events.GuildMemberUpdate,
        async execute(oldMember, newMember) {
            const logChannel = await getLogChannel(newMember.guild, 'audit');
            if (!logChannel) return;

            // Cambio de apodo
            if (oldMember.nickname !== newMember.nickname) {
                const embed = logEmbed('#9B59B6', '✏️ Apodo Cambiado')
                    .addFields(
                        { name: '👤 Usuario', value: `${newMember.user.tag}`, inline: true },
                        { name: '📛 Antes', value: oldMember.nickname || '*Sin apodo*', inline: true },
                        { name: '📛 Después', value: newMember.nickname || '*Sin apodo*', inline: true }
                    );
                await logChannel.send({ embeds: [embed] });
            }

            // Roles añadidos
            const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
            if (addedRoles.size > 0) {
                const embed = logEmbed('#27AE60', '🎭 Rol Añadido')
                    .addFields(
                        { name: '👤 Usuario', value: `${newMember.user.tag}`, inline: true },
                        { name: '➕ Roles Añadidos', value: addedRoles.map(r => r.toString()).join(', '), inline: true }
                    );
                await logChannel.send({ embeds: [embed] });
            }

            // Roles removidos
            const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
            if (removedRoles.size > 0) {
                const embed = logEmbed('#E67E22', '🎭 Rol Removido')
                    .addFields(
                        { name: '👤 Usuario', value: `${newMember.user.tag}`, inline: true },
                        { name: '➖ Roles Removidos', value: removedRoles.map(r => r.toString()).join(', '), inline: true }
                    );
                await logChannel.send({ embeds: [embed] });
            }

            // Timeout (silenciado temporalmente)
            if (!oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil) {
                const embed = logEmbed('#E74C3C', '🔇 Miembro Silenciado (Timeout)')
                    .addFields(
                        { name: '👤 Usuario', value: `${newMember.user.tag} (${newMember.user.id})`, inline: true },
                        { name: '⏱️ Hasta', value: `<t:${Math.floor(newMember.communicationDisabledUntil.getTime() / 1000)}:F>`, inline: true }
                    );
                await logChannel.send({ embeds: [embed] });
            }
        }
    },

    // =========================================================
    // 🔨 BANS
    // =========================================================

    {
        name: Events.GuildBanAdd,
        async execute(ban) {
            const logChannel = await getLogChannel(ban.guild, 'audit');
            if (!logChannel) return;

            // Intentar obtener quién hizo el ban desde el AuditLog
            let executor = 'Desconocido';
            let reason = ban.reason || '*Sin razón especificada*';
            try {
                await new Promise(res => setTimeout(res, 1000)); // Espera que el AuditLog se actualice
                const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
                const entry = logs.entries.first();
                if (entry && entry.target.id === ban.user.id) {
                    executor = entry.executor?.tag || 'Desconocido';
                    reason = entry.reason || reason;
                }
            } catch { /* Sin permisos para AuditLog */ }

            const embed = logEmbed('#C0392B', '🔨 Usuario Baneado')
                .setThumbnail(ban.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Usuario', value: `${ban.user.tag} (${ban.user.id})`, inline: true },
                    { name: '🛡️ Moderador', value: executor, inline: true },
                    { name: '📋 Razón', value: reason }
                );

            await logChannel.send({ embeds: [embed] });
        }
    },

    {
        name: Events.GuildBanRemove,
        async execute(ban) {
            const logChannel = await getLogChannel(ban.guild, 'audit');
            if (!logChannel) return;

            const embed = logEmbed('#27AE60', '✅ Ban Removido')
                .addFields(
                    { name: '👤 Usuario', value: `${ban.user.tag} (${ban.user.id})`, inline: true }
                );

            await logChannel.send({ embeds: [embed] });
        }
    },

    // =========================================================
    // 📢 CANALES
    // =========================================================

    {
        name: Events.ChannelCreate,
        async execute(channel) {
            if (!channel.guild) return;
            const logChannel = await getLogChannel(channel.guild, 'audit');
            if (!logChannel) return;

            const embed = logEmbed('#2ECC71', '📁 Canal Creado')
                .addFields(
                    { name: '📌 Canal', value: `${channel} (${channel.name})`, inline: true },
                    { name: '📂 Tipo', value: `${channel.type}`, inline: true }
                )
                .setFooter({ text: `ID: ${channel.id}` });

            await logChannel.send({ embeds: [embed] });
        }
    },

    {
        name: Events.ChannelDelete,
        async execute(channel) {
            if (!channel.guild) return;
            const logChannel = await getLogChannel(channel.guild, 'audit');
            if (!logChannel) return;

            const embed = logEmbed('#E74C3C', '🗑️ Canal Eliminado')
                .addFields(
                    { name: '📌 Nombre', value: `#${channel.name}`, inline: true },
                    { name: '📂 Tipo', value: `${channel.type}`, inline: true }
                )
                .setFooter({ text: `ID: ${channel.id}` });

            await logChannel.send({ embeds: [embed] });
        }
    },

    {
        name: Events.ChannelUpdate,
        async execute(oldChannel, newChannel) {
            if (!newChannel.guild) return;
            if (oldChannel.name === newChannel.name && oldChannel.topic === newChannel.topic) return;
            const logChannel = await getLogChannel(newChannel.guild, 'audit');
            if (!logChannel) return;

            const embed = logEmbed('#F39C12', '⚙️ Canal Actualizado')
                .addFields({ name: '📌 Canal', value: `${newChannel}`, inline: true });

            if (oldChannel.name !== newChannel.name)
                embed.addFields(
                    { name: '📛 Nombre Antes', value: oldChannel.name, inline: true },
                    { name: '📛 Nombre Después', value: newChannel.name, inline: true }
                );

            if (oldChannel.topic !== newChannel.topic)
                embed.addFields(
                    { name: '📝 Tema Antes', value: oldChannel.topic || '*Sin tema*' },
                    { name: '📝 Tema Después', value: newChannel.topic || '*Sin tema*' }
                );

            await logChannel.send({ embeds: [embed] });
        }
    },

    // =========================================================
    // 🎭 ROLES
    // =========================================================

    {
        name: Events.GuildRoleCreate,
        async execute(role) {
            const logChannel = await getLogChannel(role.guild, 'audit');
            if (!logChannel) return;

            const embed = logEmbed('#2ECC71', '🎭 Rol Creado')
                .addFields(
                    { name: '🏷️ Nombre', value: role.name, inline: true },
                    { name: '🎨 Color', value: role.hexColor, inline: true }
                )
                .setFooter({ text: `ID: ${role.id}` });

            await logChannel.send({ embeds: [embed] });
        }
    },

    {
        name: Events.GuildRoleDelete,
        async execute(role) {
            const logChannel = await getLogChannel(role.guild, 'audit');
            if (!logChannel) return;

            const embed = logEmbed('#E74C3C', '🗑️ Rol Eliminado')
                .addFields(
                    { name: '🏷️ Nombre', value: role.name, inline: true },
                    { name: '🎨 Color', value: role.hexColor, inline: true }
                )
                .setFooter({ text: `ID: ${role.id}` });

            await logChannel.send({ embeds: [embed] });
        }
    },

    {
        name: Events.GuildRoleUpdate,
        async execute(oldRole, newRole) {
            if (oldRole.name === newRole.name && oldRole.hexColor === newRole.hexColor) return;
            const logChannel = await getLogChannel(newRole.guild, 'audit');
            if (!logChannel) return;

            const embed = logEmbed('#9B59B6', '⚙️ Rol Actualizado')
                .addFields({ name: '🏷️ Rol', value: `${newRole}`, inline: true });

            if (oldRole.name !== newRole.name)
                embed.addFields(
                    { name: '📛 Antes', value: oldRole.name, inline: true },
                    { name: '📛 Después', value: newRole.name, inline: true }
                );

            if (oldRole.hexColor !== newRole.hexColor)
                embed.addFields(
                    { name: '🎨 Color Antes', value: oldRole.hexColor, inline: true },
                    { name: '🎨 Color Después', value: newRole.hexColor, inline: true }
                );

            await logChannel.send({ embeds: [embed] });
        }
    },

    // =========================================================
    // 🔊 VOZ
    // =========================================================

    {
        name: Events.VoiceStateUpdate,
        async execute(oldState, newState) {
            const logChannel = await getLogChannel(newState.guild, 'general');
            if (!logChannel) return;
            const member = newState.member;

            // Entró a un canal de voz
            if (!oldState.channel && newState.channel) {
                const embed = logEmbed('#1ABC9C', '🔊 Entró a Voz')
                    .addFields(
                        { name: '👤 Usuario', value: `${member.user.tag}`, inline: true },
                        { name: '🔊 Canal', value: `${newState.channel.name}`, inline: true }
                    );
                return await logChannel.send({ embeds: [embed] });
            }

            // Salió de un canal de voz
            if (oldState.channel && !newState.channel) {
                const embed = logEmbed('#95A5A6', '🔇 Salió de Voz')
                    .addFields(
                        { name: '👤 Usuario', value: `${member.user.tag}`, inline: true },
                        { name: '🔊 Canal', value: `${oldState.channel.name}`, inline: true }
                    );
                return await logChannel.send({ embeds: [embed] });
            }

            // Se movió de canal
            if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
                const embed = logEmbed('#3498DB', '🔀 Cambió de Canal de Voz')
                    .addFields(
                        { name: '👤 Usuario', value: `${member.user.tag}`, inline: true },
                        { name: '⬅️ Antes', value: oldState.channel.name, inline: true },
                        { name: '➡️ Después', value: newState.channel.name, inline: true }
                    );
                return await logChannel.send({ embeds: [embed] });
            }
        }
    },

    // =========================================================
    // 🛡️ SERVIDOR
    // =========================================================

    {
        name: Events.GuildUpdate,
        async execute(oldGuild, newGuild) {
            const logChannel = await getLogChannel(newGuild, 'audit');
            if (!logChannel) return;

            const embed = logEmbed('#F39C12', '⚙️ Servidor Actualizado');

            if (oldGuild.name !== newGuild.name)
                embed.addFields(
                    { name: '📛 Nombre Antes', value: oldGuild.name, inline: true },
                    { name: '📛 Nombre Después', value: newGuild.name, inline: true }
                );

            if (embed.data.fields?.length > 0)
                await logChannel.send({ embeds: [embed] });
        }
    },

    {
        name: Events.InviteCreate,
        async execute(invite) {
            const logChannel = await getLogChannel(invite.guild, 'audit');
            if (!logChannel) return;

            const embed = logEmbed('#2ECC71', '🔗 Invitación Creada')
                .addFields(
                    { name: '👤 Creador', value: invite.inviter?.tag || 'Desconocido', inline: true },
                    { name: '🔗 Código', value: invite.code, inline: true },
                    { name: '⏱️ Expira', value: invite.maxAge ? `En ${invite.maxAge / 3600}h` : 'Nunca', inline: true },
                    { name: '🔢 Usos Máximos', value: `${invite.maxUses || '∞'}`, inline: true }
                );

            await logChannel.send({ embeds: [embed] });
        }
    },

    {
        name: Events.InviteDelete,
        async execute(invite) {
            const logChannel = await getLogChannel(invite.guild, 'audit');
            if (!logChannel) return;

            const embed = logEmbed('#E74C3C', '🔗 Invitación Eliminada')
                .addFields({ name: '🔗 Código', value: invite.code, inline: true });

            await logChannel.send({ embeds: [embed] });
        }
    }
];