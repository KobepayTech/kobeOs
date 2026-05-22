"""
KobeOS Python SDK

Provides HTTP client access to the KobeOS backend API.
Intended for AI scripts, automation, and data pipelines
that run alongside the KobeOS runtime.

Usage:
    from kobeos import KobeClient
    client = KobeClient(base_url="http://localhost:3000", token="...")
    companies = client.get("/companies")
"""

from .client import KobeClient

__all__ = ["KobeClient"]
__version__ = "1.0.0"
