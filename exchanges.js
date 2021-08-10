const config = require('./config.json');
const util = require('./util.js');
const analysis = require('./analysis.js');

const KrakenClient = require('kraken-api');

class Kraken {
    krakenClient;

    constructor() {
        this.krakenClient = new KrakenClient(process.env.KRAKEN_KEY, process.env.KRAKEN_SECRET);
    }

    async placeOrder(data, score) {
        if (score === 0) {
            throw new Error('Specified score is invalid!');
        } else {
            const currentBalance = await this.getBalance();
            const tickerInfo = await this.getTickerInfo();

            const totalValueInBase = currentBalance[config.baseAsset] + (currentBalance[config.quoteAsset] / tickerInfo.c[0]);
            const balanceRatio = currentBalance[config.baseAsset] / totalValueInBase;
            
            let targetRatio = balanceRatio + score;
            if (targetRatio > 1) targetRatio = 1;
            else if (targetRatio < 0) targetRatio = 0;

            if (Math.abs(score) < config.exchange.scoreThreshold) return null;

            if (score > 0) {
                if (!currentBalance[config.quoteAsset]) return null;
                if (analysis.calculateATR(data, data.length - 1, ...config.exchange.atrArgs) < config.exchange.atrBuyThreshold) return null;

                const multiplier = (targetRatio - balanceRatio) * (1 / (1 - balanceRatio));
                const price = Math.floor(parseFloat(tickerInfo.a[0]) * (10 ** config.exchange.pricePrecision)) / (10 ** config.exchange.pricePrecision);
                const cost = Math.floor((currentBalance[config.quoteAsset] * multiplier) * (10 ** config.exchange.quotePrecision)) / (10 ** config.exchange.quotePrecision);
                const volume = Math.floor((cost / price) * (10 ** config.exchange.basePrecision)) / (10 ** config.exchange.basePrecision);

                if (cost < config.exchange.quoteMinimumTransaction) return null;

                const orderData = {
                    pair: config.assetPair,
                    type: 'buy',
                    ordertype: config.exchange.forceMaker ? 'limit' : 'market',
                    volume,
                    price: config.exchange.forceMaker ? price : undefined,
                    expiretm: `+30`,
                    oflags: config.exchange.forceMaker ? 'post' : undefined
                };

                let response;
                async function getResponse(ctx) {
                    response = (await ctx.krakenClient.api('AddOrder', orderData).catch((error) => {
                        if (error.message === 'General:Invalid arguments:volume') return null;
                        else if (error.message === 'Order:Insufficient funds') return null;
                        else if (error.message === 'API:Invalid nonce') getResponse(ctx);
                        else throw error;
                    }));
                }
                getResponse(this);
                await (new Promise(async (res, rej) => {
                    while (response === undefined) {
                        await util.sleep(10)
                    }
                    res();
                }));
                if (!response) return null;
                await util.sleep(100);

                return {txid: response.result.txid, price, volume, cost};
            } else {
                if (!currentBalance[config.baseAsset]) return null;

                const multiplier = (balanceRatio - targetRatio) * (1 / balanceRatio);
                const price = Math.floor(parseFloat(tickerInfo.b[0]) * (10 ** config.exchange.pricePrecision)) / (10 ** config.exchange.pricePrecision);
                const volume = Math.floor((currentBalance[config.baseAsset] * multiplier) * (10 ** config.exchange.basePrecision)) / (10 ** config.exchange.basePrecision);
                const cost = Math.floor((volume * price) * (10 ** config.exchange.quotePrecision)) / (10 ** config.exchange.quotePrecision);

                if (volume < config.exchange.baseMinimumTransaction) return null;

                const orderData = {
                    pair: config.assetPair,
                    type: 'sell',
                    ordertype: config.exchange.forceMaker ? 'limit' : 'market',
                    volume,
                    price: config.exchange.forceMaker ? price : undefined,
                    expiretm: `+30`,
                    oflags: config.exchange.forceMaker ? 'post' : undefined
                };

                let response;
                async function getResponse(ctx) {
                    response = (await ctx.krakenClient.api('AddOrder', orderData).catch((error) => {
                        if (error.message === 'General:Invalid arguments:volume') return null;
                        else if (error.message === 'Order:Insufficient funds') return null;
                        else if (error.message === 'API:Invalid nonce') getResponse(ctx);
                        else throw error;
                    }));
                }
                getResponse(this);
                await (new Promise(async (res, rej) => {
                    while (response === undefined) {
                        await util.sleep(10)
                    }
                    res();
                }));
                if (!response) return null;
                await util.sleep(100);
                
                return {txid: response.result.txid, price, volume, cost};
            }
        }
    }

    async getBalance() {
        let result;
        async function getResult(ctx) {
            result = (await ctx.krakenClient.api('Balance', {}).catch((error) => {
                if (error.message === 'API:Invalid nonce') getResult(ctx);
                else throw error;
            })).result;
        }
        getResult(this);
        await (new Promise(async (res, rej) => {
            while (!result) {
                await util.sleep(10)
            }
            res();
        }));
        await util.sleep(100);
        
        let entries = Object.entries(result);
        entries = entries.filter((pair) => [config.baseAsset, config.quoteAsset].includes(pair[0]));
        entries = entries.map((pair) => [pair[0], parseFloat(pair[1])]);
        
        const data = Object.fromEntries(entries);
        return data;
    }

    async getTickerInfo(pair) {
        const result = (await this.krakenClient.api('Ticker', {pair: pair ? pair : config.assetPair})).result[pair ? pair : config.assetPair];
        await util.sleep(100);
        return result;
    }
}

module.exports = {
    Kraken
};