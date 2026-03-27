const {
    SlashCommandBuilder, EmbedBuilder, MessageFlags
} = require('discord.js');
const db = require('../../database/db');

// ── Parser de tiempo ───────────────────────────────────────────────────────
function parseTime(str) {
    const regex = /(\d+)\s*(s|seg|m|min|h|hr|d|dia|días?)/gi;
    let total = 0;
    let match;

    while ((match = regex.exec(str)) !== null) {
        const val  = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        if (['s', 'seg'].includes(unit))              total += val * 1000;
        else if (['m', 'min'].includes(unit))         total += val * 60000;
        else if (['h', 'hr'].includes(unit))          total += val * 3600000;
        else if (['d', 'dia', 'días', 'dia'].includes(unit)) total += val * 86400000;
    }

    return total;
}

function formatMs(ms) {
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return [d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ');
}

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('reminder')
        .setDescription('⏰ Sistema de recordatorios personales.')
        .addSubcommand(sub => sub
            .setName('set')
            .setDescription('Crea un nuevo recordatorio.')
            .addStringOption(opt => opt
                .setName('tiempo')
                .setDescription('Cuándo recordarte. Ej: 10m, 2h, 1d, 30s')
                .setRequired(true)
            )
            .addStringOption(opt => opt
                .setName('mensaje')
                .setDescription('¿Qué debo recordarte?')
                .setRequired(true)
                .setMaxLength(500)
            )
            .addChannelOption(opt => opt
                .setName('canal')
                .setDescription('Canal donde enviar el recordatorio (default: aquí)')
            )
        )
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('Ver tus recordatorios pendientes.')
        )
        .addSubcommand(sub => sub
            .setName('cancel')
            .setDescription('Cancela un recordatorio pendiente.')
            .addIntegerOption(opt => opt
                .setName('id')
                .setDescription('ID del recordatorio')
                .setRequired(true)
            )
        )
        .addSubcommand(sub => sub
            .setName('clear')
            .setDescription('Cancela todos tus recordatorios pendientes.')
        ),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const userId  = interaction.user.id;

        // ── SET ───────────────────────────────────────────────────────────
        if (sub === 'set') {
            const tiempoStr = interaction.options.getString('tiempo');
            const mensaje   = interaction.options.getString('mensaje');
            const canal     = interaction.options.getChannel('canal') || interaction.channel;
            const ms        = parseTime(tiempoStr);

            if (ms < 10000) {
                return interaction.reply({
                    content: '❌ El tiempo mínimo es **10 segundos**. Usa formatos como: `30s`, `10m`, `2h`, `1d`.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            if (ms > 30 * 24 * 3600000) {
                return interaction.reply({
                    content: '❌ El tiempo máximo es **30 días**.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Límite por usuario
            const settings  = db.prepare('SELECT reminder_max FROM guild_settings WHERE guild_id = ?').get(guildId);
            const maxRemind = settings?.reminder_max ?? 10;
            const count     = db.prepare('SELECT COUNT(*) as c FROM reminders WHERE guild_id = ? AND user_id = ? AND sent = 0').get(guildId, userId).c;

            if (count >= maxRemind) {
                return interaction.reply({
                    content: `❌ Ya tienes **${count}/${maxRemind}** recordatorios activos. Cancela alguno con \`/reminder cancel\`.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const remindAt  = Date.now() + ms;
            const timestamp = Date.now();

            const info = db.prepare(`
                INSERT INTO reminders (guild_id, user_id, channel_id, message, remind_at, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(guildId, userId, canal.id, mensaje, remindAt, timestamp);

            const reminderId = info.lastInsertRowid;

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('⏰ Recordatorio Creado')
                    .setColor('#57F287')
                    .addFields(
                        { name: '📝 Mensaje',  value: mensaje, inline: false },
                        { name: '⏱️ En',       value: `**${formatMs(ms)}**`, inline: true },
                        { name: '🕐 Cuándo',   value: `<t:${Math.floor(remindAt / 1000)}:F>`, inline: true },
                        { name: '📌 Canal',    value: `${canal}`, inline: true }
                    )
                    .setFooter({ text: `ID: ${reminderId} · Usa /reminder cancel ${reminderId} para cancelar` })
                ],
                flags: [MessageFlags.Ephemeral]
            });

            // Programar el recordatorio en memoria
            scheduleReminder(reminderId, ms, interaction.client);
        }

        // ── LIST ──────────────────────────────────────────────────────────
        if (sub === 'list') {
            const reminders = db.prepare(`
                SELECT * FROM reminders
                WHERE guild_id = ? AND user_id = ? AND sent = 0
                ORDER BY remind_at ASC
            `).all(guildId, userId);

            if (!reminders.length) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('❌ No tienes recordatorios pendientes.')],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const lines = reminders.map(r =>
                `**#${r.id}** · <t:${Math.floor(r.remind_at / 1000)}:R>\n> ${r.message.slice(0, 80)}${r.message.length > 80 ? '...' : ''} · ${interaction.guild.channels.cache.get(r.channel_id) || '#desconocido'}`
            );

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('⏰ Tus Recordatorios Pendientes')
                    .setColor('#FEE75C')
                    .setDescription(lines.join('\n\n'))
                    .setFooter({ text: `${reminders.length} recordatorio(s) activo(s)` })
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ── CANCEL ────────────────────────────────────────────────────────
        if (sub === 'cancel') {
            const id       = interaction.options.getInteger('id');
            const reminder = db.prepare('SELECT * FROM reminders WHERE id = ? AND guild_id = ? AND user_id = ? AND sent = 0').get(id, guildId, userId);

            if (!reminder) {
                return interaction.reply({
                    content: `❌ Recordatorio **#${id}** no encontrado o ya fue enviado.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            db.prepare('DELETE FROM reminders WHERE id = ?').run(id);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#57F287')
                    .setDescription(`✅ Recordatorio **#${id}** cancelado.\n> ~~${reminder.message.slice(0, 100)}~~`)
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ── CLEAR ─────────────────────────────────────────────────────────
        if (sub === 'clear') {
            const count = db.prepare('SELECT COUNT(*) as c FROM reminders WHERE guild_id = ? AND user_id = ? AND sent = 0').get(guildId, userId).c;

            if (!count) {
                return interaction.reply({
                    content: '❌ No tienes recordatorios pendientes.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            db.prepare('DELETE FROM reminders WHERE guild_id = ? AND user_id = ? AND sent = 0').run(guildId, userId);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#57F287')
                    .setDescription(`🧹 Se cancelaron **${count}** recordatorio(s).`)
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }
    }
};

// ── Scheduler en memoria ───────────────────────────────────────────────────
function scheduleReminder(id, ms, client) {
    setTimeout(async () => {
        const reminder = db.prepare('SELECT * FROM reminders WHERE id = ? AND sent = 0').get(id);
        if (!reminder) return;

        db.prepare('UPDATE reminders SET sent = 1 WHERE id = ?').run(id);

        const ch = client.channels.cache.get(reminder.channel_id);
        if (!ch) return;

        await ch.send({
            content: `<@${reminder.user_id}>`,
            embeds: [new EmbedBuilder()
                .setTitle('⏰ ¡Recordatorio!')
                .setDescription(`> ${reminder.message}`)
                .setColor('#FEE75C')
                .addFields(
                    { name: '🕐 Creado', value: `<t:${Math.floor(reminder.timestamp / 1000)}:R>`, inline: true }
                )
                .setFooter({ text: `ID: ${reminder.id}` })
                .setTimestamp()
            ]
        }).catch(() => null);

    }, ms);
}

module.exports.scheduleReminder = scheduleReminder;