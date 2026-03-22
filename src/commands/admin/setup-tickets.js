const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('setup-tickets')
        .setDescription('Configura y envía el panel de tickets personalizado.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(opt => opt.setName('canal').setDescription('Canal donde se enviará el panel').setRequired(true))
        .addStringOption(opt => opt.setName('mensaje').setDescription('Mensaje principal del panel').setRequired(true))
        .addStringOption(opt => opt.setName('bienvenida').setDescription('Mensaje dentro del ticket (Bienvenida)').setRequired(true))
        .addStringOption(opt => opt.setName('imagen').setDescription('URL de la imagen para el panel (Opcional)')),

    async execute(interaction) {
        const canal = interaction.options.getChannel('canal');
        const mensaje = interaction.options.getString('mensaje');
        const bienvenida = interaction.options.getString('bienvenida');
        const imagen = interaction.options.getString('imagen');

        // Guardar configuración en la DB para este servidor
        db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(interaction.guild.id);
        db.prepare(`
            UPDATE guild_settings 
            SET ticket_embed_msg = ?, ticket_welcome_msg = ?, ticket_embed_image = ?
            WHERE guild_id = ?
        `).run(mensaje, bienvenida, imagen, interaction.guild.id);

        const panelEmbed = new EmbedBuilder()
            .setTitle('🎫 Soporte Técnico')
            .setDescription(mensaje)
            .setColor('#5865F2')
            .setTimestamp();

        if (imagen) panelEmbed.setImage(imagen);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_ticket')
                .setLabel('Abrir Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📩')
        );

        await canal.send({ embeds: [panelEmbed], components: [row] });
        await interaction.reply({ content: `✅ Panel enviado a ${canal}`, ephemeral: true });
    },
};