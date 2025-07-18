const { ethers } = require('ethers');
const { CONTRACTS, CFD_TOKEN_ABI, ICO_ABI } = require('../contracts/abis');

class ContractService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com');
    this.contracts = {};
    this.initializeContracts();
  }

  initializeContracts() {
    // Contrato CFD Token
    this.contracts.cfdToken = new ethers.Contract(
      CONTRACTS.CFD_TOKEN,
      CFD_TOKEN_ABI,
      this.provider
    );

    // Contrato USDT
    this.contracts.usdt = new ethers.Contract(
      CONTRACTS.USDT,
      [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function balanceOf(address) view returns (uint256)",
        "function transfer(address to, uint256 amount) returns (bool)"
      ],
      this.provider
    );

    // Contrato ICO Fase 1
    this.contracts.icoPhase1 = new ethers.Contract(
      CONTRACTS.ICO_PHASE1,
      ICO_ABI,
      this.provider
    );
  }

  // Obter saldo CFD de uma carteira
  async getCFDBalance(walletAddress) {
    try {
      const balance = await this.contracts.cfdToken.balanceOf(walletAddress);
      return {
        success: true,
        balance: {
          raw: balance.toString(),
          formatted: ethers.formatEther(balance),
          cfdBalance: parseFloat(ethers.formatEther(balance))
        }
      };
    } catch (error) {
      console.error('Erro ao obter saldo CFD:', error);
      return {
        success: false,
        error: error.message,
        balance: { raw: '0', formatted: '0', cfdBalance: 0 }
      };
    }
  }

  // Obter saldo USDT de uma carteira
  async getUSDTBalance(walletAddress) {
    try {
      const balance = await this.contracts.usdt.balanceOf(walletAddress);
      const decimals = await this.contracts.usdt.decimals();
      const formatted = ethers.formatUnits(balance, decimals);
      
      return {
        success: true,
        balance: {
          raw: balance.toString(),
          formatted: formatted,
          usdtBalance: parseFloat(formatted),
          decimals: decimals
        }
      };
    } catch (error) {
      console.error('Erro ao obter saldo USDT:', error);
      return {
        success: false,
        error: error.message,
        balance: { raw: '0', formatted: '0', usdtBalance: 0, decimals: 6 }
      };
    }
  }

  // Obter saldo MATIC de uma carteira
  async getMaticBalance(walletAddress) {
    try {
      const balance = await this.provider.getBalance(walletAddress);
      return {
        success: true,
        balance: {
          raw: balance.toString(),
          formatted: ethers.formatEther(balance),
          maticBalance: parseFloat(ethers.formatEther(balance))
        }
      };
    } catch (error) {
      console.error('Erro ao obter saldo MATIC:', error);
      return {
        success: false,
        error: error.message,
        balance: { raw: '0', formatted: '0', maticBalance: 0 }
      };
    }
  }

  // Obter informações completas de uma carteira
  async getWalletInfo(walletAddress) {
    try {
      const [cfdResult, usdtResult, maticResult] = await Promise.all([
        this.getCFDBalance(walletAddress),
        this.getUSDTBalance(walletAddress),
        this.getMaticBalance(walletAddress)
      ]);

      return {
        success: true,
        walletAddress,
        balances: {
          cfd: cfdResult.balance,
          usdt: usdtResult.balance,
          matic: maticResult.balance
        },
        errors: {
          cfd: cfdResult.success ? null : cfdResult.error,
          usdt: usdtResult.success ? null : usdtResult.error,
          matic: maticResult.success ? null : maticResult.error
        }
      };
    } catch (error) {
      console.error('Erro ao obter informações da carteira:', error);
      return {
        success: false,
        error: error.message,
        walletAddress,
        balances: {
          cfd: { raw: '0', formatted: '0', cfdBalance: 0 },
          usdt: { raw: '0', formatted: '0', usdtBalance: 0, decimals: 6 },
          matic: { raw: '0', formatted: '0', maticBalance: 0 }
        }
      };
    }
  }

  // Verificar se uma carteira possui tokens CFD há pelo menos 30 dias
  async checkHoldingPeriod(walletAddress) {
    try {
      // Buscar eventos de Transfer para esta carteira
      const filter = this.contracts.cfdToken.filters.Transfer(null, walletAddress);
      const currentBlock = await this.provider.getBlockNumber();
      
      // Buscar nos últimos 30 dias (aproximadamente 1.2M blocos na Polygon)
      const blocksIn30Days = 1200000;
      const fromBlock = Math.max(0, currentBlock - blocksIn30Days);
      
      const events = await this.contracts.cfdToken.queryFilter(filter, fromBlock, currentBlock);
      
      if (events.length === 0) {
        return {
          success: true,
          isEligible: false,
          holdingPeriodDays: 0,
          firstTransactionDate: null
        };
      }

      // Pegar o primeiro evento (mais antigo)
      const firstEvent = events[0];
      const block = await this.provider.getBlock(firstEvent.blockNumber);
      const firstTransactionDate = new Date(block.timestamp * 1000);
      const now = new Date();
      const holdingPeriodDays = Math.floor((now - firstTransactionDate) / (1000 * 60 * 60 * 24));

      return {
        success: true,
        isEligible: holdingPeriodDays >= 30,
        holdingPeriodDays,
        firstTransactionDate: firstTransactionDate.toISOString(),
        firstTransactionBlock: firstEvent.blockNumber
      };
    } catch (error) {
      console.error('Erro ao verificar período de posse:', error);
      return {
        success: false,
        error: error.message,
        isEligible: false,
        holdingPeriodDays: 0
      };
    }
  }

  // Validar endereço Ethereum
  isValidAddress(address) {
    try {
      return ethers.isAddress(address);
    } catch (error) {
      return false;
    }
  }

  // Obter preço atual do MATIC (simulado)
  async getMaticPrice() {
    try {
      // Em produção, isso seria uma chamada para uma API de preços como CoinGecko
      // Por enquanto, retornamos um preço simulado
      return {
        success: true,
        price: {
          usd: 0.85,
          lastUpdated: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        price: { usd: 0, lastUpdated: null }
      };
    }
  }

  // Estimar gas fee para uma transação
  async estimateGasFee(to, data = '0x') {
    try {
      const gasEstimate = await this.provider.estimateGas({
        to,
        data
      });

      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('30', 'gwei');
      
      const estimatedCost = gasEstimate * gasPrice;

      return {
        success: true,
        gasEstimate: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        estimatedCostWei: estimatedCost.toString(),
        estimatedCostMatic: ethers.formatEther(estimatedCost)
      };
    } catch (error) {
      console.error('Erro ao estimar gas fee:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Obter informações do token CFD
  async getCFDTokenInfo() {
    try {
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        this.contracts.cfdToken.name(),
        this.contracts.cfdToken.symbol(),
        this.contracts.cfdToken.decimals(),
        this.contracts.cfdToken.totalSupply()
      ]);

      return {
        success: true,
        tokenInfo: {
          name,
          symbol,
          decimals,
          totalSupply: totalSupply.toString(),
          totalSupplyFormatted: ethers.formatEther(totalSupply),
          contractAddress: CONTRACTS.CFD_TOKEN
        }
      };
    } catch (error) {
      console.error('Erro ao obter informações do token CFD:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verificar se um endereço é um contrato
  async isContract(address) {
    try {
      const code = await this.provider.getCode(address);
      return {
        success: true,
        isContract: code !== '0x'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        isContract: false
      };
    }
  }

  // Obter histórico de transações CFD de uma carteira
  async getCFDTransactionHistory(walletAddress, limit = 10) {
    try {
      // Filtros para eventos de Transfer
      const sentFilter = this.contracts.cfdToken.filters.Transfer(walletAddress, null);
      const receivedFilter = this.contracts.cfdToken.filters.Transfer(null, walletAddress);

      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000000); // Últimos ~1M blocos

      const [sentEvents, receivedEvents] = await Promise.all([
        this.contracts.cfdToken.queryFilter(sentFilter, fromBlock, currentBlock),
        this.contracts.cfdToken.queryFilter(receivedFilter, fromBlock, currentBlock)
      ]);

      // Combinar e ordenar eventos
      const allEvents = [...sentEvents, ...receivedEvents]
        .sort((a, b) => b.blockNumber - a.blockNumber)
        .slice(0, limit);

      const transactions = await Promise.all(
        allEvents.map(async (event) => {
          const block = await this.provider.getBlock(event.blockNumber);
          const isSent = event.args[0].toLowerCase() === walletAddress.toLowerCase();
          
          return {
            hash: event.transactionHash,
            blockNumber: event.blockNumber,
            timestamp: new Date(block.timestamp * 1000).toISOString(),
            type: isSent ? 'sent' : 'received',
            from: event.args[0],
            to: event.args[1],
            amount: ethers.formatEther(event.args[2]),
            amountRaw: event.args[2].toString()
          };
        })
      );

      return {
        success: true,
        transactions
      };
    } catch (error) {
      console.error('Erro ao obter histórico de transações:', error);
      return {
        success: false,
        error: error.message,
        transactions: []
      };
    }
  }
}

module.exports = new ContractService();

