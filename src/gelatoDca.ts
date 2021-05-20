import { Signer } from "ethers";
import { getDcaAddr } from "./constants";
import { GelatoDca, GelatoDca__factory } from "./contracts/types";

// cannot name parameter provider
export const getGelatoDca = async (signer: Signer): Promise<GelatoDca> => {
  if (!signer.provider) throw Error("Provider undefined");

  return GelatoDca__factory.connect(
    await getDcaAddr((await signer.provider.getNetwork()).chainId),
    signer
  );
};
