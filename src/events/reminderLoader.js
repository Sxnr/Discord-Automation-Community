const { Events } = require('discord.js');
const db = require('../database/db');
const { scheduleReminder } = require('../commands/utility/reminder');

// Al iniciar el bot, reprogramar todos los recordatorios pendientes que
// quedaron en la DB pero cuyo setTimeout se perdió al reiniciar
module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        const pending = db.prepare('SELECT * FROM reminders WHERE sent = 0').all();
        const now     = Date.now();
        let   count   = 0;

        for (const reminder of pending) {
            const msLeft = reminder.remind_at - now;

            if (msLeft <= 0) {
                // Ya venció mientras el bot estaba offline → enviar inmediatamente
                scheduleReminder(reminder.id, 0, client);
            } else {
                scheduleReminder(reminder.id, msLeft, client);
            }
            count++;
        }

        if (count > 0) console.log(`[⏰] ${count} recordatorio(s) reprogramado(s).`);
    }
};