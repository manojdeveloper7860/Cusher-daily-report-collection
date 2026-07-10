// ============================================
// LOGIN PAGE LOGIC
// ============================================

// Check if already logged in
document.addEventListener('DOMContentLoaded', function() {
  if (getSession() && isSessionValid()) {
    window.location.href = 'dashboard.html';
  }
});

document.getElementById('loginForm').addEventListener('submit', function(e) {
  e.preventDefault();
  handleLogin();
});

async function handleLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorMsg = document.getElementById('errorMsg');
  const loginBtn = document.getElementById('loginBtn');
  const spinner = document.getElementById('loadingSpinner');
  
  errorMsg.style.display = 'none';
  loginBtn.disabled = true;
  spinner.style.display = 'block';
  
  try {
    const result = await apiCall('login', { username, password });
    
    spinner.style.display = 'none';
    
    if (result.success) {
      saveSession(result.user);
      showSuccess('Login successful! Redirecting...');
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 800);
    } else {
      errorMsg.textContent = result.message || 'Login failed';
      errorMsg.style.display = 'block';
      loginBtn.disabled = false;
    }
  } catch (error) {
    spinner.style.display = 'none';
    errorMsg.textContent = 'Connection error. Please try again.';
    errorMsg.style.display = 'block';
    loginBtn.disabled = false;
  }
}

function showSuccess(message) {
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.style.background = '#e8f5e9';
  errorMsg.style.color = '#2e7d32';
  errorMsg.textContent = message;
  errorMsg.style.display = 'block';
}
