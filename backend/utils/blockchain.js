const { ethers } = require("ethers");
const { CFD_TOKEN_ABI, AFFILIATE_MANAGER_ABI, ICO_PHASE1_ABI, USDT_ABI } = require("../contracts/abis");

class BlockchainService {
  constructor() {
    // Garante que as variáveis de ambiente são lidas no momento da construção
    const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;
    const CFD_TOKEN_ADDRESS = process.env.CFD_TOKEN_ADDRESS;
    const AFFILIATE_MANAGER_ADDRESS = process.env.AFFILIATE_MANAGER_ADDRESS;
    const ICO_PHASE1_ADDRESS = process.env.ICO_PHASE1_ADDRESS;
    const USDT_ADDRESS = process.env.USDT_ADDRESS;

    // Verifica se os endereços estão definidos
    if (!POLYGON_RPC_URL) {
      console.error("Erro: POLYGON_RPC_URL não definido.");
      throw new Error("POLYGON_RPC_URL não definido.");
    }
    if (!CFD_TOKEN_ADDRESS) {
      console.error("Erro: CFD_TOKEN_ADDRESS não definido.");
      throw new Error("CFD_TOKEN_ADDRESS não definido.");
    }
    if (!AFFILIATE_MANAGER_ADDRESS) {
      console.error("Erro: AFFILIATE_MANAGER_ADDRESS não definido.");
      throw new Error("AFFILIATE_MANAGER_ADDRESS não definido.");
    }
    if (!ICO_PHASE1_ADDRESS) {
      console.error("Erro: ICO_PHASE1_ADDRESS não definido.");
      throw new Error("ICO_PHASE1_ADDRESS não definido.");
    }
    if (!USDT_ADDRESS) {
      console.error("Erro: USDT_ADDRESS não definido.");
      throw new Error("USDT_ADDRESS não definido.");
    }

    this.provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);
    // this.testnetProvider = new ethers.JsonRpcProvider(process.env.POLYGON_TESTNET_RPC_URL); // Manter comentado se não usar

    // Contratos
    this.cfdTokenContract = new ethers.Contract(
      CFD_TOKEN_ADDRESS,
      CFD_TOKEN_ABI,
      this.provider
    );

    this.affiliateManagerContract = new ethers.Contract(
      AFFILIATE_MANAGER_ADDRESS,
      AFFILIATE_MANAGER_ABI,
      this.provider
    );

    this.icoPhase1Contract = new ethers.Contract(
      ICO_PHASE1_ADDRESS,
      ICO_PHASE1_ABI,
      this.provider
    );

