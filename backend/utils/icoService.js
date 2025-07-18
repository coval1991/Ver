const ICOPhase = require('../models/ICOPhase');

class ICOService {
  constructor() {
    this.phases = [
      {
        phase: 1,
        name: 'Fase 1 - Early Bird',
        description: 'Primeira fase da ICO com maior desconto',
        tokenPrice: 0.01,
        totalTokens: 1680000, // 8% de 21M
        percentageOfSupply: 8,
        bonusPercentage: 20,
        minPurchase: 0.01,
        maxPurchase: 1000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-06-30'),
        isActive: true
      },
      {
        phase: 2,
        name: 'Fase 2 - Public Sale',
        description: 'Segunda fase da ICO para o público geral',
        tokenPrice: 0.05,
        totalTokens: 4200000, // 20% de 21M
        percentageOfSupply: 20,
        bonusPercentage: 10,
        minPurchase: 0.01,
        maxPurchase: 500,
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-12-31'),
        isActive: false
      },
      {
        phase: 3,
        name: 'Fase 3 - Final Sale',
        description: 'Fase final da ICO após lançamento',
        tokenPrice: 1.00,
        totalTokens: 2100000, // 10% de 21M
        percentageOfSupply: 10,
        bonusPercentage: 0,
        minPurchase: 0.01,
        maxPurchase: 100,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-06-30'),
        isActive: false
      }
    ];
  }

  // Inicializar fases no banco de dados
  async initializePhases() {
    try {
      for (const phaseData of this.phases) {
        const existingPhase = await ICOPhase.findOne({ phase: phaseData.phase });
        
        if (!existingPhase) {
          const newPhase = new ICOPhase({
            ...phaseData,
            tokensSold: 0,
            totalRaised: 0,
            isCompleted: false
          });
          
          await newPhase.save();
          console.log(`Fase ${phaseData.phase} inicializada`);
        }
      }
      
      return { success: true, message: 'Fases inicializadas com sucesso' };
    } catch (error) {
      console.error('Erro ao inicializar fases:', error);
      return { success: false, error: error.message };
    }
  }

