import express from 'express';
import fetch from 'node-fetch'; // Untuk membuat permintaan HTTP ke API LLM
// Since we're having trouble with ES module imports for the SDK
// Let's create a basic middleware without the MCP client for now

const app = express();
app.use(express.json());

// Konfigurasi API LLM
const LLM_API_URL = "https://api.anthropic.com/v1/messages"; // URL API untuk Claude
const API_KEY = process.env.ANTHROPIC_API_KEY || "YOUR_API_KEY"; // Ganti dengan API key Anda

// Endpoint untuk berkomunikasi dengan LLM
app.post('/ask', async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ status: 'error', message: 'Prompt is required' });
  }
  
  try {
    // Kirim prompt ke LLM
    const llmResponse = await askLLM(prompt);
    
    // Coba interpretasi sebagai perintah
    try {
      const result = await interpretAndExecuteCommand(llmResponse);
      res.json({ 
        status: 'success', 
        llmResponse,
        executionResult: result 
      });
    } catch (commandError) {
      // Jika bukan perintah, kembalikan hanya respons LLM
      res.json({ 
        status: 'success', 
        llmResponse,
        note: 'Response was not interpreted as a command'
      });
    }
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Function untuk berkomunikasi dengan LLM API
async function askLLM(prompt) {
  try {
    const response = await fetch(LLM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        max_tokens: 1000,
        messages: [
          { role: "user", content: prompt }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error("Error querying LLM:", error);
    throw new Error("Failed to get response from language model");
  }
}

// Tetap pertahankan endpoint dan fungsi yang sudah ada
app.post('/command', async (req, res) => {
  const { command } = req.body;

  try {
    const result = await interpretAndExecuteCommand(command);
    res.json({ status: 'success', result });
  } catch (error) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

// Function untuk menginterpretasi dan menjalankan perintah
async function interpretAndExecuteCommand(command) {
  // Mendukung lebih banyak pola perintah
  const swapPatterns = [
    /swap (\d+(?:\.\d+)?) MON to (0x[a-fA-F0-9]{40})/i,
    /tukar (\d+(?:\.\d+)?) MON ke (0x[a-fA-F0-9]{40})/i,
    /kirim (\d+(?:\.\d+)?) MON ke (0x[a-fA-F0-9]{40})/i
  ];
  
  // Token analysis patterns
  const analysisPatterns = [
    /analyze token (?:at |address |contract |)(0x[a-fA-F0-9]{40})/i,
    /analisis token (?:di |alamat |kontrak |)(0x[a-fA-F0-9]{40})/i,
    /check token (?:at |address |contract |)(0x[a-fA-F0-9]{40})/i,
    /cek token (?:di |alamat |kontrak |)(0x[a-fA-F0-9]{40})/i,
    /periksa token (?:di |alamat |kontrak |)(0x[a-fA-F0-9]{40})/i
  ];
  
  // Wallet analysis patterns
  const walletAnalysisPatterns = [
    /analyze (?:address|wallet|account) (?:at |address |)(0x[a-fA-F0-9]{40})/i,
    /analisis (?:alamat|dompet) (?:di |alamat |)(0x[a-fA-F0-9]{40})/i,
    /check (?:address|wallet) (?:at |address |)(0x[a-fA-F0-9]{40})/i,
    /cek (?:alamat|dompet) (?:di |alamat |)(0x[a-fA-F0-9]{40})/i,
    /lihat (?:alamat|dompet|akun) (?:di |alamat |)(0x[a-fA-F0-9]{40})/i,
    /info (?:alamat|dompet|akun) (?:di |alamat |)(0x[a-fA-F0-9]{40})/i
  ];
  
  // Twitter username check patterns
  const twitterCheckPatterns = [
    /check (?:twitter|twitter username|twitter history) (?:for |of |)@?([A-Za-z0-9_]{1,15})/i,
    /cek (?:twitter|username twitter|riwayat twitter) (?:untuk |dari |)@?([A-Za-z0-9_]{1,15})/i,
    /analyze (?:twitter|twitter username) (?:for |of |)@?([A-Za-z0-9_]{1,15})/i,
    /analisis (?:twitter|username twitter) (?:untuk |dari |)@?([A-Za-z0-9_]{1,15})/i,
    /lihat (?:riwayat|history) twitter (?:untuk |dari |)@?([A-Za-z0-9_]{1,15})/i,
    /show (?:twitter|username) (?:history|changes) (?:for |of |)@?([A-Za-z0-9_]{1,15})/i
  ];
  
  // Check for swap commands first
  for (const pattern of swapPatterns) {
    const match = command.match(pattern);
    if (match) {
      const amount = parseFloat(match[1]);
      const contractAddress = match[2];
  
      console.log(`Executing swap: ${amount} MON to ${contractAddress}`);
      
      // Di sini nantinya akan memanggil tool MCP server
      return { message: `Swap executed: ${amount} MON to ${contractAddress}` };
    }
  }
  
  // Then check for token analysis commands
  for (const pattern of analysisPatterns) {
    const match = command.match(pattern);
    if (match) {
      const tokenAddress = match[1];
      
      console.log(`Analyzing token at: ${tokenAddress}`);
      
      // Di sini nantinya akan memanggil tool MCP server untuk analisis token
      return { 
        message: `Token analysis started for ${tokenAddress}. Please wait while we process the results.`,
        action: 'analyze-token',
        tokenAddress 
      };
    }
  }
  
  // Then check for wallet analysis commands
  for (const pattern of walletAnalysisPatterns) {
    const match = command.match(pattern);
    if (match) {
      const walletAddress = match[1];
      
      console.log(`Analyzing wallet address: ${walletAddress}`);
      
      // Di sini nantinya akan memanggil tool MCP server untuk analisis alamat wallet
      return { 
        message: `Wallet analysis started for ${walletAddress}. Please wait while we process the results.`,
        action: 'analyze-address',
        address: walletAddress 
      };
    }
  }
  
  // Check for Twitter username check commands
  for (const pattern of twitterCheckPatterns) {
    const match = command.match(pattern);
    if (match) {
      const twitterUsername = match[1];
      
      console.log(`Checking Twitter history for username: ${twitterUsername}`);
      
      // Return action to be handled by MCP server
      return { 
        message: `Twitter username history check started for @${twitterUsername}. Please wait...`,
        action: 'check-twitter',
        screenName: twitterUsername
      };
    }
  }

  throw new Error('Command not recognized');
}

// Start the middleware server
app.listen(4000, () => {
  console.log('Middleware server running on port 4000');
  console.log('Ask endpoint: POST to http://localhost:4000/ask with {"prompt": "your question"}');
  console.log('Command endpoint: POST to http://localhost:4000/command with {"command": "swap 2 MON to 0x..."}');
  console.log('Token Analysis: Try commands like "analyze token 0x1234..." or "check token 0x1234..."');
});