import {
  ChainId,
  Fetcher,
  Percent,
  Route,
  Token,
  TokenAmount,
  Trade,
  TradeType,
} from "@uniswap/sdk";
import { BigNumber, constants, ethers, Signer, utils } from "ethers";
import * as ls from "local-storage";
import { ETH_ADDRESS, WETH } from "./constants";
import {
  Erc20,
  Erc20Bytes32,
  Erc20Bytes32__factory,
  Erc20__factory,
} from "./contracts/types";
import { LocalOrder } from "./types";

// @Dev use Multi Hop to get optimized exchange rate
export const getMinAmountOut = async (
  inTokenAddress: string,
  outTokenAddress: string,
  inAmount: BigNumber,
  slippage: BigNumber = BigNumber.from("100"),
  signer: Signer
): Promise<{ minAmountOut: BigNumber; path: string[] }> => {
  let chainId = (await signer.getChainId()) as ChainId;
  const isMainnetOrRopsten = chainId === 1 || chainId == 3;
  chainId = isMainnetOrRopsten ? chainId : 1;

  const uniInTokenAddress =
    utils.getAddress(inTokenAddress) === utils.getAddress(ETH_ADDRESS)
      ? WETH[chainId].address
      : inTokenAddress;
  const uniOutTokenAddress =
    utils.getAddress(outTokenAddress) === utils.getAddress(ETH_ADDRESS)
      ? WETH[chainId].address
      : outTokenAddress;

  const inTokenDetails = await getToken(uniInTokenAddress, signer);
  const inToken = new Token(
    chainId,
    uniInTokenAddress,
    inTokenDetails.decimals,
    inTokenDetails.symbol
  );

  const outTokenDetails = await getToken(uniOutTokenAddress, signer);
  const outToken = new Token(
    chainId,
    uniOutTokenAddress,
    outTokenDetails.decimals,
    outTokenDetails.symbol
  );

  const baseProvider = signer.provider as ethers.providers.BaseProvider;
  const pair = await Fetcher.fetchPairData(
    inToken,
    outToken,
    isMainnetOrRopsten ? baseProvider : undefined
  );

  const route = new Route([pair], inToken, outToken);

  const trade = new Trade(
    route,
    new TokenAmount(inToken, inAmount.toString()),
    TradeType.EXACT_INPUT
  );

  const slippageTolerance = new Percent(slippage.toString(), "10000"); // 100 bips, or 1%

  const minAmountOut = trade.minimumAmountOut(slippageTolerance).raw; // needs to be converted to e.g. hex

  const path = trade.route.path.map((token) => {
    return token.address;
  });
  if (
    ethers.utils.getAddress(path[0]) ===
      ethers.utils.getAddress(WETH[chainId].address) &&
    inTokenAddress === ETH_ADDRESS
  )
    path[0] = ETH_ADDRESS;
  if (
    ethers.utils.getAddress(path[path.length - 1]) ===
      ethers.utils.getAddress(WETH[chainId].address) &&
    outTokenAddress === ETH_ADDRESS
  )
    path[path.length - 1] = ETH_ADDRESS;

  return { minAmountOut: BigNumber.from(minAmountOut.toString()), path: path };
};

export const getToken = async (
  tokenAddress: string,
  signer: ethers.Signer
): Promise<{ name: string; symbol: string; decimals: number }> => {
  const name = await getTokenName(tokenAddress, signer);
  const symbol = await getTokenSymbol(tokenAddress, signer);
  const decimals = await getTokenDecimals(tokenAddress, signer);

  return { name, symbol, decimals };
};

// get token name
export async function getTokenName(
  tokenAddress: string,
  signer: ethers.Signer
): Promise<string> {
  if (!isAddress(tokenAddress)) {
    throw Error(`Invalid 'tokenAddress' parameter '${tokenAddress}'.`);
  }

  if (
    tokenAddress.toLowerCase() === "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359"
  ) {
    return "Sai Stablecoin";
  }

  return getErc20(tokenAddress, signer)
    .name()
    .catch(() => {
      const contractBytes32 = getErc20Bytes(tokenAddress, signer);
      return contractBytes32
        .name()
        .then((bytes32: any) => ethers.utils.parseBytes32String(bytes32));
    })
    .catch((error: any) => {
      throw error;
    });
}

