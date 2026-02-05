import { DojoProvider, DojoCall } from "@dojoengine/core";
import { Account, AccountInterface, BigNumberish, CairoOption, CairoCustomEnum } from "starknet";
import * as models from "./models.gen";

export function setupWorld(provider: DojoProvider) {

	const build_actions_flip_calldata = (prediction: BigNumberish): DojoCall => {
		return {
			contractName: "actions",
			entrypoint: "flip",
			calldata: [prediction],
		};
	};

	const actions_flip = async (snAccount: Account | AccountInterface, prediction: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_actions_flip_calldata(prediction),
				"coin_flip",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};



	return {
		actions: {
			flip: actions_flip,
			buildFlipCalldata: build_actions_flip_calldata,
		},
	};
}