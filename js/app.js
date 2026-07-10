// ============================================
// GLOBAL VARIABLES
// ============================================
let currentUser = null;
let currentSection = 'dashboard';
let editingUserRowIndex = null;
let editingSiteRowIndex = null;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  // Check session
  currentUser = getSession();
  if (!currentUser || !isSessionValid()) {
    window.location.href = 'index.html';
    return;
  }
  
  initializeApp();
  setupNavigation();
});

function initializeApp() {
  // Set user info
  document.getElementById('userName').textContent = currentUser.fullName || currentUser.username;
  document.getElementById('userRole').textContent = currentUser.role;
  document.getElementById('userAvatar').textContent = (currentUser.fullName || currentUser.username).charAt(0).toUpperCase();
  
  // Set current date
  const today = new Date();
  document.getElementById('currentDate').textContent = today.toLocaleDateString('en-IN', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  
  const todayISO = today.toISOString().split('T')[0];
  document.getElementById('dashDate').value = todayISO;
  document.getElementById('entryDate').value = todayISO;
  document.getElementById('reportDate').value = todayISO;
  
  // Hide admin features for non-admins
  if (currentUser.role !== 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }
  
  // Load initial data
  loadSitesDropdown();
  loadDashboard();
  loadEntryDates();
}

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const section = this.getAttribute('data-section');
      showSection(section, this);
    });
  });
}

function showSection(sectionId, navElement) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + sectionId).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navElement) navElement.classList.add('active');
  
  const titles = {
    'dashboard': { title: 'Dashboard', subtitle: 'Daily Production Overview' },
    'entry': { title: 'Daily Entry', subtitle: 'Enter daily production data' },
    'reports': { title: 'Reports', subtitle: 'Generate and download PDF reports' },
    'history': { title: 'History', subtitle: 'View past entries' },
    'users': { title: 'User Management', subtitle: 'Manage system users' },
    'sites': { title: 'Site Management', subtitle: 'Manage plant sites' }
  };
  
  document.getElementById('pageTitle').textContent = titles[sectionId].title;
  document.getElementById('pageSubtitle').textContent = titles[sectionId].subtitle;
  currentSection = sectionId;
  
  if (sectionId === 'users') loadUsers();
  if (sectionId === 'sites') loadSites();
  if (sectionId === 'history') loadEntryDates();
  
  document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ============================================
// LOAD SITES DROPDOWN
// ============================================
async function loadSitesDropdown() {
  try {
    const result = await apiCall('getSites');
    const sites = result.sites || [];
    
    const dropdowns = ['dashSite', 'reportSite', 'historySite', 'userSiteName'];
    dropdowns.forEach(id => {
      const select = document.getElementById(id);
      if (select) {
        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);
        
        sites.forEach(site => {
          const opt = document.createElement('option');
          opt.value = site;
          opt.textContent = site;
          select.appendChild(opt);
        });
      }
    });
    
    if (currentUser.siteName && currentUser.siteName !== 'All') {
      const dashSite = document.getElementById('dashSite');
      const reportSite = document.getElementById('reportSite');
      if (dashSite) dashSite.value = currentUser.siteName;
      if (reportSite) reportSite.value = currentUser.siteName;
    }
  } catch (error) {
    console.error('Error loading sites:', error);
  }
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
  const date = document.getElementById('dashDate').value;
  const site = document.getElementById('dashSite').value;
  
  try {
    const data = await apiCall('getDashboard', { siteName: site, dateFilter: date });
    updateSummaryCards(data.summary || {});
    updateCategorySummary(data.summary?.categoryWise || {});
    updateDetailTable(data.entries || []);
  } catch (error) {
    showToast('Error loading dashboard', 'error');
  }
}

function updateSummaryCards(summary) {
  document.getElementById('totalPlants').textContent = summary.totalPlants || 0;
  document.getElementById('workingPlants').textContent = summary.workingPlants || 0;
  document.getElementById('idlePlants').textContent = summary.idlePlants || 0;
  document.getElementById('todayProd').textContent = formatNumber(summary.totalDayProduction || 0);
  document.getElementById('monthProd').textContent = formatNumber(summary.totalMonthProduction || 0);
  document.getElementById('balanceProd').textContent = formatNumber(summary.totalBalance || 0);
}

