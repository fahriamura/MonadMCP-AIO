import { ethers } from "ethers";
import fs from "fs";
import axios from "axios";

// Constants
const RPC_URLS = [
  "https://testnet-rpc.monad.xyz/",
  "https://rpc.ankr.com/monad_testnet",
  "https://monad-testnet-rpc.dwellir.com"
];
const EXPLORER_URL = "https://testnet.monadexplorer.com/address/";
const EXPLORER_API_URL = "https://testnet.monadexplorer.com/api";

// Blockvision API
const BLOCKVISION_API_BASE = "https://monad-api.blockvision.org/testnet/api";

// API Request Headers
const API_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  "origin": "https://testnet.monadexplorer.com",
  "pragma": "no-cache",
  "referer": "https://testnet.monadexplorer.com/",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  "x-api-signature": "1e0bfe62dc319a76142dc8a23655f8e8",
  "x-api-timestamp": Math.floor(Date.now() / 1000).toString(),
  "x-app-id": "14087b7d0ddf1a0db952e45855f0600a",
  "x-visitor-id": "c2d9193d-43e5-41b2-a3b0-f2a9834c5249"
};

// ERC20 & ERC721 interfaces for detection (as fallback)
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)"
];

const ERC721_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function tokenOfOwnerByIndex(address,uint256) view returns (uint256)",
  "function tokenURI(uint256) view returns (string)"
];

// Connect to provider with fallback support
async function connectProvider() {
  let lastError = null;
  
  for (const url of RPC_URLS) {
    try {
      console.log(`Trying to connect to: ${url}`);
      const provider = new ethers.JsonRpcProvider(url);
      await provider.getBlockNumber(); // Test connection
      console.log(`Connected to network at ${url}`);
      return provider;
    } catch (error) {
      console.error(`Failed to connect to ${url}: ${error.message}`);
      lastError = error;
    }
  }
  
  throw new Error(`Failed to connect to any RPC endpoint: ${lastError?.message || "Unknown error"}`);
}

// Get token balances directly from Blockvision API
async function getTokenBalancesFromAPI(address) {
  try {
    console.log(`Fetching token balances for ${address} from API`);
    
    const url = `${BLOCKVISION_API_BASE}/account/tokenPortfolio?address=${address}`;
    const response = await axios.get(url, { headers: API_HEADERS });
    
    if (!response.data || !response.data.data) {
      console.log("API returned empty data for token portfolio");
      return [];
    }
    
    const tokens = response.data.data.map(token => ({
      address: token.contract,
      name: token.name || "Unknown",
      symbol: token.symbol || "Unknown",
      balance: token.balance || "0",
      decimals: token.decimals || 18,
      price: token.price || 0,
      value: token.value || 0
    }));
    
    console.log(`Found ${tokens.length} tokens`);
    return tokens;
  } catch (error) {
    console.error(`Error fetching token balances from API: ${error.message}`);
    console.log("Falling back to on-chain detection...");
    
    // Fallback to default implementation
    return await getTokenBalancesFromChain(address);
  }
}

// Fallback method for token detection using on-chain calls
async function getTokenBalancesFromChain(address) {
  try {
    console.log(`Detecting tokens on-chain for ${address}`);
    
    const provider = await connectProvider();
    
    // List of common tokens on Monad testnet
    const knownTokens = [
      {
        address: "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701", // WMONAD
        name: "Wrapped MONAD",
        symbol: "WMONAD",
        decimals: 18
      },
      {
        address: "0xb2f82D0f38dc453D596Ad40A37799446Cc89274A", // aprMONAD
        name: "aPriori MONAD",
        symbol: "aprMONAD",
        decimals: 18
      }
    ];
    
    const tokenBalances = [];
    
    // Check balance for each known token
    for (const token of knownTokens) {
      try {
        const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
        const balance = await contract.balanceOf(address);
        
        if (balance > 0) {
          tokenBalances.push({
            address: token.address,
            name: token.name,
            symbol: token.symbol,
            balance: ethers.formatUnits(balance, token.decimals),
            decimals: token.decimals
          });
        }
      } catch (error) {
        console.log(`Error checking balance for token ${token.address}: ${error.message}`);
      }
    }
    
    return tokenBalances;
  } catch (error) {
    console.error(`Error detecting tokens: ${error.message}`);
    return [];
  }
}

