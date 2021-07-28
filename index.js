const config = require('./config.json');
const analysis = require('./analysis.js');
const sources = require('./sources.js');

console.log(`PID: ${process.pid}\n`);

// Use system environment variables in production
if (process.env.NODE_ENV === 'production') {
    require('dotenv').config();
}

async function main() {
    const getScore = analysis[config.scoring.functionName];
    const source = new sources[config.source.name](config.assetPair);
    
    const data = await source.getData();
    console.log(getScore(data, 18, ...config.scoring.args));
}

main();