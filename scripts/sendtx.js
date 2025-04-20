import fs from 'fs';
import readlineSync from 'readline-sync';
import { ethers } from 'ethers';
import chalk from 'chalk';

// Constants
const NETWORK_URL = "https://testnet-rpc.monad.xyz/";
const CHAIN_ID = 10143;
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";

// Initialize provider
const provider = new ethers.JsonRpcProvider(NETWORK_URL);

// Load private keys
function loadPrivateKeys(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8').split('\n');
    const keys = data.map(k => k.trim()).filter(k => k.length === 64 || k.length === 66);
    if (!keys.length) throw new Error("No valid private keys found");
    return keys;
  } catch (err) {
    console.error(chalk.red(`❌ Error loading pvkey.txt: ${err.message}`));
    return null;
  }
}

// Load addresses
function loadAddresses(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8').split('\n');
    const addresses = data.map(a => a.trim()).filter(Boolean);
    if (!addresses.length) throw new Error("No valid addresses found");
    return addresses;
  } catch (err) {
    console.error(chalk.red(`❌ Error loading address.txt: ${err.message}`));
    return null;
  }
}

// Pretty border
function printBorder(text, color = chalk.magenta, width = 60) {
  console.log(color('╔' + '═'.repeat(width - 2) + '╗'));
  console.log(color('║ ' + text.padStart((56 + text.length) / 2).padEnd(56) + ' ║'));
  console.log(color('╚' + '═'.repeat(width - 2) + '╝'));
}

// Step display
function printStep(step, message) {
  const label = step === 'send' ? 'Send Transaction' : step;
  console.log(chalk.yellow(`🔸 ${chalk.cyan(label.padEnd(15))} | ${message}`));
}

// Random address
function getRandomAddress() {
  return ethers.getAddress('0x' + [...Array(40)].map(() => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(''));
}

// Send transaction
async function sendTransaction(privateKey, to, amount) {
  try {
    const wallet = new ethers.Wallet(privateKey, provider);
    const nonce = await provider.getTransactionCount(wallet.address);
    const latestBlock = await provider.getBlock('latest');
    const baseFee = latestBlock.baseFeePerGas || ethers.parseUnits('1', 'gwei');
    const priorityFee = ethers.parseUnits('2', 'gwei');
    const maxFee = baseFee + priorityFee;

    const tx = {
      to,
      value: ethers.parseEther(amount.toString()),
      gasLimit: 21000,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: priorityFee,
      nonce,
      chainId: CHAIN_ID
    };

    printStep('send', 'Sending transaction...');
    const sentTx = await wallet.sendTransaction(tx);
    const receipt = await sentTx.wait();

    const link = EXPLORER_URL + sentTx.hash;
    if (receipt.status === 1) {
      console.log(chalk.green(`✔ Transaction successful! Tx: ${link}`));
      console.log(chalk.yellow(`Sender: ${wallet.address}`));
      console.log(chalk.yellow(`Receiver: ${to}`));
      console.log(chalk.yellow(`Amount: ${amount} MONAD`));
      console.log(chalk.yellow(`Gas used: ${receipt.gasUsed}`));
      console.log(chalk.yellow(`Block: ${receipt.blockNumber}`));
      const balance = await provider.getBalance(wallet.address);
      console.log(chalk.yellow(`Balance: ${ethers.formatEther(balance)} MONAD`));
      return true;
    } else {
      console.log(chalk.red(`✘ Transaction failed! Tx: ${link}`));
      return false;
    }
  } catch (e) {
    printStep('send', chalk.red(`✘ Failed: ${e.message}`));
    return false;
  }
}

// Send to random addresses
async function sendToRandomAddresses(amount, txCount, keys) {
  printBorder(`Starting ${txCount} random transactions`, chalk.cyan);
  let success = 0;
  for (let i = 0; i < txCount; i++) {
    for (const key of keys) {
      const to = getRandomAddress();
      if (await sendTransaction(key, to, amount)) success++;
      await new Promise(r => setTimeout(r, Math.random() * 2000 + 1000));
    }
  }
  console.log(chalk.yellow(`Total successful transactions: ${success}`));
}

// Send to file addresses
async function sendToFileAddresses(amount, addresses, keys) {
  printBorder(`Starting transactions to ${addresses.length} addresses`, chalk.cyan);
  let success = 0;
  for (const key of keys) {
    for (const to of addresses) {
      if (await sendTransaction(key, to, amount)) success++;
      await new Promise(r => setTimeout(r, Math.random() * 2000 + 1000));
    }
  }
  console.log(chalk.yellow(`Total successful transactions: ${success}`));
}

// Main
export async function run(txCount = 5, amount = 0.000001, choice = '1') {
  console.log(chalk.green('═'.repeat(60)));
  console.log(chalk.green('│ ' + 'SEND TX - MONAD TESTNET'.padStart(36).padEnd(56) + ' │'));
  console.log(chalk.green('═'.repeat(60)));

  const keys = loadPrivateKeys('pvkey.txt');
  if (!keys) return;

  console.log(chalk.cyan(`👥 Accounts: ${keys.length}`));

  if (choice === '1') {
    await sendToRandomAddresses(amount, txCount, keys);
  } else if (choice === '2') {
    const addresses = loadAddresses('address.txt');
    if (addresses) await sendToFileAddresses(amount, addresses, keys);
  } else {
    console.log(chalk.red("❌ Invalid choice"));
  }

  console.log(chalk.green('═'.repeat(60)));
  console.log(chalk.green(`│ ALL DONE: ${txCount} TRANSACTIONS FOR ${keys.length} ACCOUNTS │`));
  console.log(chalk.green('═'.repeat(60)));
}

// If you need to export the script to be used elsewhere, use export default here
export default run;
