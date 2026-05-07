import pandas as pd
import pytest
from avm.split import temporal_cv_folds, train_test_split_temporal


def _df():
    dates = pd.date_range("2018-01-01", "2024-12-31", freq="7D")
    return pd.DataFrame({
        "sale_date": dates,
        "sale_price": [400000] * len(dates),
        "sqft_living": [1500] * len(dates),
    })


def test_temporal_cv_no_leakage():
    folds = temporal_cv_folds(_df(), n_folds=5)
    for fold in folds:
        train_max = fold.train["sale_date"].max()
        val_min = fold.val["sale_date"].min()
        assert train_max < val_min, f"Fold {fold.fold_n}: leakage detected"


def test_temporal_cv_returns_n_folds():
    folds = temporal_cv_folds(_df(), n_folds=5)
    assert len(folds) == 5


def test_train_test_split_no_overlap():
    train, test = train_test_split_temporal(_df(), test_start="2024-01-01")
    assert train["sale_date"].max() < pd.Timestamp("2024-01-01")
    assert test["sale_date"].min() >= pd.Timestamp("2024-01-01")


def test_train_test_split_covers_all_rows():
    df = _df()
    train, test = train_test_split_temporal(df)
    assert len(train) + len(test) == len(df)
