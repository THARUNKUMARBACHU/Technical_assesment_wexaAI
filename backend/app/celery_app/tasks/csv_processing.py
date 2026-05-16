import csv
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

from app.celery_app import celery
from app.celery_app.sync_db import SyncSessionLocal
from app.models.ingestion import CsvUpload, Event

logger = logging.getLogger(__name__)


@celery.task(
    name="app.celery_app.tasks.csv_processing.process_csv_upload",
    bind=True,
    max_retries=3,
)
def process_csv_upload(self, upload_id: str, org_id: str, mapping_config: dict | None = None):
    """
    Process an uploaded CSV file and create Event rows.

    Args:
        upload_id: UUID of the CsvUpload record.
        org_id: UUID of the organization.
        mapping_config: Optional dict mapping CSV columns to Event fields.
            Example: {
                "event_type": "type_column",
                "event_name": "name_column",
                "actor_id": "user_column",
                "numeric_value": "value_column",
                "timestamp": "ts_column",
            }
            If not provided, expects CSV columns to match Event field names directly.
    """
    logger.info("Processing CSV upload %s for org %s", upload_id, org_id)
    success_count = 0
    error_count = 0
    errors = []

    try:
        session = SyncSessionLocal()
        try:
            # Fetch the CsvUpload record
            upload = session.execute(
                select(CsvUpload).where(CsvUpload.id == uuid.UUID(upload_id))
            ).scalar_one_or_none()

            if upload is None:
                logger.error("CsvUpload %s not found", upload_id)
                return {"status": "error", "message": "Upload record not found"}

            # Update status to processing
            upload.status = "processing"
            session.commit()

            file_path = upload.file_path
            if not file_path:
                upload.status = "failed"
                upload.error_summary = {"error": "No file path stored"}
                session.commit()
                return {"status": "error", "message": "No file path"}

            csv_path = Path(file_path)
            if not csv_path.exists():
                upload.status = "failed"
                upload.error_summary = {"error": f"File not found: {file_path}"}
                session.commit()
                return {"status": "error", "message": f"File not found: {file_path}"}

            # Determine column mapping
            mapping = mapping_config or {}
            col_event_type = mapping.get("event_type", "event_type")
            col_event_name = mapping.get("event_name", "event_name")
            col_actor_id = mapping.get("actor_id", "actor_id")
            col_numeric_value = mapping.get("numeric_value", "numeric_value")
            col_timestamp = mapping.get("timestamp", "timestamp")

            org_uuid = uuid.UUID(org_id)

            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                batch = []

                for row_idx, row in enumerate(reader, start=1):
                    try:
                        event_type = row.get(col_event_type, "").strip()
                        if not event_type:
                            errors.append({"row": row_idx, "error": "Missing event_type"})
                            error_count += 1
                            continue

                        # Parse timestamp
                        ts_raw = row.get(col_timestamp, "").strip()
                        if ts_raw:
                            try:
                                timestamp = datetime.fromisoformat(ts_raw)
                                if timestamp.tzinfo is None:
                                    timestamp = timestamp.replace(tzinfo=timezone.utc)
                            except ValueError:
                                errors.append({"row": row_idx, "error": f"Invalid timestamp: {ts_raw}"})
                                error_count += 1
                                continue
                        else:
                            timestamp = datetime.now(timezone.utc)

                        # Parse numeric value
                        nv_raw = row.get(col_numeric_value, "").strip()
                        numeric_value = None
                        if nv_raw:
                            try:
                                numeric_value = float(nv_raw)
                            except ValueError:
                                pass  # non-numeric, leave as None

                        event = Event(
                            id=uuid.uuid4(),
                            org_id=org_uuid,
                            event_type=event_type,
                            event_name=row.get(col_event_name, "").strip() or None,
                            actor_id=row.get(col_actor_id, "").strip() or None,
                            numeric_value=numeric_value,
                            source="csv",
                            timestamp=timestamp,
                            properties={},
                        )
                        batch.append(event)
                        success_count += 1

                        # Flush in batches of 500
                        if len(batch) >= 500:
                            session.add_all(batch)
                            session.commit()
                            batch = []

                    except Exception as row_err:
                        errors.append({"row": row_idx, "error": str(row_err)})
                        error_count += 1
                        if len(errors) > 100:
                            errors.append({"row": row_idx, "error": "Too many errors, stopping collection"})
                            break

                # Flush remaining
                if batch:
                    session.add_all(batch)
                    session.commit()

            # Update the CsvUpload record with results
            upload.status = "completed" if error_count == 0 else "completed_with_errors"
            upload.success_count = success_count
            upload.error_count = error_count
            upload.error_summary = {"errors": errors[:100]} if errors else None
            upload.row_count = success_count + error_count
            upload.completed_at = datetime.now(timezone.utc)
            session.commit()

            logger.info(
                "CSV upload %s processed: %d success, %d errors",
                upload_id, success_count, error_count,
            )

        except Exception as exc:
            session.rollback()
            # Try to mark the upload as failed
            try:
                upload = session.execute(
                    select(CsvUpload).where(CsvUpload.id == uuid.UUID(upload_id))
                ).scalar_one_or_none()
                if upload:
                    upload.status = "failed"
                    upload.error_summary = {"error": str(exc)}
                    session.commit()
            except Exception:
                session.rollback()
            raise
        finally:
            session.close()

    except Exception as exc:
        logger.error("CSV processing failed for upload %s: %s", upload_id, exc)
        raise self.retry(exc=exc, countdown=60)

    return {
        "upload_id": upload_id,
        "success_count": success_count,
        "error_count": error_count,
    }