// Get NFT balances directly from Blockvision API
async function getNFTBalancesFromAPI(address) {
  try {
    console.log(`Fetching NFT balances for ${address} from API`);
    
    const url = `${BLOCKVISION_API_BASE}/account/nfts?address=${address}&pageSize=100&pageIndex=1&verified=true&unknown=false`;
    const response = await axios.get(url, { headers: API_HEADERS });
    
    if (!response.data || !response.data.data || !response.data.data.list) {
      console.log("API returned empty data for NFTs");
      return [];
    }
    
    const nfts = response.data.data.list.map(nft => ({
      collectionAddress: nft.contract,
      collectionName: nft.collectionName || "Unknown Collection",
      name: nft.name || "Unnamed NFT",
      tokenId: nft.tokenId,
      tokenUri: nft.tokenUri || "",
      image: nft.image || "",
      description: nft.description || "",
      attributes: nft.attributes || []
    }));
    
    // Group NFTs by collection
    const nftCollections = {};
    for (const nft of nfts) {
      if (!nftCollections[nft.collectionAddress]) {
        nftCollections[nft.collectionAddress] = {
          address: nft.collectionAddress,
          name: nft.collectionName,
          tokens: []
        };
      }
      
      nftCollections[nft.collectionAddress].tokens.push({
        tokenId: nft.tokenId,
        name: nft.name,
        image: nft.image,
        tokenUri: nft.tokenUri
      });
    }
    
    console.log(`Found ${nfts.length} NFTs across ${Object.keys(nftCollections).length} collections`);
    return Object.values(nftCollections);
  } catch (error) {
    console.error(`Error fetching NFT balances from API: ${error.message}`);
    console.log("Falling back to on-chain detection...");
    
    // This would be the fallback NFT detection method
    return [];
  }
}

// Get transaction history from Blockvision API
async function getTransactionHistoryFromAPI(address, provider) {
  try {
    console.log(`Fetching transaction history for ${address} from API`);
    
    const url = `${BLOCKVISION_API_BASE}/account/transactions?address=${address}&filter=all`;
    const response = await axios.get(url, { headers: API_HEADERS });
    
    if (!response.data || !response.data.data || !response.data.data.list) {
      console.log("API returned empty data for transactions");
      return await getTransactionHistoryFromChain(address, provider);
    }
    
    const apiTransactions = response.data.data.list;
    const transactions = [];
    
    // Get current block number to calculate timestamps
    const currentBlock = await provider.getBlockNumber();
    const latestBlock = await provider.getBlock(currentBlock);
    const latestBlockTimestamp = latestBlock.timestamp;
    
    let firstTxTimestamp = null;
    
    for (const tx of apiTransactions) {
      // Determine tx type based on from address
      const txType = tx.from.toLowerCase() === address.toLowerCase() ? "out" : "in";
      
      transactions.push({
        hash: tx.hash,
        blockNumber: tx.blockNumber,
        timestamp: tx.timestamp,
        from: tx.from,
        to: tx.to,
        value: ethers.formatEther(tx.value || "0"),
        gas: tx.gas || "0",
        gasUsed: tx.gasUsed || "0",
        status: tx.status === 1 ? "success" : "failed",
        type: txType,
        method: tx.methodName || "Unknown"
      });
      
      // Track earliest transaction
      if (!firstTxTimestamp || tx.timestamp < firstTxTimestamp) {
        firstTxTimestamp = tx.timestamp;
      }
    }
    
    // Calculate first activity and account age
    let firstActivity = "Unknown";
    let accountAge = "Unknown";
    
    if (firstTxTimestamp) {
      const firstDate = new Date(firstTxTimestamp * 1000);
      firstActivity = firstDate.toISOString().split('T')[0];
      
      const ageInSeconds = latestBlockTimestamp - firstTxTimestamp;
      const ageInDays = Math.floor(ageInSeconds / (60 * 60 * 24));
      accountAge = `${ageInDays} days`;
    }
    
    // Calculate activity metrics
    const txCount = transactions.length;
    const sentTxCount = transactions.filter(tx => tx.type === "out").length;
    const receivedTxCount = transactions.filter(tx => tx.type === "in").length;
    
    // Calculate activity level based on transaction frequency
    let activityLevel = "Unknown";
    if (txCount === 0) {
      activityLevel = "Inactive";
    } else if (txCount < 5) {
      activityLevel = "Low";
    } else if (txCount < 20) {
      activityLevel = "Medium";
    } else {
      activityLevel = "High";
    }
    
    // Return transaction data and metrics
    return {
      transactions: transactions, // Return all transactions
      metrics: {
        totalTransactions: txCount,
        sentTransactions: sentTxCount,
        receivedTransactions: receivedTxCount,
        firstActivity,
        accountAge,
        activityLevel
      }
    };
  } catch (error) {
    console.error(`Error fetching transaction history from API: ${error.message}`);
    console.log("Falling back to on-chain scanning...");
    
    // Fallback to chain scanning method
    return await getTransactionHistoryFromChain(address, provider);
  }
}

