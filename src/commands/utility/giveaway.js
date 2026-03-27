const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');
const ms = require('ms');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('🎉 Gestión avanzada de sorteos con persistencia.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        // Subcomando: Iniciar
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('🚀 Inicia un nuevo sorteo.')
                .addStringOption(opt => opt.setName('duracion').setDescription('⏳ Ej: 1h, 1d, 30m').setRequired(true))
                .addIntegerOption(opt => opt.setName('ganadores').setDescription('🏆 Número de ganadores').setRequired(true).setMinValue(1).setMaxValue(20))
                .addStringOption(opt => opt.setName('premio').setDescription('🎁 ¿Qué se sortea?').setRequired(true))
                .addChannelOption(opt => opt.setName('canal').setDescription('📍 Canal del sorteo'))
                // ➕ NUEVAS OPCIONES
                .addRoleOption(opt => opt.setName('rol_requerido').setDescription('🎭 Rol que deben tener los usuarios para participar (Opcional)'))
                .addStringOption(opt => opt.setName('imagen').setDescription('🖼️ URL de imagen para el embed del sorteo (Opcional)'))
        )

        // Subcomando: Finalizar forzosamente
        .addSubcommand(sub =>
            sub.setName('end')
                .setDescription('⏹️ Finaliza un sorteo activo inmediatamente.')
                .addStringOption(opt => opt.setName('mensaje_id').setDescription('🆔 ID del mensaje del sorteo').setRequired(true))
        )

        // Subcomando: Relanzar ganadores
        .addSubcommand(sub =>
            sub.setName('reroll')
                .setDescription('🎲 Elige nuevos ganadores para un sorteo finalizado.')
                .addStringOption(opt => opt.setName('mensaje_id').setDescription('🆔 ID del mensaje del sorteo').setRequired(true))
                // ➕ Opción para reroll parcial
                .addIntegerOption(opt => opt.setName('cantidad').setDescription('🔢 Cuántos nuevos ganadores elegir (por defecto: los mismos que el sorteo)').setMinValue(1))
        )

        // ➕ FIX: Subcomando list ahora REGISTRADO correctamente
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('📋 Muestra todos los sorteos activos en el servidor.')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        // --- LÓGICA: INICIAR ---
        if (sub === 'start') {
            const durationStr  = interaction.options.getString('duracion');
            const winnerCount  = interaction.options.getInteger('ganadores');
            const prize        = interaction.options.getString('premio');
            const channel      = interaction.options.getChannel('canal') || interaction.channel;
            // ➕ NUEVAS
            const rolRequerido = interaction.options.getRole('rol_requerido');
            const imagen       = interaction.options.getString('imagen');

            const durationMs = ms(durationStr);
            if (!durationMs || durationMs < 10000) {
                return interaction.reply({ content: '❌ Formato de tiempo inválido o muy corto. Mínimo `10s`.', flags: [MessageFlags.Ephemeral] });
            }

            // ➕ Límite máximo de 30 días
            if (durationMs > ms('30d')) {
                return interaction.reply({ content: '❌ La duración máxima es `30d`.', flags: [MessageFlags.Ephemeral] });
            }

            const endTime = Date.now() + durationMs;

            const giveawayEmbed = new EmbedBuilder()
                .setTitle(`🎉 SORTEO: ${prize}`)
                .setDescription(
                    `>>> Haz clic en el botón para participar.\n\n` +
                    `🏆 **Ganadores:** \`${winnerCount}\`\n` +
                    `⏳ **Finaliza:** <t:${Math.floor(endTime / 1000)}:R> (<t:${Math.floor(endTime / 1000)}:f>)\n` +
                    // ➕ Mostrar rol requerido si existe
                    `${rolRequerido ? `🎭 **Requisito:** ${rolRequerido}\n` : ''}` +
                    `👥 **Participantes:** \`0\``
                )
                .setColor('#F1C40F')
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/3112/3112946.png')
                // ➕ Imagen opcional
                .setImage(imagen && imagen.startsWith('http') ? imagen : null)
                .setFooter({ text: `Host: ${interaction.user.username} • ID guardado abajo`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp(endTime);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('join_giveaway')
                    .setLabel('Participar')
                    .setEmoji('🎉')
                    .setStyle(ButtonStyle.Primary)
            );

            const msg = await channel.send({ embeds: [giveawayEmbed], components: [row] });

            db.prepare(`
                INSERT INTO giveaways (message_id, guild_id, channel_id, host_id, prize, winner_count, end_time, participants, required_role)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(msg.id, interaction.guild.id, channel.id, interaction.user.id, prize, winnerCount, endTime, JSON.stringify([]), rolRequerido?.id || null);

            // ➕ Feedback mejorado con el ID del mensaje visible
            const confirmEmbed = new EmbedBuilder()
                .setTitle('✅ Sorteo Iniciado')
                .setColor('#2ECC71')
                .addFields(
                    { name: '📍 Canal',         value: `${channel}`,               inline: true },
                    { name: '🏆 Ganadores',      value: `\`${winnerCount}\``,       inline: true },
                    { name: '⏳ Duración',        value: `\`${durationStr}\``,       inline: true },
                    { name: '🆔 ID del Sorteo',   value: `\`${msg.id}\``,           inline: false },
                    { name: '🎭 Rol Requerido',   value: rolRequerido ? `${rolRequerido}` : '`Ninguno`', inline: true }
                )
                .setFooter({ text: 'Guarda el ID para usar /giveaway end o /giveaway reroll' })
                .setTimestamp();

            return interaction.reply({ embeds: [confirmEmbed], flags: [MessageFlags.Ephemeral] });
        }

        // --- LÓGICA: FINALIZAR (END) ---
        if (sub === 'end') {
            const messageId = interaction.options.getString('mensaje_id');
            const giveaway  = db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND ended = 0').get(messageId);

            if (!giveaway) return interaction.reply({ content: '❌ No encontré un sorteo activo con ese ID.', flags: [MessageFlags.Ephemeral] });

            db.prepare('UPDATE giveaways SET end_time = ? WHERE message_id = ?').run(Date.now() - 1000, messageId);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('⏹️ Finalizando Sorteo')
                    .setDescription(`El sorteo de **${giveaway.prize}** será procesado en segundos por el gestor automático.`)
                    .setColor('#E74C3C')
                    .setTimestamp()
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // --- LÓGICA: RELANZAR (REROLL) ---
        if (sub === 'reroll') {
            const messageId = interaction.options.getString('mensaje_id');
            const cantidad  = interaction.options.getInteger('cantidad');
            const giveaway  = db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND ended = 1').get(messageId);

            if (!giveaway) return interaction.reply({ content: '❌ El sorteo debe estar finalizado para hacer un reroll.', flags: [MessageFlags.Ephemeral] });

            const participants = JSON.parse(giveaway.participants || '[]');
            if (participants.length === 0) return interaction.reply({ content: '❌ No hay participantes para elegir un nuevo ganador.', flags: [MessageFlags.Ephemeral] });

            // ➕ Respetar cantidad personalizada o usar la original
            const rerollCount = cantidad || giveaway.winner_count;
            const newWinners  = [...participants].sort(() => 0.5 - Math.random()).slice(0, rerollCount);

            const rerollEmbed = new EmbedBuilder()
                .setTitle('🎲 Reroll — Nuevos Ganadores')
                .setColor('#3498DB')
                .setDescription(
                    `>>> **Premio:** ${giveaway.prize}\n\n` +
                    `🏆 **Nuevos Ganadores:**\n${newWinners.map(id => `<@${id}>`).join('\n')}`
                )
                .addFields({ name: '📊 Participantes totales', value: `\`${participants.length}\``, inline: true })
                .setFooter({ text: 'Reroll del sorteo original' })
                .setTimestamp();

            const channel = interaction.guild.channels.cache.get(giveaway.channel_id);
            if (channel) {
                await channel.send({
                    content: `🎊 ¡Reroll completado! Felicidades ${newWinners.map(id => `<@${id}>`).join(', ')} 🎉`,
                    embeds: [rerollEmbed]
                });
            }

            return interaction.reply({ content: '✅ Reroll ejecutado correctamente.', flags: [MessageFlags.Ephemeral] });
        }

        // --- LÓGICA: LISTAR (LIST) ---
        if (sub === 'list') {
            const activeGiveaways = db.prepare('SELECT * FROM giveaways WHERE guild_id = ? AND ended = 0').all(interaction.guild.id);

            if (activeGiveaways.length === 0) {
                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setTitle('📋 Sorteos Activos')
                        .setDescription('No hay sorteos activos en este servidor en este momento.')
                        .setColor('#95A5A6')
                        .setTimestamp()
                    ],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const listEmbed = new EmbedBuilder()
                .setTitle(`📋 Sorteos Activos (${activeGiveaways.length})`)
                .setColor('#F1C40F')
                .setDescription(
                    activeGiveaways.map((g, index) => {
                        const participants = JSON.parse(g.participants || '[]');
                        return (
                            `**${index + 1}. ${g.prize}**\n` +
                            `> 🆔 \`${g.message_id}\`\n` +
                            `> 📍 <#${g.channel_id}>\n` +
                            `> 🏆 Ganadores: \`${g.winner_count}\`\n` +
                            `> 👥 Participantes: \`${participants.length}\`\n` +
                            `> ⏳ <t:${Math.floor(g.end_time / 1000)}:R>`
                        );
                    }).join('\n\n')
                )
                .setFooter({ text: 'Usa el ID con /giveaway end o /giveaway reroll' })
                .setTimestamp();

            return interaction.reply({ embeds: [listEmbed], flags: [MessageFlags.Ephemeral] });
        }
    }
};