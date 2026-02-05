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
                // Create RPC provider first
                const rpcProvider = new RpcProvider({ nodeUrl: KATANA_RPC_URL });

                // Set up account (using master account for dev)
                const masterAccount = new Account({
                    provider: rpcProvider,
                    address: MASTER_ADDRESS,
                    signer: MASTER_PRIVATE_KEY,
                });

                // Set up world client
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