// Fallback method to get transaction history by scanning blocks
async function getTransactionHistoryFromChain(address, provider) {
  try {
    console.log(`Scanning blockchain for transactions of ${address}`);
    
    // Get current block number to calculate timestamps
    const currentBlock = await provider.getBlockNumber();
    const latestBlock = await provider.getBlock(currentBlock);
    const latestBlockTimestamp = latestBlock.timestamp;
    
    // For simplicity, we'll scan the last 10,000 blocks
    const scanDepth = 10000;
    const startBlock = Math.max(0, currentBlock - scanDepth);
    
    console.log(`Scanning from block ${startBlock} to ${currentBlock}`);
    
    const transactions = [];
    let firstTxTimestamp = null;
    
    // This is computationally intensive, so we'll use a sampling approach
    // In a production app, you would use an indexer service
    const sampleSize = 100;
    const step = Math.floor(scanDepth / sampleSize);
    
    for (let i = 0; i < sampleSize; i++) {
      const blockNumber = startBlock + (i * step);
      try {
        const block = await provider.getBlock(blockNumber, true);
        if (!block || !block.transactions) continue;
        
        // Find transactions involving our address
        const relevantTxs = block.transactions.filter(tx => 
          tx.from?.toLowerCase() === address.toLowerCase() || 
          tx.to?.toLowerCase() === address.toLowerCase()
        );
        
        for (const tx of relevantTxs) {
          // Get more details about the transaction
          const receipt = await provider.getTransactionReceipt(tx.hash);
          
          // Determine tx type
          const txType = tx.from.toLowerCase() === address.toLowerCase() ? "out" : "in";
          
          transactions.push({
            hash: tx.hash,
            blockNumber: tx.blockNumber,
            timestamp: block.timestamp,
            from: tx.from,
            to: tx.to,
            value: ethers.formatEther(tx.value),
            gas: tx.gasLimit.toString(),
            gasUsed: receipt?.gasUsed?.toString() || "unknown",
            status: receipt?.status === 1 ? "success" : "failed",
            type: txType
          });
          
          // Track earliest transaction
          if (!firstTxTimestamp || block.timestamp < firstTxTimestamp) {
            firstTxTimestamp = block.timestamp;
          }
        }
      } catch (error) {
        console.log(`Error scanning block ${blockNumber}: ${error.message}`);
      }
    }
    
    // Sort transactions by block number (descending)
    transactions.sort((a, b) => b.blockNumber - a.blockNumber);
    
    // Calculate first activity and account age
    let firstActivity = "Unknown";
    let accountAge = "Unknown";
    
    if (firstTxTimestamp) {
      const firstDate = new Date(firstTxTimestamp * 1000);
      firstActivity = firstDate.toISOString().split('T')[0];
      
      const ageInSeconds = latestBlockTimestamp - firstTxTimestamp;
      const ageInDays = Math.floor(ageInSeconds / (60 * 60 * 24));
      accountAge = `${ageInDays} days`;
    }
    
    // Calculate activity metrics
    const txCount = transactions.length;
    const sentTxCount = transactions.filter(tx => tx.type === "out").length;
    const receivedTxCount = transactions.filter(tx => tx.type === "in").length;
    
    // Calculate activity level based on transaction frequency
    let activityLevel = "Unknown";
    if (txCount === 0) {
      activityLevel = "Inactive";
    } else if (txCount < 5) {
      activityLevel = "Low";
    } else if (txCount < 20) {
      activityLevel = "Medium";
    } else {
      activityLevel = "High";
    }
    
    // Return transaction data and metrics
    return {
      transactions: transactions.slice(0, 20), // Return only the 20 most recent transactions
      metrics: {
        totalTransactions: txCount,
        sentTransactions: sentTxCount,
        receivedTransactions: receivedTxCount,
        firstActivity,
        accountAge,
        activityLevel
      }
    };
  } catch (error) {
    console.error(`Error getting transaction history: ${error.message}`);
    return {
      transactions: [],
      metrics: {
        totalTransactions: 0,
        sentTransactions: 0,
        receivedTransactions: 0,
        firstActivity: "Unknown",
        accountAge: "Unknown",
        activityLevel: "Unknown"
      }
    };
  }
}

