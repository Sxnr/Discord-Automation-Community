const {
    SlashCommandBuilder, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionFlagsBits, MessageFlags
} = require('discord.js');
const db = require('../../database/db');
const { checkAndUnlock } = require('..commands/economy/achievements');

// ── Banco local en español ─────────────────────────────────────────────────
const LOCAL_QUESTIONS = [
    // 🌍 Geografía
    { q: '¿Cuál es el océano más grande del mundo?',               a: 'Pacífico',     opts: ['Atlántico','Índico','Pacífico','Ártico'],        cat: '🌍 Geografía',  diff: 'easy'   },
    { q: '¿Cuál es la capital de Australia?',                      a: 'Canberra',     opts: ['Sídney','Melbourne','Canberra','Perth'],          cat: '🌍 Geografía',  diff: 'medium' },
    { q: '¿Cuál es el país más grande del mundo?',                 a: 'Rusia',        opts: ['Canadá','China','Rusia','EEUU'],                  cat: '🌍 Geografía',  diff: 'easy'   },
    { q: '¿Cuál es el río más largo del mundo?',                   a: 'Nilo',         opts: ['Amazonas','Nilo','Yangtsé','Misisipi'],           cat: '🌍 Geografía',  diff: 'medium' },
    { q: '¿Cuál es la montaña más alta del mundo?',                a: 'Everest',      opts: ['K2','Aconcagua','Everest','Kilimanjaro'],         cat: '🌍 Geografía',  diff: 'easy'   },
    { q: '¿Cuántos países tiene América del Sur?',                 a: '12',           opts: ['10','11','12','13'],                              cat: '🌍 Geografía',  diff: 'medium' },
    { q: '¿En qué continente está Egipto?',                        a: 'África',       opts: ['Asia','Europa','África','Medio Oriente'],         cat: '🌍 Geografía',  diff: 'easy'   },
    { q: '¿Cuál es la capital de Japón?',                          a: 'Tokio',        opts: ['Osaka','Tokio','Kioto','Hiroshima'],              cat: '🌍 Geografía',  diff: 'easy'   },
    { q: '¿Qué país tiene más idiomas oficiales?',                 a: 'Sudáfrica',    opts: ['India','Suiza','Bolivia','Sudáfrica'],            cat: '🌍 Geografía',  diff: 'hard'   },
    { q: '¿Cuál es el desierto más grande del mundo?',             a: 'Antártico',    opts: ['Sahara','Arábigo','Gobi','Antártico'],            cat: '🌍 Geografía',  diff: 'hard'   },

    // 🔬 Ciencia
    { q: '¿Cuál es el planeta más grande del sistema solar?',      a: 'Júpiter',      opts: ['Saturno','Júpiter','Neptuno','Urano'],            cat: '🔬 Ciencia',    diff: 'easy'   },
    { q: '¿Cuántos huesos tiene el cuerpo humano adulto?',         a: '206',          opts: ['196','206','216','226'],                          cat: '🔬 Ciencia',    diff: 'medium' },
    { q: '¿Qué gas produce las plantas durante la fotosíntesis?',  a: 'Oxígeno',      opts: ['CO₂','Nitrógeno','Oxígeno','Helio'],              cat: '🔬 Ciencia',    diff: 'easy'   },
    { q: '¿Cuál es el elemento más abundante en el universo?',     a: 'Hidrógeno',    opts: ['Oxígeno','Carbono','Hidrógeno','Helio'],          cat: '🔬 Ciencia',    diff: 'medium' },
    { q: '¿Cuál es la velocidad de la luz en km/s?',               a: '300.000',      opts: ['150.000','300.000','450.000','600.000'],          cat: '🔬 Ciencia',    diff: 'medium' },
    { q: '¿Cuántos cromosomas tiene una célula humana normal?',    a: '46',           opts: ['23','44','46','48'],                              cat: '🔬 Ciencia',    diff: 'medium' },
    { q: '¿Qué planeta es conocido como el planeta rojo?',         a: 'Marte',        opts: ['Venus','Marte','Mercurio','Saturno'],             cat: '🔬 Ciencia',    diff: 'easy'   },
    { q: '¿Cuál es el hueso más largo del cuerpo humano?',         a: 'Fémur',        opts: ['Tibia','Radio','Fémur','Húmero'],                 cat: '🔬 Ciencia',    diff: 'medium' },
    { q: '¿A qué temperatura hierve el agua al nivel del mar?',    a: '100°C',        opts: ['90°C','95°C','100°C','105°C'],                   cat: '🔬 Ciencia',    diff: 'easy'   },
    { q: '¿Cuántas neuronas tiene el cerebro humano aprox.?',      a: '86 mil millones', opts: ['10 mil millones','86 mil millones','1 billón','200 mil millones'], cat: '🔬 Ciencia', diff: 'hard' },

    // 💻 Tecnología
    { q: '¿En qué año se fundó Google?',                           a: '1998',         opts: ['1994','1996','1998','2000'],                      cat: '💻 Tecnología', diff: 'medium' },
    { q: '¿Cuántos bits tiene un byte?',                           a: '8',            opts: ['4','6','8','16'],                                 cat: '💻 Tecnología', diff: 'easy'   },
    { q: '¿Quién creó Linux?',                                     a: 'Linus Torvalds',opts: ['Bill Gates','Dennis Ritchie','Linus Torvalds','Steve Jobs'], cat: '💻 Tecnología', diff: 'medium' },
    { q: '¿En qué año se lanzó el primer iPhone?',                 a: '2007',         opts: ['2005','2006','2007','2008'],                      cat: '💻 Tecnología', diff: 'easy'   },
    { q: '¿Qué significa HTML?',                                   a: 'HyperText Markup Language', opts: ['HyperText Machine Language','HyperText Markup Language','High Transfer Mode Link','HyperTool Making Language'], cat: '💻 Tecnología', diff: 'easy' },
    { q: '¿Qué empresa desarrolló JavaScript?',                    a: 'Netscape',     opts: ['Microsoft','Sun Microsystems','Netscape','Apple'], cat: '💻 Tecnología', diff: 'hard'  },
    { q: '¿Cuál es el lenguaje más usado en GitHub?',              a: 'JavaScript',   opts: ['Python','Java','JavaScript','C++'],               cat: '💻 Tecnología', diff: 'medium' },
    { q: '¿Qué significa CPU?',                                    a: 'Central Processing Unit', opts: ['Central Processing Unit','Computer Power Unit','Core Processing Unit','Central Power Unit'], cat: '💻 Tecnología', diff: 'easy' },
    { q: '¿En qué año fue creado Python?',                         a: '1991',         opts: ['1985','1989','1991','1995'],                      cat: '💻 Tecnología', diff: 'hard'   },
    { q: '¿Cuánto es 1 terabyte en gigabytes?',                    a: '1024',         opts: ['512','1000','1024','2048'],                       cat: '💻 Tecnología', diff: 'medium' },

    // 📐 Matemática
    { q: '¿Cuántos lados tiene un hexágono?',                      a: '6',            opts: ['5','6','7','8'],                                  cat: '📐 Matemática', diff: 'easy'   },
    { q: '¿Cuánto es la raíz cuadrada de 144?',                    a: '12',           opts: ['11','12','13','14'],                              cat: '📐 Matemática', diff: 'easy'   },
    { q: '¿Cuánto es 15% de 200?',                                 a: '30',           opts: ['25','30','35','40'],                              cat: '📐 Matemática', diff: 'easy'   },
    { q: '¿Cuánto es π (pi) aproximadamente?',                     a: '3.14159',      opts: ['3.12159','3.14159','3.16159','3.18159'],          cat: '📐 Matemática', diff: 'easy'   },
    { q: '¿Cuánto es 2 elevado a la 10?',                          a: '1024',         opts: ['512','1000','1024','2048'],                       cat: '📐 Matemática', diff: 'medium' },
    { q: '¿Cuántos ángulos tiene un triángulo?',                   a: '3',            opts: ['2','3','4','5'],                                  cat: '📐 Matemática', diff: 'easy'   },
    { q: '¿Cuánto es la suma de ángulos internos de un triángulo?',a: '180°',         opts: ['90°','180°','270°','360°'],                      cat: '📐 Matemática', diff: 'easy'   },
    { q: '¿Qué número es primo entre estos?',                      a: '97',           opts: ['91','93','95','97'],                              cat: '📐 Matemática', diff: 'hard'   },
    { q: '¿Cuánto es la raíz cuadrada de 256?',                    a: '16',           opts: ['14','15','16','17'],                              cat: '📐 Matemática', diff: 'medium' },
    { q: '¿Cuántos lados tiene un decágono?',                      a: '10',           opts: ['8','9','10','12'],                                cat: '📐 Matemática', diff: 'medium' },

    // 🚀 Historia
    { q: '¿En qué año llegó el hombre a la Luna?',                 a: '1969',         opts: ['1965','1969','1972','1975'],                      cat: '🚀 Historia',   diff: 'easy'   },
    { q: '¿En qué año cayó el Muro de Berlín?',                    a: '1989',         opts: ['1987','1988','1989','1991'],                      cat: '🚀 Historia',   diff: 'medium' },
    { q: '¿En qué año se inventó el papel?',                       a: '105 d.C.',     opts: ['50 a.C.','105 d.C.','400 d.C.','800 d.C.'],      cat: '🚀 Historia',   diff: 'hard'   },
    { q: '¿Quién fue el primer presidente de EEUU?',               a: 'George Washington', opts: ['Abraham Lincoln','George Washington','Thomas Jefferson','John Adams'], cat: '🚀 Historia', diff: 'easy' },
    { q: '¿En qué año comenzó la Primera Guerra Mundial?',         a: '1914',         opts: ['1910','1912','1914','1916'],                      cat: '🚀 Historia',   diff: 'easy'   },
    { q: '¿Quién descubrió América en 1492?',                      a: 'Cristóbal Colón', opts: ['Américo Vespucio','Cristóbal Colón','Hernán Cortés','Fernando Magallanes'], cat: '🚀 Historia', diff: 'easy' },
    { q: '¿En qué año terminó la Segunda Guerra Mundial?',         a: '1945',         opts: ['1943','1944','1945','1946'],                      cat: '🚀 Historia',   diff: 'easy'   },
    { q: '¿Qué civilización construyó Machu Picchu?',              a: 'Inca',         opts: ['Maya','Azteca','Inca','Olmeca'],                  cat: '🚀 Historia',   diff: 'easy'   },
    { q: '¿En qué año fue la Revolución Francesa?',                a: '1789',         opts: ['1776','1789','1799','1815'],                      cat: '🚀 Historia',   diff: 'medium' },
    { q: '¿Quién fue el último faraón de Egipto?',                 a: 'Cleopatra VII', opts: ['Ramsés II','Tutankamón','Nefertiti','Cleopatra VII'], cat: '🚀 Historia', diff: 'hard' },

    // 🎨 Arte & Cultura
    { q: '¿Quién pintó la Mona Lisa?',                             a: 'Da Vinci',     opts: ['Picasso','Da Vinci','Rembrandt','Monet'],          cat: '🎨 Cultura',    diff: 'easy'   },
    { q: '¿En qué país se origina el sushi?',                      a: 'Japón',        opts: ['China','Corea','Japón','Vietnam'],                 cat: '🎨 Cultura',    diff: 'easy'   },
    { q: '¿Cuántas teclas tiene un piano estándar?',               a: '88',           opts: ['76','84','88','92'],                              cat: '🎨 Cultura',    diff: 'medium' },
    { q: '¿Quién escribió Don Quijote?',                           a: 'Cervantes',    opts: ['Lope de Vega','Cervantes','Quevedo','Góngora'],    cat: '🎨 Cultura',    diff: 'easy'   },
    { q: '¿De qué país es la pizza?',                              a: 'Italia',       opts: ['Francia','España','Italia','Grecia'],             cat: '🎨 Cultura',    diff: 'easy'   },
    { q: '¿Qué artista pintó La Noche Estrellada?',                a: 'Van Gogh',     opts: ['Monet','Dalí','Van Gogh','Klimt'],                cat: '🎨 Cultura',    diff: 'easy'   },
    { q: '¿En qué país nació Mozart?',                             a: 'Austria',      opts: ['Alemania','Austria','Suiza','Italia'],             cat: '🎨 Cultura',    diff: 'medium' },
    { q: '¿Cuántos libros tiene la Biblia (canon católico)?',      a: '73',           opts: ['66','72','73','76'],                              cat: '🎨 Cultura',    diff: 'hard'   },
    { q: '¿Qué artista fue conocido como el Rey del Pop?',         a: 'Michael Jackson', opts: ['Elvis Presley','Prince','Michael Jackson','David Bowie'], cat: '🎨 Cultura', diff: 'easy' },
    { q: '¿En qué año se estrenó Titanic (película)?',             a: '1997',         opts: ['1995','1996','1997','1998'],                      cat: '🎨 Cultura',    diff: 'medium' },

    // ⚽ Deportes
    { q: '¿Cuántos jugadores tiene un equipo de fútbol en el campo?', a: '11',        opts: ['9','10','11','12'],                               cat: '⚽ Deportes',   diff: 'easy'   },
    { q: '¿Cada cuántos años se realiza el Mundial de fútbol?',    a: '4',            opts: ['2','3','4','5'],                                  cat: '⚽ Deportes',   diff: 'easy'   },
    { q: '¿En qué país se originó el baloncesto?',                 a: 'EEUU',         opts: ['Canada','EEUU','Brasil','Inglaterra'],             cat: '⚽ Deportes',   diff: 'medium' },
    { q: '¿Cuántos sets tiene un partido de tenis al mejor de 5?', a: '5',            opts: ['3','4','5','6'],                                  cat: '⚽ Deportes',   diff: 'easy'   },
    { q: '¿Cuántos anillos tiene el símbolo olímpico?',            a: '5',            opts: ['4','5','6','7'],                                  cat: '⚽ Deportes',   diff: 'easy'   },

    // 💰 General
    { q: '¿Cuántos colores tiene el arcoíris?',                    a: '7',            opts: ['5','6','7','8'],                                  cat: '💰 General',    diff: 'easy'   },
    { q: '¿Cuál es el metal más caro del mundo?',                  a: 'Rodio',        opts: ['Oro','Platino','Rodio','Paladio'],                 cat: '💰 General',    diff: 'hard'   },
    { q: '¿Cuántos continentes hay en la Tierra?',                 a: '7',            opts: ['5','6','7','8'],                                  cat: '💰 General',    diff: 'easy'   },
    { q: '¿Cuántos días tiene un año bisiesto?',                   a: '366',          opts: ['364','365','366','367'],                          cat: '💰 General',    diff: 'easy'   },
    { q: '¿Cuántas horas tiene un día?',                           a: '24',           opts: ['20','22','24','26'],                              cat: '💰 General',    diff: 'easy'   },
    { q: '¿Cuántas semanas tiene un año?',                         a: '52',           opts: ['48','50','52','54'],                              cat: '💰 General',    diff: 'easy'   },
    { q: '¿Cuánto pesa aproximadamente un elefante africano?',     a: '6.000 kg',     opts: ['2.000 kg','4.000 kg','6.000 kg','8.000 kg'],      cat: '💰 General',    diff: 'medium' },
    { q: '¿Cuántos sentidos tiene el ser humano clásicamente?',    a: '5',            opts: ['4','5','6','7'],                                  cat: '💰 General',    diff: 'easy'   },
];

