# 阶段 1: 构建 H5 前端
FROM node:22-slim AS h5-builder
WORKDIR /build
COPY h5/package.json h5/package-lock.json* ./
RUN npm install
COPY h5/ ./
RUN npm run build

# 阶段 2: 运行时
FROM node:22-slim
WORKDIR /app

# 安装服务端依赖
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --production

# 复制服务端代码
COPY server/ ./server/

# 复制构建好的 H5 前端
COPY --from=h5-builder /build/dist ./h5/dist/

EXPOSE 3210

CMD ["node", "server/index.js"]
