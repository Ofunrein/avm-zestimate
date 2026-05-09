from fastapi import APIRouter, Query
from api.schemas import DealResponse
from api.db import db

router = APIRouter()


@router.get("/opportunities", response_model=list[DealResponse])
@router.get("/deals", response_model=list[DealResponse], include_in_schema=False)
def get_opportunities(
    limit: int = Query(default=20, le=100),
    min_gap: float = Query(default=0.0),
):
    if not db:
        return []
    q = (
        db.table("deals")
        .select("*")
        .gte("value_gap_pct", min_gap)
        .order("deal_score", desc=True)
        .limit(limit)
    )
    rows = q.execute().data
    return [DealResponse(**r) for r in rows]
