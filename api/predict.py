"""
Bhoomi Drishti — land_model inference API.

The repository contains land_model.zip. This service extracts the archive,
loads the first supported serialized ML artifact, and exposes POST /api/predict.

It supports common scikit-learn/joblib/pickle models and pipelines. If the
trained object exposes feature_names_in_, those names are used to map the
dashboard's project fields. Otherwise a documented canonical numeric feature
order is used.
"""
from __future__ import annotations

import json
import os
import pickle
import re
import tempfile
import zipfile
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException\nfrom fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    import joblib
except ImportError:
    joblib = None

try:
    import pandas as pd
except ImportError:
    pd = None


ROOT = Path(__file__).resolve().parent.parent
MODEL_ARCHIVE = ROOT / "land_model.zip"
MODEL_CACHE = Path(tempfile.gettempdir()) / "bhoomi_drishti_land_model"
MODEL_CACHE.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Bhoomi Drishti Land Model API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
_MODEL: Any | None = None


class Project(BaseModel):
    id: str | None = None
    state: str = ""
    district: str = ""
    type: str = ""
    areaHa: float = 0
    families: float = 0
    compensationPct: float = 0
    approvalPct: float = 0
    rehabPct: float = 0
    legalDisputes: float = 0
    docsComplete: bool = False
    stakeholderScore: float = 0
    historicalPerformance: float = 0
    possessionStatus: str = "Pending"


def _safe_extract() -> Path:
    if not MODEL_ARCHIVE.exists():
        raise FileNotFoundError(f"Missing model archive: {MODEL_ARCHIVE}")

    marker = MODEL_CACHE / ".archive-ready"
    if marker.exists():
        return MODEL_CACHE

    with zipfile.ZipFile(MODEL_ARCHIVE) as zf:
        for member in zf.infolist():
            target = (MODEL_CACHE / member.filename).resolve()
            if not str(target).startswith(str(MODEL_CACHE.resolve())):
                raise RuntimeError("Unsafe path inside land_model.zip")
        zf.extractall(MODEL_CACHE)

    marker.write_text("ready", encoding="utf-8")
    return MODEL_CACHE


def _load_model() -> Any:
    global _MODEL
    if _MODEL is not None:
        return _MODEL

    extracted = _safe_extract()
    candidates = [
        p for p in extracted.rglob("*")
        if p.is_file() and p.suffix.lower() in {".joblib", ".pkl", ".pickle", ".sav", ".bin"}
    ]
    if not candidates:
        raise RuntimeError(
            "No supported serialized model was found in land_model.zip. "
            "Expected .joblib, .pkl, .pickle, .sav or .bin."
        )

    model_path = sorted(
        candidates,
        key=lambda p: (
            0 if any(token in p.name.lower() for token in ("land_model", "model", "classifier", "pipeline")) else 1,
            len(p.parts),
            str(p),
        ),
    )[0]
    if joblib is not None:
        try:
            _MODEL = joblib.load(model_path)
            return _MODEL
        except Exception:
            pass

    with model_path.open("rb") as fh:
        _MODEL = pickle.load(fh)
    return _MODEL


def _normalise(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(name).lower())


ALIASES = {
    "area": "areaHa",
    "area_ha": "areaHa",
    "landarea": "areaHa",
    "landarea_ha": "areaHa",
    "families": "families",
    "affectedfamilies": "families",
    "compensation": "compensationPct",
    "compensationpct": "compensationPct",
    "compensationpercentage": "compensationPct",\n    "compensationstatus": "compensationPct",\n    "compensationpaid": "compensationPct",\n    "compensationdisbursed": "compensationPct",
    "approval": "approvalPct",
    "approvalpct": "approvalPct",
    "approvalpercentage": "approvalPct",\n    "approvalstatus": "approvalPct",\n    "approvaldelay": "approvalPct",
    "rehab": "rehabPct",
    "rehabpct": "rehabPct",
    "rehabilitation": "rehabPct",
    "rehabilitationpct": "rehabPct",\n    "rnr": "rehabPct",\n    "rnrprogress": "rehabPct",\n    "resettlement": "rehabPct",
    "legaldisputes": "legalDisputes",
    "disputes": "legalDisputes",\n    "legalissues": "legalDisputes",\n    "ownershipdisputes": "legalDisputes",
    "docscomplete": "docsComplete",
    "documentation": "docsComplete",
    "documentationcomplete": "docsComplete",
    "stakeholderscore": "stakeholderScore",
    "stakeholder": "stakeholderScore",\n    "stakeholderresponsiveness": "stakeholderScore",\n    "stakeholderengagement": "stakeholderScore",
    "historicalperformance": "historicalPerformance",
    "historicalscore": "historicalPerformance",\n    "history": "historicalPerformance",
    "possessionstatus": "possessionStatus",
    "possession": "possessionStatus",
    "state": "state",
    "district": "district",
    "type": "type",
    "projecttype": "type",
}


def _value_for_feature(feature_name: str, project: Project) -> Any:
    key = _normalise(feature_name)
    canonical = ALIASES.get(key)

    if canonical is None:
        # Fuzzy matching for common training-column spellings.
        for alias, field in ALIASES.items():
            if alias in key or key in alias:
                canonical = field
                break

    if canonical is None:
        return 0

    value = getattr(project, canonical)
    if canonical == "docsComplete":
        return int(bool(value))
    return value


