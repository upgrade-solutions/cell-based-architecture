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

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`
}

export function generateNginxConf(): string {
  return `server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
`
}

export function generateDockerIgnore(): string {
  return `node_modules
dist
.env*
*.log
`
}
