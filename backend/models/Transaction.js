const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  type: {
    type: String,
    enum: ['ico_purchase', 'dividend_payment', 'affiliate_payment', 'token_transfer'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    enum: ['CFD', 'USDT', 'MATIC', 'ETH'],
    required: true
  },
  txHash: {
    type: String,
    required: true,
    unique: true
  },
  blockNumber: {
    type: Number,
    required: true
  },
  icoPhase: {
    type: Number,
    min: 1,
    max: 3,
    required: function() {
      return this.type === 'ico_purchase';
    }
  },
  tokenPrice: {
    type: Number,
    required: function() {
      return this.type === 'ico_purchase';
    }
  },
  tokensReceived: {
    type: Number,
    required: function() {
      return this.type === 'ico_purchase';
    }
  },
  affiliateAddress: {
    type: String,
    lowercase: true
  },
  affiliateCommission: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending'
  },
  gasUsed: {
    type: Number
  },
  gasFee: {
    type: Number
  }
}, {
  timestamps: true
});

// Index para consultas rápidas
transactionSchema.index({ walletAddress: 1, type: 1 });
transactionSchema.index({ txHash: 1 });
transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);

