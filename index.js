const config = require('./config.json');

console.log(`PID: ${process.pid}`);

// Use system environment variables in production
if (process.env.NODE_ENV === 'production') {
    require('dotenv').config();
}