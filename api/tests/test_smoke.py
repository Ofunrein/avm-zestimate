"""Smoke tests: API must import, key routes must respond without crash."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[2] / "ml/src"))


def test_api_imports():
    import importlib
    mod = importlib.import_module("api.main")
    assert hasattr(mod, "app")


def test_health_route():
    from fastapi.testclient import TestClient
    from api.main import app
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_benchmark_route_no_crash():
    """Must return 200 even when ml/models/meta.json doesn't exist."""
    from fastapi.testclient import TestClient
    from api.main import app
    client = TestClient(app)
    resp = client.get("/benchmark")
    assert resp.status_code == 200


def test_search_route_no_crash():
    """Must return 200 even when Supabase is not configured."""
    from fastapi.testclient import TestClient
    from api.main import app
    client = TestClient(app)
    resp = client.post("/search", json={"query": "3BR under $400k in 78744"})
    assert resp.status_code == 200
