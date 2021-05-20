import { TransactionResponse } from "@ethersproject/abstract-provider";
import {
  BigNumber,
  constants,
  ContractTransaction,
  Signer,
  utils,
  Wallet
} from "ethers";
import { DEXs, ETH_ADDRESS, WETH_ADDRESS } from "./constants";
import { GelatoDca } from "./contracts/types";
import { getGelatoDca } from "./gelatoDca";
import { getAllowance, getMinAmountOut } from "./helpers";
import {
  getCancelledOrders,
  getExecutedOrders,
  getOpenOrders,
  getOrders,
  getPastOrders
} from "./query/orders";
import {
  Order,
  OrderCycle,
  OrderSubmission,
  TransactionData,
  TransactionDataWithSecret,
  WitnessAndSecret
} from "./types";

//#region Limit Orders Submission

export const createOrder = (
  inToken: string,
  outToken: string,
  amountPerTrade: BigNumber,
  numTrades: BigNumber,
  delay: BigNumber,
  platformWallet: string,
  platformFeeBps: BigNumber,
  minSlippage: BigNumber,
  maxSlippage: BigNumber
): OrderSubmission => {
  return {
    inToken: inToken,
    outToken: outToken,
    amountPerTrade: amountPerTrade,
    numTrades: numTrades,
    minSlippage: minSlippage,
    maxSlippage: maxSlippage,
    delay: delay,
    platformWallet: platformWallet,
    platformFeeBps: platformFeeBps,
  };
};

// Convention ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
export const getDcaOrderPayload = async (
  inToken: string,
  outToken: string,
  amountPerTrade: BigNumber,
  numTrades: BigNumber,
  delay: BigNumber,
  platformWallet: string,
  platformFeeBps: BigNumber,
  minSlippage: BigNumber,
  maxSlippage: BigNumber,
  slippage: BigNumber,
  signer: Signer
): Promise<TransactionData> => {
  return (
    await getDcaOrderPayloadWithSecret(
      inToken,
      outToken,
      amountPerTrade,
      numTrades,
      delay,
      platformWallet,
      platformFeeBps,
      minSlippage,
      maxSlippage,
      slippage,
      signer
    )
  ).txData;
};

export const getWitnessAndSecret = (): WitnessAndSecret => {
  const secret = utils.hexlify(utils.randomBytes(13)).replace("0x", "");
  const fullSecret = `2070696e652e66696e616e63652020d83ddc09${secret}`;
  const { privateKey, address } = new Wallet(fullSecret);
  return {
    secret: privateKey,
    witness: address,
  };
};

export const getDcaOrderPayloadWithSecret = async (
  inToken: string,
  outToken: string,
  amountPerTrade: BigNumber,
  numTrades: BigNumber,
  delay: BigNumber,
  platformWallet: string,
  platformFeeBps: BigNumber,
  minSlippage: BigNumber,
  maxSlippage: BigNumber,
  slippage: BigNumber,
  signer: Signer
): Promise<TransactionDataWithSecret> => {
  const { secret, witness } = getWitnessAndSecret();

  const order = createOrder(
    inToken,
    outToken,
    amountPerTrade,
    numTrades,
    delay,
    platformWallet,
    platformFeeBps,
    minSlippage,
    maxSlippage
  );

  const gelatoDca = await getGelatoDca(signer);

  const { data, value, gasLimit } = await getTxData(
    gelatoDca,
    order,
    slippage,
    secret,
    witness,
    signer
  );

  return {
    txData: {
      to: gelatoDca.address,
      data,
      value,
      gasLimit,
    },
    secret: secret,
    witness: witness,
  };
};

