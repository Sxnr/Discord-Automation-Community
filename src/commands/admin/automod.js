const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../database/db');

module.exports = {
    category: 'admin',
    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('🤖 Configura el sistema de moderación automática.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        .addSubcommand(sub => sub
            .setName('config')
            .setDescription('⚙️ Configura las opciones del automod.')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('🔌 Activar o desactivar el automod').setRequired(true))
            .addChannelOption(opt => opt.setName('log_channel').setDescription('📋 Canal donde se reportan las acciones del automod'))
            .addBooleanOption(opt => opt.setName('anti_spam').setDescription('🚫 Detectar y eliminar spam'))
            .addIntegerOption(opt => opt.setName('spam_limit').setDescription('💬 Mensajes para considerar spam (default: 5)').setMinValue(2).setMaxValue(20))
            .addIntegerOption(opt => opt.setName('spam_interval').setDescription('⏱️ Ventana de tiempo en segundos (default: 5)').setMinValue(2).setMaxValue(30))
            .addBooleanOption(opt => opt.setName('anti_links').setDescription('🔗 Bloquear links externos'))
            .addBooleanOption(opt => opt.setName('anti_invites').setDescription('📩 Bloquear invitaciones de Discord'))
        )
        .addSubcommand(sub => sub
            .setName('badwords')
            .setDescription('🤬 Gestiona la lista de palabras prohibidas.')
            .addStringOption(opt => opt.setName('accion').setDescription('Acción').setRequired(true)
                .addChoices(
                    { name: '➕ Añadir palabra',   value: 'add'   },
                    { name: '➖ Eliminar palabra', value: 'remove' },
                    { name: '📋 Ver lista',        value: 'list'   },
                    { name: '🧹 Limpiar todo',     value: 'clear'  }
                )
            )
            .addStringOption(opt => opt.setName('palabra').setDescription('Palabra a añadir o eliminar'))
        )
        .addSubcommand(sub => sub
            .setName('sanctions')
            .setDescription('⚖️ Configura los umbrales de sanciones automáticas por warns.')
            .addIntegerOption(opt => opt.setName('mute_at').setDescription('🔇 Warns para silenciar (default: 3)').setMinValue(1).setMaxValue(20))
            .addIntegerOption(opt => opt.setName('ban_at').setDescription('🔨 Warns para banear (default: 5)').setMinValue(2).setMaxValue(30))
            .addIntegerOption(opt => opt.setName('mute_duration').setDescription('⏱️ Duración del silencio en minutos (default: 60)').setMinValue(1).setMaxValue(10080))
        )
        .addSubcommand(sub => sub
            .setName('status')
            .setDescription('📊 Muestra la configuración actual del automod.')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);

        // --- CONFIG ---
        if (sub === 'config') {
            const enabled      = interaction.options.getBoolean('enabled');
            const logChannel   = interaction.options.getChannel('log_channel');
            const antiSpam     = interaction.options.getBoolean('anti_spam');
            const spamLimit    = interaction.options.getInteger('spam_limit');
            const spamInterval = interaction.options.getInteger('spam_interval');
            const antiLinks    = interaction.options.getBoolean('anti_links');
            const antiInvites  = interaction.options.getBoolean('anti_invites');

            const changes = [];

            db.prepare('UPDATE guild_settings SET automod_enabled = ? WHERE guild_id = ?').run(enabled ? 1 : 0, guildId);
            changes.push(`- **Automod:** ${enabled ? '`ACTIVADO` ✅' : '`DESACTIVADO` ❌'}`);

            if (logChannel) {
                db.prepare('UPDATE guild_settings SET automod_log_channel = ? WHERE guild_id = ?').run(logChannel.id, guildId);
                changes.push(`- **Canal de logs:** ${logChannel}`);
            }
            if (antiSpam !== null) {
                db.prepare('UPDATE guild_settings SET automod_anti_spam = ? WHERE guild_id = ?').run(antiSpam ? 1 : 0, guildId);
                changes.push(`- **Anti-spam:** ${antiSpam ? '`ACTIVADO` ✅' : '`DESACTIVADO` ❌'}`);
            }
            if (spamLimit) {
                db.prepare('UPDATE guild_settings SET automod_spam_limit = ? WHERE guild_id = ?').run(spamLimit, guildId);
                changes.push(`- **Límite spam:** \`${spamLimit} mensajes\``);
            }
            if (spamInterval) {
                db.prepare('UPDATE guild_settings SET automod_spam_interval = ? WHERE guild_id = ?').run(spamInterval * 1000, guildId);
                changes.push(`- **Intervalo spam:** \`${spamInterval} segundos\``);
            }
            if (antiLinks !== null) {
                db.prepare('UPDATE guild_settings SET automod_anti_links = ? WHERE guild_id = ?').run(antiLinks ? 1 : 0, guildId);
                changes.push(`- **Anti-links:** ${antiLinks ? '`ACTIVADO` ✅' : '`DESACTIVADO` ❌'}`);
            }
            if (antiInvites !== null) {
                db.prepare('UPDATE guild_settings SET automod_anti_invites = ? WHERE guild_id = ?').run(antiInvites ? 1 : 0, guildId);
                changes.push(`- **Anti-invites:** ${antiInvites ? '`ACTIVADO` ✅' : '`DESACTIVADO` ❌'}`);
            }

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('✅ Automod Configurado')
                    .setDescription(changes.join('\n'))
                    .setColor('#2ECC71')
                    .setTimestamp()
                ]
            });
        }

        // --- BADWORDS ---
        if (sub === 'badwords') {
            const accion  = interaction.options.getString('accion');
            const palabra = interaction.options.getString('palabra')?.toLowerCase().trim();
            const config  = db.prepare('SELECT automod_bad_words FROM guild_settings WHERE guild_id = ?').get(guildId);
            let badWords  = JSON.parse(config?.automod_bad_words || '[]');

            if (accion === 'add') {
                if (!palabra) return interaction.editReply({ content: '❌ Debes especificar una palabra.' });
                if (badWords.includes(palabra)) return interaction.editReply({ content: `⚠️ \`${palabra}\` ya está en la lista.` });

                badWords.push(palabra);
                db.prepare('UPDATE guild_settings SET automod_bad_words = ? WHERE guild_id = ?').run(JSON.stringify(badWords), guildId);

                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setTitle('✅ Palabra Añadida')
                        .setDescription(`\`${palabra}\` fue agregada a la lista de palabras prohibidas.\n📊 Total: \`${badWords.length}\` palabras`)
                        .setColor('#2ECC71')
                    ]
                });
            }

            if (accion === 'remove') {
                if (!palabra) return interaction.editReply({ content: '❌ Debes especificar una palabra.' });
                if (!badWords.includes(palabra)) return interaction.editReply({ content: `❌ \`${palabra}\` no está en la lista.` });

                badWords = badWords.filter(w => w !== palabra);
                db.prepare('UPDATE guild_settings SET automod_bad_words = ? WHERE guild_id = ?').run(JSON.stringify(badWords), guildId);

                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setTitle('🗑️ Palabra Eliminada')
                        .setDescription(`\`${palabra}\` fue removida de la lista.\n📊 Total: \`${badWords.length}\` palabras`)
                        .setColor('#E74C3C')
                    ]
                });
            }

            if (accion === 'list') {
                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setTitle(`🤬 Palabras Prohibidas (${badWords.length})`)
                        .setDescription(badWords.length > 0 ? badWords.map(w => `\`${w}\``).join(', ') : '*Lista vacía*')
                        .setColor('#E67E22')
                        .setTimestamp()
                    ]
                });
            }

            if (accion === 'clear') {
                db.prepare("UPDATE guild_settings SET automod_bad_words = '[]' WHERE guild_id = ?").run(guildId);
                return interaction.editReply({ content: `🧹 Se limpiaron **${badWords.length}** palabras de la lista.` });
            }
        }

        // --- SANCTIONS ---
        if (sub === 'sanctions') {
            const muteAt       = interaction.options.getInteger('mute_at');
            const banAt        = interaction.options.getInteger('ban_at');
            const muteDuration = interaction.options.getInteger('mute_duration');

            const changes = [];

            if (muteAt) {
                db.prepare('UPDATE guild_settings SET warn_mute_threshold = ? WHERE guild_id = ?').run(muteAt, guildId);
                changes.push(`- **Silenciar en warn:** \`${muteAt}\``);
            }
            if (banAt) {
                db.prepare('UPDATE guild_settings SET warn_ban_threshold = ? WHERE guild_id = ?').run(banAt, guildId);
                changes.push(`- **Banear en warn:** \`${banAt}\``);
            }
            if (muteDuration) {
                db.prepare('UPDATE guild_settings SET warn_mute_duration = ? WHERE guild_id = ?').run(muteDuration * 60000, guildId);
                changes.push(`- **Duración del mute:** \`${muteDuration} minutos\``);
            }

            if (changes.length === 0) return interaction.editReply({ content: '⚠️ No se envió ningún parámetro para actualizar.' });

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('⚖️ Sanciones Configuradas')
                    .setDescription(changes.join('\n'))
                    .setColor('#9B59B6')
                    .setTimestamp()
                ]
            });
        }

        // --- STATUS ---
        if (sub === 'status') {
            const config = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
            if (!config) return interaction.editReply({ content: '❌ No hay configuración registrada para este servidor.' });

            const on  = '`ACTIVO` ✅';
            const off = '`INACTIVO` ❌';

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('📊 Estado del Automod')
                    .setColor(config.automod_enabled ? '#2ECC71' : '#E74C3C')
                    .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                    .addFields(
                        { name: '🔌 Estado Global',    value: config.automod_enabled ? on : off,                                                                          inline: true  },
                        { name: '📋 Canal de Logs',    value: config.automod_log_channel ? `<#${config.automod_log_channel}>` : '`No configurado`',                       inline: true  },
                        { name: '🚫 Anti-Spam',        value: `${config.automod_anti_spam ? on : off} — \`${config.automod_spam_limit || 5}\` msgs / \`${(config.automod_spam_interval || 5000) / 1000}s\``, inline: false },
                        { name: '🔗 Anti-Links',       value: config.automod_anti_links   ? on : off,                                                                     inline: true  },
                        { name: '📩 Anti-Invites',     value: config.automod_anti_invites ? on : off,                                                                     inline: true  },
                        { name: '🤬 Palabras Bloqueadas', value: `\`${JSON.parse(config.automod_bad_words || '[]').length}\` palabras registradas`,                       inline: false },
                        { name: '⚖️ Sanciones Automáticas', value: `🔇 Mute en warn \`${config.warn_mute_threshold || 3}\` — ${(config.warn_mute_duration || 3600000) / 60000} min\n🔨 Ban en warn \`${config.warn_ban_threshold || 5}\``, inline: false }
                    )
                    .setTimestamp()
                ]
            });
        }
    }
};