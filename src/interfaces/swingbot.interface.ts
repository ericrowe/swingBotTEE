export namespace Swingbot {
    export interface Signal {
        symbol: string;
        buyPrice: number;
        sellPrice: number;
        stopPrice: number;
    }

    export interface FollowUser {
        name: string;
        id: string;
    }

    export interface TDAAccount {
        enabled: boolean;
        account_number: String;
        perTradeAllowance: number;
        totalAllowance: number
    }

    export interface Settings {
        twitter: {
            api: {
                consumer_key: string;
                consumer_secret: string;
                access_token_key: string;
                access_token_secret: string;
            }
            followUsers: FollowUser[];
            authorizedSignalsFromUsers: string[];
        };
        alpaca: {
            enabled: boolean
            api: {
                keyId: string;
                secretKey: string;
            }
            swingbot: {
                maxNumberOfTrades: number;
                perTradeAllowance: number;
                totalAllowance: number;
            }
        };
        tda: {
            api: {
                refresh_token: string;
                client_id: string;
            }
            swingbot: TDAAccount[];
        };
        swingbot: {
            logging: "normal" | "verbose";
        };
    }
}
