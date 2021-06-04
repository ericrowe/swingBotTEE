import { Swingbot } from "./interfaces/swingbot.interface";

export const swingbotSettings: Swingbot.Settings = {
    twitter: {
        api: {
            consumer_key: '--- TWITTER CONSUMER API KEY HERE ---',
            consumer_secret: '--- TWITTER CONSUMER API SECRET HERE ---',
            access_token_key: '--- TWITTER AUTHENTICATION ACCESS TOKEN KEY HERE ---',
            access_token_secret: '--- TWITTER AUTHENTICATION ACCESS TOKEN SECRET HERE --- ',

        },
        followUsers: [
            { name: "@r_scalp", id: "1379234944652697600" },
            { name: "@SwingBot_Small", id: "1388217130709962753" },
        ],
        authorizedSignalsFromUsers: ['@r_scalp', '@SwingBot_Small']
    },
    alpaca: {
        enabled: true,
        api: {
            keyId: '--- ALPACA API KEY HERE ---',
            secretKey: '--- ALPACA SECRET KEY HERE ---',
        },
        swingbot: {
            maxNumberOfTrades: 6,
            perTradeAllowance: 35000,
            totalAllowance: 100000,
        }
    },
    tda: {
        api: {
            refresh_token: '--- TD AMERITRADE API KEY HERE',
            client_id: '--- TD AMERITRADE CLIENT ID HERE ---',
        },
        swingbot: [
            { enabled: true, account_number: '--- TD AMERITRADE ACCOUNT NUMBER HERE ---', perTradeAllowance: 3500, totalAllowance: 10000, minimumBalance: 1000 }
        ]
    },
    swingbot: {
        logging: 'normal'
    }
}
