const { Events, ActivityType } = require('discord.js');
const { checkGiveaways, updateParticipantCounts } = require('../utils/giveawayManager.js');
const { initPlayer } = require('../music/player');


module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const totalGuilds = client.guilds.cache.size;

        // --- MÚSICA ---
        await initPlayer(client);
        console.log('[Music] ✅ Player listo');

        console.log(`\n=================================================`);
        console.log(`🚀 SISTEMA GLOBAL ONLINE`);
        console.log(`=================================================`);
        console.log(`🤖 Identidad: ${client.user.tag}`);
        console.log(`🛡️ Servidores: ${totalGuilds.toLocaleString()}`);
        console.log(`👥 Usuarios Totales: ${totalUsers.toLocaleString()}`);
        console.log(`📡 Latencia API: ${client.ws.ping}ms`);
        console.log(`🗄️ Base de Datos: Sincronizada (SQLite3)`);
        console.log(`=================================================\n`);


        // --- GESTOR DE SORTEOS ---
        checkGiveaways(client);
        setInterval(() => checkGiveaways(client), 10000);
        setInterval(() => updateParticipantCounts(client), 60000);


        // --- STATUS ROTATIVO CON DATOS EN VIVO ---
        const getActivities = () => {
            const guilds = client.guilds.cache.size;
            const users  = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
            const cmds   = client.commands.size;

            return [
                { name: `${guilds} servidor${guilds !== 1 ? 'es' : ''} 🛡️`,    type: ActivityType.Watching  },
                { name: `/help para asistencia 📂`,                              type: ActivityType.Listening },
                { name: `${users} usuario${users !== 1 ? 's' : ''} activos ✨`, type: ActivityType.Watching  },
                { name: `${cmds} comandos disponibles 🚀`,                       type: ActivityType.Listening },
                { name: `Soporte Técnico Profesional 🎫`,                        type: ActivityType.Playing   },
            ];
        };

        let i = 0;
        const rotateStatus = () => {
            const activities = getActivities();
            client.user.setPresence({
                activities: [activities[i % activities.length]],
                status: 'online',
            });
            i++;
        };

        rotateStatus();
        setInterval(rotateStatus, 15000);
    },
};