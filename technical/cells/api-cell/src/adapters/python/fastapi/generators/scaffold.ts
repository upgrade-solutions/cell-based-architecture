import { Namespace } from '../../../../types'

export function generateRequirements(): string {
  return `fastapi>=0.115,<1.0
uvicorn[standard]>=0.30
sqlalchemy>=2.0,<3.0
psycopg2-binary>=2.9
python-jose[cryptography]>=3.3
pydantic>=2.0,<3.0
alembic>=1.13
python-dotenv>=1.0
`
}

export function generatePyprojectToml(namespace: Namespace): string {
  const name = namespace.name.toLowerCase()
  return `[project]
name = "${name}-api"
version = "1.0.0"
description = "FastAPI application generated from ${namespace.name} Product API DNA"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115,<1.0",
    "uvicorn[standard]>=0.30",
    "sqlalchemy>=2.0,<3.0",
    "psycopg2-binary>=2.9",
    "python-jose[cryptography]>=3.3",
    "pydantic>=2.0,<3.0",
    "alembic>=1.13",
    "python-dotenv>=1.0",
]

[project.scripts]
seed = "seed:seed"
`
}

export function generateAlembicIni(): string {
  return `[alembic]
script_location = alembic
sqlalchemy.url = postgresql://postgres:postgres@localhost:5432/lending

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
`
}

export function generateAlembicEnvPy(): string {
  return `from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override URL from environment if available
url = os.environ.get("DATABASE_URL")
if url:
    config.set_main_option("sqlalchemy.url", url)

from app.database import Base
from app.models import *  # noqa — ensure all models are registered

target_metadata = Base.metadata


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
`
}

export function generateAlembicScriptMako(): string {
  return `"""$\{message}

Revision ID: $\{up_revision}
Revises: $\{down_revision | comma,n}
Create Date: $\{create_date}
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = $\{repr(up_revision)}
down_revision: Union[str, None] = $\{repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = $\{repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = $\{repr(depends_on)}


def upgrade() -> None:
    $\{upgrades if upgrades else "pass"}


def downgrade() -> None:
    $\{downgrades if downgrades else "pass"}
`
}

export function generateEnv(port = 8000): string {
  return `PORT=${port}
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lending
AUTH0_DOMAIN=acme.auth0.com
AUTH0_AUDIENCE=https://api.acme.finance
`
}

export function generateAppInit(): string {
  return ``
}
