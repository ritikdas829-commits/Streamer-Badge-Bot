import os
import json
import threading
import urllib.request
import urllib.error
from flask import Flask, render_template_string, request, redirect, url_for, session, jsonify

app = Flask(__name__)
app.secret_key = "stream_bot_Super_Secret_Key_Change_Me_For_Security"

# Password protection variable (Aap yahan apna password change kar sakte hain)
DASHBOARD_PASSWORD = "jeneyx papa"

# ── LOGIN PAGE TEMPLATE ──
LOGIN_PAGE = """
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
        <form method="POST">
            <input type="password" name="password" placeholder="Enter Dashboard Password" required>
            <button type="submit">Access Panel</button>
        </form>
        {% if error %}<div class="error">{{ error }}</div>{% endif %}
    </div>
</body>
</html>
"""

# ── HTML TEMPLATE (ADMIN PANEL) ──
HTML_TEMPLATE = """
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

        .sidebar {
            width: 260px; height: 100vh; background: var(--sidebar-bg);
            border-right: 1px solid var(--border-color); display: flex;
            flex-direction: column; padding: 30px 20px; z-index: 10;
        }
        .brand { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; padding: 0 10px; }
        .brand h2 { font-size: 20px; font-weight: 800; }
        .brand h2 span { color: var(--primary-color); }
        .logout-btn { color: var(--danger); text-decoration: none; font-size: 16px; }
        
        .nav-menu { display: flex; flex-direction: column; gap: 8px; flex-grow: 1; }
        .nav-link { 
            display: flex; align-items: center; gap: 15px; padding: 12px 18px; 
            color: var(--text-muted); text-decoration: none; border-radius: 8px; font-weight: 600; transition: 0.2s; 
        }
        .nav-link:hover, .nav-link.active { background: rgba(0, 245, 255, 0.1); color: var(--primary-color); }
        
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
            <a href="#dashboard-section" class="nav-link active"><i class="fa-solid fa-chart-pie"></i> Dashboard</a>
            <a href="#users-section" class="nav-link"><i class="fa-solid fa-users"></i> Users</a>
        </div>
    </div>

    <div class="main-content">
        <div id="dashboard-section" class="top-header">
            <div>
                <h1>Stream Bot Overview</h1>
                <p>Live MongoDB telemetry and streaming statistics.</p>
            </div>
        </div>

        <div class="stats-grid">
            <div class="panel stat-card">
                <div class="stat-icon cyan"><i class="fa-solid fa-users-viewfinder"></i></div>
                <div class="stat-info"><h3>Total Users</h3><p>{{ users|length }}</p></div>
            </div>
            <div class="panel stat-card">
                <div class="stat-icon purple"><i class="fa-solid fa-video"></i></div>
                <div class="stat-info"><h3>Active Streams</h3><p>{{ active_streams }}</p></div>
            </div>
            <div class="panel stat-card">
                <div class="stat-icon green"><i class="fa-solid fa-clock"></i></div>
                <div class="stat-info">
                    <h3>Total Hours</h3>
                    <p>{% set total_h = namespace(value=0) %}{% for k, v in users.items() %}{% set total_h.value = total_h.value + (v.get('totalSeconds', 0) / 3600) %}{% endfor %}{{ "%.1f"|format(total_h.value) }}</p>
                </div>
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

        <div id="users-section" class="panel table-container">
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
                    {% for d_id, data in users.items() %}
                    <tr id="row-{{ d_id }}">
                        <td>
                            <div class="user-profile-cell">
                                <img src="https://cdn.discordapp.com/embed/avatars/0.png" class="user-avatar" id="avatar-{{ d_id }}">
                                <div class="user-details">
                                    <span class="user-name" id="username-{{ d_id }}">Loading...</span>
                                    <span class="user-id">{{ d_id }}</span>
                                </div>
                            </div>
                        </td>
                        <td><span class="token-box">{{ data.get('roomInput', 'N/A') }}</span></td>
                        <td>{{ data.get('channelName', 'N/A') }}</td>
                        <td><b>{{ "%.1f"|format(data.get('totalSeconds', 0) / 3600) }} hrs</b></td>
                        <td>
                            <button class="btn-action btn-delete" onclick="deleteUser('{{ d_id }}')"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                    {% endfor %}
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
                const res = await fetch(`/api/user/${discordId}`);
                const data = await res.json();
                if(data && data.avatar) document.getElementById('avatar-' + discordId).src = data.avatar;
                if(data && data.username) document.getElementById('username-' + discordId).innerText = data.username;
            } catch(e) { nameEl.innerText = "Unknown"; }
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
"""

# Flask Routes initialization function to connect with Node.js/Python backend data stores
def init_dashboard(get_users_func, delete_user_func, get_active_streams_func):
    @app.route('/')
    def index():
        if session.get('authenticated'):
            return redirect(url_for('dashboard'))
        return redirect(url_for('login'))

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        error = None
        if request.method == 'POST':
            if request.form.get('password') == DASHBOARD_PASSWORD:
                session['authenticated'] = True
                return redirect(url_for('dashboard'))
            else:
                error = "Galat password! Dobara try karo."
        return render_template_string(LOGIN_PAGE, error=error)

    @app.route('/logout')
    def logout():
        session.pop('authenticated', None)
        return redirect(url_for('login'))

    @app.route('/ping')
    def ping():
        return "OK", 200

    @app.route('/dash')
    def dashboard():
        if not session.get('authenticated'):
            return redirect(url_for('login'))
        return render_template_string(HTML_TEMPLATE, users=get_users_func(), active_streams=get_active_streams_func())

    @app.route('/api/delete/<user_id>', methods=['POST'])
    def api_delete_user(user_id):
        if not session.get('authenticated'):
            return jsonify({"success": False, "error": "Unauthorized"}), 401
        delete_user_func(user_id)
        return jsonify({"success": True})

    @app.route('/api/live_stats')
    def live_stats():
        if not session.get('authenticated'):
            return jsonify({})
        all_users = sorted(get_users_func().items(), key=lambda x: x[1].get('totalSeconds', 0), reverse=True)[:5]
        return jsonify({
            "labels": [uid[:8] for uid, _ in all_users], 
            "data": [round(info.get('totalSeconds', 0) / 3600, 1) for _, info in all_users]
        })

    @app.route('/api/user/<user_id>')
    def get_user_info(user_id):
        if not session.get('authenticated'):
            return jsonify({"username": "Unauthorized", "avatar": "https://cdn.discordapp.com/embed/avatars/0.png"})
        bot_token = os.environ.get("BOT_TOKEN", "")
        req = urllib.request.Request(
            f"https://discord.com/api/v10/users/{user_id}",
            headers={"Authorization": f"Bot {bot_token}", "User-Agent": "StreamBot"}
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                avatar = f"https://cdn.discordapp.com/avatars/{user_id}/{data['avatar']}.png" if data.get('avatar') else "https://cdn.discordapp.com/embed/avatars/0.png"
                return jsonify({"username": data.get('username'), "avatar": avatar})
        except:
            return jsonify({"username": "Unknown", "avatar": "https://cdn.discordapp.com/embed/avatars/0.png"})

def run_dashboard():
    port = int(os.environ.get("PORT", os.environ.get("SERVER_PORT", 3000)))
    print(f"[Dashboard] Server starting on 0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)

def start_dashboard_thread(get_users_func, delete_user_func, get_active_streams_func):
    init_dashboard(get_users_func, delete_user_func, get_active_streams_func)
    threading.Thread(target=run_dashboard, daemon=True).start()
