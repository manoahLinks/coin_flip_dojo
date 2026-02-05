import type { SchemaType as ISchemaType } from "@dojoengine/sdk";

import { BigNumberish } from 'starknet';

// Type definition for `coin_flip::models::Game` struct
export interface Game {
	player: string;
	game_id: BigNumberish;
	prediction: BigNumberish;
	outcome: BigNumberish;
	won: boolean;
}

// Type definition for `coin_flip::models::Player` struct
export interface Player {
	address: string;
	total_flips: BigNumberish;
	wins: BigNumberish;
	losses: BigNumberish;
}

// Type definition for `coin_flip::systems::actions::actions::Flipped` struct
export interface Flipped {
	player: string;
	game_id: BigNumberish;
	prediction: BigNumberish;
	outcome: BigNumberish;
	won: boolean;
}

export interface SchemaType extends ISchemaType {
	coin_flip: {
		Game: Game,
		Player: Player,
		Flipped: Flipped,
	},
}
export const schema: SchemaType = {
	coin_flip: {
		Game: {
			player: "",
			game_id: 0,
			prediction: 0,
			outcome: 0,
			won: false,
		},
		Player: {
			address: "",
			total_flips: 0,
			wins: 0,
			losses: 0,
		},
		Flipped: {
			player: "",
			game_id: 0,
			prediction: 0,
			outcome: 0,
			won: false,
		},
	},
};
export enum ModelsMapping {
	Game = 'coin_flip-Game',
	Player = 'coin_flip-Player',
	Flipped = 'coin_flip-Flipped',
}