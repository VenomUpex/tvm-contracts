import {Account} from 'locklift/everscale-client';
import {Token} from "./utils/wrappers/token";
import {TokenWallet} from "./utils/wrappers/token_wallet";
import {Contract, getRandomNonce, lockliftChai, toNano} from "locklift";
import chai, {expect} from "chai";
import {TokenRootUpgradeableAbi, UpexRootAbi, UpexTestRootAbi} from "../build/factorySource";
import {bn} from "./utils/common";

const logger = require("mocha-logger");
chai.use(lockliftChai);


describe('Testing liquidity pool mechanics', async function() {
  let user1: Account;
  let user2: Account;
  let owner: Account;

  const UP = 0;
  const DOWN = 1;

  let usdt_root: Token;
  const USDT_DECIMALS = 10 ** 6;
  const PRICE_DECIMALS = 10**8;
  const MULTIPLIER_DECIMALS = 10**3;

  let root: Contract<UpexRootAbi>;

  let user1_usdt_wallet: TokenWallet;
  let user2_usdt_wallet: TokenWallet;
  let owner_usdt_wallet: TokenWallet;

  const makeCommit = async function(usdt_wallet: TokenWallet, amount: number, direction: 0 | 1) {
    const call_id = getRandomNonce();
    const payload = await root.methods.encodeTokenTransfer({
      market_id: 0, bet: direction, call_id: call_id
    }).call();

    return await locklift.tracing.trace(
      usdt_wallet.transfer(amount, root.address, payload.payload, toNano(2.1)),
      {allowedCodes: {compute: [null]}}
    );
  }

  describe('Setup contracts', async function() {
    it('Run fixtures', async function() {
      await locklift.deployments.fixture();

      owner = locklift.deployments.getAccount('Owner').account;
      user1 = locklift.deployments.getAccount('User').account;
      user2 = locklift.deployments.getAccount('User1').account;

      root = await locklift.deployments.getContract<UpexRootAbi>('UpexRoot');

      usdt_root = new Token(locklift.deployments.getContract<TokenRootUpgradeableAbi>('USDT'), owner);
      user1_usdt_wallet = await usdt_root.wallet(user1);
      user2_usdt_wallet = await usdt_root.wallet(user2);
      owner_usdt_wallet = await usdt_root.wallet(owner);
    });
  })


  describe('Running scenarios', async function() {
    it('Add market', async function() {
      await locklift.tracing.trace(root.methods.addMarkets({
        new_markets: [{
          ticker: 'BTC',
          optionTtl: 24 * 3600,
          optionOpenDuration: 18 * 3600,
          winMultiplier: 2 * MULTIPLIER_DECIMALS,
          curOptionId: 0,
          curOptionStart: 0
        }],
        meta: {call_id: getRandomNonce(), send_gas_to: owner.address}
      }).send({from: owner.address, amount: toNano(1)}));
    });

    // it("Test", async function() {
    //   const {traceTree} = await locklift.tracing.trace(root.methods.spawnOptions({
    //     market_id: 0, prices: [1000 * PRICE_DECIMALS, 2000 * PRICE_DECIMALS]
    //   }).send({from: owner.address, amount: toNano(2.1)}));
    //
    //   await traceTree?.beautyPrint();
    // });

    it('Launch option', async function() {
      const {traceTree} = await locklift.tracing.trace(root.methods.launchNewOption({
        market_id: 0, market_price: 1000 * PRICE_DECIMALS
      }).send({from: owner.address, amount: toNano(2.1)}));

      expect(traceTree).to
        .emit("UpexOptionDeploy")
        .withNamedArgs({
          call_id: '0',
          market_id: '0',
          option_id: '1'
        })
    });

    const amount = 100 * USDT_DECIMALS;

    it('User 1 commit UP', async function() {
      const {traceTree} = await makeCommit(user1_usdt_wallet, amount, UP);
      // await traceTree?.beautyPrint();
      expect(traceTree).to
        .emit("CommitSaved")
        .withNamedArgs({
          commit: {
            market_id: '0',
            option_id: '1',
            user: user1.address.toString(),
            amount: amount.toFixed(),
            direction: UP.toFixed()
          }
        })
    });

    it('User 2 commit DOWN', async function() {
      const {traceTree} = await makeCommit(user2_usdt_wallet, amount, DOWN);
      expect(traceTree).to
        .emit("CommitSaved")
        .withNamedArgs({
          commit: {
            market_id: '0',
            option_id: '1',
            user: user2.address.toString(),
            amount: amount.toFixed(),
            direction: DOWN.toFixed()
          }
        })
    });

    it('Option closes, new option opens', async function() {
      // const acc = await root.methods.getUpexAccountAddress({user: user1.address, answerId: 1}).call();
      // const acc_c = await locklift.factory.getDeployedContract('UpexAccount', acc.value0);
      //
      // const res = await acc_c.methods.commits({}).call();
      // console.log(res, JSON.stringify(res));

      const signer = (await locklift.keystore.getSigner("0"))!;

      await locklift.testing.increaseTime(24 * 3600 + 1);
      const {traceTree} = await locklift.tracing.trace(root.methods.launchNewOption({
        market_id: 0, market_price: 1100 * PRICE_DECIMALS
      }).sendExternal({publicKey: signer?.publicKey}));

      expect(traceTree).to
        .emit("UpexOptionDeploy")
        .withNamedArgs({
          call_id: '0',
          market_id: '0',
          option_id: '2'
        })
      // await traceTree?.beautyPrint();
    });


    it('User 1 claim reward', async function() {
      const {traceTree} = await locklift.tracing.trace(root.methods.claimReward({
        market_id: 0, option_id: 1, meta: {call_id: getRandomNonce(), send_gas_to: user1.address}
      }).send({from: user1.address, amount: toNano(2.1)}));
      // await traceTree?.beautyPrint();

      expect(traceTree).to
        .emit("RewardClaim")
        .withNamedArgs({
          user: user1.address.toString(),
          win_amount: bn(amount).multipliedBy(2).toFixed(),
        })

    });

    it('User 2 fails to clam reward', async function() {
      const call_id = getRandomNonce();
      const {traceTree} = await locklift.tracing.trace(root.methods.claimReward({
        market_id: 0, option_id: 1, meta: {call_id: call_id, send_gas_to: user2.address}
      }).send({from: user2.address, amount: toNano(2.1)}));
      // await traceTree?.beautyPrint();

      expect(traceTree).to
        .emit("ActionRevert")
        .withNamedArgs({
          call_id: call_id.toFixed(),
          user: user2.address.toString()
        })
    });
  });
});