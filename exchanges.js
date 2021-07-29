const config = require('./config.json');

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

                const price = Math.floor((parseFloat(tickerInfo.a[0]) + config.exchange.margin) * (10 ** config.exchange.pricePrecision)) / (10 ** config.exchange.pricePrecision);
                const cost = Math.floor((currentBalance[config.quoteAsset] * score) * (10 ** config.exchange.basePrecision)) / (10 ** config.exchange.basePrecision);
                const volume = Math.floor((cost / price) * (10 ** config.exchange.quotePrecision)) / (10 ** config.exchange.quotePrecision);

                if (cost < config.exchange.quoteMinimumTransaction) return null;

                const result = (await this.krakenClient.api('AddOrder', {
                    pair: config.assetPair,
                    type: 'buy',
                    ordertype: 'limit',
                    volume,
                    price,
                    expiretm: `+30`,
                    oflags: config.exchange.forceMaker ? 'post' : undefined
                })).result;
                const txid = result.txid;

                return {txid, price, volume, cost};
            } else {
                if (!currentBalance[config.baseAsset]) return null;

                const price = Math.floor((parseFloat(tickerInfo.b[0]) - config.exchange.margin) * (10 ** config.exchange.pricePrecision)) / (10 ** config.exchange.pricePrecision);
                const volume = Math.floor((currentBalance[config.baseAsset] * -score) * (10 ** config.exchange.quotePrecision)) / (10 ** config.exchange.quotePrecision);
                const cost = Math.floor((volume * price) * (10 ** config.exchange.basePrecision)) / (10 ** config.exchange.basePrecision);

                if (volume < config.exchange.baseMinimumTransaction) return null;

                const result = (await this.krakenClient.api('AddOrder', {
                    pair: config.assetPair,
                    type: 'sell',
                    ordertype: 'limit',
                    volume: volume,
                    price: price,
                    expiretm: `+30`,
                    oflags: config.exchange.forceMaker ? 'post' : undefined
                })).result;
                const txid = result.txid;

                return {txid, price, volume, cost};
            }
        }
    }

    async getBalance() {
        const result = (await this.krakenClient.api('Balance', {})).result;
        
        let entries = Object.entries(result);
        entries = entries.filter((pair) => [config.baseAsset, config.quoteAsset].includes(pair[0]));
        entries = entries.map((pair) => [pair[0], parseFloat(pair[1])]);
        
        const data = Object.fromEntries(entries);
        return data;
    }

    async getTickerInfo() {
        return (await this.krakenClient.api('Ticker', {pair: config.assetPair})).result[config.assetPair];
    }
}

module.exports = {
    Kraken
};