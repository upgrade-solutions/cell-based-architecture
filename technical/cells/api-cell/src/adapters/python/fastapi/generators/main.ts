import { Namespace } from '../../../../types'

export function generateMain(namespace: Namespace): string {
  const title = `${namespace.name} API`
  const description = namespace.description ?? `REST API for ${namespace.name}`

  return `from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import register_routers


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="${title}",
    description="${description}",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_routers(app)


@app.get("/health")
def health():
    return {"status": "ok"}
`
}
