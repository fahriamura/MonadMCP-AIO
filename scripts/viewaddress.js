import fs from 'fs';
import chalk from 'chalk';
import { ethers } from 'ethers';

// Constants
const NETWORK_URL = "https://testnet-rpc.monad.xyz/";
const EXPLORER_URL = "https://testnet.monadexplorer.com/address/";

// Initialize provider
const provider = new ethers.JsonRpcProvider(NETWORK_URL);

// Simple log function replacing fancy borders
function logMessage(message) {
  console.log(message);
}

// Load private keys and convert to addresses
async function getWalletAddresses() {
  try {
    const filePath = 'pvkey.txt';
    if (!fs.existsSync(filePath)) {
      throw new Error(`Private key file ${filePath} not found`);
    }

    const data = fs.readFileSync(filePath, 'utf-8').split('\n');
    const keys = data.map(k => k.trim()).filter(k => k.length === 64 || k.length === 66);
    
    if (!keys.length) {
      throw new Error("No valid private keys found");
    }

    const wallets = [];
    for (const key of keys) {
      try {
        const privateKey = key.startsWith('0x') ? key : `0x${key}`;
        const wallet = new ethers.Wallet(privateKey, provider);
        const balance = await provider.getBalance(wallet.address);
        wallets.push({
          address: wallet.address,
          balance: ethers.formatEther(balance)
        });
      } catch (error) {
        console.error(`Error processing key: ${error.message}`);
      }
    }

    return wallets;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return [];
  }
}

export async function run() {
  console.log('MY WALLET ADDRESSES - MONAD TESTNET');

  const wallets = await getWalletAddresses();

  if (wallets.length === 0) {
    logMessage("No wallets found");
    return;
  }

  logMessage(`Found ${wallets.length} wallet addresses`);
  
  // Display all wallet addresses and balances in plain text
  console.log('INDEX | ADDRESS | BALANCE (MONAD)');
  console.log('--------------------------------------------');
  
  wallets.forEach((wallet, index) => {
    console.log(`${index + 1} | ${wallet.address} | ${parseFloat(wallet.balance).toFixed(6)}`);
  });
  
  console.log(`\nView more details on explorer: ${EXPLORER_URL}YOUR_ADDRESS`);
  console.log('COMPLETED: ADDRESS VIEWING');
}

export default run; 