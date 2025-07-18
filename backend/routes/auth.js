const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// @route   POST /api/auth/register-admin
// @desc    Registrar um usuário administrador (apenas para configuração inicial)
// @access  Public (deve ser protegido em produção)
router.post("/register-admin", async (req, res) => {
  const { walletAddress, password } = req.body;

  try {
    let user = await User.findOne({ walletAddress });

    if (user) {
      return res.status(400).json({ msg: "Usuário já existe" });
    }

    // Hash da senha apenas se uma senha for fornecida
    let hashedPassword = null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    user = new User({
      walletAddress,
      password: hashedPassword, // Armazena a senha hash
      isAdmin: true, // Define como admin
    });

    await user.save();

    res.status(201).json({ msg: "Usuário administrador registrado com sucesso" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erro no servidor");
  }
});

// @route   POST /api/auth/login-admin
// @desc    Autenticar usuário administrador e obter token
// @access  Public
router.post("/login-admin", async (req, res) => {
  const { walletAddress, password } = req.body;

  try {
    let user = await User.findOne({ walletAddress });

    // Verifica se o usuário existe e se é admin
    if (!user || !user.isAdmin) {
      return res.status(400).json({ msg: "Credenciais inválidas" });
    }

    // Verifica a senha apenas se o usuário tiver uma senha definida
    if (user.password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: "Credenciais inválidas" });
      }
    } else {
      // Se o admin não tiver senha, ele não pode fazer login por esta rota
      return res.status(400).json({ msg: "Admin não configurado com senha para login." });
    }

    const payload = {
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        isAdmin: user.isAdmin,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Erro no servidor");
  }
});

module.exports = router;


