const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configura las opciones globales del bot para este servidor.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // Canales Generales
        .addChannelOption(opt => opt.setName('welcome_channel').setDescription('Canal para mensajes de bienvenida'))
        .addChannelOption(opt => opt.setName('ticket_logs').setDescription('Canal donde se enviarán los Transcripts de tickets'))
        // Roles
        .addRoleOption(opt => opt.setName('staff_role').setDescription('Rol de moderación/staff para tickets'))
        // Visualización
        .addBooleanOption(opt => opt.setName('view').setDescription('Muestra la configuración actual del servidor')),

    async execute(interaction) {
        const guildId = interaction.guild.id;

        // 1. Obtención de valores (DENTRO del execute)
        const welcomeChannel = interaction.options.getChannel('welcome_channel');
        const ticketLogs = interaction.options.getChannel('ticket_logs');
        const staffRole = interaction.options.getRole('staff_role');
        const isViewMode = interaction.options.getBoolean('view');

        // 2. Validación: Si no hay vista Y no hay opciones, avisamos al usuario
        if (!isViewMode && !welcomeChannel && !ticketLogs && !staffRole) {
            return interaction.reply({
                content: '⚠️ Debes seleccionar al menos una opción para configurar o usar `view: True`.',
                ephemeral: true
            });
        }

        // 3. Lógica de VISUALIZACIÓN
        if (isViewMode) {
            const config = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);

            if (!config) {
                return interaction.reply({ content: '❌ Este servidor aún no tiene una base de datos inicializada.', ephemeral: true });
            }

            const viewEmbed = new EmbedBuilder()
                .setTitle(`⚙️ Configuración Global: ${interaction.guild.name}`)
                .setThumbnail(interaction.guild.iconURL())
                .setColor('#5865F2')
                .addFields(
                    { name: '👋 Canal de Bienvenida', value: config.welcome_channel ? `<#${config.welcome_channel}>` : '`No configurado`', inline: true },
                    { name: '📜 Logs de Transcripts', value: config.ticket_log_channel ? `<#${config.ticket_log_channel}>` : '`No configurado`', inline: true },
                    { name: '🛡️ Rol de Staff', value: config.staff_role ? `<@&${config.staff_role}>` : '`No configurado`', inline: true }
                )
                .addFields(
                    { name: '📝 Mensaje del Panel', value: config.ticket_embed_msg ? `Personalizado` : '`Default`', inline: true },
                    { name: '🖼️ Imagen del Panel', value: config.ticket_embed_image ? '[Ver Enlace]' : '`Sin Imagen`', inline: true }
                )
                .setFooter({ text: 'Usa los parámetros de /settings para modificar valores individuales.' });

            return interaction.reply({ embeds: [viewEmbed], ephemeral: true });
        }

        // 4. Lógica de ACTUALIZACIÓN (Solo si no es modo vista)
        db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);

        if (welcomeChannel) {
            db.prepare('UPDATE guild_settings SET welcome_channel = ? WHERE guild_id = ?').run(welcomeChannel.id, guildId);
        }
        if (ticketLogs) {
            db.prepare('UPDATE guild_settings SET ticket_log_channel = ? WHERE guild_id = ?').run(ticketLogs.id, guildId);
        }
        if (staffRole) {
            db.prepare('UPDATE guild_settings SET staff_role = ? WHERE guild_id = ?').run(staffRole.id, guildId);
        }

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Ajustes Guardados')
            .setDescription('La configuración se ha actualizado correctamente para este servidor.')
            .setColor('#2ECC71')
            .setTimestamp();

        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    },
};