    this.usdtContract = new ethers.Contract(
      USDT_ADDRESS,
      USDT_ABI,
      this.provider
    );
  }

  // Verificar saldo de tokens CFD
  async getCFDBalance(walletAddress) {
    try {
      const balance = await this.cfdTokenContract.balanceOf(walletAddress);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error("Erro ao obter saldo CFD:", error);
      throw new Error("Falha ao obter saldo CFD");
    }
  }

  // Verificar saldo de USDT
  async getUSDTBalance(walletAddress) {
    try {
      const balance = await this.usdtContract.balanceOf(walletAddress);
      const decimals = await this.usdtContract.decimals();
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      console.error("Erro ao obter saldo USDT:", error);
      throw new Error("Falha ao obter saldo USDT");
    }
  }

  // Verificar se endereço é válido
  isValidAddress(address) {
    return ethers.isAddress(address);
  }

  // Obter informações da transação
  async getTransactionInfo(txHash) {
    try {
      const tx = await this.provider.getTransaction(txHash);
      const receipt = await this.provider.getTransactionReceipt(txHash);

      return {
        transaction: tx,
        receipt: receipt,
        status: receipt ? (receipt.status === 1 ? "success" : "failed") : "pending",
      };
    } catch (error) {
      console.error("Erro ao obter informações da transação:", error);
      throw new Error("Falha ao obter informações da transação");
    }
  }

  // Obter preço atual do MATIC em USD (simulado)
  async getMaticPrice() {
    try {
      // Em produção, usar uma API real como CoinGecko
      // Por agora, retornamos um valor simulado
      return 0.85; // USD
    } catch (error) {
      console.error("Erro ao obter preço do MATIC:", error);
      return 0.85; // Valor padrão
    }
  }

  // Calcular gas fee estimado
  async estimateGasFee(to, data = "0x") {
    try {
      const gasPrice = await this.provider.getFeeData();
      const gasLimit = await this.provider.estimateGas({
        to: to,
        data: data,
      });

      const gasFee = gasPrice.gasPrice * gasLimit;
      return ethers.formatEther(gasFee);
    } catch (error) {
      console.error("Erro ao estimar gas fee:", error);
      return "0.01"; // Valor padrão
    }
  }

  // Verificar se wallet possui tokens CFD há mais de 30 dias
  async checkHoldingPeriod(walletAddress) {
    try {
      // Buscar eventos de Transfer para este endereço
      const filter = this.cfdTokenContract.filters.Transfer(null, walletAddress);
      const events = await this.cfdTokenContract.queryFilter(filter, -100000); // Últimos 100k blocos

      if (events.length === 0) {
        return { eligible: false, firstPurchase: null };
      }

      // Pegar o primeiro evento (primeira compra)
      const firstEvent = events[0];
      const block = await this.provider.getBlock(firstEvent.blockNumber);
      const firstPurchaseDate = new Date(block.timestamp * 1000);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return {
        eligible: firstPurchaseDate <= thirtyDaysAgo,
        firstPurchase: firstPurchaseDate,
      };
    } catch (error) {
      console.error("Erro ao verificar período de posse:", error);
      return { eligible: false, firstPurchase: null };
    }
  }

  // Obter todos os holders elegíveis para dividendos
  async getEligibleHolders() {
    try {
      const holders = [];

      // Buscar todos os eventos de Transfer
      const filter = this.cfdTokenContract.filters.Transfer();
      const events = await this.cfdTokenContract.queryFilter(filter, -500000); // Últimos 500k blocos

      const uniqueAddresses = new Set();

      // Coletar endereços únicos
      events.forEach((event) => {
        if (event.args.to !== ethers.ZeroAddress) {
          uniqueAddresses.add(event.args.to);
        }
      });

      // Verificar saldo e período de posse para cada endereço
      for (const address of uniqueAddresses) {
        try {
          const balance = await this.getCFDBalance(address);
          if (parseFloat(balance) > 0) {
            const holdingInfo = await this.checkHoldingPeriod(address);

            holders.push({
              address: address,
              balance: parseFloat(balance),
              eligible: holdingInfo.eligible,
              firstPurchase: holdingInfo.firstPurchase,
            });
          }
        } catch (error) {
          console.error(`Erro ao verificar holder ${address}:`, error);
        }
      }

      return holders.filter((h) => h.eligible);
    } catch (error) {
      console.error("Erro ao obter holders elegíveis:", error);
      throw new Error("Falha ao obter holders elegíveis");
    }
  }

  // Simular distribuição de dividendos
  async simulateDividendDistribution(totalAmount, eligibleHolders) {
    try {
      const totalTokens = eligibleHolders.reduce(
        (sum, holder) => sum + holder.balance,
        0
      );
      const amountPerToken = totalAmount / totalTokens;

      const distribution = eligibleHolders.map((holder) => ({
        address: holder.address,
        cfdBalance: holder.balance,
        dividendAmount: holder.balance * amountPerToken,
      }));

      return {
        totalAmount,
        totalTokens,
        amountPerToken,
        eligibleHolders: eligibleHolders.length,
        distribution,
      };
    } catch (error) {
      console.error("Erro ao simular distribuição:", error);
      throw new Error("Falha ao simular distribuição");
    }
  }
}

module.exports = new BlockchainService();


