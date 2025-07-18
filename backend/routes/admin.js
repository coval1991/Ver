const express = require("express");
const multer = require("multer");
const path = require("path");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const DividendDistribution = require("../models/DividendDistribution");
const ICOPhase = require("../models/ICOPhase");
const blockchainService = require("../utils/blockchain");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Apenas arquivos PDF, DOC, DOCX e TXT são permitidos"));
    }
  },
});

// Middleware para todas as rotas admin
router.use(authenticateToken, requireAdmin);

// Dashboard - estatísticas gerais
router.get("/dashboard", async (req, res) => {
  try {
    // Estatísticas de usuários
    const totalUsers = await User.countDocuments({});
    const eligibleHolders = await User.countDocuments({
      isEligibleForDividends: true,
    });
    const totalCFDHolders = await User.countDocuments({ cfdBalance: { $gt: 0 } });

    // Estatísticas de transações
    const totalTransactions = await Transaction.countDocuments({});
    const icoTransactions = await Transaction.countDocuments({ type: "ico_purchase" });
    const dividendTransactions = await Transaction.countDocuments({ type: "dividend_payment" });

    // Estatísticas de ICO
    const icoStats = await Transaction.aggregate([
      { $match: { type: "ico_purchase" } },
      {
        $group: {
          _id: "$icoPhase",
          totalSold: { $sum: "$tokensReceived" },
          totalRaised: { $sum: "$amount" },
          transactions: { $sum: 1 },
        },
      },
    ]);

    // Estatísticas de dividendos
    const dividendStats = await DividendDistribution.aggregate([
      {
        $group: {
          _id: null,
          totalDistributed: { $sum: "$totalAmount" },
          totalDistributions: { $sum: 1 },
        },
      },
    ]);

    // Obter holders elegíveis da blockchain
    let blockchainHolders = [];
    try {
      blockchainHolders = await blockchainService.getEligibleHolders();
    } catch (error) {
      console.error("Erro ao obter holders da blockchain:", error);
    }

    res.json({
      success: true,
      dashboard: {
        users: {
          total: totalUsers,
          cfdHolders: totalCFDHolders,
          eligibleForDividends: eligibleHolders,
          blockchainEligible: blockchainHolders.length,
        },
        transactions: {
          total: totalTransactions,
          ico: icoTransactions,
          dividends: dividendTransactions,
        },
        ico: {
          phases: icoStats,
          totalTokensSold: icoStats.reduce((sum, phase) => sum + phase.totalSold, 0),
          totalRaised: icoStats.reduce((sum, phase) => sum + phase.totalRaised, 0),
        },
        dividends: {
          totalDistributed: dividendStats[0]?.totalDistributed || 0,
          totalDistributions: dividendStats[0]?.totalDistributions || 0,
        },
      },
    });
  } catch (error) {
    console.error("Erro ao obter dashboard:", error);
    res.status(500).json({ error: "Erro ao obter dados do dashboard" });
  }
});

// Obter snapshot de holders elegíveis
router.get("/snapshot", async (req, res) => {
  try {
    // Obter holders do banco de dados
    const dbHolders = await User.find({
      cfdBalance: { $gt: 0 },
    }).select("walletAddress cfdBalance isEligibleForDividends firstTokenPurchase");

    // Obter holders da blockchain
    let blockchainHolders = [];
    try {
      blockchainHolders = await blockchainService.getEligibleHolders();
    } catch (error) {
      console.error("Erro ao obter holders da blockchain:", error);
    }

    // Combinar dados
    const combinedHolders = dbHolders.map((dbHolder) => {
      const blockchainHolder = blockchainHolders.find(
        (bh) => bh.address.toLowerCase() === dbHolder.walletAddress.toLowerCase()
      );

      return {
        walletAddress: dbHolder.walletAddress,
        cfdBalance: blockchainHolder ? blockchainHolder.balance : dbHolder.cfdBalance,
        isEligibleForDividends: blockchainHolder
          ? blockchainHolder.eligible
          : dbHolder.isEligibleForDividends,
        firstTokenPurchase: blockchainHolder
          ? blockchainHolder.firstPurchase
          : dbHolder.firstTokenPurchase,
        source: blockchainHolder ? "blockchain" : "database",
      };
    });

    // Adicionar holders que estão apenas na blockchain
    blockchainHolders.forEach((bh) => {
      const exists = combinedHolders.find(
        (ch) => ch.walletAddress.toLowerCase() === bh.address.toLowerCase()
      );

      if (!exists) {
        combinedHolders.push({
          walletAddress: bh.address,
          cfdBalance: bh.balance,
          isEligibleForDividends: bh.eligible,
          firstTokenPurchase: bh.firstPurchase,
          source: "blockchain_only",
        });
      }
    });

    // Filtrar apenas elegíveis
    const eligibleHolders = combinedHolders.filter((h) => h.isEligibleForDividends);
    const totalTokens = eligibleHolders.reduce((sum, h) => sum + h.cfdBalance, 0);

    res.json({
      success: true,
      snapshot: {
        timestamp: new Date().toISOString(),
        totalHolders: combinedHolders.length,
        eligibleHolders: eligibleHolders.length,
        totalTokensEligible: totalTokens,
        holders: eligibleHolders,
      },
    });
  } catch (error) {
    console.error("Erro ao obter snapshot:", error);
    res.status(500).json({ error: "Erro ao obter snapshot de holders" });
  }
});

