import fs from 'fs';
import chalk from 'chalk';
import { ethers } from 'ethers';

// Constants
const NETWORK_URL = "https://testnet-rpc.monad.xyz/";
const EXPLORER_URL = "https://testnet.monadexplorer.com/address/";

// Initialize provider
const provider = new ethers.JsonRpcProvider(NETWORK_URL);

// Pretty border
function printBorder(text, color = chalk.cyan, width = 60) {
  console.log(color('┌' + '─'.repeat(width - 2) + '┐'));
  console.log(color('│ ' + text.padStart((56 + text.length) / 2).padEnd(56) + ' │'));
  console.log(color('└' + '─'.repeat(width - 2) + '┘'));
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
        console.error(chalk.red(`Error processing key: ${error.message}`));
      }
    }

    return wallets;
  } catch (err) {
    console.error(chalk.red(`❌ Error: ${err.message}`));
    return [];
  }
}

export async function run() {
  console.log(chalk.green('═'.repeat(80)));
  console.log(chalk.green('│ ' + 'MY WALLET ADDRESSES - MONAD TESTNET'.padStart(48).padEnd(76) + ' │'));
  console.log(chalk.green('═'.repeat(80)));

  const wallets = await getWalletAddresses();

  if (wallets.length === 0) {
    printBorder("No wallets found", chalk.red);
    return;
  }

  printBorder(`Found ${wallets.length} wallet addresses`, chalk.cyan);
  
  // Display all wallet addresses and balances
  console.log(chalk.yellow('┌─────────┬──────────────────────────────────────────────┬────────────────────────┐'));
  console.log(chalk.yellow('│ ' + 'INDEX'.padEnd(7) + ' │ ' + 'ADDRESS'.padEnd(44) + ' │ ' + 'BALANCE (MONAD)'.padEnd(20) + ' │'));
  console.log(chalk.yellow('├─────────┼──────────────────────────────────────────────┼────────────────────────┤'));
  
  wallets.forEach((wallet, index) => {
    const explorerLink = EXPLORER_URL + wallet.address;
    console.log(chalk.white('│ ') + 
                chalk.cyan(`${(index + 1).toString().padEnd(7)}`) + 
                chalk.white('│ ') + 
                chalk.green(`${wallet.address.padEnd(44)}`) + 
                chalk.white('│ ') + 
                chalk.magenta(`${parseFloat(wallet.balance).toFixed(6).padEnd(20)}`) + 
                chalk.white('│'));
  });
  
  console.log(chalk.yellow('└─────────┴──────────────────────────────────────────────┴────────────────────────┘'));
  console.log(chalk.cyan(`\n💡 Tip: View more details on explorer: ${EXPLORER_URL}YOUR_ADDRESS`));
  
  console.log(chalk.green('═'.repeat(80)));
  console.log(chalk.green('│ ' + 'COMPLETED: ADDRESS VIEWING'.padStart(48).padEnd(76) + ' │'));
  console.log(chalk.green('═'.repeat(80)));
}

export default run; 