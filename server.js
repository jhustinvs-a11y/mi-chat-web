const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuración de sesiones
app.use(session({
    secret: 'chat-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Base de datos en memoria (para simplicidad)
const users = new Map();
const messages = [];

// Credenciales del administrador
const ADMIN_EMAIL = 'admin@chat.com';
const ADMIN_PASSWORD = 'admin123';

// Inicializar admin
users.set(ADMIN_EMAIL, {
    email: ADMIN_EMAIL,
    password: bcrypt.hashSync(ADMIN_PASSWORD, 10),
    isAdmin: true,
    name: 'Administrador'
});

// Rutas de autenticación
app.post('/register', async (req, res) => {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
        return res.json({ success: false, message: 'Todos los campos son requeridos' });
    }
    
    if (users.has(email)) {
        return res.json({ success: false, message: 'El email ya está registrado' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    users.set(email, {
        email,
        password: hashedPassword,
        isAdmin: false,
        name
    });
    
    res.json({ success: true, message: 'Usuario registrado exitosamente' });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    const user = users.get(email);
    if (!user) {
        return res.json({ success: false, message: 'Email o contraseña incorrectos' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.json({ success: false, message: 'Email o contraseña incorrectos' });
    }
    
    req.session.user = {
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin
    };
    
    res.json({ 
        success: true, 
        user: {
            email: user.email,
            name: user.name,
            isAdmin: user.isAdmin
        }
    });
});

app.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Middleware de autenticación
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/');
    }
    next();
};

// Rutas
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/chat');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/chat', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/api/user', requireAuth, (req, res) => {
    res.json(req.session.user);
});

// Lista de usuarios conectados
let connectedUsers = [];

// Manejar conexiones de WebSocket
io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);
    
    // Rate limiting por socket
    let messageCount = 0;
    let lastMessageTime = 0;
    const messageLimit = 10; // máximo 10 mensajes por minuto
    const timeWindow = 60000; // 1 minuto

    // Autenticación del socket
    socket.on('authenticate', (userEmail) => {
        const user = users.get(userEmail);
        if (user) {
            socket.user = user;
            socket.userEmail = userEmail;
            
            // Agregar a lista de conectados (evitar duplicados)
            const existingUserIndex = connectedUsers.findIndex(u => u.email === userEmail);
            if (existingUserIndex !== -1) {
                connectedUsers[existingUserIndex].socketId = socket.id;
            } else {
                connectedUsers.push({
                    email: userEmail,
                    name: user.name,
                    isAdmin: user.isAdmin,
                    socketId: socket.id
                });
            }
            
            // Enviar mensajes anteriores (solo los últimos 20)
            const recentMessages = messages.slice(-20);
            socket.emit('previous messages', recentMessages);
            
            // Notificar conexión (throttled)
            if (!user.isAdmin) {
                socket.broadcast.emit('user joined', user.name);
            }
            
            // Actualizar lista de usuarios (throttled)
            setTimeout(() => {
                io.emit('users list', connectedUsers.filter(u => !u.isAdmin));
            }, 500);
            
            console.log(`${user.name} se conectó al chat`);
        }
    });

    // Manejar mensajes del chat con rate limiting
    socket.on('chat message', (data) => {
        if (!socket.user) return;
        
        // Rate limiting
        const now = Date.now();
        if (now - lastMessageTime > timeWindow) {
            messageCount = 0;
            lastMessageTime = now;
        }
        
        messageCount++;
        if (messageCount > messageLimit) {
            socket.emit('rate_limit', 'Demasiados mensajes. Espera un momento.');
            return;
        }
        
        // Validar mensaje
        if (!data.message || typeof data.message !== 'string') return;
        if (data.message.length > 500) return;
        
        const messageData = {
            id: Date.now() + Math.random(), // ID más único
            senderEmail: socket.userEmail,
            senderName: socket.user.name,
            isAdmin: socket.user.isAdmin,
            message: data.message.trim(),
            timestamp: new Date().toLocaleTimeString(),
            date: new Date().toLocaleDateString()
        };
        
        // Guardar mensaje
        messages.push(messageData);
        
        // Limitar a 50 mensajes en memoria
        if (messages.length > 50) {
            messages.shift();
        }
        
        // Enviar mensaje a todos
        io.emit('chat message', messageData);
        
        console.log(`${socket.user.name}: ${data.message}`);
    });

    // Manejar eliminación de mensajes (solo admin)
    socket.on('delete message', (messageId) => {
        if (!socket.user || !socket.user.isAdmin) {
            console.log(`Usuario no autorizado intentó borrar mensaje: ${socket.user?.name}`);
            return;
        }
        
        // Encontrar y eliminar el mensaje
        const messageIndex = messages.findIndex(msg => msg.id == messageId);
        if (messageIndex !== -1) {
            const deletedMessage = messages[messageIndex];
            messages.splice(messageIndex, 1);
            
            // Notificar a todos que el mensaje fue eliminado
            io.emit('message deleted', messageId);
            
            console.log(`Admin ${socket.user.name} eliminó mensaje de ${deletedMessage.senderName}`);
        }
    });

    // Manejar desconexión
    socket.on('disconnect', () => {
        if (socket.user) {
            // Remover de lista de conectados
            connectedUsers = connectedUsers.filter(u => u.socketId !== socket.id);
            
            if (!socket.user.isAdmin) {
                socket.broadcast.emit('user left', socket.user.name);
            }
            
            // Actualizar lista con delay para evitar spam
            setTimeout(() => {
                io.emit('users list', connectedUsers.filter(u => !u.isAdmin));
            }, 1000);
            
            console.log(`${socket.user.name} se desconectó`);
        }
    });
    
    // Manejar errores del socket
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Credenciales del administrador:`);
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Contraseña: ${ADMIN_PASSWORD}`);
});