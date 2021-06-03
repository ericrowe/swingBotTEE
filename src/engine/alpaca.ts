import { Swingbot } from "../interfaces/swingbot.interface";

const Alpaca = require('@alpacahq/alpaca-trade-api');

export class AlpacaSB {
    private alpaca;
    private settings = { paper: true, usePolygon: false };

    constructor(private swingbotSettings: Swingbot.Settings) {
        this.alpaca = new Alpaca(Object.assign({}, swingbotSettings.alpaca.api, this.settings));
    }

    public printStatus() {
        this.checkAllowance()
            .then((allowance) => {
                console.log('');
                console.log('------------------------');
                console.log('-------  Alpaca --------')
                console.log('------------------------')
                console.log(`Allowance:   ${allowance}`)
                console.log('------------------------')
                console.log('')
            })
    }
    public getPositionsAndOrdersCount() {
        var alpaca = this.alpaca
        return new Promise(function(resolve, reject) {
            alpaca.getPositions()
            .then((portfolio) => {
                alpaca.getOrders({
                    status: 'open',
                    limit: 100
                }).then((orders) => {
                    resolve(portfolio.length + orders.filter(order => order.side == 'buy').length)
                })
            })
        })
    }
    public checkAllowance() {
        var alpaca = this.alpaca
        var swingbotSettings = this.swingbotSettings
        var parent = this
        return new Promise(function(resolve, reject) {
            parent.getPositionsAndOrdersCount()
                .then((positionsAndOrdersCount:number) => {
                    const allowedOrders = Math.max(0, swingbotSettings.alpaca.swingbot.maxNumberOfTrades - positionsAndOrdersCount)
                    alpaca.getAccount()
                        .then((account) => {
                            const allowance = account.buying_power / allowedOrders
                            const amountPerTradeInDollars = Math.min(allowance, swingbotSettings.alpaca.swingbot.perTradeAllowance)
                            resolve(amountPerTradeInDollars)
                        })
                })
        })
    }



    public buyStock(signal: Swingbot.Signal): any {
        this.checkAllowance() 
            .then((amountPerTradeInDollars:number) => {
                const quantity = parseInt(`${amountPerTradeInDollars / signal.buyPrice}`);
                const order = {
                    symbol: signal.symbol.toUpperCase(),
                    qty: quantity,
                    side: 'buy',
                    type: 'market',
                    time_in_force: 'day',
                    order_class: 'bracket',
                    stop_loss: {
                        stop_price: signal.stopPrice,
                    },
                    take_profit: {
                        limit_price: signal.sellPrice
                    }
                };
                console.log('');
                console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$');
                console.log("Buying: ", JSON.stringify(order));
                console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$');
                console.log('');
                if (this.swingbotSettings.alpaca.enabled) {
                    return this.alpaca.createOrder(order);
                } else {
                    return new Promise(function(resolve, reject) {
                        reject(new Error('Alpaca is not Enabled'))
                    })
                }
            })
            .catch(e => {
                console.log('... failed to buy stock')
                console.log(e)
            })
    }

    public static logPurchaseSuccess(signal: Swingbot.Signal) {
        console.log(`Bought ${signal.symbol} on Alpaca = OK`)
    }

    public static logPurchaseError(signal: Swingbot.Signal, e: any) {
        console.log('***********************************')
        console.log(' ALPACA ERROR')
        console.log(` ERROR BUYING '${signal.symbol}'`)
        console.log(' MESSAGE: ', e.error?.message)
        console.log('***********************************')
    }

}
