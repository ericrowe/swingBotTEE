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
            api: {
                keyId: string;
                secretKey: string;
            }
        };
        swingbot: {
            logging: "normal" | "verbose";
        };
    }
}
