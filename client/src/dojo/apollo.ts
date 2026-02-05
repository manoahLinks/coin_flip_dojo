import { ApolloClient, InMemoryCache, HttpLink, gql } from "@apollo/client";
import { TORII_URL } from "./dojoConfig";

// Apollo Client configured for Torii GraphQL endpoint
export const apolloClient = new ApolloClient({
    link: new HttpLink({ uri: `${TORII_URL}/graphql` }),
    cache: new InMemoryCache(),
});

// GraphQL Queries
export const GET_PLAYER_STATS = gql`
    query GetPlayerStats($address: String!) {
        coinFlipPlayerModels(where: { address: $address }) {
            edges {
                node {
                    address
                    total_flips
                    wins
                    losses
                }
            }
        }
    }
`;

export const GET_LATEST_GAME = gql`
    query GetLatestGame($player: String!) {
        coinFlipGameModels(
            where: { player: $player }
            order: { field: GAME_ID, direction: DESC }
            first: 1
        ) {
            edges {
                node {
                    player
                    game_id
                    prediction
                    outcome
                    won
                }
            }
        }
    }
`;

export const GET_ALL_GAMES = gql`
    query GetAllGames($player: String!) {
        coinFlipGameModels(
            where: { player: $player }
            order: { field: GAME_ID, direction: DESC }
        ) {
            edges {
                node {
                    player
                    game_id
                    prediction
                    outcome
                    won
                }
            }
        }
    }
`;

// Types for query responses
export interface PlayerStats {
    address: string;
    total_flips: number;
    wins: number;
    losses: number;
}

export interface GameRecord {
    player: string;
    game_id: number;
    prediction: number;
    outcome: number;
    won: boolean;
}

export interface PlayerStatsResponse {
    coinFlipPlayerModels: {
        edges: Array<{
            node: PlayerStats;
        }>;
    };
}

export interface LatestGameResponse {
    coinFlipGameModels: {
        edges: Array<{
            node: GameRecord;
        }>;
    };
}