function updateCategorySummary(categoryWise) {
  const tbody = document.getElementById('categorySummaryBody');
  const categoryNames = {
    'CrusherPlant09': 'CRUSHER PLANT 09',
    'RMCPlants': 'RMC PLANTS',
    'WMMPlant02': 'WMM PLANT 02',
    'HotMixPlant01': 'HOT MIX PLANT 01',
    'SandWashPlant05': 'SAND WASH PLANT 05'
  };
  
  if (!categoryWise || Object.keys(categoryWise).length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="no-data">No data available</td></tr>';
    return;
  }
  
  let html = '';
  for (const [cat, data] of Object.entries(categoryWise)) {
    html += `<tr>
      <td style="text-align:left; font-weight:600;">${categoryNames[cat] || cat}</td>
      <td>${data.count}</td>
      <td><span class="status-working">${data.working}</span></td>
      <td><span class="status-idle">${data.idle}</span></td>
      <td style="font-weight:600;">${formatNumber(data.dayProduction)}</td>
      <td>${formatNumber(data.monthProduction)}</td>
    </tr>`;
  }
  tbody.innerHTML = html;
}

function updateDetailTable(entries) {
  const tbody = document.getElementById('detailTableBody');
  
  if (!entries || entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="no-data">No entries found</td></tr>';
    return;
  }
  
  const categoryNames = {
    'CrusherPlant09': 'Crusher',
    'RMCPlants': 'RMC',
    'WMMPlant02': 'WMM',
    'HotMixPlant01': 'Hot Mix',
    'SandWashPlant05': 'Sand Wash'
  };
  
  let html = '';
  entries.forEach((entry, idx) => {
    const reason = entry['Reason'] || '';
    const todayProd = parseFloat(entry['TodayProduction'] || 0);
    const isWorking = todayProd > 0;
    const statusClass = isWorking ? 'status-working' : 'status-idle';
    
    html += `<tr>
      <td>${idx + 1}</td>
      <td><span style="font-size:10px; background:#e8eaf6; padding:2px 6px; border-radius:4px;">${categoryNames[entry['PlantCategory']] || entry['PlantCategory'] || ''}</span></td>
      <td style="text-align:left; font-weight:500;">${entry['PlantName'] || ''}</td>
      <td style="text-align:left;">${entry['SiteName'] || ''}</td>
      <td>${entry['Capacity'] || ''}</td>
      <td>${formatNumber(entry['PrevDayProduction'])}</td>
      <td style="font-weight:700; color:#1565c0;">${formatNumber(entry['TodayProduction'])}</td>
      <td>${formatNumber(entry['ThisMonth'])}</td>
      <td>${formatNumber(entry['UpToDate'])}</td>
      <td>${formatNumber(entry['ProjectRequirement'])}</td>
      <td>${formatNumber(entry['BalanceProduction'])}</td>
      <td><span class="${statusClass}" title="${reason}">${reason.substring(0, 50)}${reason.length > 50 ? '...' : ''}</span></td>
    </tr>`;
  });
  
  tbody.innerHTML = html;
}

// ============================================
// DAILY ENTRY
// ============================================
async function loadPlantsForEntry() {
  const category = document.getElementById('entryCategory').value;
  if (!category) {
    showToast('Please select a plant category', 'error');
    return;
  }
  
  document.getElementById('entryLoading').style.display = 'block';
  document.getElementById('entryFormContainer').style.display = 'none';
  
  try {
    const plants = await apiCall('getPlants', { category });
    renderEntryForm(plants || []);
    document.getElementById('entryLoading').style.display = 'none';
    document.getElementById('entryFormContainer').style.display = 'block';
  } catch (error) {
    document.getElementById('entryLoading').style.display = 'none';
    showToast('Error loading plants', 'error');
  }
}

