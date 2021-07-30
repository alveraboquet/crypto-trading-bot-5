const config = require('./config.json');
const util = require('./util.js');

const KrakenClient = require('kraken-api');

class Kraken {
    krakenClient;

    constructor() {
        this.krakenClient = new KrakenClient(process.env.KRAKEN_KEY, process.env.KRAKEN_SECRET);
    }

    async placeOrder(score) {
        if (score === 0) {
            throw new Error('Specified score is invalid!');
        } else {
            const currentBalance = await this.getBalance();
            const tickerInfo = await this.getTickerInfo();

            if (score > 0) {
                if (!currentBalance[config.quoteAsset]) return null;

                const price = Math.floor((parseFloat(tickerInfo.a[0]) + (config.exchange.forceMaker ? config.exchange.makerMargin : config.exchange.takerMargin)) * (10 ** config.exchange.pricePrecision)) / (10 ** config.exchange.pricePrecision);
                const cost = Math.floor((currentBalance[config.quoteAsset] * score) * (10 ** config.exchange.quotePrecision)) / (10 ** config.exchange.quotePrecision);
                const volume = Math.floor((cost / price) * (10 ** config.exchange.basePrecision)) / (10 ** config.exchange.basePrecision);

                if (cost < config.exchange.quoteMinimumTransaction) return null;

                let response;
                async function getResponse(ctx) {
                    response = (await ctx.krakenClient.api('AddOrder', {
                        pair: config.assetPair,
                        type: 'buy',
                        ordertype: 'limit',
                        volume,
                        price,
                        expiretm: `+30`,
                        oflags: config.exchange.forceMaker ? 'post' : undefined
                    }).catch((error) => {
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

                const price = Math.floor((parseFloat(tickerInfo.b[0]) - (config.exchange.forceMaker ? config.exchange.makerMargin : config.exchange.takerMargin)) * (10 ** config.exchange.pricePrecision)) / (10 ** config.exchange.pricePrecision);
                const volume = Math.floor((currentBalance[config.baseAsset] * -score) * (10 ** config.exchange.basePrecision)) / (10 ** config.exchange.basePrecision);
                const cost = Math.floor((volume * price) * (10 ** config.exchange.quotePrecision)) / (10 ** config.exchange.quotePrecision);

                if (volume < config.exchange.baseMinimumTransaction) return null;

                let response;
                async function getResponse(ctx) {
                    response = (await ctx.krakenClient.api('AddOrder', {
                        pair: config.assetPair,
                        type: 'sell',
                        ordertype: 'limit',
                        volume: volume,
                        price: price,
                        expiretm: `+30`,
                        oflags: config.exchange.forceMaker ? 'post' : undefined
                    }).catch((error) => {
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