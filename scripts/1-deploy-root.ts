import {deployUser, isValidEverAddress, setupUpexRoot} from "../test/utils/common";
import {readFileSync} from "fs";
import {toNano} from "locklift";

const prompts = require('prompts');
const ora = require('ora');


async function main() {
  console.log('\x1b[1m', '\n\nDeploy Upex Root:')
  const response = await prompts([
    {
      type: 'text',
      name: '_owner',
      message: 'Upex Root owner address',
      validate: (value: string) => isValidEverAddress(value) ? true : 'Invalid Everscale address'
    },
    {
      type: 'text',
      name: '_launcher_pubkey',
      message: 'Daemon option launcher pubkey'
    },
    {
      type: 'text',
      name: '_usdt',
      message: 'Usdt root address'
    }
  ]);
  console.log('\x1b[1m', '\nSetup complete! ✔');

  const spinner = ora('Deploying temporary owner...').start();
  const user = await deployUser(3, false);
  spinner.succeed(`Tmp owner deployed: ${user.address}`);

  spinner.start('Deploying Upex Root...');
  const root = await setupUpexRoot(user.address, response._launcher_pubkey, response._usdt);
  spinner.succeed(`Upex Root deployed: ${root.address}`);

  spinner.start('Adding markets...');
  const market_configs = JSON.parse(readFileSync('./markets.json').toString());
  await locklift.tracing.trace(root.methods.addMarkets(
    {new_markets: market_configs, meta: {call_id: 1, send_gas_to: response._owner}}
  ).send({from: user.address, amount: toNano(1)}))
  spinner.succeed('Markets added');

  spinner.start('Transferring ownership...');
  await locklift.tracing.trace(root.methods.transferOwnership({
    new_owner: response._owner, meta: {call_id: 2, send_gas_to: response._owner}
  }).send({from: user.address, amount: toNano(1)}));
  spinner.succeed('Ownership transferred');

}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
