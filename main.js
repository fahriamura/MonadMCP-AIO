import fs from 'fs';
import os from 'os';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import z from 'zod';

// Get __dirname equivalent in ES Modules
const __dirname = (() => {
  const pathname = new URL(import.meta.url).pathname;
  // Fix Windows paths
  return path.dirname(os.platform() === "win32" ? pathname.replace(/^\/(\w:)/, "$1") : pathname);
})();

// Simple log message function instead of fancy borders
function logMessage(text) {
  console.log(text);
}

// Simplified version of printBanner
function printBanner() {
  console.log("MONAD TESTNET");
}

function clearConsole() {
  process.stdout.write(os.platform() === "win32" ? execSync("cls") : "\x1B[2J\x1B[0f");
}

function getAvailableScripts() {
  return [
    { name: "1. aPriori Staking", value: "apriori" },
    { name: "2. Uniswap Swap", value: "uniswap" },
    { name: "3. Deploy Contract", value: "deploy" },
    { name: "4. Send Random TX or File (address.txt)", value: "sendtx" },
    { name: "5. View My Addresses", value: "viewaddress" },
    { name: "6. Exit", value: "exit" }
  ];
}

// Simplified quote function
function getQuote() {
  console.log("Quote: 'Your only limit is your mind.'");
}

// Log the contents of the 'scripts' directory
function logScriptsDirectory() {
  // For Windows, we need to fix the URL pathname format
  let currentDir = path.dirname(new URL(import.meta.url).pathname);
  
  // Fix Windows paths by removing the leading slash from drive letters
  if (os.platform() === "win32") {
    currentDir = currentDir.replace(/^\/(\w:)/, "$1");
  }
  
  const scriptsDir = path.join(currentDir, 'scripts');
  return scriptsDir;
}

async function runScript(moduleName) {
  // Fix directory path handling for Windows
  let currentDir = path.dirname(new URL(import.meta.url).pathname);
  
  // Fix Windows paths
  if (os.platform() === "win32") {
    currentDir = currentDir.replace(/^\/(\w:)/, "$1");
  }
  
  const scriptsDir = path.join(currentDir, 'scripts');
  const modulePath = path.join(scriptsDir, `${moduleName}.js`);

  try {
    if (fs.existsSync(modulePath)) {
      const scriptModule = await import(`file://${modulePath}`);
      if (typeof scriptModule.run === "function") {
        return await scriptModule.run();
      } else {
        throw new Error("No 'run' function exported in script.");
      }
    } else {
      throw new Error(`Script not found: ${moduleName}`);
    }
  } catch (err) {
    throw err;
  }
}

// Initialize MCP server
const server = new McpServer({
  name: 'Monad MCP AIO',
  version: '1.0.0'
});

// Define tools for each script
server.tool(
  'run-apriori',
  'Run the aPriori Staking script',
  {},
  async () => {
    await runScript('apriori');
    return { content: [{ type: 'text', text: 'aPriori Staking completed.' }] };
  }
);

server.tool(
  'run-uniswap',
  'Run the Uniswap Swap script',
  {},
  async () => {
    await runScript('uniswap');
    return { content: [{ type: 'text', text: 'Uniswap Swap completed.' }] };
  }
);

server.tool(
  'run-deploy',
  'Run the Deploy Contract script',
  {},
  async () => {
    await runScript('deploy');
    return { content: [{ type: 'text', text: 'Deploy Contract completed.' }] };
  }
);

server.tool(
  'run-sendtx',
  'Run the Send Random TX or File script',
  {},
  async () => {
    await runScript('sendtx');
    return { content: [{ type: 'text', text: 'Send Random TX or File completed.' }] };
  }
);

