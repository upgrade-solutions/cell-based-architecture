export function generateDockerfile(): string {
  // Use `npm install` (not `npm ci`) because the ui-cell is regenerated
  // frequently and ships without a checked-in package-lock.json. `npm ci`
  // would fail on first build with no lock file present.
  return `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 5174
CMD ["node", "server.js"]
`
}

export function generateDockerIgnore(): string {
  return `node_modules
.next
out
.env*
*.log
`
}
