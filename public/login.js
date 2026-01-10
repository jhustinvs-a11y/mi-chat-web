// Elementos del DOM
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const messageDiv = document.getElementById('message');

// Formularios
const loginFormElement = document.getElementById('loginForm');
const registerFormElement = document.getElementById('registerForm');

// Cambiar entre login y registro
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    clearMessage();
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    clearMessage();
});

// Función para mostrar mensajes
function showMessage(message, type = 'error') {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
}

function clearMessage() {
    messageDiv.style.display = 'none';
    messageDiv.className = 'message';
}

// Función para mostrar loading
function setLoading(form, loading) {
    if (loading) {
        form.classList.add('loading');
    } else {
        form.classList.remove('loading');
    }
}

// Manejar login
loginFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showMessage('Por favor completa todos los campos');
        return;
    }
    
    setLoading(loginForm, true);
    clearMessage();
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Iniciando sesión...', 'success');
            setTimeout(() => {
                window.location.href = '/chat';
            }, 1000);
        } else {
            showMessage(data.message);
        }
    } catch (error) {
        showMessage('Error de conexión. Intenta de nuevo.');
    } finally {
        setLoading(loginForm, false);
    }
});

// Manejar registro
registerFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    if (!name || !email || !password) {
        showMessage('Por favor completa todos los campos');
        return;
    }
    
    if (password.length < 6) {
        showMessage('La contraseña debe tener al menos 6 caracteres');
        return;
    }
    
    setLoading(registerForm, true);
    clearMessage();
    
    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Cuenta creada exitosamente. Ahora puedes iniciar sesión.', 'success');
            setTimeout(() => {
                registerForm.classList.add('hidden');
                loginForm.classList.remove('hidden');
                document.getElementById('loginEmail').value = email;
            }, 2000);
        } else {
            showMessage(data.message);
        }
    } catch (error) {
        showMessage('Error de conexión. Intenta de nuevo.');
    } finally {
        setLoading(registerForm, false);
    }
});

// Auto-focus en el primer campo
document.getElementById('loginEmail').focus();