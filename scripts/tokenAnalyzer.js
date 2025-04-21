import { ethers } from "ethers";
import axios from "axios";
import fs from "fs";

// Constants
const RPC_URLS = [
  "https://testnet-rpc.monad.xyz/",
  "https://rpc.ankr.com/monad_testnet",
  "https://monad-testnet-rpc.dwellir.com"
];
const EXPLORER_URL = "https://testnet.monadexplorer.com/token/";
const EXPLORER_API_URL = "https://testnet.monadexplorer.com/api";

// Blockvision API 
const BLOCKVISION_API_BASE = "https://monad-api.blockvision.org/testnet/api";
const UNISWAP_ROUTER = "0xCa810D095e90Daae6e867c19DF6D9A8C56db2c89";

// API Request Headers
const API_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9,id;q=0.8",
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

// ERC20 ABI for token interactions
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function getOwner() view returns (address)",
  "function allowance(address,address) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

// Connect to the Monad network
async function connectProvider() {
  let lastError = null;
  
  // Try each RPC URL in order
  for (const url of RPC_URLS) {
    try {
      console.log(`Trying to connect to RPC: ${url}`);
      const provider = new ethers.JsonRpcProvider(url);
      await provider.getBlockNumber(); // Test connection
      console.log(`Successfully connected to Monad network via ${url}`);
      return provider;
    } catch (error) {
      console.error(`Failed to connect to ${url}: ${error.message}`);
      lastError = error;
    }
  }
  
  // If we got here, all connection attempts failed
  throw new Error(`Failed to connect to any Monad RPC: ${lastError?.message || "Unknown error"}`);
}

// Get token information from Blockvision API
async function getTokenInfoFromAPI(tokenAddress) {
  try {
    console.log(`Fetching token information from API for ${tokenAddress}`);
    
    const url = `${BLOCKVISION_API_BASE}/token/info?address=${tokenAddress}`;
    const response = await axios.get(url, { headers: API_HEADERS });
    
    if (!response.data || !response.data.data) {
      console.log("API returned empty data for token information");
      return null;
    }
    
    const tokenData = response.data.data;
    
    return {
      address: tokenAddress,
      name: tokenData.name || "Unknown",
      symbol: tokenData.symbol || "Unknown",
      decimals: tokenData.decimals || 18,
      totalSupply: tokenData.totalSupply || "Unknown",
      owner: tokenData.owner || "Unknown",
      website: tokenData.website || null,
      social: tokenData.social || {},
      contractVerified: tokenData.contractVerified || false
    };
  } catch (error) {
    console.error(`Error fetching token info from API: ${error.message}`);
    console.log("Falling back to on-chain detection...");
    return null;
  }
}

// Get basic token information
async function getTokenInfo(tokenAddress, provider) {
  try {
    console.log(`Analyzing token: ${tokenAddress}`);
    
    // First check if the address is valid
    try {
      tokenAddress = ethers.getAddress(tokenAddress); // This will normalize the address and throw if invalid
    } catch (error) {
      console.error(`Invalid token address format: ${error.message}`);
      return {
        address: tokenAddress,
        name: "Invalid Address",
        symbol: "ERROR",
        decimals: 18,
        totalSupply: "0",
        owner: "Unknown",
        error: `Invalid address format: ${error.message}`
      };
    }
    
    // First try to get information from the API
    const apiInfo = await getTokenInfoFromAPI(tokenAddress);
    if (apiInfo) {
      return apiInfo;
    }
    
    // If API fails, fall back to contract calls
    
    // Check if there's code at the address (to verify it's a contract)
    const code = await provider.getCode(tokenAddress);
    if (code === '0x') {
      console.error(`No contract found at address ${tokenAddress}`);
      return {
        address: tokenAddress,
        name: "Not a Contract",
        symbol: "ERROR",
        decimals: 18,
        totalSupply: "0",
        owner: "Unknown",
        error: "No contract found at this address"
      };
    }
    
    // Try to initialize contract with ERC20 interface
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    // We'll use try/catch for each method separately to avoid one failed call causing the entire function to fail
    let name = "Unknown";
    try {
      name = await tokenContract.name();
    } catch (e) {
      console.log(`Could not retrieve token name: ${e.message}`);
    }
    
    let symbol = "Unknown";
    try {
      symbol = await tokenContract.symbol();
    } catch (e) {
      console.log(`Could not retrieve token symbol: ${e.message}`);
    }
    
    let decimals = 18;
    try {
      decimals = await tokenContract.decimals();
    } catch (e) {
      console.log(`Could not retrieve token decimals, defaulting to 18: ${e.message}`);
    }
    
    let totalSupply = "Unknown";
    try {
      const supply = await tokenContract.totalSupply();
      totalSupply = ethers.formatUnits(supply, decimals);
    } catch (e) {
      console.log(`Could not retrieve total supply: ${e.message}`);
    }
    
    // Try to get owner if function exists (some tokens have this)
    let owner = "Unknown";
    try {
      owner = await tokenContract.getOwner();
    } catch (e) {
      // Function doesn't exist or failed, ignore
    }
    
    // If we couldn't get basic information like name and symbol, this might not be an ERC20 token
    if (name === "Unknown" && symbol === "Unknown") {
      return {
        address: tokenAddress,
        name: "Not ERC20",
        symbol: "UNKNOWN",
        decimals,
        totalSupply,
        owner,
        error: "This contract does not implement the ERC20 standard interface"
      };
    }
    
    return {
      address: tokenAddress,
      name,
      symbol,
      decimals,
      totalSupply,
      owner
    };
  } catch (error) {
    console.error("Error getting token information:", error.message);
    return {
      address: tokenAddress,
      name: "Error",
      symbol: "ERROR",
      decimals: 18,
      totalSupply: "Error",
      owner: "Unknown",
      error: error.message
    };
  }
}

