const config = require('./config.json');
const util = require('./util.js');
const analysis = require('./analysis.js');
const sources = require('./sources.js');

console.log(`PID: ${process.pid}\n`);

// Use system environment variables in production
if (process.env.NODE_ENV === 'production') {
    require('dotenv').config();
}

async function loop() {
    const data = await source.getData();
    console.log(data[data.length - 1]);
}

async function main() {
    const getScore = analysis[config.scoring.functionName];
    const source = new sources[config.source.name](config.assetPair);
    
    const nextPeriodStart = Math.ceil(Date.now() / (config.periodInterval * 60000)) * (config.periodInterval * 60000);
    console.log(`Successfully initialized - waiting for next period (${util.formatDate(new Date(nextPeriodStart))})`)
    setTimeout(() => {
        loop();
        setInterval(loop, config.periodInterval * 60000);
    }, nextPeriodStart - Date.now());
}

main();