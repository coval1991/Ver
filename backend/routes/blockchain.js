const express = require('express');
const { ethers } = require('ethers');
const contractService = require('../utils/contractService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Obter saldo CFD de uma carteira
router.get('/balance/cfd/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!contractService.isValidAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Endereço inválido'
      });
    }

    const result = await contractService.getCFDBalance(address);
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter saldo CFD:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Obter saldo USDT de uma carteira
router.get('/balance/usdt/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!contractService.isValidAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Endereço inválido'
      });
    }

    const result = await contractService.getUSDTBalance(address);
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter saldo USDT:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Obter saldo MATIC de uma carteira
router.get('/balance/matic/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!contractService.isValidAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Endereço inválido'
      });
    }

    const result = await contractService.getMaticBalance(address);
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter saldo MATIC:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Obter informações completas de uma carteira
router.get('/wallet/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!contractService.isValidAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Endereço inválido'
      });
    }

    const result = await contractService.getWalletInfo(address);
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter informações da carteira:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Verificar período de posse de tokens
router.get('/holding-period/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!contractService.isValidAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Endereço inválido'
      });
    }

    const result = await contractService.checkHoldingPeriod(address);
    res.json(result);
  } catch (error) {
    console.error('Erro ao verificar período de posse:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Obter preço do MATIC
router.get('/price/matic', async (req, res) => {
  try {
    const result = await contractService.getMaticPrice();
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter preço do MATIC:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Estimar gas fee
router.post('/estimate-gas', async (req, res) => {
  try {
    const { to, data = '0x' } = req.body;
    
    if (!contractService.isValidAddress(to)) {
      return res.status(400).json({
        success: false,
        error: 'Endereço de destino inválido'
      });
    }

    const result = await contractService.estimateGasFee(to, data);
    res.json(result);
  } catch (error) {
    console.error('Erro ao estimar gas fee:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Validar endereço
router.get('/validate-address/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const isValid = contractService.isValidAddress(address);
    
    res.json({
      success: true,
      isValid,
      address: isValid ? address : null
    });
  } catch (error) {
    console.error('Erro ao validar endereço:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Obter informações do token CFD
router.get('/token/cfd/info', async (req, res) => {
  try {
    const result = await contractService.getCFDTokenInfo();
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter informações do token CFD:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Verificar se um endereço é um contrato
router.get('/is-contract/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!contractService.isValidAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Endereço inválido'
      });
    }

    const result = await contractService.isContract(address);
    res.json(result);
  } catch (error) {
    console.error('Erro ao verificar contrato:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Obter histórico de transações CFD
router.get('/transactions/cfd/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 10 } = req.query;
    
    if (!contractService.isValidAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Endereço inválido'
      });
    }

    const result = await contractService.getCFDTransactionHistory(address, parseInt(limit));
    res.json(result);
  } catch (error) {
    console.error('Erro ao obter histórico de transações:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;

