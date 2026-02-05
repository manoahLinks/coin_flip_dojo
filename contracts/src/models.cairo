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
