const { PermissionsBitField, MessageFlags } = require('discord.js');
const db = require('../database/db');

module.exports = async function (interaction) {
    if (!interaction.isButton()) return false;
    const { customId } = interaction;

    if (customId.startsWith('event_join_') ||
        customId.startsWith('event_leave_') ||
        customId.startsWith('event_attendees_') ||
        customId.startsWith('event_start_') ||
        customId.startsWith('event_finish_') ||
        customId.startsWith('event_cancel_')) {

        const parts = customId.split('_');
        const action = parts[1];
        const eventId = parseInt(parts[2]);
        const userId = interaction.user.id;

        const event = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);
        if (!event) { await interaction.reply({ content: '❌ Evento no encontrado.', flags: [MessageFlags.Ephemeral] }); return true; }

        const { buildEventEmbed, buildEventButtons } = require('../commands/utility/event');
        const attendees = JSON.parse(event.attendees || '[]');

        // ── Asistir ──
        if (action === 'join') {
            if (['finished', 'cancelled'].includes(event.status)) { await interaction.reply({ content: '❌ Este evento ya no acepta asistentes.', flags: [MessageFlags.Ephemeral] }); return true; }
            if (attendees.includes(userId)) { await interaction.reply({ content: '⚠️ Ya estás inscrito en este evento.', flags: [MessageFlags.Ephemeral] }); return true; }
            if (event.max_attendees > 0 && attendees.length >= event.max_attendees) { await interaction.reply({ content: '❌ Este evento ya está lleno.', flags: [MessageFlags.Ephemeral] }); return true; }

            attendees.push(userId);
            db.prepare('UPDATE server_events SET attendees = ? WHERE id = ?').run(JSON.stringify(attendees), eventId);
            const updated = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);
            await interaction.update({ embeds: [buildEventEmbed(updated, interaction.guild)], components: buildEventButtons(eventId, updated.status, userId, event.author_id) });
            await interaction.followUp({ content: '✅ ¡Te has inscrito en el evento!', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        // ── Cancelar asistencia ──
        if (action === 'leave') {
            if (!attendees.includes(userId)) { await interaction.reply({ content: '⚠️ No estás inscrito en este evento.', flags: [MessageFlags.Ephemeral] }); return true; }

            const newAttendees = attendees.filter(id => id !== userId);
            db.prepare('UPDATE server_events SET attendees = ? WHERE id = ?').run(JSON.stringify(newAttendees), eventId);
            const updated = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);
            await interaction.update({ embeds: [buildEventEmbed(updated, interaction.guild)], components: buildEventButtons(eventId, updated.status, userId, event.author_id) });
            await interaction.followUp({ content: '✅ Has cancelado tu asistencia.', flags: [MessageFlags.Ephemeral] });
            return true;
        }

        // ── Ver asistentes ──
        if (action === 'attendees') {
            if (!attendees.length) { await interaction.reply({ content: '❌ Nadie se ha inscrito todavía.', flags: [MessageFlags.Ephemeral] }); return true; }

            const list = attendees.map((id, i) => `${i + 1}. <@${id}>`).join('\n');
            await interaction.reply({
                embeds: [new (require('discord.js').EmbedBuilder)()
                    .setTitle(`👥 Asistentes — ${event.title}`)
                    .setColor('#5865F2')
                    .setDescription(list.slice(0, 2000))
                    .setFooter({ text: `${attendees.length} inscrito(s)` })
                ],
                flags: [MessageFlags.Ephemeral]
            });
            return true;
        }

        // ── Iniciar ──
        if (action === 'start') {
            if (event.author_id !== userId && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) { await interaction.reply({ content: '❌ Solo el organizador puede iniciar este evento.', flags: [MessageFlags.Ephemeral] }); return true; }
            if (event.status !== 'upcoming') { await interaction.reply({ content: '❌ Este evento no puede iniciarse.', flags: [MessageFlags.Ephemeral] }); return true; }

            db.prepare("UPDATE server_events SET status = 'ongoing' WHERE id = ?").run(eventId);
            const updated = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);
            await interaction.update({ embeds: [buildEventEmbed(updated, interaction.guild)], components: buildEventButtons(eventId, 'ongoing', userId, event.author_id) });
            return true;
        }

        // ── Finalizar ──
        if (action === 'finish') {
            if (event.author_id !== userId && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) { await interaction.reply({ content: '❌ Solo el organizador puede finalizar este evento.', flags: [MessageFlags.Ephemeral] }); return true; }
            if (event.status !== 'ongoing') { await interaction.reply({ content: '❌ Solo se puede finalizar un evento en curso.', flags: [MessageFlags.Ephemeral] }); return true; }

            db.prepare("UPDATE server_events SET status = 'finished' WHERE id = ?").run(eventId);
            const updated = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);
            await interaction.update({ embeds: [buildEventEmbed(updated, interaction.guild)], components: buildEventButtons(eventId, 'finished', userId, event.author_id) });
            return true;
        }

        // ── Cancelar ──
        if (action === 'cancel') {
            if (event.author_id !== userId && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) { await interaction.reply({ content: '❌ Solo el organizador puede cancelar este evento.', flags: [MessageFlags.Ephemeral] }); return true; }
            if (['finished', 'cancelled'].includes(event.status)) { await interaction.reply({ content: '❌ Este evento ya está finalizado o cancelado.', flags: [MessageFlags.Ephemeral] }); return true; }

            db.prepare("UPDATE server_events SET status = 'cancelled' WHERE id = ?").run(eventId);
            const updated = db.prepare('SELECT * FROM server_events WHERE id = ?').get(eventId);
            await interaction.update({ embeds: [buildEventEmbed(updated, interaction.guild)], components: buildEventButtons(eventId, 'cancelled', userId, event.author_id) });
            return true;
        }
    }

    return false;
};
