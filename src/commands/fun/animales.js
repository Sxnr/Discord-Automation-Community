const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

const ANIMALS = {
    perro:    { endpoint: 'https://some-random-api.com/animal/dog',      emoji: '🐶', color: '#C8A96E', nombre: 'Perro'    },
    gato:     { endpoint: 'https://some-random-api.com/animal/cat',      emoji: '🐱', color: '#F4A261', nombre: 'Gato'     },
    panda:    { endpoint: 'https://some-random-api.com/animal/panda',    emoji: '🐼', color: '#2D3436', nombre: 'Panda'    },
    zorro:    { endpoint: 'https://some-random-api.com/animal/fox',      emoji: '🦊', color: '#E17055', nombre: 'Zorro'    },
    pajaro:   { endpoint: 'https://some-random-api.com/animal/birb',     emoji: '🐦', color: '#74B9FF', nombre: 'Pájaro'   },
    koala:    { endpoint: 'https://some-random-api.com/animal/koala',    emoji: '🐨', color: '#636E72', nombre: 'Koala'    },
    canguro:  { endpoint: 'https://some-random-api.com/animal/kangaroo', emoji: '🦘', color: '#FDCB6E', nombre: 'Canguro'  },
    mapache:  { endpoint: 'https://some-random-api.com/animal/raccoon',  emoji: '🦝', color: '#6C5CE7', nombre: 'Mapache'  },
    pinguino: { endpoint: 'https://some-random-api.com/animal/penguin',  emoji: '🐧', color: '#0984E3', nombre: 'Pingüino' },
    delfin:   { endpoint: 'https://some-random-api.com/animal/dolphin',  emoji: '🐬', color: '#00CEC9', nombre: 'Delfín'   },
};

const FACTS_ES = {
    perro:    '¡Los perros pueden reconocer las emociones humanas con solo ver una foto!',
    gato:     '¡Los gatos pasan el 70% de su vida durmiendo!',
    panda:    '¡Los pandas bebés pesan unos 100 gramos al nacer, menos que una manzana!',
    zorro:    '¡Los zorros usan el campo magnético de la Tierra para cazar presas bajo la nieve!',
    pajaro:   '¡Existen más de 10,000 especies de aves en el mundo!',
    koala:    '¡Los koalas duermen entre 18 y 22 horas al día para ahorrar energía!',
    canguro:  '¡Los canguros no pueden caminar hacia atrás!',
    mapache:  '¡Los mapaches pueden abrir cerraduras simples con sus patas delanteras!',
    pinguino: '¡Los pingüinos son monógamos, muchos se emparejan de por vida!',
    delfin:   '¡Los delfines tienen nombres únicos que usan para llamarse entre sí!',
};

module.exports = {
    category: 'fun',
    data: new SlashCommandBuilder()
        .setName('animal')
        .setDescription('🐾 Muestra una foto aleatoria de un animal con un dato curioso.')
        .addStringOption(o => o
            .setName('tipo')
            .setDescription('¿Qué animal quieres ver?')
            .setRequired(true)
            .addChoices(
                { name: '🐶 Perro',    value: 'perro'    },
                { name: '🐱 Gato',     value: 'gato'     },
                { name: '🐼 Panda',    value: 'panda'    },
                { name: '🦊 Zorro',    value: 'zorro'    },
                { name: '🐦 Pájaro',   value: 'pajaro'   },
                { name: '🐨 Koala',    value: 'koala'    },
                { name: '🦘 Canguro',  value: 'canguro'  },
                { name: '🦝 Mapache',  value: 'mapache'  },
                { name: '🐧 Pingüino', value: 'pinguino' },
                { name: '🐬 Delfín',   value: 'delfin'   },
            )
        ),

    async execute(interaction) {
        const tipo   = interaction.options.getString('tipo');
        const animal = ANIMALS[tipo];

        await interaction.deferReply();

        let imageUrl = null;
        let fact     = FACTS_ES[tipo];

        try {
            const res  = await fetch(animal.endpoint);
            const data = await res.json();
            imageUrl   = data.image;
        } catch {
            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor('#ED4245')
                    .setDescription('❌ No pude conectarme a la API. Intenta de nuevo.')
                ],
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${animal.emoji} ¡Mira este ${animal.nombre}!`)
            .setColor(animal.color)
            .setImage(imageUrl)
            .addFields({ name: '📚 Dato curioso', value: fact })
            .setFooter({ text: `Solicitado por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    },
};