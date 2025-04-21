# Monad MCP AIO Tutorial

## What is MCP?

The Model Context Protocol (MCP) is a standard that allows AI models to interact with external tools and services. 

In this tutorial, we're creating an MCP server that allows MCP Client (Claude Desktop) to query Monad testnet to check MON balance of an account, perform swaps, send transactions, and other useful functions.

## About Monad MCP AIO

Monad MCP AIO (All-In-One) is a comprehensive tool for interacting with the Monad blockchain testnet through a user-friendly AI interface. This tool allows you to:

- View wallet balances and addresses
- Send MON tokens to specific addresses
- Swap MON for other tokens via Uniswap
- Deploy smart contracts
- Analyze tokens and wallet addresses
- Check Twitter username history
- And more!

All these interactions happen directly through Claude Desktop using the MCP protocol.

## Prerequisites

- Node.js (v16 or later)
- `npm` or `yarn`
- Claude Desktop
- A valid `pvkey.txt` file containing your Monad private keys

## Getting Started

1. Clone this repository

```shell
git clone https://github.com/fahriamura/MonadMCP-AIO
```

2. Install dependencies:

```
npm install
```

3. Make sure to create a `pvkey.txt` file in the root directory containing your private keys (one per line).

## Building the MCP server

Monad Testnet related configuration is already added to `main.js`.

### Adding the MCP server to Claude Desktop

1. Open "Claude Desktop"

![claude desktop](/static/1.png)

2. Open Settings

Claude > Settings > Developer

![claude settings](/static/claude_settings.gif)

3. Open `claude_desktop_config.json` 

![claude config](/static/config.gif)

4. Add details about the MCP server and save the file.

```json
{
  "mcpServers": {
    "Monad-MCP": {
      "command": "node",
      "args": [
        "/<path-to-project>/main.js"
      ],
      "env": {
        "RPC_URL": "https://testnet-rpc.monad.xyz"
      }
    }
  }
}
```

5. Restart "Claude Desktop"

### Using the MCP server

Here's the final result

![final result](/static/final_result.gif)

## Available Commands

Here are the commands you can use with Monad MCP AIO:

### Viewing Wallet Addresses

To view your wallet addresses and balances:
```
view my addresses
```

### Sending MON

To send MON to a specific address:
```
send 1 MON to 0xYOUR_ADDRESS_HERE
```
or
```
kirim 2 MON ke 0xYOUR_ADDRESS_HERE
```

### Swapping MON

To swap MON for tokens:
```
swap 1 MON to 0xTOKEN_CONTRACT_ADDRESS
```
or
```
tukar 2 MON ke 0xTOKEN_CONTRACT_ADDRESS
```

### Token Analysis

To analyze a token's safety, holders, and other metrics:
```
analyze token 0xTOKEN_CONTRACT_ADDRESS
```

### Address/Wallet Analysis

To analyze a wallet address:
```
analyze address 0xWALLET_ADDRESS
```

### Twitter Username Check

To check Twitter username history:
```
check twitter USERNAME
```

### aPriori Staking

To use the aPriori staking feature:
```
apriori stake
```

### Deploy Contract

To deploy a new contract:
```
deploy contract
```

### Send Random Transactions

To send random transactions:
```
send random tx
```

## Configuration

- `pvkey.txt` - Place your private keys here (one per line)
- `address.txt` - Can be used to store recipient addresses for batch transactions

## Security Notice

- Never share your private keys
- Use this tool only with testnet funds
- Review all transactions before confirming

## Troubleshooting

If you encounter any issues:
1. Check that your private keys are correctly formatted in `pvkey.txt`
2. Verify you have sufficient MON balance for transactions
3. Ensure the addresses you're interacting with are valid
4. Restart Claude Desktop and the MCP server if needed

## Contributing

Feel free to contribute to this project by opening issues or submitting pull requests.

---

Created by fahriamura - https://github.com/fahriamura/MonadMCP-AIO
