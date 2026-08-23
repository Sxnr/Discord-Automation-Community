const {
    SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags
} = require('discord.js');
const db = require('../../database/db');
const { analyzeText, AI_ENABLED } = require('../../utils/aiModeration');
const { brandFooter } = require('../../utils/embeds');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('aimod')
        .setDescription('🧠 Configura la moderación automática por Inteligencia Artificial.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        .addSubcommand(sub => sub
            .setName('setup')
            .setDescription('⚙️ Activa y configura la moderación por IA.')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('🔌 Activar la moderación por IA').setRequired(true))
            .addStringOption(opt => opt.setName('accion').setDescription('🛡️ Qué hacer con el contenido tóxico').setRequired(true)
                .addChoices(
                    { name: '📝 Solo registrar (log)', value: 'log' },
                    { name: '🗑️ Eliminar mensaje',    value: 'delete' },
                    { name: '⚠️ Advertir (warn)',      value: 'warn' },
                    { name: '🔇 Silenciar (timeout)',  value: 'timeout' },
                ))
            .addIntegerOption(opt => opt.setName('umbral').setDescription('🎯 Permisividad 1-100 (mayor = más permisivo). Se guarda como %').setMinValue(1).setMaxValue(100).setRequired(true))
            .addChannelOption(opt => opt.setName('log_channel').setDescription('📋 Canal de logs de la IA'))
            .addStringOption(opt => opt.setName('ignorar_roles').setDescription('🆔 IDs de roles a ignorar, separados por coma').setRequired(false))
        )

        .addSubcommand(sub => sub
            .setName('disable')
            .setDescription('🔌 Desactiva la moderación por IA.')
        )

        .addSubcommand(sub => sub
            .setName('status')
            .setDescription('📊 Muestra la configuración actual de la IA.')
        )

        .addSubcommand(sub => sub
            .setName('test')
            .setDescription('🔍 Prueba el análisis de un texto sin aplicar sanciones.')
            .addStringOption(opt => opt.setName('texto').setDescription('Texto a analizar').setRequired(true))
        ),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        db.prepare('INSERT OR IGNORE INTO ai_mod_settings (guild_id) VALUES (?)').run(guildId);

        // ── SETUP ──
        if (sub === 'setup') {
            const enabled = interaction.options.getBoolean('enabled');
            const logCh   = interaction.options.getChannel('log_channel');
            const action  = interaction.options.getString('accion');
            const umbral  = interaction.options.getInteger('umbral');
            const ignore  = interaction.options.getString('ignorar_roles');

            db.prepare(`
                UPDATE ai_mod_settings
                SET enabled = ?, log_channel = ?, action = ?, threshold = ?, ignore_roles = ?
                WHERE guild_id = ?
            `).run(
                enabled ? 1 : 0,
                logCh?.id ?? null,
                action,
                umbral / 100,
                ignore ? JSON.stringify(ignore.split(',').map(r => r.trim()).filter(Boolean)) : '[]',
                guildId
            );

            const embed = new EmbedBuilder()
                .setTitle('🧠 Moderación por IA Configurada')
                .setColor(enabled ? '#2ECC71' : '#E74C3C')
                .addFields(
                    { name: '🔌 Estado', value: enabled ? '`ACTIVADO` ✅' : '`DESACTIVADO` ❌', inline: true },
                    { name: '🛡️ Acción', value: `\`${action}\``, inline: true },
                    { name: '🎯 Permisividad', value: `\`${umbral}%\``, inline: true },
                    { name: '📋 Logs', value: logCh ? `${logCh}` : '`No configurado`', inline: true },
                    { name: '🤖 Motor', value: AI_ENABLED ? '`LLM (API Key)` 🚀' : '`Heurística` ⚠️ (sin API key)', inline: false },
                )
                .setTimestamp()
                .setFooter({ text: `${interaction.client.user.username} • ${AI_ENABLED ? 'LLM activo' : 'Heurística (define AI_API_KEY)'} • /help`, iconURL: interaction.client.user.displayAvatarURL() });

            return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
        }

        // ── DISABLE ──
        if (sub === 'disable') {
            db.prepare('UPDATE ai_mod_settings SET enabled = 0 WHERE guild_id = ?').run(guildId);
            return interaction.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C').setDescription('🔌 Moderación por IA **desactivada**.')], flags: [MessageFlags.Ephemeral] });
        }

        // ── STATUS ──
        if (sub === 'status') {
            const cfg = db.prepare('SELECT * FROM ai_mod_settings WHERE guild_id = ?').get(guildId);
            if (!cfg) return interaction.reply({ content: '❌ No hay configuración de IA para este servidor.', flags: [MessageFlags.Ephemeral] });

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🧠 Estado de la Moderación por IA')
                    .setColor(cfg.enabled ? '#2ECC71' : '#E74C3C')
                    .addFields(
                        { name: '🔌 Estado', value: cfg.enabled ? '`ACTIVO` ✅' : '`INACTIVO` ❌', inline: true },
                        { name: '🛡️ Acción', value: `\`${cfg.action}\``, inline: true },
                        { name: '🎯 Permisividad', value: `\`${(cfg.threshold * 100).toFixed(0)}%\``, inline: true },
                        { name: '📋 Logs', value: cfg.log_channel ? `<#${cfg.log_channel}>` : '`No configurado`', inline: true },
                        { name: '🤖 Motor', value: AI_ENABLED ? '`LLM` 🚀' : '`Heurística` ⚠️', inline: true },
                        { name: '🆔 Roles ignorados', value: `${JSON.parse(cfg.ignore_roles || '[]').length} rol(es)`, inline: true },
                    )
                    .setTimestamp()
                    .setFooter(brandFooter(interaction.client))
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ── TEST ──
        if (sub === 'test') {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
            const texto = interaction.options.getString('texto');
            const result = await analyzeText(texto);

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🔍 Resultado del Análisis')
                    .setColor(result.toxic ? '#E74C3C' : '#2ECC71')
                    .addFields(
                        { name: '📄 Texto', value: texto.slice(0, 1000), inline: false },
                        { name: '🚨 Tóxico', value: result.toxic ? '`SÍ`' : '`NO`', inline: true },
                        { name: '📊 Score', value: `\`${result.score}\``, inline: true },
                        { name: '🏷️ Categorías', value: result.categories.length ? result.categories.map(c => `\`${c}\``).join(', ') : '`ninguna`', inline: true },
                        { name: '🤖 Motor', value: `\`${result.method}\``, inline: true },
                        { name: '📝 Razón', value: result.reason, inline: false },
                    )
                    .setTimestamp()
                    .setFooter(brandFooter(interaction.client))
                ]
            });
        }
    }
};