// get token symbol
export async function getTokenSymbol(
  tokenAddress: string,
  signer: ethers.Signer
): Promise<string> {
  if (!isAddress(tokenAddress)) {
    throw Error(`Invalid 'tokenAddress' parameter '${tokenAddress}'.`);
  }

  if (
    tokenAddress.toLowerCase() === "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359"
  ) {
    return "SAI";
  }

  return getErc20(tokenAddress, signer)
    .symbol()
    .catch(() => {
      const contractBytes32 = getErc20Bytes(tokenAddress, signer);
      return contractBytes32
        .symbol()
        .then((bytes32: any) => ethers.utils.parseBytes32String(bytes32));
    })
    .catch((error: any) => {
      throw error;
    });
}

// get token decimals
export async function getTokenDecimals(
  tokenAddress: string,
  signer: ethers.Signer
): Promise<number> {
  if (!isAddress(tokenAddress)) {
    throw Error(`Invalid 'tokenAddress' parameter '${tokenAddress}'.`);
  }

  return getErc20(tokenAddress, signer)
    .decimals()
    .catch((error: any) => {
      throw error;
    });
}

export function isAddress(value: string): boolean {
  try {
    utils.getAddress(value.toLowerCase());
    return true;
  } catch {
    return false;
  }
}

export const getAllowance = async (
  tokenAddress: string,
  owner: string,
  spender: string,
  signer: ethers.Signer
): Promise<BigNumber> => {
  if (!isAddress(tokenAddress)) {
    throw Error(`Invalid 'tokenAddress' parameter '${tokenAddress}'.`);
  }
  const tokenContract = await getErc20(tokenAddress, signer);
  const allowance = await tokenContract
    .allowance(owner, spender)
    .catch((error: any) => {
      throw new Error(error);
    });
  return allowance;
};

export const getErc20 = (address: string, signer: ethers.Signer): Erc20 => {
  if (!isAddress(address) || address === constants.AddressZero) {
    throw Error(`Invalid 'address' parameter '${address}'.`);
  }

  return Erc20__factory.connect(address, signer);
};

export const getErc20Bytes = (
  address: string,
  signer: ethers.Signer
): Erc20Bytes32 => {
  if (!isAddress(address) || address === constants.AddressZero) {
    throw Error(`Invalid 'address' parameter '${address}'.`);
  }

  return Erc20Bytes32__factory.connect(address, signer);
};

// ///
// Local storage
// ///
const LS_DCA_ORDERS = "dca_orders_";

const lsKey = (key: string, account: string, chainId: number) => {
  return key + account.toString() + chainId;
};

export const saveOrder = (
  account: string,
  orderData: LocalOrder,
  chainId: number
): void => {
  if (!account) return;

  const key = lsKey(LS_DCA_ORDERS, account, chainId);
  const prev = ls.get(key) as any;

  if (prev === null) {
    ls.set(key, [orderData]);
  } else {
    if (prev.indexOf(orderData) === -1) {
      prev.push(orderData);
      ls.set(key, prev);
    }
  }
};

export const getSavedOrders = (
  account: string,
  chainId: number
): LocalOrder[] => {
  if (!account) return [];

  console.log(
    "Loading saved orders from storage location",
    account,
    lsKey(LS_DCA_ORDERS, account, chainId)
  );
  const allOrders = ls.get(
    lsKey(LS_DCA_ORDERS, account, chainId)
  ) as LocalOrder[];

  return allOrders == null ? [] : allOrders;
};

// Math

// Calc minimum order size

export const isOrderLargeEnough = async (
  inToken: string,
  inAmount: BigNumber,
  numTrades: BigNumber,
  signer: Signer,
  orderThresholdInEth: BigNumber
): Promise<{ warning: boolean; minOrderSize: BigNumber }> => {
  let minOrderSize: BigNumber;
  const chainId = await signer.getChainId();
  if (chainId !== 1 && chainId !== 3)
    throw new Error("Only Mainnet and ropsten");

  if (
    utils.getAddress(inToken) === utils.getAddress(ETH_ADDRESS) ||
    utils.getAddress(inToken) === utils.getAddress(WETH[chainId].address)
  ) {
    minOrderSize = orderThresholdInEth;
  } else {
    const { minAmountOut } = await getMinAmountOut(
      ETH_ADDRESS,
      inToken,
      orderThresholdInEth,
      constants.Zero,
      signer
    );
    minOrderSize = minAmountOut;
  }

  const numTradesIsZero = numTrades.eq(constants.Zero) ? true : false;
  const executionRateWarning =
    !numTradesIsZero &&
    inAmount &&
    numTrades &&
    minOrderSize &&
    inAmount.div(numTrades).lt(minOrderSize)
      ? true
      : false;

  return { warning: executionRateWarning, minOrderSize: minOrderSize };
};
