# Coin Flip - A Dojo On-Chain Game Tutorial

A simple coin flip prediction game built with [Dojo](https://dojoengine.org) to teach the fundamentals of building on-chain games on Starknet.

## What You'll Learn

- Setting up a Dojo project
- Creating models (on-chain state)
- Writing systems (game logic)
- Deploying to local Katana
- Indexing with Torii
- Building a React frontend
- Querying with Apollo Client

## Prerequisites

Install the following tools:

- [Dojo](https://book.dojoengine.org/getting-started/quick-start) (v1.8+)
- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (recommended) or npm

Verify installation:
```bash
sozo --version    # Should show 1.8.x
katana --version  # Should show 1.8.x
torii --version   # Should show 1.8.x
```

## Project Structure

```
coin_flip/
├── contracts/              # Dojo smart contracts
│   ├── src/
│   │   ├── lib.cairo
│   │   ├── models.cairo    # Player & Game models
│   │   ├── systems/
│   │   │   └── actions.cairo   # Flip logic
│   │   └── tests/
│   │       └── test_world.cairo
│   ├── Scarb.toml
│   └── dojo_dev.toml
│
└── client/                 # React frontend
    ├── src/
    │   ├── App.tsx
    │   ├── App.css
    │   └── dojo/
    │       ├── apollo.ts       # GraphQL client
    │       ├── contracts.gen.ts
    │       ├── dojoConfig.ts
    │       ├── manifest.json
    │       ├── models.gen.ts
    │       └── useDojo.ts
    ├── package.json
    └── vite.config.ts
```

---

## Part 1: Smart Contracts

### Step 1: Initialize Dojo Project

```bash
mkdir coin_flip && cd coin_flip
sozo init contracts
cd contracts
```

Create `.tool-versions` to pin the Dojo version:
```
dojo 1.8.6
```

### Step 2: Configure the Project

Edit `Scarb.toml`:
```toml
[package]
name = "coin_flip"
version = "1.0.0"
edition = "2024_07"

[cairo]
sierra-replace-ids = true

[scripts]
migrate = "sozo build && sozo migrate"
flip = "sozo execute coin_flip-actions flip -c 0 --wait"

[dependencies]
dojo = "1.8.0"
starknet = "2.13.1"

[[target.starknet-contract]]
build-external-contracts = ["dojo::world::world_contract::world"]

[tool.scarb]
allow-prebuilt-plugins = ["dojo_cairo_macros"]

[dev-dependencies]
cairo_test = "2.13.1"
dojo_cairo_test = "1.8.0"
```

Edit `dojo_dev.toml`:
```toml
[world]
name = "Coin Flip"
description = "A simple coin flip prediction game to learn Dojo development."
seed = "coin_flip"

[namespace]
default = "coin_flip"

[env]
rpc_url = "http://localhost:5050/"
account_address = "0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec"
private_key = "0xc5b2fcab997346f3ea1c00b002ecf6f382c5f9c9659a3894eb783c5320f912"

[writers]
"coin_flip" = ["coin_flip-actions"]
```

### Step 3: Define Models

Models define your on-chain state. Edit `src/models.cairo`:

```cairo
use starknet::ContractAddress;

/// Player model - tracks a player's coin flip statistics
/// The #[key] attribute marks the field used to uniquely identify each record
#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct Player {
    #[key]
    pub address: ContractAddress,  // Unique identifier for the player
    pub total_flips: u32,          // Total number of coin flips
    pub wins: u32,                 // Number of correct predictions
    pub losses: u32,               // Number of incorrect predictions
}

/// Game model - records each individual coin flip
/// Uses composite key (player + game_id) for uniqueness
#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct Game {
    #[key]
    pub player: ContractAddress,   // The player who made this flip
    #[key]
    pub game_id: u32,              // Unique game ID per player
    pub prediction: u8,            // 0 = Heads, 1 = Tails
    pub outcome: u8,               // 0 = Heads, 1 = Tails
    pub won: bool,                 // Whether the prediction was correct
}
```

**Key Concepts:**
- `#[dojo::model]` - Marks a struct as a Dojo model (stored on-chain)
- `#[key]` - Fields that uniquely identify a model instance
- Models are automatically indexed by Torii

### Step 4: Create the System

Systems contain your game logic. Edit `src/systems/actions.cairo`:

```cairo
use coin_flip::models::{Player, Game};

/// Interface defining the available actions in our game
#[starknet::interface]
pub trait IActions<T> {
    /// Flip the coin with a prediction (0 = Heads, 1 = Tails)
    fn flip(ref self: T, prediction: u8);
}

/// The main contract that handles game logic
#[dojo::contract]
pub mod actions {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use super::{IActions, Player, Game};

    /// Event emitted when a coin is flipped
    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct Flipped {
        #[key]
        pub player: ContractAddress,
        pub game_id: u32,
        pub prediction: u8,
        pub outcome: u8,
        pub won: bool,
    }

    #[abi(embed_v0)]
    impl ActionsImpl of IActions<ContractState> {
        /// Flip the coin with a prediction
        /// prediction: 0 = Heads, 1 = Tails
        fn flip(ref self: ContractState, prediction: u8) {
            // Validate prediction (must be 0 or 1)
            assert(prediction == 0 || prediction == 1, 'Invalid prediction');

            // Get world storage
            let mut world = self.world_default();

            // Get the caller's address
            let caller = get_caller_address();

            // Read current player stats (or default if new player)
            let mut player: Player = world.read_model(caller);

            // Generate outcome using block timestamp (simple randomness)
            // In production, you'd want a more secure source of randomness
            let timestamp = get_block_timestamp();
            let outcome: u8 = (timestamp % 2).try_into().unwrap();

            // Determine if player won
            let won = prediction == outcome;

            // Update player stats
            let new_game_id = player.total_flips + 1;
            player.total_flips = new_game_id;
            if won {
                player.wins += 1;
            } else {
                player.losses += 1;
            }
            player.address = caller;

            // Create game record
            let game = Game {
                player: caller,
                game_id: new_game_id,
                prediction,
                outcome,
                won,
            };

            // Write updated models to world
            world.write_model(@player);
            world.write_model(@game);

            // Emit event for indexer
            world.emit_event(@Flipped {
                player: caller,
                game_id: new_game_id,
                prediction,
                outcome,
                won,
            });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Use the default namespace "coin_flip"
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"coin_flip")
        }
    }
}
```

**Key Concepts:**
- `#[dojo::contract]` - Marks a module as a Dojo system
- `world.read_model(key)` - Read model data from world
- `world.write_model(@model)` - Write model data to world
- `world.emit_event(@event)` - Emit events for indexing

### Step 5: Write Tests

Edit `src/tests/test_world.cairo`:

```cairo
#[cfg(test)]
mod tests {
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorageTrait, world};
    use dojo_cairo_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait,
        spawn_test_world,
    };
    use coin_flip::models::{Player, Game, m_Player, m_Game};
    use coin_flip::systems::actions::{IActionsDispatcher, IActionsDispatcherTrait, actions};
    use starknet::ContractAddress;
    use starknet::testing::set_contract_address;

    fn namespace_def() -> NamespaceDef {
        NamespaceDef {
            namespace: "coin_flip",
            resources: [
                TestResource::Model(m_Player::TEST_CLASS_HASH),
                TestResource::Model(m_Game::TEST_CLASS_HASH),
                TestResource::Event(actions::e_Flipped::TEST_CLASS_HASH),
                TestResource::Contract(actions::TEST_CLASS_HASH),
            ]
                .span(),
        }
    }

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(@"coin_flip", @"actions")
                .with_writer_of([dojo::utils::bytearray_hash(@"coin_flip")].span())
        ]
            .span()
    }

    #[test]
    fn test_flip() {
        let caller: ContractAddress = 0x1.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        set_contract_address(caller);

        // Verify initial state
        let player_before: Player = world.read_model(caller);
        assert(player_before.total_flips == 0, 'initial flips should be 0');

        // Perform a flip
        actions_system.flip(0);

        // Verify updated state
        let player_after: Player = world.read_model(caller);
        assert(player_after.total_flips == 1, 'should have 1 flip');
    }
}
```

### Step 6: Build and Test

```bash
sozo build
sozo test
```

---

## Part 2: Deploy to Local Network

### Step 1: Start Katana

Open a terminal and run:
```bash
katana --dev --dev.no-fee --http.cors_origins "*"
```

Keep this running. Katana is your local Starknet node.

### Step 2: Deploy Contracts

In another terminal:
```bash
cd contracts
sozo build && sozo migrate
```

Note the **World Address** from the output - you'll need it for Torii.

### Step 3: Test via CLI

```bash
# Execute a flip (0 = Heads, 1 = Tails)
sozo execute coin_flip-actions flip 0 --wait

# Check player stats
sozo model get coin_flip-Player 0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec

# Check game record
sozo model get coin_flip-Game 0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec 1
```

### Step 4: Start Torii Indexer

```bash
torii --world <WORLD_ADDRESS> --http.cors_origins "*"
```

Replace `<WORLD_ADDRESS>` with the address from step 2.

Torii provides:
- GraphQL API at `http://localhost:8080/graphql`
- gRPC API at `http://localhost:50051`

### Step 5: Test GraphQL

Open `http://localhost:8080/graphql` in your browser and run:

```graphql
{
  coinFlipPlayerModels {
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
```

---

## Part 3: React Frontend

### Step 1: Create React App

```bash
cd ..  # Back to coin_flip root
pnpm create vite client --template react-ts
cd client
pnpm install
```

### Step 2: Install Dependencies

```bash
# Dojo SDK
pnpm add @dojoengine/core @dojoengine/sdk @dojoengine/torii-client starknet@^8.1.2

# Apollo Client for GraphQL
pnpm add @apollo/client graphql

# Vite WASM support
pnpm add -D vite-plugin-wasm vite-plugin-top-level-await
```

### Step 3: Configure Vite

Edit `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
  ],
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['@dojoengine/torii-client'],
  },
})
```

### Step 4: Generate TypeScript Bindings

```bash
cd ../contracts
sozo build --typescript
```

Copy generated files to client:
```bash
mkdir -p ../client/src/dojo
cp bindings/typescript/*.ts ../client/src/dojo/
cp manifest_dev.json ../client/src/dojo/manifest.json
```

### Step 5: Create Dojo Configuration

Create `client/src/dojo/dojoConfig.ts`:
```typescript
import { createDojoConfig } from "@dojoengine/core";
import manifest from "./manifest.json";

export const dojoConfig = createDojoConfig({
    manifest: manifest as any,
});

export const KATANA_RPC_URL = "http://localhost:5050";
export const TORII_URL = "http://localhost:8080";

// Master account from Katana (for development only!)
export const MASTER_ADDRESS = "0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec";
export const MASTER_PRIVATE_KEY = "0xc5b2fcab997346f3ea1c00b002ecf6f382c5f9c9659a3894eb783c5320f912";
```

### Step 6: Create Dojo Hook

Create `client/src/dojo/useDojo.ts`:
```typescript
import { useEffect, useState } from "react";
import { DojoProvider } from "@dojoengine/core";
import { Account, AccountInterface, RpcProvider } from "starknet";
import { setupWorld } from "./contracts.gen";
import {
    dojoConfig,
    KATANA_RPC_URL,
    MASTER_ADDRESS,
    MASTER_PRIVATE_KEY,
} from "./dojoConfig";

export interface DojoContext {
    account: AccountInterface | null;
    client: ReturnType<typeof setupWorld> | null;
    isLoading: boolean;
    error: Error | null;
}

export function useDojo(): DojoContext {
    const [account, setAccount] = useState<AccountInterface | null>(null);
    const [client, setClient] = useState<ReturnType<typeof setupWorld> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        async function initialize() {
            try {
                const rpcProvider = new RpcProvider({ nodeUrl: KATANA_RPC_URL });

                const masterAccount = new Account({
                    provider: rpcProvider,
                    address: MASTER_ADDRESS,
                    signer: MASTER_PRIVATE_KEY,
                });

                const dojoProvider = new DojoProvider(
                    dojoConfig.manifest,
                    KATANA_RPC_URL
                );
                const worldClient = setupWorld(dojoProvider);

                setAccount(masterAccount);
                setClient(worldClient);
            } catch (err) {
                console.error("Failed to initialize Dojo:", err);
                setError(err instanceof Error ? err : new Error(String(err)));
            } finally {
                setIsLoading(false);
            }
        }

        initialize();
    }, []);

    return { account, client, isLoading, error };
}
```

### Step 7: Set Up Apollo Client

Create `client/src/dojo/apollo.ts`:
```typescript
import { ApolloClient, InMemoryCache, HttpLink, gql } from "@apollo/client";
import { TORII_URL } from "./dojoConfig";

export const apolloClient = new ApolloClient({
    link: new HttpLink({ uri: `${TORII_URL}/graphql` }),
    cache: new InMemoryCache(),
});

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

export interface PlayerStatsResponse {
    coinFlipPlayerModels: {
        edges: Array<{
            node: {
                address: string;
                total_flips: number;
                wins: number;
                losses: number;
            };
        }>;
    };
}

export interface LatestGameResponse {
    coinFlipGameModels: {
        edges: Array<{
            node: {
                player: string;
                game_id: number;
                prediction: number;
                outcome: number;
                won: boolean;
            };
        }>;
    };
}
```

### Step 8: Build the Game UI

Replace `client/src/App.tsx`:
```typescript
import { useState, useEffect, useCallback } from "react";
import { useDojo } from "./dojo/useDojo";
import { MASTER_ADDRESS } from "./dojo/dojoConfig";
import {
    apolloClient,
    GET_PLAYER_STATS,
    GET_LATEST_GAME,
    PlayerStatsResponse,
    LatestGameResponse,
} from "./dojo/apollo";
import "./App.css";

type Prediction = 0 | 1;

function App() {
    const { account, client, isLoading, error } = useDojo();
    const [playerStats, setPlayerStats] = useState<{
        total_flips: number;
        wins: number;
        losses: number;
    } | null>(null);
    const [lastResult, setLastResult] = useState<{
        prediction: number;
        outcome: number;
        won: boolean;
    } | null>(null);
    const [isFlipping, setIsFlipping] = useState(false);

    const fetchPlayerStats = useCallback(async () => {
        try {
            const { data } = await apolloClient.query<PlayerStatsResponse>({
                query: GET_PLAYER_STATS,
                variables: { address: MASTER_ADDRESS },
                fetchPolicy: "network-only",
            });

            const player = data?.coinFlipPlayerModels?.edges?.[0]?.node;
            if (player) {
                setPlayerStats({
                    total_flips: Number(player.total_flips),
                    wins: Number(player.wins),
                    losses: Number(player.losses),
                });
            }
        } catch (err) {
            console.error("Failed to fetch player stats:", err);
        }
    }, []);

    const fetchLatestGame = useCallback(async () => {
        try {
            const { data } = await apolloClient.query<LatestGameResponse>({
                query: GET_LATEST_GAME,
                variables: { player: MASTER_ADDRESS },
                fetchPolicy: "network-only",
            });

            const game = data?.coinFlipGameModels?.edges?.[0]?.node;
            if (game) {
                return {
                    prediction: Number(game.prediction),
                    outcome: Number(game.outcome),
                    won: game.won,
                };
            }
            return null;
        } catch (err) {
            console.error("Failed to fetch latest game:", err);
            return null;
        }
    }, []);

    useEffect(() => {
        fetchPlayerStats();
    }, [fetchPlayerStats]);

    const flip = async (prediction: Prediction) => {
        if (!client || !account) return;

        setIsFlipping(true);
        setLastResult(null);

        try {
            await client.actions.flip(account, prediction);

            // Wait for indexer
            await new Promise((resolve) => setTimeout(resolve, 1500));

            const result = await fetchLatestGame();
            if (result) setLastResult(result);

            await fetchPlayerStats();
        } catch (err) {
            console.error("Flip failed:", err);
        } finally {
            setIsFlipping(false);
        }
    };

    if (isLoading) return <div>Connecting to Dojo world...</div>;
    if (error) return <div>Error: {error.message}</div>;

    return (
        <div className="app">
            <h1>Coin Flip</h1>

            {lastResult && (
                <div className={lastResult.won ? "win" : "lose"}>
                    {lastResult.won ? "You Won!" : "You Lost!"}
                    <br />
                    Prediction: {lastResult.prediction === 0 ? "Heads" : "Tails"}
                    <br />
                    Outcome: {lastResult.outcome === 0 ? "Heads" : "Tails"}
                </div>
            )}

            <div>
                <button onClick={() => flip(0)} disabled={isFlipping}>
                    {isFlipping ? "Flipping..." : "Heads"}
                </button>
                <button onClick={() => flip(1)} disabled={isFlipping}>
                    {isFlipping ? "Flipping..." : "Tails"}
                </button>
            </div>

            <div>
                <h3>Your Stats</h3>
                <p>Total Flips: {playerStats?.total_flips || 0}</p>
                <p>Wins: {playerStats?.wins || 0}</p>
                <p>Losses: {playerStats?.losses || 0}</p>
            </div>
        </div>
    );
}

export default App;
```

### Step 9: Update TypeScript Config

Edit `tsconfig.app.json` to add:
```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    "skipLibCheck": true
  }
}
```

### Step 10: Run the App

```bash
pnpm dev
```

Open `http://localhost:5173`

---

## Running the Full Stack

**Terminal 1 - Katana (local blockchain):**
```bash
cd contracts
katana --dev --dev.no-fee --http.cors_origins "*"
```

**Terminal 2 - Deploy & Torii:**
```bash
cd contracts
sozo build && sozo migrate
# Note the world address, then:
torii --world <WORLD_ADDRESS> --http.cors_origins "*"
```

**Terminal 3 - Frontend:**
```bash
cd client
pnpm dev
```

---

## Key Concepts Summary

| Concept | Description |
|---------|-------------|
| **World** | The main contract that holds all game state |
| **Models** | Structs that define on-chain data (like database tables) |
| **Systems** | Contracts with functions that modify models |
| **#[key]** | Marks fields used to uniquely identify model instances |
| **Katana** | Local Starknet node for development |
| **Torii** | Indexer that provides GraphQL API for querying |
| **sozo** | CLI tool for building, testing, and deploying |

## Next Steps

- Add [Cartridge Controller](https://docs.cartridge.gg/) for wallet integration
- Deploy to Starknet Sepolia testnet
- Add more game mechanics (betting, leaderboards)
- Implement real-time updates with GraphQL subscriptions

## Resources

- [Dojo Book](https://book.dojoengine.org/)
- [Dojo GitHub](https://github.com/dojoengine/dojo)
- [Starknet Documentation](https://docs.starknet.io/)
- [Cairo Language](https://book.cairo-lang.org/)

---

Built with Dojo Engine
