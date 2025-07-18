const mongoose = require('mongoose');

const icoPhaseSchema = new mongoose.Schema({
  phase: {
    type: Number,
    required: true,
    unique: true,
    min: 1,
    max: 3
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  tokenPrice: {
    type: Number,
    required: true
  },
  totalTokens: {
    type: Number,
    required: true
  },
  tokensSold: {
    type: Number,
    default: 0
  },
  tokensRemaining: {
    type: Number,
    required: true
  },
  percentageOfSupply: {
    type: Number,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  minPurchase: {
    type: Number,
    default: 0.01 // em MATIC
  },
  maxPurchase: {
    type: Number,
    default: 1000 // em MATIC
  },
  bonusPercentage: {
    type: Number,
    default: 0
  },
  contractAddress: {
    type: String,
    required: true,
    lowercase: true
  }
}, {
  timestamps: true
});

// Método para verificar se a fase está ativa
icoPhaseSchema.methods.checkIfActive = function() {
  const now = new Date();
  return now >= this.startDate && now <= this.endDate && !this.isCompleted;
};

// Método para calcular progresso da fase
icoPhaseSchema.methods.getProgress = function() {
  return (this.tokensSold / this.totalTokens) * 100;
};

// Middleware para atualizar status antes de salvar
icoPhaseSchema.pre('save', function(next) {
  this.tokensRemaining = this.totalTokens - this.tokensSold;
  this.isActive = this.checkIfActive();
  
  if (this.tokensSold >= this.totalTokens) {
    this.isCompleted = true;
    this.isActive = false;
  }
  
  next();
});

module.exports = mongoose.model('ICOPhase', icoPhaseSchema);

