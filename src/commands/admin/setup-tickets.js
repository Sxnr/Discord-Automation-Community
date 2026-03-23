const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('setup-tickets')
        .setDescription('🎫 Configura y despliega un sistema de soporte profesional.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // Opciones de destino
        .addChannelOption(opt => opt.setName('canal').setDescription('📍 Canal donde se publicará el panel de soporte.').setRequired(true))
        // Opciones de contenido
        .addStringOption(opt => opt.setName('mensaje').setDescription('📝 Mensaje principal que verán los usuarios en el panel.').setRequired(true))
        .addStringOption(opt => opt.setName('bienvenida').setDescription('👋 Mensaje de bienvenida que se enviará al abrir un ticket.').setRequired(true))
        // Opciones de privacidad/lógica
        .addBooleanOption(opt => opt.setName('dm_transcript').setDescription('📩 ¿Enviar una copia del historial al usuario por mensaje privado?').setRequired(true))
        // Estética
        .addStringOption(opt => opt.setName('imagen').setDescription('🖼️ URL de una imagen decorativa para el panel (Opcional)')),

    async execute(interaction) {
        // Iniciamos con defer para procesos de DB y envío de mensajes
        await interaction.deferReply({ ephemeral: true });

        try {
            const canal = interaction.options.getChannel('canal');
            const mensaje = interaction.options.getString('mensaje');
            const bienvenida = interaction.options.getString('bienvenida');
            const dmTranscript = interaction.options.getBoolean('dm_transcript');
            const imagen = interaction.options.getString('imagen');
            const guildId = interaction.guild.id;

            // 1. Sincronización con la Base de Datos
            db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
            
            const updateStmt = db.prepare(`
                UPDATE guild_settings 
                SET ticket_embed_msg = ?, 
                    ticket_welcome_msg = ?, 
                    ticket_embed_image = ?, 
                    ticket_dm_preference = ?
                WHERE guild_id = ?
            `);
            
            updateStmt.run(mensaje, bienvenida, imagen, dmTranscript ? 1 : 0, guildId);

            // 2. Creación del Panel de Soporte (El que verán los usuarios)
            const panelEmbed = new EmbedBuilder()
                .setTitle('📩 Centro de Atención al Usuario')
                .setDescription(`>>> ${mensaje}`)
                .setColor('#5865F2')
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setImage(imagen && imagen.startsWith('http') ? imagen : null)
                .setFooter({ 
                    text: `${interaction.guild.name} • Sistema de Soporte Técnico`, 
                    iconURL: interaction.client.user.displayAvatarURL() 
                });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('open_ticket')
                    .setLabel('Abrir Ticket')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎫')
            );

            // 3. Envío del panel al canal destino
            await canal.send({ embeds: [panelEmbed], components: [row] });

            // 4. Feedback visual para el Administrador (Estilo Premium)
            const successEmbed = new EmbedBuilder()
                .setTitle('🚀 Sistema de Tickets Desplegado')
                .setColor('#2ECC71')
                .setDescription('El panel ha sido configurado y enviado correctamente.')
                .addFields(
                    { name: '📍 Canal de Destino', value: `${canal}`, inline: true },
                    { name: '📩 Transcripts DM', value: dmTranscript ? '`HABILITADO` ✅' : '`DESACTIVADO` ❌', inline: true },
                    { name: '👋 Bienvenida Configurada', value: '`SÍ` ✅', inline: true }
                )
                .addFields({
                    name: '📄 Vista Previa del Mensaje',
                    value: `\`\`\`${mensaje.length > 100 ? mensaje.substring(0, 97) + '...' : mensaje}\`\`\``
                })
                .setFooter({ text: 'Configuración guardada en la base de datos SQL.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error("ERROR EN SETUP-TICKETS:", error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Error de Configuración')
                .setDescription('Hubo un problema al intentar desplegar el sistema. Verifica los permisos del bot o la estructura de la base de datos.')
                .setColor('#E74C3C');
            
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};