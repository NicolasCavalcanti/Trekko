#!/usr/bin/env python3
"""Utility to print the first 30 guides from data/CADASTUR.csv."""
import csv
from itertools import islice
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "CADASTUR.csv"


def main() -> None:
    with DATA_PATH.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh, delimiter=";")
        for index, row in enumerate(islice(reader, 30), start=1):
            print(
                f"{index}. {row['Nome Completo']} — {row['Número do Certificado']} — "
                f"{row['Município']}/{row['UF']} — Atividade: {row['Atividade Turística']} — "
                f"Idiomas: {row['Idiomas']}"
            )


if __name__ == "__main__":
    main()
