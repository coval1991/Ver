const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware para verificar JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token de acesso requerido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Erro na autenticação:', error);
    return res.status(403).json({ error: 'Token inválido' });
  }
};

// Middleware para verificar se é admin
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ error: 'Acesso negado. Privilégios de admin requeridos.' });
    }
    next();
  } catch (error) {
    console.error('Erro na verificação de admin:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Middleware para verificar wallet ownership
const verifyWalletOwnership = async (req, res, next) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Endereço da wallet requerido' });
    }

    // Verificar se o usuário autenticado é dono da wallet
    if (req.user.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(403).json({ error: 'Você não tem permissão para acessar esta wallet' });
    }

    next();
  } catch (error) {
    console.error('Erro na verificação de propriedade da wallet:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Middleware para rate limiting simples
const rateLimiter = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  const requests = new Map();

  return (req, res, next) => {
    const clientId = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Limpar requests antigos
    if (requests.has(clientId)) {
      const clientRequests = requests.get(clientId).filter(time => time > windowStart);
      requests.set(clientId, clientRequests);
    }

    // Verificar limite
    const clientRequests = requests.get(clientId) || [];
    if (clientRequests.length >= maxRequests) {
      return res.status(429).json({ 
        error: 'Muitas requisições. Tente novamente mais tarde.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Adicionar nova requisição
    clientRequests.push(now);
    requests.set(clientId, clientRequests);

    next();
  };
};

module.exports = {
  authenticateToken,
  requireAdmin,
  verifyWalletOwnership,
  rateLimiter
};

