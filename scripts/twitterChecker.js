import axios from 'axios';
import fs from 'fs';

/**
 * Query the memory.lol API to check Twitter username change history
 * This uses the API from memory.lol which tracks Twitter username changes
 * 
 * @param {string} screenName - Twitter screen name without the '@' symbol
 * @returns {Promise<object>} - Result object with status and data
 */
async function queryUsernameChanges(screenName) {
  try {
    console.log(`Querying username changes for ${screenName}`);
    
    // Remove @ if included accidentally
    if (screenName.startsWith('@')) {
      screenName = screenName.substring(1);
    }
    
    // Validate the screen name format (basic check)
    if (!/^[A-Za-z0-9_]{1,15}$/.test(screenName)) {
      return {
        status: 'failed',
        error: `Invalid Twitter handle: ${screenName}. Twitter handles can only contain letters, numbers and underscores, and must be 15 characters or less.`
      };
    }
    
    // Fetch data from memory.lol API
    const response = await axios.get(`https://api.memory.lol/v1/tw/${screenName}`);
    
    if (!response.data || !response.data.accounts || response.data.accounts.length === 0) {
      return {
        status: 'success',
        data: {
          screenName,
          message: `No username change history found for ${screenName}`
        }
      };
    }
    
    // Process and format the data
    const historyData = {
      screenName,
      accounts: response.data.accounts.map(account => {
        const screenNames = [];
        
        // Format each username change record
        for (const [name, dates] of Object.entries(account.screen_names)) {
          screenNames.push({
            name,
            dates: Array.isArray(dates) ? dates.join(' to ') : dates
          });
        }
        
        return {
          userId: account.id_str,
          screenNames
        };
      })
    };
    
    // Create a formatted text version for display
    let formattedText = `Username change history for ${screenName}:\n\n`;
    
    historyData.accounts.forEach(account => {
      formattedText += `User ID ${account.userId}:\n`;
      account.screenNames.forEach(item => {
        formattedText += `- ${item.name} (${item.dates})\n`;
      });
      formattedText += '\n';
    });
    
    // Save the report to a file
    const reportPath = `twitter_history_${screenName}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(historyData, null, 2));
    
    console.log(`Twitter history for ${screenName} saved to ${reportPath}`);
    
    return {
      status: 'success',
      data: historyData,
      text: formattedText
    };
  } catch (error) {
    console.error(`Error checking Twitter username history: ${error.message}`);
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      if (error.response.status === 404) {
        return {
          status: 'failed',
          error: `Twitter user ${screenName} not found in memory.lol database`,
          code: 404
        };
      } else {
        return {
          status: 'failed',
          error: `API error: ${error.response.status} - ${error.response.statusText}`,
          code: error.response.status
        };
      }
    } else if (error.request) {
      // The request was made but no response was received
      return {
        status: 'failed',
        error: 'Network error: No response received from server',
        code: 'NETWORK_ERROR'
      };
    } else {
      // Something happened in setting up the request that triggered an Error
      return {
        status: 'failed',
        error: `Request configuration error: ${error.message}`,
        code: 'CONFIG_ERROR'
      };
    }
  }
}

/**
 * Main function to run the Twitter username checker
 * @param {string} screenName - Twitter screen name to check
 * @returns {Promise<object>} - Analysis results
 */
export async function run(screenName = null) {
  try {
    if (!screenName) {
      return {
        status: 'failed',
        error: 'No Twitter screen name provided',
        usage: 'Please provide a Twitter username without the @ symbol'
      };
    }
    
    console.log(`Checking Twitter history for: ${screenName}`);
    const result = await queryUsernameChanges(screenName);
    
    if (result.status === 'success') {
      console.log(`Successfully retrieved Twitter history for ${screenName}`);
      
      // Print a summary to console
      if (result.text) {
        console.log("\nTWITTER USERNAME HISTORY");
        console.log("------------------------");
        console.log(result.text);
      }
    } else {
      console.error(`Failed to retrieve Twitter history: ${result.error}`);
    }
    
    return result;
  } catch (error) {
    console.error(`Unexpected error in Twitter checker: ${error.message}`);
    return {
      status: 'failed',
      error: `Unexpected error: ${error.message}`
    };
  }
}

export default run; 