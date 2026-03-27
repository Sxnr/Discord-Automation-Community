const { Events } = require('discord.js');
const db = require('../database/db');
const { sendBirthdayAnnouncement } = require('../commands/utility/birthday');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log('[🎂] Birthday checker iniciado.');

        // Revisar cada minuto
        setInterval(async () => {
            const now   = new Date();
            const day   = now.getDate();
            const month = now.getMonth() + 1;
            const hour  = now.getHours();
            const min   = now.getMinutes();

            if (min !== 0) return; // Solo ejecutar al inicio de cada hora

            // Obtener todos los guilds con cumpleaños configurados
            const configs = db.prepare(`
                SELECT guild_id, birthday_channel, birthday_role, birthday_message, birthday_hour
                FROM guild_settings
                WHERE birthday_channel IS NOT NULL
            `).all();

            for (const config of configs) {
                const configHour = config.birthday_hour ?? 8;
                if (hour !== configHour) continue;

                // Buscar cumpleaños de hoy no notificados
                const birthdays = db.prepare(`
                    SELECT * FROM birthdays
                    WHERE guild_id = ? AND day = ? AND month = ? AND notified = 0
                `).all(config.guild_id, day, month);

                const guild = client.guilds.cache.get(config.guild_id);
                if (!guild) continue;

                for (const bday of birthdays) {
                    const user = await client.users.fetch(bday.user_id).catch(() => null);
                    if (!user) continue;

                    await sendBirthdayAnnouncement(guild, user, config);

                    // Marcar como notificado
                    db.prepare('UPDATE birthdays SET notified = 1 WHERE id = ?').run(bday.id);
                }
            }

            // Resetear notificados a medianoche del día siguiente
            if (hour === 0 && min === 0) {
                db.prepare('UPDATE birthdays SET notified = 0 WHERE notified = 1').run();
            }

        }, 60000); // cada 60 segundos
    }
};