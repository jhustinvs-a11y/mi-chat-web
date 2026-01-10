# Chat Web con Autenticación

Una aplicación de chat web en tiempo real con sistema de autenticación, donde usuarios pueden registrarse y chatear con un administrador.

## 🚀 Demo en Vivo
[Tu chat estará aquí después del deploy]

## ✨ Características

- 🔐 **Autenticación segura** - Registro e inicio de sesión
- 👑 **Panel de administrador** - Un administrador único
- 💬 **Chat en tiempo real** - Mensajes instantáneos
- 📱 **Responsive** - Funciona en móviles y desktop
- 👥 **Múltiples usuarios** - Varios usuarios pueden chatear simultáneamente
- 💾 **Mensajes persistentes** - Los mensajes se guardan temporalmente

## 🔑 Credenciales del Administrador

- **Email:** `admin@chat.com`
- **Contraseña:** `admin123`

## 🛠️ Tecnologías

- **Backend:** Node.js + Express + Socket.io
- **Frontend:** HTML + CSS + JavaScript
- **Autenticación:** bcryptjs + express-session
- **Tiempo Real:** WebSockets

## 📦 Instalación Local

```bash
# Clonar repositorio
git clone [tu-repo-url]
cd chat-web-app

# Instalar dependencias
npm install

# Ejecutar servidor
npm start
```

Visita `http://localhost:3001`

## 🌐 Deploy en Render

1. Conecta este repositorio a Render
2. Render detectará automáticamente que es una app Node.js
3. ¡Tu chat estará online!

## 📝 Uso

1. **Para usuarios normales:**
   - Crear cuenta con email/contraseña
   - Iniciar sesión
   - Chatear con el administrador

2. **Para administrador:**
   - Usar credenciales: `admin@chat.com` / `admin123`
   - Responder a todos los usuarios

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request