function renderEntryForm(plants) {
  const tbody = document.getElementById('entryTableBody');
  
  if (!plants || plants.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="no-data">No plants found</td></tr>';
    return;
  }
  
  let filteredPlants = plants;
  if (currentUser.role === 'operator' && currentUser.siteName !== 'All') {
    filteredPlants = plants.filter(p => p.siteName === currentUser.siteName);
    if (filteredPlants.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" class="no-data">No plants for site: ${currentUser.siteName}</td></tr>`;
      return;
    }
  }
  
  let html = '';
  filteredPlants.forEach((plant, idx) => {
    html += `<tr data-index="${idx}">
      <td>${plant.srNo || idx + 1}</td>
      <td style="text-align:left; font-weight:500; font-size:11px;">${plant.plantName}</td>
      <td style="text-align:left; font-size:11px;">${plant.siteName}</td>
      <td style="font-size:11px;">${plant.contactNo || ''}</td>
      <td style="font-size:11px;">${plant.capacity || ''}</td>
      <td><input type="number" step="0.01" min="0" class="entry-prevday" value="0"></td>
      <td><input type="number" step="0.01" min="0" class="entry-today" value="0" 
          style="border-color:#1565c0; font-weight:600;" onchange="calculateBalance(${idx})"></td>
      <td><input type="number" step="0.01" min="0" class="entry-month" value="0"></td>
      <td><input type="number" step="0.01" min="0" class="entry-uptodate" value="0" 
          onchange="calculateBalance(${idx})"></td>
      <td><input type="number" step="0.01" min="0" class="entry-projreq" value="0" 
          onchange="calculateBalance(${idx})"></td>
      <td><input type="number" step="0.01" class="entry-balance" value="0" readonly 
          style="background:#f5f5f5;"></td>
      <td><textarea class="entry-reason" placeholder="Working / Idle reason..." rows="1"></textarea></td>
    </tr>`;
  });
  
  tbody.innerHTML = html;
}

function calculateBalance(idx) {
  const row = document.querySelector(`tr[data-index="${idx}"]`);
  if (!row) return;
  const projReq = parseFloat(row.querySelector('.entry-projreq').value) || 0;
  const upToDate = parseFloat(row.querySelector('.entry-uptodate').value) || 0;
  row.querySelector('.entry-balance').value = (projReq - upToDate).toFixed(2);
}

async function saveAllEntries() {
  const date = document.getElementById('entryDate').value;
  const category = document.getElementById('entryCategory').value;
  
  if (!date || !category) {
    showToast('Please select date and category', 'error');
    return;
  }
  
  const rows = document.querySelectorAll('#entryTableBody tr[data-index]');
  const entries = [];
  
  rows.forEach(row => {
    const todayProd = parseFloat(row.querySelector('.entry-today').value) || 0;
    const reason = row.querySelector('.entry-reason').value;
    
    if (todayProd > 0 || reason) {
      entries.push({
        date: date,
        plantCategory: category,
        srNo: row.cells[0].textContent,
        plantName: row.cells[1].textContent,
        siteName: row.cells[2].textContent,
        contactNo: row.cells[3].textContent,
        capacity: row.cells[4].textContent,
        prevDayProduction: parseFloat(row.querySelector('.entry-prevday').value) || 0,
        todayProduction: todayProd,
        thisMonth: parseFloat(row.querySelector('.entry-month').value) || 0,
        upToDate: parseFloat(row.querySelector('.entry-uptodate').value) || 0,
        projectRequirement: parseFloat(row.querySelector('.entry-projreq').value) || 0,
        balanceProduction: parseFloat(row.querySelector('.entry-balance').value) || 0,
        reason: reason,
        enteredBy: currentUser.username
      });
    }
  });
  
  if (entries.length === 0) {
    showToast('No data to save', 'error');
    return;
  }
  
  const saveBtn = document.querySelector('.entry-actions .btn-success');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  
  try {
    const result = await apiCall('saveEntries', { entries });
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save All Entries';
    showToast(result.message, result.success ? 'success' : 'error');
  } catch (error) {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save All Entries';
    showToast('Error saving entries', 'error');
  }
}

function clearEntryForm() {
  document.querySelectorAll('#entryTableBody input').forEach(input => {
    if (input.type === 'number') input.value = '0';
  });
  document.querySelectorAll('#entryTableBody textarea').forEach(ta => ta.value = '');
  showToast('Form cleared', 'info');
}

