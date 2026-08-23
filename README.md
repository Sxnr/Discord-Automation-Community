# 🤖 Discord Global Engine

> Bot de Discord modular, multi-servidor (multi-tenant) y de código abierto, escrito en **Node.js** con **Discord.js v14**, **SQLite** y **moderación por IA**.

Diseñado para comunidades que quieren un bot todo-en-uno: economía, juegos, música, moderación automática, perfiles, logros, tickets, verificación y mucho más — todo aislado y persistente **por servidor**.

---

## ✨ Características principales

- **🌐 Multi-tenant:** cada servidor tiene su propia configuración y base de datos aislada.
- **💰 Economía completa:** cartera, banco, daily, trabajo, crimen, robo, tienda, inventario, transacciones y leaderboard.
- **🧠 Moderación por IA:** detecta toxicidad, acoso, estafa y spam usando un LLM (o heurística de respaldo) y aplica `log` / `delete` / `warn` / `timeout`.
- **🎵 Música:** reproduce desde YouTube/SoundCloud, cola, playlists guardadas, historial, controles DJ y configuración por servidor.
- **🏆 Progresión:** logros automáticos, perfiles personalizables, trivia, mascotas virtuales y niveles/XP.
- **🛡️ Administración:** AutoMod, warns, tickets con transcript, reaction roles, verificación (botón o captcha), starboard, sugerencias, reportes, encuestas, eventos y sorteos.
- **🎮 Diversión:** trivia, ahorcado, tic-tac-toe, ruleta, dados, 8ball, memes, animales y más.
- **🔌 APIs externas:** clima, noticias, películas, series, letras, definiciones y acortador de links.

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Runtime | Node.js 18+ |
| Framework | Discord.js v14 |
| Base de datos | better-sqlite3 (WAL) |
| Música | discord-player + @discord-player/extractor |
| Variables de entorno | dotenv |
| Desarrollo | nodemon |
| Moderación IA | LLM OpenAI-compatible (opcional) |
| Transcripts | discord-html-transcripts |

---

## 🚀 Instalación

### 1. Requisitos
- **Node.js 18+** (better-sqlite3 v12 y Discord.js v14 lo requieren).
- Una aplicación en el [Discord Developer Portal](https://discord.com/developers/applications).
- **Intents privilegiados activados** en el portal: *Server Members Intent* y *Presence Intent* (los usa el bot).

### 2. Clonar e instalar
```bash
git clone <TU_REPOSITORIO>
cd Discord-Automation-Community
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env` en la raíz:

```env
TOKEN=tu_token_del_bot
CLIENT_ID=tu_client_id

# APIs externas (opcional)
WEATHER_API_KEY=
NEWS_API_KEY=
TMDB_API_KEY=
GENIUS_API_KEY=

# Moderación por IA (opcional pero recomendado)
# Sin AI_API_KEY usa una heurística de respaldo.
AI_API_KEY=sk-...            # Cualquier key compatible con OpenAI (o tu proveedor)
AI_API_URL=                 # Endpoint (default: https://api.openai.com/v1/chat/completions)
AI_MODEL=                   # Modelo (default: gpt-4o-mini)
```

> 💡 **Proveedores de IA gratuitos** (OpenAI-compatible): [Groq](https://console.groq.com) (`AI_API_URL=https://api.groq.com/openai/v1/chat/completions`, `AI_MODEL=llama-3.1-8b-instant`), OpenRouter, DeepSeek o Mistral (tier free).

### 4. Registrar comandos y arrancar
```bash
# Registra los slash commands GLOBALES (ejecuta solo al cambiar comandos)
npm run deploy

# Desarrollo (recarga automática)
npm run dev

# Producción
npm start
```

> ⏳ Los comandos globales pueden tardar **hasta 1 hora** en aparecer en servidores nuevos.

---

## 📌 Comandos

> Todas las interacciones son **slash commands** (`/`). Usa `/help` para un menú interactivo por categorías.

### 🛡️ Administración (`/automod`, `/aimod`, `/settings`, `/warn`, `/mod`, `/reactionroles`, `/setup-tickets`, `/setup-welcome`, `/starboard`, `/verify`, `/xp`)
Configuración del servidor, moderación automática y por IA, tickets, verificación, roles por reacción y niveles.

### 💰 Economía (`/economy`, `/achievements`, `/pet`, `/profile`)
Balance, daily, trabajo, crimen, robo, tienda, inventario, logros, mascotas y perfiles.

### 🎮 Diversión (`/trivia`, `/hangman`, `/tictactoe`, `/slots`, `/dice`, `/rps`, `/8ball`, `/ship`, `/race`, `/meme`, `/animales`, `/avatar`, `/action`, `/calculadora`, `/acortar`, `/definicion`)
Juegos y entretenimiento.

### 🎵 Música (`/play`, `/queue`, `/skip`, `/pause`, `/resume`, `/stop`, `/volume`, `/loop`, `/shuffle`, `/nowplaying`, `/playlist`, `/musicconfig`)
Reproduce y gestiona música en canales de voz.

### 🛠️ Utilidad (`/help`, `/status`, `/serverinfo`, `/userinfo`, `/leaderboard`, `/rank`, `/birthday`, `/clima`, `/noticias`, `/peliculas`, `/series`, `/letra`, `/suggest`, `/report`, `/poll`, `/event`, `/giveaway`, `/reminder`)
Información, utilidades comunitarias y APIs externas.

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

## 🎵 Música y FFmpeg

El reproductor usa automáticamente el binario de `ffmpeg-static` empaquetado, por lo que **no necesitas instalar FFmpeg** en el sistema. Si prefieres usar el de tu sistema, define la variable de entorno `FFMPEG_PATH`.

---

## 🧬 Estructura del proyecto

```
src/
├── index.js              # Cargador de comandos y eventos
├── config.js             # Variables de entorno
├── database/db.js        # Esquema SQLite + migraciones
├── commands/             # Comandos por categoría (admin, economy, fun, music, utility)
├── components/           # Handlers de botones/menús/modales (refactor de interactionCreate)
├── events/               # Eventos (interactionCreate, messageCreate, ready, etc.)
├── music/                # Player y helper de Spotify
├── utils/                # Utilidades (embeds, aiModeration, suggest, giveaway)
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
| Música | ✅ |
| Moderación por IA | ✅ |
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