// Get token holders from API
async function getTopHoldersFromAPI(tokenAddress) {
  try {
    console.log(`Fetching top token holders from API for ${tokenAddress}`);
    
    const url = `${BLOCKVISION_API_BASE}/token/holders?address=${tokenAddress}&pageSize=10&pageIndex=1`;
    const response = await axios.get(url, { headers: API_HEADERS });
    
    if (!response.data || !response.data.data || !response.data.data.list) {
      console.log("API returned empty data for token holders");
      return null;
    }
    
    const holders = response.data.data.list.map(holder => ({
      address: holder.address,
      balance: holder.balance || "0",
      percentage: holder.percentage || "0",
      txCount: holder.txCount || 0
    }));
    
    return holders;
  } catch (error) {
    console.error(`Error fetching token holders from API: ${error.message}`);
    console.log("Falling back to on-chain detection...");
    return null;
  }
}

// Get top token holders
async function getTopHolders(tokenAddress, provider) {
  // First try to get data from API
  const apiHolders = await getTopHoldersFromAPI(tokenAddress);
  if (apiHolders) {
    return apiHolders;
  }
  
  // If API fails, fall back to on-chain method
  try {
    console.log("Fetching top token holders from on-chain events...");
    // Note: This is a simplified implementation. In practice, we would need to:
    // 1. Get transfer events from the token
    // 2. Track balances for all addresses
    // 3. Sort and return top holders
    
    const holders = [];
    
    // Get some recent transfer events to see active holders
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const filter = tokenContract.filters.Transfer();
    const events = await tokenContract.queryFilter(filter, -10000); // Last 10000 blocks
    
    // Count unique addresses and their transaction counts
    const addressCounts = {};
    for (const event of events) {
      const from = event.args[0];
      const to = event.args[1];
      
      if (from !== ethers.ZeroAddress) {
        addressCounts[from] = (addressCounts[from] || 0) + 1;
      }
      if (to !== ethers.ZeroAddress) {
        addressCounts[to] = (addressCounts[to] || 0) + 1;
      }
    }
    
    // Get balances for the most active addresses
    const addresses = Object.keys(addressCounts)
      .sort((a, b) => addressCounts[b] - addressCounts[a])
      .slice(0, 20); // Top 20 most active addresses
      
    for (const address of addresses) {
      try {
        const balance = await tokenContract.balanceOf(address);
        const decimals = await tokenContract.decimals();
        holders.push({
          address,
          balance: ethers.formatUnits(balance, decimals),
          txCount: addressCounts[address]
        });
      } catch (error) {
        console.log(`Error getting balance for ${address}: ${error.message}`);
      }
    }
    
    // Sort by balance
    holders.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));
    
    return holders.slice(0, 10); // Return top 10 holders by balance
  } catch (error) {
    console.error("Error analyzing token holders:", error.message);
    return [];
  }
}