// ============================================
// PDF & REPORTS
// ============================================
async function generatePDFReport() {
  const date = document.getElementById('reportDate').value;
  const site = document.getElementById('reportSite').value;
  
  document.getElementById('pdfLoading').style.display = 'block';
  document.getElementById('pdfResult').style.display = 'none';
  
  try {
    const result = await apiCall('generatePDF', { dateFilter: date, siteName: site });
    document.getElementById('pdfLoading').style.display = 'none';
    
    if (result.success) {
      document.getElementById('pdfResult').style.display = 'block';
      document.getElementById('pdfDownloadLink').href = result.downloadUrl;
      document.getElementById('pdfViewLink').href = result.url;
      showToast('PDF generated!', 'success');
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    document.getElementById('pdfLoading').style.display = 'none';
    showToast('PDF generation failed', 'error');
  }
}

async function previewReport() {
  const date = document.getElementById('reportDate').value;
  const site = document.getElementById('reportSite').value;
  const preview = document.getElementById('reportPreview');
  
  preview.innerHTML = '<div style="text-align:center; padding:20px;"><div class="spinner-lg"></div></div>';
  
  try {
    const data = await apiCall('getReportData', { reportDate: date, siteName: site });
    
    if (!data.categories || Object.keys(data.categories).length === 0) {
      preview.innerHTML = '<p class="no-data">No data found</p>';
      return;
    }
    
    const categoryNames = {
      'CrusherPlant09': 'CRUSHER PLANT 09',
      'RMCPlants': 'RMC PLANTS',
      'WMMPlant02': 'WMM PLANT 02',
      'HotMixPlant01': 'HOT MIX PLANT 01',
      'SandWashPlant05': 'SAND WASH PLANT 05'
    };
    
    let html = `<h3 style="text-align:center; margin-bottom:15px;">Production Report - ${date || 'All Dates'}</h3>`;
    
    for (const [cat, entries] of Object.entries(data.categories)) {
      html += `<h4 style="background:#e8eaf6; padding:8px 12px; border-radius:6px; margin:15px 0 10px;">${categoryNames[cat] || cat}</h4>`;
      html += `<div class="table-responsive"><table class="data-table">
        <thead><tr>
          <th>Sr</th><th>Plant Name</th><th>Site</th><th>Capacity</th>
          <th>Today</th><th>This Month</th><th>Up to Date</th><th>Balance</th><th>Reason</th>
        </tr></thead><tbody>`;
      
      entries.forEach((entry, idx) => {
        html += `<tr>
          <td>${idx + 1}</td>
          <td style="text-align:left;">${entry['PlantName'] || ''}</td>
          <td style="text-align:left;">${entry['SiteName'] || ''}</td>
          <td>${entry['Capacity'] || ''}</td>
          <td style="font-weight:700;">${formatNumber(entry['TodayProduction'])}</td>
          <td>${formatNumber(entry['ThisMonth'])}</td>
          <td>${formatNumber(entry['UpToDate'])}</td>
          <td>${formatNumber(entry['BalanceProduction'])}</td>
          <td style="text-align:left; font-size:10px;">${(entry['Reason'] || '').substring(0, 60)}</td>
        </tr>`;
      });
      
      html += `</tbody></table></div>`;
    }
    
    preview.innerHTML = html;
  } catch (error) {
    preview.innerHTML = '<p class="no-data">Error loading preview</p>';
  }
}

// ============================================
// HISTORY
// ============================================
async function loadEntryDates() {
  try {
    const result = await apiCall('getEntryDates');
    const dates = result.dates || [];
    
    const select = document.getElementById('historyDate');
    select.innerHTML = '<option value="">-- Select Date --</option>';
    dates.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = formatDate(d);
      select.appendChild(opt);
    });
  } catch (error) {
    console.error('Error loading dates:', error);
  }
}