// Analyze wallet activity patterns
function analyzeActivityPatterns(transactionHistory) {
  try {
    console.log("Analyzing activity patterns");
    
    const { transactions, metrics } = transactionHistory;
    
    // Set default values in case of insufficient data
    let activityInsights = {
      patternType: "Unknown",
      frequency: "Unknown",
      averageTransactionValue: "Unknown",
      largestTransaction: "Unknown",
      mostRecentActivity: "Unknown",
      activeHours: "Unknown",
      consistencyScore: "Unknown",
      description: "Insufficient data to analyze activity patterns"
    };
    
    // Only proceed with analysis if we have enough transactions
    if (transactions.length === 0) {
      return activityInsights;
    }
    
    // Calculate average transaction value
    const txValues = transactions.map(tx => parseFloat(tx.value) || 0);
    const averageValue = txValues.reduce((sum, val) => sum + val, 0) / txValues.length;
    
    // Find largest transaction
    const largestTx = transactions.reduce((max, tx) => 
      parseFloat(tx.value) > parseFloat(max.value) ? tx : max, 
      { value: "0" }
    );
    
    // Calculate most recent activity
    const latestTx = transactions[0]; // Already sorted by block number
    const latestDate = new Date(latestTx.timestamp * 1000);
    const now = new Date();
    const daysSinceLastActivity = Math.floor((now - latestDate) / (1000 * 60 * 60 * 24));
    
    // Calculate transaction frequency (per week)
    let frequency = "Unknown";
    if (metrics.accountAge !== "Unknown") {
      const ageInDays = parseInt(metrics.accountAge.split(' ')[0]);
      if (ageInDays > 0) {
        const txPerWeek = (metrics.totalTransactions / ageInDays) * 7;
        
        if (txPerWeek < 1) {
          frequency = "Very Low";
        } else if (txPerWeek < 5) {
          frequency = "Low";
        } else if (txPerWeek < 20) {
          frequency = "Medium";
        } else if (txPerWeek < 50) {
          frequency = "High";
        } else {
          frequency = "Very High";
        }
      }
    }
    
    // Determine pattern type
    let patternType = "Casual User";
    
    // If there are more outgoing than incoming transactions by a significant margin
    if (metrics.sentTransactions > metrics.receivedTransactions * 2) {
      patternType = "Active Sender";
    } 
    // If there are more incoming than outgoing transactions by a significant margin
    else if (metrics.receivedTransactions > metrics.sentTransactions * 2) {
      patternType = "Passive Receiver";
    }
    // If transaction count is very high
    else if (metrics.totalTransactions > 50) {
      patternType = "Power User";
    }
    
    // Create a description based on the analysis
    let description = `This wallet shows a ${frequency.toLowerCase()} frequency of activity `;
    description += `with an average transaction value of ${averageValue.toFixed(4)} MONAD. `;
    
    if (daysSinceLastActivity <= 7) {
      description += "The wallet has been active recently. ";
    } else if (daysSinceLastActivity <= 30) {
      description += "The wallet has been moderately active in the past month. ";
    } else {
      description += "The wallet has not been active recently. ";
    }
    
    description += `Based on transaction patterns, this appears to be a ${patternType.toLowerCase()}.`;
    
    // Compile all insights
    activityInsights = {
      patternType,
      frequency,
      averageTransactionValue: averageValue.toFixed(6) + " MONAD",
      largestTransaction: largestTx.value + " MONAD",
      mostRecentActivity: daysSinceLastActivity + " days ago",
      consistencyScore: metrics.activityLevel,
      description
    };
    
    return activityInsights;
  } catch (error) {
    console.error(`Error analyzing activity patterns: ${error.message}`);
    return {
      patternType: "Unknown",
      frequency: "Unknown",
      averageTransactionValue: "Unknown",
      largestTransaction: "Unknown",
      mostRecentActivity: "Unknown",
      activeHours: "Unknown",
      consistencyScore: "Unknown",
      description: "Error analyzing activity patterns"
    };
  }
}

