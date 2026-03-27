# 🤖 Discord Global Engine | Enterprise-Grade Automation

Sistema de automatización modular y multi-servidor (Multi-Tenant) desarrollado en **Node.js** con **Discord.js v14** y **SQLite**.  
Está pensado para comunidades escalables que necesitan configuración persistente por servidor, sistemas administrativos avanzados y módulos de engagement para sus usuarios.

---

## 💎 Características Destacadas

### 📂 Arquitectura Multi-Servidor
Cada servidor mantiene su propia configuración y datos gracias a una base de datos **SQLite**.  
Esto permite aislar sistemas como economía, logros, perfiles, tickets, verificación, starboard y más.

### 🎫 Sistema de Tickets
- Paneles personalizables.
- Prevención de spam y duplicados.
- Generación de transcripts en HTML.
- Envío de logs y registros administrativos.

### 💰 Economía del Servidor
Incluye un sistema completo de economía con:
- Balance de cartera y banco.
- Recompensas diarias.
- Trabajo y crimen.
- Robo entre usuarios.
- Transferencias.
- Tienda del servidor.
- Inventario.
- Historial de transacciones.
- Configuración personalizada por servidor.

### 🏆 Progresión y Recompensas
El bot integra sistemas de progreso pensados para retención y gamificación:
- Logros globales y personalizados.
- Estadísticas de usuario.
- Ranking de logros.
- Perfiles personalizables.
- Trivia con estadísticas y rachas.
- Mascotas virtuales con niveles y necesidades.

### ✅ Herramientas de Comunidad
También incorpora módulos administrativos y sociales como:
- Reaction Roles.
- Verificación por botón o captcha.
- Starboard.
- Comandos utilitarios.
- Configuración persistente del servidor.

### 📊 Monitor del Sistema
El comando `/status` permite revisar:
- Latencia de la API.
- Uso de memoria RAM.
- Uptime del proceso.
- Datos básicos del sistema operativo.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Runtime | Node.js |
| Framework | Discord.js v14 |
| Base de datos | Better-SQLite3 |
| Variables de entorno | Dotenv |
| Desarrollo | Nodemon |
| Transcripts | discord-html-transcripts |

---

## 🚀 Instalación y Despliegue

### 1. Requisitos Previos
Antes de iniciar, necesitas:

- **Node.js** v16.11.0 o superior.
- Una aplicación creada en el [Discord Developer Portal](https://discord.com/developers/applications).
- Haber ejecutado `npm install` para instalar las dependencias.

### 2. Clonar el Proyecto
```bash
git clone <TU_REPOSITORIO>
cd <NOMBRE_DEL_PROYECTO>
npm install
```

### 3. Configurar Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto:

```env
TOKEN=tu_token_del_bot
CLIENT_ID=tu_client_id
```

Si más adelante agregas APIs externas, puedes extenderlo con claves como:

```env
WEATHER_API_KEY=
NEWS_API_KEY=
TMDB_API_KEY=
GENIUS_API_KEY=
```

### 4. Scripts Disponibles

```bash
npm run deploy
```
Registra o actualiza los slash commands del bot.

```bash
npm run dev
```
Ejecuta el bot en desarrollo con recarga automática.

```bash
npm start
```
Inicia el bot en modo producción.

---

## 📌 Módulos Implementados

## ⚙️ Núcleo y Utilidades

### `/settings`
Configura ajustes persistentes del servidor, como canales de logs, opciones base y parámetros administrativos.

### `/help`
Muestra un menú interactivo con categorías dinámicas del bot.

### `/status`
Entrega información técnica sobre latencia, uptime, memoria y estado general del bot.

---

## 🎫 Soporte

### Sistema de Tickets
Incluye un panel configurable para que los usuarios abran tickets de soporte.  
Cuenta con medidas anti-spam, control por usuario y generación de transcript al cerrar.

---

## 💰 Economía

### `/economy balance`
Muestra la cartera, banco, total acumulado y posición del usuario.

### `/economy daily`
Permite reclamar una recompensa diaria con sistema de rachas.

### `/economy work`
Da monedas cada cierto tiempo mediante trabajos aleatorios.

### `/economy crime`
Permite arriesgarse para ganar monedas o perder parte del dinero.

### `/economy rob`
Permite intentar robar a otro usuario del servidor.

### `/economy pay`
Transfiere monedas entre usuarios.

### `/economy deposit`
Deposita monedas desde la cartera al banco.

### `/economy withdraw`
Retira monedas desde el banco a la cartera.

### `/economy shop`
Lista los ítems disponibles en la tienda del servidor.

### `/economy buy`
Compra ítems o roles configurados en la tienda.

### `/economy inventory`
Muestra el inventario de un usuario.

### `/economy transactions`
Muestra el historial reciente de transacciones.

### `/economy leaderboard`
Ranking económico del servidor.

### `/economy config`
Permite configurar moneda, emoji, rewards y cooldowns.

### `/economy give`
Entrega monedas manualmente a un usuario.

### `/economy take`
Quita monedas manualmente a un usuario.

### `/economy reset`
Reinicia la economía de un usuario.

### `/economy shop-add`
Agrega ítems a la tienda.

### `/economy shop-remove`
Elimina ítems de la tienda.

---

## 🏆 Logros

### `/achievements list`
Muestra los logros disponibles, bloqueados o desbloqueados.

### `/achievements stats`
Permite ver el progreso de logros de un usuario.

### `/achievements leaderboard`
Ranking de usuarios con más logros desbloqueados.

### `/achievements create`
Crea logros personalizados para el servidor.

### `/achievements delete`
Elimina logros personalizados.

### `/achievements grant`
Otorga un logro manualmente a un usuario.

### `/achievements revoke`
Quita un logro manualmente a un usuario.

### Logros Automáticos
El sistema ya contempla desbloqueos automáticos asociados a:
- Daily y rachas.
- Ganancias totales.
- Compras.
- Trabajo.
- Crimen.
- Robos exitosos.
- Trivia correcta y rachas.
- Mascotas.
- Nivel de mascota.

---

## 👤 Perfiles

### `/profile view`
Muestra el perfil de un usuario con su personalización y progreso.

### `/profile edit`
Permite editar distintos campos del perfil.

### `/profile socials`
Permite agregar o modificar redes sociales y enlaces personales.

### `/profile style`
Permite personalizar colores, banner, bio y otros detalles visuales.

> Ajusta estos nombres según los subcomandos exactos que tenga tu archivo de perfiles.

---

## ❓ Trivia

### `/trivia play`
Genera una pregunta con botones interactivos.

### `/trivia add`
Agrega preguntas personalizadas para el servidor.

### `/trivia remove`
Elimina preguntas personalizadas.

### `/trivia list`
Lista preguntas propias del servidor.

### `/trivia stats`
Muestra estadísticas de precisión, correctas, incorrectas y rachas.

### Banco de Preguntas
El módulo utiliza:
- Preguntas locales en español.
- Preguntas personalizadas del servidor.
- Integración con Open Trivia DB como respaldo.

---

## 🐾 Mascotas Virtuales

### `/pet adopt`
Permite adoptar una mascota pagando monedas del sistema económico.

### `/pet status`
Muestra hambre, felicidad, salud, energía, XP y nivel.

### `/pet feed`
Alimenta a la mascota.

### `/pet play`
Permite jugar con la mascota para subir felicidad y XP.

### `/pet sleep`
Recupera energía y algo de salud.

### `/pet heal`
Cura a la mascota a cambio de monedas.

### `/pet rename`
Cambia el nombre de la mascota.

### `/pet release`
Libera o elimina la mascota actual.

### `/pet shop`
Muestra los tipos de mascotas disponibles.

### `/pet leaderboard`
Ranking de mascotas del servidor.

### Características
- Decaimiento de stats con el tiempo.
- Sistema de vida y muerte.
- Niveles y experiencia.
- Integración con logros.

---

## 📌 Reaction Roles

### `/reactionroles create-panel`
Crea un panel de roles por botones.

### `/reactionroles add-role`
Agrega un rol a un panel existente.

### `/reactionroles remove-role`
Elimina un rol de un panel.

### `/reactionroles list`
Lista todos los paneles del servidor.

### `/reactionroles delete-panel`
Elimina un panel completo.

### `/reactionroles refresh`
Reconstruye los botones de un panel.

### Modos soportados
- **Toggle**: añade o quita el rol.
- **Add**: solo añade el rol.
- **Unique**: solo permite uno entre varios roles del panel.

---

## ✅ Verificación

### `/verify setup`
Configura el sistema de verificación del servidor.

### `/verify disable`
Desactiva la verificación.

### `/verify check`
Revisa si un usuario está verificado.

### `/verify force`
Verifica manualmente a un usuario.

### `/verify unverify`
Quita la verificación a un usuario.

### Métodos soportados
- Verificación con botón.
- Verificación con captcha numérico.

---

## ⭐ Starboard

### `/starboard setup`
Configura el canal, emoji y mínimo de reacciones requeridas.

### `/starboard disable`
Desactiva el starboard.

### `/starboard config`
Muestra la configuración actual.

### `/starboard top`
Lista los mensajes más destacados del servidor.

### Funcionalidades
- Publicación automática al alcanzar el umbral.
- Actualización del conteo en tiempo real.
- Eliminación automática si baja del mínimo.
- Protección contra self-star si se desactiva.

---

## 🗃️ Base de Datos

El proyecto está preparado para trabajar con tablas persistentes como:

- `guild_settings`
- `economy`
- `transactions`
- `shop_items`
- `inventory`
- `achievements`
- `user_achievements`
- `profiles`
- `pets`
- `trivia_questions`
- `trivia_stats`
- `reaction_role_panels`
- `reaction_roles`
- `verifications`
- `starboard`

Además, puede incluir otras tablas del núcleo del proyecto como tickets, logs, sugerencias, sorteos y módulos administrativos según tu estructura actual.

---

## 🧭 Roadmap Actual

## Fase 5 — APIs e Información
Pendiente de implementación:

- Fotos random — perros, gatos, pandas.
- Memes random.
- Clima por ciudad.
- Noticias del día.
- Info de películas y series.
- Letras de canciones.
- Traductor.
- Definición de palabras.
- Calculadora de expresiones.
- Acortador de links.

## Fase 6 — Economía
Estado actual:

- ✅ Balance, daily rewards.
- ✅ Banco y transferencias entre usuarios.
- ✅ Trabajo.
- ✅ Robo.
- ✅ Tienda de roles con monedas.
- ✅ Inventario.
- ❌ Inversiones con riesgo variable.

## Fase 7 — Música
Pendiente de implementación:

- Reproducir desde YouTube/Spotify.
- Cola de canciones.
- Skip, pause, resume, stop.
- Control de volumen.

## Fase 8 — Infraestructura
Pendiente:

- Dashboard Web.

---

## 📈 Resumen de Estado

| Fase | Estado |
|------|--------|
| Núcleo del bot | ✅ |
| Tickets | ✅ |
| Utilidades | ✅ |
| Economía | ✅ Parcialmente completa |
| Logros | ✅ |
| Perfiles | ✅ |
| Trivia | ✅ |
| Mascotas | ✅ |
| Reaction Roles | ✅ |
| Verificación | ✅ |
| Starboard | ✅ |
| APIs externas | ❌ Pendiente |
| Música | ❌ Pendiente |
| Dashboard Web | ❌ Pendiente |
| Inversiones | ❌ Pendiente |

---

## 🧑‍💻 Autor

**Francisco**  
*Estudiante de Ingeniería Civil Informática*

---