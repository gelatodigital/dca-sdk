import { BigNumber, BytesLike } from "ethers";

export interface TransactionData {
  to: string;
  data: BytesLike;
  value: BigNumber;
  gasLimit: BigNumber;
}

export interface TransactionDataWithSecret {
  txData: TransactionData;
  secret: string;
  witness: string;
}

export interface WitnessAndSecret {
  witness: string;
  secret: string;
}

export interface OrderSubmission {
  inToken: string;
  outToken: string;
  amountPerTrade: BigNumber;
  numTrades: BigNumber;
  delay: BigNumber;
  platformWallet: string;
  platformFeeBps: BigNumber;
  minSlippage: BigNumber;
  maxSlippage: BigNumber;
}

export interface OrderCycle {
  user: string;
  inToken: string;
  outToken: string;
  amountPerTrade: number;
  nTradesLeft: number;
  minSlippage: number;
  maxSlippage: number;
  delay: number;
  lastExecutionTime: number;
  platformWallet: string;
  platformFeeBps: number;
}

export interface Order {
  id: string;
  user: string;
  status: string;
  submissionDate: number;
  submissionHash: BytesLike;
  estExecutionDate: number;
  executionDate: number;
  executionHash: BytesLike;
  amountReceived: number;
  executor: string;
  executorFee: number;
  feeToken: string;
  inToken: string;
  outToken: string;
  amount: number;
  index: number;
  witness: string;
  cycleWrapper: {
    id: string;
    status: string;
    startDate: number;
    numTrades: number;
    cycle: {
      user: string;
      inToken: string;
      outToken: string;
      amountPerTrade: number;
      nTradesLeft: number;
      minSlippage: number;
      maxSlippage: number;
      delay: number;
      lastExecutionTime: number;
      platformWallet: string;
      platformFeeBps: number;
    };
  };
}

export interface LocalOrder {
  status: string;
  submissionDate: string;
  submissionHash: string;
  estExecutionDate: string;
  amount: string;
  inToken: string;
  outToken: string;
  minSlippage: string;
  maxSlippage: string;
  index: string;
  witness: string;
  cycleWrapper: {
    cycle: {
      nTradesLeft: string;
    };
  };
}
