const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('xp')
        .setDescription('⚙️ Administra el sistema de XP y niveles.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        .addSubcommand(sub => sub
            .setName('config')
            .setDescription('⚙️ Configura el sistema de XP.')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('🔌 Activar o desactivar el sistema de XP'))
            .addChannelOption(opt => opt.setName('canal_notif').setDescription('📢 Canal donde se anuncian las subidas de nivel'))
            .addIntegerOption(opt => opt.setName('xp_min').setDescription('⬇️ XP mínimo por mensaje').setMinValue(1).setMaxValue(100))
            .addIntegerOption(opt => opt.setName('xp_max').setDescription('⬆️ XP máximo por mensaje').setMinValue(1).setMaxValue(100))
            .addIntegerOption(opt => opt.setName('cooldown').setDescription('⏱️ Segundos entre XP (default: 60)').setMinValue(5).setMaxValue(300))
            .addNumberOption(opt => opt.setName('multiplicador').setDescription('✖️ Multiplicador de XP (default: 1.0)').setMinValue(0.1).setMaxValue(5.0))
        )
        .addSubcommand(sub => sub
            .setName('ignore')
            .setDescription('🚫 Ignorar o des-ignorar un canal para el XP.')
            .addChannelOption(opt => opt.setName('canal').setDescription('📌 Canal a ignorar/des-ignorar').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('role')
            .setDescription('🎭 Asignar un rol recompensa a un nivel.')
            .addIntegerOption(opt => opt.setName('nivel').setDescription('🏅 Nivel en que se otorga el rol').setRequired(true).setMinValue(1))
            .addRoleOption(opt => opt.setName('rol').setDescription('🎭 Rol a otorgar (vacío para eliminar)'))
        )
        .addSubcommand(sub => sub
            .setName('set')
            .setDescription('✏️ Establecer el XP/nivel de un usuario manualmente.')
            .addUserOption(opt => opt.setName('usuario').setDescription('👤 Usuario').setRequired(true))
            .addIntegerOption(opt => opt.setName('xp').setDescription('⭐ XP a establecer').setMinValue(0))
            .addIntegerOption(opt => opt.setName('nivel').setDescription('🏅 Nivel a establecer').setMinValue(0))
        )
        .addSubcommand(sub => sub
            .setName('reset')
            .setDescription('🔄 Resetear el XP de un usuario o de todo el servidor.')
            .addUserOption(opt => opt.setName('usuario').setDescription('👤 Usuario (vacío = resetear todo el servidor)'))
        )
        .addSubcommand(sub => sub
            .setName('status')
            .setDescription('📊 Ver la configuración actual del sistema de XP.')
        )
        .addSubcommand(sub => sub
            .setName('message')
            .setDescription('✏️ Personaliza el mensaje de subida de nivel.')
            .addStringOption(opt => opt
                .setName('mensaje')
                .setDescription('📝 Mensaje personalizado. Variables: {user} {username} {level} {guild}')
            )
            .addStringOption(opt => opt
                .setName('imagen')
                .setDescription('🖼️ URL de imagen o GIF para el embed de subida de nivel')
            )
            .addBooleanOption(opt => opt
                .setName('reset')
                .setDescription('🔄 Restablecer mensaje e imagen por defecto')
            )
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);

        // ════════════════════════════════════════
        // CONFIG
        // ════════════════════════════════════════
        if (sub === 'config') {
            const enabled = interaction.options.getBoolean('enabled');
            const canalNotif = interaction.options.getChannel('canal_notif');
            const xpMin = interaction.options.getInteger('xp_min');
            const xpMax = interaction.options.getInteger('xp_max');
            const cooldown = interaction.options.getInteger('cooldown');
            const multiplier = interaction.options.getNumber('multiplicador');

            const changes = [];

            if (enabled !== null) {
                db.prepare('UPDATE guild_settings SET xp_enabled = ? WHERE guild_id = ?').run(enabled ? 1 : 0, guildId);
                changes.push(`- **XP System:** ${enabled ? '`ACTIVADO` ✅' : '`DESACTIVADO` ❌'}`);
            }
            if (canalNotif) {
                db.prepare('UPDATE guild_settings SET xp_channel = ? WHERE guild_id = ?').run(canalNotif.id, guildId);
                changes.push(`- **Canal notificaciones:** ${canalNotif}`);
            }
            if (xpMin) {
                db.prepare('UPDATE guild_settings SET xp_min = ? WHERE guild_id = ?').run(xpMin, guildId);
                changes.push(`- **XP mínimo:** \`${xpMin}\``);
            }
            if (xpMax) {
                db.prepare('UPDATE guild_settings SET xp_max = ? WHERE guild_id = ?').run(xpMax, guildId);
                changes.push(`- **XP máximo:** \`${xpMax}\``);
            }
            if (cooldown) {
                db.prepare('UPDATE guild_settings SET xp_cooldown = ? WHERE guild_id = ?').run(cooldown, guildId);
                changes.push(`- **Cooldown:** \`${cooldown}s\``);
            }
            if (multiplier !== null) {
                db.prepare('UPDATE guild_settings SET xp_multiplier = ? WHERE guild_id = ?').run(multiplier, guildId);
                changes.push(`- **Multiplicador:** \`x${multiplier}\``);
            }

            if (changes.length === 0) return interaction.editReply({ content: '⚠️ No enviaste ningún parámetro.' });

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('✅ XP Configurado')
                    .setDescription(changes.join('\n'))
                    .setColor('#2ECC71')
                    .setTimestamp()
                ]
            });
        }

        // ════════════════════════════════════════
        // IGNORE CHANNEL
        // ════════════════════════════════════════
        if (sub === 'ignore') {
            const canal = interaction.options.getChannel('canal');
            const config = db.prepare('SELECT xp_ignored_channels FROM guild_settings WHERE guild_id = ?').get(guildId);
            let ignored = JSON.parse(config?.xp_ignored_channels || '[]');

            if (ignored.includes(canal.id)) {
                ignored = ignored.filter(id => id !== canal.id);
                db.prepare('UPDATE guild_settings SET xp_ignored_channels = ? WHERE guild_id = ?').run(JSON.stringify(ignored), guildId);
                return interaction.editReply({ content: `✅ ${canal} **ya no está ignorado** — los usuarios ganarán XP ahí.` });
            } else {
                ignored.push(canal.id);
                db.prepare('UPDATE guild_settings SET xp_ignored_channels = ? WHERE guild_id = ?').run(JSON.stringify(ignored), guildId);
                return interaction.editReply({ content: `🚫 ${canal} **ignorado** — los usuarios no ganarán XP ahí.` });
            }
        }

        // ════════════════════════════════════════
        // ROLE POR NIVEL
        // ════════════════════════════════════════
        if (sub === 'role') {
            const nivel = interaction.options.getInteger('nivel');
            const rol = interaction.options.getRole('rol');
            const config = db.prepare('SELECT xp_level_roles FROM guild_settings WHERE guild_id = ?').get(guildId);
            const roles = JSON.parse(config?.xp_level_roles || '{}');

            if (!rol) {
                delete roles[String(nivel)];
                db.prepare('UPDATE guild_settings SET xp_level_roles = ? WHERE guild_id = ?').run(JSON.stringify(roles), guildId);
                return interaction.editReply({ content: `🗑️ Rol del nivel \`${nivel}\` eliminado.` });
            }

            roles[String(nivel)] = rol.id;
            db.prepare('UPDATE guild_settings SET xp_level_roles = ? WHERE guild_id = ?').run(JSON.stringify(roles), guildId);

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🎭 Rol de Nivel Configurado')
                    .setColor('#9B59B6')
                    .addFields(
                        { name: '🏅 Nivel', value: `\`${nivel}\``, inline: true },
                        { name: '🎭 Rol', value: `${rol}`, inline: true }
                    )
                    .setTimestamp()
                ]
            });
        }

        // ════════════════════════════════════════
        // SET XP/NIVEL
        // ════════════════════════════════════════
        if (sub === 'set') {
            const target = interaction.options.getUser('usuario');
            const xp = interaction.options.getInteger('xp');
            const nivel = interaction.options.getInteger('nivel');

            db.prepare('INSERT OR IGNORE INTO levels (guild_id, user_id, xp, level, messages) VALUES (?, ?, 0, 0, 0)').run(guildId, target.id);

            const changes = [];
            if (xp !== null) {
                db.prepare('UPDATE levels SET xp = ? WHERE guild_id = ? AND user_id = ?').run(xp, guildId, target.id);
                changes.push(`- **XP:** \`${xp}\``);
            }
            if (nivel !== null) {
                db.prepare('UPDATE levels SET level = ? WHERE guild_id = ? AND user_id = ?').run(nivel, guildId, target.id);
                changes.push(`- **Nivel:** \`${nivel}\``);
            }

            if (changes.length === 0) return interaction.editReply({ content: '⚠️ No enviaste ningún valor.' });

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('✏️ XP Actualizado')
                    .setColor('#3498DB')
                    .setDescription(`**Usuario:** ${target}\n${changes.join('\n')}`)
                    .setTimestamp()
                ]
            });
        }

        // ════════════════════════════════════════
        // MESSAGE
        // ════════════════════════════════════════
        if (sub === 'message') {
            const mensaje = interaction.options.getString('mensaje');
            const imagen = interaction.options.getString('imagen');
            const reset = interaction.options.getBoolean('reset');

            if (reset) {
                db.prepare("UPDATE guild_settings SET xp_levelup_msg = '¡Felicitaciones {user}! 🎊 Has alcanzado el nivel **{level}**', xp_levelup_img = NULL WHERE guild_id = ?").run(guildId);
                return interaction.editReply({ content: '🔄 Mensaje e imagen restablecidos por defecto.' });
            }

            const changes = [];

            if (mensaje) {
                db.prepare('UPDATE guild_settings SET xp_levelup_msg = ? WHERE guild_id = ?').run(mensaje, guildId);
                changes.push(`- **Mensaje:** \`${mensaje}\``);
            }
            if (imagen) {
                db.prepare('UPDATE guild_settings SET xp_levelup_img = ? WHERE guild_id = ?').run(imagen, guildId);
                changes.push(`- **Imagen:** [Ver imagen](${imagen})`);
            }

            if (changes.length === 0) {
                // Mostrar configuración actual
                const config = db.prepare('SELECT xp_levelup_msg, xp_levelup_img FROM guild_settings WHERE guild_id = ?').get(guildId);
                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setTitle('✏️ Mensaje de Subida de Nivel')
                        .setColor('#F1C40F')
                        .addFields(
                            { name: '📝 Mensaje actual', value: `\`${config?.xp_levelup_msg || 'Default'}\``, inline: false },
                            { name: '🖼️ Imagen actual', value: config?.xp_levelup_img ? `[Ver imagen](${config.xp_levelup_img})` : '`Sin imagen`', inline: false },
                            {
                                name: '📌 Variables disponibles', value:
                                    '`{user}` — Mención del usuario\n' +
                                    '`{username}` — Nombre del usuario\n' +
                                    '`{level}` — Nuevo nivel alcanzado\n' +
                                    '`{guild}` — Nombre del servidor',
                                inline: false
                            }
                        )
                        .setTimestamp()
                    ]
                });
            }

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('✅ Mensaje Actualizado')
                    .setColor('#2ECC71')
                    .setDescription(changes.join('\n'))
                    .addFields({
                        name: '📌 Variables disponibles',
                        value:
                            '`{user}` — Mención del usuario\n' +
                            '`{username}` — Nombre del usuario\n' +
                            '`{level}` — Nuevo nivel alcanzado\n' +
                            '`{guild}` — Nombre del servidor',
                        inline: false
                    })
                    .setTimestamp()
                ]
            });
        }

        // ════════════════════════════════════════
        // RESET
        // ════════════════════════════════════════
        if (sub === 'reset') {
            const target = interaction.options.getUser('usuario');

            if (target) {
                db.prepare('DELETE FROM levels WHERE guild_id = ? AND user_id = ?').run(guildId, target.id);
                return interaction.editReply({ content: `🔄 XP de **${target.username}** reseteado correctamente.` });
            } else {
                db.prepare('DELETE FROM levels WHERE guild_id = ?').run(guildId);
                return interaction.editReply({ content: `🔄 XP de **todos los usuarios** del servidor reseteado correctamente.` });
            }
        }

        // ════════════════════════════════════════
        // STATUS
        // ════════════════════════════════════════
        if (sub === 'status') {
            const config = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
            const totalUsers = db.prepare('SELECT COUNT(*) as count FROM levels WHERE guild_id = ?').get(guildId).count;
            const ignored = JSON.parse(config?.xp_ignored_channels || '[]');
            const levelRoles = JSON.parse(config?.xp_level_roles || '{}');

            const levelRolesText = Object.entries(levelRoles).length > 0
                ? Object.entries(levelRoles).map(([lvl, roleId]) => `> Nivel \`${lvl}\` → <@&${roleId}>`).join('\n')
                : '*Sin roles configurados*';

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('📊 Estado del Sistema de XP')
                    .setColor(config?.xp_enabled ? '#2ECC71' : '#E74C3C')
                    .setThumbnail(interaction.guild.iconURL())
                    .addFields(
                        { name: '🔌 Estado', value: config?.xp_enabled ? '`ACTIVO` ✅' : '`INACTIVO` ❌', inline: true },
                        { name: '👥 Usuarios rankeados', value: `\`${totalUsers}\``, inline: true },
                        { name: '📢 Canal notif.', value: config?.xp_channel ? `<#${config.xp_channel}>` : '`Canal actual`', inline: true },
                        { name: '⭐ XP por mensaje', value: `\`${config?.xp_min || 15}\` — \`${config?.xp_max || 25}\` XP`, inline: true },
                        { name: '⏱️ Cooldown', value: `\`${config?.xp_cooldown || 60} segundos\``, inline: true },
                        { name: '✖️ Multiplicador', value: `\`x${config?.xp_multiplier || 1.0}\``, inline: true },
                        { name: '🚫 Canales ignorados', value: ignored.length > 0 ? ignored.map(id => `<#${id}>`).join(', ') : '*Ninguno*', inline: false },
                        { name: '🎭 Roles por Nivel', value: levelRolesText, inline: false }
                    )
                    .setTimestamp()
                ]
            });
        }
    }
};