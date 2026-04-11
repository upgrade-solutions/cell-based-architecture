export function generateDockerfile(port = 3000): string {
  // Use `npm install` (not `npm ci`) because the api-cell is regenerated
  // frequently and ships without a checked-in package-lock.json. `npm ci`
  // would fail on first build with no lock file present.
  return `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN mkdir -p drizzle && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
EXPOSE ${port}
CMD ["node", "dist/main"]
`
}

export function generateDockerIgnore(): string {
  return `node_modules
dist
.env*
*.log
`
}
