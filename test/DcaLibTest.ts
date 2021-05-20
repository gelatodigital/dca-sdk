import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber, utils } from "ethers";
import { ethers, network } from "hardhat";
import { getDcaAddr } from "../src/constants";
import { GelatoDca, GelatoDca__factory } from "../src/contracts/types";
import {
  cancelDcaOrder,
  getCancelLimitOrderPayload,
  getDcaOrderPayload,
  getDcaOrderPayloadWithSecret,
  placeDcaOrder,
} from "../src/index";
import { OrderSubmission } from "../src/types";

const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

describe("Test DCA Lib", async function () {
  this.timeout(0);
  if (network.name !== "hardhat") {
    console.error("Test Suite is meant to be run on hardhat only");
    process.exit(1);
  }

  let userWallet: SignerWithAddress;
  let inTokenAddress: string;
  let outTokenAddress: string;
  let amountPerTrade: BigNumber;
  let numTrades: BigNumber;
  let delay: BigNumber;
  let platformWallet: string;
  let platformBps: BigNumber;
  let minSlippage: BigNumber;
  let maxSlippage: BigNumber;
  let slippage: BigNumber;
  let gelatoDca: GelatoDca;
  let orderOne: OrderSubmission;
  let orderTwo: OrderSubmission;

  if (!network.config.chainId) throw new Error("No Chain Id");
  const chainId = network.config.chainId;

  before(async function () {
    [userWallet] = await ethers.getSigners();

    gelatoDca = await GelatoDca__factory.connect(
      getDcaAddr(chainId),
      userWallet
    );
    inTokenAddress = ETH;
    outTokenAddress = DAI;
    amountPerTrade = utils.parseEther("3");
    numTrades = BigNumber.from("3");
    delay = BigNumber.from("120");
    platformWallet = await userWallet.getAddress();
    platformBps = BigNumber.from("0");
    minSlippage = BigNumber.from("50");
    maxSlippage = BigNumber.from("1000");
    slippage = BigNumber.from("100");

    orderOne = {
      inToken: inTokenAddress,
      outToken: outTokenAddress,
      amountPerTrade: amountPerTrade,
      numTrades: numTrades,
      delay: delay,
      platformFeeBps: platformBps,
      platformWallet: platformWallet,
      minSlippage: minSlippage,
      maxSlippage: maxSlippage,
    };

    orderTwo = {
      inToken: outTokenAddress,
      outToken: inTokenAddress,
      amountPerTrade: amountPerTrade,
      numTrades: numTrades,
      delay: delay,
      platformFeeBps: platformBps,
      platformWallet: platformWallet,
      minSlippage: minSlippage,
      maxSlippage: maxSlippage,
    };
  });

  it("#1: Eth to DAI Task Submission should work", async function () {
    /*
      chainId: number,
      inTokenAddress: string,
      outTokenAddress: string,
      amountPerTrade: BigNumber,
      numTrades: BigNumber,
      delay: BigNumber,
      platformWallet: string,
      platformFeeBps: BigNumber,
      minSlippage: BigNumber,
      maxSlippage: BigNumber,
      slippage: BigNumber,
      provider?: providers.Provider
    */

    await expect(getDcaOrderPayload(orderOne, slippage, userWallet)).to.not
      .throw;
  });

  it("#2: DAI to UNI Task Submission should work", async function () {
    const err = new TypeError("Insufficient GelatoDCA allowance");

    try {
      await getDcaOrderPayload(orderTwo, slippage, userWallet);
      throw err;
    } catch (err) {
      console.log("Expected Error");
    }
  });

  it("#3: Place and cancel with state reading functions", async function () {
    // await outToken.approve(gelatoDca.address, amountPerTrade.mul(numTrades));

    const txData = await getDcaOrderPayloadWithSecret(
      orderOne,
      slippage,
      userWallet
    );
    const transactionData = txData.txData;

    const tx = await userWallet.sendTransaction({
      to: transactionData.to,
      data: transactionData.data,
      value: transactionData.value,
      gasLimit: transactionData.gasLimit,
    });

    const { blockHash } = await tx.wait();

    const topics = gelatoDca.filters.LogTaskSubmitted(null, null, null).topics;
    const filter = {
      address: gelatoDca.address.toLowerCase(),
      blockhash: blockHash,
      topics,
    };
    const logs = await ethers.provider.getLogs(filter);

    if (logs.length == 0) {
      throw Error("cannot find log");
    }

    const event = gelatoDca.interface.parseLog(logs[0]);

    /*
    cycle: OrderCycle,
    id: BigNumber,
    provider?: providers.Provider
    */
    const order = event.args.order;
    const cycle = {
      user: order.user,
      inToken: order.inToken,
      outToken: order.outToken,
      amountPerTrade: order.amountPerTrade,
      nTradesLeft: order.nTradesLeft,
      minSlippage: order.minSlippage,
      maxSlippage: order.maxSlippage,
      delay: order.delay,
      lastExecutionTime: order.lastExecutionTime,
      platformWallet: order.platformWallet,
      platformFeeBps: order.platformFeeBps,
    };

    const cancelTxData = await getCancelLimitOrderPayload(
      cycle,
      event.args.id,
      userWallet
    );

    await expect(
      userWallet.sendTransaction({
        to: cancelTxData.to,
        data: cancelTxData.data,
        value: cancelTxData.value,
        gasLimit: cancelTxData.gasLimit,
      })
    ).to.not.be.reverted;
  });

  it("#4: Place and cancel with state writing functions", async function () {
    // await outToken.approve(gelatoDca.address, amountPerTrade.mul(numTrades));

    await expect(placeDcaOrder(orderOne, slippage, userWallet)).to.emit(
      gelatoDca,
      "LogTaskSubmitted"
    );

    const block = await userWallet.provider?.getBlock("latest");
    if (!block) throw new TypeError("No block found");

    const topics = gelatoDca.filters.LogTaskSubmitted(null, null, null).topics;
    const filter = {
      address: gelatoDca.address.toLowerCase(),
      blockhash: block.hash,
      topics,
    };

    const logs = await ethers.provider.getLogs(filter);

    if (logs.length == 0) {
      throw Error("cannot find log");
    }

    const event = gelatoDca.interface.parseLog(logs[0]);

    /*
    cycle: OrderCycle,
    id: BigNumber,
    provider?: providers.Provider
    */
    const order = event.args.order;
    const cycle = {
      user: order.user,
      inToken: order.inToken,
      outToken: order.outToken,
      amountPerTrade: order.amountPerTrade,
      nTradesLeft: order.nTradesLeft,
      minSlippage: order.minSlippage,
      maxSlippage: order.maxSlippage,
      delay: order.delay,
      lastExecutionTime: order.lastExecutionTime,
      platformWallet: order.platformWallet,
      platformFeeBps: order.platformFeeBps,
    };

    await expect(cancelDcaOrder(cycle, event.args.id, userWallet)).to.emit(
      gelatoDca,
      "LogTaskCancelled"
    );
  });
});
