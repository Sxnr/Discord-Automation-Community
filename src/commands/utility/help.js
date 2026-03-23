const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('📂 Despliega el panel de asistencia interactivo con todos los comandos.'),
    async execute(interaction) {
        const { client } = interaction;
        const commands = client.commands;

        // Calculamos estadísticas dinámicas para un look más robusto y data-driven
        const totalCommands = commands.size;
        const adminCount = commands.filter(cmd => cmd.category === 'admin').size;
        const utilityCount = commands.filter(cmd => cmd.category === 'utility').size;

        const helpMainEmbed = new EmbedBuilder()
            .setTitle('📚 Centro de Ayuda | Global System')
            .setColor('#5865F2')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(
                `>>> **Bienvenido al núcleo de asistencia avanzada.**\n` +
                `Explora las capacidades del sistema utilizando el menú interactivo. Cada módulo ha sido optimizado para maximizar la eficiencia de tu comunidad.`
            )
            .addFields(
                { 
                    name: '🛡️ Módulo de Administración', 
                    value: `Gestión de infraestructura, tickets y roles staff.\n> \`${adminCount} Comandos disponibles\``, 
                    inline: true 
                },
                { 
                    name: '🛠️ Módulo de Utilidad', 
                    value: `Herramientas de diagnóstico, monitoreo y estado.\n> \`${utilityCount} Comandos disponibles\``, 
                    inline: true 
                }
            )
            .addFields({
                name: '🚀 Instrucciones de Navegación',
                value: 'Utiliza el menú desplegable inferior para filtrar los comandos por categoría. Obtendrás una descripción detallada de cada función disponible.'
            })
            .setFooter({ 
                text: `Sincronizado con el clúster global • ${interaction.guild.name}`, 
                iconURL: interaction.guild.iconURL({ dynamic: true }) 
            })
            .setTimestamp();

        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('📂 Selecciona una categoría del sistema...')
            .addOptions([
                {
                    label: 'Administración',
                    description: 'Configuración de seguridad, tickets y gestión staff.',
                    value: 'admin',
                    emoji: '🛡️',
                },
                {
                    label: 'Utilidad',
                    description: 'Comandos de diagnóstico, latencia y asistencia técnica.',
                    value: 'utility',
                    emoji: '🛠️',
                },
            ]);

        const row = new ActionRowBuilder().addComponents(menu);

        // Respondemos de forma efímera para mantener la limpieza del canal
        await interaction.reply({ 
            embeds: [helpMainEmbed], 
            components: [row], 
            ephemeral: true 
        });
    },
};