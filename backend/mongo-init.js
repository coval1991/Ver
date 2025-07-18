// Script de inicialização do MongoDB para CasinoFound

// Conectar ao banco de dados
db = db.getSiblingDB('casinofound');

// Criar usuário da aplicação
db.createUser({
  user: 'casinofound_user',
  pwd: 'casinofound_password_123',
  roles: [
    {
      role: 'readWrite',
      db: 'casinofound'
    }
  ]
});

// Criar coleções com validação
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['walletAddress', 'createdAt'],
      properties: {
        walletAddress: {
          bsonType: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          description: 'Endereço da carteira Ethereum válido'
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
          description: 'Email válido'
        },
        isAdmin: {
          bsonType: 'bool',
          description: 'Se o usuário é administrador'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Data de criação'
        }
      }
    }
  }
});

db.createCollection('transactions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['walletAddress', 'type', 'amount', 'currency', 'status', 'createdAt'],
      properties: {
        walletAddress: {
          bsonType: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$'
        },
        type: {
          bsonType: 'string',
          enum: ['ico_purchase', 'dividend_payment', 'affiliate_payment']
        },
        amount: {
          bsonType: 'number',
          minimum: 0
        },
        currency: {
          bsonType: 'string',
          enum: ['MATIC', 'USDT', 'CFD']
        },
        status: {
          bsonType: 'string',
          enum: ['pending', 'confirmed', 'failed']
        }
      }
    }
  }
});

db.createCollection('icophases', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['phase', 'name', 'tokenPrice', 'totalTokens', 'isActive'],
      properties: {
        phase: {
          bsonType: 'int',
          minimum: 1,
          maximum: 3
        },
        tokenPrice: {
          bsonType: 'number',
          minimum: 0
        },
        totalTokens: {
          bsonType: 'number',
          minimum: 0
        },
        tokensSold: {
          bsonType: 'number',
          minimum: 0
        }
      }
    }
  }
});

db.createCollection('dividenddistributions');

// Criar índices para performance
db.users.createIndex({ 'walletAddress': 1 }, { unique: true });
db.users.createIndex({ 'email': 1 }, { unique: true, sparse: true });
db.users.createIndex({ 'createdAt': 1 });

db.transactions.createIndex({ 'walletAddress': 1 });
db.transactions.createIndex({ 'type': 1 });
db.transactions.createIndex({ 'txHash': 1 }, { unique: true, sparse: true });
db.transactions.createIndex({ 'createdAt': -1 });

db.icophases.createIndex({ 'phase': 1 }, { unique: true });
db.icophases.createIndex({ 'isActive': 1 });

db.dividenddistributions.createIndex({ 'distributionDate': -1 });
db.dividenddistributions.createIndex({ 'status': 1 });

// Inserir dados iniciais das fases da ICO
db.icophases.insertMany([
  {
    phase: 1,
    name: 'Fase 1 - Early Bird',
    description: 'Primeira fase da ICO com maior desconto',
    tokenPrice: 0.01,
    totalTokens: 1680000,
    percentageOfSupply: 8,
    bonusPercentage: 20,
    minPurchase: 0.01,
    maxPurchase: 1000,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-06-30'),
    isActive: true,
    isCompleted: false,
    tokensSold: 0,
    totalRaised: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    phase: 2,
    name: 'Fase 2 - Public Sale',
    description: 'Segunda fase da ICO para o público geral',
    tokenPrice: 0.05,
    totalTokens: 4200000,
    percentageOfSupply: 20,
    bonusPercentage: 10,
    minPurchase: 0.01,
    maxPurchase: 500,
    startDate: new Date('2024-07-01'),
    endDate: new Date('2024-12-31'),
    isActive: false,
    isCompleted: false,
    tokensSold: 0,
    totalRaised: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    phase: 3,
    name: 'Fase 3 - Final Sale',
    description: 'Fase final da ICO após lançamento',
    tokenPrice: 1.00,
    totalTokens: 2100000,
    percentageOfSupply: 10,
    bonusPercentage: 0,
    minPurchase: 0.01,
    maxPurchase: 100,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-06-30'),
    isActive: false,
    isCompleted: false,
    tokensSold: 0,
    totalRaised: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

print('Banco de dados CasinoFound inicializado com sucesso!');
print('Usuário da aplicação criado: casinofound_user');
print('Coleções criadas com validação e índices');
print('Fases da ICO inseridas');