// ── Open Trivia DB (inglés, gratis) ───────────────────────────────────────
const OTD_CATEGORIES = {
    '🔬 Ciencia':    17, // Science & Nature
    '💻 Tecnología': 18, // Computers
    '📐 Matemática': 19, // Mathematics
    '🚀 Historia':   23, // History
    '🌍 Geografía':  22, // Geography
    '🎨 Cultura':    12, // Music / Entertainment
    '⚽ Deportes':   21, // Sports
    '💰 General':     9, // General Knowledge
};

async function fetchFromOTDB(category = null, difficulty = null) {
    try {
        let url = 'https://opentdb.com/api.php?amount=10&type=multiple';
        if (category && OTD_CATEGORIES[category]) url += `&category=${OTD_CATEGORIES[category]}`;
        if (difficulty) url += `&difficulty=${difficulty}`;

        const res  = await fetch(url);
        const data = await res.json();
        if (data.response_code !== 0 || !data.results?.length) return [];

        return data.results.map(r => {
            const decode  = str => str.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'");
            const correct = decode(r.correct_answer);
            const wrong   = r.incorrect_answers.map(decode);
            const opts    = shuffle([correct, ...wrong]);
            return {
                q:    decode(r.question),
                a:    correct,
                opts,
                cat:  category || '🌐 Global',
                diff: r.difficulty,
                source: 'otdb'
            };
        });
    } catch { return []; }
}

