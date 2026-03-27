const {
    SlashCommandBuilder, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    MessageFlags
} = require('discord.js');
const db = require('../../database/db');
const { checkAndUnlock } = require('./achievements');

// ── Tipos de mascotas ──────────────────────────────────────────────────────
const PET_TYPES = {
    gato:    { emoji: '🐱', name: 'Gato',    price: 500,   hunger_rate: 8,  happy_rate: 6  },
    perro:   { emoji: '🐶', name: 'Perro',   price: 500,   hunger_rate: 10, happy_rate: 8  },
    conejo:  { emoji: '🐰', name: 'Conejo',  price: 750,   hunger_rate: 7,  happy_rate: 7  },
    pato:    { emoji: '🐥', name: 'Pato',    price: 400,   hunger_rate: 6,  happy_rate: 5  },
    zorro:   { emoji: '🦊', name: 'Zorro',   price: 1200,  hunger_rate: 9,  happy_rate: 7  },
    dragon:  { emoji: '🐲', name: 'Dragón',  price: 5000,  hunger_rate: 12, happy_rate: 10 },
    pingüino:{ emoji: '🐧', name: 'Pingüino',price: 1500,  hunger_rate: 7,  happy_rate: 9  },
    hamster: { emoji: '🐹', name: 'Hámster', price: 300,   hunger_rate: 5,  happy_rate: 6  },
};

// ── XP para subir de nivel ─────────────────────────────────────────────────
function xpForLevel(level) {
    return 50 * Math.pow(level, 1.4);
}

// ── Degradar stats con el tiempo ──────────────────────────────────────────
function applyDecay(pet) {
    const now      = Date.now();
    const hoursOld = (now - Math.max(pet.last_feed, pet.last_play, pet.born_at)) / 3600000;
    const type     = PET_TYPES[pet.type];
    if (!type) return pet;

    const hungerDecay  = Math.floor(hoursOld * type.hunger_rate);
    const happyDecay   = Math.floor(hoursOld * type.happy_rate);
    const energyDecay  = Math.floor(hoursOld * 4);

    return {
        ...pet,
        hunger:    Math.max(0, pet.hunger    - hungerDecay),
        happiness: Math.max(0, pet.happiness - happyDecay),
        energy:    Math.max(0, pet.energy    - energyDecay),
        health:    pet.hunger - hungerDecay <= 0 ? Math.max(0, pet.health - 10) : pet.health,
    };
}

