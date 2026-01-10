// Conectar al servidor Socket.io
const socket = io();

// Elementos del DOM
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const currentUserSpan = document.getElementById('current-user');
const leaveBtn = document.getElementById('leave-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesDiv = document.getElementById('messages');
const usersList = document.getElementById('users-list');

let currentUsername = '';

// Función para mostrar mensajes
function displayMessage(data, isSystem = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = isSystem ? 'message system-message' : 'message';
    
    if (isSystem) {
        messageDiv.innerHTML = `<div class="message-text">${data}</div>`;
    } else {
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="username">${data.username}</span>
                <span class="timestamp">${data.timestamp}</span>
            </div>
            <div class="message-text">${data.message}</div>
        `;
    }
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Función para actualizar lista de usuarios
function updateUsersList(users) {
    usersList.innerHTML = '';
    users.forEach(username => {
        const li = document.createElement('li');
        li.textContent = username;
        if (username === currentUsername) {
            li.style.background = '#667eea';
            li.style.color = 'white';
        }
        usersList.appendChild(li);
    });
}

// Función para unirse al chat
function joinChat() {
    const username = usernameInput.value.trim();
    if (username) {
        currentUsername = username;
        currentUserSpan.textContent = username;
        socket.emit('join', username);
        loginScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        messageInput.focus();
    }
}

// Función para enviar mensaje
function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit('chat message', { message: message });
        messageInput.value = '';
        messageInput.focus();
    }
}

// Función para salir del chat
function leaveChat() {
    socket.disconnect();
    location.reload();
}

// Event listeners
joinBtn.addEventListener('click', joinChat);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinChat();
    }
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

leaveBtn.addEventListener('click', leaveChat);

// Socket event listeners
socket.on('chat message', (data) => {
    displayMessage(data);
});

socket.on('user joined', (username) => {
    displayMessage(`${username} se unió al chat`, true);
});

socket.on('user left', (username) => {
    displayMessage(`${username} salió del chat`, true);
});

socket.on('users list', (users) => {
    updateUsersList(users);
});

socket.on('connect', () => {
    console.log('Conectado al servidor');
});

socket.on('disconnect', () => {
    console.log('Desconectado del servidor');
});

// Mensaje de bienvenida
window.addEventListener('load', () => {
    usernameInput.focus();
});