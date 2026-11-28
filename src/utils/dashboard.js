'use strict';

const http = require('http');
const url = require('url');

const DASHBOARD_PASSWORD = "jeneyx papa";

function startDashboard(client, sessionManager, getUsersFunc, deleteUserFunc, port = 3000) {
  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const cookies = req.headers.cookie || '';
    const isAuthenticated = cookies.includes('authenticated=true');

    // ── LOGIN PAGE (GET) ──
    if (pathname === '/login' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>StreamBot | Login</title>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
            <style>
                body { background-color: #000; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
                .box { background: #0a0a0a; border: 1px solid #1a1a1a; padding: 35px; border-radius: 12px; width: 320px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); text-align: center; }
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
            </div>
        </body>
        </html>
      `);
    }

    // ── LOGIN POST ──
    if (pathname === '/login' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const password = new URLSearchParams(body).get('password');
        if (password === DASHBOARD_PASSWORD) {
          res.writeHead(302, {
            'Location': '/dash',
            'Set-Cookie': 'authenticated=true; Path=/'
          });
          res.end();
        } else {
          res.writeHead(302, { 'Location': '/login' });
          res.end();
        }
      });
      return;
    }

    // ── LOGOUT ──
    if (pathname === '/logout') {
      res.writeHead(302, {
        'Location': '/login',
        'Set-Cookie': 'authenticated=expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/'
      });
      return res.end();
    }

    // ── PING ROUTE FOR RENDER KEEP-ALIVE ──
    if (pathname === '/ping') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end('OK');
    }

    // ── REDIRECT ROOT ──
    if (pathname === '/' || pathname === '') {
      res.writeHead(302, { 'Location': isAuthenticated ? '/dash' : '/login' });
      return res.end();
    }

    // AUTH CHECK FOR DASHBOARD & APIS
    if (!isAuthenticated) {
      res.writeHead(302, { 'Location': '/login' });
      return res.end();
    }

    // ── API: LIVE STATS FOR CHART ──
    if (pathname === '/api/live_stats') {
      const users = getUsersFunc();
      const sortedUsers = Object.entries(users)
        .sort((a, b) => (b[1].totalSeconds || 0) - (a[1].totalSeconds || 0))
        .slice(0, 5);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        labels: sortedUsers.map(([uid]) => uid.substring(0, 8)),
        data: sortedUsers.map(([, info]) => Number(((info.totalSeconds || 0) / 3600).toFixed(1)))
      }));
    }

    // ── API: DELETE USER ──
    if (pathname.startsWith('/api/delete/') && req.method === 'POST') {
      const userId = pathname.split('/')[3];
      deleteUserFunc(userId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    }

    // ── MAIN ADMIN DASHBOARD PANEL (/dash) ──
    if (pathname === '/dash') {
      const users = getUsersFunc();
      const totalUsers = Object.keys(users).length;
      const activeStreams = sessionManager.sessions ? sessionManager.sessions.size : 0;
      
      let totalSecondsAll = 0;
      for (const u of Object.values(users)) {
        totalSecondsAll += (u.totalSeconds || 0);
      }
      const totalHours = (totalSecondsAll / 3600).toFixed(1);

      let tableRows = '';
      for (const [d_id, data] of Object.entries(users)) {
        const roomInput = data.roomInput || 'N/A';
        const channelName = data.channelName || 'N/A';
        const hours = ((data.totalSeconds || 0) / 3600).toFixed(1);
        
        tableRows += `
          <tr id="row-${d_id}">
              <td>
                  <div class="user-profile-cell">
                      <img src="https://cdn.discordapp.com/embed/avatars/0.png" class="user-avatar" id="avatar-${d_id}">
                      <div class="user-details">
                          <span class="user-name" id="username-${d_id}">Streamer</span>
                          <span class="user-id">${d_id}</span>
                      </div>
                  </div>
              </td>
              <td><span class="token-box">${roomInput}</span></td>
              <td>${channelName}</td>
              <td><b>${hours} hrs</b></td>
              <td>
                  <button class="btn-action btn-delete" onclick="deleteUser('${d_id}')"><i class="fa-solid fa-trash"></i></button>
              </td>
          </tr>
        `;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(`
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
                .brand { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; padding: 0 10px; }
                .brand h2 { font-size: 20px; font-weight: 800; }
                .brand h2 span { color: var(--primary-color); }
                .logout-btn { color: var(--danger); text-decoration: none; font-size: 16px; }
                .nav-menu { display: flex; flex-direction: column; gap: 8px; flex-grow: 1; }
                .nav-link { display: flex; align-items: center; gap: 15px; padding: 12px 18px; color: var(--text-muted); text-decoration: none; border-radius: 8px; font-weight: 600; transition: 0.2s; background: rgba(0, 245, 255, 0.1); color: var(--primary-color); }
                .main-content { flex-grow: 1; overflow-y: auto; padding: 30px 40px; height: 100vh; }
                .top-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
                .top-header h1 { font-size: 30px; font-weight: 800; }
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
                .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .chart-wrapper { flex-grow: 1; position: relative; width: 100%; }
                .table-container { padding: 25px; margin-bottom: 30px; }
                table.dataTable { width: 100% !important; border-collapse: collapse; }
                table.dataTable thead th { color: var(--text-muted); font-size: 12px; text-transform: uppercase; padding: 15px 10px; border-bottom: 1px solid var(--border-color); }
                table.dataTable tbody td { padding: 15px 10px; border-bottom: 1px solid var(--border-color); font-size: 14px; }
                .token-box { font-family: 'Courier New', monospace; color: #ccc; background: #000; padding: 6px 10px; border-radius: 4px; border: 1px solid #333; display: inline-block; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .btn-action { padding: 8px 12px; border-radius: 6px; cursor: pointer; border: none; font-weight: 600; font-size: 12px; }
                .btn-delete { background: rgba(255, 71, 87, 0.1); color: var(--danger); border: 1px solid rgba(255, 71, 87, 0.3); }
                .user-profile-cell { display: flex; align-items: center; gap: 12px; }
                .user-avatar { width: 36px; height: 36px; border-radius: 50%; background: #222; border: 1px solid #333; object-fit: cover; }
                .user-details { display: flex; flex-direction: column; }
                .user-name { font-weight: 700; font-size: 14px; }
                .user-id { font-size: 11px; color: var(--text-muted); }
                #toast { position: fixed; bottom: 30px; right: 30px; background: var(--success); color: white; padding: 15px 25px; border-radius: 8px; font-weight: 700; display: none; z-index: 9999; }
            </style>
        </head>
        <body>
            <div class="sidebar">
                <div class="brand">
                    <h2>Stream <span>Bot</span></h2>
                    <a href="/logout" class="logout-btn" title="Logout"><i class="fa-solid fa-right-from-bracket"></i></a>
                </div>
                <div class="nav-menu">
                    <a href="/dash" class="nav-link"><i class="fa-solid fa-chart-pie"></i> Dashboard</a>
                </div>
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
                        <div class="stat-info"><h3>Total Users</h3><p>${totalUsers}</p></div>
                    </div>
                    <div class="panel stat-card">
                        <div class="stat-icon purple"><i class="fa-solid fa-video"></i></div>
                        <div class="stat-info"><h3>Active Streams</h3><p>${activeStreams}</p></div>
                    </div>
                    <div class="panel stat-card">
                        <div class="stat-icon green"><i class="fa-solid fa-clock"></i></div>
                        <div class="stat-info"><h3>Total Hours</h3><p>${totalHours}</p></div>
                    </div>
                    <div class="panel stat-card">
                        <div class="stat-icon red"><i class="fa-solid fa-shield-halved"></i></div>
                        <div class="stat-info"><h3>Bot Status</h3><p style="color: var(--success); font-size: 20px;">Online</p></div>
                    </div>
                </div>

                <div class="panel chart-container">
                    <div class="chart-header">
                        <h2><i class="fa-solid fa-chart-simple"></i> Live Stream Activity Overview</h2>
                    </div>
                    <div class="chart-wrapper"><canvas id="userChart"></canvas></div>
                </div>

                <div class="panel table-container">
                    <div class="chart-header"><h2><i class="fa-solid fa-database"></i> Registered Streamers</h2></div>
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
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>

            <div id="toast">Action Successful!</div>

            <script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
            <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
            <script>
                let userTable;
                $(document).ready(function() {
                    userTable = $('#userTable').DataTable({ "pageLength": 10, "order": [[ 3, "desc" ]] });
                });

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
                    t.style.background = color; t.innerText = msg; t.style.display = 'flex';
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
      `);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404: Page Not Found');
  });

  server.listen(port, () => {
    console.log(`[Dashboard] Node.js Dashboard server running on port ${port}`);
  });

  return server;
}

module.exports = { startDashboard };