server.tool(
  'run-viewaddress',
  'View your wallet addresses',
  {},
  async () => {
    try {
      // Get the directory path
      let currentDir = path.dirname(new URL(import.meta.url).pathname);
      
      // Fix Windows paths
      if (os.platform() === "win32") {
        currentDir = currentDir.replace(/^\/(\w:)/, "$1");
      }
      
      const filePath = path.join(currentDir, 'pvkey.txt');
      
      if (!fs.existsSync(filePath)) {
        return { content: [{ type: 'text', text: 'Private key file tidak ditemukan! Pastikan file pvkey.txt tersedia.' }] };
      }
      
      const data = fs.readFileSync(filePath, 'utf-8').split('\n');
      const keys = data.map(k => k.trim()).filter(k => k.length === 64 || k.length === 66);
      
      if (!keys.length) {
        return { content: [{ type: 'text', text: 'Tidak ditemukan private key yang valid dalam file.' }] };
      }
      
      // Import web3 dynamically
      const { Web3 } = await import('web3');
      const web3 = new Web3('https://testnet-rpc.monad.xyz/');
      
      // Get addresses and balances
      let addressList = '';
      for (let i = 0; i < keys.length; i++) {
        try {
          const privateKey = keys[i].startsWith('0x') ? keys[i] : `0x${keys[i]}`;
          const account = web3.eth.accounts.privateKeyToAccount(privateKey);
          const balance = web3.utils.fromWei(await web3.eth.getBalance(account.address), 'ether');
          
          addressList += `\nAlamat ${i+1}: ${account.address}\nSaldo: ${Number(balance).toFixed(6)} MONAD\nExplorer: https://testnet.monadexplorer.com/address/${account.address}\n`;
        } catch (error) {
          addressList += `\nError pada key ${i+1}: ${error.message}\n`;
        }
      }
      
      return { 
        content: [{ 
          type: 'text', 
          text: `Alamat Wallet Anda:\n${addressList}` 
        }] 
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
    }
  }
);

// New tool for sending MON to address
server.tool(
  'send-mon',
  'Send MON to a specified address',
  {
    command: z.string().describe('Natural language command to send MON')
  },
  async ({ command }) => {
    // Simple regex patterns to match different command variations
    const patterns = [
      /send (\d+(?:\.\d+)?) MON to (0x[a-fA-F0-9]{40})/i,
      /kirim (\d+(?:\.\d+)?) MON ke (0x[a-fA-F0-9]{40})/i,
      /transfer (\d+(?:\.\d+)?) MON to (0x[a-fA-F0-9]{40})/i,
    ];

    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (match) {
        const amount = parseFloat(match[1]);
        const toAddress = match[2];
        console.log(`Executing send: ${amount} MON to ${toAddress}`);
        
        try {
          // Import all needed modules
          const sendtxPath = path.join(__dirname, 'scripts', 'sendtx.js');
          const { ethers } = await import('ethers');
          const fs = await import('fs');
          const sendtxModule = await import(`file://${sendtxPath}`);
          
          if (typeof sendtxModule.run !== "function") {
            throw new Error("Sendtx script doesn't have a run function");
          }
          
          // Save the address to address.txt
          const addressFilePath = path.join(__dirname, 'address.txt');
          fs.writeFileSync(addressFilePath, toAddress);
          
          // Get private keys
          const pvkeyPath = path.join(__dirname, 'pvkey.txt');
          if (!fs.existsSync(pvkeyPath)) {
            return { content: [{ type: 'text', text: 'Private key file tidak ditemukan! Pastikan file pvkey.txt tersedia.' }] };
          }
          
          const data = fs.readFileSync(pvkeyPath, 'utf-8').split('\n');
          const keys = data.map(k => k.trim()).filter(k => k.length === 64 || k.length === 66);
          
          if (!keys.length) {
            return { content: [{ type: 'text', text: 'Tidak ditemukan private key yang valid dalam file.' }] };
          }
          
          // Create provider
          const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz/", 10143);
          
          // Just use the first key
          const privateKey = keys[0].startsWith('0x') ? keys[0] : `0x${keys[0]}`;
          const wallet = new ethers.Wallet(privateKey, provider);
          const nonce = await provider.getTransactionCount(wallet.address);
          const latestBlock = await provider.getBlock('latest');
          const baseFee = latestBlock.baseFeePerGas || ethers.parseUnits('1', 'gwei');
          const priorityFee = ethers.parseUnits('2', 'gwei');
          const maxFee = baseFee + priorityFee;

          const tx = {
            to: toAddress,
            value: ethers.parseEther(amount.toString()),
            gasLimit: 21000,
            maxFeePerGas: maxFee,
            maxPriorityFeePerGas: priorityFee,
            nonce,
            chainId: 10143
          };
          
          // Send transaction
          const sentTx = await wallet.sendTransaction(tx);
          const txHash = sentTx.hash;
          const explorerUrl = "https://testnet.monadexplorer.com/tx/" + txHash;
          
          // Wait for receipt
          const receipt = await sentTx.wait();
          
          return { 
            content: [{ 
              type: 'text', 
              text: `Transaction completed: ${amount} MON sent to ${toAddress}\n\nTransaction Hash: ${txHash}\nExplorer Link: ${explorerUrl}`
            }] 
          };
          
        } catch (error) {
          return { content: [{ type: 'text', text: `Error sending transaction: ${error.message}` }] };
        }
      }
    }
    throw new Error('Could not understand the command. Please specify the amount and address to send MON to.');
  }
);

