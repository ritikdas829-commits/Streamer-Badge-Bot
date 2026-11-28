'use strict';

const http = require('http');

function startDashboard(client, sessionManager, port = 3000) {
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/dash') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${client.botName} - Dashboard</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            body { background-color: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            .container { background-color: #1e293b; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5); width: 100%; max-width: 450px; text-align: center; border: 1px solid #334155; }
            h1 { color: #38bdf8; font-size: 24px; margin-bottom: 10px; }
            .status-badge { display: inline-block; background-color: rgba(74, 222, 128, 0.15); color: #4ade80; padding: 6px 14px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-bottom: 25px; border: 1px solid rgba(74, 222, 128, 0.3); }
            .stats-grid { display: grid; grid-template-columns: 1fr; gap: 15px; margin-bottom: 25px; }
            .stat-card { background-color: #0f172a; padding: 15px; border-radius: 10px; border: 1px solid #334155; text-align: left; }
            .stat-label { color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
            .stat-value { color: #f8fafc; font-size: 18px; font-weight: bold; margin-top: 5px; }
            .footer { color: #64748b; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🤖 ${client.botName}</h1>
            <div class="status-badge">🟢 Online & Stable</div>
            
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Active Streaming Sessions</div>
                <div class="stat-value">${sessionManager.sessions ? sessionManager.sessions.size : 0} Users</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Connected Guilds (Servers)</div>
                <div class="stat-value">${client.guilds ? client.guilds.cache.size : 0} Servers</div>
              </div>
            </div>
            
            <div class="footer">Streamer Bot High-Stability Mode • Render Compatible</div>
          </div>
        </body>
        </html>
      `);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404: Page Not Found');
    }
  });

  server.listen(port, () => {
    console.log(`[Dashboard] HTTP Server & Dashboard listening on port ${port}`);
  });

  return server;
}

module.exports = { startDashboard };
