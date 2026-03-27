const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('⚠️ Sistema de advertencias para moderar usuarios.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('➕ Añade una advertencia a un usuario.')
            .addUserOption(opt => opt.setName('usuario').setDescription('👤 Usuario a advertir').setRequired(true))
            .addStringOption(opt => opt.setName('razon').setDescription('📋 Motivo de la advertencia').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('📋 Muestra el historial de advertencias de un usuario.')
            .addUserOption(opt => opt.setName('usuario').setDescription('👤 Usuario a consultar').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('🗑️ Elimina una advertencia específica por su ID.')
            .addIntegerOption(opt => opt.setName('id').setDescription('🆔 ID de la advertencia').setRequired(true).setMinValue(1))
        )
        .addSubcommand(sub => sub
            .setName('clear')
            .setDescription('🧹 Borra TODAS las advertencias de un usuario.')
            .addUserOption(opt => opt.setName('usuario').setDescription('👤 Usuario a limpiar').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // Helper: obtener canal de logs
        const getLogChannel = () => {
            const settings = db.prepare('SELECT audit_log_channel FROM guild_settings WHERE guild_id = ?').get(guildId);
            return settings?.audit_log_channel
                ? interaction.guild.channels.cache.get(settings.audit_log_channel)
                : null;
        };

        // Helper: aplicar sanción automática según cantidad de warns
        const checkSanctions = async (member, warnCount) => {
            const config = db.prepare('SELECT warn_mute_threshold, warn_ban_threshold, warn_mute_duration FROM guild_settings WHERE guild_id = ?').get(guildId);
            if (!config) return null;

            const muteAt = config.warn_mute_threshold || 3;
            const banAt  = config.warn_ban_threshold  || 5;
            const muteDuration = config.warn_mute_duration || 3600000;

            if (warnCount >= banAt) {
                await member.ban({ reason: `Sanción automática: alcanzó ${banAt} advertencias.` }).catch(() => null);
                return `🔨 **Baneado automáticamente** por alcanzar \`${banAt}\` advertencias.`;
            }

            if (warnCount >= muteAt) {
                await member.timeout(muteDuration, `Sanción automática: alcanzó ${muteAt} advertencias.`).catch(() => null);
                const mins = muteDuration / 60000;
                return `🔇 **Silenciado automáticamente** por \`${mins} minutos\` al alcanzar \`${muteAt}\` advertencias.`;
            }

            return null;
        };

        // --- ADD ---
        if (sub === 'add') {
            const target = interaction.options.getMember('usuario');
            const reason = interaction.options.getString('razon');

            if (!target) return interaction.editReply({ content: '❌ No se encontró al usuario en este servidor.' });
            if (target.user.bot) return interaction.editReply({ content: '❌ No puedes advertir a un bot.' });
            if (target.id === interaction.user.id) return interaction.editReply({ content: '❌ No puedes advertirte a ti mismo.' });

            db.prepare('INSERT INTO warns (guild_id, user_id, moderator_id, reason, timestamp) VALUES (?, ?, ?, ?, ?)').run(
                guildId, target.id, interaction.user.id, reason, Date.now()
            );

            const totalWarns = db.prepare('SELECT COUNT(*) as count FROM warns WHERE guild_id = ? AND user_id = ?').get(guildId, target.id).count;

            const sanctionMsg = await checkSanctions(target, totalWarns);

            // Notificar al usuario por DM
            try {
                await target.user.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('⚠️ Has recibido una advertencia')
                        .setColor('#E67E22')
                        .addFields(
                            { name: '🏠 Servidor',  value: interaction.guild.name, inline: true },
                            { name: '📋 Motivo',    value: reason,                 inline: true },
                            { name: '📊 Total',     value: `\`${totalWarns}\` advertencias acumuladas`, inline: true }
                        )
                        .setTimestamp()
                    ]
                });
            } catch { /* DMs cerrados */ }

            // Log en canal de auditoría
            const logChannel = getLogChannel();
            if (logChannel) {
                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setTitle('⚠️ Nueva Advertencia')
                        .setColor('#E67E22')
                        .setThumbnail(target.user.displayAvatarURL())
                        .addFields(
                            { name: '👤 Usuario',     value: `${target.user.tag} (${target.id})`, inline: true },
                            { name: '🛡️ Moderador',   value: `${interaction.user.tag}`,           inline: true },
                            { name: '📋 Motivo',      value: reason,                               inline: false },
                            { name: '📊 Total warns', value: `\`${totalWarns}\``,                  inline: true },
                            ...(sanctionMsg ? [{ name: '⚖️ Sanción Aplicada', value: sanctionMsg, inline: false }] : [])
                        )
                        .setTimestamp()
                    ]
                });
            }

            const responseEmbed = new EmbedBuilder()
                .setTitle('✅ Advertencia Registrada')
                .setColor('#E67E22')
                .addFields(
                    { name: '👤 Usuario',     value: `${target.user.tag}`, inline: true },
                    { name: '📊 Warn N°',     value: `\`${totalWarns}\``,  inline: true },
                    { name: '📋 Motivo',      value: reason,               inline: false },
                    ...(sanctionMsg ? [{ name: '⚖️ Sanción', value: sanctionMsg, inline: false }] : [])
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [responseEmbed] });
        }

        // --- LIST ---
        if (sub === 'list') {
            const target = interaction.options.getUser('usuario');
            const warns  = db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC').all(guildId, target.id);

            if (warns.length === 0) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setTitle(`📋 Historial de ${target.username}`)
                        .setDescription('✅ Este usuario no tiene advertencias.')
                        .setColor('#2ECC71')
                        .setThumbnail(target.displayAvatarURL())
                    ]
                });
            }

            const warnList = warns.map(w =>
                `**ID \`#${w.id}\`** — <t:${Math.floor(w.timestamp / 1000)}:d>\n` +
                `> 📋 ${w.reason}\n` +
                `> 🛡️ <@${w.moderator_id}>`
            ).join('\n\n');

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle(`⚠️ Advertencias de ${target.username} (${warns.length})`)
                    .setDescription(warnList.slice(0, 4000))
                    .setColor('#E67E22')
                    .setThumbnail(target.displayAvatarURL())
                    .setFooter({ text: `ID de usuario: ${target.id}` })
                    .setTimestamp()
                ]
            });
        }

        // --- REMOVE ---
        if (sub === 'remove') {
            const warnId = interaction.options.getInteger('id');
            const warn   = db.prepare('SELECT * FROM warns WHERE id = ? AND guild_id = ?').get(warnId, guildId);

            if (!warn) return interaction.editReply({ content: `❌ No existe una advertencia con ID \`#${warnId}\` en este servidor.` });

            db.prepare('DELETE FROM warns WHERE id = ?').run(warnId);

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🗑️ Advertencia Eliminada')
                    .setColor('#2ECC71')
                    .addFields(
                        { name: '🆔 ID',       value: `\`#${warnId}\``,        inline: true },
                        { name: '👤 Usuario',  value: `<@${warn.user_id}>`,     inline: true },
                        { name: '📋 Motivo',   value: warn.reason,              inline: false }
                    )
                    .setTimestamp()
                ]
            });
        }

        // --- CLEAR ---
        if (sub === 'clear') {
            const target = interaction.options.getUser('usuario');
            const count  = db.prepare('SELECT COUNT(*) as count FROM warns WHERE guild_id = ? AND user_id = ?').get(guildId, target.id).count;

            if (count === 0) return interaction.editReply({ content: `✅ ${target.username} no tiene advertencias que limpiar.` });

            db.prepare('DELETE FROM warns WHERE guild_id = ? AND user_id = ?').run(guildId, target.id);

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🧹 Historial Limpiado')
                    .setColor('#2ECC71')
                    .setDescription(`Se eliminaron **${count}** advertencias de ${target}.`)
                    .setTimestamp()
                ]
            });
        }
    }
};