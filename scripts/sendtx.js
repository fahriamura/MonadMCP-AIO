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
    console.error(`Error loading pvkey.txt: ${err.message}`);
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
    console.error(`Error loading address.txt: ${err.message}`);
    return null;
  }
}

// Simple log function
function logMessage(message) {
  console.log(message);
}

// Step display
function logStep(step, message) {
  const label = step === 'send' ? 'Send Transaction' : step;
  console.log(`${label}: ${message}`);
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

    logStep('send', 'Sending transaction...');
    const sentTx = await wallet.sendTransaction(tx);
    const txHash = sentTx.hash;
    
    console.log("\n=================================================");
    console.log("TRANSACTION SENT!");
    console.log("TX HASH: " + txHash);
    console.log("TX EXPLORER: " + EXPLORER_URL + txHash);
    console.log("=================================================\n");
    
    const receipt = await sentTx.wait();

    if (receipt.status === 1) {
      console.log(`Transaction successful!`);
      console.log(`Sender: ${wallet.address}`);
      console.log(`Receiver: ${to}`);
      console.log(`Amount: ${amount} MONAD`);
      console.log(`Gas used: ${receipt.gasUsed}`);
      console.log(`Block: ${receipt.blockNumber}`);
      const balance = await provider.getBalance(wallet.address);
      console.log(`Balance: ${ethers.formatEther(balance)} MONAD`);
      return true;
    } else {
      console.log(`Transaction failed!`);
      return false;
    }
  } catch (e) {
    logStep('send', `Failed: ${e.message}`);
    return false;
  }
}

// Send to random addresses
async function sendToRandomAddresses(amount, txCount, keys) {
  logMessage(`Starting ${txCount} random transactions`);
  let success = 0;
  for (let i = 0; i < txCount; i++) {
    for (const key of keys) {
      const to = getRandomAddress();
      if (await sendTransaction(key, to, amount)) success++;
      await new Promise(r => setTimeout(r, Math.random() * 2000 + 1000));
    }
  }
  console.log(`Total successful transactions: ${success}`);
}

// Send to file addresses
async function sendToFileAddresses(amount, addresses, keys) {
  logMessage(`Starting transactions to ${addresses.length} addresses`);
  let success = 0;
  for (const key of keys) {
    for (const to of addresses) {
      if (await sendTransaction(key, to, amount)) success++;
      await new Promise(r => setTimeout(r, Math.random() * 2000 + 1000));
    }
  }
  console.log(`Total successful transactions: ${success}`);
}

// Main
export async function run(txCount = 5, amount = 0.000001, choice = '1') {
  console.log('SEND TX - MONAD TESTNET');

  const keys = loadPrivateKeys('pvkey.txt');
  if (!keys) return;

  console.log(`Accounts: ${keys.length}`);

  if (choice === '1') {
    await sendToRandomAddresses(amount, txCount, keys);
  } else if (choice === '2') {
    const addresses = loadAddresses('address.txt');
    if (addresses) await sendToFileAddresses(amount, addresses, keys);
  } else {
    console.log("Invalid choice");
  }

  console.log(`ALL DONE: ${txCount} TRANSACTIONS FOR ${keys.length} ACCOUNTS`);
}

// If you need to export the script to be used elsewhere, use export default here
export default run;
