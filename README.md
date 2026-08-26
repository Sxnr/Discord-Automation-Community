# 🤖 Discord Global Engine

> Bot de Discord modular, multi-servidor (multi-tenant) y de código abierto, escrito en **Node.js** con **Discord.js v14**, **SQLite** y **moderación por IA**.

Diseñado para comunidades que quieren un bot todo-en-uno: economía, juegos, música, moderación automática, perfiles, logros, tickets, verificación, votaciones e internacionalización — todo aislado y persistente **por servidor**.

---

## ✨ Características principales

- **🌐 Multi-tenant:** cada servidor tiene su propia configuración y base de datos aislada.
- **🌍 i18n:** idioma configurable **por servidor** (`/language`, español/inglés) con fallback automático.
- **💰 Economía completa:** cartera, banco, daily, trabajo, crimen, robo, tienda, inventario, transacciones y leaderboard.
- **🧠 Moderación por IA:** detecta toxicidad, acoso, estafa y spam usando un LLM (o heurística de respaldo) y aplica `log` / `delete` / `warn` / `timeout`.
- **🗳️ Votaciones:** `/vote` con recompensa de monedas y racha (streak), top de votantes.
- **🎵 Música:** reproduce desde YouTube/SoundCloud, cola, playlists guardadas, historial, **controles con botones** (pausar/reanudar/saltar/detener), `/lyrics` y configuración DJ por servidor.
- **🏆 Progresión:** logros automáticos, perfiles personalizables, trivia, mascotas virtuales y niveles/XP.
- **🛡️ Administración:** AutoMod, warns, tickets con transcript, reaction roles, verificación (botón o captcha), starboard, sugerencias, reportes, encuestas, eventos y sorteos.
- **📈 Analítica:** `/stats` con uso de comandos, comando más usado y votos totales.
- **🎮 Diversión:** trivia, ahorcado, tic-tac-toe, ruleta, dados, 8ball, memes, animales, **coinflip y blackjack** (apuestas) y más.
- **🔌 APIs externas:** clima, noticias, películas, series, letras, definiciones y acortador de links.
- **🚀 Escalable:** soporte opcional de **sharding** (`npm run start:shard`) para múltiples servidores.
- **🛡️ Robusto:** chequeo de APIs al arranque y manejo seguro de interacciones duplicadas/expiradas (no crashea).

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Runtime | Node.js 18+ (recomendado 20+) |
| Framework | Discord.js v14 |
| Base de datos | better-sqlite3 (WAL) |
| Música | discord-player + @discord-player/extractor |
| Variables de entorno | dotenv |
| Desarrollo | nodemon |
| Moderación IA | LLM OpenAI-compatible (opcional) |
| Transcripts | discord-html-transcripts |
| Sharding | ShardingManager (incluido en discord.js) |

---

## 🚀 Instalación