export const getTxData = async (
  gelatoDca: GelatoDca,
  order: OrderSubmission,
  slippage: BigNumber,
  privateKey: string,
  witness: string,
  signer: Signer
): Promise<{ data: string; value: BigNumber; gasLimit: BigNumber }> => {
  if (order.inToken === order.outToken)
    throw new TypeError("inToken === outToken");

  if (
    utils.getAddress(order.inToken) === utils.getAddress(ETH_ADDRESS) &&
    utils.getAddress(order.outToken) === utils.getAddress(WETH_ADDRESS)
  )
    throw new TypeError("Cannot Trade ETH <> WETH");

  if (
    utils.getAddress(order.inToken) === utils.getAddress(WETH_ADDRESS) &&
    utils.getAddress(order.outToken) === utils.getAddress(ETH_ADDRESS)
  )
    throw new TypeError("Cannot Trade WETH <> ETH");

  if (utils.getAddress(order.inToken) !== utils.getAddress(ETH_ADDRESS)) {
    const allowance = await getAllowance(
      order.inToken,
      await signer.getAddress(),
      gelatoDca.address,
      signer
    );
    if (allowance.lt(order.amountPerTrade.mul(order.numTrades)))
      throw new TypeError("Insufficient GelatoDCA allowance");
  }

  const sigHash = gelatoDca.interface.getSighash("submitAndExec");

  const { minAmountOut, path } = await getMinAmountOut(
    order.inToken,
    order.outToken,
    order.amountPerTrade,
    slippage,
    signer
  );

  let data = new utils.AbiCoder().encode(
    [
      "tuple(address inToken, address outToken, uint256 amountPerTrade, uint256 numTrades, uint256 minSlippage, uint256 maxSlippage, uint256 delay, address platformWallet, uint256 platformFeeBps)",
      "uint8 _protocol",
      "uint256 _minReturnOrRate",
      "address[] _tradePath",
      "bytes32 privateKey",
      "address witness",
    ],
    [order, DEXs.UNI, minAmountOut, path, privateKey, witness]
  );

  data =
    "0x" +
    sigHash.substring(2, sigHash.length) +
    data.substring(2, data.length);

  // STRING INTERPOLATE DATA STRING

  const value =
    utils.getAddress(order.inToken) === utils.getAddress(ETH_ADDRESS)
      ? order.numTrades.mul(order.amountPerTrade)
      : constants.Zero;

  // Get gas limit
  let gasLimit = await gelatoDca.estimateGas.submitAndExec(
    order,
    DEXs.UNI,
    minAmountOut,
    path,
    {
      value: value,
    }
  );

  gasLimit = gasLimit.add(gasLimit.mul(30).div(100));

  return { data, value, gasLimit };
};

export const placeDcaOrder = async (
  inToken: string,
  outToken: string,
  amountPerTrade: BigNumber,
  numTrades: BigNumber,
  delay: BigNumber,
  platformWallet: string,
  platformFeeBps: BigNumber,
  minSlippage: BigNumber,
  maxSlippage: BigNumber,
  slippage: BigNumber,
  signer: Signer
): Promise<TransactionResponse> => {
  if (!signer.provider) throw new TypeError("Provider undefined");

  const txData = await getDcaOrderPayloadWithSecret(
    inToken,
    outToken,
    amountPerTrade,
    numTrades,
    delay,
    platformWallet,
    platformFeeBps,
    minSlippage,
    maxSlippage,
    slippage,
    signer
  );

  return signer.sendTransaction({
    to: txData.txData.to,
    data: txData.txData.data,
    value: txData.txData.value,
  });
};

//#endregion Limit Orders Submission

//#region Limit Orders Cancellation

export const cancelDcaOrder = async (
  cycle: OrderCycle,
  id: BigNumber,
  signer: Signer
): Promise<ContractTransaction> => {
  if (!signer.provider)
    throw new TypeError("cancelDcaOrder: no provider on signer");

  const gelatoDca = await getGelatoDca(signer);

  return gelatoDca.connect(signer).cancel(cycle, id);
};

export const getCancelLimitOrderPayload = async (
  cycle: OrderCycle,
  id: BigNumber,
  signer: Signer
): Promise<TransactionData> => {
  const gelatoDca = await getGelatoDca(signer);

  const gasLimit = (await gelatoDca.estimateGas.cancel(cycle, id)).add(
    BigNumber.from("25000")
  );

  return {
    to: gelatoDca.address,
    data: gelatoDca.interface.encodeFunctionData("cancel", [cycle, id]),
    value: constants.Zero,
    gasLimit: gasLimit,
  };
};

//#endregion Limit Orders Cancellation

//#region Get MinAmountOut from Uniswap v2

export const getUniswapMinAmountOut = async (
  inTokenAddress: string,
  outTokenAddress: string,
  inAmount: BigNumber,
  slippage: BigNumber = BigNumber.from("100"),
  signer: Signer
): Promise<{ minAmountOut: BigNumber; path: string[] }> => {
  return getMinAmountOut(
    inTokenAddress,
    outTokenAddress,
    inAmount,
    slippage,
    signer
  );
};

//#endregion Get MinAmountOut from Uniswap v2

//#region Get All Orders

// available on mainnet (chainId 1) and ropsten (chainId 3)

export const getAllOrders = async (
  account: string,
  chainID: number
): Promise<Order[]> => {
  return getOrders(account, chainID);
};

export const getAllOpenOrders = async (
  account: string,
  chainID: number
): Promise<Order[]> => {
  return getOpenOrders(account, chainID);
};

export const getAllPastOrders = async (
  account: string,
  chainID: number
): Promise<Order[]> => {
  return getPastOrders(account, chainID);
};

export const getAllExecutedOrders = async (
  account: string,
  chainID: number
): Promise<Order[]> => {
  return getExecutedOrders(account, chainID);
};

export const getAllCancelledOrders = async (
  account: string,
  chainID: number
): Promise<Order[]> => {
  return getCancelledOrders(account, chainID);
};
//#endregion Get All Orders
