const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags
} = require('discord.js');
const db = require('../../database/db');

function parseDate(str) {
    // Formatos: DD/MM/YYYY HH:MM o DD/MM/YYYY
    const full  = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
    const short = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    if (full) {
        const [, d, mo, y, h, mi] = full;
        const date = new Date(y, mo - 1, d, h, mi);
        return isNaN(date.getTime()) ? null : date.getTime();
    }
    if (short) {
        const [, d, mo, y] = short;
        const date = new Date(y, mo - 1, d, 0, 0);
        return isNaN(date.getTime()) ? null : date.getTime();
    }
    return null;
}

function buildEventEmbed(event, guild) {
    const attendees    = JSON.parse(event.attendees || '[]');
    const max          = event.max_attendees || 0;
    const spotsText    = max > 0 ? `${attendees.length}/${max}` : `${attendees.length}`;
    const statusColors = { upcoming: '#5865F2', ongoing: '#57F287', finished: '#95A5A6', cancelled: '#ED4245' };
    const statusLabels = { upcoming: '📅 Próximo', ongoing: '🔴 En curso', finished: '✅ Finalizado', cancelled: '❌ Cancelado' };

    const embed = new EmbedBuilder()
        .setTitle(`📅 ${event.title}`)
        .setColor(statusColors[event.status] || '#5865F2')
        .addFields(
            { name: '📝 Descripción', value: event.description || '*Sin descripción*' },
            { name: '🕐 Inicio',      value: `<t:${Math.floor(event.starts_at / 1000)}:F>`, inline: true },
            { name: '🕐 Fin',         value: event.ends_at ? `<t:${Math.floor(event.ends_at / 1000)}:F>` : '`Sin definir`', inline: true },
            { name: '📍 Lugar',       value: event.location || '`Sin especificar`', inline: true },
            { name: '👥 Asistentes',  value: spotsText, inline: true },
            { name: '📊 Estado',      value: statusLabels[event.status] || event.status, inline: true },
            { name: '👤 Organizador', value: `<@${event.author_id}>`, inline: true }
        )
        .setFooter({ text: `ID: ${event.id} · ${guild?.name || 'Servidor'}` })
        .setTimestamp();

    if (attendees.length > 0) {
        const list = attendees.slice(0, 10).map(id => `<@${id}>`).join(' ');
        embed.addFields({ name: `🙋 Confirmados (${attendees.length})`, value: list + (attendees.length > 10 ? ` y ${attendees.length - 10} más...` : '') });
    }

    return embed;
}

