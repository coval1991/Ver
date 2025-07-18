const { ethers } = require('ethers');
require('dotenv').config();

// Configuração da rede Polygon
const POLYGON_RPC = 'https://polygon-rpc.com';
const provider = new ethers.JsonRpcProvider(POLYGON_RPC);

// Endereços dos contratos
const CONTRACTS = {
  CFD_TOKEN: '0x7fE9eE1975263998D7BfD7ed46CAD44Ee62A63bE',
  AFFILIATE_MANAGER: '0x2f6737CFDE18D201C3300C1C87e70f620C38F68C',
  ICO_PHASE1: '0x8008A571414ebAF2f965a5a8d34D78cEfa8BD8bD',
  USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
};

// ABIs básicas para testes
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)"
];

const ICO_ABI = [
  "function payAffiliate(address payable affiliate, uint256 amount) payable"
];

async function testContracts() {
  console.log('🔍 Testando conexão com contratos na Polygon...\n');

  try {
    // Testar rede
    const network = await provider.getNetwork();
    console.log(`✅ Conectado à rede: ${network.name} (Chain ID: ${network.chainId})`);

    // Testar contrato CFD Token
    console.log('\n📊 Testando contrato CFD Token...');
    const cfdContract = new ethers.Contract(CONTRACTS.CFD_TOKEN, ERC20_ABI, provider);
    
    try {
      const name = await cfdContract.name();
      const symbol = await cfdContract.symbol();
      const decimals = await cfdContract.decimals();
      const totalSupply = await cfdContract.totalSupply();
      
      console.log(`   Nome: ${name}`);
      console.log(`   Símbolo: ${symbol}`);
      console.log(`   Decimais: ${decimals}`);
      console.log(`   Total Supply: ${ethers.formatEther(totalSupply)} ${symbol}`);
    } catch (error) {
      console.log(`   ❌ Erro ao acessar contrato CFD: ${error.message}`);
    }

    // Testar contrato USDT
    console.log('\n💰 Testando contrato USDT...');
    const usdtContract = new ethers.Contract(CONTRACTS.USDT, ERC20_ABI, provider);
    
    try {
      const name = await usdtContract.name();
      const symbol = await usdtContract.symbol();
      const decimals = await usdtContract.decimals();
      
      console.log(`   Nome: ${name}`);
      console.log(`   Símbolo: ${symbol}`);
      console.log(`   Decimais: ${decimals}`);
    } catch (error) {
      console.log(`   ❌ Erro ao acessar contrato USDT: ${error.message}`);
    }

    // Testar contrato ICO
    console.log('\n🚀 Testando contrato ICO Fase 1...');
    const icoContract = new ethers.Contract(CONTRACTS.ICO_PHASE1, ICO_ABI, provider);
    
    try {
      // Verificar se o contrato existe
      const code = await provider.getCode(CONTRACTS.ICO_PHASE1);
      if (code === '0x') {
        console.log('   ❌ Contrato ICO não encontrado no endereço especificado');
      } else {
        console.log('   ✅ Contrato ICO encontrado');
        console.log(`   Endereço: ${CONTRACTS.ICO_PHASE1}`);
      }
    } catch (error) {
      console.log(`   ❌ Erro ao acessar contrato ICO: ${error.message}`);
    }

    // Testar contrato Affiliate Manager
    console.log('\n👥 Testando contrato Affiliate Manager...');
    try {
      const code = await provider.getCode(CONTRACTS.AFFILIATE_MANAGER);
      if (code === '0x') {
        console.log('   ❌ Contrato Affiliate Manager não encontrado no endereço especificado');
      } else {
        console.log('   ✅ Contrato Affiliate Manager encontrado');
        console.log(`   Endereço: ${CONTRACTS.AFFILIATE_MANAGER}`);
      }
    } catch (error) {
      console.log(`   ❌ Erro ao acessar contrato Affiliate Manager: ${error.message}`);
    }

    console.log('\n✅ Teste de contratos concluído!');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Função para testar saldo de uma carteira específica
async function testWalletBalance(walletAddress) {
  if (!walletAddress) {
    console.log('❌ Endereço de carteira não fornecido');
    return;
  }

  console.log(`\n🔍 Testando saldos da carteira: ${walletAddress}\n`);

  try {
    // Saldo MATIC
    const maticBalance = await provider.getBalance(walletAddress);
    console.log(`MATIC: ${ethers.formatEther(maticBalance)}`);

    // Saldo CFD
    const cfdContract = new ethers.Contract(CONTRACTS.CFD_TOKEN, ERC20_ABI, provider);
    const cfdBalance = await cfdContract.balanceOf(walletAddress);
    console.log(`CFD: ${ethers.formatEther(cfdBalance)}`);

    // Saldo USDT
    const usdtContract = new ethers.Contract(CONTRACTS.USDT, ERC20_ABI, provider);
    const usdtBalance = await usdtContract.balanceOf(walletAddress);
    const usdtDecimals = await usdtContract.decimals();
    console.log(`USDT: ${ethers.formatUnits(usdtBalance, usdtDecimals)}`);

  } catch (error) {
    console.error('❌ Erro ao obter saldos:', error.message);
  }
}

// Executar testes
async function main() {
  await testContracts();
  
  // Testar com uma carteira específica se fornecida
  const testWallet = process.argv[2];
  if (testWallet) {
    await testWalletBalance(testWallet);
  } else {
    console.log('\n💡 Para testar saldos de uma carteira específica, execute:');
    console.log('node test-contracts.js 0xSeuEnderecoDeCarteira');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testContracts,
  testWalletBalance,
  CONTRACTS,
  provider
};