// Criar distribuição de dividendos
router.post("/create-dividend-distribution", async (req, res) => {
  try {
    const { totalAmount, notes } = req.body;

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ error: "Valor total deve ser maior que zero" });
    }

    // Obter holders elegíveis
    const eligibleHolders = await blockchainService.getEligibleHolders();

    if (eligibleHolders.length === 0) {
      return res.status(400).json({ error: "Nenhum holder elegível encontrado" });
    }

    // Simular distribuição
    const simulation = await blockchainService.simulateDividendDistribution(
      totalAmount,
      eligibleHolders
    );

    // Criar distribuição no banco
    const distributionId = `DIV-${Date.now()}`;
    const distribution = new DividendDistribution({
      distributionId,
      totalAmount: totalAmount,
      eligibleHolders: eligibleHolders.length,
      totalCFDTokensEligible: simulation.totalTokens,
      amountPerToken: simulation.amountPerToken,
      recipients: simulation.distribution.map((d) => ({
        walletAddress: d.address,
        cfdBalance: d.cfdBalance,
        dividendAmount: d.dividendAmount,
      })),
      notes: notes || "",
      createdBy: req.user.walletAddress,
      status: "pending",
    });

    await distribution.save();

    res.json({
      success: true,
      message: "Distribuição de dividendos criada com sucesso",
      distribution: {
        distributionId: distribution.distributionId,
        totalAmount: distribution.totalAmount,
        eligibleHolders: distribution.eligibleHolders,
        amountPerToken: distribution.amountPerToken,
        status: distribution.status,
      },
    });
  } catch (error) {
    console.error("Erro ao criar distribuição:", error);
    res.status(500).json({ error: "Erro ao criar distribuição de dividendos" });
  }
});

// Listar todas as distribuições
router.get("/dividend-distributions", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const distributions = await DividendDistribution.find({})
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await DividendDistribution.countDocuments({});

    res.json({
      success: true,
      distributions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Erro ao listar distribuições:", error);
    res.status(500).json({ error: "Erro ao listar distribuições" });
  }
});

// Upload de relatório financeiro
router.post("/upload-report", upload.single("report"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo foi enviado" });
    }

    const { title, description } = req.body;

    // Aqui você pode salvar informações do relatório no banco de dados
    // Por simplicidade, apenas retornamos o caminho do arquivo

    res.json({
      success: true,
      message: "Relatório enviado com sucesso",
      file: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        title: title || req.file.originalname,
        description: description || "",
        uploadDate: new Date(),
      },
    });
  } catch (error) {
    console.error("Erro no upload:", error);
    res.status(500).json({ error: "Erro ao fazer upload do relatório" });
  }
});

// Enviar notificação para holders
router.post("/send-notification", async (req, res) => {
  try {
    const { message, type = "info", targetGroup = "all" } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Mensagem é obrigatória" });
    }

    let query = {};

    switch (targetGroup) {
      case "eligible":
        query = { isEligibleForDividends: true };
        break;
      case "holders":
        query = { cfdBalance: { $gt: 0 } };
        break;
      case "all":
      default:
        query = {};
        break;
    }

    // Adicionar notificação para usuários selecionados
    const result = await User.updateMany(
      query,
      {
        $push: {
          notifications: {
            message: message,
            type: type,
            read: false,
            createdAt: new Date(),
          },
        },
      }
    );

    res.json({
      success: true,
      message: `Notificação enviada para ${result.modifiedCount} usuários`,
      targetGroup: targetGroup,
      usersNotified: result.modifiedCount,
    });
  } catch (error) {
    console.error("Erro ao enviar notificação:", error);
    res.status(500).json({ error: "Erro ao enviar notificação" });
  }
});

// Obter estatísticas detalhadas de ICO
router.get("/ico-stats", async (req, res) => {
  try {
    const phases = await ICOPhase.find({}).sort({ phase: 1 });

    const stats = await Promise.all(
      phases.map(async (phase) => {
        const transactions = await Transaction.find({
          type: "ico_purchase",
          icoPhase: phase.phase,
        });

        const totalSold = transactions.reduce((sum, tx) => sum + tx.tokensReceived, 0);
        const totalRaised = transactions.reduce((sum, tx) => sum + tx.amount, 0);

        return {
          phase: phase.phase,
          name: phase.name,
          tokenPrice: phase.tokenPrice,
          totalTokens: phase.totalTokens,
          tokensSold: totalSold,
          tokensRemaining: phase.totalTokens - totalSold,
          totalRaised: totalRaised,
          progress: (totalSold / phase.totalTokens) * 100,
          isActive: phase.isActive,
          isCompleted: phase.isCompleted,
          transactions: transactions.length,
        };
      })
    );

    res.json({
      success: true,
      icoStats: stats,
    });
  } catch (error) {
    console.error("Erro ao obter estatísticas de ICO:", error);
    res.status(500).json({ error: "Erro ao obter estatísticas de ICO" });
  }
});

module.exports = router;


