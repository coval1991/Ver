const mongoose = require('mongoose');

const dividendDistributionSchema = new mongoose.Schema({
  distributionId: {
    type: String,
    required: true,
    unique: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    enum: ['USDT'],
    default: 'USDT'
  },
  eligibleHolders: {
    type: Number,
    required: true
  },
  totalCFDTokensEligible: {
    type: Number,
    required: true
  },
  amountPerToken: {
    type: Number,
    required: true
  },
  distributionDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  txHash: {
    type: String
  },
  blockNumber: {
    type: Number
  },
  gasUsed: {
    type: Number
  },
  recipients: [{
    walletAddress: {
      type: String,
      required: true,
      lowercase: true
    },
    cfdBalance: {
      type: Number,
      required: true
    },
    dividendAmount: {
      type: Number,
      required: true
    },
    claimed: {
      type: Boolean,
      default: false
    },
    claimTxHash: {
      type: String
    },
    claimDate: {
      type: Date
    }
  }],
  notes: {
    type: String
  },
  createdBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Método para calcular dividendos por endereço
dividendDistributionSchema.methods.calculateDividendForAddress = function(walletAddress, cfdBalance) {
  return cfdBalance * this.amountPerToken;
};

// Método para marcar dividendo como reivindicado
dividendDistributionSchema.methods.markAsClaimed = function(walletAddress, txHash) {
  const recipient = this.recipients.find(r => r.walletAddress === walletAddress.toLowerCase());
  if (recipient) {
    recipient.claimed = true;
    recipient.claimTxHash = txHash;
    recipient.claimDate = new Date();
    return true;
  }
  return false;
};

// Index para consultas rápidas
dividendDistributionSchema.index({ distributionDate: -1 });
dividendDistributionSchema.index({ status: 1 });
dividendDistributionSchema.index({ 'recipients.walletAddress': 1 });

module.exports = mongoose.model('DividendDistribution', dividendDistributionSchema);

