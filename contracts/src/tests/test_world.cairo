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

    /// Define the namespace and resources for testing
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

    /// Define contract permissions
    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(@"coin_flip", @"actions")
                .with_writer_of([dojo::utils::bytearray_hash(@"coin_flip")].span())
        ]
            .span()
    }

    #[test]
    fn test_flip() {
        // Setup test caller
        let caller: ContractAddress = 0x1.try_into().unwrap();

        // Initialize test world
        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        // Get the actions contract
        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        // Set the caller address for the test
        set_contract_address(caller);

        // Verify initial player state (should be zeros)
        let player_before: Player = world.read_model(caller);
        assert(player_before.total_flips == 0, 'initial flips should be 0');
        assert(player_before.wins == 0, 'initial wins should be 0');
        assert(player_before.losses == 0, 'initial losses should be 0');

        // Perform a flip with prediction = 0 (Heads)
        actions_system.flip(0);

        // Verify player stats were updated
        let player_after: Player = world.read_model(caller);
        assert(player_after.total_flips == 1, 'should have 1 flip');
        assert(player_after.wins + player_after.losses == 1, 'should have 1 result');

        // Verify game record was created
        let game: Game = world.read_model((caller, 1_u32));
        assert(game.prediction == 0, 'prediction should be 0');
        assert(game.outcome == 0 || game.outcome == 1, 'outcome should be 0 or 1');
        assert(game.won == (game.prediction == game.outcome), 'won flag mismatch');
    }

    #[test]
    fn test_multiple_flips() {
        let caller: ContractAddress = 0x1.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        // Set the caller address for the test
        set_contract_address(caller);

        // Perform multiple flips
        actions_system.flip(0);  // Heads
        actions_system.flip(1);  // Tails
        actions_system.flip(0);  // Heads

        // Verify total flips
        let player: Player = world.read_model(caller);
        assert(player.total_flips == 3, 'should have 3 flips');
        assert(player.wins + player.losses == 3, 'wins + losses should be 3');
    }
}
