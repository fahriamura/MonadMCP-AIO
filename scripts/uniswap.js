import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";
import readlineSync from "readline-sync"; // Used for user input
dotenv.config();

// Constants
const RPC_URLS = [
    "https://testnet-rpc.monad.xyz",
];
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";
const ROUTER_ADDRESS = "0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89";
const WETH = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";

// ERC20 ABI and Router ABI as before
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function balanceOf(address account) public view returns (uint256)"
];
const ROUTER_ABI = [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory)"
];

async function connectRPC() {
    for (let url of RPC_URLS) {
        try {
            console.log(`🧪 Connecting to RPC: ${url}`);
            const provider = new ethers.JsonRpcProvider(url, {
                name: "Monad Testnet",
                chainId: 10143
            });
            const block = await provider.getBlockNumber();
            console.log(`🟢 Connected! Latest block: ${block}`);
            return provider;
        } catch (err) {
            console.log(`⚠️ Failed to connect to ${url}: ${err.message}`);
        }
    }
    throw new Error("❌ Cannot connect to any RPC");
}

function loadPrivateKeys() {
    try {
        console.log("🔐 Loading private keys...");
        const keys = fs.readFileSync("pvkey.txt", "utf-8")
            .split("\n").map(line => line.trim()).filter(Boolean);
        if (keys.length === 0) throw new Error("pvkey.txt is empty");
        console.log(`✅ Loaded ${keys.length} private key(s)`);
        return keys;
    } catch (err) {
        console.error("❌ Error loading private keys:", err.message);
        return [];
    }
}

async function approveToken(wallet, tokenAddress, amount) {
    console.log(`📝 Approving token ${tokenAddress} for ${wallet.address}`);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const balance = await token.balanceOf(wallet.address);
    console.log(`💰 Token Balance: ${ethers.formatUnits(balance)} required: ${ethers.formatUnits(amount)}`);

    if (balance < amount) {
        console.log(`✘ Not enough balance: ${ethers.formatUnits(balance)} < ${ethers.formatUnits(amount)}`);
        return;
    }

    try {
        const tx = await token.approve(ROUTER_ADDRESS, amount);
        console.log(`🔗 Approve TX sent: ${EXPLORER_URL}${tx.hash}`);
        await tx.wait();
        console.log("✅ Token approved!");
    } catch (err) {
        console.error("❌ Approve failed:", err.message);
    }
}

async function swapETHtoToken(wallet, tokenAddress, ethAmount) {
    console.log(`🔁 Swapping ETH → ${tokenAddress} for ${wallet.address}`);
    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
    const path = [WETH, tokenAddress];
    const deadline = Math.floor(Date.now() / 1000) + 600;

    // Ensure ETH amount is rounded to 18 decimals
    const ethAmountParsed = ethers.parseEther(ethAmount.toFixed(18)); // Round to 18 decimals

    try {
        console.log(`📤 Sending ${ethers.formatEther(ethAmountParsed)} ETH`);
        const tx = await router.swapExactETHForTokens(
            0, path, wallet.address, deadline,
            { value: ethAmountParsed, gasLimit: 300000 }
        );
        console.log(`⏳ Waiting for TX: ${EXPLORER_URL}${tx.hash}`);
        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log("✅ Swap successful!");
        } else {
            console.log("❌ Swap failed at confirmation");
        }
    } catch (err) {
        console.error(`❌ Swap error: ${err.message}`);
    }
}

export async function run(tokenAddress, ethAmount) {
    const provider = await connectRPC();
    const privateKeys = loadPrivateKeys();

    for (const key of privateKeys) {
        const wallet = new ethers.Wallet(key, provider);

        console.log("\n=========================================");
        console.log(`🔓 Wallet: ${wallet.address}`);

        console.log(`💸 Swapping ${ethAmount} ETH for token at address ${tokenAddress}`);

        try {
            await swapETHtoToken(wallet, tokenAddress, ethAmount);
        } catch (err) {
            console.error(`🚫 Swap process failed for ${wallet.address}: ${err.message}`);
        }

        const delay = Math.floor(Math.random() * (180000 - 60000) + 60000);
        console.log(`🕒 Waiting for ${Math.floor(delay / 1000)} seconds before next wallet...\n`);
        await new Promise(r => setTimeout(r, delay));
    }

    console.log("🏁 All wallets processed.");
}
