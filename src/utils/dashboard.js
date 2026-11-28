'use strict';

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const https = require('https');
const mongoose = require('mongoose');
const { getDecryptedTokens } = require('./dataStore');

const DASHBOARD_PASSWORD = "jeneyx papa";
const CACHE_FILE = path.join(process.cwd(), 'profile_cache.json');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-secret-key-32-chars-min!!';

const StreamUser = mongoose.models.StreamUser || mongoose.model('StreamUser');

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

const HTML_TEMPLATE = (usersList, activeStreamsCount) => `
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
        body { background-color: var(--bg-color); color: var(--text-main); display: flex; height: 100vh; overflow: hidden; }
        .panel { background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 12px; }
        .sidebar { width: 260px; height: 100vh; background: var(--sidebar-bg); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; padding: 30px 20px; z-index: 10; }
        .brand { display: flex; align-items: center; gap: 15px; margin-bottom: 40px; padding: 0 10px; }
        .brand i { font-size: 28px; color: var(--primary-color); }
        .brand h2 { font-size: 20px; font-weight: 800; }
        .brand h2 span { color: var(--primary-color); }
        .nav-menu { display: flex; flex-direction: column; gap: 8px; flex-grow: 1; }
        .nav-link { display: flex; align-items: center; gap: 15px; padding: 12px 18px; color: var(--text-muted); text-decoration: none; border-radius: 8px; font-weight: 600; transition: 0.2s; background: rgba(0, 245, 255, 0.1); color: var(--primary-color); }
        .logout-btn { margin-top: auto; display: flex; align-items: center; gap: 15px; padding: 12px 18px; color: var(--danger); text-decoration: none; border-radius: 8px; font-weight: 700; background: rgba(255, 71, 87, 0.1); border: 1px solid rgba(255, 71, 87, 0.2); transition: 0.2s; }
        .logout-btn:hover { background: var(--danger); color: white; }
        .main-content { flex-grow: 1; overflow-y: auto; padding: 30px 40px; height: 100vh; }
        .top-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
        .stat-card { padding: 25px; display: flex; align-items: center; gap: 20px; }
        .stat-icon { font-size: 24px; padding: 15px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .stat-icon.cyan { color: var(--primary-color); background: rgba(0, 245, 255, 0.1); }
        .stat-icon.purple { color: #b388ff; background: rgba(112, 0, 255, 0.1); }
        .stat-icon.green { color: var(--success); background: rgba(46, 213, 115, 0.1); }
        .stat-icon.red { color: var(--danger); background: rgba(255, 71, 87, 0.1); }
        .stat-info h3 { color: var(--text-muted); font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
        .stat-info p { font-size: 26px; font-weight: 800; }
        .chart-container { padding: 25px; margin-bottom: 30px; height: 350px; display: flex; flex-direction: column; }
        .chart-wrapper { flex-grow: 1; position: relative; width: 100%; }
        .table-container { padding: 25px; margin-bottom: 30px; }
        table.dataTable { width: 100% !important; border-collapse: collapse; }
        table.dataTable thead th { color: var(--text-muted); font-size: 12px; text-transform: uppercase; padding: 15px 10px; border-bottom: 1px solid var(--border-color); }
        table.dataTable tbody td { padding: 15px 10px; border-bottom: 1px solid var(--border-color); font-size: 14px; }
        .token-box { font-family: 'Courier New', monospace; color: #ccc; background: #000; padding: 6px 10px; border-radius: 4px; border: 1px solid #333; display: inline-block; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
        .btn-action { padding: 8px 12px; border-radius: 6px; cursor: pointer; border: none; font-weight: 600; font-size: 12px; }
        .btn-copy { background: rgba(0, 245, 255, 0.1); color: var(--primary-color); border: 1px solid rgba(0, 245, 255, 0.3); }
        .btn-delete { background: rgba(255, 71, 87, 0.1); color: var(--danger); border: 1px solid rgba(255, 71, 87, 0.3); margin-left: 5px; }
        .user-profile-cell { display: flex; align-items: center; gap: 12px; }
        .user-avatar { width: 36px; height: 36px; border-radius: 50%; background: #222; border: 1px solid #333; object-fit: cover; }
        .user-details { display: flex; flex-direction: column; }
        .user-name { font-weight: 700; font-size: 14px; }
        .user-id { font-size: 11px; color: var(--text-muted); }
        #toast { position: fixed; bottom: 30px; right: 30px; background: var(--success); color: white; padding: 15px 25px; border-radius: 8px; font-weight: 700; display: none; align-items: center; gap: 10px; z-index: 9999; }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="brand">
            <i class="fa-solid fa-video"></i>
            <h2>Stream <span>Bot</span></h2>
        </div>
        <div class="nav-menu">
            <a href="#dashboard-section" class="nav-link"><i class="fa-solid fa-chart-pie"></i> Dashboard</a>
        </div>
        <a href="/logout" class="logout-btn"><i class="fa-solid fa-power-off"></i> End Session</a>
    </div>

    <div class="main-content">
        <div class="top-header">
            <div>
                <h1>Stream Bot Overview</h1>
                <p>Live MongoDB telemetry and streaming statistics.</p>
            </div>
        </div>

        <div class="stats-grid">
            <div class="panel stat-card">
                <div class="stat-icon cyan"><i class="fa-solid fa-users-viewfinder"></i></div>
                <div class="stat-info"><h3>Total Users</h3><p>${usersList.length}</p></div>
            </div>
            <div class="panel stat-card">
                <div class="stat-icon purple"><i class="fa-solid fa-video"></i></div>
                <div class="stat-info"><h3>Active Streams</h3><p>${activeStreamsCount}</p></div>
            </div>
            <div class="panel stat-card">
                <div class="stat-icon green"><i class="fa-solid fa-clock"></i></div>
                <div class="stat-info"><h3>Total Hours</h3><p>${(usersList.reduce((acc, v) => acc + (v.totalSeconds || 0), 0) / 3600).toFixed(1)} hrs</p></div>
            </div>
            <div class="panel stat-card">
                <div class="stat-icon red"><i class="fa-solid fa-shield-halved"></i></div>
                <div class="stat-info"><h3>Bot Status</h3><p style="color: var(--success); font-size: 20px;">Online</p></div>
            </div>
        </div>

        <div class="panel chart-container">
            <div class="chart-header" style="margin-bottom: 15px;"><h2><i class="fa-solid fa-chart-simple"></i> Live Streaming Hours Overview</h2></div>
            <div class="chart-wrapper"><canvas id="userChart"></canvas></div>
        </div>

        <div class="panel table-container">
            <div class="table-header" style="margin-bottom: 15px;"><h2><i class="fa-solid fa-database"></i> Registered Streamers (MongoDB)</h2></div>
            <table id="userTable" class="display" style="width:100%">
                <thead>
                    <tr>
                        <th>User Profile</th>
                        <th>Token</th>
                        <th>Room Input</th>
                        <th>Channel Name</th>
                        <th>Total Hours</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${usersList.map(u => {
                        let decryptedToken = 'N/A';
                        try {
                            const tokens = getDecryptedTokens(u.userId, ENCRYPTION_KEY);
                            decryptedToken = tokens.main || u.roomInput || 'N/A';
                        } catch (e) {
                            decryptedToken = u.roomInput || 'N/A';
                        }
                        return `
                        <tr id="row-${u.userId}">
                            <td>
                                <div class="user-profile-cell">
                                    <img src="https://cdn.discordapp.com/embed/avatars/0.png" class="user-avatar" id="avatar-${u.userId}">
                                    <div class="user-details">
                                        <span class="user-name" id="username-${u.userId}">Loading...</span>
                                        <span class="user-id">${u.userId}</span>
                                    </div>
                                </div>
                            </td>
                            <td><span class="token-box" id="token-${u.userId}">${decryptedToken}</span></td>
                            <td>${u.roomInput || 'N/A'}</td>
                            <td>${u.channelName || 'N/A'}</td>
                            <td><b>${((u.totalSeconds || 0) / 3600).toFixed(1)} hrs</b></td>
                            <td>
                                <button class="btn-action btn-copy" onclick="copyToken('${u.userId}')"><i class="fa-solid fa-copy"></i></button>
                                <button class="btn-action btn-delete" onclick="deleteUser('${u.userId}')"><i class="fa-solid fa-trash"></i></button>
                            </td>
                        </tr>
                        `;
                    }).join('')}
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
            userTable = $('#userTable').DataTable({ "pageLength": 10, "order": [[ 4, "desc" ]] });
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

        function copyToken(id) {
            var text = document.getElementById('token-' + id).innerText;
            navigator.clipboard.writeText(text).then(() => {
                showToast('Token Copied!', 'var(--success)');
            });
        }

        function deleteUser(id) {
            if(!confirm("Are you sure?")) return;
            fetch('/api/delete/' + id, { method: 'POST' })
            .then(res => res.json()).then(data => {
                if(data.success) {
                    $('#row-' + id).fadeOut(500, function() { userTable.row($(this)).remove().draw(false); });
                    showToast('User Deleted!', 'var(--danger)');
                }
            });
        }

        function showToast(msg, color) {
            var t = document.getElementById('toast');
            t.style.background = color; t.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + msg; t.style.display = 'flex';
            setTimeout(() => t.style.display = 'none', 3000);
        }

        const ctx = document.getElementById('userChart').getContext('2d');
        let userChart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Streaming Hours', data: [], borderColor: '#00F5FF', fill: true, tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
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
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <style>
        body { background-color: #000; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
        .box { background: #0a0a0a; border: 1px solid #1a1a1a; padding: 35px; border-radius: 12px; width: 340px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); text-align: center; }
        h2 { margin-bottom: 20px; font-weight: 800; font-size: 22px; }
        h2 span { color: #00F5FF; }
        input { width: 100%; padding: 12px; margin-bottom: 15px; background: #000; border: 1px solid #222; color: #fff; border-radius: 6px; box-sizing: border-box; font-size: 14px; }
        input:focus { border-color: #00F5FF; outline: none; }
        button { background: #00F5FF; color: #000; border: none; padding: 12px; width: 100%; border-radius: 6px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        button:hover { opacity: 0.9; }
        .error { color: #ff4757; font-size: 13px; margin-top: 10px; font-weight: 600; }
    </style>
</head>
<body>
    <div class="box">
        <h2>Stream <span>Admin</span></h2>
        <form method="POST" action="/login">
            <input type="password" name="password" placeholder="Enter Dashboard Password" required>
            <button type="submit">Access Panel</button>
        </form>
        ${errorMsg ? `<div class="error">${errorMsg}</div>` : ''}
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

        // ── STRICT AUTHENTICATION GUARD ──
        if (pathname === '/login' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            return res.end(LOGIN_TEMPLATE());
        }

        if (pathname === '/login' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                const params = new URLSearchParams(body);
                const password = params.get('password');
                if (password === DASHBOARD_PASSWORD) {
                    res.writeHead(302, {
                        'Location': '/dash',
                        'Set-Cookie': 'logged_in=true; Path=/; HttpOnly; SameSite=Lax'
                    });
                    res.end();
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(LOGIN_TEMPLATE('Galat password! Dobara try karo.'));
                }
            });
            return;
        }

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

        // Redirect root to dash if authenticated, else login
        if (pathname === '/' || pathname === '') {
            res.writeHead(302, { 'Location': isAuthenticated ? '/dash' : '/login' });
            return res.end();
        }

        // Block all unauthenticated API & Dashboard requests
        if (!isAuthenticated) {
            res.writeHead(302, { 'Location': '/login' });
            return res.end();
        }

        // ── PROTECTED DASHBOARD PANEL ──
        if (pathname === '/dash') {
            let usersList = [];
            try {
                const docs = await StreamUser.find({}).lean();
                usersList = docs;
            } catch (e) {
                const mapUsers = getUsersFunc();
                usersList = Object.entries(mapUsers).map(([userId, data]) => ({ userId, ...data }));
            }

            const activeStreams = sessionManager.sessions ? sessionManager.sessions.size : 0;
            res.writeHead(200, { 'Content-Type': 'text/html' });
            return res.end(HTML_TEMPLATE(usersList, activeStreams));
        }

        // ── PROTECTED APIS ──
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

        if (pathname === '/api/live_stats') {
            let usersList = [];
            try {
                usersList = await StreamUser.find({}).lean();
            } catch (e) {
                const mapUsers = getUsersFunc();
                usersList = Object.entries(mapUsers).map(([userId, data]) => ({ userId, ...data }));
            }

            const sortedUsers = usersList.sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0)).slice(0, 5);
            const labels = sortedUsers.map(u => String(u.userId).substring(0, 8) + "...");
            const data = sortedUsers.map(u => Number(((u.totalSeconds || 0) / 3600).toFixed(1)));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ labels, data }));
        }

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
                    headers: { 'Authorization': `Bot ${botToken}`, 'User-Agent': 'DiscordBot (StreamBot, 1.0)' }
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
                                avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
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

    // 🔥 FIX: Render environment port integration
    const PORT = process.env.PORT || port || 3000;

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`[Dashboard] Locked & Secured Stream Bot UI Server listening on port ${PORT}`);
    });

    return server;
}

module.exports = { startDashboard };
