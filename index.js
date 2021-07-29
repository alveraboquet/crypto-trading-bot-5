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
    const score = getScore(data);

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
        order.description = `${order.action === 'buy' ? 'Bought' : 'Sold'} ${order.volume} ${order.pair} @ ${order.price} (${order.score.toFixed(2)}) [${util.formatDate(new Date(order.timestamp))}]`;
        console.log(order.description);

        mongoClient.db('cryptoTradingBot').collection('orders').insertOne(order).catch(async (error) => {
            if (error instanceof MongoDriverError && error.message === 'MongoClient must be connected to perform this operation') {
                await mongoClient.db('admin').command({ping: 1});
                mongoClient.db('cryptoTradingBot').collection('orders').insertOne(order);
            } else throw error;
        });
    }

    const balance = await exchange.getBalance();
    const baseValueTicker = await exchange.getTickerInfo(config.logging.baseValueTicker.name);
    const quoteValueTicker = await exchange.getTickerInfo(config.logging.quoteValueTicker.name);

    let total = 0;
    total += Math.floor((config.logging.baseValueTicker.baseIsValueCurrency ? balance[config.baseAsset] / baseValueTicker.c[0] : balance[config.baseAsset] * baseValueTicker.c[0]) * 100) / 100;
    total += Math.floor((config.logging.quoteValueTicker.baseIsValueCurrency ? balance[config.quoteAsset] / quoteValueTicker.c[0] : balance[config.quoteAsset] * quoteValueTicker.c[0]) * 100) / 100;

    const balanceInfo = {
        timestamp: currentTimestamp,
        totalValue: total,
        valueCurrency: config.logging.valueCurrency,
        baseBalance: Math.round(balance[config.baseAsset] * (10 ** config.exchange.basePrecision)) / (10 ** config.exchange.basePrecision),
        quoteBalance: Math.round(balance[config.quoteAsset] * (10 ** config.exchange.quotePrecision)) / (10 ** config.exchange.quotePrecision)
    };

    mongoClient.db('cryptoTradingBot').collection('balances').insertOne(balanceInfo).catch(async (error) => {
        if (error instanceof MongoDriverError && error.message === 'MongoClient must be connected to perform this operation') {
            await mongoClient.db('admin').command({ping: 1});
            mongoClient.db('cryptoTradingBot').collection('balances').insertOne(balanceInfo);
        } else throw error;
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

const getScore = analysis.combineScoreFunctions(config.scoring.functions, analysis);
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