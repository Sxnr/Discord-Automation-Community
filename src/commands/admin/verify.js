const {
    SlashCommandBuilder, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionFlagsBits, MessageFlags
} = require('discord.js');
const db = require('../../database/db');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('✅ Sistema de verificación.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        // setup
        .addSubcommand(s => s
            .setName('setup')
            .setDescription('Configura el sistema de verificación.')
            .addRoleOption(o => o.setName('rol').setDescription('Rol que se otorga al verificarse').setRequired(true))
            .addChannelOption(o => o.setName('canal').setDescription('Canal donde se enviará el panel').setRequired(true))
            .addStringOption(o => o
                .setName('metodo')
                .setDescription('Método de verificación')
                .addChoices(
                    { name: '🔘 Botón (un clic)',        value: 'button'  },
                    { name: '🔢 Código captcha (4 dígitos)', value: 'captcha' },
                )
            )
            .addStringOption(o => o.setName('mensaje').setDescription('Mensaje del panel').setMaxLength(300))
            .addChannelOption(o => o.setName('log_canal').setDescription('Canal de logs de verificaciones'))
        )
        // disable
        .addSubcommand(s => s
            .setName('disable')
            .setDescription('Desactiva el sistema de verificación.')
        )
        // check
        .addSubcommand(s => s
            .setName('check')
            .setDescription('Revisar el estado de verificación de un usuario.')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
        )
        // force
        .addSubcommand(s => s
            .setName('force')
            .setDescription('Verificar manualmente a un usuario.')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
        )
        // unverify
        .addSubcommand(s => s
            .setName('unverify')
            .setDescription('Quitar verificación a un usuario.')
            .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
        ),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        const getSettings = () => {
            db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
            return db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
        };

        // ══════════════════════════════════════════════════════════════════
        // SETUP
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'setup') {
            const rol      = interaction.options.getRole('rol');
            const canal    = interaction.options.getChannel('canal');
            const metodo   = interaction.options.getString('metodo') || 'button';
            const mensaje  = interaction.options.getString('mensaje') || '¡Haz clic en el botón de abajo para verificarte y acceder al servidor!';
            const logCanal = interaction.options.getChannel('log_canal');

            // Guardar config
            db.prepare(`
                UPDATE guild_settings SET
                    verify_enabled = 1,
                    verify_role = ?,
                    verify_channel = ?,
                    verify_method = ?,
                    verify_message = ?,
                    verify_log_channel = ?
                WHERE guild_id = ?
            `).run(rol.id, canal.id, metodo, mensaje, logCanal?.id || null, guildId);

            // Construir embed del panel
            const embed = new EmbedBuilder()
                .setTitle('✅ Verificación')
                .setDescription(mensaje)
                .setColor('#57F287')
                .setFooter({ text: `Método: ${metodo === 'button' ? 'Un clic' : 'Captcha'}` })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`verify_start_${guildId}`)
                    .setLabel('✅ Verificarme')
                    .setStyle(ButtonStyle.Success)
            );

            await canal.send({ embeds: [embed], components: [row] });

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287')
                    .setTitle('✅ Verificación configurada')
                    .addFields(
                        { name: '🎭 Rol',     value: `${rol}`,              inline: true },
                        { name: '📢 Canal',   value: `${canal}`,            inline: true },
                        { name: '🔧 Método',  value: metodo,                inline: true },
                        ...(logCanal ? [{ name: '📋 Log', value: `${logCanal}`, inline: true }] : [])
                    )
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // DISABLE
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'disable') {
            db.prepare('UPDATE guild_settings SET verify_enabled = 0 WHERE guild_id = ?').run(guildId);
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#FEE75C').setDescription('⚠️ Sistema de verificación desactivado.')],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // CHECK
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'check') {
            const target = interaction.options.getUser('usuario');
            const record = db.prepare('SELECT * FROM verifications WHERE guild_id = ? AND user_id = ?').get(guildId, target.id);
            const cfg    = getSettings();
            const member = await interaction.guild.members.fetch(target.id).catch(() => null);
            const hasRole = cfg.verify_role ? member?.roles.cache.has(cfg.verify_role) : false;

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle(`🔍 Verificación de ${target.username}`)
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                    .setColor(hasRole ? '#57F287' : '#ED4245')
                    .addFields(
                        { name: '✅ Estado',   value: hasRole ? '**Verificado**' : '**No verificado**', inline: true },
                        { name: '🔧 Método',  value: record?.method || '_—_',                           inline: true },
                        { name: '📅 Fecha',   value: record?.verified_at ? `<t:${Math.floor(record.verified_at / 1000)}:F>` : '_—_', inline: true },
                    )
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // FORCE
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'force') {
            const target = interaction.options.getUser('usuario');
            const cfg    = getSettings();
            if (!cfg.verify_role) return interaction.reply({ content: '❌ Primero configura la verificación con `/verify setup`.', flags: [MessageFlags.Ephemeral] });

            const member = await interaction.guild.members.fetch(target.id).catch(() => null);
            if (!member) return interaction.reply({ content: '❌ Usuario no encontrado en el servidor.', flags: [MessageFlags.Ephemeral] });

            await member.roles.add(cfg.verify_role).catch(() => null);

            db.prepare(`
                INSERT INTO verifications (guild_id, user_id, status, method, verified_at, timestamp)
                VALUES (?, ?, 'verified', 'manual', ?, ?)
                ON CONFLICT(guild_id, user_id) DO UPDATE SET status = 'verified', method = 'manual', verified_at = ?
            `).run(guildId, target.id, Date.now(), Date.now(), Date.now());

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287')
                    .setDescription(`✅ **${target.username}** verificado manualmente.`)],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // UNVERIFY
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'unverify') {
            const target = interaction.options.getUser('usuario');
            const cfg    = getSettings();
            const member = await interaction.guild.members.fetch(target.id).catch(() => null);

            if (cfg.verify_role) await member?.roles.remove(cfg.verify_role).catch(() => null);

            db.prepare(`
                UPDATE verifications SET status = 'pending' WHERE guild_id = ? AND user_id = ?
            `).run(guildId, target.id);

            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#FEE75C')
                    .setDescription(`✅ Verificación de **${target.username}** removida.`)],
                flags: [MessageFlags.Ephemeral]
            });
        }
    }
};