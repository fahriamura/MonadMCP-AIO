import fs from 'fs';
import { ethers } from 'ethers';
import readline from 'readline';
import solc from 'solc';

// Constants
const RPC_URL = "https://testnet-rpc.monad.xyz";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";

// Provider untuk terhubung ke Monad network
let provider;
try {
  provider = new ethers.JsonRpcProvider(RPC_URL);
} catch (error) {
  // Tidak throw error, cuma log pesan untuk debugging
  console.log(`RPC connection issue: ${error.message}, will retry later`);
}

// Read private keys
function loadPrivateKeys(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const keys = content.split("\n").map(line => line.trim()).filter(Boolean);
    if (keys.length === 0) {
      console.log("Warning: pvkey.txt file exists but contains no valid private keys");
      return [];
    }
    return keys;
  } catch (err) {
    // Log error tapi jangan throw exception yang memutus flow
    console.log("Note: pvkey.txt not found or cannot be read");
    return [];
  }
}

// Read input from terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Contract source
const CONTRACT_SOURCE = `
pragma solidity ^0.8.0;

contract Counter {
    uint256 private count;
    
    event CountIncremented(uint256 newCount);
    
    function increment() public {
        count += 1;
        emit CountIncremented(count);
    }
    
    function getCount() public view returns (uint256) {
        return count;
    }
}
`;