  // Obter status atual da ICO
  async getICOStatus() {
    try {
      const phases = await ICOPhase.find().sort({ phase: 1 });
      const currentPhase = phases.find(p => p.isActive && !p.isCompleted);
      
      if (!currentPhase) {
        return {
          success: false,
          error: 'Nenhuma fase ativa encontrada'
        };
      }

      // Calcular progresso da fase atual
      const progress = currentPhase.totalTokens > 0 
        ? (currentPhase.tokensSold / currentPhase.totalTokens) * 100 
        : 0;

      // Calcular estatísticas gerais
      const totalTokensSold = phases.reduce((sum, phase) => sum + phase.tokensSold, 0);
      const totalRaised = phases.reduce((sum, phase) => sum + phase.totalRaised, 0);
      const totalTokensForSale = phases.reduce((sum, phase) => sum + phase.totalTokens, 0);
      const overallProgress = totalTokensForSale > 0 
        ? (totalTokensSold / totalTokensForSale) * 100 
        : 0;

      return {
        success: true,
        ico: {
          currentPhase: {
            ...currentPhase.toObject(),
            progress: Math.round(progress * 100) / 100
          },
          phases: phases.map(phase => ({
            ...phase.toObject(),
            progress: phase.totalTokens > 0 
              ? Math.round((phase.tokensSold / phase.totalTokens) * 100 * 100) / 100 
              : 0
          })),
          overall: {
            totalTokensSold,
            totalRaised,
            totalTokensForSale,
            overallProgress: Math.round(overallProgress * 100) / 100
          }
        }
      };
    } catch (error) {
      console.error('Erro ao obter status da ICO:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Processar compra de tokens
  async processPurchase(walletAddress, amountInMatic, phase, txHash, affiliateCode = null) {
    try {
      const currentPhase = await ICOPhase.findOne({ phase, isActive: true, isCompleted: false });
      
      if (!currentPhase) {
        return {
          success: false,
          error: 'Fase não encontrada ou não está ativa'
        };
      }

      // Validar limites de compra
      if (amountInMatic < currentPhase.minPurchase) {
        return {
          success: false,
          error: `Valor mínimo: ${currentPhase.minPurchase} MATIC`
        };
      }

      if (amountInMatic > currentPhase.maxPurchase) {
        return {
          success: false,
          error: `Valor máximo: ${currentPhase.maxPurchase} MATIC`
        };
      }

      // Calcular tokens
      const baseTokens = amountInMatic / currentPhase.tokenPrice;
      const bonusTokens = baseTokens * (currentPhase.bonusPercentage / 100);
      const totalTokens = baseTokens + bonusTokens;

      // Verificar se há tokens suficientes
      const remainingTokens = currentPhase.totalTokens - currentPhase.tokensSold;
      if (totalTokens > remainingTokens) {
        return {
          success: false,
          error: 'Tokens insuficientes nesta fase'
        };
      }

      // Atualizar fase
      currentPhase.tokensSold += totalTokens;
      currentPhase.totalRaised += amountInMatic;
      
      // Verificar se a fase foi completada
      if (currentPhase.tokensSold >= currentPhase.totalTokens) {
        currentPhase.isCompleted = true;
        currentPhase.isActive = false;
        
        // Ativar próxima fase se existir
        const nextPhase = await ICOPhase.findOne({ phase: phase + 1 });
        if (nextPhase && !nextPhase.isActive) {
          nextPhase.isActive = true;
          await nextPhase.save();
        }
      }

      await currentPhase.save();

      return {
        success: true,
        purchase: {
          walletAddress,
          amountInMatic,
          baseTokens,
          bonusTokens,
          totalTokens,
          phase,
          txHash,
          affiliateCode,
          timestamp: new Date()
        }
      };
    } catch (error) {
      console.error('Erro ao processar compra:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Obter estatísticas da ICO
  async getICOStats() {
    try {
      const phases = await ICOPhase.find().sort({ phase: 1 });
      
      const stats = {
        totalPhases: phases.length,
        completedPhases: phases.filter(p => p.isCompleted).length,
        activePhase: phases.find(p => p.isActive),
        totalTokensSold: phases.reduce((sum, phase) => sum + phase.tokensSold, 0),
        totalRaised: phases.reduce((sum, phase) => sum + phase.totalRaised, 0),
        totalTokensForSale: phases.reduce((sum, phase) => sum + phase.totalTokens, 0),
        phases: phases.map(phase => ({
          phase: phase.phase,
          name: phase.name,
          tokenPrice: phase.tokenPrice,
          totalTokens: phase.totalTokens,
          tokensSold: phase.tokensSold,
          totalRaised: phase.totalRaised,
          progress: phase.totalTokens > 0 
            ? (phase.tokensSold / phase.totalTokens) * 100 
            : 0,
          isActive: phase.isActive,
          isCompleted: phase.isCompleted
        }))
      };

      stats.overallProgress = stats.totalTokensForSale > 0 
        ? (stats.totalTokensSold / stats.totalTokensForSale) * 100 
        : 0;

      return {
        success: true,
        stats
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas da ICO:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Ativar próxima fase manualmente (admin)
  async activateNextPhase() {
    try {
      const currentPhase = await ICOPhase.findOne({ isActive: true });
      
      if (currentPhase) {
        currentPhase.isActive = false;
        currentPhase.isCompleted = true;
        await currentPhase.save();
      }

      const nextPhase = await ICOPhase.findOne({ 
        phase: currentPhase ? currentPhase.phase + 1 : 1,
        isCompleted: false 
      });

      if (!nextPhase) {
        return {
          success: false,
          error: 'Não há próxima fase disponível'
        };
      }

      nextPhase.isActive = true;
      await nextPhase.save();

      return {
        success: true,
        message: `Fase ${nextPhase.phase} ativada com sucesso`,
        activePhase: nextPhase
      };
    } catch (error) {
      console.error('Erro ao ativar próxima fase:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Atualizar configurações de uma fase (admin)
  async updatePhase(phaseNumber, updates) {
    try {
      const phase = await ICOPhase.findOne({ phase: phaseNumber });
      
      if (!phase) {
        return {
          success: false,
          error: 'Fase não encontrada'
        };
      }

      // Campos permitidos para atualização
      const allowedFields = [
        'name', 'description', 'tokenPrice', 'totalTokens', 
        'bonusPercentage', 'minPurchase', 'maxPurchase', 
        'startDate', 'endDate'
      ];

      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          phase[field] = updates[field];
        }
      }

      await phase.save();

      return {
        success: true,
        message: 'Fase atualizada com sucesso',
        phase
      };
    } catch (error) {
      console.error('Erro ao atualizar fase:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verificar se ICO está ativa
  async isICOActive() {
    try {
      const activePhase = await ICOPhase.findOne({ isActive: true, isCompleted: false });
      return {
        success: true,
        isActive: !!activePhase,
        activePhase
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        isActive: false
      };
    }
  }
}

module.exports = new ICOService();