// ── Anti-repetición ───────────────────────────────────────────────────────
const recentQuestions = new Map(); // guildId → Set of question texts
const MAX_RECENT = 50;

function markAsked(guildId, question) {
    if (!recentQuestions.has(guildId)) recentQuestions.set(guildId, new Set());
    const set = recentQuestions.get(guildId);
    set.add(question);
    if (set.size > MAX_RECENT) {
        const first = set.values().next().value;
        set.delete(first);
    }
}

function wasAsked(guildId, question) {
    return recentQuestions.get(guildId)?.has(question) || false;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
}

function diffColor(diff) {
    return { easy: '#57F287', medium: '#FEE75C', hard: '#ED4245' }[diff] || '#5865F2';
}

function diffLabel(diff) {
    return { easy: '🟢 Fácil', medium: '🟡 Medio', hard: '🔴 Difícil' }[diff] || '⚪ ?';
}

const activeSessions = new Map();
const COOLDOWN_MS    = 8000;
const ANSWER_TIME    = 25000;
const userCooldowns  = new Map();

// ══════════════════════════════════════════════════════════════════════════
module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('❓ Trivia con preguntas infinitas.')
        .addSubcommand(sub => sub
            .setName('play')
            .setDescription('Responde una pregunta de trivia.')
            .addStringOption(opt => opt
                .setName('categoria')
                .setDescription('Filtrar por categoría')
                .addChoices(
                    { name: '🌍 Geografía',  value: '🌍 Geografía'  },
                    { name: '🔬 Ciencia',    value: '🔬 Ciencia'    },
                    { name: '💻 Tecnología', value: '💻 Tecnología' },
                    { name: '📐 Matemática', value: '📐 Matemática' },
                    { name: '🚀 Historia',   value: '🚀 Historia'   },
                    { name: '🎨 Cultura',    value: '🎨 Cultura'    },
                    { name: '⚽ Deportes',   value: '⚽ Deportes'   },
                    { name: '💰 General',    value: '💰 General'    },
                    { name: '🌐 Global (OTDB)', value: '🌐 Global'  }
                )
            )
            .addStringOption(opt => opt
                .setName('dificultad')
                .setDescription('Dificultad de la pregunta')
                .addChoices(
                    { name: '🟢 Fácil',   value: 'easy'   },
                    { name: '🟡 Medio',   value: 'medium' },
                    { name: '🔴 Difícil', value: 'hard'   }
                )
            )
        )
        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('Agrega una pregunta personalizada al servidor. [Admin]')
            .addStringOption(opt => opt.setName('pregunta').setDescription('La pregunta').setRequired(true).setMaxLength(300))
            .addStringOption(opt => opt.setName('respuesta').setDescription('Respuesta correcta').setRequired(true).setMaxLength(100))
            .addStringOption(opt => opt.setName('opcion2').setDescription('Opción incorrecta 1').setRequired(true).setMaxLength(100))
            .addStringOption(opt => opt.setName('opcion3').setDescription('Opción incorrecta 2').setRequired(true).setMaxLength(100))
            .addStringOption(opt => opt.setName('opcion4').setDescription('Opción incorrecta 3').setRequired(true).setMaxLength(100))
            .addStringOption(opt => opt
                .setName('categoria')
                .setDescription('Categoría de la pregunta')
                .addChoices(
                    { name: '🌍 Geografía',  value: '🌍 Geografía'  },
                    { name: '🔬 Ciencia',    value: '🔬 Ciencia'    },
                    { name: '💻 Tecnología', value: '💻 Tecnología' },
                    { name: '📐 Matemática', value: '📐 Matemática' },
                    { name: '🚀 Historia',   value: '🚀 Historia'   },
                    { name: '🎨 Cultura',    value: '🎨 Cultura'    },
                    { name: '⚽ Deportes',   value: '⚽ Deportes'   },
                    { name: '🎮 Gaming',     value: '🎮 Gaming'     },
                    { name: '🎭 Anime',      value: '🎭 Anime'      },
                    { name: '💰 General',    value: '💰 General'    }
                )
            )
            .addStringOption(opt => opt
                .setName('dificultad')
                .setDescription('Dificultad')
                .addChoices(
                    { name: '🟢 Fácil',   value: 'easy'   },
                    { name: '🟡 Medio',   value: 'medium' },
                    { name: '🔴 Difícil', value: 'hard'   }
                )
            )
        )
        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Elimina una pregunta personalizada. [Admin]')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID de la pregunta').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('Ver preguntas personalizadas del servidor.')
            .addIntegerOption(opt => opt.setName('pagina').setDescription('Página').setMinValue(1))
        )
        .addSubcommand(sub => sub
            .setName('stats')
            .setDescription('Ver tus estadísticas de trivia.')
            .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a consultar'))
        ),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const userId  = interaction.user.id;

        // ── PLAY ──────────────────────────────────────────────────────────
        if (sub === 'play') {
            const catFilter  = interaction.options.getString('categoria');
            const diffFilter = interaction.options.getString('dificultad');

            // Cooldown
            const lastUsed = userCooldowns.get(userId);
            if (lastUsed && Date.now() - lastUsed < COOLDOWN_MS) {
                const left = Math.ceil((COOLDOWN_MS - (Date.now() - lastUsed)) / 1000);
                return interaction.reply({ content: `⏳ Espera **${left}s** antes de otra pregunta.`, flags: [MessageFlags.Ephemeral] });
            }
            userCooldowns.set(userId, Date.now());

            await interaction.deferReply();

            let question = null;

            // 1. Preguntas personalizadas del servidor
            const customQ = db.prepare(`
                SELECT * FROM trivia_questions
                WHERE (guild_id = ? OR global = 1)
                ${catFilter && catFilter !== '🌐 Global' ? "AND category = ?" : ""}
                ${diffFilter ? "AND difficulty = ?" : ""}
                ORDER BY RANDOM() LIMIT 50
            `).all(...[guildId, catFilter !== '🌐 Global' && catFilter, diffFilter].filter(Boolean));

            const freshCustom = customQ.filter(q => !wasAsked(guildId, q.question));
            if (freshCustom.length) {
                const raw = freshCustom[Math.floor(Math.random() * freshCustom.length)];
                question = {
                    q:    raw.question,
                    a:    raw.answer,
                    opts: shuffle(JSON.parse(raw.options)),
                    cat:  raw.category,
                    diff: raw.difficulty
                };
            }

            // 2. Banco local en español
            if (!question) {
                let pool = LOCAL_QUESTIONS.filter(q => !wasAsked(guildId, q.q));
                if (catFilter && catFilter !== '🌐 Global') pool = pool.filter(q => q.cat === catFilter);
                if (diffFilter) pool = pool.filter(q => q.diff === diffFilter);

                // Si se agotaron las no vistas, resetear y usar todas
                if (!pool.length) {
                    recentQuestions.set(guildId, new Set());
                    pool = LOCAL_QUESTIONS;
                    if (catFilter && catFilter !== '🌐 Global') pool = pool.filter(q => q.cat === catFilter);
                    if (diffFilter) pool = pool.filter(q => q.diff === diffFilter);
                }

                if (pool.length) {
                    const raw = pool[Math.floor(Math.random() * pool.length)];
                    question  = { ...raw, opts: shuffle(raw.opts) };
                }
            }

            // 3. Open Trivia DB (inglés)
            if (!question || catFilter === '🌐 Global') {
                const otdbQ = await fetchFromOTDB(
                    catFilter !== '🌐 Global' ? catFilter : null,
                    diffFilter
                );
                const fresh = otdbQ.filter(q => !wasAsked(guildId, q.q));
                if (fresh.length) question = fresh[Math.floor(Math.random() * fresh.length)];
            }

            if (!question) {
                return interaction.editReply({ content: '❌ No se encontraron preguntas para ese filtro. Intenta con otra categoría.' });
            }

            markAsked(guildId, question.q);

            // ── Session ───────────────────────────────────────────────────
            const sessionId = `${userId}_${Date.now()}`;
            activeSessions.set(sessionId, {
                answer:    question.a,
                userId,
                answered:  false,
                startTime: Date.now(),
                shuffled:  question.opts,
                question
            });

            // ── Buttons ───────────────────────────────────────────────────
            const row = new ActionRowBuilder().addComponents(
                question.opts.map((opt, i) =>
                    new ButtonBuilder()
                        .setCustomId(`trivia_ans_${sessionId}_${i}`)
                        .setLabel(String(opt).slice(0, 80))
                        .setStyle(ButtonStyle.Primary)
                )
            );

            const embed = new EmbedBuilder()
                .setTitle(`${question.cat} — Trivia`)
                .setColor(diffColor(question.diff))
                .setDescription(`## ${question.q}`)
                .addFields(
                    { name: '⚡ Dificultad', value: diffLabel(question.diff), inline: true },
                    { name: '⏱️ Tiempo',     value: `${ANSWER_TIME / 1000}s`,  inline: true },
                    ...(question.source === 'otdb' ? [{ name: '🌐 Fuente', value: 'Open Trivia DB', inline: true }] : [])
                )
                .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], components: [row] });
            const msg = await interaction.fetchReply();

            // Auto-expirar
            setTimeout(async () => {
                const session = activeSessions.get(sessionId);
                if (!session || session.answered) return;
                activeSessions.delete(sessionId);

                // Actualizar stats (timeout = wrong)
                db.prepare(`
                    INSERT INTO trivia_stats (guild_id, user_id, wrong, streak)
                    VALUES (?, ?, 1, 0)
                    ON CONFLICT(guild_id, user_id) DO UPDATE SET wrong = wrong + 1, streak = 0
                `).run(guildId, userId);

                const expiredEmbed = EmbedBuilder.from(embed)
                    .setColor('#ED4245')
                    .setDescription(`## ${question.q}\n\n⏰ **¡Tiempo agotado!**\nLa respuesta era: **${question.a}**`);

                await msg.edit({ embeds: [expiredEmbed], components: [] }).catch(() => null);
            }, ANSWER_TIME);
        }

        // ── ADD ───────────────────────────────────────────────────────────
        if (sub === 'add') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Necesitas el permiso **Gestionar Servidor**.', flags: [MessageFlags.Ephemeral] });
            }

            const pregunta  = interaction.options.getString('pregunta');
            const respuesta = interaction.options.getString('respuesta');
            const op2       = interaction.options.getString('opcion2');
            const op3       = interaction.options.getString('opcion3');
            const op4       = interaction.options.getString('opcion4');
            const cat       = interaction.options.getString('categoria') || '💰 General';
            const diff      = interaction.options.getString('dificultad') || 'medium';
            const options   = JSON.stringify([respuesta, op2, op3, op4]);

            const info = db.prepare(`
                INSERT INTO trivia_questions (guild_id, question, answer, options, category, difficulty)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(guildId, pregunta, respuesta, options, cat, diff);

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#57F287')
                    .setTitle('✅ Pregunta Agregada')
                    .addFields(
                        { name: '❓ Pregunta',     value: pregunta,         inline: false },
                        { name: '✅ Respuesta',    value: respuesta,        inline: true  },
                        { name: '📁 Categoría',   value: cat,              inline: true  },
                        { name: '⚡ Dificultad',  value: diffLabel(diff),  inline: true  },
                        { name: '🆔 ID',          value: `\`${info.lastInsertRowid}\``, inline: true }
                    )
                    .setFooter({ text: 'Usa /trivia list para ver todas las preguntas personalizadas.' })
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ── REMOVE ────────────────────────────────────────────────────────
        if (sub === 'remove') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ Necesitas el permiso **Gestionar Servidor**.', flags: [MessageFlags.Ephemeral] });
            }

            const id = interaction.options.getInteger('id');
            const q  = db.prepare('SELECT * FROM trivia_questions WHERE id = ? AND guild_id = ?').get(id, guildId);
            if (!q) return interaction.reply({ content: `❌ Pregunta **#${id}** no encontrada.`, flags: [MessageFlags.Ephemeral] });

            db.prepare('DELETE FROM trivia_questions WHERE id = ?').run(id);
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#57F287').setDescription(`🗑️ Pregunta **#${id}** eliminada.\n> ~~${q.question.slice(0, 100)}~~`)],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ── LIST ──────────────────────────────────────────────────────────
        if (sub === 'list') {
            const page     = (interaction.options.getInteger('pagina') || 1) - 1;
            const pageSize = 8;
            const total    = db.prepare('SELECT COUNT(*) as c FROM trivia_questions WHERE guild_id = ?').get(guildId).c;
            const questions = db.prepare('SELECT * FROM trivia_questions WHERE guild_id = ? LIMIT ? OFFSET ?').all(guildId, pageSize, page * pageSize);

            if (!questions.length) {
                return interaction.reply({
                    embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('❌ No hay preguntas personalizadas en este servidor.\nUsa `/trivia add` para agregar.')],
                    flags: [MessageFlags.Ephemeral]
                });
            }

            const lines = questions.map(q =>
                `**#${q.id}** · ${q.category} · ${diffLabel(q.difficulty)}\n> ${q.question.slice(0, 80)}`
            );

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('📋 Preguntas Personalizadas')
                    .setColor('#5865F2')
                    .setDescription(lines.join('\n\n'))
                    .setFooter({ text: `Página ${page + 1} · ${total} pregunta(s) total` })
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }

        // ── STATS ─────────────────────────────────────────────────────────
        if (sub === 'stats') {
            const target = interaction.options.getUser('usuario') || interaction.user;
            const stats  = db.prepare('SELECT * FROM trivia_stats WHERE guild_id = ? AND user_id = ?').get(guildId, target.id);

            if (!stats) return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#ED4245').setDescription(`❌ **${target.username}** aún no ha jugado trivia.`)],
                flags: [MessageFlags.Ephemeral]
            });

            const total    = stats.correct + stats.wrong;
            const accuracy = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
            const bar      = '█'.repeat(Math.round(accuracy / 10)) + '░'.repeat(10 - Math.round(accuracy / 10));

            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setTitle(`📊 Stats de Trivia — ${target.username}`)
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                    .setColor('#5865F2')
                    .addFields(
                        { name: '✅ Correctas',      value: `**${stats.correct}**`,          inline: true  },
                        { name: '❌ Incorrectas',    value: `**${stats.wrong}**`,             inline: true  },
                        { name: '🎯 Total',          value: `**${total}**`,                  inline: true  },
                        { name: '🔥 Racha actual',   value: `**${stats.streak}**`,           inline: true  },
                        { name: '🏆 Mejor racha',    value: `**${stats.best_streak}**`,      inline: true  },
                        { name: `📈 Precisión ${accuracy}%`, value: `\`${bar}\`` }
                    )
                ],
                flags: [MessageFlags.Ephemeral]
            });
        }
    }
};

module.exports.activeSessions = activeSessions;