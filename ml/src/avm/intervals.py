"""90% prediction intervals via XGBoost quantile regression."""
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from pathlib import Path

MODELS_DIR = Path(__file__).parents[3] / "models"


def train_quantile_models(
    train_df: pd.DataFrame,
    X_train: pd.DataFrame,
    params: dict,
    alpha_low: float = 0.05,
    alpha_high: float = 0.95,
) -> tuple:
    """Train lower and upper quantile XGBoost models."""
    y = np.log1p(train_df["sale_price"])

    base_params = {k: v for k, v in params.items()
                   if k not in ("objective", "eval_metric")}
    base_params.update({"n_jobs": -1, "random_state": 42})

    q_low = xgb.XGBRegressor(
        **base_params,
        objective="reg:quantileerror",
        quantile_alpha=alpha_low,
    )
    q_high = xgb.XGBRegressor(
        **base_params,
        objective="reg:quantileerror",
        quantile_alpha=alpha_high,
    )
    q_low.fit(X_train, y)
    q_high.fit(X_train, y)
    return q_low, q_high


def predict_intervals(
    q_low, q_high, X: pd.DataFrame
) -> tuple[np.ndarray, np.ndarray]:
    """Return (lower_bound, upper_bound) in dollars."""
    lower = np.expm1(q_low.predict(X))
    upper = np.expm1(q_high.predict(X))
    lower, upper = np.minimum(lower, upper), np.maximum(lower, upper)
    return lower, upper


def confidence_score(
    predicted: np.ndarray,
    lower: np.ndarray,
    upper: np.ndarray,
) -> np.ndarray:
    """0–100 score: wider interval = lower confidence."""
    interval_width_pct = (upper - lower) / predicted.clip(1) * 100
    score = (100 - interval_width_pct.clip(0, 100)).clip(0, 100)
    return score.astype(int)


def save_quantile_models(q_low, q_high) -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(q_low, MODELS_DIR / "q_low.joblib")
    joblib.dump(q_high, MODELS_DIR / "q_high.joblib")


def load_quantile_models():
    return (
        joblib.load(MODELS_DIR / "q_low.joblib"),
        joblib.load(MODELS_DIR / "q_high.joblib"),
    )
