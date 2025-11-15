document.addEventListener("DOMContentLoaded", () => {
    
    // Inicializar Animaciones
    AOS.init({
        duration: 800,
        once: true
    });

    // --- URL de tu script "Todo en Uno" ---
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyr1ke7O6kdS10eZR9nIutgH45Jj875o0u5bObxRwzQb3Y8AuGycUw6ZU6onv8rkPu6/exec";

    const loginForm = document.getElementById("login-form");
    const loginButton = document.getElementById("login-button");
    const loginMessage = document.getElementById("login-message");

    // --- GUARDIA: Si el usuario ya está logueado, lo mandamos al dashboard ---
    if (sessionStorage.getItem("userRole")) {
        window.location.href = "crm-dashboard.html";
    }

    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            
            const user = document.getElementById("username").value;
            const pass = document.getElementById("password").value;
            
            loginButton.disabled = true;
            loginButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Verificando...';
            loginMessage.textContent = "";
            loginMessage.className = "";

            fetch(SCRIPT_URL + "?action=login&user=" + encodeURIComponent(user) + "&pass=" + encodeURIComponent(pass))
                .then(response => response.json())
                .then(data => {
                    if (data.status === "success") {
                        loginMessage.textContent = "Acceso concedido. Redirigiendo...";
                        loginMessage.classList.add("success");
                        
                        // Guardamos el ROL y el NOMBRE
                        sessionStorage.setItem("userRole", data.rol);
                        sessionStorage.setItem("userName", user); 
                        
                        setTimeout(() => {
                            window.location.href = "crm-dashboard.html";
                        }, 1000);

                    } else {
                        throw new Error(data.message || "Error desconocido");
                    }
                })
                .catch(error => {
                    console.error("Error en el login:", error);
                    loginMessage.textContent = `Error: ${error.message}`;
                    loginMessage.classList.add("error");
                    loginButton.disabled = false;
                    loginButton.innerHTML = 'Ingresar';
                });
        });
    }
});