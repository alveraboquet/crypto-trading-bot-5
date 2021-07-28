const config = require('./config.json');
const util = require('./util.js');
const analysis = require('./analysis.js');

console.log(`PID: ${process.pid}\n`);

// Use system environment variables in production
if (process.env.NODE_ENV === 'production') {
    require('dotenv').config();
}