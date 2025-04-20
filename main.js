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
// Debug: Output the current directory and scripts folder
console.log(chalk.green("Current Directory:", __dirname));
console.log(chalk.green("Scripts Folder:", path.join(__dirname, 'scripts')));

const BORDER_WIDTH = 80;

// Fungsi banner atas
function printBorder(text, color = chalk.cyan, width = BORDER_WIDTH) {
  text = text.trim();
  if (text.length > width - 4) {
    text = text.slice(0, width - 7) + "...";
  }
  const paddedText = ` ${text} `.padStart(((width - 2) + text.length + 2) / 2).padEnd(width - 2);
  console.log(color(`┌${"─".repeat(width - 2)}┐`));
  console.log(color(`│${paddedText}│`));
  console.log(color(`└${"─".repeat(width - 2)}┘`));
}

function printBanner() {
  console.log(chalk.green("═".repeat(BORDER_WIDTH)));
  printBorder("MONAD TESTNET", chalk.green);
  console.log(chalk.green("═".repeat(BORDER_WIDTH)));
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
    { name: "5. Exit", value: "exit" }
  ];
}

// Simulasi get_quote
function getQuote() {
  console.log(chalk.gray("💬 Quote: 'Your only limit is your mind.'")); // Bisa ganti ke quotes API
}
// Log the contents of the 'scripts' directory
// Log the contents of the 'scripts' directory
function logScriptsDirectory() {
  // For Windows, we need to fix the URL pathname format
  let currentDir = path.dirname(new URL(import.meta.url).pathname);
  
  // Fix Windows paths by removing the leading slash from drive letters
  if (os.platform() === "win32") {
    currentDir = currentDir.replace(/^\/(\w:)/, "$1");
  }
  
  const scriptsDir = path.join(currentDir, 'scripts');
  console.log(chalk.green(`Checking scripts directory: ${scriptsDir}`));
  
  if (fs.existsSync(scriptsDir)) {
    const files = fs.readdirSync(scriptsDir);
    console.log(chalk.green("Scripts Folder Contents:"));
    files.forEach(file => {
      console.log(chalk.cyan(`- ${file}`));
    });
  } else {
    console.log(chalk.red(`Scripts directory not found: ${scriptsDir}`));
    console.log(chalk.yellow("Current directory contents:"));
    const currentDirFiles = fs.readdirSync(currentDir);
    currentDirFiles.forEach(file => {
      console.log(chalk.gray(`- ${file}`));
    });
  }
}

// Call this function to log the contents of the 'scripts' directory
logScriptsDirectory();

// Call this function to log the contents of the 'scripts' directory
logScriptsDirectory();


async function runScript(moduleName) {
  // Fix directory path handling for Windows
  let currentDir = path.dirname(new URL(import.meta.url).pathname);
  
  // Fix Windows paths
  if (os.platform() === "win32") {
    currentDir = currentDir.replace(/^\/(\w:)/, "$1");
  }
  
  const scriptsDir = path.join(currentDir, 'scripts');
  const modulePath = path.join(scriptsDir, `${moduleName}.js`);
  
  console.log(chalk.yellow("Module Path:", modulePath));

  try {
    if (fs.existsSync(modulePath)) {
      const scriptModule = await import(`file://${modulePath}`);
      if (typeof scriptModule.run === "function") {
        await scriptModule.run();
      } else {
        console.log(chalk.red("No 'run' function exported in script."));
      }
    } else {
      console.log(chalk.red(`Script not found: ${moduleName}.js`));
      throw new Error(`Script not found: ${moduleName}`);
    }
  } catch (err) {
    console.error(chalk.red("Error loading the script:", err.message));
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
      /exchange (\d+(?:\.\d+)?) MON for (0x[a-fA-F0-9]{40})/i
    ];

    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (match) {
        const amount = parseFloat(match[1]);
        const contractAddress = match[2];
        console.log(`Executing swap: ${amount} MON to ${contractAddress}`);
        await swapRun(contractAddress, amount);
        return { content: [{ type: 'text', text: `Swap executed: ${amount} MON to ${contractAddress}` }] };
      }
    }
    throw new Error('Could not understand the command. Please specify the amount and contract address.');
  }
);

// Start the server
async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

startServer().catch(console.error);

async function main() {
  clearConsole();
  printBanner();
  
  // Log the scripts directory contents
  logScriptsDirectory();

  while (true) {
    clearConsole();
    printBanner();
    getQuote();
    printBorder("MAIN MENU", chalk.yellow);

    const availableScripts = getAvailableScripts();
    const answer = await inquirer.prompt([{
      type: "list",
      name: "script",
      message: chalk.cyan("Select script to run"),
      choices: availableScripts.map(s => s.name),
      loop: true
    }]);

    const selectedScript = availableScripts.find(s => s.name === answer.script);
    if (selectedScript.value === "exit") {
      console.log(chalk.green("═".repeat(BORDER_WIDTH)));
      printBorder("EXITING", chalk.green);
      console.log(chalk.yellow("👋 Goodbye!".padStart(44).padEnd(76)));
      console.log(chalk.green("═".repeat(BORDER_WIDTH)));
      process.exit(0);
    }

    try {
      console.log(chalk.cyan("═".repeat(BORDER_WIDTH)));
      printBorder(`RUNNING: ${answer.script}`, chalk.cyan);
      await runScript(selectedScript.value);
      console.log(chalk.green("═".repeat(BORDER_WIDTH)));
      printBorder(`Completed ${answer.script}`, chalk.green);
      await inquirer.prompt([{ type: "input", name: "pause", message: chalk.yellow("⏎ Press Enter to continue...") }]);
    } catch (err) {
      console.log(chalk.red("═".repeat(BORDER_WIDTH)));
      printBorder(`Error: ${err.message}`, chalk.red);
      await inquirer.prompt([{ type: "input", name: "pause", message: chalk.yellow("⏎ Press Enter to continue...") }]);
    }
  }
}

main();
