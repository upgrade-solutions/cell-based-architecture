export function generateDockerfile(port = 8000): string {
  return `FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

FROM base AS build
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

FROM base AS runner
COPY --from=build /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=build /usr/local/bin /usr/local/bin
COPY --from=build /app /app

RUN useradd --create-home appuser
USER appuser

EXPOSE ${port}
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "${port}"]
`
}

export function generateDockerIgnore(): string {
  return `.git
__pycache__
*.pyc
.venv
.env*
*.log
alembic/versions/*
`
}
