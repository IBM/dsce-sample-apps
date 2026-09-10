from __future__ import annotations

import json
from pathlib import Path

import requests
from rich.console import Console
import typer

from .settings import load_settings

app = typer.Typer(help="Register JSON schemas with Confluent Schema Registry.")
console = Console()


@app.command()
def main(
    schema_dir: Path = typer.Option(Path("code/schemas"), help="Directory containing JSON schema files."),
    subject_suffix: str = typer.Option("-value", help="Schema Registry subject suffix."),
    dry_run: bool = typer.Option(False, help="Print requests without calling Schema Registry."),
) -> None:
    settings = load_settings().schema_registry
    if not dry_run and not settings.is_configured:
        raise typer.BadParameter("Schema Registry settings are missing. Check .env or use --dry-run.")

    files = sorted(schema_dir.glob("*.json"))
    if not files:
        raise typer.BadParameter(f"No JSON schema files found in {schema_dir}")

    for path in files:
        subject = f"{path.stem}{subject_suffix}"
        schema_text = path.read_text()
        # Validate that the schema file itself is valid JSON.
        json.loads(schema_text)
        payload = {"schemaType": "JSON", "schema": schema_text}
        url = f"{settings.url.rstrip('/')}/subjects/{subject}/versions"
        if dry_run:
            console.print({"method": "POST", "url": url, "subject": subject})
            continue
        response = requests.post(url, json=payload, auth=(settings.api_key, settings.api_secret), timeout=20)
        if response.status_code >= 400:
            console.print(f"Failed registering {subject}: {response.status_code} {response.text}")
            response.raise_for_status()
        console.print(f"Registered {subject}: {response.json()}")


if __name__ == "__main__":
    app()
