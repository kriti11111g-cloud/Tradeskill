"""Shared pytest configuration for backend tests."""
import os
import pathlib
import pytest_asyncio


# Ensure REACT_APP_BACKEND_URL is available even when pytest is launched
# without exporting it — pull from frontend/.env if unset.
def _load_frontend_env():
    if os.environ.get("REACT_APP_BACKEND_URL"):
        return
    fe_env = pathlib.Path(__file__).resolve().parents[2] / "frontend" / ".env"
    if fe_env.exists():
        for line in fe_env.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


_load_frontend_env()


# Serialize all async tests onto the same event loop so the motor client
# (initialized at module import) stays valid across tests.
@pytest_asyncio.fixture(scope="session", autouse=True)
async def _shared_loop_guard():
    yield
