const config = require('./config.json');
const util = require('./util.js');

const KrakenClient = require('kraken-api');

class Kraken {
    krakenClient;

    constructor() {
        this.krakenClient = new KrakenClient(process.env.KRAKEN_KEY, process.env.KRAKEN_SECRET);
    }

    async getData(includeCurrentPeriod) {
        const since = Math.floor((Date.now() - (config.source.minDataLength * config.periodInterval * 60000)) / 1000);
        const response = (await this.krakenClient.api('OHLC', {pair: config.assetPair, interval: config.periodInterval, since}));
        await util.sleep(100);

        let rawData = Object.entries(response.result).filter((pair) => pair[0] !== 'last')[0][1];
        if (!includeCurrentPeriod) rawData = rawData.slice(0, -1);

        const parsedData = rawData.map((periodData) => {
            return new util.Period(periodData[0] * 1000, {
                open: parseFloat(periodData[1]),
                high: parseFloat(periodData[2]),
                low: parseFloat(periodData[3]),
                close: parseFloat(periodData[4])
            });
        });

        return parsedData.slice(parsedData.length > config.source.minDataLength ? parsedData.length - config.source.minDataLength : 0);
    }
}

module.exports = {
    Kraken
};