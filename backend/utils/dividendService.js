const DividendDistribution = require('../models/DividendDistribution');
const Transaction = require('../models/Transaction');
const contractService = require('./contractService');

class DividendService {
  constructor() {
    this.minimumHoldingPeriod = 30; // dias
  }

  // Criar uma nova distribuição de dividendos
  async createDistribution(totalAmount, notes = '') {
    try {
      // Obter snapshot de holders elegíveis
      const snapshot = await this.getEligibleHoldersSnapshot();
      
      if (!snapshot.success) {
        return {
          success: false,
          error: 'Erro ao obter snapshot de holders'
        };
      }

      if (snapshot.eligibleHolders === 0) {
        return {
          success: false,
          error: 'Nenhum holder elegível encontrado'
        };
      }

      // Criar distribuição
      const distribution = new DividendDistribution({
        totalAmount,
        eligibleHolders: snapshot.eligibleHolders,
        totalTokensEligible: snapshot.totalTokensEligible,
        distributionDate: new Date(),
        notes,
        status: 'pending',
        holdersSnapshot: snapshot.holders
      });

      await distribution.save();

      // Calcular dividendos individuais
      await this.calculateIndividualDividends(distribution._id);

      return {
        success: true,
        distribution,
        message: `Distribuição criada para ${snapshot.eligibleHolders} holders`
      };
    } catch (error) {
      console.error('Erro ao criar distribuição:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Calcular dividendos individuais para uma distribuição
  async calculateIndividualDividends(distributionId) {
    try {
      const distribution = await DividendDistribution.findById(distributionId);
      
      if (!distribution) {
        throw new Error('Distribuição não encontrada');
      }

      const individualDividends = [];

      for (const holder of distribution.holdersSnapshot) {
        if (holder.isEligibleForDividends && holder.cfdBalance > 0) {
          const sharePercentage = holder.cfdBalance / distribution.totalTokensEligible;
          const dividendAmount = distribution.totalAmount * sharePercentage;

          individualDividends.push({
            walletAddress: holder.walletAddress,
            cfdBalance: holder.cfdBalance,
            sharePercentage: sharePercentage * 100,
            dividendAmount,
            claimed: false
          });
        }
      }

      distribution.individualDividends = individualDividends;
      distribution.status = 'calculated';
      await distribution.save();

      return {
        success: true,
        individualDividends
      };
    } catch (error) {
      console.error('Erro ao calcular dividendos individuais:', error);
      throw error;
    }
  }

  // Obter snapshot de holders elegíveis
  async getEligibleHoldersSnapshot() {
    try {
      // Buscar todas as transações de compra de ICO
      const icoTransactions = await Transaction.find({ 
        type: 'ico_purchase',
        status: 'confirmed'
      }).sort({ createdAt: 1 });

      const holdersMap = new Map();
      const now = new Date();

      // Processar transações para construir lista de holders
      for (const tx of icoTransactions) {
        const holdingPeriodDays = Math.floor((now - tx.createdAt) / (1000 * 60 * 60 * 24));
        const isEligible = holdingPeriodDays >= this.minimumHoldingPeriod;

        if (holdersMap.has(tx.walletAddress)) {
          const existing = holdersMap.get(tx.walletAddress);
          existing.cfdBalance += tx.tokensReceived;
          existing.totalInvested += tx.amount;
          existing.purchaseCount += 1;
          
          // Atualizar elegibilidade (se qualquer compra for elegível)
          if (isEligible) {
            existing.isEligibleForDividends = true;
          }
        } else {
          holdersMap.set(tx.walletAddress, {
            walletAddress: tx.walletAddress,
            cfdBalance: tx.tokensReceived,
            totalInvested: tx.amount,
            purchaseCount: 1,
            firstPurchaseDate: tx.createdAt,
            holdingPeriodDays,
            isEligibleForDividends: isEligible,
            source: 'ico_purchase'
          });
        }
      }

      // Verificar saldos atuais na blockchain para holders elegíveis
      const holders = Array.from(holdersMap.values());
      const eligibleHolders = [];
      let totalTokensEligible = 0;

      for (const holder of holders) {
        if (holder.isEligibleForDividends) {
          // Verificar saldo atual na blockchain
          const balanceResult = await contractService.getCFDBalance(holder.walletAddress);
          
          if (balanceResult.success && balanceResult.balance.cfdBalance > 0) {
            holder.cfdBalance = balanceResult.balance.cfdBalance;
            holder.source = 'blockchain_verified';
            eligibleHolders.push(holder);
            totalTokensEligible += holder.cfdBalance;
          }
        }
      }

      return {
        success: true,
        totalHolders: holders.length,
        eligibleHolders: eligibleHolders.length,
        totalTokensEligible,
        holders: eligibleHolders
      };
    } catch (error) {
      console.error('Erro ao obter snapshot de holders:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Obter informações de dividendos para um holder
  async getDividendInfo(walletAddress) {
    try {
      // Buscar todas as distribuições
      const distributions = await DividendDistribution.find({ 
        status: { $in: ['calculated', 'completed'] } 
      }).sort({ distributionDate: -1 });

      let totalDividendsReceived = 0;
      let availableDividends = 0;
      const dividendHistory = [];

      for (const distribution of distributions) {
        const holderDividend = distribution.individualDividends.find(
          d => d.walletAddress.toLowerCase() === walletAddress.toLowerCase()
        );

        if (holderDividend) {
          dividendHistory.push({
            distributionId: distribution._id,
            distributionDate: distribution.distributionDate,
            amount: holderDividend.dividendAmount,
            sharePercentage: holderDividend.sharePercentage,
            claimed: holderDividend.claimed,
            notes: distribution.notes
          });

          if (holderDividend.claimed) {
            totalDividendsReceived += holderDividend.dividendAmount;
          } else {
            availableDividends += holderDividend.dividendAmount;
          }
        }
      }

      // Verificar período de posse atual
      const holdingResult = await contractService.checkHoldingPeriod(walletAddress);
      const isEligibleForDividends = holdingResult.success && holdingResult.isEligible;

      return {
        success: true,
        dividendInfo: {
          walletAddress,
          isEligibleForDividends,
          holdingPeriodDays: holdingResult.success ? holdingResult.holdingPeriodDays : 0,
          totalDividendsReceived,
          availableDividends,
          dividendHistory
        }
      };
    } catch (error) {
      console.error('Erro ao obter informações de dividendos:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Reivindicar dividendos
  async claimDividends(walletAddress, distributionIds) {
    try {
      let totalClaimed = 0;
      const claimedDistributions = [];

      for (const distributionId of distributionIds) {
        const distribution = await DividendDistribution.findById(distributionId);
        
        if (!distribution) {
          continue;
        }

        const holderDividend = distribution.individualDividends.find(
          d => d.walletAddress.toLowerCase() === walletAddress.toLowerCase()
        );

        if (holderDividend && !holderDividend.claimed) {
          holderDividend.claimed = true;
          holderDividend.claimedAt = new Date();
          
          totalClaimed += holderDividend.dividendAmount;
          claimedDistributions.push({
            distributionId,
            amount: holderDividend.dividendAmount,
            distributionDate: distribution.distributionDate
          });

          // Criar transação de dividendo
          const transaction = new Transaction({
            walletAddress,
            type: 'dividend_payment',
            amount: holderDividend.dividendAmount,
            currency: 'USDT',
            status: 'confirmed',
            metadata: {
              distributionId,
              sharePercentage: holderDividend.sharePercentage,
              cfdBalance: holderDividend.cfdBalance
            }
          });

          await transaction.save();
          await distribution.save();
        }
      }

      if (totalClaimed === 0) {
        return {
          success: false,
          error: 'Nenhum dividendo disponível para reivindicar'
        };
      }

      return {
        success: true,
        totalClaimed,
        claimedDistributions,
        message: `${totalClaimed.toFixed(6)} USDT reivindicados com sucesso`
      };
    } catch (error) {
      console.error('Erro ao reivindicar dividendos:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Obter distribuições
  async getDistributions(page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const distributions = await DividendDistribution.find()
        .sort({ distributionDate: -1 })
        .skip(skip)
        .limit(limit)
        .select('-holdersSnapshot -individualDividends');

      const total = await DividendDistribution.countDocuments();
      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        distributions,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Erro ao obter distribuições:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Calcular projeção de dividendos
  async calculateDividendProjection(walletAddress, monthlyProfit = 100000) {
    try {
      // Obter saldo atual de CFD
      const balanceResult = await contractService.getCFDBalance(walletAddress);
      
      if (!balanceResult.success) {
        return {
          success: false,
          error: 'Erro ao obter saldo CFD'
        };
      }

      const cfdBalance = balanceResult.balance.cfdBalance;
      
      if (cfdBalance === 0) {
        return {
          success: false,
          error: 'Carteira não possui tokens CFD'
        };
      }

      // Obter informações do token CFD
      const tokenInfo = await contractService.getCFDTokenInfo();
      const totalSupply = tokenInfo.success ? parseFloat(tokenInfo.tokenInfo.totalSupplyFormatted) : 21000000;

      // Calcular participação do usuário
      const userSharePercentage = (cfdBalance / totalSupply) * 100;
      
      // 60% dos lucros são distribuídos
      const distributionPercentage = 0.6;
      const monthlyDistribution = monthlyProfit * distributionPercentage;
      
      // Calcular dividendos do usuário
      const projectedMonthlyDividend = monthlyDistribution * (userSharePercentage / 100);
      const projectedYearlyDividend = projectedMonthlyDividend * 12;

      // Calcular rendimento anual baseado no investimento
      const averageTokenPrice = 0.05; // Preço médio estimado
      const estimatedInvestment = cfdBalance * averageTokenPrice;
      const annualYieldPercentage = estimatedInvestment > 0 
        ? (projectedYearlyDividend / estimatedInvestment) * 100 
        : 0;

      return {
        success: true,
        projection: {
          cfdBalance,
          userSharePercentage,
          monthlyProfit,
          monthlyDistribution,
          projectedMonthlyDividend,
          projectedYearlyDividend,
          estimatedInvestment,
          annualYieldPercentage
        }
      };
    } catch (error) {
      console.error('Erro ao calcular projeção:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Obter estatísticas de dividendos
  async getDividendStats() {
    try {
      const distributions = await DividendDistribution.find();
      const transactions = await Transaction.find({ type: 'dividend_payment' });

      const stats = {
        totalDistributions: distributions.length,
        totalDistributed: distributions.reduce((sum, d) => sum + d.totalAmount, 0),
        totalClaimed: transactions.reduce((sum, t) => sum + t.amount, 0),
        averageDistribution: distributions.length > 0 
          ? distributions.reduce((sum, d) => sum + d.totalAmount, 0) / distributions.length 
          : 0,
        uniqueRecipients: new Set(transactions.map(t => t.walletAddress)).size,
        lastDistribution: distributions.length > 0 
          ? distributions.sort((a, b) => b.distributionDate - a.distributionDate)[0]
          : null
      };

      return {
        success: true,
        stats
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas de dividendos:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new DividendService();

