import fs from 'fs';
import { ethers } from 'ethers';
import readline from 'readline';
import solc from 'solc';

// Constants
const RPC_URL = "https://testnet-rpc.monad.xyz";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";

const provider = new ethers.JsonRpcProvider(RPC_URL);

// Read private keys
function loadPrivateKeys(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const keys = content.split("\n").map(line => line.trim()).filter(Boolean);
    if (keys.length === 0) throw new Error("pvkey.txt is empty");
    return keys;
  } catch (err) {
    console.log("❌ Error reading pvkey.txt:", err.message);
    return null;
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
  console.log("🔸 Compiling...");
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
  const contract = output.contracts["Counter.sol"]["Counter"];
  return {
    abi: contract.abi,
    bytecode: contract.evm.bytecode.object
  };
}

// Deploy contract
async function deployContract(wallet, tokenName, tokenSymbol, abi, bytecode) {
  try {
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    console.log("📦 Deploying contract...");
    const contract = await factory.deploy();
    console.log("🚀 Tx Hash:", EXPLORER_URL + contract.deploymentTransaction().hash);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    console.log("✔ Contract deployed!");
    console.log("📌 Address:", address);
    return address;
  } catch (err) {
    console.log("❌ Deploy failed:", err.message);
    return null;
  }
}

// Deploy loop
async function runDeployCycle(cycles, privateKeys) {
  const { abi, bytecode } = compileContract();

  for (let i = 0; i < privateKeys.length; i++) {
    const wallet = new ethers.Wallet(privateKeys[i], provider);
    const walletShort = wallet.address.slice(0, 8) + "...";
    console.log(`\n🏦 ACCOUNT ${i + 1}/${privateKeys.length} | ${walletShort}`);

    for (let j = 0; j < cycles; j++) {
      console.log(`\n🔄 CONTRACT DEPLOY CYCLE ${j + 1}/${cycles} | ${walletShort}`);
      const tokenName = await askQuestion("➤ Enter the token name (e.g., Thog Token): ");
      const tokenSymbol = await askQuestion("➤ Enter the token symbol (e.g., THOG): ");

      if (!tokenName || !tokenSymbol) {
        console.log("❌ Invalid token name or symbol!");
        continue;
      }

      await deployContract(wallet, tokenName, tokenSymbol, abi, bytecode);

      if (j < cycles - 1) {
        const delay = Math.floor(Math.random() * 3) + 4;
        console.log(`⏳ Waiting ${delay} seconds...`);
        await new Promise(r => setTimeout(r, delay * 1000));
      }
    }

    if (i < privateKeys.length - 1) {
      const delay = Math.floor(Math.random() * 3) + 4;
      console.log(`⏳ Waiting ${delay} seconds before next account...`);
      await new Promise(r => setTimeout(r, delay * 1000));
    }
  }

  console.log("✅ ALL DONE");
  rl.close();
}

// Main function to start the deploy process
export async function run() {
  console.log("DEPLOY CONTRACT - MONAD TESTNET");

  const privateKeys = loadPrivateKeys("pvkey.txt");
  if (!privateKeys) {
    rl.close();
    return;
  }

  console.log(`👥 Accounts: ${privateKeys.length}`);
  let cycles = 5;
  const cycleInput = await askQuestion("➤ Enter number of cycles (default 5): ");
  if (cycleInput.trim() && !isNaN(cycleInput)) {
    cycles = parseInt(cycleInput);
  }

  await runDeployCycle(cycles, privateKeys);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
