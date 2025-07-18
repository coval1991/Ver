#!/bin/bash

# Script de Instalação do CasinoFound
# Este script configura e inicia o projeto CasinoFound

set -e

echo "🚀 Iniciando instalação do CasinoFound..."

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não encontrado. Instalando Docker..."
    
    # Instalar Docker (Ubuntu/Debian)
    sudo apt-get update
    sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io
    
    # Adicionar usuário ao grupo docker
    sudo usermod -aG docker $USER
    echo "✅ Docker instalado com sucesso!"
fi

# Verificar se Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose não encontrado. Instalando..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose instalado com sucesso!"
fi

# Verificar se o arquivo .env existe
if [ ! -f .env ]; then
    echo "📝 Criando arquivo .env..."
    cp .env.production .env
    echo "⚠️  IMPORTANTE: Edite o arquivo .env com suas configurações antes de continuar!"
    echo "   - Altere as senhas do banco de dados"
    echo "   - Configure sua chave JWT"
    echo "   - Defina o endereço do admin"
    read -p "Pressione Enter após editar o arquivo .env..."
fi

# Criar diretórios necessários
echo "📁 Criando diretórios..."
mkdir -p backend/uploads
mkdir -p logs
mkdir -p data/mongodb
mkdir -p data/redis

# Definir permissões
chmod 755 backend/uploads
chmod 755 logs

echo "🔧 Configurando ambiente..."

# Verificar se as portas estão disponíveis
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "❌ Porta $1 já está em uso!"
        echo "   Pare o serviço que está usando esta porta ou altere a configuração."
        exit 1
    fi
}

echo "🔍 Verificando portas..."
check_port 80
check_port 5000
check_port 27017

echo "🐳 Construindo imagens Docker..."
docker-compose build --no-cache

echo "🚀 Iniciando serviços..."
docker-compose up -d

echo "⏳ Aguardando serviços iniciarem..."
sleep 30

# Verificar se os serviços estão rodando
echo "🔍 Verificando status dos serviços..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ Serviços iniciados com sucesso!"
else
    echo "❌ Erro ao iniciar serviços. Verificando logs..."
    docker-compose logs
    exit 1
fi

# Testar conectividade
echo "🧪 Testando conectividade..."

# Testar backend
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "✅ Backend respondendo na porta 5000"
else
    echo "⚠️  Backend pode não estar respondendo ainda. Aguarde alguns minutos."
fi

# Testar frontend
if curl -f http://localhost > /dev/null 2>&1; then
    echo "✅ Frontend respondendo na porta 80"
else
    echo "⚠️  Frontend pode não estar respondendo ainda. Aguarde alguns minutos."
fi

echo ""
echo "🎉 Instalação concluída!"
echo ""
echo "📋 Informações importantes:"
echo "   • Frontend: http://localhost"
echo "   • Backend API: http://localhost:5000"
echo "   • MongoDB: localhost:27017"
echo ""
echo "🔧 Comandos úteis:"
echo "   • Ver logs: docker-compose logs -f"
echo "   • Parar serviços: docker-compose down"
echo "   • Reiniciar: docker-compose restart"
echo "   • Atualizar: docker-compose pull && docker-compose up -d"
echo ""
echo "⚠️  Lembre-se de:"
echo "   • Configurar seu domínio e SSL em produção"
echo "   • Fazer backup regular do banco de dados"
echo "   • Monitorar os logs regularmente"
echo ""
echo "📚 Para mais informações, consulte o README.md"

