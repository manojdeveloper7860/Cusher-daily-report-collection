// ============================================
// API CONFIGURATION
// ============================================
const CONFIG = {
  // Your Google Apps Script Deployment URL
  API_URL: 'https://script.google.com/macros/s/AKfycbzb_kvG47Pi2Ip261ls6Ub5nbYmDGQlfcg5fTVJ4v3YG9gbb3ITS5MEDvmhwRGWiXKq/exec',
  
  // App Info
  APP_NAME: 'Daily Plant Production Report',
  VERSION: '1.0.0'
};

// ============================================
// API HELPER FUNCTION
// ============================================
async function apiCall(action, data = {}) {
  try {
    const payload = { action: action, ...data };
    
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      mode: 'no-cors', // Required for Google Apps Script
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });
    
    // Note: With no-cors, we can't read the response directly
    // We need to use JSONP-style approach or use a different method
    
    // Alternative: Use fetch with proper CORS
    const properResponse = await fetch(CONFIG.API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await properResponse.json();
    return result;
    
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: 'Network error: ' + error.message };
  }
}

// Session management
function saveSession(user) {
  localStorage.setItem('plantUser', JSON.stringify(user));
  localStorage.setItem('plantLoginTime', new Date().getTime());
}

function getSession() {
  try {
    const user = localStorage.getItem('plantUser');
    return user ? JSON.parse(user) : null;
  } catch(e) {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem('plantUser');
  localStorage.removeItem('plantLoginTime');
}

function isSessionValid() {
  const loginTime = localStorage.getItem('plantLoginTime');
  if (!loginTime) return false;
  
  // Session valid for 8 hours
  const hoursElapsed = (new Date().getTime() - parseInt(loginTime)) / (1000 * 60 * 60);
  return hoursElapsed < 8;
}
