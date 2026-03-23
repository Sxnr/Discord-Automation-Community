const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('setup-welcome')
        .setDescription('🎨 Configura o testea el sistema de bienvenida personalizado.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => 
            sub.setName('set')
                .setDescription('⚙️ Establece los parámetros de bienvenida.')
                .addChannelOption(opt => opt.setName('canal').setDescription('📍 Canal de destino.').setRequired(true))
                .addStringOption(opt => opt.setName('mensaje').setDescription('📝 Usa {user}, {server} y {count} para el texto.').setRequired(true))
                .addStringOption(opt => opt.setName('imagen').setDescription('🖼️ URL de la imagen (Opcional).'))
        )
        .addSubcommand(sub => 
            sub.setName('test')
                .setDescription('🧪 Envía una prueba real al canal configurado usando tus datos.')
        ),

    async execute(interaction) {
        // Usamos el nuevo sistema de flags para evitar el warning de deprecación
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        
        const guildId = interaction.guild.id;
        let sub;
        
        // Cláusula de seguridad para evitar que el bot se apague si no hay subcomando
        try {
            sub = interaction.options.getSubcommand();
        } catch (error) {
            return interaction.editReply({ 
                content: '❌ **Error de Sincronización:** Discord aún no ha actualizado los subcomandos. Por favor, ejecuta el comando de despliegue y reinicia tu Discord.' 
            });
        }

        if (sub === 'set') {
            const canal = interaction.options.getChannel('canal');
            const mensaje = interaction.options.getString('mensaje');
            const imagen = interaction.options.getString('imagen');

            try {
                db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
                db.prepare(`
                    UPDATE guild_settings 
                    SET welcome_channel = ?, 
                        ticket_welcome_msg = ?, 
                        ticket_embed_image = ? 
                    WHERE guild_id = ?
                `).run(canal.id, mensaje, imagen, guildId);

                const successEmbed = new EmbedBuilder()
                    .setTitle('🚀 Configuración Guardada')
                    .setColor('#2ECC71')
                    .setDescription(`El sistema ha sido vinculado al canal ${canal}.`)
                    .addFields(
                        { name: '📝 Mensaje Base', value: `\`\`\`${mensaje}\`\`\`` },
                        { name: '🖼️ Imagen', value: imagen ? '`PERSONALIZADA` ✅' : '`POR DEFECTO` ❌' }
                    )
                    .setFooter({ text: 'Usa /setup-welcome test para probarlo.' });

                await interaction.editReply({ embeds: [successEmbed] });
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '❌ **Error de SQL:** Revisa la estructura de tu base de datos.' });
            }
        }

        if (sub === 'test') {
            const config = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);

            if (!config || !config.welcome_channel) {
                return interaction.editReply({ content: '⚠️ **Error:** Primero debes configurar el sistema con `/setup-welcome set`.' });
            }

            const channel = interaction.guild.channels.cache.get(config.welcome_channel);
            if (!channel) return interaction.editReply({ content: '❌ **Error:** El canal configurado no existe.' });

            const renderedMessage = (config.ticket_welcome_msg || '¡Bienvenido {user}!')
                .replace('{user}', interaction.user.toString())
                .replace('{server}', interaction.guild.name)
                .replace('{count}', interaction.guild.memberCount);

            const testEmbed = new EmbedBuilder()
                .setAuthor({ 
                    name: `Test de Bienvenida: ${interaction.user.username}`, 
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
                })
                .setDescription(`>>> ${renderedMessage}`)
                .setColor('#5865F2')
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setImage(config.ticket_embed_image || null)
                .setFooter({ text: `Miembro #${interaction.guild.memberCount} • PRUEBA TÉCNICA` })
                .setTimestamp();

            try {
                await channel.send({ 
                    content: `🧪 **[MODO TEST]** Simulando ingreso de ${interaction.user}...`,
                    embeds: [testEmbed] 
                });
                await interaction.editReply({ content: `✅ **Prueba enviada!** Revisa el canal ${channel}.` });
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '❌ **Error:** Revisa los permisos del bot.' });
            }
        }
    },
};