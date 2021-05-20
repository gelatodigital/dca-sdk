import { ChainId } from "@uniswap/sdk";

export const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
//export const MATIC_ADDRESS = "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0";

export const isNetworkGasToken = (token: string): boolean => {
  if (token.toLowerCase() === ETH_ADDRESS.toLowerCase()) {
    return true;
  } else {
    return false;
  }
};

export enum DEXs {
  KYBER,
  UNI,
  SUSHI,
}

export const MAINNET_DCA = "0x1338548a1a6Ec68277496a710815D76A02838216";
export const MAINNET_SUBGRAPH_URL =
  "https://api.thegraph.com/subgraphs/name/gelatodigital/gelato-dca";

export const ROPSTEN_DCA = "0x8E9918Fc02826aa2283f890F6cE439085c615665";

export const ROPSTEN_SUBGRAPH_URL =
  "https://api.thegraph.com/subgraphs/name/gelatodigital/gelato-dca-ropsten";

export const getDcaAddr = (chainId: number): string => {
  switch (chainId) {
    case 1: {
      return MAINNET_DCA;
    }
    case 3: {
      return ROPSTEN_DCA;
    }
    case 4: {
      throw new Error("GelatoDca is not available on Rinkeby");
    }
    case 5: {
      throw new Error("GelatoDca is not available on Görli");
    }
    case 42: {
      throw new Error("GelatoDca is not available on Kovan");
    }
    case 80001: {
      throw new Error("GelatoDca is not available on Mumbai");
    }
    // Mainnet Hardhat fork
    case 31337: {
      return MAINNET_DCA;
    }
    default: {
      throw new Error("NETWORK NOT SUPPORTED");
    }
  }
};

export const getSubgraphUrl = (chainId: number): string => {
  switch (chainId) {
    case 1: {
      return MAINNET_SUBGRAPH_URL;
    }
    case 3: {
      return ROPSTEN_SUBGRAPH_URL;
    }
    case 4: {
      throw new Error("Subgraph not available on Rinkeby");
    }
    case 5: {
      throw new Error("Subgraph not available on Görli");
    }
    case 42: {
      throw new Error("Subgraph not available on Kovan");
    }
    case 137: {
      throw new Error("Subgraph not available on Matic");
    }
    case 80001: {
      throw new Error("Subgraph is not available on Mumbai");
    }
    case 31337: {
      return MAINNET_SUBGRAPH_URL;
    }
    default: {
      throw new Error("NETWORK NOT SUPPORTED");
    }
  }
};

export const getNetworkName = (chainId: number): string => {
  switch (chainId) {
    case 1: {
      return "homestead";
    }
    case 3: {
      return "ropsten";
    }
    case 4: {
      return "rinkeby";
    }
    case 5: {
      return "goerli";
    }
    case 42: {
      return "kovan";
    }
    case 137: {
      return "matic";
    }
    case 80001: {
      return "mumbai";
    }
    case 31337: {
      return "hardhat";
    }
    default: {
      throw new Error("NETWORK NOT SUPPORTED");
    }
  }
};

export const EMPTY_LIST = {
  [ChainId.KOVAN]: {},
  [ChainId.RINKEBY]: {},
  [ChainId.ROPSTEN]: {},
  [ChainId.GÖRLI]: {},
  [ChainId.MAINNET]: {},
};

export const WETH = {
  "1": {
    decimals: 18,
    symbol: "WETH",
    name: "Wrapped Ether",
    chainId: 1,
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
  "3": {
    decimals: 18,
    symbol: "WETH",
    name: "Wrapped Ether",
    chainId: 3,
    address: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
  },
  "4": {
    decimals: 18,
    symbol: "WETH",
    name: "Wrapped Ether",
    chainId: 4,
    address: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
  },
  "5": {
    decimals: 18,
    symbol: "WETH",
    name: "Wrapped Ether",
    chainId: 5,
    address: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
  },
  "42": {
    decimals: 18,
    symbol: "WETH",
    name: "Wrapped Ether",
    chainId: 42,
    address: "0xd0A1E359811322d97991E03f863a0C30C2cF029C",
  },
  "31337": {
    decimals: 18,
    symbol: "WETH",
    name: "Wrapped Ether",
    chainId: 31337,
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
};
