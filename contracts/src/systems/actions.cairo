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