def _make_input(project: Project, model: Any) -> Any:
    feature_names = getattr(model, "feature_names_in_", None)

    if feature_names is not None and len(feature_names):
        row = {str(name): _value_for_feature(str(name), project) for name in feature_names}
        if pd is not None:
            return pd.DataFrame([row], columns=list(feature_names))
        return [[row[str(name)] for name in feature_names]]

    # Fallback for models trained without feature_names_in_.
    canonical = [
        project.areaHa,
        project.families,
        project.compensationPct,
        project.approvalPct,
        project.rehabPct,
        project.legalDisputes,
        int(project.docsComplete),
        project.stakeholderScore,
        project.historicalPerformance,
    ]
    expected = getattr(model, "n_features_in_", None)
    if isinstance(expected, (int, np.integer)):
        canonical = canonical[: int(expected)]
    return np.asarray([canonical], dtype=float)


def _probability(model: Any, x: Any, prediction: Any) -> float:
    if hasattr(model, "predict_proba"):
        probs = np.asarray(model.predict_proba(x))[0]
        classes = list(getattr(model, "classes_", range(len(probs))))

        positive_index = None
        for i, label in enumerate(classes):
            text = str(label).lower()
            if label == 1 or text in {"1", "yes", "true", "delay", "delayed", "high", "critical"}:
                positive_index = i
                break
        if positive_index is None:
            positive_index = int(np.argmax(probs))
        return float(probs[positive_index])

    value = float(np.asarray(prediction).reshape(-1)[0])
    # Treat a 0–1 prediction as probability; otherwise normalise common
    # 0–100 risk-score outputs.
    return value if 0 <= value <= 1 else value / 100.0


def _actions_and_timeline(project: Project, drivers: list[dict[str, Any]]) -> tuple[list[str], list[dict[str, str]]]:
    text = " ".join(str(d["factor"]).lower() for d in drivers[:3])
    actions = []
    if "compensation" in text:
        actions.append("Expedite pending compensation disbursements and prioritise older awards.")
    if "approval" in text or "administr" in text:
        actions.append("Escalate stalled administrative approvals through the time-bound clearance workflow.")
    if "rehab" in text or "resettlement" in text:
        actions.append("Fast-track rehabilitation and resettlement site allotment for affected families.")
    if "legal" in text or "dispute" in text or "ownership" in text:
        actions.append("Route contested titles to the appropriate dispute-resolution workflow and track ageing cases.")
    if "doc" in text:
        actions.append("Close outstanding documentation and land-record gaps with the revenue team.")
    if "stakeholder" in text:
        actions.append("Schedule a stakeholder review to re-engage non-responsive parties and reset commitments.")
    if not actions:
        actions.append("Review the model's highest-weight features and assign a time-bound mitigation owner.")

    timeline = [
        {"stage": "Notification & land survey", "status": "Completed" if project.approvalPct >= 45 else "In progress"},
        {"stage": "Compensation assessment", "status": "Completed" if project.compensationPct >= 15 else "Pending"},
        {"stage": "Compensation disbursement", "status": "Completed" if project.compensationPct >= 90 else "In progress" if project.compensationPct >= 15 else "Pending"},
        {"stage": "Possession handover", "status": project.possessionStatus},
        {"stage": "Rehabilitation & resettlement", "status": "Completed" if project.rehabPct >= 90 else "In progress" if project.rehabPct > 10 else "Pending"},
    ]
    return actions[:3], timeline


def _drivers(model: Any) -> list[dict[str, Any]]:
    importances = getattr(model, "feature_importances_", None)
    if importances is None:
        # Pipelines often expose the final estimator.
        final = getattr(model, "steps", [])
        if final:
            importances = getattr(final[-1][1], "feature_importances_", None)

    if importances is None:
        return []

    values = np.asarray(importances, dtype=float).reshape(-1)
    total = float(values.sum()) or 1.0
    names = list(getattr(model, "feature_names_in_", []))
    if len(names) != len(values):
        names = [f"Model feature {i + 1}" for i in range(len(values))]

    pairs = [
        {"factor": str(name), "weight": int(round(float(value / total * 100)))}
        for name, value in zip(names, values)
    ]
    return sorted(pairs, key=lambda item: item["weight"], reverse=True)[:6]


def _tier(score: int) -> str:
    if score >= 76:
        return "Critical"
    if score >= 55:
        return "High"
    if score >= 32:
        return "Moderate"
    return "Low"


@app.get("/api/health")
def health() -> dict[str, Any]:
    try:
        model = _load_model()
        return {
            "status": "ok",
            "model_loaded": True,
            "model_type": type(model).__name__,
        }
    except Exception as exc:
        return {"status": "error", "model_loaded": False, "error": str(exc)}


@app.post("/api/predict")
def predict(project: Project) -> dict[str, Any]:
    try:
        model = _load_model()
        x = _make_input(project, model)
        prediction = model.predict(x)
        probability = _probability(model, x, prediction)

        score = int(round(max(0.0, min(1.0, probability)) * 100))
        delay_probability = score
        tier = _tier(score)
        drivers = _drivers(model)

        return {
            "riskScore": score,
            "delayProbability": delay_probability,
            "tier": tier,
            "drivers": drivers,
            "actions": _actions_and_timeline(project, drivers)[0],
            "timeline": _actions_and_timeline(project, drivers)[1],
            "model": type(model).__name__,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
