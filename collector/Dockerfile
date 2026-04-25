FROM node:20-alpine

# Build tools for any native modules (multer + pdf-parse have none,
# but keeping this consistent with server in case deps change)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json yarn.lock ./
COPY collector/package.json ./collector/

RUN yarn workspace anything-llm-collector install --frozen-lockfile --production

COPY collector/ ./collector/

WORKDIR /app/collector

EXPOSE 8888

CMD ["node", "index.js"]
