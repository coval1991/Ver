const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: false, // Não é obrigatório para usuários normais
  },
  email: {
    type: String,
    sparse: true,
    lowercase: true,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  cfdBalance: {
    type: Number,
    default: 0,
  },
  firstTokenPurchase: {
    type: Date,
    default: null,
  },
  totalDividendsReceived: {
    type: Number,
    default: 0,
  },
  lastDividendClaim: {
    type: Date,
    default: null,
  },
  affiliateCode: {
    type: String,
    unique: true,
    sparse: true,
  },
  referredBy: {
    type: String,
    default: null,
  },
  totalAffiliateEarnings: {
    type: Number,
    default: 0,
  },
  isEligibleForDividends: {
    type: Boolean,
    default: false,
  },
  kycVerified: {
    type: Boolean,
    default: false,
  },
  notifications: [
    {
      message: String,
      type: {
        type: String,
        enum: ["info", "success", "warning", "error"],
        default: "info",
      },
      read: {
        type: Boolean,
        default: false,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
}, {
  timestamps: true,
});

// Método para verificar elegibilidade para dividendos (30+ dias)
userSchema.methods.checkDividendEligibility = function () {
  if (!this.firstTokenPurchase) return false;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return this.firstTokenPurchase <= thirtyDaysAgo && this.cfdBalance > 0;
};

// Método para gerar código de afiliado único
userSchema.methods.generateAffiliateCode = function () {
  const code =
    this.walletAddress.slice(2, 8).toUpperCase() +
    Math.random().toString(36).substring(2, 6).toUpperCase();
  this.affiliateCode = code;
  return code;
};

// Middleware para atualizar elegibilidade antes de salvar
userSchema.pre("save", function (next) {
  this.isEligibleForDividends = this.checkDividendEligibility();
  next();
});

module.exports = mongoose.model("User", userSchema);