async function loadHistory() {
  const date = document.getElementById('historyDate').value;
  const site = document.getElementById('historySite').value;
  if (!date) {
    showToast('Please select a date', 'info');
    return;
  }
  
  const tbody = document.getElementById('historyTableBody');
  tbody.innerHTML = '<tr><td colspan="10" class="no-data"><div class="spinner-lg" style="margin:0 auto;"></div></td></tr>';
  
  try {
    const data = await apiCall('getDashboard', { siteName: site, dateFilter: date });
    
    if (!data.entries || data.entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="no-data">No entries for this date</td></tr>';
      return;
    }
    
    let html = '';
    data.entries.forEach(entry => {
      const reason = entry['Reason'] || '';
      const isWorking = parseFloat(entry['TodayProduction'] || 0) > 0;
      
      html += `<tr>
        <td>${formatDate(entry['Date'])}</td>
        <td>${entry['PlantCategory'] || ''}</td>
        <td style="text-align:left;">${entry['PlantName'] || ''}</td>
        <td style="text-align:left;">${entry['SiteName'] || ''}</td>
        <td style="font-weight:600;">${formatNumber(entry['TodayProduction'])}</td>
        <td>${formatNumber(entry['ThisMonth'])}</td>
        <td>${formatNumber(entry['UpToDate'])}</td>
        <td>${formatNumber(entry['BalanceProduction'])}</td>
        <td><span class="${isWorking ? 'status-working' : 'status-idle'}">${reason.substring(0, 30)}</span></td>
        <td>${entry['EnteredBy'] || ''}</td>
      </tr>`;
    });
    
    tbody.innerHTML = html;
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="10" class="no-data">Error loading history</td></tr>';
  }
}

// ============================================
// USER MANAGEMENT
// ============================================
async function loadUsers() {
  try {
    const result = await apiCall('getUsers');
    const users = result.users || [];
    
    const tbody = document.getElementById('usersTableBody');
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="no-data">No users</td></tr>';
      return;
    }
    
    let html = '';
    users.forEach(user => {
      const statusColor = user.status === 'Active' ? 'status-working' : 'status-idle';
      const roleColor = user.role === 'admin' ? '#c62828' : user.role === 'operator' ? '#1565c0' : '#6a1b9a';
      
      html += `<tr>
        <td style="font-weight:600;">${user.username}</td>
        <td>${user.fullName || ''}</td>
        <td style="font-size:11px;">${user.email || '-'}</td>
        <td style="font-size:11px;">${user.phone || '-'}</td>
        <td style="text-align:left;">${user.siteName}</td>
        <td><span style="background:${roleColor}; color:white; padding:3px 10px; border-radius:12px; font-size:10px; font-weight:600;">${user.role.toUpperCase()}</span></td>
        <td><span class="${statusColor}">${user.status}</span></td>
        <td>
          <button class="btn btn-sm btn-primary" onclick='editUser(${JSON.stringify(user).replace(/'/g, "&#39;")})' title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm ${user.status === 'Active' ? 'btn-secondary' : 'btn-success'}" 
            onclick="toggleStatus(${user.rowIndex}, '${user.status === 'Active' ? 'Inactive' : 'Active'}')" 
            title="${user.status === 'Active' ? 'Deactivate' : 'Activate'}">
            <i class="fas fa-${user.status === 'Active' ? 'ban' : 'check'}"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteUser(${user.rowIndex}, '${user.username}')" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>`;
    });
    
    tbody.innerHTML = html;
  } catch (error) {
    showToast('Error loading users', 'error');
  }
}

function showAddUserModal() {
  editingUserRowIndex = null;
  document.getElementById('userModalTitle').textContent = 'Add New User';
  document.getElementById('userSaveBtn').innerHTML = '<i class="fas fa-save"></i> Add User';
  
  document.getElementById('userFullName').value = '';
  document.getElementById('userUsername').value = '';
  document.getElementById('userPassword').value = '';
  document.getElementById('userEmail').value = '';
  document.getElementById('userPhone').value = '';
  document.getElementById('userSiteName').value = 'All';
  document.getElementById('userRole2').value = 'operator';
  document.getElementById('userStatus').value = 'Active';
  document.getElementById('userUsername').disabled = false;
  
  document.getElementById('userModal').style.display = 'flex';
}