// Get token transfers and volume from API
async function getVolumeFromAPI(tokenAddress) {
  try {
    console.log(`Fetching token volume data from API for ${tokenAddress}`);
    
    const url = `${BLOCKVISION_API_BASE}/token/transfers?address=${tokenAddress}&pageSize=100&pageIndex=1`;
    const response = await axios.get(url, { headers: API_HEADERS });
    
    if (!response.data || !response.data.data) {
      console.log("API returned empty data for token transfers");
      return null;
    }
    
    const transfersData = response.data.data;
    const transfers = transfersData.list || [];
    
    // Extract unique addresses from transfers
    const uniqueAddresses = new Set();
    let totalVolume = ethers.toBigInt(0);
    
    transfers.forEach(transfer => {
      uniqueAddresses.add(transfer.from);
      uniqueAddresses.add(transfer.to);
      
      // Add to volume if value is available
      if (transfer.value) {
        totalVolume += ethers.toBigInt(transfer.value);
      }
    });
    
    // Check if token has liquidity data
    let hasLiquidity = false;
    
    // Try to get liquidity info from another API call
    try {
      const liquidityUrl = `${BLOCKVISION_API_BASE}/token/pairs?address=${tokenAddress}&pageSize=5&pageIndex=1`;
      const liquidityResponse = await axios.get(liquidityUrl, { headers: API_HEADERS });
      
      if (liquidityResponse.data && liquidityResponse.data.data && liquidityResponse.data.data.list) {
        hasLiquidity = liquidityResponse.data.data.list.length > 0;
      }
    } catch (e) {
      console.log(`Error checking liquidity: ${e.message}`);
    }
    
    return {
      totalTransfers: transfersData.total || transfers.length,
      estimatedDailyVolume: ethers.formatEther(totalVolume / ethers.toBigInt(30)), // Rough estimate for 30 days
      uniqueAddresses: uniqueAddresses.size,
      hasLiquidity,
      recentTransferCount: transfers.length
    };
  } catch (error) {
    console.error(`Error fetching token volume from API: ${error.message}`);
    console.log("Falling back to on-chain analysis...");
    return null;
  }
}

// Analyze token trading volume and liquidity
async function analyzeVolume(tokenAddress, provider) {
  // First try to get data from API
  const apiVolume = await getVolumeFromAPI(tokenAddress);
  if (apiVolume) {
    return apiVolume;
  }
  
  // If API fails, fall back to on-chain method
  try {
    console.log("Analyzing trading volume and liquidity from on-chain data...");
    
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const filter = tokenContract.filters.Transfer();
    const events = await tokenContract.queryFilter(filter, -50000); // Last 50000 blocks
    
    // Group transfers by block
    const blockData = {};
    for (const event of events) {
      const blockNumber = event.blockNumber;
      if (!blockData[blockNumber]) {
        blockData[blockNumber] = {
          transfers: 0,
          volume: ethers.toBigInt(0)
        };
      }
      
      blockData[blockNumber].transfers++;
      blockData[blockNumber].volume += event.args[2]; // Add transfer amount
    }
    
    // Calculate average daily volume (roughly)
    const totalVolume = Object.values(blockData).reduce(
      (sum, data) => sum + data.volume, 
      ethers.toBigInt(0)
    );
    
    const decimals = await tokenContract.decimals();
    const avgVolume = ethers.formatUnits(totalVolume / ethers.toBigInt(30), decimals); // Rough estimate
    
    // Check if token has liquidity on Uniswap
    let hasLiquidity = false;
    try {
      // Simple check to see if the token has approved the Uniswap router
      const allowance = await tokenContract.allowance(tokenAddress, UNISWAP_ROUTER);
      hasLiquidity = allowance > 0;
    } catch (e) {
      // Ignore errors
    }
    
    return {
      totalTransfers: events.length,
      estimatedDailyVolume: avgVolume,
      uniqueAddresses: Object.keys(
        events.reduce((addresses, event) => {
          addresses[event.args[0]] = true;
          addresses[event.args[1]] = true;
          return addresses;
        }, {})
      ).length,
      hasLiquidity,
      averageTransfersPerBlock: events.length / Object.keys(blockData).length
    };
  } catch (error) {
    console.error("Error analyzing trading volume:", error.message);
    return {
      totalTransfers: 0,
      estimatedDailyVolume: "Unknown",
      uniqueAddresses: 0,
      hasLiquidity: false,
      averageTransfersPerBlock: 0
    };
  }
}

