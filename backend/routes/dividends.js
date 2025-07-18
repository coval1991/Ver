const express = require('express');
const dividendService = require('../utils/dividendService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Obter informações de dividendos para um holder
router.get('/info/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Endereço da carteira é obrigatório'
      });
    }

    const result = await dividendService.getDividendInfo(walletAddress);
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter informações de dividendos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Reivindicar dividendos
router.post('/claim', authenticateToken, async (req, res) => {
  try {
    const { walletAddress, distributionIds } = req.body;

    if (!walletAddress || !distributionIds || !Array.isArray(distributionIds)) {
      return res.status(400).json({
        success: false,
        error: 'Dados obrigatórios não fornecidos'
      });
    }

    const result = await dividendService.claimDividends(walletAddress, distributionIds);
    res.json(result);
  } catch (error) {
    console.error('Erro ao reivindicar dividendos:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Obter projeção de dividendos
router.get('/projection/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { monthlyProfit = 100000 } = req.query;

    const result = await dividendService.calculateDividendProjection(
      walletAddress, 
      parseFloat(monthlyProfit)
    );
    res.json(result);
  } catch (error) {
    console.error('Erro ao calcular projeção:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Obter distribuições públicas
router.get('/distributions', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const result = await dividendService.getDistributions(
      parseInt(page), 
      parseInt(limit)
    );
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter distribuições:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Obter estatísticas de dividendos
router.get('/stats', async (req, res) => {
  try {
    const result = await dividendService.getDividendStats();
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// === ROTAS ADMINISTRATIVAS ===

// Criar nova distribuição de dividendos (admin)
router.post('/admin/create-distribution', requireAdmin, async (req, res) => {
  try {
    const { totalAmount, notes } = req.body;

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valor total deve ser maior que zero'
      });
    }

    const result = await dividendService.createDistribution(totalAmount, notes);
    res.json(result);
  } catch (error) {
    console.error('Erro ao criar distribuição:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Obter snapshot de holders elegíveis (admin)
router.get('/admin/eligible-holders', requireAdmin, async (req, res) => {
  try {
    const result = await dividendService.getEligibleHoldersSnapshot();
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter snapshot:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Obter detalhes de uma distribuição específica (admin)
router.get('/admin/distribution/:distributionId', requireAdmin, async (req, res) => {
  try {
    const { distributionId } = req.params;
    
    const DividendDistribution = require('../models/DividendDistribution');
    const distribution = await DividendDistribution.findById(distributionId);

    if (!distribution) {
      return res.status(404).json({
        success: false,
        error: 'Distribuição não encontrada'
      });
    }

    res.json({
      success: true,
      distribution
    });
  } catch (error) {
    console.error('Erro ao obter distribuição:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Simular distribuição (admin)
router.post('/admin/simulate-distribution', requireAdmin, async (req, res) => {
  try {
    const { totalAmount } = req.body;

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valor total deve ser maior que zero'
      });
    }

    // Obter snapshot sem criar distribuição
    const snapshot = await dividendService.getEligibleHoldersSnapshot();
    
    if (!snapshot.success) {
      return res.json(snapshot);
    }

    // Calcular dividendos simulados
    const simulatedDividends = snapshot.holders.map(holder => {
      const sharePercentage = holder.cfdBalance / snapshot.totalTokensEligible;
      const dividendAmount = totalAmount * sharePercentage;

      return {
        walletAddress: holder.walletAddress,
        cfdBalance: holder.cfdBalance,
        sharePercentage: sharePercentage * 100,
        dividendAmount
      };
    });

    res.json({
      success: true,
      simulation: {
        totalAmount,
        eligibleHolders: snapshot.eligibleHolders,
        totalTokensEligible: snapshot.totalTokensEligible,
        simulatedDividends: simulatedDividends.sort((a, b) => b.dividendAmount - a.dividendAmount)
      }
    });
  } catch (error) {
    console.error('Erro ao simular distribuição:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;

