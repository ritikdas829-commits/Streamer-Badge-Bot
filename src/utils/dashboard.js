'use strict';

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const https = require('https');

const DASHBOARD_PASSWORD = "jeneyx papa";

const USERS_FILE = path.join(process.cwd(), 'data', 'users.json'); // Ya jahan aapka users data save hota hai
const CACHE_FILE = path.join(process.cwd(), 'profile_cache.json');

function loadJson(file, fallback = {}) {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
    } catch (e) {}
    return fallback;
}

function saveJson(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
}

// ── HTML TEMPLATE (STREAM BOT SPECIFIC) ──
const HTML_TEMPLATE = (users, activeStreamsCount, errorMsg = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stream Bot | Admin Panel</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <style>
        :root {
            --bg-color: #000000;
            --sidebar-bg: #000000;
            --surface-color: #0a0a0a;
            --border-color: #1a1a1a;
            --primary-color: #00F5FF;
            --text-main: #ffffff;
            --text-muted: #888888;
            --danger: #ff4757;
            --success: #2ed573;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
        
        body { 
            background-color: var(--bg-color); 
            color: var(--text-main); 
            display: flex;
            height: 100vh;
            overflow: hidden;
        }

        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: var(--bg-color); }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--primary-color); }

        .panel {
            background: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 12px;
        }

        /* ── SIDEBAR ── */
        .sidebar {
            width: 260px;
            height: 100vh;
            background: var(--sidebar-bg);
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            padding: 30px 20px;
            z-index: 10;
        }
        .brand { display: flex; align-items: center; gap: 15px; margin-bottom: 40px; padding: 0 10px; }
        .brand i { font-size: 28px; color: var(--primary-color); }
        .brand h2 { font-size: 20px; font-weight: 800; letter-spacing: 0.5px; }
        .brand h2 span { color: var(--primary-color); }
        
        .nav-menu { display: flex; flex-direction: column; gap: 8px; flex-grow: 1; }
        .nav-link { 
            display: flex; align-items: center; gap: 15px; 
            padding: 12px 18px; 
            color: var(--text-muted); 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: 600; 
            transition: 0.2s;
            cursor: pointer;
        }
        .nav-link i { font-size: 18px; width: 24px; text-align: center; }
        .nav-link:hover, .nav-link.active { background: rgba(0, 245, 255, 0.1); color: var(--primary-color); }
        
        .logout-btn { margin-top: auto; display: flex; align-items: center; gap: 15px; padding: 12px 18px; color: var(--danger); text-decoration: none; border-radius: 8px; font-weight: 700; transition: 0.2s; background: rgba(255, 71, 87, 0.1); border: 1px solid rgba(255, 71, 87, 0.2); }
        .logout-btn:hover { background: var(--danger); color: white; }

        /* ── MAIN CONTENT ── */
        .main-content { flex-grow: 1; overflow-y: auto; padding: 30px 40px; height: 100vh; scroll-behavior: smooth; }
        
        .top-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .top-header h1 { font-size: 30px; font-weight: 800; }
        .top-header p { color: var(--text-muted); font-size: 14px; margin-top: 5px; }
        .admin-profile { display: flex; align-items: center; gap: 15px; padding: 10px 20px; }
        .admin-profile i { color: var(--primary-color); font-size: 20px; }

        /* Stats Grid */
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
        .stat-card { padding: 25px; display: flex; align-items: center; gap: 20px; transition: 0.3s; }
        .stat-card:hover { border-color: #333; }
        .stat-icon { font-size: 24px; padding: 15px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .stat-icon.cyan { color: var(--primary-color); background: rgba(0, 245, 255, 0.1); }
        .stat-icon.purple { color: #b388ff; background: rgba(112, 0, 255, 0.1); }
        .stat-icon.green { color: var(--success); background: rgba(46, 213, 115, 0.1); }
        .stat-icon.red { color: var(--danger); background: rgba(255, 71, 87, 0.1); }
        
        .stat-info h3 { color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 5px; }
        .stat-info p { font-size: 26px; font-weight: 800; }

        /* Chart Section */
        .chart-container { padding: 25px; margin-bottom: 30px; height: 350px; display: flex; flex-direction: column; }
        .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .chart-header h2 { font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
        .chart-header h2 i { color: var(--primary-color); }
        .chart-wrapper { flex-grow: 1; position: relative; width: 100%; }

        /* Data Table */
        .table-container { padding: 25px; margin-bottom: 30px; }
        .table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .table-header h2 { font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
        
        table.dataTable { width: 100% !important; border-collapse: collapse; }
        table.dataTable thead th { background: transparent; border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 12px; text-transform: uppercase; padding: 15px 10px; }
        table.dataTable tbody td { padding: 15px 10px; border-bottom: 1px solid var(--border-color); font-size: 14px; }
        
        .token-box { font-family: 'Courier New', monospace; color: #ccc; background: #000; padding: 6px 10px; border-radius: 4px; border: 1px solid #333; display: inline-block; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        
        .btn-action { padding: 8px 12px; border-radius: 6px; cursor: pointer; border: none; font-weight: 600; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; transition: 0.2s; }
        .btn-delete { background: rgba(255, 71, 87, 0.1); color: var(--danger); border: 1px solid rgba(255, 71, 87, 0.3); }
        .btn-delete:hover { background: var(--danger); color: white; }

        /* User Profile UI */
        .user-profile-cell { display: flex; align-items: center; gap: 12px; }
        .user-avatar { width: 36px; height: 36px; border-radius: 50%; background: #222; border: 1px solid #333; object-fit: cover; }
        .user-details { display: flex; flex-direction: column; }
        .user-name { font-weight: 700; font-size: 14px; }
        .user-id { font-size: 11px; color: var(--text-muted); }

        /* Datatables Black Theme */
        .dataTables_filter input { background: #000 !important; border: 1px solid #333 !important; color: white !important; border-radius: 6px !important; padding: 8px 15px !important; outline: none !important; margin-left: 10px !important; }
        .dataTables_wrapper .dataTables_paginate .paginate_button { background: #0a0a0a !important; border: 1px solid #1a1a1a !important; color: var(--text-muted) !important; border-radius: 6px !important; padding: 5px 12px !important; margin: 0 4px !important; }
        .dataTables_wrapper .dataTables_paginate .paginate_button.current { background: rgba(0, 245, 255, 0.2) !important; border-color: var(--primary-color) !important; color: var(--primary-color) !important; font-weight: 800 !important; }
        .dataTables_wrapper .dataTables_info { color: var(--text-muted) !important; font-size: 13px !important; }

        /* Login */
        .login-wrapper { display: flex; justify-content: center; align-items: center; height: 100vh; width: 100vw; }
        .login-box { width: 100%; max-width: 400px; padding: 40px; text-align: center; }
        .login-box i.main-icon { font-size: 50px; color: var(--primary-color); margin-bottom: 20px; }
        .login-box h2 { font-size: 24px; font-weight: 800; margin-bottom: 10px; }
        .login-box p { color: var(--text-muted); font-size: 14px; margin-bottom: 30px; }
        
        .input-group { position: relative; margin-bottom: 20px; }
        .input-group i { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 16px; }
        input[type="password"] { width: 100%; padding: 14px 14px 14px 45px; background: #000; border: 1px solid #333; color: white; border-radius: 8px; outline: none; font-size: 15px; }
        input[type="password"]:focus { border-color: var(--primary-color); }
        
        .btn-login { width: 100%; padding: 14px; background: var(--primary-color); color: #000; border: none; border-radius: 8px; font-weight: 800; font-size: 16px; cursor: pointer; }
        .error-msg { color: var(--danger); font-size: 14px; margin-top: 15px; background: rgba(255, 71, 87, 0.1); padding: 10px; border-radius: 8px; border: 1px solid rgba(255, 71, 87, 0.3); }

        #toast { position: fixed; bottom: 30px; right: 30px; background: var(--success); color: white; padding: 15px 25px; border-radius: 8px; font-weight: 700; display: none; align-items: center; gap: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); z-index: 9999; border: 1px solid rgba(255,255,255,0.2); }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="brand">
            <i class="fa-solid fa-video"></i>
            <h2>Stream <span>Bot</span></h2>
        </div>
        <div class="nav-menu">
            <a href="#dashboard-section" class="nav-link active"><i class="fa-solid fa-chart-pie"></i> Dashboard</a>
            <a href="#users-section" class="nav-link"><i class="fa-solid fa-users"></i> Streamers</a>
        </div>
        <a href="/logout" class="logout-btn"><i class="fa-solid fa-power-off"></i> End Session</a>
    </div>

    <div class="main-content">
        <div id="dashboard-section" class="top-header">
            <div>
                <h1>Stream Bot Overview</h1>
                <p>Live streaming telemetry and user statistics.</p>
            </div>
            <div class="panel admin-profile">
                <i class="fa-solid fa-user-shield"></i>
                <span style="font-weight: 700;">Root Admin</span>
            </div>
        </div>

        <div class="stats-grid">
            <div class="panel stat-card">
                <div class="stat-icon cyan"><i class="fa-solid fa-users-viewfinder"></i></div>
                <div class="stat-info">
                    <h3>Total Users</h3>
                    <p>${Object.keys(users).length}</p>
                </div>
            </div>
            <div class="panel stat-card">
                <div class="stat-icon purple"><i class="fa-solid fa-video"></i></div>
                <div class="stat-info">
                    <h3>Active Streams</h3>
                    <p>${activeStreamsCount}</p>
                </div>
            </div>
            <div class="panel stat-card">
                <div class="stat-icon green"><i class="fa-solid fa-clock"></i></div>
                <div class="stat-info">
                    <h3>Total Hours</h3>
                    <p>${(Object.values(users).reduce((acc, v) => acc + (v.totalSeconds || 0), 0) / 3600).toFixed(1)} hrs</p>
                </div>
            </div>
            <div class="panel stat-card">
                <div class="stat-icon red"><i class="fa-solid fa-shield-halved"></i></div>
                <div class="stat-info">
                    <h3>Bot Status</h3>
                    <p style="color: var(--success); font-size: 20px;">Online</p>
                </div>
            </div>
        </div>

        <div class="panel chart-container">
            <div class="chart-header">
                <h2><i class="fa-solid fa-chart-simple"></i> Live Streaming Hours Overview</h2>
                <span style="font-size: 12px; color: var(--success);"><i class="fa-solid fa-circle" style="font-size: 8px;"></i> Live Updates</span>
            </div>
            <div class="chart-wrapper">
                <canvas id="userChart"></canvas>
            </div>
        </div>

        <div id="users-section" class="panel table-container">
            <div class="table-header">
                <h2><i class="fa-solid fa-database"></i> Registered Streamers</h2>
            </div>
            <table id="userTable" class="display" style="width:100%">
                <thead>
                    <tr>
                        <th>User Profile</th>
                        <th>Room Input</th>
                        <th>Channel Name</th>
                        <th>Total Hours</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(users).map(([d_id, data]) => `
                        <tr id="row-${d_id}">
                            <td>
                                <div class="user-profile-cell">
                                    <img src="https://cdn.discordapp.com/embed/avatars/0.png" class="user-avatar" id="avatar-${d_id}">
                                    <div class="user-details">
                                        <span class="user-name" id="username-${d_id}">Loading...</span>
                                        <span class="user-id">${d_id}</span>
                                    </div>
                                </div>
                            </td>
                            <td><span class="token-box">${data.roomInput || 'N/A'}</span></td>
                            <td>${data.channelName || 'N/A'}</td>
                            <td><b>${((data.totalSeconds || 0) / 3600).toFixed(1)} hrs</b></td>
                            <td>
                                <button class="btn-action btn-delete" onclick="deleteUser('${d_id}')"><i class="fa-solid fa-trash"></i> Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>

    <div id="toast"><i class="fa-solid fa-circle-check"></i> Action Successful!</div>

    <script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script>
        let userTable;
        $(document).ready(function() {
            userTable = $('#userTable').DataTable({
                "pageLength": 10,
                "order": [[ 3, "desc" ]],
                "language": { "search": "", "searchPlaceholder": "Search streamers..." }
            });
            
            userTable.on('draw', function () {
                var rows = userTable.rows({ page: 'current' }).nodes();
                for (let i = 0; i < rows.length; i++) {
                    let d_id = rows[i].id.replace('row-', '');
                    fetchProfile(d_id);
                }
            });
            userTable.draw();
        });

        async function fetchProfile(discordId) {
            let nameEl = document.getElementById('username-' + discordId);
            if (!nameEl || nameEl.innerText !== "Loading...") return;
            try {
                const res = await fetch('/api/user/' + discordId);
                const data = await res.json();
                if(data && data.avatar) document.getElementById('avatar-' + discordId).src = data.avatar;
                if(data && data.username) document.getElementById('username-' + discordId).innerText = data.username;
            } catch(e) { nameEl.innerText = "Unknown"; }
        }

        function deleteUser(id) {
            if(!confirm("Are you sure you want to delete this streamer?")) return;
            fetch('/api/delete/' + id, { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if(data.success) {
                    $('#row-' + id).fadeOut(500, function() { 
                        userTable.row($(this)).remove().draw(false); 
                    });
                    showToast('Streamer Deleted!', 'var(--danger)');
                }
            });
        }

        function showToast(msg, color) {
            var toast = document.getElementById('toast');
            toast.style.background = color;
            toast.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + msg;
            toast.style.display = 'flex';
            setTimeout(() => { toast.style.display = 'none'; }, 3000);
        }

        const ctx = document.getElementById('userChart').getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(0, 245, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 245, 255, 0.0)');

        let userChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Streaming Hours',
                    data: [],
                    borderColor: '#00F5FF',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointBackgroundColor: '#000',
                    pointBorderColor: '#00F5FF',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: '#1a1a1a' }, ticks: { color: '#888' } },
                    x: { grid: { display: false }, ticks: { color: '#888' } }
                }
            }
        });

        async function updateChart() {
            try {
                const res = await fetch('/api/live_stats');
                const data = await res.json();
                userChart.data.labels = data.labels;
                userChart.data.datasets[0].data = data.data;
                userChart.update('none');
            } catch(e) {}
        }
        updateChart();
        setInterval(updateChart, 5000);
    </script>
</body>
</html>
`;

const LOGIN_TEMPLATE = (errorMsg = '') => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stream Bot | Login</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #000000;
            --surface-color: #0a0a0a;
            --border-color: #1a1a1a;
            --primary-color: #00F5FF;
            --text-main: #ffffff;
            --text-muted: #888888;
            --danger: #ff4757;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
        body { background-color: var(--bg-color); color: var(--text-main); display: flex; justify-content: center; align-items: center; height: 100vh; width: 100vw; }
        .panel { background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 12px; }
        .login-box { width: 100%; max-width: 400px; padding: 40px; text-align: center; }
        .login-box i.main-icon { font-size: 50px; color: var(--primary-color); margin-bottom: 20px; }
        .login-box h2 { font-size: 24px; font-weight: 800; margin-bottom: 10px; }
        .login-box p { color: var(--text-muted); font-size: 14px; margin-bottom: 30px; }
        .input-group { position: relative; margin-bottom: 20px; }
        .input-group i { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 16px; }
        input[type="password"] { width: 100%; padding: 14px 14px 14px 45px; background: #000; border: 1px solid #333; color: white; border-radius: 8px; outline: none; font-size: 15px; }
        input[type="password"]:focus { border-color: var(--primary-color); }
        .btn-login { width: 100%; padding: 14px; background: var(--primary-color); color: #000; border: none; border-radius: 8px; font-weight: 800; font-size: 16px; cursor: pointer; }
        .error-msg { color: var(--danger); font-size: 14px; margin-top: 15px; background: rgba(255, 71, 87, 0.1); padding: 10px; border-radius: 8px; border: 1px solid rgba(255, 71, 87, 0.3); }
    </style>
</head>
<body>
    <div class="panel login-box">
        <i class="fa-solid fa-shield-halved main-icon"></i>
        <h2>Root Authentication</h2>
        <p>Secure access to Stream Bot Dashboard</p>
        <form method="POST" action="/login">
            <div class="input-group">
                <i class="fa-solid fa-lock"></i>
                <input type="password" name="password" placeholder="Enter System Password" required>
            </div>
            <button type="submit" class="btn-login">Authorize</button>
        </form>
        ${errorMsg ? `<div class="error-msg"><i class="fa-solid fa-triangle-exclamation"></i> ${errorMsg}</div>` : ''}
    </div>
</body>
</html>
`;

function parseCookies(req) {
    const list = {};
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return list;
    cookieHeader.split(`;`).forEach(cookie => {
        let [name, ...rest] = cookie.split(`=`);
        name = name?.trim();
        if (!name) return;
        let value = rest.join(`=`).trim();
        if (/^"(.*)"$/.test(value)) value = value.slice(1, -1);
        try { list[name] = decodeURIComponent(value); } catch (e) {}
    });
    return list;
}

function startDashboard(client, sessionManager, getUsersFunc, deleteUserFunc, port = 3000) {
    const server = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const cookies = parseCookies(req);
        const isAuthenticated = cookies.logged_in === 'true';

        // ── LOGIN PAGE ──
        if (pathname === '/login' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            return res.end(LOGIN_TEMPLATE());
        }

        // ── LOGIN POST ──
        if (pathname === '/login' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                const params = new URLSearchParams(body);
                const password = params.get('password');
                if (password === DASHBOARD_PASSWORD) {
                    res.writeHead(302, {
                        'Location': '/dash',
                        'Set-Cookie': 'logged_in=true; Path=/; HttpOnly'
                    });
                    res.end();
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(LOGIN_TEMPLATE('Invalid Password! Access Denied.'));
                }
            });
            return;
        }

        // ── LOGOUT ──
        if (pathname === '/logout') {
            res.writeHead(302, {
                'Location': '/login',
                'Set-Cookie': 'logged_in=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
            });
            return res.end();
        }

        if (pathname === '/ping') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            return res.end('OK');
        }

        if (pathname === '/' || pathname === '') {
            res.writeHead(302, { 'Location': isAuthenticated ? '/dash' : '/login' });
            return res.end();
        }

        if (!isAuthenticated) {
            res.writeHead(302, { 'Location': '/login' });
            return res.end();
        }

        // ── DASHBOARD PANEL ──
        if (pathname === '/dash') {
            const users = getUsersFunc();
            const activeStreams = sessionManager.sessions ? sessionManager.sessions.size : 0;
            res.writeHead(200, { 'Content-Type': 'text/html' });
            return res.end(HTML_TEMPLATE(users, activeStreams));
        }

        // ── API: DELETE USER ──
        if (pathname.startsWith('/api/delete/') && req.method === 'POST') {
            const userId = pathname.split('/')[3];
            try {
                deleteUserFunc(userId);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: false, error: e.message }));
            }
        }

        // ── API: LIVE STATS FOR CHART ──
        if (pathname === '/api/live_stats') {
            const users = getUsersFunc();
            const sortedUsers = Object.entries(users)
                .sort((a, b) => (b[1].totalSeconds || 0) - (a[1].totalSeconds || 0))
                .slice(0, 5);
            
            const labels = sortedUsers.map(([uid]) => uid.substring(0, 8) + "...");
            const data = sortedUsers.map(([, info]) => Number(((info.totalSeconds || 0) / 3600).toFixed(1)));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ labels, data }));
        }

        // ── API: DISCORD USER INFO CACHE ──
        if (pathname.startsWith('/api/user/')) {
            const userId = pathname.split('/')[3];
            const cache = loadJson(CACHE_FILE, {});

            if (cache[userId]) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(cache[userId]));
            }

            const botToken = process.env.BOT_TOKEN;
            const discordReq = https.request(
                {
                    hostname: 'discord.com',
                    path: `/api/v10/users/${userId}`,
                    method: 'GET',
                    headers: {
                        'Authorization': `Bot ${botToken}`,
                        'User-Agent': 'DiscordBot (StreamBot, 1.0)'
                    }
                },
                discordRes => {
                    let data = '';
                    discordRes.on('data', chunk => { data += chunk; });
                    discordRes.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            const avatarHash = json.avatar;
                            const username = json.username;
                            const discriminator = json.discriminator || '0';

                            let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
                            if (avatarHash) {
                                const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
                                avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=128`;
                            } else {
                                const defaultIndex = (BigInt(userId) >> 22n) % 6n;
                                avatarUrl = `https://cdn.discordapp.com/embed/avatars/{defaultIndex}.png`.replace('{defaultIndex}', defaultIndex);
                            }

                            const fullName = discriminator !== '0' ? `${username}#${discriminator}` : username;
                            const result = { username: fullName, avatar: avatarUrl };

                            cache[userId] = result;
                            saveJson(CACHE_FILE, cache);

                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(result));
                        } catch (e) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ username: 'Streamer User', avatar: 'https://cdn.discordapp.com/embed/avatars/0.png' }));
                        }
                    });
                }
            );

            discordReq.on('error', () => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ username: 'Streamer User', avatar: 'https://cdn.discordapp.com/embed/avatars/0.png' }));
            });

            discordReq.end();
            return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404: Page Not Found');
    });

    server.listen(port, () => {
        console.log(`[Dashboard] Stream Bot UI Server listening on port ${port}`);
    });

    return server;
}

module.exports = { startDashboard };
