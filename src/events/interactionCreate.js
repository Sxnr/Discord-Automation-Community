const { Events, MessageFlags } = require('discord.js');
const db = require('../database/db');

// ── Manejadores de componentes (botones, menús, modales) ──
// Cada módulo exporta una función async que devuelve `true` si manejó la interacción.
const componentHandlers = [
    require('../components/tickets'),
    require('../components/giveaways'),
    require('../components/warnModHistory'),
    require('../components/leaderboard'),
    require('../components/suggestions'),
    require('../components/reports'),
    require('../components/polls'),
    require('../components/events'),
    require('../components/games'),
    require('../components/profilePet'),
    require('../components/reactionRoles'),
    require('../components/verify'),
    require('../components/helpSelect'),
    require('../components/meme'),
    require('../components/rules'),
    require('../components/musicControls'),
];

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {

        // ════════════════════════════════════════
        // 1. COMANDOS SLASH
        // ════════════════════════════════════════
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                db.prepare('INSERT INTO command_stats (guild_id, command, user_id, used_at) VALUES (?, ?, ?, ?)')
                    .run(interaction.guildId, interaction.commandName, interaction.user.id, Date.now());
            } catch { /* no crítico */ }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error('❌ Error en comando:', error?.code || '', error?.message || error);
                // Si la interacción ya fue respondida (ej. ejecución duplicada), no reintentar.
                if (interaction.replied || interaction.deferred) return;
                try {
                    await interaction.reply({ content: '❌ Error ejecutando comando.', flags: [MessageFlags.Ephemeral] });
                } catch (e) {
                    // Interacción ya gestionada por otra instancia/proceso: ignorar silenciosamente.
                    console.error('   (no se pudo responder el error:', e?.code, ')');
                }
            }
            return;
        }

        // ════════════════════════════════════════
        // 2. COMPONENTES (botones, menús, modales)
        // ════════════════════════════════════════
        try {
            for (const handler of componentHandlers) {
                if (await handler(interaction)) return;
            }
        } catch (error) {
            console.error('❌ Error en interacción:', error);
            const errorFeedback = { content: '❌ Error técnico. Contacta al staff.', flags: [MessageFlags.Ephemeral] };
            try {
                if (interaction.replied || interaction.deferred) await interaction.editReply(errorFeedback);
                else await interaction.reply(errorFeedback);
            } catch { /* ignore */ }
        }
    },
};