// Enhanced tool to handle flexible swap commands
server.tool(
  'swap-mon',
  'Swap MON to a specified contract address',
  {
    command: z.string().describe('Natural language command to swap MON')
  },
  async ({ command }) => {
    // Simple regex patterns to match different command variations
    const patterns = [
      /swap (\d+(?:\.\d+)?) MON to (0x[a-fA-F0-9]{40})/i,
      /convert (\d+(?:\.\d+)?) MON to (0x[a-fA-F0-9]{40})/i,
      /exchange (\d+(?:\.\d+)?) MON for (0x[a-fA-F0-9]{40})/i,
      /tukar (\d+(?:\.\d+)?) MON ke (0x[a-fA-F0-9]{40})/i
    ];

    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (match) {
        const amount = parseFloat(match[1]);
        const contractAddress = match[2];
        console.log(`Executing swap: ${amount} MON to ${contractAddress}`);
        
        // Import and run uniswap.js
        try {
          const uniswapModule = await import(`file://${path.join(__dirname, 'scripts', 'uniswap.js')}`);
          if (typeof uniswapModule.run === "function") {
            await uniswapModule.run(contractAddress, amount);
            return { content: [{ type: 'text', text: `Swap executed: ${amount} MON to ${contractAddress}` }] };
          } else {
            throw new Error("Uniswap script doesn't have a run function");
          }
        } catch (error) {
          return { content: [{ type: 'text', text: `Error executing swap: ${error.message}` }] };
        }
      }
    }
    throw new Error('Could not understand the command. Please specify the amount and contract address.');
  }
);

