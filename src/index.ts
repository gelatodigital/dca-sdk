import { TransactionResponse } from "@ethersproject/abstract-provider";
import GELATO_TOKEN_LIST from "@gelatonetwork/default-token-list";
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
import { getAllowance, getMinAmountOut, saveOrder } from "./helpers";
import {
  getCancelledOrders,
  getExecutedOrders,
  getOpenOrders,
  getOrders,
  getPastOrders
} from "./query/orders";
import {
  LocalOrder,
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
  order: OrderSubmission,
  slippage: BigNumber,
  signer: Signer
): Promise<TransactionData> => {
  return (await getDcaOrderPayloadWithSecret(order, slippage, signer)).txData;
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
  order: OrderSubmission,
  slippage: BigNumber,
  signer: Signer
): Promise<TransactionDataWithSecret> => {
  const { secret, witness } = getWitnessAndSecret();

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

  const signerChainId = await signer.getChainId();

  const tokenList = getDcaTokenList().tokens.filter(({ chainId }) =>
    signerChainId === 1 || signerChainId === 3 ? chainId === signerChainId : 1
  );

  let inTokenIncluded = false;
  let outTokenIncluded = false;
  tokenList.forEach((token) => {
    if (
      utils.getAddress(token.address) == utils.getAddress(order.inToken) ||
      utils.getAddress(order.inToken) == utils.getAddress(ETH_ADDRESS)
    )
      inTokenIncluded = true;

    if (
      utils.getAddress(token.address) == utils.getAddress(order.outToken) ||
      utils.getAddress(order.outToken) == utils.getAddress(ETH_ADDRESS)
    )
      outTokenIncluded = true;
  });
  if (!inTokenIncluded) throw new TypeError("In Token not in DCA Token List");
  if (!outTokenIncluded) throw new TypeError("Out Token not in DCA Token List");

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

  gasLimit = gasLimit.add(gasLimit.mul(55).div(100));

  gasLimit = gasLimit.lt(BigNumber.from("400000"))
    ? BigNumber.from("400000")
    : gasLimit;

  return { data, value, gasLimit };
};

export const placeDcaOrder = async (
  order: OrderSubmission,
  slippage: BigNumber,
  gasPrice: BigNumber,
  signer: Signer
): Promise<{ txData: TransactionDataWithSecret; tx: TransactionResponse }> => {
  if (!signer.provider) throw new TypeError("Provider undefined");

  const txData = await getDcaOrderPayloadWithSecret(order, slippage, signer);

  const tx = await signer.sendTransaction({
    to: txData.txData.to,
    data: txData.txData.data,
    value: txData.txData.value,
    gasLimit: txData.txData.gasLimit,
    gasPrice: gasPrice,
  });

  return {
    txData: txData,
    tx: tx,
  };
};

//#endregion Limit Orders Submission

//#region Limit Orders Cancellation

export const cancelDcaOrder = async (
  cycle: OrderCycle,
  id: BigNumber,
  gasPrice: BigNumber,
  signer: Signer
): Promise<ContractTransaction> => {
  if (!signer.provider)
    throw new TypeError("cancelDcaOrder: no provider on signer");

  const gelatoDca = await getGelatoDca(signer);

  const gasLimit = await gelatoDca
    .connect(signer)
    .estimateGas.cancel(cycle, id);

  return gelatoDca.connect(signer).cancel(cycle, id, {
    gasPrice: gasPrice,
    gasLimit: gasLimit.add(gasLimit.mul(40).div(100)),
  });
};

export const getCancelLimitOrderPayload = async (
  cycle: OrderCycle,
  id: BigNumber,
  signer: Signer
): Promise<TransactionData> => {
  const gelatoDca = await getGelatoDca(signer);

  const gasLimit = (await gelatoDca.estimateGas.cancel(cycle, id)).add(
    BigNumber.from("50000")
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

export const getDcaTokenList = () => {
  return GELATO_TOKEN_LIST;
};

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

export const getOrdersArray = (
  order: OrderSubmission,
  user: string,
  witness: string,
  submissionHash: string
): LocalOrder[] => {
  const submissionDate = Math.floor(Date.now() / 1000).toString();
  const orders = [];
  for (let i = 0; i < parseInt(order.numTrades.toString()); i++) {
    let estimatedExecutionDate;
    if (i === 0) {
      estimatedExecutionDate = Math.floor(Date.now() / 1000);
    } else {
      estimatedExecutionDate = (
        parseInt(order.delay.toString()) * i +
        Math.floor(Date.now() / 1000)
      ).toString();
    }
    const nTradesLeft = order.numTrades.sub(BigNumber.from("1")).toString();
    const index = (parseInt(order.numTrades.toString()) - i).toString();
    const witnessHash = witness + i.toString();
    const localOrder = {
      status: "awaitingExec",
      submissionDate: submissionDate,
      submissionHash: submissionHash.toLowerCase(),
      estExecutionDate: estimatedExecutionDate.toString(),
      amount: order.amountPerTrade.toString(),
      inToken: order.inToken.toLowerCase(),
      outToken: order.outToken.toLowerCase(),
      minSlippage: order.minSlippage.toString(),
      maxSlippage: order.maxSlippage.toString(),
      index: index,
      witness: witnessHash,
      cycleWrapper: {
        cycle: {
          nTradesLeft: nTradesLeft,
        },
      },
    };
    orders.push(localOrder);
  }
  return orders;
};

export const storeOrdersInLocalStorage = (
  orders: LocalOrder[],
  user: string,
  chainId: number
): void => {
  orders.forEach((localOrder) => {
    saveOrder(user, localOrder, chainId);
  });
};
