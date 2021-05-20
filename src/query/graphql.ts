import { gql } from "graphql-request";

export const GET_ALL_ORDERS_BY_OWNER = gql`
  query getAllOrdersByOwner($owner: String!) {
    trades(
      where: { user: $owner }
      orderBy: submissionDate
      orderDirection: desc
      first: 1000
    ) {
      id
      user
      status
      submissionDate
      submissionHash
      estExecutionDate
      executionDate
      executionHash
      amountReceived
      executor
      executorFee
      feeToken
      inToken
      outToken
      amount
      index
      witness
      cycleWrapper {
        id
        status
        startDate
        numTrades
        cycle {
          user
          inToken
          outToken
          amountPerTrade
          nTradesLeft
          minSlippage
          maxSlippage
          delay
          lastExecutionTime
          platformWallet
          platformFeeBps
        }
      }
    }
  }
`;

export const GET_ALL_OPEN_ORDERS_BY_OWNER = gql`
  query getOpenOrdersByOwner($owner: String!) {
    trades(
      where: { user: $owner, status: awaitingExec }
      orderBy: submissionDate
      orderDirection: desc
      first: 1000
    ) {
      id
      user
      status
      submissionDate
      submissionHash
      estExecutionDate
      executionDate
      executionHash
      amountReceived
      executor
      executorFee
      feeToken
      inToken
      outToken
      amount
      index
      witness
      cycleWrapper {
        id
        status
        startDate
        numTrades
        cycle {
          user
          inToken
          outToken
          amountPerTrade
          nTradesLeft
          minSlippage
          maxSlippage
          delay
          lastExecutionTime
          platformWallet
          platformFeeBps
        }
      }
    }
  }
`;

export const GET_ALL_PAST_ORDERS_BY_OWNER = gql`
  query getPastOrdersByOwner($owner: String) {
    trades(
      where: { user: $owner, status_not: awaitingExec }
      orderBy: submissionDate
      orderDirection: desc
    ) {
      id
      user
      status
      submissionDate
      submissionHash
      estExecutionDate
      executionDate
      executionHash
      amountReceived
      executor
      executorFee
      feeToken
      inToken
      outToken
      amount
      index
      witness
      cycleWrapper {
        id
        status
        startDate
        numTrades
        cycle {
          user
          inToken
          outToken
          amountPerTrade
          nTradesLeft
          minSlippage
          maxSlippage
          delay
          lastExecutionTime
          platformWallet
          platformFeeBps
        }
      }
    }
  }
`;

export const GET_ALL_EXECUTED_ORDERS_BY_OWNER = gql`
  query getPastOrdersByOwner($owner: String) {
    trades(
      where: { user: $owner, status: execSuccess }
      orderBy: submissionDate
      orderDirection: desc
    ) {
      id
      user
      status
      submissionDate
      submissionHash
      estExecutionDate
      executionDate
      executionHash
      amountReceived
      executor
      executorFee
      feeToken
      inToken
      outToken
      amount
      index
      witness
      cycleWrapper {
        id
        status
        startDate
        numTrades
        cycle {
          user
          inToken
          outToken
          amountPerTrade
          nTradesLeft
          minSlippage
          maxSlippage
          delay
          lastExecutionTime
          platformWallet
          platformFeeBps
        }
      }
    }
  }
`;

export const GET_ALL_CANCELLED_ORDERS_BY_OWNER = gql`
  query getCancelledOrdersByOwher($owner: String) {
    trades(
      where: { user: $owner, status: cancelled }
      orderBy: submissionDate
      orderDirection: desc
    ) {
      id
      user
      status
      submissionDate
      submissionHash
      estExecutionDate
      executionDate
      executionHash
      amountReceived
      executor
      executorFee
      feeToken
      inToken
      outToken
      amount
      index
      witness
      cycleWrapper {
        id
        status
        startDate
        numTrades
        cycle {
          user
          inToken
          outToken
          amountPerTrade
          nTradesLeft
          minSlippage
          maxSlippage
          delay
          lastExecutionTime
          platformWallet
          platformFeeBps
        }
      }
    }
  }
`;
