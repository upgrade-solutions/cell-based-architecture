import { Namespace } from '../../../../types'

export function generateDockerCompose(namespace: Namespace): string {
  const dbName = namespace.name.toLowerCase()

  return `services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ${dbName}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
`
}
