import { createDojoConfig } from "@dojoengine/core";
import manifest from "./manifest.json";

// For local Katana development
export const dojoConfig = createDojoConfig({
    manifest: manifest as any,
});

// Network configuration
export const KATANA_RPC_URL = "http://localhost:5050";
export const TORII_URL = "http://localhost:8080";
export const TORII_RPC_URL = "http://localhost:8080";
export const RELAY_URL = "/ip4/127.0.0.1/tcp/9090";

// Master account from Katana (for development only)
export const MASTER_ADDRESS = "0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec";
export const MASTER_PRIVATE_KEY = "0xc5b2fcab997346f3ea1c00b002ecf6f382c5f9c9659a3894eb783c5320f912";
