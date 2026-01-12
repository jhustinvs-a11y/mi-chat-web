// Variables globales
let socket;
let currentUser = null;
let isConnecting = false;
let messageQueue = [];
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

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

// Throttle para evitar spam de mensajes
let lastMessageTime = 0;
const messageThrottle = 500; // 500ms entre mensajes

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

// Conectar al socket con manejo de errores mejorado
function connectSocket() {
    if (isConnecting) return;
    isConnecting = true;
    
    socket = io({
        timeout: 10000,
        forceNew: true,
        transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
        console.log('Conectado al servidor');
        isConnecting = false;
        reconnectAttempts = 0;
        updateConnectionStatus(true);
        
        // Autenticar el socket
        socket.emit('authenticate', currentUser.email);
        
        // Procesar mensajes en cola
        processMessageQueue();
    });
    
    socket.on('disconnect', (reason) => {
        console.log('Desconectado del servidor:', reason);
        updateConnectionStatus(false);
        isConnecting = false;
        
        // Solo reconectar si no fue desconexión manual
        if (reason !== 'io client disconnect' && reconnectAttempts < maxReconnectAttempts) {
            setTimeout(() => {
                reconnectAttempts++;
                connectSocket();
            }, 2000 * reconnectAttempts);
        }
    });
    
    socket.on('connect_error', (error) => {
        console.error('Error de conexión:', error);
        isConnecting = false;
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
    
    // Actualizar lista de usuarios (con throttle)
    socket.on('users list', debounce((users) => {
        updateUsersList(users);
    }, 1000));
    
    // Notificaciones de usuarios (con throttle)
    socket.on('user joined', debounce((username) => {
        displaySystemMessage(`${username} se unió al chat`);
    }, 500));
    
    socket.on('user left', debounce((username) => {
        displaySystemMessage(`${username} salió del chat`);
    }, 500));
}

// Función debounce para evitar spam
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Procesar cola de mensajes
function processMessageQueue() {
    while (messageQueue.length > 0 && socket && socket.connected) {
        const message = messageQueue.shift();
        socket.emit('chat message', message);
    }
}

// Actualizar estado de conexión
function updateConnectionStatus(connected) {
    const statusDot = connectionIndicator.querySelector('.status-dot');
    
    if (connected) {
        statusDot.classList.remove('disconnected');
        connectionText.textContent = 'Conectado';
        sendBtn.disabled = false;
        messageInput.disabled = false;
    } else {
        statusDot.classList.add('disconnected');
        connectionText.textContent = 'Reconectando...';
        sendBtn.disabled = true;
        messageInput.disabled = true;
    }
}

// Mostrar mensaje en el chat (optimizado)
function displayMessage(message) {
    // Limitar número de mensajes en pantalla
    if (messagesDiv.children.length > 50) {
        messagesDiv.removeChild(messagesDiv.firstChild);
    }
    
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
                <span class="message-sender ${message.isAdmin ? 'admin' : ''}">${escapeHtml(message.senderName)}</span>
            </div>
            <div class="message-header-right">
                <span class="message-time">${message.timestamp}</span>
                ${deleteButton}
            </div>
        </div>
        <div class="message-bubble">${escapeHtml(message.message)}</div>
    `;
    
    messagesDiv.appendChild(messageDiv);
    
    // Scroll suave
    requestAnimationFrame(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}

// Mostrar mensaje del sistema
function displaySystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-message';
    messageDiv.innerHTML = `<div class="message-bubble">${escapeHtml(text)}</div>`;
    
    messagesDiv.appendChild(messageDiv);
    requestAnimationFrame(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
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
        <span>${escapeHtml(user.name)}</span>
    `;
    
    return li;
}

// Enviar mensaje con throttle
function sendMessage() {
    const now = Date.now();
    if (now - lastMessageTime < messageThrottle) {
        return; // Ignorar si es muy rápido
    }
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Validar longitud del mensaje
    if (message.length > 500) {
        alert('El mensaje es demasiado largo. Máximo 500 caracteres.');
        return;
    }
    
    lastMessageTime = now;
    
    if (socket && socket.connected) {
        socket.emit('chat message', { message: message });
        messageInput.value = '';
        messageInput.focus();
    } else {
        // Agregar a cola si no está conectado
        messageQueue.push({ message: message });
        messageInput.value = '';
        alert('Mensaje guardado. Se enviará cuando se restablezca la conexión.');
    }
}

// Función para eliminar mensaje (solo admin)
function deleteMessage(messageId) {
    if (!currentUser.isAdmin) return;
    
    if (confirm('¿Estás seguro de que quieres eliminar este mensaje?')) {
        if (socket && socket.connected) {
            socket.emit('delete message', messageId);
        }
    }
}

// Cerrar sesión
async function logout() {
    try {
        if (socket) {
            socket.disconnect();
        }
        await fetch('/logout', { method: 'POST' });
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
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

logoutBtn.addEventListener('click', logout);

// Prevenir envío de mensajes vacíos
messageInput.addEventListener('input', debounce(() => {
    sendBtn.disabled = !messageInput.value.trim() || !socket || !socket.connected;
}, 100));

// Inicializar cuando la página carga
document.addEventListener('DOMContentLoaded', init);

// Manejar desconexión de la ventana
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.disconnect();
    }
});

// Manejar visibilidad de la página para pausar reconexiones
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Página oculta, pausar reconexiones agresivas
        if (socket) {
            socket.disconnect();
        }
    } else {
        // Página visible, reconectar si es necesario
        if (!socket || !socket.connected) {
            setTimeout(connectSocket, 1000);
        }
    }
});