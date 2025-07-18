const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const blockchainService = require('../utils/blockchain');
const { authenticateToken, verifyWalletOwnership } = require('../middleware/auth');

const router = express.Router();

// Verificar wallet e saldo
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Endereço da wallet é obrigatório' });
    }

    if (!blockchainService.isValidAddress(walletAddress)) {
      return res.status(400).json({ error: 'Endereço da wallet inválido' });
    }

    // Obter saldos atualizados
    const cfdBalance = await blockchainService.getCFDBalance(walletAddress);
    const usdtBalance = await blockchainService.getUSDTBalance(walletAddress);

    // Verificar período de posse
    const holdingInfo = await blockchainService.checkHoldingPeriod(walletAddress);

    // Atualizar usuário no banco
    const user = await User.findOne({ 
      walletAddress: walletAddress.toLowerCase() 
    });

    if (user) {
      user.cfdBalance = parseFloat(cfdBalance);
      if (holdingInfo.firstPurchase && !user.firstTokenPurchase) {
        user.firstTokenPurchase = holdingInfo.firstPurchase;
      }
      await user.save();
    }

    res.json({
      success: true,
      wallet: {
        address: walletAddress,
        cfdBalance: parseFloat(cfdBalance),
        usdtBalance: parseFloat(usdtBalance),
        isEligibleForDividends: holdingInfo.eligible,
        firstTokenPurchase: holdingInfo.firstPurchase,
        holdingPeriodDays: holdingInfo.firstPurchase ? 
          Math.floor((Date.now() - holdingInfo.firstPurchase.getTime()) / (1000 * 60 * 60 * 24)) : 0
      }
    });

  } catch (error) {
    console.error('Erro ao verificar wallet:', error);
    res.status(500).json({ error: 'Erro ao verificar wallet' });
  }
});

// Obter histórico de transações
router.get('/transactions/:walletAddress', authenticateToken, async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { page = 1, limit = 20, type } = req.query;

    if (!blockchainService.isValidAddress(walletAddress)) {
      return res.status(400).json({ error: 'Endereço da wallet inválido' });
    }

    // Verificar se o usuário tem permissão para ver essas transações
    if (req.user.walletAddress.toLowerCase() !== walletAddress.toLowerCase() && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const query = { walletAddress: walletAddress.toLowerCase() };
    if (type) {
      query.type = type;
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Erro ao obter transações:', error);
    res.status(500).json({ error: 'Erro ao obter histórico de transações' });
  }
});

// Obter estatísticas da wallet
router.get('/stats/:walletAddress', authenticateToken, async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!blockchainService.isValidAddress(walletAddress)) {
      return res.status(400).json({ error: 'Endereço da wallet inválido' });
    }

    // Verificar permissão
    if (req.user.walletAddress.toLowerCase() !== walletAddress.toLowerCase() && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar estatísticas das transações
    const stats = await Transaction.aggregate([
      { $match: { walletAddress: walletAddress.toLowerCase() } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Buscar dados do usuário
    const user = await User.findOne({ 
      walletAddress: walletAddress.toLowerCase() 
    });

    const response = {
      success: true,
      stats: {
        totalTransactions: stats.reduce((sum, s) => sum + s.count, 0),
        totalDividendsReceived: user ? user.totalDividendsReceived : 0,
        totalAffiliateEarnings: user ? user.totalAffiliateEarnings : 0,
        cfdBalance: user ? user.cfdBalance : 0,
        isEligibleForDividends: user ? user.isEligibleForDividends : false,
        transactionsByType: stats
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: 'Erro ao obter estatísticas da wallet' });
  }
});

// Atualizar saldo manualmente
router.post('/refresh-balance', authenticateToken, verifyWalletOwnership, async (req, res) => {
  try {
    const { walletAddress } = req.body;

    // Obter saldos atualizados da blockchain
    const cfdBalance = await blockchainService.getCFDBalance(walletAddress);
    const usdtBalance = await blockchainService.getUSDTBalance(walletAddress);
    const holdingInfo = await blockchainService.checkHoldingPeriod(walletAddress);

    // Atualizar no banco de dados
    const user = await User.findOne({ 
      walletAddress: walletAddress.toLowerCase() 
    });

    if (user) {
      user.cfdBalance = parseFloat(cfdBalance);
      if (holdingInfo.firstPurchase && !user.firstTokenPurchase) {
        user.firstTokenPurchase = holdingInfo.firstPurchase;
      }
      await user.save();
    }

    res.json({
      success: true,
      message: 'Saldo atualizado com sucesso',
      balances: {
        cfd: parseFloat(cfdBalance),
        usdt: parseFloat(usdtBalance),
        isEligibleForDividends: holdingInfo.eligible
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar saldo:', error);
    res.status(500).json({ error: 'Erro ao atualizar saldo' });
  }
});

module.exports = router;