### 1. Requisitos
- **Node.js 18+** (better-sqlite3 v12 y Discord.js v14 lo requieren; recomendado Node 20+).
- Una aplicación en el [Discord Developer Portal](https://discord.com/developers/applications).
- **Intents privilegiados activados** en el portal: *Server Members Intent* y *Presence Intent* (los usa el bot).

### 2. Clonar e instalar
```bash
git clone <TU_REPOSITORIO>
cd Discord-Automation-Community
npm install
```

### 3. Configurar variables de entorno
Copia `.env.example` a `.env` y rellena los valores:

```env
TOKEN=tu_token_del_bot
CLIENT_ID=tu_client_id
GUILD_ID=                # ID de prueba para /deploy instantáneo (opcional)

# Música (opcional, normalmente auto)
FFMPEG_PATH=

# Moderación por IA (opcional; sin key usa heurística de respaldo)
AI_API_KEY=sk-...        # Cualquier key compatible con OpenAI (o tu proveedor)
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4o-mini

# APIs externas (opcionales, cada comando avisa si falta su key)
OPENWEATHER_KEY=         # /clima
GNEWS_KEY=               # /noticias
TMDB_KEY=                # /peliculas, /series
GENIUS_TOKEN=            # /letra, /lyrics
GIPHY_KEY=               # /action (GIFs; si falta usa nekos.best como fallback)
```

> 💡 **Proveedores de IA gratuitos** (OpenAI-compatible): [Groq](https://console.groq.com) (`AI_API_URL=https://api.groq.com/openai/v1/chat/completions`, `AI_MODEL=llama-3.1-8b-instant`), OpenRouter, DeepSeek o Mistral (tier free).
>
> 💡 **Tenor cerró su API en 2024/2025** → ahora `/action` usa **GIPHY** (`GIPHY_KEY`); sin key usa `nekos.best` (anime, sin registro).

### 4. Registrar comandos y arrancar
```bash
# Registra los slash commands GLOBALES (ejecuta solo al cambiar comandos)
npm run deploy

# Desarrollo (recarga automática)
npm run dev

# Producción (un solo proceso)
npm start

# Producción con sharding automático (varios procesos, recomendado para muchos servidores)
npm run start:shard
```

> ⏳ Los comandos globales pueden tardar **hasta 1 hora** en aparecer en servidores nuevos (usa `GUILD_ID` para pruebas instantáneas).

> 🔎 Al arrancar, el bot verifica las APIs configuradas y muestra en consola cuáles faltan (sin bloquear el inicio).

---

## 📌 Comandos

> Todas las interacciones son **slash commands** (`/`). Usa `/help` para un menú interactivo por categorías.

### 🛡️ Administración (`/automod`, `/aimod`, `/settings`, `/warn`, `/mod`, `/reactionroles`, `/setup-tickets`, `/setup-welcome`, `/starboard`, `/verify`, `/xp`, `/language`, `/rules`)
Configuración del servidor, moderación automática y por IA, tickets, verificación, roles por reacción, niveles, **idioma del servidor** y **reglas con botón de aceptación (onboarding)**.

### 💰 Economía (`/economy`, `/achievements`, `/pet`, `/profile`)
Balance, daily, trabajo, crimen, robo, tienda, inventario, logros, mascotas y perfiles.

### 🎮 Diversión (`/trivia`, `/hangman`, `/tictactoe`, `/slots`, `/dice`, `/rps`, `/8ball`, `/ship`, `/race`, `/meme`, `/animales`, `/avatar`, `/action`, `/calculadora`, `/acortar`, `/definicion`, `/coinflip`, `/blackjack`)
Juegos y entretenimiento, incluidas **apuestas** con la economía del servidor.

### 🎵 Música (`/play`, `/queue`, `/skip`, `/pause`, `/resume`, `/stop`, `/volume`, `/loop`, `/shuffle`, `/nowplaying`, `/playlist`, `/musicconfig`, `/lyrics`)
Reproduce y gestiona música en canales de voz. `nowplaying` y `play` incluyen **botones de control** (pausar/reanudar/saltar/detener). `/lyrics` busca la letra de la canción actual o una específica en Genius.

### 🛠️ Utilidad (`/help`, `/status`, `/serverinfo`, `/userinfo`, `/leaderboard`, `/rank`, `/birthday`, `/clima`, `/noticias`, `/peliculas`, `/series`, `/letra`, `/suggest`, `/report`, `/poll`, `/event`, `/giveaway`, `/reminder`, `/vote`, `/stats`)
Información, utilidades comunitarias, APIs externas, **votaciones con recompensa** y **estadísticas de uso**.

---

## 🗳️ Votaciones (`/vote`)

El bot lleva el registro de votos por usuario con racha (streak) y recompensa monedas.

```bash
/vote link        # Muestra el enlace para votar (configúralo en /settings)
/vote claim       # Reclama la recompensa (200 monedas base + bonus por racha, cooldown 12h)
/vote top         # Ranking de votantes del servidor
```

---

## 🌍 Idiomas (`/language`)

Cambia el idioma de los mensajes del bot en el servidor (requiere permiso *Gestionar Servidor*). Actualmente soporta **español** e **inglés**; el sistema `t()` en `src/utils/i18n.js` permite añadir más idiomas fácilmente.

```bash
/language idioma: Español
/language idioma: English
```

---

## 🧠 Moderación por IA (`/aimod`)

Analiza cada mensaje y aplica una acción según un umbral de toxicidad.

```bash
/aimod setup enabled:true accion:delete umbral:50 log_channel:#logs
/aimod status
/aimod test "eres un idiota"   # prueba sin sancionar
```

- **Motor:** LLM si defines `AI_API_KEY`, si no, heurística de respaldo (palabras tóxicas, estafas, spam).
- **Acciones:** `log` (solo registrar), `delete`, `warn`, `timeout`.
- **Permisividad:** entero del `1` al `100` (mayor = más permisivo).

---

## 📈 Estadísticas (`/stats`)

Muestra métricas del bot (servidores, usuarios, comandos usados), del servidor actual (miembros, comandos) y el **comando más usado**. El conteo se registra automáticamente en `command_stats` en cada interacción.

---

## 🎓 Onboarding (`/rules`)

Publica un embed de reglas con un **botón de aceptación**. Al pulsarlo, el usuario recibe el rol de verificación configurado (`/setup-verify`). Útil para dar la bienvenida y verificar miembros nuevos.

```bash
/rules titulo:"Reglas de Floppa" texto:"Lee y acepta para acceder."
```

---

## 🎵 Música y FFmpeg

El reproductor usa automáticamente el binario de `ffmpeg-static` empaquetado, por lo que **no necesitas instalar FFmpeg** en el sistema. Si prefieres usar el de tu sistema, define la variable de entorno `FFMPEG_PATH`.

---

## 🚀 Sharding (escalado)

Para bots con muchos servidores, usa el launcher con `ShardingManager`:

```bash
npm run start:shard
```

Esto inicia un proceso por shard (cantidad automática) del mismo `index.js`. El modo proceso único (`npm start` / `npm run dev`) sigue disponible. ⚠️ **No corras dos instancias normales con el mismo TOKEN**: ambas recibirían todos los eventos y causaría interacciones duplicadas.

---

## 🧬 Estructura del proyecto

```
src/
├── index.js              # Cargador de comandos y eventos + manejadores globales
├── shard.js              # Launcher opcional con ShardingManager
├── config.js             # Variables de entorno
├── database/db.js        # Esquema SQLite + migraciones
├── commands/             # Comandos por categoría (admin, economy, fun, music, utility)
├── components/           # Handlers de botones/menús/modales
├── events/               # Eventos (interactionCreate, messageCreate, ready, etc.)
├── music/                # Player y helper de Spotify
├── utils/                # Utilidades (embeds, i18n, aiModeration, suggest, giveaway, checkEnv)
└── ...
```

---

## 🧭 Roadmap

| Fase | Estado |
|------|--------|
| Núcleo del bot | ✅ |
| Tickets | ✅ |
| Utilidades | ✅ |
| Economía | ✅ (faltan inversiones) |
| Logros / Perfiles / Trivia / Mascotas | ✅ |
| Reaction Roles / Verificación / Starboard | ✅ |
| APIs externas | ✅ |
| Música (+ controles y /lyrics) | ✅ |
| Moderación por IA | ✅ |
| i18n (idioma por servidor) | ✅ |
| Votaciones + recompensas | ✅ |
| Minijuegos (coinflip, blackjack) | ✅ |
| Analítica (/stats) | ✅ |
| Onboarding (/rules) | ✅ |
| Sharding | ✅ |
| Dashboard Web | ⏳ Pendiente |
| Inversiones (economía) | ⏳ Pendiente |

---

## 🤝 Contribuir

1. Haz fork del repositorio.
2. Crea una rama: `git checkout -b feature/mi-mejora`.
3. Instala dependencias y prueba con `npm run dev`.
4. Abre un Pull Request describiendo el cambio.

---

## 📄 Licencia

ISC — libre para usar y modificar con atribución.

## 👤 Autor

**Francisco** — Estudiante de Ingeniería Civil Informática.