function editUser(user) {
  editingUserRowIndex = user.rowIndex;
  document.getElementById('userModalTitle').textContent = 'Edit User';
  document.getElementById('userSaveBtn').innerHTML = '<i class="fas fa-save"></i> Update User';
  
  document.getElementById('userFullName').value = user.fullName || '';
  document.getElementById('userUsername').value = user.username;
  document.getElementById('userUsername').disabled = true;
  document.getElementById('userPassword').value = '';
  document.getElementById('userPassword').placeholder = 'Leave blank to keep current';
  document.getElementById('userEmail').value = user.email || '';
  document.getElementById('userPhone').value = user.phone || '';
  document.getElementById('userSiteName').value = user.siteName;
  document.getElementById('userRole2').value = user.role;
  document.getElementById('userStatus').value = user.status;
  
  document.getElementById('userModal').style.display = 'flex';
}

async function saveUser() {
  const userData = {
    fullName: document.getElementById('userFullName').value.trim(),
    username: document.getElementById('userUsername').value.trim(),
    password: document.getElementById('userPassword').value,
    email: document.getElementById('userEmail').value.trim(),
    phone: document.getElementById('userPhone').value.trim(),
    siteName: document.getElementById('userSiteName').value,
    role: document.getElementById('userRole2').value,
    status: document.getElementById('userStatus').value
  };
  
  if (!userData.username || !userData.fullName) {
    showToast('Username and Full Name required', 'error');
    return;
  }
  
  if (!editingUserRowIndex && !userData.password) {
    showToast('Password required for new user', 'error');
    return;
  }
  
  const btn = document.getElementById('userSaveBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  
  try {
    let result;
    if (editingUserRowIndex) {
      userData.rowIndex = editingUserRowIndex;
      result = await apiCall('updateUser', { userData });
    } else {
      result = await apiCall('addUser', { userData });
    }
    
    btn.disabled = false;
    btn.innerHTML = editingUserRowIndex ? '<i class="fas fa-save"></i> Update User' : '<i class="fas fa-save"></i> Add User';
    
    if (result.success) {
      showToast(result.message, 'success');
      closeModal('userModal');
      loadUsers();
      loadSitesDropdown();
    } else {
      showToast(result.message, 'error');
    }
  } catch (error) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save';
    showToast('Error saving user', 'error');
  }
}

async function toggleStatus(rowIndex, newStatus) {
  try {
    const result = await apiCall('toggleUserStatus', { rowIndex, status: newStatus });
    showToast(result.message, result.success ? 'success' : 'error');
    loadUsers();
  } catch (error) {
    showToast('Error updating status', 'error');
  }
}

function confirmDeleteUser(rowIndex, username) {
  document.getElementById('confirmMessage').innerHTML = 
    `Delete user <strong>${username}</strong>?<br><small style="color:#c62828;">This cannot be undone.</small>`;
  document.getElementById('confirmActionBtn').onclick = async function() {
    try {
      const result = await apiCall('deleteUser', { rowIndex });
      closeModal('confirmModal');
      showToast(result.message, result.success ? 'success' : 'error');
      loadUsers();
    } catch (error) {
      showToast('Error deleting user', 'error');
    }
  };
  document.getElementById('confirmModal').style.display = 'flex';
}

// ============================================
// SITE MANAGEMENT
// ============================================
async function loadSites() {
  try {
    const result = await apiCall('getAllSitesMaster');
    const sites = result.sites || [];
    
    const tbody = document.getElementById('sitesTableBody');
    if (!sites.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="no-data">No sites</td></tr>';
      return;
    }
    
    let html = '';
    sites.forEach(site => {
      const statusClass = site.status === 'Active' ? 'status-working' : 'status-idle';
      html += `<tr>
        <td style="font-weight:600;">${site.siteCode}</td>
        <td style="text-align:left;">${site.siteName}</td>
        <td style="text-align:left; font-size:11px;">${site.location || '-'}</td>
        <td>${site.siteManager || '-'}</td>
        <td>${site.contactNo || '-'}</td>
        <td><span class="${statusClass}">${site.status}</span></td>
        <td>
          <button class="btn btn-sm btn-primary" onclick='editSite(${JSON.stringify(site).replace(/'/g, "&#39;")})'>
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteSite(${site.rowIndex}, '${site.siteName}')">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>`;
    });
    
    tbody.innerHTML = html;
  } catch (error) {
    showToast('Error loading sites', 'error');
  }
}

