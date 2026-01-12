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

// Manejar conexiones de WebSocket - SIMPLIFICADO
io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // Autenticación simple
    socket.on('authenticate', (userEmail) => {
        const user = users.get(userEmail);
        if (user) {
            socket.user = user;
            socket.userEmail = userEmail;
            
            // Actualizar lista de conectados
            connectedUsers = connectedUsers.filter(u => u.email !== userEmail);
            connectedUsers.push({
                email: userEmail,
                name: user.name,
                isAdmin: user.isAdmin,
                socketId: socket.id
            });
            
            // Enviar mensajes recientes
            socket.emit('previous messages', messages.slice(-20));
            
            // Actualizar usuarios
            io.emit('users list', connectedUsers);
            
            console.log(`${user.name} conectado`);
        }
    });

    // Manejar mensajes - SIMPLE
    socket.on('chat message', (data) => {
        if (!socket.user || !data.message) return;
        
        const msg = {
            id: Date.now(),
            senderEmail: socket.userEmail,
            senderName: socket.user.name,
            isAdmin: socket.user.isAdmin,
            message: data.message.substring(0, 500), // Limitar longitud
            timestamp: new Date().toLocaleTimeString()
        };
        
        messages.push(msg);
        
        // Mantener solo 30 mensajes
        if (messages.length > 30) {
            messages.shift();
        }
        
        io.emit('chat message', msg);
    });

    // Eliminar mensaje - SIMPLE
    socket.on('delete message', (messageId) => {
        if (!socket.user || !socket.user.isAdmin) return;
        
        const index = messages.findIndex(m => m.id == messageId);
        if (index !== -1) {
            messages.splice(index, 1);
            io.emit('message deleted', messageId);
        }
    });

    // Desconexión - SIMPLE
    socket.on('disconnect', () => {
        if (socket.user) {
            connectedUsers = connectedUsers.filter(u => u.socketId !== socket.id);
            io.emit('users list', connectedUsers);
            console.log(`${socket.user.name} desconectado`);
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Credenciales del administrador:`);
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Contraseña: ${ADMIN_PASSWORD}`);
});