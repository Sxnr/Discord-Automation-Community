const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('setup-welcome')
        .setDescription('🎨 Configura el sistema de bienvenida con imágenes generadas por IA.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => 
            sub.setName('set')
                .setDescription('⚙️ Configura el canal y el diseño.')
                .addChannelOption(opt => opt.setName('canal').setDescription('📍 Donde se enviarán las imágenes.').setRequired(true))
                .addStringOption(opt => opt.setName('mensaje').setDescription('📝 Texto del embed (Usa {user}, {server}).').setRequired(true))
                .addStringOption(opt => opt.setName('fondo').setDescription('🖼️ URL de la imagen de fondo (1024x450 recomendada).'))
        )
        .addSubcommand(sub => 
            sub.setName('test')
                .setDescription('🧪 Simula una entrada para ver cómo queda la imagen.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const guildId = interaction.guild.id;
        const sub = interaction.options.getSubcommand();

        if (sub === 'set') {
            const canal = interaction.options.getChannel('canal');
            const mensaje = interaction.options.getString('mensaje');
            const fondo = interaction.options.getString('fondo');

            db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
            db.prepare(`
                UPDATE guild_settings 
                SET welcome_channel = ?, 
                    ticket_welcome_msg = ?, 
                    ticket_embed_image = ? 
                WHERE guild_id = ?
            `).run(canal.id, mensaje, fondo, guildId);

            const successEmbed = new EmbedBuilder()
                .setTitle('🎨 Diseño de Bienvenida Actualizado')
                .setColor('#2ECC71')
                .setDescription('Se ha configurado el generador de imágenes dinámicas.')
                .addFields(
                    { name: '📍 Canal', value: `${canal}`, inline: true },
                    { name: '🖼️ Fondo', value: fondo ? '`Imagen Personalizada` ✅' : '`Degradado Tech` 💠', inline: true }
                )
                .setFooter({ text: 'Usa /setup-welcome test para visualizar el resultado.' });

            await interaction.editReply({ embeds: [successEmbed] });
        }

        if (sub === 'test') {
            // Reutilizamos la lógica del evento para la prueba
            const event = require('../../events/guildMemberAdd');
            await event.execute(interaction.member);
            await interaction.editReply({ content: '✅ **Prueba de imagen enviada!** Revisa el canal configurado.' });
        }
    },
};