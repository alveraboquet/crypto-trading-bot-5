const config = require('./config.json');
const util = require('./util.js');
const analysis = require('./analysis.js');
const sources = require('./sources.js');

console.log(`PID: ${process.pid}\n`);

// Use system environment variables in production
if (process.env.NODE_ENV === 'production') {
    require('dotenv').config();
}

async function loop(currentTimestamp) {
    const data = await source.getData();
    const score = getScore(data, undefined, ...config.scoring.args);

    const decisionInfo = {
        timestamp: currentTimestamp,
        assetPair: config.assetPair,
        score
    };

    if (score > 0) decisionInfo.action = 'buy';
    else if (score < 0) decisionInfo.action = 'sell';
    else decisionInfo.action = 'hold';

    decisionInfo.description = `${{buy: 'Bought', sell: 'Sold', hold: 'Held'}[decisionInfo.action]} ${decisionInfo.assetPair} - ${score.toFixed(2)} [${util.formatDate(new Date(currentTimestamp))}]`;

    if (decisionInfo.action !== 'hold' || config.logging.logHoldDecisions) console.log(decisionInfo.description);
}

const getScore = analysis[config.scoring.functionName];
const source = new sources[config.source.name](config.assetPair);

const nextPeriodStart = Math.ceil(Date.now() / (config.periodInterval * 60000)) * (config.periodInterval * 60000);
console.log(`Successfully initialized - waiting for next period (${util.formatDate(new Date(nextPeriodStart))})`)

let currentTimestamp = nextPeriodStart;
setTimeout(() => {
    loop(currentTimestamp);
    setInterval(() => {
        currentTimestamp += config.periodInterval * 60000;
        loop(currentTimestamp);
    }, config.periodInterval * 60000);
}, nextPeriodStart - Date.now());