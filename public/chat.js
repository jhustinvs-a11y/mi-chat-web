// Variables globales
let socket;
let currentUser = null;
let isConnected = false;

// Elementos del DOM
const currentUserSpan = document.getElementById('current-user');
const userRoleSpan = document.getElementById('user-role');
const logoutBtn = document.getElementById('logout-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesDiv = document.getElementById('messages');
const usersList = document.getElementById('users-list');
const usersCount = document.getElementById('users-count');
const connectionText = document.getElementById('connection-text');

// Inicializar la aplicación
async function init() {
    try {
        const response = await fetch('/api/user');
        if (!response.ok) {
            window.location.href = '/';
            return;
        }
        
        currentUser = await response.json();
        currentUserSpan.textContent = currentUser.name;
        userRoleSpan.textContent = currentUser.isAdmin ? '👑 Administrador' : '👤 Usuario';
        
        connectSocket();
        
    } catch (error) {
        console.error('Error:', error);
        window.location.href = '/';
    }
}

// Conectar socket - SIMPLIFICADO
function connectSocket() {
    socket = io({
        timeout: 5000,
        forceNew: true
    });
    
    socket.on('connect', () => {
        isConnected = true;
        connectionText.textContent = 'Conectado';
        sendBtn.disabled = false;
        socket.emit('authenticate', currentUser.email);
    });
    
    socket.on('disconnect', () => {
        isConnected = false;
        connectionText.textContent = 'Desconectado';
        sendBtn.disabled = true;
    });
    
    socket.on('previous messages', (messages) => {
        messagesDiv.innerHTML = '';
        messages.forEach(msg => addMessage(msg));
    });
    
    socket.on('chat message', (message) => {
        addMessage(message);
    });
    
    socket.on('message deleted', (messageId) => {
        const element = document.querySelector(`[data-id="${messageId}"]`);
        if (element) element.remove();
    });
    
    socket.on('users list', (users) => {
        updateUsers(users);
    });
}

// Agregar mensaje - ULTRA SIMPLIFICADO
function addMessage(msg) {
    const div = document.createElement('div');
    div.className = 'message';
    div.setAttribute('data-id', msg.id);
    
    if (msg.senderEmail === currentUser.email) {
        div.classList.add('own');
    }
    if (msg.isAdmin) {
        div.classList.add('admin');
    }
    
    let deleteBtn = '';
    if (currentUser.isAdmin) {
        deleteBtn = `<button onclick="deleteMsg(${msg.id})">×</button>`;
    }
    
    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 5px;">
            <span>${msg.senderName}</span>
            <span>${msg.timestamp} ${deleteBtn}</span>
        </div>
        <div style="background: ${msg.isAdmin ? '#667eea' : (msg.senderEmail === currentUser.email ? '#007bff' : '#f1f3f4')}; 
                    color: ${msg.isAdmin || msg.senderEmail === currentUser.email ? 'white' : 'black'}; 
                    padding: 8px 12px; border-radius: 15px; word-wrap: break-word;">
            ${msg.message}
        </div>
    `;
    
    messagesDiv.appendChild(div);
    
    // Limitar mensajes
    if (messagesDiv.children.length > 30) {
        messagesDiv.removeChild(messagesDiv.firstChild);
    }
    
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Actualizar usuarios - SIMPLIFICADO
function updateUsers(users) {
    usersList.innerHTML = '';
    usersCount.textContent = users.length;
    
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user.name;
        if (user.isAdmin) li.style.background = '#667eea';
        if (user.isAdmin) li.style.color = 'white';
        usersList.appendChild(li);
    });
}

// Enviar mensaje - SIMPLIFICADO
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !isConnected) return;
    
    socket.emit('chat message', { message: text });
    messageInput.value = '';
}

// Eliminar mensaje
function deleteMsg(id) {
    if (currentUser.isAdmin && confirm('¿Eliminar mensaje?')) {
        socket.emit('delete message', id);
    }
}

// Cerrar sesión
async function logout() {
    if (socket) socket.disconnect();
    await fetch('/logout', { method: 'POST' });
    window.location.href = '/';
}

// Event listeners - MÍNIMOS
sendBtn.onclick = sendMessage;
logoutBtn.onclick = logout;

messageInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
};

// Inicializar
document.addEventListener('DOMContentLoaded', init);