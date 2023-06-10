import {getRandomNonce} from "locklift";
import {setupTokenRoot} from "../../test/utils/common";


export default async () => {
  const token_name = `TOKEN_${getRandomNonce()}`;

  const {account:owner} = await locklift.deployments.getAccount('Owner');
  const {account:user} = await locklift.deployments.getAccount('User');
  const {account:user1} = await locklift.deployments.getAccount('User1');

  const usdt_root = await setupTokenRoot(token_name, token_name, owner, 6);

  const USDT_DECIMALS = 10 ** 6;
  await usdt_root.mint(1000000000 * USDT_DECIMALS, owner);
  await usdt_root.mint(1000000000 * USDT_DECIMALS, user);
  await usdt_root.mint(1000000000 * USDT_DECIMALS, user1);

  await locklift.deployments.saveContract({
    deploymentName: "USDT",
    address: usdt_root.address,
    contractName: "TokenRootUpgradeable"
  });
};

export const tag = "token";