// Comprehensive wallet analysis
async function analyzeWallet(address, provider) {
  try {
    console.log(`Starting comprehensive analysis for wallet: ${address}`);
    
    // Get native balance
    const balance = await provider.getBalance(address);
    const nativeBalance = ethers.formatEther(balance);
    
    // Get transaction history
    const txHistory = await getTransactionHistoryFromAPI(address, provider);
    
    // Get token balances
    const tokens = await getTokenBalancesFromAPI(address);
    
    // Get NFT balances
    const nfts = await getNFTBalancesFromAPI(address);
    
    // Analyze activity patterns
    const activityAnalysis = analyzeActivityPatterns(txHistory);
    
    // Calculate estimated portfolio value
    let portfolioValue = parseFloat(nativeBalance);
    let portfolioBreakdown = [{ asset: "MONAD", value: parseFloat(nativeBalance), percentage: 100 }];
    
    // Add estimated value from tokens
    if (tokens.length > 0) {
      let tokenValue = 0;
      
      tokens.forEach(token => {
        const tokenValueInMON = parseFloat(token.value || 0);
        tokenValue += tokenValueInMON;
        
        // Add to breakdown
        if (tokenValueInMON > 0) {
          portfolioBreakdown.push({
            asset: token.symbol,
            value: tokenValueInMON,
            percentage: 0 // Will calculate percentages after
          });
        }
      });
      
      portfolioValue += tokenValue;
    }
    
    // Calculate percentages for portfolio breakdown
    if (portfolioValue > 0) {
      portfolioBreakdown = portfolioBreakdown.map(item => ({
        ...item,
        percentage: ((item.value / portfolioValue) * 100).toFixed(2)
      }));
    }
    
    // Generate comprehensive report
    const report = {
      address,
      explorerUrl: EXPLORER_URL + address,
      nativeBalance,
      portfolioValue: portfolioValue.toFixed(6) + " MONAD (estimated)",
      portfolioBreakdown,
      accountAge: txHistory.metrics.accountAge,
      firstActivity: txHistory.metrics.firstActivity,
      activityLevel: txHistory.metrics.activityLevel,
      tokens,
      nfts,
      recentTransactions: txHistory.transactions.slice(0, 10), // Show only 10 most recent
      transactionMetrics: txHistory.metrics,
      activityAnalysis,
      timestamp: new Date().toISOString()
    };
    
    // Save the report to a file
    const reportPath = `wallet_analysis_${address.slice(0, 8)}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Analysis complete. Report saved to ${reportPath}`);
    
    return report;
  } catch (error) {
    console.error(`Error analyzing wallet: ${error.message}`);
    return {
      address,
      error: error.message,
      status: "failed"
    };
  }
}

