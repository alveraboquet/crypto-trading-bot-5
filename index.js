const config = require('./config.json');
const util = require('./util.js');
const analysis = require('./analysis.js');
const sources = require('./sources.js');
const exchanges = require('./exchanges.js');

const {MongoClient, MongoDriverError} = require('mongodb');

console.log(`PID: ${process.pid}\n`);

// Use system environment variables in production
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

async function loop(currentTimestamp) {
    const data = await source.getData();
    const score = getScore(data, data.length - 1, ...config.scoring.args);

    if (score === 0) {
        if (config.logging.logHoldDecisions) console.log(`Held ${config.assetPair} [${util.formatDate(new Date(currentTimestamp))}]`);
    } else {
        const orderInfo = await exchange.placeOrder(score);
        if (!orderInfo) return;
        
        const order = new util.Order(
            orderInfo.txid,
            currentTimestamp,
            config.periodInterval,
            config.assetPair,
            undefined,
            'limit',
            orderInfo.price,
            orderInfo.volume,
            orderInfo.cost,
            config.exchange.forceMaker,
            score,
            undefined
        );

        order.action = score > 0 ? 'buy' : 'sell';
        order.description = `${order.action === 'buy' ? 'Bought' : 'Sold'} ${order.volume} @ ${order.price} ${order.pair} (${order.score.toFixed(2)}) [${util.formatDate(new Date(order.timestamp))}]`;
        console.log(order.description);

        mongoClient.db('cryptoTradingBot').collection('orders').insertOne(order).catch(async (error) => {
            if (error instanceof MongoDriverError && error.message === 'MongoClient must be connected to perform this operation') {
                await mongoClient.db('admin').command({ping: 1});
                mongoClient.db('cryptoTradingBot').collection('orders').insertOne(order);
            }
        });
    }

    const balance = await exchange.getBalance();
    const baseValueTickerPrice = await exchange.getTickerInfo(config.logging.baseValueTicker.name).c[0];
    const quoteValueTickerPrice = await exchange.getTickerInfo(config.logging.quoteValueTicker.name).c[0];

    let total = 0;
    total += Math.floor((config.logging.baseValueTicker.baseIsValueCurrency ? balance[config.baseAsset] / baseValueTickerPrice : balance[config.baseAsset] * baseValueTickerPrice) * 100) / 100;
    total += Math.floor((config.logging.quoteValueTicker.baseIsValueCurrency ? balance[config.quoteAsset] / quoteValueTickerPrice : balance[config.quoteAsset] * quoteValueTickerPrice) * 100) / 100;

    const balanceInfo = {
        timestamp: currentTimestamp,
        totalValue: total,
        valueCurrency: config.logging.valueCurrency,
        baseBalance: balance[config.baseAsset],
        quoteBalance: balance[config.quoteAsset]
    };

    mongoClient.db('cryptoTradingBot').collection('balances').insertOne(balanceInfo).catch(async (error) => {
        if (error instanceof MongoDriverError && error.message === 'MongoClient must be connected to perform this operation') {
            await mongoClient.db('admin').command({ping: 1});
            mongoClient.db('cryptoTradingBot').collection('balances').insertOne(balanceInfo);
        }
    });
}

function stop() {
    mongoClient.close();
    clearInterval(loopInterval);
}

process.on('SIGINT', stop);
process.on('SIGBREAK', stop);
process.on('SIGTERM', stop);

process.on('uncaughtException', (error, origin) => {
    console.log(`${error}`);
    stop();
    process.exit(1);
});

const getScore = analysis[config.scoring.functionName];
const source = new sources[config.source.name]();
const exchange = new exchanges[config.exchange.name]();

const mongoClient = new MongoClient(config.mongoUrl);

let loopInterval;
async function run() {
    await mongoClient.connect().catch((error) => {throw new Error('Failed to connect to MongoDB instance!');});
    await mongoClient.db('admin').command({ping: 1});

    const nextPeriodStart = Math.ceil(Date.now() / (config.periodInterval * 60000)) * (config.periodInterval * 60000);
    console.log(`Successfully initialized - waiting for next period (${util.formatDate(new Date(nextPeriodStart))})`);

    let currentTimestamp = nextPeriodStart;
    setTimeout(() => {
        loop(currentTimestamp);
        loopInterval = setInterval(() => {
            currentTimestamp += config.periodInterval * 60000;
            loop(currentTimestamp);
        }, config.periodInterval * 60000);
    }, nextPeriodStart - Date.now());
}

run();