// New tool for token analysis
server.tool(
  'analyze-token',
  'Analyze token safety by checking holders, volume, and transactions',
  {
    tokenAddress: z.string().describe('The address of the token contract to analyze')
  },
  async ({ tokenAddress }) => {
    try {
      const analyzerModule = await import(`file://${path.join(__dirname, 'scripts', 'tokenAnalyzer.js')}`);
      if (typeof analyzerModule.run === "function") {
        const report = await analyzerModule.run(tokenAddress);
        
        // Check if analysis failed
        if (report.status === 'failed') {
          return { 
            content: [{ 
              type: 'text', 
              text: `Analysis failed for token ${tokenAddress}:\n${report.error || "Unknown error"}\n\n${report.analysis?.recommendation || "Token may not exist or may not follow standard interfaces."}`
            }]
          };
        }
        
        // Format a clean summary for Claude to analyze
        let summary = `
Token Analysis Report for ${report.token?.name || "Unknown"} (${report.token?.symbol || "Unknown"})
Address: ${report.token?.address || tokenAddress}
Total Supply: ${report.token?.totalSupply || "Unknown"}

Risk Level: ${(report.analysis?.overallRisk || "unknown").toUpperCase()}
Holder Concentration: ${report.analysis?.holderConcentration || "Unknown"}
Liquidity: ${report.analysis?.liquidityRating || "Unknown"}

Top Holders:
${report.topHolders && report.topHolders.length > 0 ? 
  report.topHolders.slice(0, 5).map((h, i) => 
    `${i+1}. Address: ${h.address}\n   Balance: ${h.balance}\n   Transaction Count: ${h.txCount}`
  ).join('\n') : 
  "No holder data available"
}

Volume:
- Total Transfers: ${report.volume?.totalTransfers || "Unknown"}
- Unique Addresses: ${report.volume?.uniqueAddresses || "Unknown"}
- Est. Daily Volume: ${report.volume?.estimatedDailyVolume || "Unknown"}

Security Warnings:
${report.security?.warnings && report.security.warnings.length > 0 ? 
  report.security.warnings.map(w => `- ${w.message} (${w.severity})`).join('\n') : 
  "No specific warnings detected"
}

Recommendation: ${report.analysis?.recommendation || "Unable to provide recommendation due to limited data"}
`;

        return { 
          content: [{ 
            type: 'text', 
            text: summary
          }]
        };
      } else {
        throw new Error("Token analyzer script doesn't have a run function");
      }
    } catch (error) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Error analyzing token ${tokenAddress}: ${error.message}\n\nThe token contract may not exist, may not be a standard token, or may be on a different network.` 
        }]
      };
    }
  }
);

// New tool for wallet analysis
server.tool(
  'analyze-address',
  'Analyze wallet address including NFT, tokens, transaction history and activity patterns',
  {
    address: z.string().describe('The wallet address to analyze')
  },
  async ({ address }) => {
    try {
      const analyzerModule = await import(`file://${path.join(__dirname, 'scripts', 'addressAnalyzer.js')}`);
      if (typeof analyzerModule.run === "function") {
        const report = await analyzerModule.run(address);
        
        // Check if analysis failed
        if (report.status === 'failed') {
          return { 
            content: [{ 
              type: 'text', 
              text: `Analysis failed for address ${address}:\n${report.error || "Unknown error"}`
            }]
          };
        }
        
        // Check if it's a contract instead of a wallet
        if (report.isContract) {
          return { 
            content: [{ 
              type: 'text', 
              text: `${report.message}\n\n${report.recommendation || ""}`
            }]
          };
        }
        
        // Format a clean summary for Claude to analyze
        let summary = `
Wallet Analysis Report for ${address}
Explorer: ${report.explorerUrl}

Basic Information:
- Balance: ${report.nativeBalance} MONAD
- Estimated Portfolio Value: ${report.portfolioValue}
- First Activity: ${report.firstActivity}
- Account Age: ${report.accountAge}
- Activity Level: ${report.activityLevel}

Token Holdings:
${report.tokens && report.tokens.length > 0 ? 
  report.tokens.map(token => `- ${token.name} (${token.symbol}): ${token.balance}`).join('\n') : 
  "No token holdings detected"
}

NFT Holdings:
${report.nfts && report.nfts.length > 0 ? 
  report.nfts.map(nft => `- ${nft.name} (${nft.symbol}): ${nft.balance} NFTs`).join('\n') : 
  "No NFT holdings detected"
}

Transaction Summary:
- Total Transactions: ${report.transactionMetrics?.totalTransactions || "Unknown"}
- Sent: ${report.transactionMetrics?.sentTransactions || "Unknown"}
- Received: ${report.transactionMetrics?.receivedTransactions || "Unknown"}

Recent Transactions:
${report.recentTransactions && report.recentTransactions.length > 0 ? 
  report.recentTransactions.slice(0, 3).map(tx => 
    `- ${new Date(tx.timestamp * 1000).toISOString().split('T')[0]}: ${tx.type === "out" ? "Sent" : "Received"} ${tx.value} MONAD ${tx.type === "out" ? "to" : "from"} ${tx.type === "out" ? tx.to.slice(0, 10) + "..." : tx.from.slice(0, 10) + "..."}`
  ).join('\n') : 
  "No recent transactions found"
}

Activity Analysis:
- Pattern Type: ${report.activityAnalysis?.patternType || "Unknown"}
- Transaction Frequency: ${report.activityAnalysis?.frequency || "Unknown"}
- Average Transaction: ${report.activityAnalysis?.averageTransactionValue || "Unknown"}
- Largest Transaction: ${report.activityAnalysis?.largestTransaction || "Unknown"}
- Most Recent Activity: ${report.activityAnalysis?.mostRecentActivity || "Unknown"}

Summary: ${report.activityAnalysis?.description || "Insufficient data to provide a summary of this wallet's activity patterns."}
`;

        return { 
          content: [{ 
            type: 'text', 
            text: summary
          }]
        };
      } else {
        throw new Error("Address analyzer script doesn't have a run function");
      }
    } catch (error) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Error analyzing address ${address}: ${error.message}` 
        }]
      };
    }
  }
);

// New tool for checking Twitter username history
server.tool(
  'check-twitter',
  'Check Twitter username change history',
  {
    screenName: z.string().describe('Twitter username to check (without @ symbol)')
  },
  async ({ screenName }) => {
    try {
      const twitterModule = await import(`file://${path.join(__dirname, 'scripts', 'twitterChecker.js')}`);
      if (typeof twitterModule.run === "function") {
        const result = await twitterModule.run(screenName);
        
        // Check if analysis failed
        if (result.status === 'failed') {
          return { 
            content: [{ 
              type: 'text', 
              text: `Failed to check Twitter history for @${screenName}:\n${result.error || "Unknown error"}`
            }]
          };
        }
        
        // Return the formatted text result
        return { 
          content: [{ 
            type: 'text', 
            text: result.text || `No history found for Twitter user @${screenName}`
          }]
        };
      } else {
        throw new Error("Twitter checker script doesn't have a run function");
      }
    } catch (error) {
      return { 
        content: [{ 
          type: 'text', 
          text: `Error checking Twitter history for @${screenName}: ${error.message}`
        }]
      };
    }
  }
);

// Start the server
async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("MCP Server started successfully");
}

startServer().catch(console.error);

// Interactive UI is disabled when used as MCP server
/*
async function main() {
  clearConsole();
  printBanner();
  
  // Log the scripts directory contents
  logScriptsDirectory();

  while (true) {
    clearConsole();
    printBanner();
    getQuote();
    logMessage("MAIN MENU");

    const availableScripts = getAvailableScripts();
    const answer = await inquirer.prompt([{
      type: "list",
      name: "script",
      message: "Select script to run",
      choices: availableScripts.map(s => s.name),
      loop: true
    }]);

    const selectedScript = availableScripts.find(s => s.name === answer.script);
    if (selectedScript.value === "exit") {
      logMessage("EXITING");
      console.log("Goodbye!");
      process.exit(0);
    }

    try {
      logMessage(`RUNNING: ${answer.script}`);
      await runScript(selectedScript.value);
      logMessage(`Completed ${answer.script}`);
      await inquirer.prompt([{ type: "input", name: "pause", message: "Press Enter to continue..." }]);
    } catch (err) {
      logMessage(`Error: ${err.message}`);
      await inquirer.prompt([{ type: "input", name: "pause", message: "Press Enter to continue..." }]);
    }
  }
}

// main();
*/