// Compile contract using solc-js
function compileContract() {
  console.log("Compiling Solidity contract...");
  try {
    const input = {
      language: "Solidity",
      sources: {
        "Counter.sol": {
          content: CONTRACT_SOURCE
        }
      },
      settings: {
        outputSelection: {
          "*": {
            "*": ["abi", "evm.bytecode"]
          }
        }
      }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    
    // Check for compilation errors
    if (output.errors) {
      const hasError = output.errors.some(error => error.severity === 'error');
      if (hasError) {
        console.log("Compilation errors detected:");
        output.errors.forEach(error => {
          console.log(`- ${error.formattedMessage}`);
        });
        return null;
      }
    }
    
    const contract = output.contracts["Counter.sol"]["Counter"];
    return {
      abi: contract.abi,
      bytecode: contract.evm.bytecode.object
    };
  } catch (err) {
    console.log(`Compilation failed: ${err.message}`);
    // Return empty object instead of null to avoid breaking the flow
    return { abi: [], bytecode: "" };
  }
}

// Deploy contract
async function deployContract(wallet, tokenName, tokenSymbol, abi, bytecode) {
  try {
    // Validasi input
    if (!bytecode || bytecode === "") {
      console.log("Cannot deploy: missing bytecode. Compilation may have failed.");
      return null;
    }
    
    // Create contract factory
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    console.log("Deploying contract to Monad testnet...");
    
    // Deploy contract
    const contract = await factory.deploy();
    const txHash = contract.deploymentTransaction().hash;
    console.log("\n=================================================");
    console.log("TRANSACTION SENT!");
    console.log("TX HASH: " + txHash);
    console.log("TX EXPLORER: " + EXPLORER_URL + txHash);
    console.log("=================================================\n");
    
    // Wait for confirmation
    console.log("Waiting for confirmation...");
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    
    console.log("Contract deployed successfully!");
    console.log("Contract Address:", address);
    console.log("View on explorer:", "https://testnet.monadexplorer.com/address/" + address);
    
    return address;
  } catch (err) {
    // Handle common deployment errors
    let errorMessage = `Deployment failed: ${err.message}`;
    
    // Check for specific errors and provide more helpful messages
    if (err.message.includes("insufficient funds")) {
      errorMessage = "Deployment failed: Your wallet doesn't have enough MONAD to deploy the contract. Please get some testnet tokens.";
    } else if (err.message.includes("network")) {
      errorMessage = "Deployment failed: Network connection issue. Please check your internet connection.";
    } else if (err.message.includes("nonce")) {
      errorMessage = "Deployment failed: Nonce issue. Try again in a few seconds.";
    }
    
    console.log(errorMessage);
    
    // Return object with error details instead of throwing or returning null
    return { 
      deployed: false, 
      error: errorMessage
    };
  }
}

// Deploy loop
async function runDeployCycle(cycles, privateKeys) {
  // Get compiled contract
  const contractData = compileContract();
  
  // Validate compilation result
  if (!contractData || !contractData.bytecode) {
    console.log("Contract compilation failed or returned empty bytecode. Cannot proceed with deployment.");
    return { success: false, reason: "compilation_failed" };
  }
  
  const { abi, bytecode } = contractData;

  // Deploy for each account
  for (let i = 0; i < privateKeys.length; i++) {
    try {
      // Initialize provider if not already done
      if (!provider) {
        provider = new ethers.JsonRpcProvider(RPC_URL);
      }
      
      // Create wallet instance
      const wallet = new ethers.Wallet(privateKeys[i], provider);
      const walletShort = wallet.address.slice(0, 8) + "...";
      console.log(`\nACCOUNT ${i + 1}/${privateKeys.length} | ${walletShort}`);

      // Get wallet balance to check if deployment is possible
      const balance = await provider.getBalance(wallet.address);
      const balanceInMONAD = ethers.formatEther(balance);
      console.log(`Current balance: ${balanceInMONAD} MONAD`);
      
      if (balance < ethers.parseEther("0.01")) {
        console.log("Warning: Low balance. Contract deployment may fail.");
      }

      // Deploy multiple times if multiple cycles requested
      for (let j = 0; j < cycles; j++) {
        console.log(`\nCONTRACT DEPLOY CYCLE ${j + 1}/${cycles} | ${walletShort}`);
        const tokenName = await askQuestion("Enter the token name (e.g., Thog Token): ");
        const tokenSymbol = await askQuestion("Enter the token symbol (e.g., THOG): ");

        if (!tokenName || !tokenSymbol) {
          console.log("Invalid token name or symbol. Using defaults: 'Test Token' and 'TEST'");
          const deployResult = await deployContract(wallet, "Test Token", "TEST", abi, bytecode);
          
          // Check result
          if (!deployResult || (deployResult.deployed === false)) {
            console.log("Deployment failed, skipping to next cycle...");
            continue;
          }
        } else {
          await deployContract(wallet, tokenName, tokenSymbol, abi, bytecode);
        }

        // Add small delay between cycles
        if (j < cycles - 1) {
          const delay = Math.floor(Math.random() * 3) + 4;
          console.log(`Waiting ${delay} seconds before next deployment...`);
          await new Promise(r => setTimeout(r, delay * 1000));
        }
      }

      // Add delay between accounts
      if (i < privateKeys.length - 1) {
        const delay = Math.floor(Math.random() * 3) + 4;
        console.log(`Waiting ${delay} seconds before next account...`);
        await new Promise(r => setTimeout(r, delay * 1000));
      }
    } catch (error) {
      // Handle any unexpected errors without breaking the loop
      console.log(`Error processing account ${i+1}: ${error.message}`);
      console.log("Continuing with next account...");
    }
  }

  console.log("ALL DEPLOYMENTS COMPLETED");
  return { success: true };
}

// Main function to start the deploy process
export async function run() {
  console.log("DEPLOY CONTRACT - MONAD TESTNET");
  console.log("This tool helps you deploy a simple counter contract to Monad testnet");
  console.log("------------------------------------------------------------");

  try {
    // Load private keys from file
    const privateKeys = loadPrivateKeys("pvkey.txt");
    
    // Check if we have private keys
    if (!privateKeys || privateKeys.length === 0) {
      console.log("No private keys found in pvkey.txt file.");
      console.log("Please provide a private key manually:");
      
      const manualKey = await askQuestion("Enter private key (without 0x prefix): ");
      if (!manualKey || manualKey.trim().length === 0) {
        console.log("No private key provided. Cannot proceed with deployment.");
        rl.close();
        return { success: false, reason: "no_private_key" };
      }
      
      // Normalize the manually entered key
      const normalizedKey = manualKey.trim().startsWith("0x") ? manualKey.trim() : `0x${manualKey.trim()}`;
      privateKeys.push(normalizedKey);
    }

    console.log(`Accounts loaded: ${privateKeys.length}`);
    
    // Get number of cycles from user
    let cycles = 1;
    const cycleInput = await askQuestion("Enter number of deployment cycles per account (default 1): ");
    if (cycleInput.trim() && !isNaN(cycleInput)) {
      cycles = parseInt(cycleInput);
      if (cycles <= 0) cycles = 1;
      if (cycles > 10) {
        console.log("High number of cycles detected. Limiting to 10 to prevent API rate limits.");
        cycles = 10;
      }
    }

    // Run deployment cycles
    const result = await runDeployCycle(cycles, privateKeys);
    rl.close();
    return result;
  } catch (error) {
    // Catch-all for any unexpected errors
    console.log(`An unexpected error occurred: ${error.message}`);
    console.log("Please try again later or contact support if the issue persists.");
    rl.close();
    
    // Return object with information but don't throw
    return { 
      success: false, 
      reason: "unexpected_error", 
      message: error.message
    };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
