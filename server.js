// Простейший HTTP сервер без зависимостей
const http = require('http');

const PORT = process.env.PORT || 3000;

console.log('🚀 Server starting...');
console.log('Port:', PORT);
console.log('Time:', new Date().toISOString());

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({
      message: 'Newsklad Backend работает!',
      timestamp: new Date().toISOString(),
      port: PORT
    }));
  } else if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({
      error: 'Not found'
    }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('✅ Server started successfully!');
  console.log(`Listening on: 0.0.0.0:${PORT}`);
  console.log('Server ready!');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

console.log('Server setup complete');