// Check if address is a contract
async function isContract(address, provider) {
  try {
    const code = await provider.getCode(address);
    return code !== '0x'; // If there's code, it's a contract
  } catch (error) {
    console.error(`Error checking if address is contract: ${error.message}`);
    return false;
  }
}

// Get addresses from private keys
function getAddressesFromPrivateKeys() {
  try {
    const filePath = 'pvkey.txt';
    if (!fs.existsSync(filePath)) {
      throw new Error(`Private key file ${filePath} not found`);
    }
    
    console.log("Reading private keys from pvkey.txt");
    const data = fs.readFileSync(filePath, 'utf-8').split('\n');
    const keys = data.map(k => k.trim()).filter(k => k.length === 64 || k.length === 66);
    
    if (!keys.length) {
      throw new Error("No valid private keys found");
    }
    
    // Convert private keys to addresses
    const addresses = [];
    for (const key of keys) {
      try {
        const privateKey = key.startsWith('0x') ? key : `0x${key}`;
        const wallet = new ethers.Wallet(privateKey);
        addresses.push(wallet.address);
      } catch (error) {
        console.error(`Error deriving address from private key: ${error.message}`);
      }
    }
    
    console.log(`Found ${addresses.length} addresses from private keys`);
    return addresses;
  } catch (error) {
    console.error(`Error getting addresses from private keys: ${error.message}`);
    return [];
  }
}

// Main function
export async function run(targetAddress = null) {
  try {
    console.log("Starting wallet analyzer...");
    
    const provider = await connectProvider();
    
    // If a specific address is provided, analyze it
    if (targetAddress) {
      console.log(`Analyzing specific address: ${targetAddress}`);
      try {
        // Check if the address is valid
        targetAddress = ethers.getAddress(targetAddress); // This normalizes the address
        
        // Check if it's a contract address
        const isContractAddress = await isContract(targetAddress, provider);
        if (isContractAddress) {
          console.log(`Address ${targetAddress} is a contract, not a wallet`);
          return {
            address: targetAddress,
            isContract: true,
            message: "This address belongs to a contract, not a user wallet",
            recommendation: "Use tokenAnalyzer.js to analyze this contract if it's a token"
          };
        }
        
        // Run full analysis
        return await analyzeWallet(targetAddress, provider);
      } catch (error) {
        console.error(`Error analyzing address ${targetAddress}: ${error.message}`);
        return {
          error: error.message,
          status: "failed"
        };
      }
    }
    
    // If no address is provided, try to load from private keys file and analyze
    const addresses = getAddressesFromPrivateKeys();
    
    if (addresses.length === 0) {
      return {
        error: "No wallet addresses found to analyze",
        status: "failed"
      };
    }
    
    // If only one address found, analyze it directly
    if (addresses.length === 1) {
      console.log(`Analyzing the only address from private keys: ${addresses[0]}`);
      return await analyzeWallet(addresses[0], provider);
    }
    
    // If multiple addresses found, analyze all of them
    console.log(`Found ${addresses.length} addresses, analyzing all...`);
    
    const walletAnalyses = [];
    for (const address of addresses) {
      try {
        console.log(`Analyzing wallet ${address}`);
        const analysis = await analyzeWallet(address, provider);
        walletAnalyses.push(analysis);
      } catch (error) {
        console.error(`Error analyzing wallet ${address}: ${error.message}`);
      }
    }
    
    console.log(`Completed analysis for ${walletAnalyses.length} wallet(s)`);
    return walletAnalyses;
  } catch (error) {
    console.error(`Wallet analyzer error: ${error.message}`);
    return {
      error: error.message,
      status: "failed"
    };
  }
}

export default run; 