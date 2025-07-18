# Dockerfile para o Backend CasinoFound
FROM node:20-alpine

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY backend/package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código fonte
COPY backend/ .

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Alterar propriedade dos arquivos
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expor porta
EXPOSE 5000

# Comando de inicialização
CMD ["npm", "start"]

