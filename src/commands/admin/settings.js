const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('⚙️ Gestiona el núcleo de configuración del servidor.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // Canales
        .addChannelOption(opt => opt.setName('welcome_channel').setDescription('👋 Canal para mensajes de bienvenida.'))
        .addChannelOption(opt => opt.setName('ticket_logs').setDescription('📜 Canal para transcripts de tickets.'))
        .addChannelOption(opt => opt.setName('audit_logs').setDescription('🛡️ Canal para logs de auditoría.'))
        .addChannelOption(opt => opt.setName('general_logs').setDescription('📊 Canal para logs generales.'))
        .addChannelOption(opt => opt.setName('report_channel').setDescription('🚨 Canal donde llegan los reportes.'))
        .addChannelOption(opt => opt.setName('suggest_channel').setDescription('💡 Canal de sugerencias.'))
        .addChannelOption(opt => opt.setName('suggest_logs').setDescription('📋 Logs de sugerencias procesadas.'))
        .addChannelOption(opt => opt.setName('ticket_category').setDescription('📁 Categoría donde se crearán los tickets.'))
        // Roles
        .addRoleOption(opt => opt.setName('staff_role').setDescription('🛡️ Rol del equipo de staff.'))
        // Bienvenida rápida
        .addRoleOption(opt => opt.setName('welcome_role').setDescription('📣 Rol a mencionar en la bienvenida.'))
        .addStringOption(opt => opt.setName('welcome_color').setDescription('🎨 Color del embed de bienvenida en HEX. Ej: #5865F2'))
        .addBooleanOption(opt => opt.setName('welcome_enabled').setDescription('✅ Activar o desactivar el sistema de bienvenida.'))
        // Vista
        .addBooleanOption(opt => opt.setName('view').setDescription('🔍 Ver configuración actual del servidor.')),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const guildId = interaction.guild.id;

        const welcomeChannel  = interaction.options.getChannel('welcome_channel');
        const ticketLogs      = interaction.options.getChannel('ticket_logs');
        const auditLogs       = interaction.options.getChannel('audit_logs');
        const generalLogs     = interaction.options.getChannel('general_logs');
        const reportChannel   = interaction.options.getChannel('report_channel');
        const suggestChannel  = interaction.options.getChannel('suggest_channel');
        const suggestLogs     = interaction.options.getChannel('suggest_logs');
        const ticketCategory  = interaction.options.getChannel('ticket_category');
        const staffRole       = interaction.options.getRole('staff_role');
        const welcomeRole     = interaction.options.getRole('welcome_role');
        const welcomeColor    = interaction.options.getString('welcome_color');
        const welcomeEnabled  = interaction.options.getBoolean('welcome_enabled');
        const isViewMode      = interaction.options.getBoolean('view');

        const hasChanges = welcomeChannel || ticketLogs || auditLogs || generalLogs ||
                           reportChannel || suggestChannel || suggestLogs || ticketCategory ||
                           staffRole || welcomeRole || welcomeColor || welcomeEnabled !== null;

        if (!isViewMode && !hasChanges) {
            return interaction.editReply({ content: '⚠️ Selecciona una opción para modificar o activa `view: True` para consultar.' });
        }

        // ── MODO VISUALIZACIÓN ────────────────────────────────────────────
        if (isViewMode) {
            const c = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
            if (!c) return interaction.editReply({ content: '❌ No se encontró configuración para este servidor. Usa cualquier opción para inicializarlo.' });

            const on = (val) => val ? '✅' : '❌';
            const ch = (id)  => id ? `<#${id}>` : '`No configurado`';
            const ro = (id)  => id ? `<@&${id}>` : '`No configurado`';

            const embed = new EmbedBuilder()
                .setTitle(`⚙️ Panel de Configuración — ${interaction.guild.name}`)
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setColor('#5865F2')
                .addFields(
                    {
                        name: '👋 Bienvenida',
                        value:
                            `${on(c.welcome_enabled && c.welcome_channel)} Estado: ${c.welcome_enabled ? '`ACTIVO`' : '`INACTIVO`'}\n` +
                            `${on(c.welcome_channel)} Canal: ${ch(c.welcome_channel)}\n` +
                            `${on(c.welcome_role)} Rol: ${ro(c.welcome_role)}\n` +
                            `🎨 Color: \`${c.welcome_color || '#5865F2'}\`\n` +
                            `🖼️ Fondo: \`${c.welcome_background ? 'Personalizado' : 'Default'}\``
                    },
                    {
                        name: '🎫 Tickets',
                        value:
                            `${on(c.ticket_log_channel)} Logs: ${ch(c.ticket_log_channel)}\n` +
                            `${on(c.ticket_category)} Categoría: ${ch(c.ticket_category)}\n` +
                            `📋 Tipos: \`${c.ticket_types || 'Ticket directo'}\`\n` +
                            `📩 DM Transcript: ${c.ticket_dm_preference ? '`ACTIVO` ✅' : '`DESACTIVADO` ❌'}`
                    },
                    {
                        name: '🛡️ Moderación & Auditoría',
                        value:
                            `${on(c.staff_role)} Staff: ${ro(c.staff_role)}\n` +
                            `${on(c.audit_log_channel)} Auditoría: ${ch(c.audit_log_channel)}\n` +
                            `${on(c.general_log_channel)} General: ${ch(c.general_log_channel)}\n` +
                            `${on(c.automod_enabled)} Automod: ${c.automod_enabled ? '`ACTIVO`' : '`INACTIVO`'} — \`/automod status\``
                    },
                    {
                        name: '🚨 Reportes',
                        value:
                            `${on(c.report_channel)} Canal: ${ch(c.report_channel)}\n` +
                            `⏱️ Cooldown: \`${c.report_cooldown ?? 300}s\``
                    },
                    {
                        name: '💡 Sugerencias',
                        value:
                            `${on(c.suggest_channel)} Canal: ${ch(c.suggest_channel)}\n` +
                            `${on(c.suggest_log_channel)} Logs: ${ch(c.suggest_log_channel)}`
                    },
                    {
                        name: '⭐ Sistema XP',
                        value:
                            `${on(c.xp_enabled)} Estado: ${c.xp_enabled ? '`ACTIVO`' : '`INACTIVO`'}\n` +
                            `${on(c.xp_channel)} Canal lvl-up: ${ch(c.xp_channel)}\n` +
                            `📈 XP/msg: \`${c.xp_min ?? 15}–${c.xp_max ?? 25}\` · Cooldown: \`${c.xp_cooldown ?? 60}s\` · Mult: \`x${c.xp_multiplier ?? 1.0}\``
                    }
                )
                .setFooter({ text: 'Usa /settings con parámetros para actualizar · /setup-welcome para configuración avanzada' })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // ── ACTUALIZACIÓN ─────────────────────────────────────────────────
        db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);

        const changes = [];
        const set = (col, val, label) => {
            db.prepare(`UPDATE guild_settings SET ${col} = ? WHERE guild_id = ?`).run(val, guildId);
            changes.push(label);
        };

        if (welcomeChannel)        set('welcome_channel',    welcomeChannel.id,             `👋 **Bienvenida** → ${welcomeChannel}`);
        if (ticketLogs)            set('ticket_log_channel', ticketLogs.id,                 `📜 **Logs Tickets** → ${ticketLogs}`);
        if (auditLogs)             set('audit_log_channel',  auditLogs.id,                  `🛡️ **Auditoría** → ${auditLogs}`);
        if (generalLogs)           set('general_log_channel',generalLogs.id,                `📊 **Logs Generales** → ${generalLogs}`);
        if (reportChannel)         set('report_channel',     reportChannel.id,              `🚨 **Reportes** → ${reportChannel}`);
        if (suggestChannel)        set('suggest_channel',    suggestChannel.id,             `💡 **Sugerencias** → ${suggestChannel}`);
        if (suggestLogs)           set('suggest_log_channel',suggestLogs.id,                `📋 **Logs Sugerencias** → ${suggestLogs}`);
        if (ticketCategory)        set('ticket_category',    ticketCategory.id,             `📁 **Categoría Tickets** → ${ticketCategory}`);
        if (staffRole)             set('staff_role',         staffRole.id,                  `🛡️ **Rol Staff** → ${staffRole}`);
        if (welcomeRole)           set('welcome_role',       welcomeRole.id,                `📣 **Rol Bienvenida** → ${welcomeRole}`);
        if (welcomeColor) {
            if (!/^#[0-9A-Fa-f]{6}$/.test(welcomeColor)) {
                return interaction.editReply({ content: '❌ El color debe estar en formato HEX válido. Ej: `#5865F2`' });
            }
            set('welcome_color', welcomeColor, `🎨 **Color Bienvenida** → \`${welcomeColor}\``);
        }
        if (welcomeEnabled !== null) set('welcome_enabled', welcomeEnabled ? 1 : 0, `${welcomeEnabled ? '✅' : '🚫'} **Bienvenida** → \`${welcomeEnabled ? 'ACTIVADA' : 'DESACTIVADA'}\``);

        return interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('✅ Configuración Actualizada')
                .setDescription(`Se aplicaron **${changes.length}** cambio(s):\n\n${changes.map(c => `- ${c}`).join('\n')}`)
                .setColor('#57F287')
                .setFooter({ text: 'Los cambios surten efecto inmediatamente.' })
                .setTimestamp()
            ]
        });
    }
};