function showAddSiteModal() {
  editingSiteRowIndex = null;
  document.getElementById('siteModalTitle').textContent = 'Add New Site';
  document.getElementById('siteSaveBtn').innerHTML = '<i class="fas fa-save"></i> Add Site';
  
  document.getElementById('siteCode').value = '';
  document.getElementById('siteName').value = '';
  document.getElementById('siteLocation').value = '';
  document.getElementById('siteManager').value = '';
  document.getElementById('siteContact').value = '';
  document.getElementById('siteStatus').value = 'Active';
  
  document.getElementById('siteModal').style.display = 'flex';
}

function editSite(site) {
  editingSiteRowIndex = site.rowIndex;
  document.getElementById('siteModalTitle').textContent = 'Edit Site';
  document.getElementById('siteSaveBtn').innerHTML = '<i class="fas fa-save"></i> Update Site';
  
  document.getElementById('siteCode').value = site.siteCode;
  document.getElementById('siteName').value = site.siteName;
  document.getElementById('siteLocation').value = site.location || '';
  document.getElementById('siteManager').value = site.siteManager || '';
  document.getElementById('siteContact').value = site.contactNo || '';
  document.getElementById('siteStatus').value = site.status;
  
  document.getElementById('siteModal').style.display = 'flex';
}

async function saveSite() {
  const siteData = {
    siteCode: document.getElementById('siteCode').value.trim(),
    siteName: document.getElementById('siteName').value.trim(),
    location: document.getElementById('siteLocation').value.trim(),
    siteManager: document.getElementById('siteManager').value.trim(),
    contactNo: document.getElementById('siteContact').value.trim(),
    status: document.getElementById('siteStatus').value
  };
  
  if (!siteData.siteCode || !siteData.siteName) {
    showToast('Site Code and Name required', 'error');
    return;
  }
  
  const btn = document.getElementById('siteSaveBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  
  try {
    let result;
    if (editingSiteRowIndex) {
      siteData.rowIndex = editingSiteRowIndex;
      result = await apiCall('updateSite', { siteData });
    } else {
      result = await apiCall('addSite', { siteData });
    }
    
    btn.disabled = false;
    btn.innerHTML = editingSiteRowIndex ? '<i class="fas fa-save"></i> Update Site' : '<i class="fas fa-save"></i> Add Site';
    
    showToast(result.message, result.success ? 'success' : 'error');
    if (result.success) {
      closeModal('siteModal');
      loadSites();
      loadSitesDropdown();
    }
  } catch (error) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save';
    showToast('Error saving site', 'error');
  }
}

function confirmDeleteSite(rowIndex, siteName) {
  document.getElementById('confirmMessage').innerHTML = `Delete site <strong>${siteName}</strong>?`;
  document.getElementById('confirmActionBtn').onclick = async function() {
    try {
      const result = await apiCall('deleteSite', { rowIndex });
      closeModal('confirmModal');
      showToast(result.message, result.success ? 'success' : 'error');
      loadSites();
      loadSitesDropdown();
    } catch (error) {
      showToast('Error deleting site', 'error');
    }
  };
  document.getElementById('confirmModal').style.display = 'flex';
}

// ============================================
// UTILITIES
// ============================================
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

function formatNumber(num) {
  if (isNaN(num) || num === null || num === '') return '0';
  return parseFloat(num).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch(e) {
    return dateStr;
  }
}

function showToast(message, type) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');
  
  toast.className = 'toast ' + (type || 'success');
  toastMsg.textContent = message;
  
  const icons = {
    'success': '<i class="fas fa-check-circle"></i>',
    'error': '<i class="fas fa-exclamation-circle"></i>',
    'info': '<i class="fas fa-info-circle"></i>'
  };
  toastIcon.innerHTML = icons[type] || icons.success;
  
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); }, 4000);
}

function logout() {
  if (confirm('Are you sure you want to logout?')) {
    clearSession();
    window.location.href = 'index.html';
  }
}
