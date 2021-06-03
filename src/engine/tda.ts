import { Swingbot } from "../interfaces/swingbot.interface";
import {v4 as uuidv4} from 'uuid';
import { swingbotSettings } from "../settings";
import { SwingbotUtils } from "./swingbot";

const tdaclient = require('tda-api-client');

export class TDASB {
    public tradeBalance:number
    constructor(private swingbotSettings: Swingbot.Settings) {
        this.tradeBalance = 0
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
                        console.log(`Trade Balance:   ${parent.tradeBalance} / ${accountConfiguration.totalAllowance}`)
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
        const tradeAllowance = Math.max(0,accountConfiguration.totalAllowance - this.tradeBalance)
        // balanceAvailable is the amount left in the account for trading, which is the lesser of the cash balance and the trading balance.  We're taking the cash balance into account to avoid good faith violations on these day trades.
        const balanceAvailable = Math.min(account.securitiesAccount.currentBalances.cashAvailableForTrading, account.securitiesAccount.currentBalances.cashAvailableForWithdrawal)
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
    public buyStock(signal: Swingbot.Signal, account:Swingbot.TDAAccount):any {
        const parent = this
        return new Promise(function(resolve, reject) {
            parent.getAllowance(account)
                .then((allowance) => {
                    if (allowance <= 0) {
                        reject(new Error('No money left to transact on'))
                    } else {
                        const quantity = parseInt(`${allowance / signal.buyPrice}`);
                        parent.tradeBalance += (quantity * signal.buyPrice)
                        if (quantity <= 0) {
                            reject(new Error('Not enough money to transact'))
                        } else {
                            const order = {
                                orderJSON: {
                                    "orderStrategyType": "TRIGGER",
                                    "session": "NORMAL",
                                    "duration": "DAY",
                                    "orderType": "MARKET",
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
                                            "session": "SEAMLESS",
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
                                            "session": "SEAMLESS",
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
                                return tdaclient.orders.placeOrder(order);
                            } else {
                                return new Promise(function(resolve, reject) {
                                    reject(new Error('TDA is not Enabled'))
                                })
                            }
                        }
                    }
                })
        })
    }
}

