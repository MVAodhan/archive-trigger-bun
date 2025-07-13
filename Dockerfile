FROM oven/bun:1 AS base
WORKDIR /

COPY package.json ./
RUN bunx puppeteer browsers install chrome
RUN bun install


COPY . .

EXPOSE 3002/tcp 3000
ENTRYPOINT ["bun", "run", "src/index.ts"]