// Check for suspicious patterns in transactions
async function detectSuspiciousPatterns(tokenAddress, provider) {
  try {
    console.log("Checking for suspicious transaction patterns...");
    
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const filter = tokenContract.filters.Transfer();
    const events = await tokenContract.queryFilter(filter, -100000); // Last 100000 blocks
    
    const warnings = [];
    
    // Check 1: Is there a single address that receives a large portion of tokens?
    const receivedAmounts = {};
    let totalTransferred = ethers.toBigInt(0);
    
    for (const event of events) {
      const receiver = event.args[1];
      const amount = event.args[2];
      
      if (!receivedAmounts[receiver]) {
        receivedAmounts[receiver] = ethers.toBigInt(0);
      }
      
      receivedAmounts[receiver] += amount;
      totalTransferred += amount;
    }
    
    // Find addresses receiving more than 20% of all transfers
    if (totalTransferred > 0) {
      for (const [address, amount] of Object.entries(receivedAmounts)) {
        const percentage = Number((amount * ethers.toBigInt(100)) / totalTransferred);
        if (percentage > 20 && address !== UNISWAP_ROUTER) {
          warnings.push({
            type: "concentration",
            severity: "high",
            message: `Address ${address} has received ${percentage}% of all transferred tokens`
          });
        }
      }
    }
    
    // Check 2: Very recent token with few holders
    const uniqueAddresses = new Set();
    for (const event of events) {
      uniqueAddresses.add(event.args[0]);
      uniqueAddresses.add(event.args[1]);
    }
    
    if (uniqueAddresses.size < 10 && events.length > 0) {
      warnings.push({
        type: "fewHolders",
        severity: "medium",
        message: `Token has very few unique addresses (${uniqueAddresses.size}), which might indicate a new or suspicious token`
      });
    }
    
    // Check 3: Large transactions from creator to specific addresses
    const creator = events[0]?.args[0]; // Assume first sender is creator
    if (creator) {
      const creatorTransfers = events.filter(event => 
        event.args[0] === creator && event.args[1] !== UNISWAP_ROUTER
      );
      
      if (creatorTransfers.length > 0) {
        const totalFromCreator = creatorTransfers.reduce(
          (sum, event) => sum + event.args[2], 
          ethers.toBigInt(0)
        );
        
        // If creator sent more than 50% of tokens to addresses other than Uniswap
        const decimals = await tokenContract.decimals();
        const totalSupply = await tokenContract.totalSupply();
        if (totalFromCreator > totalSupply / ethers.toBigInt(2)) {
          warnings.push({
            type: "creatorDistribution",
            severity: "medium",
            message: `Creator has distributed over 50% of tokens to specific addresses`
          });
        }
      }
    }
    
    return {
      warnings,
      riskLevel: warnings.length > 2 ? "high" : 
                 warnings.length > 0 ? "medium" : "low"
    };
  } catch (error) {
    console.error("Error detecting suspicious patterns:", error.message);
    return {
      warnings: [{
        type: "error",
        severity: "unknown",
        message: `Could not complete analysis: ${error.message}`
      }],
      riskLevel: "unknown"
    };
  }
}

// Get all available tokens on Monad testnet from blockvision API
async function getAllTokens() {
  try {
    console.log("Fetching all available tokens from API...");
    
    const url = `${BLOCKVISION_API_BASE}/token/list?pageSize=100&pageIndex=1`;
    const response = await axios.get(url, { headers: API_HEADERS });
    
    if (!response.data || !response.data.data || !response.data.data.list) {
      console.log("API returned empty data for token list");
      return [];
    }
    
    const tokens = response.data.data.list.map(token => ({
      address: token.address,
      name: token.name || "Unknown",
      symbol: token.symbol || "Unknown",
      decimals: token.decimals || 18,
      totalSupply: token.totalSupply || "Unknown",
      holders: token.holders || 0,
      transfers: token.transfers || 0
    }));
    
    console.log(`Found ${tokens.length} tokens on Monad testnet`);
    return tokens;
  } catch (error) {
    console.error(`Error fetching token list from API: ${error.message}`);
    return [];
  }
}

