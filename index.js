const config = require('./config.json');
const util = require('./util.js');
const analysis = require('./analysis.js');
const sources = require('./sources.js');

const {MongoClient} = require('mongodb');

console.log(`PID: ${process.pid}\n`);

// Use system environment variables in production
if (process.env.NODE_ENV === 'production') {
    require('dotenv').config();
}

async function loop(currentTimestamp) {
    const data = await source.getData();
    const score = getScore(data, data.length - 1, ...config.scoring.args);

    if (score === 0) {
        if (config.logHoldDecisions) console.log(`Held ${config.assetPair} [${util.formatDate(new Date(currentTimestamp))}]`);
    } else {
        const order = new util.Order(
            undefined,
            undefined,
            currentTimestamp,
            config.periodInterval,
            config.assetPair,
            undefined,
            config.exchange.orderType,
            undefined,
            undefined,
            undefined,
            score,
            undefined
        );

        order.action = score > 0 ? 'buy' : 'sell';

        order.description = `${order.action === 'buy' ? 'Bought' : 'Sold'} ${order.pair} (${order.score.toFixed(2)}) [${util.formatDate(new Date(order.timestamp))}]`;  // TODO: Improve description
        console.log(order.description);

        mongoClient.db('cryptoScalpingBot').collection('orders').insertOne(order);
    }
}

const getScore = analysis[config.scoring.functionName];
const source = new sources[config.source.name](config.assetPair);

const mongoClient = new MongoClient(config.mongoUrl);

process.on('SIGINT', () => {
    mongoClient.close();
});

async function run() {
    await mongoClient.connect().catch((error) => {throw new Error('Failed to connect to MongoDB instance!');});

    const nextPeriodStart = Math.ceil(Date.now() / (config.periodInterval * 60000)) * (config.periodInterval * 60000);
    console.log(`Successfully initialized - waiting for next period (${util.formatDate(new Date(nextPeriodStart))})`);

    let currentTimestamp = nextPeriodStart;
    setTimeout(() => {
        loop(currentTimestamp);
        setInterval(() => {
            currentTimestamp += config.periodInterval * 60000;
            loop(currentTimestamp);
        }, config.periodInterval * 60000);
    }, nextPeriodStart - Date.now());
}

run();