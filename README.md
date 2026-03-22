# 🤖 Discord Global Engine | Enterprise-Grade Automation

Sistema de automatización modular y multi-servidor (Multi-Tenant) desarrollado en **Node.js**. Diseñado para ofrecer escalabilidad y personalización total en comunidades de gran escala, integrando persistencia de datos relacionales y una interfaz de usuario avanzada.

---

## 💎 Características Destacadas

### 📂 Arquitectura Multi-Servidor
A diferencia de los bots básicos, este sistema utiliza una base de datos **SQLite** para aislar las configuraciones de cada servidor. Cada comunidad tiene su propia "parcela" de datos para bienvenidas, roles de staff y logs.

### 🎫 Sistema de Tickets de Alto Nivel
- **Personalización Total**: Los administradores definen el mensaje, la imagen y la bienvenida interna del ticket.
- **Anti-Spam**: Validación por caché para evitar que un usuario abra múltiples canales simultáneamente.
- **Auditoría Automatizada**: Generación de Transcripts en HTML profesional enviados por DM y a canales de log internos.

### 📊 Monitor de Rendimiento
Comando `/status` que reporta latencia de API, uso de memoria RAM, uptime detallado y especificaciones del OS en tiempo real.

---

## 🛠️ Stack Tecnológico

* **Runtime**: Node.js
* **Framework**: Discord.js v14
* **Base de Datos**: Better-SQLite3 (Motor SQL optimizado)
* **Documentación de Tickets**: Discord HTML Transcripts
* **Tooling**: Nodemon para hot-reloading y Dotenv para seguridad

## 🚀 Instalación y Despliegue

### 1. Requisitos previos
* **Node.js**: Versión v16.11.0 o superior.
* **Discord Application**: Una aplicación creada en el [Discord Developer Portal](https://discord.com/developers/applications).
* **Dependencias**: Haber ejecutado `npm install` para instalar todas las librerías necesarias.

### 2. Configuración del Entorno 🔐

Crea un archivo llamado `.env` en la raíz del proyecto para gestionar tus credenciales. La estructura debe ser la siguiente:

> **Archivo `.env`**
>
> `TOKEN` = **tu_discord_token_aquí**
> 
> `CLIENT_ID` = **id_de_tu_bot_aquí**


### 3. Scripts de Ejecución (DX)
Hemos automatizado el flujo de trabajo para optimizar el desarrollo mediante scripts en el archivo `package.json`:

* **`npm run deploy`**: Sincroniza y registra todos los Slash Commands con la API de Discord.
* **`npm run dev`**: Ejecuta el despliegue de comandos e inicia el bot con `nodemon` para permitir el hot-reloading (reinicio automático al guardar cambios).
* **`npm start`**: Inicia el bot en el entorno de producción de forma estable.

---

## 📌 Guía de Comandos Principales

| Comando | Categoría | Descripción |
| :--- | :--- | :--- |
| `🛡️ /settings` | **Admin** | Configura canales de bienvenida, logs y roles de staff de forma persistente en la DB. |
| `📩 /setup-tickets`| **Admin** | Despacha un panel de soporte 100% personalizado (mensajes, imágenes y preferencias de DM). |
| `🛠️ /help` | **Utility**| Menú interactivo con selección de categorías dinámicas cargadas desde la memoria del bot. |
| `🖥️ /status` | **Utility**| Dashboard técnico con latencia API, uso de memoria RAM y uptime detallado del sistema. |

---

## 🗺️ Roadmap de Ingeniería (Línea de Tiempo)

Este proyecto sigue un ciclo de **Mejora Continua (CI)**. Próximos hitos en el desarrollo:

- **Fase 1**: 🏗️ **Sistema de Sorteos (Giveaways)** con persistencia en DB para resistir reinicios críticos.
- **Fase 2**: 🎨 **Bienvenidas Dinámicas** mediante generación de buffers de imagen con `canvas`.
- **Fase 3**: 🛡️ **Logs de Auditoría Global** para monitoreo de cambios de roles y mensajes eliminados.
- **Fase 4**: 📊 **Dashboard Web** para administración externa de las bases de datos SQLite.

---
**Desarrollado por Francisco** *Estudiante de Ingeniería Civil Informática*