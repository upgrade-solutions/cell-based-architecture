import { AuthProviderConfig } from '../../../../types'

export function generateAuth(authConfig?: AuthProviderConfig): string {
  const domain = authConfig?.domain ?? 'AUTH0_DOMAIN'
  const audience = authConfig?.audience ?? 'AUTH0_AUDIENCE'
  const roleClaim = authConfig?.roleClaim ?? 'roles'

  return `import os
import json
from typing import Any, List, Optional
from urllib.request import urlopen
from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from app.flags import is_flag_enabled

AUTH_DOMAIN = os.environ.get("AUTH0_DOMAIN", "${domain}")
AUTH_AUDIENCE = os.environ.get("AUTH0_AUDIENCE", "${audience}")
ROLE_CLAIM = "${roleClaim}"
ALGORITHMS = ["RS256"]

bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _fetch_jwks() -> dict:
    url = f"https://{AUTH_DOMAIN}/.well-known/jwks.json"
    with urlopen(url) as resp:
        return json.loads(resp.read())


def _get_signing_key(token: str) -> Optional[dict]:
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError:
        return None
    jwks = _fetch_jwks()
    for key in jwks.get("keys", []):
        if key["kid"] == unverified_header.get("kid"):
            return key
    return None


def verify_token(token: str) -> dict:
    """Verify a JWT and return the payload."""
    signing_key = _get_signing_key(token)
    if not signing_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    try:
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=ALGORITHMS,
            audience=AUTH_AUDIENCE,
            issuer=f"https://{AUTH_DOMAIN}/",
        )
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    """FastAPI dependency: extract and verify the bearer token."""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return verify_token(credentials.credentials)


def require_roles(*allowed_roles: str):
    """FastAPI dependency factory: require the user to have at least one of the given roles.

    Retained for backward compatibility. New generated code prefers require_allow().
    """
    def checker(user: dict = Depends(get_current_user)) -> dict:
        user_roles = user.get(ROLE_CLAIM, [])
        if isinstance(user_roles, str):
            user_roles = [user_roles]
        if not set(allowed_roles) & set(user_roles):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user
    return checker


def _entry_matches(entry: dict, user_roles: List[str]) -> bool:
    """An allow entry matches iff:

    - (no role OR user has the role) AND
    - (every flag in entry['flags'] is currently enabled)

    Ownership is enforced downstream in the router/service.
    Cross-entry semantics is OR; within-entry is AND.
    """
    role = entry.get("role")
    if role and role not in user_roles:
        return False
    flags = entry.get("flags") or []
    if flags and not all(is_flag_enabled(f) for f in flags):
        return False
    return True


def require_allow(allow_entries: List[dict]):
    """FastAPI dependency factory: honor the full allow[] structure from operational DNA.

    Each entry may declare { role, ownership, flags }. The request is permitted
    iff at least one entry matches — role + all flags satisfied.
    """
    def checker(user: dict = Depends(get_current_user)) -> dict:
        user_roles = user.get(ROLE_CLAIM, [])
        if isinstance(user_roles, str):
            user_roles = [user_roles]
        if not any(_entry_matches(entry, user_roles) for entry in allow_entries):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user
    return checker
`
}


/**
 * Default feature-flag source. Reads flags from `FLAG_<UPPER_SNAKE>` env vars.
 * Emitted as `app/flags.py` so users can override a single file to plug in
 * LaunchDarkly / Unleash / GrowthBook without touching the generated authz.
 */
export function generateFlags(): string {
  return `"""Default feature-flag source — reads FLAG_<UPPER_SNAKE> env vars.

Override this module to plug in LaunchDarkly / Unleash / GrowthBook etc.
The authz dependencies import \`is_flag_enabled\` from \`app.flags\`.
"""
import os
import re


def is_flag_enabled(name: str) -> bool:
    env_name = "FLAG_" + re.sub(r"[^A-Z0-9_]", "_", name.upper())
    raw = os.environ.get(env_name)
    return raw in ("1", "true")
`
}
