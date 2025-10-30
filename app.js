// Global application data
const appData = {
    currentUser: null,
    currentUserType: null,
    currentChatReportId: null
};

const API_BASE = 'http://localhost:3000/api';

let carouselInterval;
let currentSlide = 0;

// API helper function
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        return { success: false, message: 'Network error. Please check if server is running.' };
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeCarousel();
});

// Carousel functions
function initializeCarousel() {
    carouselInterval = setInterval(nextSlide, 4000);
}

function nextSlide() {
    const slides = document.querySelectorAll('.carousel-item');
    const dots = document.querySelectorAll('.dot');
    
    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');
    
    currentSlide = (currentSlide + 1) % slides.length;
    
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
}

function setCarouselSlide(index) {
    const slides = document.querySelectorAll('.carousel-item');
    const dots = document.querySelectorAll('.dot');
    
    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');
    
    currentSlide = index;
    
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
    
    clearInterval(carouselInterval);
    carouselInterval = setInterval(nextSlide, 4000);
}

function scrollToAbout() {
    document.getElementById('about').scrollIntoView({ behavior: 'smooth' });
}

// Page navigation
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    window.scrollTo(0, 0);
}

// Toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show';
    if (type === 'error') {
        toast.classList.add('error');
    } else if (type === 'warning') {
        toast.classList.add('warning');
    }
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Authentication
function switchLoginTab(type) {
    const tabs = document.querySelectorAll('.tab-btn');
    const loginTabs = document.querySelectorAll('.login-tab');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    loginTabs.forEach(tab => tab.classList.remove('active'));
    
    if (type === 'student') {
        tabs[0].classList.add('active');
        document.getElementById('student-login').classList.add('active');
    } else {
        tabs[1].classList.add('active');
        document.getElementById('admin-login').classList.add('active');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const activeTab = document.querySelector('.login-tab.active');
    
    if (activeTab.id === 'student-login') {
        const identifier = document.getElementById('student-identifier').value;
        const password = document.getElementById('student-password').value;
        
        const result = await apiCall('/login/student', {
            method: 'POST',
            body: JSON.stringify({ identifier, password })
        });
        
        if (result.success) {
            appData.currentUser = result.user;
            appData.currentUserType = 'student';
            showPage('student-dashboard');
            initializeStudentDashboard();
            showToast('Login successful!');
        } else {
            showToast(result.message || 'Invalid credentials', 'error');
        }
    } else {
        const username = document.getElementById('admin-username').value;
        const password = document.getElementById('admin-password').value;
        
        const result = await apiCall('/login/admin', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        if (result.success) {
            appData.currentUser = result.admin;
            appData.currentUserType = 'admin';
            showPage('admin-dashboard');
            initializeAdminDashboard();
            showToast('Admin login successful!');
        } else {
            showToast(result.message || 'Invalid admin credentials', 'error');
        }
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const fullName = document.getElementById('reg-fullname').value;
    const studentNo = document.getElementById('reg-studentno').value;
    const email = document.getElementById('reg-email').value;
    const buildingName = document.getElementById('reg-building').value;
    const roomNumber = document.getElementById('reg-room').value;
    const floor = document.getElementById('reg-floor').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    
    // Validation
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters long', 'error');
        return;
    }
    
    const result = await apiCall('/register', {
        method: 'POST',
        body: JSON.stringify({
            fullName,
            studentNo,
            email,
            buildingName,
            roomNumber,
            floor,
            password
        })
    });
    
    if (result.success) {
        showToast('Registration successful! Please login.');
        showPage('login-page');
        document.getElementById('register-form').reset();
    } else {
        showToast(result.message || 'Registration failed', 'error');
    }
}

function logout() {
    appData.currentUser = null;
    appData.currentUserType = null;
    showPage('home-page');
    showToast('Logged out successfully');
}

// Student Dashboard
function showStudentView(view) {
    const views = document.querySelectorAll('#student-dashboard .dashboard-view');
    const links = document.querySelectorAll('#student-dashboard .nav-link');
    
    views.forEach(v => v.classList.remove('active'));
    links.forEach(l => l.classList.remove('active'));
    
    if (view === 'dashboard') {
        document.getElementById('student-dashboard-view').classList.add('active');
        links[0].classList.add('active');
        updateStudentDashboard();
    } else if (view === 'submit') {
        document.getElementById('student-submit-view').classList.add('active');
        links[1].classList.add('active');
        populateSubmitForm();
    } else if (view === 'reports') {
        document.getElementById('student-reports-view').classList.add('active');
        links[2].classList.add('active');
        loadStudentReports();
    }
}

function initializeStudentDashboard() {
    document.getElementById('student-welcome').textContent = `Welcome, ${appData.currentUser.fullName}`;
    updateStudentDashboard();
}

async function updateStudentDashboard() {
    try {
        // Get stats
        const statsResult = await apiCall(`/stats/student/${appData.currentUser.id}`);
        
        if (statsResult.success) {
            const stats = statsResult.stats;
            document.getElementById('total-reports-stat').textContent = stats.totalReports || 0;
            document.getElementById('pending-reports-stat').textContent = stats.pendingReports || 0;
            document.getElementById('inprogress-reports-stat').textContent = stats.inProgressReports || 0;
            document.getElementById('completed-reports-stat').textContent = stats.completedReports || 0;
        }

        // Load recent reports
        const reportsResult = await apiCall(`/reports/student/${appData.currentUser.id}`);
        const tbody = document.getElementById('student-recent-reports-body');
        
        if (reportsResult.success && reportsResult.reports.length > 0) {
            const recentReports = reportsResult.reports.slice(0, 5); // Get first 5
            tbody.innerHTML = recentReports.map(report => `
                <tr>
                    <td>#${report.id}</td>
                    <td>${truncateText(report.issueDescription, 30)}</td>
                    <td>${report.category}</td>
                    <td><span class="status-badge status-${report.status}">${report.status.replace('-', ' ')}</span></td>
                    <td>${formatDate(report.createdAt)}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="viewReport(${report.id})">View</button>
                        <button class="btn btn-sm btn-secondary" onclick="openChat(${report.id})">Chat</button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No reports submitted yet</td></tr>';
        }
    } catch (error) {
        console.error('Error updating student dashboard:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

function populateSubmitForm() {
    document.getElementById('report-studentno').value = appData.currentUser.studentNo;
    document.getElementById('report-building').value = appData.currentUser.buildingName;
    document.getElementById('report-room').value = appData.currentUser.roomNumber;
    document.getElementById('report-floor').value = appData.currentUser.floor;
}

function previewImage(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('image-preview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
    }
}

async function handleSubmitReport(event) {
    event.preventDefault();
    
    const category = document.getElementById('report-category').value;
    const description = document.getElementById('report-description').value;
    const priority = document.getElementById('report-priority').value;
    
    if (!category || !description) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    const result = await apiCall('/reports', {
        method: 'POST',
        body: JSON.stringify({
            studentId: appData.currentUser.id,
            studentNo: appData.currentUser.studentNo,
            buildingName: appData.currentUser.buildingName,
            roomNumber: appData.currentUser.roomNumber,
            floor: appData.currentUser.floor,
            issueDescription: description,
            category: category,
            priority: priority
        })
    });
    
    if (result.success) {
        showToast(`Report #${result.reportId} submitted successfully!`);
        document.getElementById('submit-report-form').reset();
        document.getElementById('image-preview').innerHTML = '';
        populateSubmitForm();
        showStudentView('reports');
    } else {
        showToast(result.message || 'Failed to submit report', 'error');
    }
}

async function loadStudentReports() {
    try {
        const result = await apiCall(`/reports/student/${appData.currentUser.id}`);
        const tbody = document.getElementById('student-all-reports-body');
        
        if (result.success && result.reports.length > 0) {
            tbody.innerHTML = result.reports.map(report => `
                <tr>
                    <td>#${report.id}</td>
                    <td>${truncateText(report.issueDescription, 30)}</td>
                    <td>${report.category}</td>
                    <td><span class="status-badge status-${report.status}">${report.status.replace('-', ' ')}</span></td>
                    <td><span class="priority-badge priority-${report.priority.toLowerCase()}">${report.priority}</span></td>
                    <td>${formatDate(report.createdAt)}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="viewReport(${report.id})">View</button>
                        <button class="btn btn-sm btn-secondary" onclick="openChat(${report.id})">Chat</button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No reports found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading student reports:', error);
        showToast('Error loading reports', 'error');
    }
}

// Admin Dashboard
function showAdminView(view) {
    const views = document.querySelectorAll('#admin-dashboard .dashboard-view');
    const links = document.querySelectorAll('#admin-dashboard .nav-link');
    
    views.forEach(v => v.classList.remove('active'));
    links.forEach(l => l.classList.remove('active'));
    
    if (view === 'dashboard') {
        document.getElementById('admin-dashboard-view').classList.add('active');
        links[0].classList.add('active');
        updateAdminDashboard();
    } else if (view === 'reports') {
        document.getElementById('admin-reports-view').classList.add('active');
        links[1].classList.add('active');
        loadAdminReports();
    } else if (view === 'users') {
        document.getElementById('admin-users-view').classList.add('active');
        links[2].classList.add('active');
        loadAdminUsers();
    }
}

function initializeAdminDashboard() {
    document.getElementById('admin-welcome').textContent = `Welcome, ${appData.currentUser.fullName}`;
    updateAdminDashboard();
}

async function updateAdminDashboard() {
    try {
        // Get admin stats
        const statsResult = await apiCall('/stats/admin');
        
        if (statsResult.success) {
            const stats = statsResult.stats;
            document.getElementById('admin-total-reports-stat').textContent = stats.totalReports || 0;
            document.getElementById('admin-pending-reports-stat').textContent = stats.pendingReports || 0;
            document.getElementById('admin-inprogress-reports-stat').textContent = stats.inProgressReports || 0;
            document.getElementById('admin-completed-today-stat').textContent = stats.completedToday || 0;
            document.getElementById('admin-total-users-stat').textContent = stats.totalUsers || 0;
        }

        // Get all reports for charts
        const reportsResult = await apiCall('/reports');
        
        if (reportsResult.success) {
            const reports = reportsResult.reports;
            
            // Reports by status chart
            const pendingReports = reports.filter(r => r.status === 'pending').length;
            const inProgressReports = reports.filter(r => r.status === 'in-progress').length;
            const completedReports = reports.filter(r => r.status === 'completed').length;
            
            const statusChart = document.getElementById('reports-by-status');
            statusChart.innerHTML = `
                <div class="chart-block pending">
                    <div class="chart-block-value">${pendingReports}</div>
                    <div class="chart-block-label">Pending</div>
                </div>
                <div class="chart-block in-progress">
                    <div class="chart-block-value">${inProgressReports}</div>
                    <div class="chart-block-label">In Progress</div>
                </div>
                <div class="chart-block completed">
                    <div class="chart-block-value">${completedReports}</div>
                    <div class="chart-block-label">Completed</div>
                </div>
            `;
            
            // Reports by building
            const buildings = ['Building A', 'Building B', 'Building C', 'Building D'];
            const buildingChart = document.getElementById('reports-by-building');
            const buildingCounts = buildings.map(building => 
                reports.filter(r => r.buildingName === building).length
            );
            const maxReports = Math.max(...buildingCounts, 1);
            
            buildingChart.innerHTML = buildings.map((building, index) => {
                const count = buildingCounts[index];
                const percentage = (count / maxReports) * 100;
                return `
                    <div class="chart-bar-item">
                        <div class="chart-bar-label">
                            <span>${building}</span>
                            <span>${count}</span>
                        </div>
                        <div class="chart-bar-visual" style="width: ${percentage}%"></div>
                    </div>
                `;
            }).join('');
            
            // Recent activity
            const recentReports = reports.slice(0, 5); // Get first 5
            const activityTimeline = document.getElementById('recent-activity');
            
            if (recentReports.length > 0) {
                activityTimeline.innerHTML = recentReports.map(report => {
                    return `
                        <div class="activity-item">
                            <strong>${report.studentName || 'Unknown Student'}</strong> submitted a ${report.category} issue in ${report.buildingName} - Room ${report.roomNumber}
                            <div class="activity-time">${formatDate(report.createdAt)}</div>
                        </div>
                    `;
                }).join('');
            } else {
                activityTimeline.innerHTML = '<p class="empty-state">No recent activity</p>';
            }
        }
    } catch (error) {
        console.error('Error updating admin dashboard:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

async function loadAdminReports() {
    try {
        const statusFilter = document.getElementById('filter-status').value;
        const buildingFilter = document.getElementById('filter-building').value;
        const priorityFilter = document.getElementById('filter-priority').value;
        
        // Build query string
        const params = new URLSearchParams();
        if (statusFilter) params.append('status', statusFilter);
        if (buildingFilter) params.append('building', buildingFilter);
        if (priorityFilter) params.append('priority', priorityFilter);
        
        const result = await apiCall(`/reports?${params.toString()}`);
        const tbody = document.getElementById('admin-all-reports-body');
        
        if (result.success && result.reports.length > 0) {
            tbody.innerHTML = result.reports.map(report => {
                return `
                    <tr>
                        <td>#${report.id}</td>
                        <td>${report.studentNo}</td>
                        <td>${report.buildingName}<br>Room ${report.roomNumber} - ${report.floor}</td>
                        <td>${truncateText(report.issueDescription, 30)}</td>
                        <td>${report.category}</td>
                        <td><span class="status-badge status-${report.status}">${report.status.replace('-', ' ')}</span></td>
                        <td><span class="priority-badge priority-${report.priority.toLowerCase()}">${report.priority}</span></td>
                        <td>${formatDate(report.createdAt)}</td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="viewReport(${report.id})">View</button>
                            <button class="btn btn-sm btn-secondary" onclick="openChat(${report.id})">Chat</button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No reports found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading admin reports:', error);
        showToast('Error loading reports', 'error');
    }
}

function filterAdminReports() {
    loadAdminReports();
}

async function loadAdminUsers() {
    try {
        const searchTerm = document.getElementById('search-users').value;
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        
        const result = await apiCall(`/users?${params.toString()}`);
        const tbody = document.getElementById('admin-users-body');
        
        if (result.success && result.users.length > 0) {
            tbody.innerHTML = result.users.map(user => `
                <tr>
                    <td>${user.studentNo}</td>
                    <td>${user.fullName}</td>
                    <td>${user.email}</td>
                    <td>${user.buildingName}</td>
                    <td>${user.roomNumber}</td>
                    <td>${user.floor}</td>
                    <td>${formatDate(user.createdAt)}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No users found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading admin users:', error);
        showToast('Error loading users', 'error');
    }
}

function filterUsers() {
    loadAdminUsers();
}

// Report Details Modal
async function viewReport(reportId) {
    try {
        const result = await apiCall(`/reports`);
        if (!result.success) {
            showToast('Error loading report details', 'error');
            return;
        }
        
        const report = result.reports.find(r => r.id === reportId);
        if (!report) {
            showToast('Report not found', 'error');
            return;
        }
        
        const modal = document.getElementById('report-modal');
        const modalBody = document.getElementById('report-modal-body');
        
        let content = `
            <div class="report-detail"><strong>Report ID:</strong> #${report.id}</div>
            <div class="report-detail"><strong>Student Name:</strong> ${report.studentName || 'Unknown'}</div>
            <div class="report-detail"><strong>Student Number:</strong> ${report.studentNo}</div>
            <div class="report-detail"><strong>Building:</strong> ${report.buildingName}</div>
            <div class="report-detail"><strong>Room:</strong> ${report.roomNumber}</div>
            <div class="report-detail"><strong>Floor:</strong> ${report.floor}</div>
            <div class="report-detail"><strong>Category:</strong> ${report.category}</div>
            <div class="report-detail"><strong>Priority:</strong> <span class="priority-badge priority-${report.priority.toLowerCase()}">${report.priority}</span></div>
            <div class="report-detail"><strong>Status:</strong> <span class="status-badge status-${report.status}">${report.status.replace('-', ' ')}</span></div>
            <div class="report-detail"><strong>Description:</strong> ${report.issueDescription}</div>
            <div class="report-detail"><strong>Date Submitted:</strong> ${formatDate(report.createdAt)}</div>
            <div class="report-detail"><strong>Last Updated:</strong> ${formatDate(report.updatedAt)}</div>
        `;
        
        if (report.adminNotes) {
            content += `<div class="report-detail"><strong>Admin Notes:</strong> ${report.adminNotes}</div>`;
        }
        
        if (appData.currentUserType === 'admin') {
            content += `
                <div class="form-group">
                    <label><strong>Update Status:</strong></label>
                    <select id="update-status" class="form-control">
                        <option value="pending" ${report.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="in-progress" ${report.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                        <option value="completed" ${report.status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </div>
                <div class="form-group">
                    <label><strong>Update Priority:</strong></label>
                    <select id="update-priority" class="form-control">
                        <option value="Low" ${report.priority === 'Low' ? 'selected' : ''}>Low</option>
                        <option value="Normal" ${report.priority === 'Normal' ? 'selected' : ''}>Normal</option>
                        <option value="High" ${report.priority === 'High' ? 'selected' : ''}>High</option>
                    </select>
                </div>
                <div class="form-group">
                    <label><strong>Admin Notes:</strong></label>
                    <textarea id="update-notes" class="form-control" rows="3">${report.adminNotes || ''}</textarea>
                </div>
                <button class="btn btn-primary" onclick="updateReport(${report.id})">Save Changes</button>
            `;
        }
        
        modalBody.innerHTML = content;
        modal.classList.add('active');
    } catch (error) {
        console.error('Error viewing report:', error);
        showToast('Error loading report details', 'error');
    }
}

async function updateReport(reportId) {
    try {
        const status = document.getElementById('update-status').value;
        const priority = document.getElementById('update-priority').value;
        const adminNotes = document.getElementById('update-notes').value;
        
        const result = await apiCall(`/reports/${reportId}`, {
            method: 'PUT',
            body: JSON.stringify({ status, priority, adminNotes })
        });
        
        if (result.success) {
            showToast('Report updated successfully!');
            closeModal('report-modal');
            updateAdminDashboard();
            loadAdminReports();
        } else {
            showToast(result.message || 'Failed to update report', 'error');
        }
    } catch (error) {
        console.error('Error updating report:', error);
        showToast('Error updating report', 'error');
    }
}

// Chat Functions
async function openChat(reportId) {
    try {
        appData.currentChatReportId = reportId;
        
        // Get report details
        const reportsResult = await apiCall('/reports');
        if (!reportsResult.success) {
            showToast('Error loading chat', 'error');
            return;
        }
        
        const report = reportsResult.reports.find(r => r.id === reportId);
        if (!report) {
            showToast('Report not found', 'error');
            return;
        }
        
        const modal = document.getElementById('chat-modal');
        const title = document.getElementById('chat-title');
        const reportInfo = document.getElementById('chat-report-info');
        
        title.textContent = `Chat - Report #${report.id}`;
        reportInfo.innerHTML = `
            <strong>Issue:</strong> ${report.category} - ${truncateText(report.issueDescription, 50)}<br>
            <strong>Student:</strong> ${report.studentName || 'Unknown'} (${report.studentNo})<br>
            <strong>Location:</strong> ${report.buildingName} - Room ${report.roomNumber}
        `;
        
        await loadChatMessages(reportId);
        modal.classList.add('active');
    } catch (error) {
        console.error('Error opening chat:', error);
        showToast('Error opening chat', 'error');
    }
}

async function loadChatMessages(reportId) {
    try {
        const result = await apiCall(`/chat/${reportId}`);
        const chatContainer = document.getElementById('chat-messages');
        
        if (result.success && result.messages.length > 0) {
            chatContainer.innerHTML = result.messages.map(msg => {
                let senderName = msg.senderType === 'student' ? 
                    (appData.currentUserType === 'student' ? 'You' : 'Student') : 
                    (appData.currentUserType === 'admin' ? 'You' : 'Admin');
                
                return `
                    <div class="chat-message ${msg.senderType}">
                        <div class="message-content">${msg.message}</div>
                        <div class="message-meta">${senderName} - ${formatDate(msg.createdAt)}</div>
                    </div>
                `;
            }).join('');
        } else {
            chatContainer.innerHTML = '<p class="empty-state">No messages yet. Start the conversation!</p>';
        }
        
        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (error) {
        console.error('Error loading chat messages:', error);
        showToast('Error loading messages', 'error');
    }
}

async function sendChatMessage() {
    try {
        const input = document.getElementById('chat-message-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        const result = await apiCall(`/chat/${appData.currentChatReportId}`, {
            method: 'POST',
            body: JSON.stringify({
                senderType: appData.currentUserType,
                senderId: appData.currentUser.id,
                message: message
            })
        });
        
        if (result.success) {
            input.value = '';
            await loadChatMessages(appData.currentChatReportId);
        } else {
            showToast(result.message || 'Failed to send message', 'error');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Error sending message', 'error');
    }
}

function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

// Modal Functions
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString('en-US', options);
}

function truncateText(text, length) {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}