// Main analysis function that combines all checks
async function analyzeToken(tokenAddress) {
  try {
    const provider = await connectProvider();
    
    // Run all analysis functions
    const basicInfo = await getTokenInfo(tokenAddress, provider);
    
    // Check if we received an error from basic info
    if (basicInfo.error) {
      throw new Error(basicInfo.error);
    }
    
    const topHolders = await getTopHolders(tokenAddress, provider);
    const volumeData = await analyzeVolume(tokenAddress, provider);
    const securityCheck = await detectSuspiciousPatterns(tokenAddress, provider);
    
    // Calculate liquidity concentration
    let holderConcentration = "Unknown";
    if (topHolders.length > 0) {
      const topHolderPercentage = parseFloat(topHolders[0].balance) / 
                                 parseFloat(basicInfo.totalSupply) * 100;
      
      holderConcentration = topHolderPercentage > 50 ? "Very High" :
                           topHolderPercentage > 30 ? "High" :
                           topHolderPercentage > 15 ? "Medium" : "Low";
    }
    
    // Format the comprehensive report
    const report = {
      timestamp: new Date().toISOString(),
      token: basicInfo,
      topHolders: topHolders,
      volume: volumeData,
      security: securityCheck,
      analysis: {
        holderConcentration,
        liquidityRating: volumeData.hasLiquidity ? 
                        (parseFloat(volumeData.estimatedDailyVolume) > 1000 ? "Good" : "Limited") : 
                        "None",
        overallRisk: securityCheck.riskLevel,
        recommendation: securityCheck.riskLevel === "low" ? 
                      "Token appears legitimate based on available data" :
                      securityCheck.riskLevel === "medium" ?
                      "Exercise caution when interacting with this token" :
                      "High risk detected - not recommended for interaction"
      }
    };
    
    // Save the report to a file
    const reportPath = `token_analysis_${tokenAddress.slice(0, 8)}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Analysis complete. Report saved to ${reportPath}`);
    
    return report;
  } catch (error) {
    console.error("Error during token analysis:", error.message);
    return {
      token: {
        address: tokenAddress,
        name: "Error",
        symbol: "ERROR",
        totalSupply: "Unknown"
      },
      error: error.message,
      status: "failed",
      topHolders: [],
      volume: {
        totalTransfers: 0,
        uniqueAddresses: 0,
        estimatedDailyVolume: "Unknown"
      },
      security: {
        warnings: [{
          type: "error",
          severity: "unknown",
          message: `Analysis failed: ${error.message}`
        }],
        riskLevel: "unknown"
      },
      analysis: {
        holderConcentration: "Unknown",
        liquidityRating: "Unknown",
        overallRisk: "unknown",
        recommendation: "Could not analyze token. The contract may not exist, may not be a standard token, or may be on a different network."
      }
    };
  }
}

// Export the main function
export async function run(tokenAddress) {
  try {
    // If no address is provided, return a list of all available tokens
    if (!tokenAddress) {
      console.log("No token address provided, fetching all available tokens");
      const allTokens = await getAllTokens();
      
      return {
        status: "success",
        message: "Retrieved list of all available tokens",
        tokens: allTokens
      };
    }
    
    console.log(`Starting analysis for token: ${tokenAddress}`);
    const report = await analyzeToken(tokenAddress);
    
    // Handle case where analysis failed and returned an error
    if (report.status === "failed") {
      console.log(`Analysis failed: ${report.error}`);
      return report; // Return the structured error report
    }
    
    // Print a summary of the analysis
    console.log("\nTOKEN ANALYSIS SUMMARY");
    console.log("-----------------------");
    console.log(`Token: ${report.token?.name || "Unknown"} (${report.token?.symbol || "Unknown"})`);
    console.log(`Address: ${report.token?.address || tokenAddress}`);
    console.log(`Total Supply: ${report.token?.totalSupply || "Unknown"}`);
    console.log(`Risk Level: ${report.analysis?.overallRisk?.toUpperCase() || "UNKNOWN"}`);
    
    if (report.security?.warnings?.length > 0) {
      console.log("\nWarnings:");
      report.security.warnings.forEach(warning => {
        console.log(`- ${warning.message} (${warning.severity})`);
      });
    }
    
    console.log(`\nRecommendation: ${report.analysis?.recommendation || "Unable to generate recommendation"}`);
    console.log("\nDetailed analysis saved to file. Use this report with Claude for deeper insights.");
    
    return report;
  } catch (error) {
    console.error("Unexpected error during token analysis:", error.message);
    
    // Return a structured error response that won't cause MCP to fail
    return {
      token: {
        address: tokenAddress || "Unknown",
        name: "Error",
        symbol: "Error",
        totalSupply: "Unknown"
      },
      error: error.message,
      status: "failed",
      analysis: {
        overallRisk: "unknown",
        holderConcentration: "Unknown",
        liquidityRating: "Unknown",
        recommendation: "Analysis failed due to an unexpected error. The token contract may not exist or may not be a standard token."
      },
      security: {
        warnings: [{
          type: "error",
          severity: "unknown",
          message: `Analysis failed: ${error.message}`
        }],
        riskLevel: "unknown"
      },
      volume: {
        totalTransfers: 0,
        uniqueAddresses: 0,
        estimatedDailyVolume: "Unknown"
      },
      topHolders: []
    };
  }
}

export default run; 