function getPet(guildId, userId) {
    return db.prepare('SELECT * FROM pets WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

function getSettings(guildId) {
    db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
    return db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
}

function getEconomy(guildId, userId) {
    db.prepare('INSERT OR IGNORE INTO economy (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
    return db.prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

function fmt(guildId, amount) {
    const s     = getSettings(guildId);
    const emoji = s?.economy_currency_emoji || '💰';
    const name  = s?.economy_currency       || 'coins';
    return `${emoji} **${amount.toLocaleString('es-CL')}** ${name}`;
}

// ── Barra de estado ────────────────────────────────────────────────────────
function statBar(value, max = 100) {
    const pct    = Math.round((value / max) * 10);
    const filled = Math.max(0, Math.min(10, pct));
    const color  = value >= 70 ? '🟩' : value >= 40 ? '🟨' : '🟥';
    return color.repeat(filled) + '⬛'.repeat(10 - filled) + ` **${value}**`;
}

function moodEmoji(pet) {
    const avg = (pet.hunger + pet.happiness + pet.health + pet.energy) / 4;
    if (!pet.alive) return '💀';
    if (avg >= 80)  return '😄';
    if (avg >= 60)  return '😊';
    if (avg >= 40)  return '😐';
    if (avg >= 20)  return '😢';
    return '😱';
}

function msToTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}

// ── Cooldowns ──────────────────────────────────────────────────────────────
const COOLDOWNS = {
    feed:  1800000,  // 30 min
    play:  3600000,  // 1h
    sleep: 7200000,  // 2h
    heal:  14400000, // 4h
};

// ══════════════════════════════════════════════════════════════════════════════
module.exports = {
    category: 'economy',
    data: new SlashCommandBuilder()
        .setName('pet')
        .setDescription('🐾 Sistema de mascotas virtuales.')

        // adopt
        .addSubcommand(s => s
            .setName('adopt')
            .setDescription('Adopta una mascota (se descuenta de tu cartera).')
            .addStringOption(o => o
                .setName('tipo')
                .setDescription('Tipo de mascota')
                .setRequired(true)
                .addChoices(...Object.entries(PET_TYPES).map(([k, v]) => ({
                    name: `${v.emoji} ${v.name} — ${v.price} coins`,
                    value: k
                })))
            )
            .addStringOption(o => o
                .setName('nombre')
                .setDescription('Nombre de tu mascota')
                .setRequired(true)
                .setMaxLength(20)
            )
        )
        // status
        .addSubcommand(s => s
            .setName('status')
            .setDescription('Ver el estado de tu mascota.')
            .addUserOption(o => o.setName('usuario').setDescription('Ver mascota de otro usuario'))
        )
        // feed
        .addSubcommand(s => s
            .setName('feed')
            .setDescription('Darle de comer a tu mascota (+30 hambre, +10 felicidad).')
        )
        // play
        .addSubcommand(s => s
            .setName('play')
            .setDescription('Jugar con tu mascota (+30 felicidad, -20 energía).')
        )
        // sleep
        .addSubcommand(s => s
            .setName('sleep')
            .setDescription('Hacer dormir a tu mascota (+50 energía, +10 salud).')
        )
        // heal
        .addSubcommand(s => s
            .setName('heal')
            .setDescription('Curar a tu mascota (+40 salud). Cuesta coins.')
        )
        // rename
        .addSubcommand(s => s
            .setName('rename')
            .setDescription('Cambiar el nombre de tu mascota.')
            .addStringOption(o => o
                .setName('nombre')
                .setDescription('Nuevo nombre')
                .setRequired(true)
                .setMaxLength(20)
            )
        )
        // release
        .addSubcommand(s => s
            .setName('release')
            .setDescription('Soltar/eliminar tu mascota actual.')
        )
        // shop
        .addSubcommand(s => s
            .setName('shop')
            .setDescription('Ver los tipos de mascotas disponibles y sus precios.')
        )
        // leaderboard
        .addSubcommand(s => s
            .setName('leaderboard')
            .setDescription('Ranking de mascotas más fuertes del servidor.')
        ),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const userId  = interaction.user.id;

        // ══════════════════════════════════════════════════════════════════
        // SHOP
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'shop') {
            const lines = Object.entries(PET_TYPES).map(([k, v]) =>
                `${v.emoji} **${v.name}** · \`${k}\`\n` +
                `💰 Precio: **${v.price.toLocaleString('es-CL')} coins**\n` +
                `🍖 Hambre: ${v.hunger_rate}/h · 😊 Felicidad: ${v.happy_rate}/h`
            );

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('🐾 Tienda de Mascotas')
                    .setColor('#FF9800')
                    .setDescription(lines.join('\n\n'))
                    .setFooter({ text: 'Usa /pet adopt <tipo> <nombre> para adoptar.' })
                ]
            });
        }

        // ══════════════════════════════════════════════════════════════════
        // ADOPT
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'adopt') {
            const existing = getPet(guildId, userId);
            if (existing) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setDescription(`❌ Ya tienes una mascota: **${existing.emoji} ${existing.name}**.\nUsa \`/pet release\` primero si quieres adoptar otra.`)],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const tipo   = interaction.options.getString('tipo');
            const nombre = interaction.options.getString('nombre');
            const type   = PET_TYPES[tipo];

            if (!type) return interaction.reply({ content: '❌ Tipo de mascota inválido.', flags: [MessageFlags.Ephemeral] });

            const eco = getEconomy(guildId, userId);
            if (eco.wallet < type.price) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setDescription(`❌ No tienes suficiente.\nNecesitas ${fmt(guildId, type.price)}, tienes ${fmt(guildId, eco.wallet)}.`)],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Cobrar
            db.prepare('UPDATE economy SET wallet = wallet - ?, total_spent = total_spent + ? WHERE guild_id = ? AND user_id = ?')
                .run(type.price, type.price, guildId, userId);

            // Crear mascota
            db.prepare(`
                INSERT INTO pets (guild_id, user_id, name, type, emoji, hunger, happiness, health, energy, level, xp, last_feed, last_play, last_sleep, last_heal, alive, born_at)
                VALUES (?, ?, ?, ?, ?, 100, 100, 100, 100, 1, 0, ?, ?, ?, ?, 1, ?)
            `).run(guildId, userId, nombre, tipo, type.emoji, Date.now(), Date.now(), Date.now(), Date.now(), Date.now());

            checkAndUnlock(guildId, userId, 'has_pet', 1, interaction.client);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle(`${type.emoji} ¡Adoptaste a ${nombre}!`)
                    .setDescription(
                        `Tu nueva mascota está feliz de conocerte.\n\n` +
                        `> **Tipo:** ${type.name}\n` +
                        `> **Precio pagado:** ${fmt(guildId, type.price)}\n` +
                        `> **Estado inicial:** 💛 Perfecto`
                    )
                    .setFooter({ text: 'Cuídala bien con /pet feed, /pet play y /pet sleep.' })
                    .setTimestamp()
                ]
            });
        }

        // ── Verificar que exista mascota para el resto de subcommands ─────
        if (!['adopt', 'shop', 'leaderboard'].includes(sub)) {
            const rawPet = sub === 'status'
                ? getPet(guildId, (interaction.options.getUser('usuario') || interaction.user).id)
                : getPet(guildId, userId);

            if (!rawPet) {
                const target = sub === 'status' ? (interaction.options.getUser('usuario') || interaction.user) : interaction.user;
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245')
                        .setDescription(`❌ **${target.username}** no tiene una mascota.\nUsa \`/pet adopt\` para adoptar una.`)],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Aplicar decay y guardar en DB
            const pet = applyDecay(rawPet);
            db.prepare(`
                UPDATE pets SET hunger = ?, happiness = ?, health = ?, energy = ?, alive = ?
                WHERE guild_id = ? AND user_id = ?
            `).run(
                pet.hunger, pet.happiness, pet.health, pet.energy,
                pet.health > 0 && pet.hunger > 0 ? 1 : 0,
                guildId, sub === 'status'
                    ? (interaction.options.getUser('usuario') || interaction.user).id
                    : userId
            );

            // ══════════════════════════════════════════════════════════════
            // STATUS
            // ══════════════════════════════════════════════════════════════
            if (sub === 'status') {
                const target = interaction.options.getUser('usuario') || interaction.user;
                const nextXP = Math.floor(xpForLevel(pet.level));
                const xpBar  = (() => {
                    const pct    = Math.min(pet.xp / nextXP, 1);
                    const filled = Math.round(pct * 10);
                    return '█'.repeat(filled) + '░'.repeat(10 - filled);
                })();

                const age = Math.floor((Date.now() - pet.born_at) / 86400000);

                const embed = new EmbedBuilder()
                    .setTitle(`${pet.emoji} ${pet.name} ${moodEmoji(pet)}`)
                    .setColor(pet.alive ? '#FF9800' : '#36393F')
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                    .setDescription(
                        pet.alive
                            ? `Mascota de **${target.username}** · ${PET_TYPES[pet.type]?.name || pet.type}`
                            : `💀 **${pet.name} ha fallecido.** Usa \`/pet release\` para soltar.`
                    )
                    .addFields(
                        { name: '🍖 Hambre',      value: statBar(pet.hunger),    inline: true  },
                        { name: '😊 Felicidad',   value: statBar(pet.happiness), inline: true  },
                        { name: '\u200b',          value: '\u200b',               inline: true  },
                        { name: '❤️ Salud',       value: statBar(pet.health),    inline: true  },
                        { name: '⚡ Energía',     value: statBar(pet.energy),    inline: true  },
                        { name: '\u200b',          value: '\u200b',               inline: true  },
                        {
                            name: `⭐ Nivel ${pet.level}`,
                            value: `\`${xpBar}\` ${pet.xp}/${nextXP} XP`,
                            inline: false
                        },
                        { name: '📅 Edad', value: `${age} día(s)`, inline: true },
                    )
                    .setFooter({ text: `Dueño: ${target.tag}` })
                    .setTimestamp();

                // Botones de acciones rápidas solo si es tu propia mascota
                if (target.id === userId && pet.alive) {
                    const now = Date.now();
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`pet_feed_${userId}`)
                            .setLabel('🍖 Alimentar')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(now - rawPet.last_feed < COOLDOWNS.feed),
                        new ButtonBuilder()
                            .setCustomId(`pet_play_${userId}`)
                            .setLabel('🎮 Jugar')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(now - rawPet.last_play < COOLDOWNS.play),
                        new ButtonBuilder()
                            .setCustomId(`pet_sleep_${userId}`)
                            .setLabel('💤 Dormir')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(now - rawPet.last_sleep < COOLDOWNS.sleep),
                    );
                    return interaction.reply({ embeds: [embed], components: [row] });
                }

                return interaction.reply({ embeds: [embed] });
            }

            // ══════════════════════════════════════════════════════════════
            // FEED
            // ══════════════════════════════════════════════════════════════
            if (sub === 'feed') {
                if (!pet.alive) return interaction.reply({ content: `💀 **${pet.name}** ya falleció.`, flags: [MessageFlags.Ephemeral] });

                const elapsed = Date.now() - rawPet.last_feed;
                if (elapsed < COOLDOWNS.feed) {
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('#ED4245')
                            .setDescription(`⏳ **${pet.name}** aún no tiene hambre. Vuelve en **${msToTime(COOLDOWNS.feed - elapsed)}**.`)],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                const newHunger    = Math.min(100, pet.hunger + 30);
                const newHappiness = Math.min(100, pet.happiness + 10);
                const xpGain       = 5;
                const newXP        = pet.xp + xpGain;
                let   newLevel     = pet.level;
                let   levelUp      = false;

                if (newXP >= Math.floor(xpForLevel(pet.level))) {
                    newLevel++;
                    levelUp = true;
                }

                db.prepare(`
                    UPDATE pets SET hunger = ?, happiness = ?, xp = ?, level = ?, last_feed = ?
                    WHERE guild_id = ? AND user_id = ?
                `).run(newHunger, newHappiness, newXP, newLevel, Date.now(), guildId, userId);

                if (levelUp) checkAndUnlock(guildId, userId, 'pet_level', newLevel, interaction.client);

                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#57F287')
                        .setTitle(`🍖 ¡${pet.name} comió!`)
                        .setDescription(
                            `**${pet.emoji} ${pet.name}** está satisfecho.\n\n` +
                            `🍖 Hambre: ${pet.hunger} → **${newHunger}** (+30)\n` +
                            `😊 Felicidad: ${pet.happiness} → **${newHappiness}** (+10)\n` +
                            `⭐ XP: +${xpGain}` +
                            (levelUp ? `\n\n🎉 **¡Subió al nivel ${newLevel}!**` : '')
                        )
                        .setFooter({ text: `Próxima comida en ${msToTime(COOLDOWNS.feed)}` })
                        .setTimestamp()
                    ]
                });
            }

            // ══════════════════════════════════════════════════════════════
            // PLAY
            // ══════════════════════════════════════════════════════════════
            if (sub === 'play') {
                if (!pet.alive) return interaction.reply({ content: `💀 **${pet.name}** ya falleció.`, flags: [MessageFlags.Ephemeral] });

                const elapsed = Date.now() - rawPet.last_play;
                if (elapsed < COOLDOWNS.play) {
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('#ED4245')
                            .setDescription(`⏳ **${pet.name}** está cansado de jugar. Vuelve en **${msToTime(COOLDOWNS.play - elapsed)}**.`)],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                if (pet.energy < 20) {
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('#FEE75C')
                            .setDescription(`😴 **${pet.name}** está muy cansado para jugar. Usa \`/pet sleep\` primero.`)],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                const newHappiness = Math.min(100, pet.happiness + 30);
                const newEnergy    = Math.max(0, pet.energy - 20);
                const xpGain       = 8;
                const newXP        = pet.xp + xpGain;
                let   newLevel     = pet.level;
                let   levelUp      = false;

                if (newXP >= Math.floor(xpForLevel(pet.level))) {
                    newLevel++;
                    levelUp = true;
                }

                db.prepare(`
                    UPDATE pets SET happiness = ?, energy = ?, xp = ?, level = ?, last_play = ?
                    WHERE guild_id = ? AND user_id = ?
                `).run(newHappiness, newEnergy, newXP, newLevel, Date.now(), guildId, userId);

                if (levelUp) checkAndUnlock(guildId, userId, 'pet_level', newLevel, interaction.client);

                const PLAY_PHRASES = [
                    `jugó a buscar la pelota`, `persiguió su cola`, `hizo trucos increíbles`,
                    `jugó con un ovillo de lana`, `corrió por todo el cuarto`, `saltó sobre los cojines`,
                ];
                const phrase = PLAY_PHRASES[Math.floor(Math.random() * PLAY_PHRASES.length)];

                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle(`🎮 ¡${pet.name} jugó!`)
                        .setDescription(
                            `**${pet.emoji} ${pet.name}** ${phrase}.\n\n` +
                            `😊 Felicidad: ${pet.happiness} → **${newHappiness}** (+30)\n` +
                            `⚡ Energía: ${pet.energy} → **${newEnergy}** (-20)\n` +
                            `⭐ XP: +${xpGain}` +
                            (levelUp ? `\n\n🎉 **¡Subió al nivel ${newLevel}!**` : '')
                        )
                        .setFooter({ text: `Próximo juego en ${msToTime(COOLDOWNS.play)}` })
                        .setTimestamp()
                    ]
                });
            }

            // ══════════════════════════════════════════════════════════════
            // SLEEP
            // ══════════════════════════════════════════════════════════════
            if (sub === 'sleep') {
                if (!pet.alive) return interaction.reply({ content: `💀 **${pet.name}** ya falleció.`, flags: [MessageFlags.Ephemeral] });

                const elapsed = Date.now() - rawPet.last_sleep;
                if (elapsed < COOLDOWNS.sleep) {
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('#ED4245')
                            .setDescription(`⏳ **${pet.name}** aún no necesita dormir. Vuelve en **${msToTime(COOLDOWNS.sleep - elapsed)}**.`)],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                const newEnergy = Math.min(100, pet.energy + 50);
                const newHealth = Math.min(100, pet.health + 10);
                const xpGain    = 3;
                const newXP     = pet.xp + xpGain;

                db.prepare(`
                    UPDATE pets SET energy = ?, health = ?, xp = ?, last_sleep = ?
                    WHERE guild_id = ? AND user_id = ?
                `).run(newEnergy, newHealth, newXP, Date.now(), guildId, userId);

                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#9C27B0')
                        .setTitle(`💤 ¡${pet.name} durmió!`)
                        .setDescription(
                            `**${pet.emoji} ${pet.name}** descansó bien.\n\n` +
                            `⚡ Energía: ${pet.energy} → **${newEnergy}** (+50)\n` +
                            `❤️ Salud: ${pet.health} → **${newHealth}** (+10)\n` +
                            `⭐ XP: +${xpGain}`
                        )
                        .setFooter({ text: `Próxima siesta en ${msToTime(COOLDOWNS.sleep)}` })
                        .setTimestamp()
                    ]
                });
            }

            // ══════════════════════════════════════════════════════════════
            // HEAL
            // ══════════════════════════════════════════════════════════════
            if (sub === 'heal') {
                const elapsed = Date.now() - rawPet.last_heal;
                if (elapsed < COOLDOWNS.heal) {
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('#ED4245')
                            .setDescription(`⏳ Ya curaste a **${pet.name}** recientemente. Vuelve en **${msToTime(COOLDOWNS.heal - elapsed)}**.`)],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                if (pet.health >= 100) {
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('#57F287')
                            .setDescription(`✅ **${pet.name}** ya tiene salud al máximo.`)],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                const healCost = 150;
                const eco      = getEconomy(guildId, userId);
                if (eco.wallet < healCost) {
                    return interaction.reply({
                        embeds: [new EmbedBuilder().setColor('#ED4245')
                            .setDescription(`❌ Curar cuesta ${fmt(guildId, healCost)}. Tienes ${fmt(guildId, eco.wallet)}.`)],
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                const newHealth = Math.min(100, pet.health + 40);
                const newAlive  = newHealth > 0 ? 1 : 0;

                db.prepare('UPDATE economy SET wallet = wallet - ? WHERE guild_id = ? AND user_id = ?')
                    .run(healCost, guildId, userId);
                db.prepare(`
                    UPDATE pets SET health = ?, alive = ?, last_heal = ? WHERE guild_id = ? AND user_id = ?
                `).run(newHealth, newAlive, Date.now(), guildId, userId);

                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#57F287')
                        .setTitle(`💊 ¡${pet.name} fue curado!`)
                        .setDescription(
                            `❤️ Salud: ${pet.health} → **${newHealth}** (+40)\n` +
                            `💰 Costo: ${fmt(guildId, healCost)}` +
                            (newAlive && !rawPet.alive ? '\n\n🎉 **¡Tu mascota ha revivido!**' : '')
                        )
                        .setTimestamp()
                    ]
                });
            }

            // ══════════════════════════════════════════════════════════════
            // RENAME
            // ══════════════════════════════════════════════════════════════
            if (sub === 'rename') {
                const nombre = interaction.options.getString('nombre');
                const old    = pet.name;
                db.prepare('UPDATE pets SET name = ? WHERE guild_id = ? AND user_id = ?').run(nombre, guildId, userId);

                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#57F287')
                        .setDescription(`✅ Tu mascota ahora se llama **${pet.emoji} ${nombre}** (antes: *${old}*).`)],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // ══════════════════════════════════════════════════════════════
            // RELEASE
            // ══════════════════════════════════════════════════════════════
            if (sub === 'release') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`pet_release_confirm_${userId}`)
                        .setLabel(`Sí, soltar a ${pet.name}`)
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`pet_release_cancel_${userId}`)
                        .setLabel('Cancelar')
                        .setStyle(ButtonStyle.Secondary),
                );

                return interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#ED4245')
                        .setTitle(`⚠️ ¿Soltar a ${pet.emoji} ${pet.name}?`)
                        .setDescription(
                            `Esta acción es **irreversible**.\n` +
                            `Tu mascota de nivel **${pet.level}** será eliminada permanentemente.\n\n` +
                            `_No se reembolsa el costo de adopción._`
                        )
                    ],
                    components: [row],
                    flags: [MessageFlags.Ephemeral]
                });
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // LEADERBOARD
        // ══════════════════════════════════════════════════════════════════
        if (sub === 'leaderboard') {
            await interaction.deferReply();

            const top = db.prepare(`
                SELECT * FROM pets WHERE guild_id = ? AND alive = 1
                ORDER BY level DESC, xp DESC LIMIT 10
            `).all(guildId);

            if (!top.length) return interaction.editReply({ content: '❌ No hay mascotas en el servidor aún.' });

            const medals = ['🥇','🥈','🥉'];
            const lines  = await Promise.all(top.map(async (p, i) => {
                const user = await interaction.client.users.fetch(p.user_id).catch(() => null);
                const name = user?.username || `Usuario (${p.user_id.slice(0,6)})`;
                const icon = medals[i] || `**${i + 1}.**`;
                return `${icon} ${p.emoji} **${p.name}** (Nv. ${p.level}) · Dueño: ${name}`;
            }));

            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('🏆 Mascotas más fuertes')
                    .setColor('#FF9800')
                    .setDescription(lines.join('\n'))
                    .setTimestamp()
                ]
            });
        }
    }
};