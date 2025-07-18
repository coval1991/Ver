const express = require('express');
const icoService = require('../utils/icoService');
const Transaction = require('../models/Transaction');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Obter status atual da ICO
router.get('/status', async (req, res) => {
  try {
    const result = await icoService.getICOStatus();
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter status da ICO:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Processar compra de tokens
router.post('/purchase', authenticateToken, async (req, res) => {
  try {
    const { walletAddress, amountInMatic, phase, txHash, affiliateCode } = req.body;

    // Validações básicas
    if (!walletAddress || !amountInMatic || !phase || !txHash) {
      return res.status(400).json({
        success: false,
        error: 'Dados obrigatórios não fornecidos'
      });
    }

    if (amountInMatic <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valor deve ser maior que zero'
      });
    }

    // Verificar se a transação já foi processada
    const existingTransaction = await Transaction.findOne({ 
      txHash,
      type: 'ico_purchase' 
    });

    if (existingTransaction) {
      return res.status(400).json({
        success: false,
        error: 'Transação já processada'
      });
    }

    // Processar compra
    const purchaseResult = await icoService.processPurchase(
      walletAddress, 
      amountInMatic, 
      phase, 
      txHash, 
      affiliateCode
    );

    if (!purchaseResult.success) {
      return res.status(400).json(purchaseResult);
    }

    // Salvar transação no banco
    const transaction = new Transaction({
      walletAddress,
      type: 'ico_purchase',
      amount: amountInMatic,
      currency: 'MATIC',
      tokensReceived: purchaseResult.purchase.totalTokens,
      icoPhase: phase,
      txHash,
      affiliateCode,
      status: 'confirmed',
      metadata: {
        baseTokens: purchaseResult.purchase.baseTokens,
        bonusTokens: purchaseResult.purchase.bonusTokens,
        bonusPercentage: phase === 1 ? 20 : phase === 2 ? 10 : 0
      }
    });

    await transaction.save();

    res.json({
      success: true,
      message: 'Compra processada com sucesso',
      purchase: purchaseResult.purchase,
      transaction: transaction._id
    });
  } catch (error) {
    console.error('Erro ao processar compra:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Obter histórico de compras de uma carteira
router.get('/purchases/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;
    
    const purchases = await Transaction.find({
      walletAddress,
      type: 'ico_purchase'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Transaction.countDocuments({
      walletAddress,
      type: 'ico_purchase'
    });

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      purchases,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Erro ao obter histórico de compras:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Obter estatísticas da ICO
router.get('/stats', async (req, res) => {
  try {
    const result = await icoService.getICOStats();
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter estatísticas da ICO:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Verificar se ICO está ativa
router.get('/is-active', async (req, res) => {
  try {
    const result = await icoService.isICOActive();
    res.json(result);
  } catch (error) {
    console.error('Erro ao verificar status da ICO:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// === ROTAS ADMINISTRATIVAS ===

// Inicializar fases da ICO (admin)
router.post('/admin/initialize', requireAdmin, async (req, res) => {
  try {
    const result = await icoService.initializePhases();
    res.json(result);
  } catch (error) {
    console.error('Erro ao inicializar fases:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Ativar próxima fase (admin)
router.post('/admin/activate-next-phase', requireAdmin, async (req, res) => {
  try {
    const result = await icoService.activateNextPhase();
    res.json(result);
  } catch (error) {
    console.error('Erro ao ativar próxima fase:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Atualizar configurações de uma fase (admin)
router.put('/admin/phase/:phaseNumber', requireAdmin, async (req, res) => {
  try {
    const { phaseNumber } = req.params;
    const updates = req.body;

    const result = await icoService.updatePhase(parseInt(phaseNumber), updates);
    res.json(result);
  } catch (error) {
    console.error('Erro ao atualizar fase:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Obter estatísticas detalhadas para admin
router.get('/admin/detailed-stats', requireAdmin, async (req, res) => {
  try {
    const [icoStats, recentPurchases, topBuyers] = await Promise.all([
      icoService.getICOStats(),
      Transaction.find({ type: 'ico_purchase' })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('walletAddress'),
      Transaction.aggregate([
        { $match: { type: 'ico_purchase' } },
        { 
          $group: { 
            _id: '$walletAddress', 
            totalSpent: { $sum: '$amount' },
            totalTokens: { $sum: '$tokensReceived' },
            purchaseCount: { $sum: 1 }
          } 
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 10 }
      ])
    ]);

    res.json({
      success: true,
      stats: icoStats.success ? icoStats.stats : null,
      recentPurchases,
      topBuyers
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas detalhadas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;

