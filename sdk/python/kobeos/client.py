"""KobeOS HTTP client for Python scripts and AI pipelines."""

import json
import urllib.request
import urllib.error
from typing import Any, Dict, Optional


class KobeClient:
    def __init__(self, base_url: str = "http://localhost:3000", token: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.token = token

    def _headers(self) -> Dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def get(self, path: str) -> Any:
        req = urllib.request.Request(f"{self.base_url}/api{path}", headers=self._headers())
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read())

    def post(self, path: str, body: Dict) -> Any:
        data = json.dumps(body).encode()
        req = urllib.request.Request(f"{self.base_url}/api{path}", data=data, headers=self._headers(), method="POST")
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read())

    def patch(self, path: str, body: Dict) -> Any:
        data = json.dumps(body).encode()
        req = urllib.request.Request(f"{self.base_url}/api{path}", data=data, headers=self._headers(), method="PATCH")
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read())

    def delete(self, path: str) -> Any:
        req = urllib.request.Request(f"{self.base_url}/api{path}", headers=self._headers(), method="DELETE")
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read())
