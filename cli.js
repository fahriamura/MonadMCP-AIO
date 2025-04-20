import { run as swapRun } from './scripts/uniswap.js';

// Function to parse the input command
function parseCommand(input) {
  const regex = /tolong swap (\d+(?:\.\d+)?) MON ke (0x[a-fA-F0-9]{40})/;
  const match = input.match(regex);
  if (match) {
    const amount = parseFloat(match[1]);
    const contractAddress = match[2];
    return { amount, contractAddress };
  }
  throw new Error('Invalid command format.');
}

// Main function to execute the command
async function main() {
  const input = process.argv.slice(2).join(' ');
  try {
    const { amount, contractAddress } = parseCommand(input);
    console.log(`Executing swap: ${amount} MON to ${contractAddress}`);
    await swapRun(contractAddress, amount);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main(); 