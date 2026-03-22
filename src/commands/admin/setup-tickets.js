const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('setup-tickets')
        .setDescription('Configura un panel de soporte visual y profesional.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(opt => opt.setName('canal').setDescription('📍 Dónde enviar el panel').setRequired(true))
        .addStringOption(opt => opt.setName('mensaje').setDescription('📝 Texto del panel').setRequired(true))
        .addStringOption(opt => opt.setName('bienvenida').setDescription('👋 Bienvenida interna').setRequired(true))
        .addBooleanOption(opt => opt.setName('dm_transcript').setDescription('📩 ¿Enviar copia al usuario por DM?').setRequired(true))
        .addStringOption(opt => opt.setName('imagen').setDescription('🖼️ URL de imagen (Opcional)')),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const canal = interaction.options.getChannel('canal');
            const mensaje = interaction.options.getString('mensaje');
            const bienvenida = interaction.options.getString('bienvenida');
            const dmTranscript = interaction.options.getBoolean('dm_transcript');
            const imagen = interaction.options.getString('imagen');

            // Guardamos la preferencia de DM en la DB (Asegúrate de tener esta columna o agrégala)
            db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(interaction.guild.id);
            db.prepare(`
                UPDATE guild_settings 
                SET ticket_embed_msg = ?, ticket_welcome_msg = ?, ticket_embed_image = ?, ticket_dm_preference = ?
                WHERE guild_id = ?
            `).run(mensaje, bienvenida, imagen, dmTranscript ? 1 : 0, interaction.guild.id);

            const panelEmbed = new EmbedBuilder()
                .setTitle('📩 Centro de Ayuda & Soporte')
                .setDescription(`>>> ${mensaje}`) // Bloque de cita para estilo elegante
                .setColor('#5865F2')
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ text: 'Limit Brake Support System • Click abajo', iconURL: interaction.client.user.displayAvatarURL() });

            if (imagen && imagen.startsWith('http')) panelEmbed.setImage(imagen);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('open_ticket')
                    .setLabel('Abrir Ticket')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('📩') // Emoji para el botón
            );

            await canal.send({ embeds: [panelEmbed], components: [row] });
            await interaction.editReply({ content: '✅ **¡Panel configurado con éxito!** Los emojis y preferencias han sido aplicados.' });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ **Error:** Revisa la consola o las columnas de tu DB.' });
        }
    },
};