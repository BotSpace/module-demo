FROM node:22-alpine

# Non-root (sandbox)
WORKDIR /app
COPY package.json server.js ./

# Zero dependency — npm install kerak emas.
ENV PORT=8100
EXPOSE 8100
USER node

CMD ["node", "server.js"]
