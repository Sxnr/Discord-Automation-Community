const {
    SlashCommandBuilder, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');
const db = require('../../database/db');

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function daysInMonth(month) {
    return new Date(2024, month, 0).getDate(); // 2024 = año bisiesto para cubrir feb 29
}

function nextBirthdayDays(day, month) {
    const now   = new Date();
    const year  = now.getFullYear();
    let next    = new Date(year, month - 1, day);
    if (next <= now) next = new Date(year + 1, month - 1, day);
    return Math.ceil((next - now) / 86400000);
}

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('🎂 Sistema de cumpleaños del servidor.')
        // ── set ──
        .addSubcommand(sub => sub
            .setName('set')
            .setDescription('Registra tu cumpleaños.')
            .addIntegerOption(opt => opt.setName('dia').setDescription('Día de tu cumpleaños').setMinValue(1).setMaxValue(31).setRequired(true))
            .addIntegerOption(opt => opt.setName('mes').setDescription('Mes de tu cumpleaños (1-12)').setMinValue(1).setMaxValue(12).setRequired(true))
        )
        // ── remove ──
        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Elimina tu cumpleaños registrado.')
        )
        // ── check ──
        .addSubcommand(sub => sub
            .setName('check')
            .setDescription('Ver el cumpleaños de un usuario.')
            .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a consultar').setRequired(false))
        )
        // ── list ──
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('Ver los próximos cumpleaños del servidor.')
        )
        // ── config ──
        .addSubcommandGroup(group => group
            .setName('config')
            .setDescription('Configura el sistema de cumpleaños. [Admin]')
            .addSubcommand(sub => sub
                .setName('channel')
                .setDescription('Canal donde se anunciarán los cumpleaños.')
                .addChannelOption(opt => opt.setName('canal').setDescription('Canal de anuncios').setRequired(true))
            )
            .addSubcommand(sub => sub
                .setName('role')
                .setDescription('Rol que se le dará al cumpleañero por 24h.')
                .addRoleOption(opt => opt.setName('rol').setDescription('Rol de cumpleaños').setRequired(true))
            )
            .addSubcommand(sub => sub
                .setName('message')
                .setDescription('Mensaje de felicitación. Usa {user} y {age}.')
                .addStringOption(opt => opt
                    .setName('mensaje')
                    .setDescription('Mensaje personalizado')
                    .setMinLength(5)
                    .setMaxLength(500)
                    .setRequired(true)
                )
            )
            .addSubcommand(sub => sub
                .setName('hour')
                .setDescription('Hora del día en que se anuncian los cumpleaños (0-23).')
                .addIntegerOption(opt => opt
                    .setName('hora')
                    .setDescription('Hora (formato 24h). Ej: 8 = 8:00 AM')
                    .setMinValue(0)
                    .setMaxValue(23)
                    .setRequired(true)
                )
            )
            .addSubcommand(sub => sub
                .setName('test')
                .setDescription('Simula un anuncio de cumpleaños.')
            )
            .addSubcommand(sub => sub
                .setName('status')
                .setDescription('Ver configuración actual de cumpleaños.')
            )
        ),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const group   = interaction.options.getSubcommandGroup(false);
        const guildId = interaction.guild.id;

        // ── CONFIG ────────────────────────────────────────────────────────
        if (group === 'config') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Necesitas el permiso **Gestionar Servidor**.', ephemeral: true });
            }
            db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);

            if (sub === 'channel') {
                const ch = interaction.options.getChannel('canal');
                db.prepare('UPDATE guild_settings SET birthday_channel = ? WHERE guild_id = ?').run(ch.id, guildId);
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Canal de cumpleaños configurado en ${ch}`)],
                    ephemeral: true
                });
            }

            if (sub === 'role') {
                const rol = interaction.options.getRole('rol');
                db.prepare('UPDATE guild_settings SET birthday_role = ? WHERE guild_id = ?').run(rol.id, guildId);
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Rol de cumpleaños configurado: ${rol}\n> Se asignará al cumpleañero por 24 horas.`)],
                    ephemeral: true
                });
            }

            if (sub === 'message') {
                const msg = interaction.options.getString('mensaje');
                db.prepare('UPDATE guild_settings SET birthday_message = ? WHERE guild_id = ?').run(msg, guildId);
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#57F287')
                        .setDescription(`✅ Mensaje configurado:\n> ${msg}`)
                        .setFooter({ text: 'Variables: {user} = mención | {age} = edad (si se registró año)' })
                    ],
                    ephemeral: true
                });
            }

            if (sub === 'hour') {
                const hora = interaction.options.getInteger('hora');
                db.prepare('UPDATE guild_settings SET birthday_hour = ? WHERE guild_id = ?').run(hora, guildId);
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Los cumpleaños se anunciarán a las **${hora}:00** hrs.`)],
                    ephemeral: true
                });
            }

            if (sub === 'test') {
                const config = db.prepare('SELECT birthday_channel, birthday_message, birthday_role FROM guild_settings WHERE guild_id = ?').get(guildId);
                if (!config?.birthday_channel) {
                    return interaction.reply({ content: '❌ Primero configura el canal con `/birthday config channel`.', ephemeral: true });
                }
                const ch = interaction.guild.channels.cache.get(config.birthday_channel);
                if (!ch) return interaction.reply({ content: '❌ Canal no encontrado.', ephemeral: true });

                await sendBirthdayAnnouncement(interaction.guild, interaction.user, config);
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Prueba enviada en ${ch}`)],
                    ephemeral: true
                });
            }

            if (sub === 'status') {
                const c = db.prepare('SELECT birthday_channel, birthday_role, birthday_message, birthday_hour FROM guild_settings WHERE guild_id = ?').get(guildId);
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('🎂 Configuración de Cumpleaños')
                        .setColor('#FEE75C')
                        .addFields(
                            { name: '📢 Canal',    value: c?.birthday_channel ? `<#${c.birthday_channel}>` : '`No configurado`', inline: true },
                            { name: '🎭 Rol',      value: c?.birthday_role    ? `<@&${c.birthday_role}>`   : '`No configurado`', inline: true },
                            { name: '🕐 Hora',     value: `\`${c?.birthday_hour ?? 8}:00 hrs\``,                                 inline: true },
                            { name: '💬 Mensaje',  value: `> ${c?.birthday_message || '🎂 ¡Hoy es el cumpleaños de {user}! ¡Felicidades!'}` }
                        )
                        .setFooter({ text: 'Variables: {user} = mención del usuario' })
                    ],
                    ephemeral: true
                });
            }
        }

        // ── SET ───────────────────────────────────────────────────────────
        if (sub === 'set') {
            const day   = interaction.options.getInteger('dia');
            const month = interaction.options.getInteger('mes');

            if (day > daysInMonth(month)) {
                return interaction.reply({
                    content: `❌ El mes **${MONTHS[month - 1]}** solo tiene **${daysInMonth(month)}** días.`,
                    ephemeral: true
                });
            }

            db.prepare(`
                INSERT INTO birthdays (guild_id, user_id, day, month)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(guild_id, user_id) DO UPDATE SET day = ?, month = ?, notified = 0
            `).run(guildId, interaction.user.id, day, month, day, month);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#FEE75C')
                    .setTitle('🎂 Cumpleaños Registrado')
                    .setDescription(`Tu cumpleaños ha sido guardado: **${day} de ${MONTHS[month - 1]}**\n🗓️ Faltan **${nextBirthdayDays(day, month)} días** para tu próximo cumpleaños.`)
                ],
                ephemeral: true
            });
        }

        // ── REMOVE ────────────────────────────────────────────────────────
        if (sub === 'remove') {
            const existing = db.prepare('SELECT id FROM birthdays WHERE guild_id = ? AND user_id = ?').get(guildId, interaction.user.id);
            if (!existing) {
                return interaction.reply({ content: '❌ No tienes ningún cumpleaños registrado en este servidor.', ephemeral: true });
            }

            db.prepare('DELETE FROM birthdays WHERE guild_id = ? AND user_id = ?').run(guildId, interaction.user.id);
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('🗑️ Tu cumpleaños ha sido eliminado del servidor.')],
                ephemeral: true
            });
        }

        // ── CHECK ─────────────────────────────────────────────────────────
        if (sub === 'check') {
            const target = interaction.options.getUser('usuario') || interaction.user;
            const bday   = db.prepare('SELECT day, month FROM birthdays WHERE guild_id = ? AND user_id = ?').get(guildId, target.id);

            if (!bday) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245').setDescription(`❌ **${target.username}** no tiene cumpleaños registrado en este servidor.`)],
                    ephemeral: true
                });
            }

            const daysLeft = nextBirthdayDays(bday.day, bday.month);
            const isToday  = daysLeft === 365 || daysLeft === 366;

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle(`🎂 Cumpleaños de ${target.username}`)
                    .setColor('#FEE75C')
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                    .setDescription(
                        isToday
                            ? `🎉 ¡**HOY** es el cumpleaños de ${target}!`
                            : `📅 **${bday.day} de ${MONTHS[bday.month - 1]}**\n🗓️ Faltan **${daysLeft} días** para su próximo cumpleaños.`
                    )
                ],
                ephemeral: true
            });
        }

        // ── LIST ──────────────────────────────────────────────────────────
        if (sub === 'list') {
            const birthdays = db.prepare('SELECT user_id, day, month FROM birthdays WHERE guild_id = ? ORDER BY month, day').all(guildId);

            if (!birthdays.length) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('❌ No hay cumpleaños registrados en este servidor.')],
                    ephemeral: true
                });
            }

            // Ordenar por proximidad
            const sorted = birthdays
                .map(b => ({ ...b, daysLeft: nextBirthdayDays(b.day, b.month) }))
                .sort((a, b) => a.daysLeft - b.daysLeft)
                .slice(0, 15);

            const lines = sorted.map((b, i) => {
                const emoji = b.daysLeft <= 7 ? '🔥' : b.daysLeft <= 30 ? '📅' : '🗓️';
                return `${i + 1}. ${emoji} <@${b.user_id}> — **${b.day} de ${MONTHS[b.month - 1]}** · \`${b.daysLeft}d\``;
            });

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🎂 Próximos Cumpleaños')
                    .setColor('#FEE75C')
                    .setDescription(lines.join('\n'))
                    .setFooter({ text: `${birthdays.length} cumpleaños registrados en el servidor` })
                ]
            });
        }
    }
};

// ── Helper exportado para el checker ──────────────────────────────────────
async function sendBirthdayAnnouncement(guild, user, config) {
    const ch = guild.channels.cache.get(config.birthday_channel);
    if (!ch) return;

    const msg = (config.birthday_message || '🎂 ¡Hoy es el cumpleaños de {user}! ¡Felicidades!')
        .replace('{user}', user.toString());

    const embed = new EmbedBuilder()
        .setTitle('🎉 ¡Feliz Cumpleaños!')
        .setDescription(msg)
        .setColor('#FEE75C')
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    await ch.send({ content: `🎂`, embeds: [embed] });

    // Asignar rol si está configurado
    if (config.birthday_role) {
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (member) {
            await member.roles.add(config.birthday_role).catch(() => null);
            // Quitar rol después de 24 horas
            setTimeout(() => {
                member.roles.remove(config.birthday_role).catch(() => null);
            }, 86400000);
        }
    }
}

module.exports.sendBirthdayAnnouncement = sendBirthdayAnnouncement;