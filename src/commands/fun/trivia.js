const {
    SlashCommandBuilder, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');

const QUESTIONS = [
    { q: '¿Cuántos colores tiene el arcoíris?',                             a: '7',          opts: ['5','6','7','8'],                      cat: '🎨 General'   },
    { q: '¿Cuál es el planeta más grande del sistema solar?',               a: 'Júpiter',     opts: ['Saturno','Júpiter','Neptuno','Urano'], cat: '🌌 Ciencia'   },
    { q: '¿En qué año llegó el hombre a la Luna?',                          a: '1969',        opts: ['1965','1969','1972','1975'],           cat: '🚀 Historia'  },
    { q: '¿Cuál es el océano más grande del mundo?',                        a: 'Pacífico',    opts: ['Atlántico','Índico','Pacífico','Ártico'], cat: '🌊 Geografía' },
    { q: '¿Cuántos lados tiene un hexágono?',                               a: '6',           opts: ['5','6','7','8'],                      cat: '📐 Matemática' },
    { q: '¿Quién pintó la Mona Lisa?',                                      a: 'Da Vinci',    opts: ['Picasso','Da Vinci','Rembrandt','Monet'], cat: '🎨 Arte'    },
    { q: '¿Cuál es el elemento más abundante en el universo?',              a: 'Hidrógeno',   opts: ['Oxígeno','Carbono','Hidrógeno','Helio'], cat: '🔬 Ciencia'  },
    { q: '¿En qué país se origina el sushi?',                               a: 'Japón',       opts: ['China','Corea','Japón','Vietnam'],     cat: '🍣 Cultura'   },
    { q: '¿Cuánto es la raíz cuadrada de 144?',                             a: '12',          opts: ['11','12','13','14'],                   cat: '📐 Matemática' },
    { q: '¿Cuál es el país más grande del mundo?',                          a: 'Rusia',       opts: ['Canada','China','Rusia','EEUU'],       cat: '🌍 Geografía' },
    { q: '¿Cuántos huesos tiene el cuerpo humano adulto?',                  a: '206',         opts: ['196','206','216','226'],               cat: '🧬 Ciencia'   },
    { q: '¿Cuál es la capital de Australia?',                               a: 'Canberra',    opts: ['Sidney','Melbourne','Canberra','Perth'], cat: '🌏 Geografía'},
    { q: '¿En qué año se fundó Google?',                                    a: '1998',        opts: ['1994','1996','1998','2000'],           cat: '💻 Tecnología'},
    { q: '¿Cuántos bits tiene un byte?',                                    a: '8',           opts: ['4','6','8','16'],                     cat: '💻 Tecnología'},
    { q: '¿Qué gas produce las plantas durante la fotosíntesis?',           a: 'Oxígeno',     opts: ['CO2','Nitrógeno','Oxígeno','Helio'],   cat: '🌿 Biología'  },
    { q: '¿Cuántos jugadores tiene un equipo de fútbol en el campo?',       a: '11',          opts: ['9','10','11','12'],                   cat: '⚽ Deportes'  },
    { q: '¿Cuál es el metal más caro del mundo?',                           a: 'Rodio',       opts: ['Oro','Platino','Rodio','Paladio'],     cat: '💰 General'   },
    { q: '¿Cuántos continentes hay en la Tierra?',                          a: '7',           opts: ['5','6','7','8'],                      cat: '🌍 Geografía' },
    { q: '¿Cuál es el lenguaje de programación más popular según GitHub?',  a: 'JavaScript',  opts: ['Python','Java','JavaScript','C++'],   cat: '💻 Tecnología'},
    { q: '¿Qué planeta es conocido como el planeta rojo?',                  a: 'Marte',       opts: ['Venus','Marte','Mercurio','Saturno'], cat: '🌌 Ciencia'   },
    { q: '¿Cuántas teclas tiene un piano estándar?',                        a: '88',          opts: ['76','84','88','92'],                  cat: '🎹 Música'    },
    { q: '¿Cuál es el río más largo del mundo?',                            a: 'Nilo',        opts: ['Amazonas','Nilo','Yangtsé','Misisipi'], cat: '🌊 Geografía'},
    { q: '¿En qué país se inventó el papel?',                               a: 'China',       opts: ['Egipto','India','China','Roma'],       cat: '📜 Historia'  },
    { q: '¿Cuánto es 15% de 200?',                                          a: '30',          opts: ['25','30','35','40'],                  cat: '📐 Matemática' },
    { q: '¿Cuál es la velocidad de la luz en km/s aproximadamente?',        a: '300.000',     opts: ['150.000','300.000','450.000','600.000'], cat: '🔬 Física'  },
];

const activeSessions = new Map();
const ANSWER_TIME    = 20000;
const COOLDOWN_MS    = 10000;
const userCooldowns  = new Map();

function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
}

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('❓ Responde una pregunta de trivia y gana puntos.')
        .addStringOption(opt => opt
            .setName('categoria')
            .setDescription('Filtrar por categoría (opcional)')
            .addChoices(
                { name: '🌍 Geografía',  value: 'Geografía'  },
                { name: '🔬 Ciencia',    value: 'Ciencia'    },
                { name: '💻 Tecnología', value: 'Tecnología' },
                { name: '🎨 General',    value: 'General'    },
                { name: '📐 Matemática', value: 'Matemática' },
                { name: '🚀 Historia',   value: 'Historia'   }
            )
        ),

    async execute(interaction) {
        const userId  = interaction.user.id;
        const catFilter = interaction.options.getString('categoria');

        // Cooldown
        const lastUsed = userCooldowns.get(userId);
        if (lastUsed && Date.now() - lastUsed < COOLDOWN_MS) {
            const left = Math.ceil((COOLDOWN_MS - (Date.now() - lastUsed)) / 1000);
            return interaction.reply({ content: `⏳ Espera **${left}s** antes de otra pregunta.`, flags: [MessageFlags.Ephemeral] });
        }
        userCooldowns.set(userId, Date.now());

        // Seleccionar pregunta
        const pool = catFilter
            ? QUESTIONS.filter(q => q.cat.includes(catFilter))
            : QUESTIONS;

        if (!pool.length) return interaction.reply({ content: '❌ No hay preguntas para esa categoría.', flags: [MessageFlags.Ephemeral] });

        const question = pool[Math.floor(Math.random() * pool.length)];
        const shuffled = shuffle(question.opts);
        const sessionId = `${userId}_${Date.now()}`;

        activeSessions.set(sessionId, {
            answer:    question.a,
            userId,
            answered:  false,
            startTime: Date.now()
        });

        const row = new ActionRowBuilder().addComponents(
            shuffled.map((opt, i) =>
                new ButtonBuilder()
                    .setCustomId(`trivia_ans_${sessionId}_${i}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Primary)
            )
        );

        const embed = new EmbedBuilder()
            .setTitle(`${question.cat} — Trivia`)
            .setColor('#5865F2')
            .setDescription(`## ${question.q}`)
            .setFooter({ text: `⏱️ Tienes ${ANSWER_TIME / 1000} segundos · ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], components: [row] });
        const msg = await interaction.fetchReply();

        // Auto-expirar
        setTimeout(async () => {
            const session = activeSessions.get(sessionId);
            if (!session || session.answered) return;
            activeSessions.delete(sessionId);

            const expiredEmbed = EmbedBuilder.from(embed)
                .setColor('#ED4245')
                .setDescription(`## ${question.q}\n\n⏰ **¡Tiempo agotado!**\nLa respuesta era: **${question.a}**`);

            await msg.edit({ embeds: [expiredEmbed], components: [] }).catch(() => null);
        }, ANSWER_TIME);

        // Guardar shuffled para poder evaluar la respuesta correcta en el handler
        activeSessions.get(sessionId).shuffled = shuffled;
        activeSessions.get(sessionId).question = question;
    }
};

module.exports.activeSessions = activeSessions;