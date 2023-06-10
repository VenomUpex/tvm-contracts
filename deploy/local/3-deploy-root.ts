import {toNano, WalletTypes} from "locklift";
import {TokenRootUpgradeableAbi} from "../../build/factorySource";
import {setupUpexRoot} from "../../test/utils/common";


export default async () => {
  const signer = await locklift.keystore.getSigner("0");
  const usdt = await locklift.deployments.getContract<TokenRootUpgradeableAbi>("USDT");
  const owner = await locklift.deployments.getAccount("Owner");
  const root = await setupUpexRoot(owner.account.address, signer?.publicKey as string, usdt.address);

  await locklift.deployments.saveContract({
    deploymentName: 'UpexRoot',
    address: root.address,
    contractName: 'UpexRoot'
  })
};

export const tag = "root";