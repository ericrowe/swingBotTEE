import { Swingbot } from "../interfaces/swingbot.interface";
import {v4 as uuidv4} from 'uuid';
import { swingbotSettings } from "../settings";
import { SwingbotUtils } from "./swingbot";

const tdaclient = require('tda-api-client');

export class TDASB {
    public tradeBalance: { [name: string]: number; } = { }
    constructor(private swingbotSettings: Swingbot.Settings) {
        const parent = this
        swingbotSettings.tda.swingbot.forEach(function (accountConfiguration) {
            parent.tradeBalance[accountConfiguration.account_number.toString()] = 0
        })
        this.testPurchasePrices()
    }
    public printStatus() {
        var parent = this
        swingbotSettings.tda.swingbot.forEach(function (accountConfiguration) {
            parent.getPositionsAndOrderCount(accountConfiguration)
            .then((count:number) => {
                parent.getAccount(accountConfiguration)
                    .then((account) => {
                        console.log('');
                        console.log('------------------------');
                        console.log('----  TD Ameritrade ----')
                        console.log('------------------------')
                        console.log(`Account:         ${accountConfiguration.account_number}`)
                        console.log(`Order Count:     ${count}`)
                        console.log(`Tradable:        ${account.securitiesAccount.currentBalances.cashAvailableForTrading}`)
                        console.log(`Withdrawable:    ${account.securitiesAccount.currentBalances.cashAvailableForWithdrawal}`)
                        console.log(`Trade Balance:   ${parent.tradeBalance[accountConfiguration.account_number.toString()]} / ${accountConfiguration.totalAllowance}`)
                        console.log(`Trade Allowance: ${parent.getAllowanceFromAccount(account, accountConfiguration)} / ${accountConfiguration.perTradeAllowance}`)
                        console.log('------------------------')
                        console.log('')                
                    })
                    .catch((e) => {
                        console.log('... failed to to get account details')
                        console.log(e)
                    })
            })
            .catch((e) => {
                console.log('... failed to to get positions and order details')
                console.log(e)
            })
        }); 
    }
    // the withdrawl balance on TDA is the non-margin, settled funds.  this is a safe value to trade without risk of running into good faith violations.
    public getWithdrawlBalance(accountConfiguration:Swingbot.TDAAccount):any {
        var parent = this
        return new Promise(function(resolve, reject) {
            parent.getAccount(accountConfiguration)
                .then((account) => {
                    resolve(account.securitiesAccount.currentBalances.cashAvailableForWithdrawl)
                })
        })
    }
    // tradable balance includes any margin amounts
    public getTradableBalance(accountConfiguration:Swingbot.TDAAccount):any {
        var parent = this
        return new Promise(function(resolve, reject) {
            parent.getAccount(accountConfiguration)
                .then((account) => {
                    resolve(account.securitiesAccount.currentBalances.cashAvailableForTrading)
                })
        })
    }
    public getAccount(accountConfiguration:Swingbot.TDAAccount):any {
        return new Promise(function(resolve, reject) {
            const getAccountConfig = {
                accountId: accountConfiguration.account_number,
                authConfig: {
                    "refresh_token": swingbotSettings.tda.api.refresh_token,
                    "client_id": swingbotSettings.tda.api.client_id,
                }
            }
            tdaclient.accounts.getAccount(getAccountConfig)
                .then((accounts) => {
                    // console.log(accounts)
                    resolve(accounts)
                })
                .catch((e) => {
                    console.log('... failed to to get account details')
                    console.log(e)
                })
        })
    }
    public getAllowanceFromAccount(account:any, accountConfiguration:Swingbot.TDAAccount) : number {
        // tradeAllowance is the amount left in the daily allowance for this algorithm
        const tradeAllowance = Math.max(0,accountConfiguration.totalAllowance - this.tradeBalance[accountConfiguration.account_number.toString()])
        // balanceAvailable is the amount left in the account for trading, which is the lesser of the cash balance and the trading balance.  We're taking the cash balance into account to avoid good faith violations on these day trades.
        const balanceAvailable = (Math.min(account.securitiesAccount.currentBalances.cashAvailableForTrading, account.securitiesAccount.currentBalances.cashAvailableForWithdrawal) - accountConfiguration.minimumBalance) * 0.9;
        // finally we'll return the lowest value between the tradeAllowance, balanceAvailable, and the perTrade allowance, and then put a lower limit of 0 on that.
        return Math.max(0,Math.min(tradeAllowance,balanceAvailable,accountConfiguration.perTradeAllowance))
    }
    public getAllowance(accountConfiguration:Swingbot.TDAAccount):any {
        const parent = this
        return new Promise(function(resolve, reject) {
            parent.getAccount(accountConfiguration)
                .then((account) => {
                    resolve(parent.getAllowanceFromAccount(account, accountConfiguration))
                })
        })
    }
    public getPositionsAndOrderCount(account:Swingbot.TDAAccount):any {
        return new Promise(function(resolve, reject) {
            const getOrdersConfig = {
                accountId: account.account_number,
                maxResults: 20,
                authConfig: {
                    "refresh_token": swingbotSettings.tda.api.refresh_token,
                    "client_id": swingbotSettings.tda.api.client_id,
                }
            }
            tdaclient.orders.getOrdersByAccount(getOrdersConfig)
                .then((orders) => {
                    resolve(orders.length)
                })
                .catch(e => {
                    console.log('... failed to to get position and order count')
                    console.log(e)
                })
        })
    }
    public buyStockOnAllAccounts(signal: Swingbot.Signal) {
        var parent = this
        swingbotSettings.tda.swingbot.forEach(function (account) {
            parent.buyStock(signal, account)
        })
    }
    private testPurchasePrices() {
        this.testPurchaseInternal("CRUS", 76.68, 90, 50)
        this.testPurchaseInternal("CRUS", 75, 76, 50)
    }
    private testPurchaseInternal(symbol:string, buyPrice: number, sellPrice: number, stopPrice: number) {
        const testSignal : Swingbot.Signal = {
            symbol: symbol,
            buyPrice: buyPrice,
            sellPrice: sellPrice,
            stopPrice: stopPrice
        }
        this.findPurchasePrice(testSignal)
            .then((quoteAnalysis:Swingbot.QuoteAnalysis) => {
                console.log(`(${buyPrice}, ${sellPrice}, ${stopPrice}) => ${quoteAnalysis.limitBuyPrice}`)
            })
            .catch(e => {
                console.log(`(${buyPrice}, ${sellPrice}, ${stopPrice}) => ERROR ${e}`)
            })
    }
    // find a value to use as a limit purchase price
    // will be 0.1% above the ask price, if that is more than 1 cent below the sell price
    // will reject the promise if the trade is not viable, or it cannot find an ask price
    private findPurchasePrice(signal: Swingbot.Signal) {
        return new Promise(function(resolve, reject) {
            const getQuoteConfig = {
                symbol: signal.symbol,
                authConfig: {
                    "refresh_token": swingbotSettings.tda.api.refresh_token,
                    "client_id": swingbotSettings.tda.api.client_id,
                }
            };
            tdaclient.quotes.getQuote(getQuoteConfig)
                .then((quote) => {
                    console.log(quote[signal.symbol].askPrice)
                    const targetBump = Math.max(0.01, Math.round(quote[signal.symbol].askPrice * 0.001 * 100) / 100)
                    console.log(targetBump)
                    const targetPrice = quote[signal.symbol].askPrice + targetBump
                    if ((targetPrice + 0.01) >= signal.sellPrice) {
                        reject(new Error('Target already passed, aborting buy order'))
                    }
                    const quoteAnalysis : Swingbot.QuoteAnalysis = {
                        symbol: signal.symbol,
                        askPrice: quote[signal.symbol].askPrice,
                        bidPrice: quote[signal.symbol].bidPrice,
                        limitBuyPrice: targetPrice
                    }
                    resolve(quoteAnalysis)
                })
                .catch(e => {
                    reject(e)
                })    
        })
    }
    public buyStock(signal: Swingbot.Signal, account:Swingbot.TDAAccount):any {
        const parent = this
        return new Promise(function(resolve, reject) {
            parent.getAllowance(account)
                .then((allowance:number) => {
                    if (allowance <= 0) {
                        reject(new Error(`Account: ${account.account_number}, Allowance: ${allowance}; No money to transact on`))
                    } else {
                        parent.findPurchasePrice(signal)
                            .then((quoteAnalysis:Swingbot.QuoteAnalysis) => {
                                const price = quoteAnalysis.limitBuyPrice
                                const quantity = parseInt(`${allowance / price}`);
                                console.log(`Buy ${quantity} of ${signal.symbol} at LIMIT ${price}`)
                                if (quantity <= 0) {
                                    reject(new Error(`Account: ${account.account_number}, Allowance: ${allowance}, Trade Price: ${price}, Quantity: ${quantity}; Not enough money to transact`))
                                } else {
                                    parent.tradeBalance[account.account_number.toString()] += (quantity * signal.buyPrice)
                                    const order = {
                                        orderJSON: {
                                            "orderStrategyType": "TRIGGER",
                                            "session": "NORMAL",
                                            "duration": "FILL_OR_KILL",
                                            "orderType": "LIMIT",
                                            "price": price,
                                            "orderLegCollection": [
                                              {
                                                "instruction": "BUY",
                                                "quantity": quantity,
                                                "instrument": {
                                                  "assetType": "EQUITY",
                                                  "symbol": signal.symbol.toUpperCase()
                                                }
                                              }
                                            ],
                                            "childOrderStrategies": [
                                              {
                                                "orderStrategyType": "OCO",
                                                "childOrderStrategies": [
                                                  {
                                                    "orderStrategyType": "SINGLE",
                                                    "session": "NORMAL",
                                                    "duration": "GOOD_TILL_CANCEL",
                                                    "orderType": "LIMIT",
                                                    "price": signal.sellPrice,
                                                    "orderLegCollection": [
                                                      {
                                                        "instruction": "SELL",
                                                        "quantity": quantity,
                                                        "instrument": {
                                                          "assetType": "EQUITY",
                                                          "symbol": signal.symbol.toUpperCase()
                                                        }
                                                      }
                                                    ]
                                                  },
                                                  {
                                                    "orderStrategyType": "SINGLE",
                                                    "session": "NORMAL",
                                                    "duration": "GOOD_TILL_CANCEL",
                                                    "orderType": "STOP",
                                                    "stopPrice": signal.stopPrice,
                                                    "orderLegCollection": [
                                                      {
                                                        "instruction": "SELL",
                                                        "quantity": quantity,
                                                        "instrument": {
                                                          "assetType": "EQUITY",
                                                          "symbol": signal.symbol.toUpperCase()
                                                         }
                                                      }
                                                    ]
                                                  }
                                                ]
                                              }
                                            ]
                                        },
                                        accountId: account.account_number,
                                        authConfig: {
                                            "refresh_token": swingbotSettings.tda.api.refresh_token,
                                            "client_id": swingbotSettings.tda.api.client_id,
                                        }
                                    };
                                    console.log('');
                                    console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$');
                                    console.log("Buying: ", JSON.stringify(order));
                                    console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$');
                                    console.log('');
                                    if (account.enabled) {
                                        tdaclient.orders.placeOrder(order)
                                            .then(r => { resolve(r) })
                                            .catch(e => { reject(e) })
                                    } else {
                                        reject(new Error('TDA account is not Enabled'))
                                    }
                                }        
                            })
                            .catch(e => {
                                reject(e)
                            })
                    }
                })
        })
    }
}


