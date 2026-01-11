// Variables globales
let socket;
let currentUser = null;

// Elementos del DOM
const currentUserSpan = document.getElementById('current-user');
const userRoleSpan = document.getElementById('user-role');
const logoutBtn = document.getElementById('logout-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesDiv = document.getElementById('messages');
const usersList = document.getElementById('users-list');
const usersCount = document.getElementById('users-count');
const connectionIndicator = document.getElementById('connection-indicator');
const connectionText = document.getElementById('connection-text');

// Inicializar la aplicación
async function init() {
    try {
        // Obtener información del usuario actual
        const response = await fetch('/api/user');
        if (!response.ok) {
            window.location.href = '/';
            return;
        }
        
        currentUser = await response.json();
        
        // Actualizar UI con información del usuario
        currentUserSpan.textContent = currentUser.name;
        userRoleSpan.textContent = currentUser.isAdmin ? '👑 Administrador' : '👤 Usuario';
        
        // Conectar al socket
        connectSocket();
        
    } catch (error) {
        console.error('Error al inicializar:', error);
        window.location.href = '/';
    }
}

// Conectar al socket
function connectSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Conectado al servidor');
        updateConnectionStatus(true);
        
        // Autenticar el socket
        socket.emit('authenticate', currentUser.email);
    });
    
    socket.on('disconnect', () => {
        console.log('Desconectado del servidor');
        updateConnectionStatus(false);
    });
    
    // Recibir mensajes anteriores
    socket.on('previous messages', (messages) => {
        messagesDiv.innerHTML = '';
        messages.forEach(message => displayMessage(message));
    });
    
    // Recibir nuevos mensajes
    socket.on('chat message', (message) => {
        displayMessage(message);
    });
    
    // Manejar eliminación de mensajes
    socket.on('message deleted', (messageId) => {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    });
    
    // Actualizar lista de usuarios
    socket.on('users list', (users) => {
        updateUsersList(users);
    });
    
    // Notificaciones de usuarios
    socket.on('user joined', (username) => {
        displaySystemMessage(`${username} se unió al chat`);
    });
    
    socket.on('user left', (username) => {
        displaySystemMessage(`${username} salió del chat`);
    });
}

// Actualizar estado de conexión
function updateConnectionStatus(connected) {
    const statusDot = connectionIndicator.querySelector('.status-dot');
    
    if (connected) {
        statusDot.classList.remove('disconnected');
        connectionText.textContent = 'Conectado';
    } else {
        statusDot.classList.add('disconnected');
        connectionText.textContent = 'Desconectado';
    }
}

// Mostrar mensaje en el chat
function displayMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.setAttribute('data-message-id', message.id);
    
    // Determinar si es mensaje propio
    const isOwnMessage = message.senderEmail === currentUser.email;
    if (isOwnMessage) {
        messageDiv.classList.add('own');
    }
    
    // Determinar si es del admin
    if (message.isAdmin) {
        messageDiv.classList.add('admin');
    }
    
    // Botón de eliminar (solo visible para admin y no en mensajes propios del admin)
    let deleteButton = '';
    if (currentUser.isAdmin && !isOwnMessage) {
        deleteButton = `<button class="delete-btn" onclick="deleteMessage(${message.id})" title="Eliminar mensaje">×</button>`;
    }
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <div class="message-header-left">
                <span class="message-sender ${message.isAdmin ? 'admin' : ''}">${message.senderName}</span>
            </div>
            <div class="message-header-right">
                <span class="message-time">${message.timestamp}</span>
                ${deleteButton}
            </div>
        </div>
        <div class="message-bubble">${escapeHtml(message.message)}</div>
    `;
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Función para eliminar mensaje (solo admin)
function deleteMessage(messageId) {
    if (!currentUser.isAdmin) return;
    
    if (confirm('¿Estás seguro de que quieres eliminar este mensaje?')) {
        socket.emit('delete message', messageId);
    }
}

// Mostrar mensaje del sistema
function displaySystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-message';
    messageDiv.innerHTML = `<div class="message-bubble">${escapeHtml(text)}</div>`;
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Actualizar lista de usuarios
function updateUsersList(users) {
    usersList.innerHTML = '';
    usersCount.textContent = users.length;
    
    // Siempre mostrar al admin primero si está conectado
    const adminUser = users.find(u => u.isAdmin);
    if (adminUser) {
        const li = createUserListItem(adminUser);
        usersList.appendChild(li);
    }
    
    // Mostrar usuarios normales
    users.filter(u => !u.isAdmin).forEach(user => {
        const li = createUserListItem(user);
        usersList.appendChild(li);
    });
}

// Crear elemento de usuario en la lista
function createUserListItem(user) {
    const li = document.createElement('li');
    li.className = user.isAdmin ? 'admin' : '';
    
    li.innerHTML = `
        <span class="user-status"></span>
        <span>${user.name}</span>
    `;
    
    return li;
}

// Enviar mensaje
function sendMessage() {
    const message = messageInput.value.trim();
    if (message && socket) {
        socket.emit('chat message', { message: message });
        messageInput.value = '';
        messageInput.focus();
    }
}

// Cerrar sesión
async function logout() {
    try {
        await fetch('/logout', { method: 'POST' });
        if (socket) {
            socket.disconnect();
        }
        window.location.href = '/';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        window.location.href = '/';
    }
}

// Escapar HTML para prevenir XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event listeners
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

logoutBtn.addEventListener('click', logout);

// Prevenir envío de mensajes vacíos
messageInput.addEventListener('input', () => {
    sendBtn.disabled = !messageInput.value.trim();
});

// Inicializar cuando la página carga
document.addEventListener('DOMContentLoaded', init);

// Manejar desconexión de la ventana
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.disconnect();
    }
});