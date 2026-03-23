const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('⚙️ Gestiona el núcleo de configuración del servidor.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // Grupo: Canales
        .addChannelOption(opt => opt.setName('welcome_channel').setDescription('👋 Canal para los mensajes de bienvenida.'))
        .addChannelOption(opt => opt.setName('ticket_logs').setDescription('📜 Canal para los respaldos (transcripts) de tickets.'))
        .addChannelOption(opt => opt.setName('audit_logs').setDescription('🛡️ Canal para logs de auditoría (mensajes borrados/editados).'))
        // Grupo: Roles
        .addRoleOption(opt => opt.setName('staff_role').setDescription('🛡️ Rol asignado para la gestión de tickets.'))
        // Grupo: Sistema
        .addBooleanOption(opt => opt.setName('view').setDescription('🔍 Visualiza el estado actual de la configuración.')),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const guildId = interaction.guild.id;

        const welcomeChannel = interaction.options.getChannel('welcome_channel');
        const ticketLogs = interaction.options.getChannel('ticket_logs');
        const auditLogs = interaction.options.getChannel('audit_logs');
        const staffRole = interaction.options.getRole('staff_role');
        const isViewMode = interaction.options.getBoolean('view');

        // 1. Cláusula de Guardia: Si no hay parámetros
        if (!isViewMode && !welcomeChannel && !ticketLogs && !staffRole && !auditLogs) {
            return interaction.editReply({
                content: '⚠️ **Acción requerida:** Selecciona una opción para modificar o activa `view: True` para consultar.'
            });
        }

        // 2. Lógica de Visualización (Dashboard)
        if (isViewMode) {
            const config = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);

            if (!config) {
                return interaction.editReply({ content: '❌ **Error:** No se encontró registro de este servidor en la base de datos.' });
            }

            const statusEmoji = (val) => val ? '✅' : '❌';
            const statusText = (val) => val ? '`ACTIVO`' : '`PENDIENTE`';

            const dashboardEmbed = new EmbedBuilder()
                .setTitle(`🛠️ Panel de Configuración | ${interaction.guild.name}`)
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setColor('#5865F2')
                .setDescription(`>>> **Estado global del sistema.**\nA continuación se detallan los módulos configurados para este servidor.`)
                .addFields(
                    { 
                        name: '📢 Módulos de Comunicación', 
                        value: `${statusEmoji(config.welcome_channel)} **Bienvenida:** ${config.welcome_channel ? `<#${config.welcome_channel}>` : statusText(false)}`, 
                        inline: false 
                    },
                    { 
                        name: '🛡️ Seguridad & Auditoría', 
                        value: `${statusEmoji(config.staff_role)} **Rol Staff:** ${config.staff_role ? `<@&${config.staff_role}>` : statusText(false)}\n${statusEmoji(config.ticket_log_channel)} **Logs Tickets:** ${config.ticket_log_channel ? `<#${config.ticket_log_channel}>` : statusText(false)}\n${statusEmoji(config.audit_log_channel)} **Auditoría:** ${config.audit_log_channel ? `<#${config.audit_log_channel}>` : statusText(false)}`, 
                        inline: false 
                    },
                    { 
                        name: '🎨 Personalización del Panel', 
                        value: `📝 **Mensaje:** \`${config.ticket_embed_msg ? 'Personalizado' : 'Default'}\`\n🖼️ **Imagen:** \`${config.ticket_embed_image ? 'Establecida' : 'Sin imagen'}\``, 
                        inline: false 
                    }
                )
                .setFooter({ text: 'Use /settings con parámetros para actualizar valores.', iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            return interaction.editReply({ embeds: [dashboardEmbed] });
        }

        // 3. Lógica de Actualización Dinámica
        db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);

        let changes = [];
        if (welcomeChannel) {
            db.prepare('UPDATE guild_settings SET welcome_channel = ? WHERE guild_id = ?').run(welcomeChannel.id, guildId);
            changes.push(`- **Bienvenida:** → ${welcomeChannel}`);
        }
        if (ticketLogs) {
            db.prepare('UPDATE guild_settings SET ticket_log_channel = ? WHERE guild_id = ?').run(ticketLogs.id, guildId);
            changes.push(`- **Logs de Tickets:** → ${ticketLogs}`);
        }
        if (auditLogs) {
            db.prepare('UPDATE guild_settings SET audit_log_channel = ? WHERE guild_id = ?').run(auditLogs.id, guildId);
            changes.push(`- **Auditoría:** → ${auditLogs}`);
        }
        if (staffRole) {
            db.prepare('UPDATE guild_settings SET staff_role = ? WHERE guild_id = ?').run(staffRole.id, guildId);
            changes.push(`- **Rol de Staff:** → ${staffRole}`);
        }

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Sincronización Exitosa')
            .setDescription(`Se han aplicado los siguientes cambios en la configuración:\n\n${changes.join('\n')}`)
            .setColor('#2ECC71')
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/190/190411.png') 
            .setFooter({ text: 'Los cambios surten efecto de manera inmediata.' });

        await interaction.editReply({ embeds: [successEmbed] });
    },
};