function buildEventButtons(eventId, status, userId, authorId) {
    const isFinished  = ['finished', 'cancelled'].includes(status);
    const isAttending = false; // se evalúa al momento de mostrar

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`event_join_${eventId}`)
            .setLabel('Asistir')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
            .setDisabled(isFinished),
        new ButtonBuilder()
            .setCustomId(`event_leave_${eventId}`)
            .setLabel('Cancelar asistencia')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
            .setDisabled(isFinished),
        new ButtonBuilder()
            .setCustomId(`event_attendees_${eventId}`)
            .setLabel('Ver asistentes')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👥')
    );

    const modRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`event_start_${eventId}`)
            .setLabel('Iniciar')
            .setStyle(ButtonStyle.Success)
            .setEmoji('▶️')
            .setDisabled(status !== 'upcoming'),
        new ButtonBuilder()
            .setCustomId(`event_finish_${eventId}`)
            .setLabel('Finalizar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏹️')
            .setDisabled(status !== 'ongoing'),
        new ButtonBuilder()
            .setCustomId(`event_cancel_${eventId}`)
            .setLabel('Cancelar Evento')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🚫')
            .setDisabled(isFinished)
    );

    return [row, modRow];
}

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('event')
        .setDescription('📅 Sistema de eventos del servidor.')
        .addSubcommand(sub => sub
            .setName('create')
            .setDescription('Crea un nuevo evento.')
            .addStringOption(opt => opt.setName('titulo').setDescription('Título del evento').setRequired(true).setMaxLength(100))
            .addStringOption(opt => opt.setName('inicio').setDescription('Fecha/hora de inicio. Formato: DD/MM/YYYY HH:MM').setRequired(true))
            .addStringOption(opt => opt.setName('descripcion').setDescription('Descripción del evento').setMaxLength(500))
            .addStringOption(opt => opt.setName('fin').setDescription('Fecha/hora de fin. Formato: DD/MM/YYYY HH:MM'))
            .addStringOption(opt => opt.setName('lugar').setDescription('Lugar o canal de voz del evento'))
            .addIntegerOption(opt => opt.setName('max_asistentes').setDescription('Máximo de asistentes (0 = sin límite)').setMinValue(0).setMaxValue(500))
            .addChannelOption(opt => opt.setName('canal').setDescription('Canal donde publicar (default: actual)'))
        )
        .addSubcommand(sub => sub
            .setName('edit')
            .setDescription('Edita un evento existente. [Autor/Admin]')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID del evento').setRequired(true))
            .addStringOption(opt => opt.setName('titulo').setDescription('Nuevo título'))
            .addStringOption(opt => opt.setName('descripcion').setDescription('Nueva descripción'))
            .addStringOption(opt => opt.setName('lugar').setDescription('Nuevo lugar'))
            .addStringOption(opt => opt.setName('inicio').setDescription('Nueva fecha de inicio. Formato: DD/MM/YYYY HH:MM'))
            .addStringOption(opt => opt.setName('fin').setDescription('Nueva fecha de fin. Formato: DD/MM/YYYY HH:MM'))
            .addIntegerOption(opt => opt.setName('max_asistentes').setDescription('Nuevo máximo de asistentes'))
        )
        .addSubcommand(sub => sub
            .setName('info')
            .setDescription('Ver detalles de un evento.')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID del evento').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('Ver eventos del servidor.')
            .addStringOption(opt => opt
                .setName('filtro')
                .setDescription('Filtrar por estado')
                .addChoices(
                    { name: '📅 Próximos',    value: 'upcoming'  },
                    { name: '🔴 En curso',    value: 'ongoing'   },
                    { name: '✅ Finalizados', value: 'finished'  },
                    { name: '📋 Todos',       value: 'all'       }
                )
            )
        )
        .addSubcommand(sub => sub
            .setName('cancel')
            .setDescription('Cancela un evento. [Autor/Admin]')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID del evento').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('delete')
            .setDescription('Elimina un evento permanentemente. [Admin]')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID del evento').setRequired(true))
        ),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const userId  = interaction.user.id;

        // ── CREATE ────────────────────────────────────────────────────────
        if (sub === 'create') {
            const titulo       = interaction.options.getString('titulo');
            const inicioStr    = interaction.options.getString('inicio');
            const descripcion  = interaction.options.getString('descripcion') || null;
            const finStr       = interaction.options.getString('fin') || null;
            const lugar        = interaction.options.getString('lugar') || null;
            const maxAsist     = interaction.options.getInteger('max_asistentes') ?? 0;
            const canal        = interaction.options.getChannel('canal') || interaction.channel;

            const startsAt = parseDate(inicioStr);
            if (!startsAt) return interaction.reply({ content: '❌ Formato de fecha inválido. Usa: `DD/MM/YYYY HH:MM`', flags: [MessageFlags.Ephemeral] });
            if (startsAt < Date.now()) return interaction.reply({ content: '❌ La fecha de inicio debe ser en el futuro.', flags: [MessageFlags.Ephemeral] });

            const endsAt = finStr ? parseDate(finStr) : null;
            if (finStr && !endsAt) return interaction.reply({ content: '❌ Formato de fecha de fin inválido. Usa: `DD/MM/YYYY HH:MM`', flags: [MessageFlags.Ephemeral] });
            if (endsAt && endsAt <= startsAt) return interaction.reply({ content: '❌ La fecha de fin debe ser posterior al inicio.', flags: [MessageFlags.Ephemeral] });

            const info = db.prepare(`
                INSERT INTO server_events (guild_id, author_id, channel_id, title, description, location, starts_at, ends_at, max_attendees, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(guildId, userId, canal.id, titulo, descripcion, lugar, startsAt, endsAt, maxAsist, Date.now());

            const eventId = info.lastInsertRowid;
            const event   = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);

            const msg = await canal.send({
                embeds:     [buildEventEmbed(event, interaction.guild)],
                components: buildEventButtons(eventId, event.status, userId, userId)
            });

            db.prepare('UPDATE server_events SET message_id = ? WHERE id = ?').run(msg.id, eventId);

            // Auto-marcar como "en curso" y "finalizado"
            const msToStart = startsAt - Date.now();
            setTimeout(async () => {
                const ev = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);
                if (ev?.status !== 'upcoming') return;
                db.prepare("UPDATE server_events SET status = 'ongoing' WHERE id = ?").run(eventId);
                const updated = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);
                await msg.edit({ embeds: [buildEventEmbed(updated, interaction.guild)], components: buildEventButtons(eventId, 'ongoing', userId, userId) }).catch(() => null);
            }, msToStart);

            if (endsAt) {
                const msToEnd = endsAt - Date.now();
                setTimeout(async () => {
                    const ev = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);
                    if (ev?.status === 'cancelled') return;
                    db.prepare("UPDATE server_events SET status = 'finished' WHERE id = ?").run(eventId);
                    const updated = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);
                    await msg.edit({ embeds: [buildEventEmbed(updated, interaction.guild)], components: buildEventButtons(eventId, 'finished', userId, userId) }).catch(() => null);

                    // Log en canal de eventos si existe
                    const settings = db.prepare('SELECT events_log_channel FROM guild_settings WHERE guild_id = ?').get(guildId);
                    if (settings?.events_log_channel) {
                        const logCh = interaction.guild.channels.cache.get(settings.events_log_channel);
                        if (logCh) await logCh.send({
                            embeds: [new EmbedBuilder()
                                .setColor('#95A5A6')
                                .setDescription(`✅ El evento **${titulo}** (#${eventId}) ha finalizado.`)
                                .setTimestamp()
                            ]
                        }).catch(() => null);
                    }
                }, msToEnd);
            }

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#57F287')
                    .setDescription(`✅ Evento **#${eventId}** creado en ${canal}\n🕐 Inicia <t:${Math.floor(startsAt / 1000)}:R>`)
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ── EDIT ──────────────────────────────────────────────────────────
        if (sub === 'edit') {
            const id    = interaction.options.getInteger('id');
            const event = db.prepare('SELECT * FROM server_events WHERE id = ? AND guild_id = ?').get(id, guildId);

            if (!event) return interaction.reply({ content: `❌ Evento **#${id}** no encontrado.`, flags: [MessageFlags.Ephemeral] });
            if (event.author_id !== userId && !interaction.member.permissions.has(PermissionFlagsBits.ManageEvents)) {
                return interaction.reply({ content: '❌ Solo el organizador o un admin puede editar este evento.', flags: [MessageFlags.Ephemeral] });
            }
            if (['finished', 'cancelled'].includes(event.status)) {
                return interaction.reply({ content: '❌ No puedes editar un evento finalizado o cancelado.', flags: [MessageFlags.Ephemeral] });
            }

            const titulo      = interaction.options.getString('titulo')       || event.title;
            const descripcion = interaction.options.getString('descripcion')  ?? event.description;
            const lugar       = interaction.options.getString('lugar')        ?? event.location;
            const maxAsist    = interaction.options.getInteger('max_asistentes') ?? event.max_attendees;
            const inicioStr   = interaction.options.getString('inicio');
            const finStr      = interaction.options.getString('fin');

            const startsAt = inicioStr ? parseDate(inicioStr) : event.starts_at;
            const endsAt   = finStr    ? parseDate(finStr)    : event.ends_at;

            if (inicioStr && !startsAt) return interaction.reply({ content: '❌ Formato de fecha de inicio inválido.', flags: [MessageFlags.Ephemeral] });
            if (finStr && !endsAt)      return interaction.reply({ content: '❌ Formato de fecha de fin inválido.', flags: [MessageFlags.Ephemeral] });

            db.prepare(`
                UPDATE server_events
                SET title = ?, description = ?, location = ?, starts_at = ?, ends_at = ?, max_attendees = ?
                WHERE id = ?
            `).run(titulo, descripcion, lugar, startsAt, endsAt, maxAsist, id);

            const updated = db.prepare('SELECT * FROM server_events WHERE id = ?').get(id);
            const ch      = interaction.guild.channels.cache.get(event.channel_id);
            if (ch && event.message_id) {
                const msg = await ch.messages.fetch(event.message_id).catch(() => null);
                if (msg) await msg.edit({ embeds: [buildEventEmbed(updated, interaction.guild)], components: buildEventButtons(id, updated.status, userId, event.author_id) }).catch(() => null);
            }

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Evento **#${id}** actualizado correctamente.`)],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ── INFO ──────────────────────────────────────────────────────────
        if (sub === 'info') {
            const id    = interaction.options.getInteger('id');
            const event = db.prepare('SELECT * FROM server_events WHERE id = ? AND guild_id = ?').get(id, guildId);
            if (!event) return interaction.reply({ content: `❌ Evento **#${id}** no encontrado.`, flags: [MessageFlags.Ephemeral] });

            return interaction.reply({
                embeds: [buildEventEmbed(event, interaction.guild)]
            });
        }

        // ── LIST ──────────────────────────────────────────────────────────
        if (sub === 'list') {
            const filtro = interaction.options.getString('filtro') || 'upcoming';

            const query = filtro === 'all'
                ? db.prepare('SELECT * FROM server_events WHERE guild_id = ? ORDER BY starts_at ASC LIMIT 10').all(guildId)
                : db.prepare('SELECT * FROM server_events WHERE guild_id = ? AND status = ? ORDER BY starts_at ASC LIMIT 10').all(guildId, filtro);

            if (!query.length) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('❌ No se encontraron eventos con ese filtro.')],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const statusEmoji = { upcoming: '📅', ongoing: '🔴', finished: '✅', cancelled: '❌' };
            const lines = query.map(e => {
                const att = JSON.parse(e.attendees || '[]').length;
                return `${statusEmoji[e.status]} **#${e.id}** — ${e.title}\n> <t:${Math.floor(e.starts_at / 1000)}:F> · 👥 ${att} asistente(s)`;
            });

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('📅 Eventos del Servidor')
                    .setColor('#5865F2')
                    .setDescription(lines.join('\n\n'))
                    .setFooter({ text: `${query.length} evento(s) encontrado(s)` })
                ]
            });
        }

        // ── CANCEL ────────────────────────────────────────────────────────
        if (sub === 'cancel') {
            const id    = interaction.options.getInteger('id');
            const event = db.prepare('SELECT * FROM server_events WHERE id = ? AND guild_id = ?').get(id, guildId);

            if (!event) return interaction.reply({ content: `❌ Evento **#${id}** no encontrado.`, flags: [MessageFlags.Ephemeral] });
            if (event.author_id !== userId && !interaction.member.permissions.has(PermissionFlagsBits.ManageEvents)) {
                return interaction.reply({ content: '❌ Solo el organizador o un admin puede cancelar este evento.', flags: [MessageFlags.Ephemeral] });
            }
            if (['finished', 'cancelled'].includes(event.status)) {
                return interaction.reply({ content: '❌ Este evento ya está finalizado o cancelado.', flags: [MessageFlags.Ephemeral] });
            }

            db.prepare("UPDATE server_events SET status = 'cancelled' WHERE id = ?").run(id);
            const updated = db.prepare('SELECT * FROM server_events WHERE id = ?').get(id);

            const ch = interaction.guild.channels.cache.get(event.channel_id);
            if (ch && event.message_id) {
                const msg = await ch.messages.fetch(event.message_id).catch(() => null);
                if (msg) await msg.edit({ embeds: [buildEventEmbed(updated, interaction.guild)], components: buildEventButtons(id, 'cancelled', userId, event.author_id) }).catch(() => null);
            }

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Evento **#${id}** cancelado.`)],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ── DELETE ────────────────────────────────────────────────────────
        if (sub === 'delete') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageEvents)) {
                return interaction.reply({ content: '❌ Necesitas el permiso **Gestionar Eventos**.', flags: [MessageFlags.Ephemeral] });
            }

            const id    = interaction.options.getInteger('id');
            const event = db.prepare('SELECT * FROM server_events WHERE id = ? AND guild_id = ?').get(id, guildId);
            if (!event) return interaction.reply({ content: `❌ Evento **#${id}** no encontrado.`, flags: [MessageFlags.Ephemeral] });

            const ch = interaction.guild.channels.cache.get(event.channel_id);
            if (ch && event.message_id) {
                const msg = await ch.messages.fetch(event.message_id).catch(() => null);
                if (msg) await msg.delete().catch(() => null);
            }

            db.prepare('DELETE FROM server_events WHERE id = ?').run(id);
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`🗑️ Evento **#${id}** eliminado permanentemente.`)],
                flags: [MessageFlags.Ephemeral]
            });
        }
    }
};

module.exports.buildEventEmbed   = buildEventEmbed;
module.exports.buildEventButtons = buildEventButtons;