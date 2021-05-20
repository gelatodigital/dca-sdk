// Plugins
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
// Process Env Variables
import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

dotenv.config({ path: __dirname + "/.env" });

const ALCHEMY_ID = process.env.ALCHEMY_ID;

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_ID}`,
        blockNumber: 12409555,
      },
    },
  },
};

export default config;
