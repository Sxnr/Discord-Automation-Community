const {
    SlashCommandBuilder, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');
const db = require('../../database/db');

// Cooldown en memoria
const cooldowns = new Map();

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Sistema de reportes del servidor.')
        .addSubcommand(sub => sub
            .setName('user')
            .setDescription('Reporta a un usuario.')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('Usuario a reportar')
                .setRequired(true)
            )
            .addStringOption(opt => opt
                .setName('razon')
                .setDescription('¿Por qué reportas a este usuario?')
                .setMinLength(10)
                .setMaxLength(500)
                .setRequired(true)
            )
        )
        .addSubcommand(sub => sub
            .setName('history')
            .setDescription('Ver historial de reportes de un usuario. [Staff]')
            .addUserOption(opt => opt
                .setName('usuario')
                .setDescription('Usuario a consultar')
                .setRequired(true)
            )
        )
        .addSubcommandGroup(group => group
            .setName('config')
            .setDescription('Configura el sistema de reportes. [Admin]')
            .addSubcommand(sub => sub
                .setName('channel')
                .setDescription('Canal donde llegan los reportes.')
                .addChannelOption(opt => opt
                    .setName('canal')
                    .setDescription('Canal de reportes')
                    .setRequired(true)
                )
            )
            .addSubcommand(sub => sub
                .setName('cooldown')
                .setDescription('Cooldown entre reportes (en segundos).')
                .addIntegerOption(opt => opt
                    .setName('segundos')
                    .setDescription('Tiempo mínimo entre reportes (default: 300)')
                    .setMinValue(30)
                    .setMaxValue(3600)
                    .setRequired(true)
                )
            )
            .addSubcommand(sub => sub
                .setName('status')
                .setDescription('Ver configuración actual de reportes.')
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
                db.prepare('UPDATE guild_settings SET report_channel = ? WHERE guild_id = ?').run(ch.id, guildId);
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Canal de reportes configurado en ${ch}`)],
                    ephemeral: true
                });
            }

            if (sub === 'cooldown') {
                const secs = interaction.options.getInteger('segundos');
                db.prepare('UPDATE guild_settings SET report_cooldown = ? WHERE guild_id = ?').run(secs, guildId);
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ Cooldown configurado en **${secs} segundos**.`)],
                    ephemeral: true
                });
            }

            if (sub === 'status') {
                const config = db.prepare('SELECT report_channel, report_cooldown FROM guild_settings WHERE guild_id = ?').get(guildId);
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('🚨 Configuración de Reportes')
                        .setColor('#5865F2')
                        .addFields(
                            { name: '📢 Canal',    value: config?.report_channel  ? `<#${config.report_channel}>` : '`No configurado`', inline: true },
                            { name: '⏱️ Cooldown', value: `\`${config?.report_cooldown ?? 300} segundos\``,                            inline: true }
                        )
                    ],
                    ephemeral: true
                });
            }
        }

        // ── REPORT USER ───────────────────────────────────────────────────
        if (sub === 'user') {
            const config = db.prepare('SELECT report_channel, report_cooldown, staff_role FROM guild_settings WHERE guild_id = ?').get(guildId);
            if (!config?.report_channel) {
                return interaction.reply({ content: '❌ No hay canal de reportes configurado. Pide a un admin que use `/report config channel`.', ephemeral: true });
            }

            const target = interaction.options.getUser('usuario');
            const reason = interaction.options.getString('razon');

            // Autoprotección
            if (target.id === interaction.user.id) {
                return interaction.reply({ content: '❌ No puedes reportarte a ti mismo.', ephemeral: true });
            }
            if (target.bot) {
                return interaction.reply({ content: '❌ No puedes reportar a un bot.', ephemeral: true });
            }

            // Cooldown
            const cooldownKey  = `${guildId}:${interaction.user.id}`;
            const cooldownSecs = config.report_cooldown ?? 300;
            const lastReport   = cooldowns.get(cooldownKey);
            if (lastReport) {
                const remaining = Math.ceil((lastReport + cooldownSecs * 1000 - Date.now()) / 1000);
                if (remaining > 0) {
                    return interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor('#ED4245')
                            .setDescription(`⏱️ Debes esperar **${remaining} segundos** antes de enviar otro reporte.`)
                        ],
                        ephemeral: true
                    });
                }
            }

            const reportChannel = interaction.guild.channels.cache.get(config.report_channel);
            if (!reportChannel) {
                return interaction.reply({ content: '❌ El canal de reportes no existe. Pide a un admin que lo reconfigure.', ephemeral: true });
            }

            // Guardar en DB
            const result = db.prepare(`
                INSERT INTO reports (guild_id, reporter_id, reported_id, reason, channel_id, status, timestamp)
                VALUES (?, ?, ?, ?, ?, 'pending', ?)
            `).run(guildId, interaction.user.id, target.id, reason, interaction.channel.id, Date.now());

            const reportId = result.lastInsertRowid;
            cooldowns.set(cooldownKey, Date.now());

            // Embed del reporte
            const reportEmbed = new EmbedBuilder()
                .setTitle(`🚨 Reporte #${reportId}`)
                .setColor('#ED4245')
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: '🎯 Reportado',  value: `${target} \`(${target.tag})\``,              inline: true },
                    { name: '📢 Reportado por', value: `${interaction.user}`,                      inline: true },
                    { name: '\u200b',          value: '\u200b',                                    inline: true },
                    { name: '📋 Razón',        value: `>>> ${reason}`,                             inline: false },
                    { name: '📍 Canal origen', value: `<#${interaction.channel.id}>`,              inline: true },
                    { name: '📊 Estado',       value: '⏳ Pendiente',                              inline: true }
                )
                .setFooter({ text: `ID del reporte: ${reportId}` })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`report_resolve_${reportId}`)
                    .setLabel('Resolver')
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`report_mute_${reportId}`)
                    .setLabel('Mutear')
                    .setEmoji('🔇')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`report_ban_${reportId}`)
                    .setLabel('Banear')
                    .setEmoji('🔨')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`report_dismiss_${reportId}`)
                    .setLabel('Descartar')
                    .setEmoji('❌')
                    .setStyle(ButtonStyle.Secondary)
            );

            const msg = await reportChannel.send({
                content: config.staff_role ? `<@&${config.staff_role}>` : null,
                embeds: [reportEmbed],
                components: [row]
            });

            db.prepare('UPDATE reports SET message_id = ? WHERE id = ?').run(msg.id, reportId);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#57F287')
                    .setDescription(`✅ Tu reporte **#${reportId}** fue enviado al staff. Gracias por ayudar a mantener la comunidad.`)
                ],
                ephemeral: true
            });
        }

        // ── HISTORY ───────────────────────────────────────────────────────
        if (sub === 'history') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: '❌ Necesitas el permiso **Gestionar Mensajes**.', ephemeral: true });
            }

            const target  = interaction.options.getUser('usuario');
            const reports = db.prepare('SELECT * FROM reports WHERE guild_id = ? AND reported_id = ? ORDER BY timestamp DESC').all(guildId, target.id);

            if (!reports.length) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`✅ **${target.tag}** no tiene reportes en este servidor.`)],
                    ephemeral: true
                });
            }

            const statusEmoji = { pending: '⏳', resolved: '✅', dismissed: '❌', muted: '🔇', banned: '🔨' };

            const fields = reports.slice(0, 10).map(r => ({
                name: `${statusEmoji[r.status] ?? '❓'} Reporte #${r.id} — <t:${Math.floor(r.timestamp / 1000)}:R>`,
                value: `> 📋 ${r.reason}\n> 👤 Reportado por <@${r.reporter_id}>${r.handled_by ? `\n> 🛡️ Gestionado por <@${r.handled_by}>` : ''}`,
                inline: false
            }));

            const embed = new EmbedBuilder()
                .setTitle(`🚨 Historial de Reportes — ${target.tag}`)
                .setColor('#ED4245')
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setDescription(`Total de reportes: **${reports.length}**`)
                .addFields(fields)
                .setFooter({ text: reports.length > 10 ? `Mostrando los últimos 10 de ${reports.length}` : `${reports.length} reportes en total` })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};