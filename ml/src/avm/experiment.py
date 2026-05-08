"""MLflow helpers for experiment logging."""
import json
from pathlib import Path
import mlflow

MLFLOW_TRACKING_URI = str(Path(__file__).parents[3] / "mlruns")


def setup_mlflow(experiment_name: str = "austin-avm") -> None:
    # ensure mlruns dir exists (gitignored, created at runtime)
    Path(MLFLOW_TRACKING_URI).mkdir(parents=True, exist_ok=True)
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment(experiment_name)


def log_run(
    run_name: str,
    params: dict,
    metrics: dict,
    artifacts_dir: Path,
    data_sha: str,
) -> str:
    setup_mlflow()
    with mlflow.start_run(run_name=run_name) as run:
        mlflow.log_params({**params, "data_sha256": data_sha})
        mlflow.log_metrics(metrics)
        if artifacts_dir.exists():
            mlflow.log_artifacts(str(artifacts_dir), artifact_path="models")
        run_id = run.info.run_id
    return run_id


def get_best_run(metric: str = "test_medape") -> dict | None:
    setup_mlflow()
    client = mlflow.tracking.MlflowClient()
    experiment = client.get_experiment_by_name("austin-avm")
    if not experiment:
        return None
    runs = client.search_runs(
        experiment_ids=[experiment.experiment_id],
        order_by=[f"metrics.{metric} ASC"],
        max_results=1,
    )
    if not runs:
        return None
    r = runs[0]
    return {"run_id": r.info.run_id, metric: r.data.metrics.get(metric)}
