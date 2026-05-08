"""Temporal cross-validation and final test split."""
from dataclasses import dataclass
from typing import Iterator

import pandas as pd


@dataclass
class Fold:
    train: pd.DataFrame
    val: pd.DataFrame
    fold_n: int
    val_start: str
    val_end: str


def temporal_cv_folds(
    df: pd.DataFrame,
    n_folds: int = 5,
    val_months: int = 6,
    date_col: str = "sale_date",
) -> list[Fold]:
    """
    Walk-forward CV: each fold trains on all data before val window,
    validates on next val_months window.
    """
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col).reset_index(drop=True)

    min_date = df[date_col].min()
    max_date = df[date_col].max()
    total_months = (max_date.year - min_date.year) * 12 + (max_date.month - min_date.month)
    train_end_offset = total_months - n_folds * val_months

    folds = []
    for i in range(n_folds):
        val_start = min_date + pd.DateOffset(months=train_end_offset + i * val_months)
        val_end = val_start + pd.DateOffset(months=val_months) - pd.Timedelta(days=1)
        train_mask = df[date_col] < val_start
        val_mask = df[date_col].between(val_start, val_end)
        if train_mask.sum() < 100 or val_mask.sum() < 10:
            continue
        folds.append(Fold(
            train=df[train_mask].reset_index(drop=True),
            val=df[val_mask].reset_index(drop=True),
            fold_n=i + 1,
            val_start=str(val_start.date()),
            val_end=str(val_end.date()),
        ))
    return folds


def train_test_split_temporal(
    df: pd.DataFrame,
    test_start: str = "2024-01-01",
    date_col: str = "sale_date",
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Hold out 2024 as final test set, everything before is train."""
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    train = df[df[date_col] < test_start].reset_index(drop=True)
    test = df[df[date_col] >= test_start].reset_index(drop=True)
    return train, test
