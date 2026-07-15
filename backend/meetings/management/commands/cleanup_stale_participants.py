"""
cleanup_stale_participants management command
=============================================

Safety-net cleanup for MeetingParticipant records that still have
is_present=True even though the call has ended.

This handles the scenario where disconnect() itself never fires:
  - Server crash / worker SIGKILL mid-call
  - Daphne/ASGI process killed by OOM
  - Network partition that outlasts the channel-layer heartbeat timeout

WHEN TO RUN
-----------
This project has Celery in requirements.txt but no active Celery configuration,
so the recommended approach (from lightest to most robust) is:

  Option A – Cron job (zero new infrastructure):
    */15 * * * * /path/to/venv/bin/python /app/manage.py cleanup_stale_participants

  Option B – Server startup hook (container entrypoint or systemd ExecStartPost):
    python manage.py cleanup_stale_participants

  Option C – Celery beat task (if/when Celery is configured):
    @app.on_after_finalize.connect
    def setup_periodic_tasks(sender, **kwargs):
        sender.add_periodic_task(15 * 60, cleanup_stale_participants_task.s())

WHAT IT DOES
------------
A participant record is considered stale when ALL of the following are true:
  1. is_present is True  (the database thinks they're still in the call)
  2. The meeting's end_time has passed by more than GRACE_MINUTES (default 15)
     OR the meeting already has ended_at stamped.

For each stale participant:
  - Sets is_present=False
  - Sets left_at = meeting.end_time (or ended_at if already set, or now())
  - Sets last_seen_at = now()

After all stale participants are cleared, re-evaluates every affected meeting
via _mark_call_ended_if_empty() so the "Call ended" system message and
ended_at timestamp are set if not already present.

DRY RUN
-------
  python manage.py cleanup_stale_participants --dry-run

VERBOSITY
---------
  python manage.py cleanup_stale_participants --verbosity 2
"""

import logging

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)

# Participants whose meeting ended more than GRACE_MINUTES ago are stale.
GRACE_MINUTES = 15


class Command(BaseCommand):
    help = (
        "Safety-net cleanup: marks MeetingParticipant records as left when the "
        "associated meeting has ended but is_present is still True. "
        "Run via cron every 15 minutes or on server startup."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be changed without touching the database.",
        )
        parser.add_argument(
            "--grace-minutes",
            type=int,
            default=GRACE_MINUTES,
            help=(
                f"Minutes past meeting end_time before a participant is considered stale "
                f"(default: {GRACE_MINUTES})."
            ),
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        grace_minutes = options["grace_minutes"]
        verbosity = options["verbosity"]
        now = timezone.now()
        cutoff = now - timedelta(minutes=grace_minutes)

        prefix = "[DRY RUN] " if dry_run else ""

        # Find participant records that are stale:
        #   Case A: meeting.end_time has passed the grace window
        #   Case B: meeting.ended_at is already set (explicitly ended)
        from meetings.models import MeetingParticipant, Meeting  # noqa: PLC0415

        stale_qs = MeetingParticipant.objects.filter(
            is_present=True,
        ).filter(
            # Case A: meeting's scheduled end has passed the grace window
            meeting__end_time__lt=cutoff,
        ).select_related(
            "meeting__channel__team",
            "meeting__host",
            "user",
        )

        # Also catch meetings that are already stamped ended_at (Case B)
        stale_ended_qs = MeetingParticipant.objects.filter(
            is_present=True,
            meeting__ended_at__isnull=False,
        ).select_related(
            "meeting__channel__team",
            "meeting__host",
            "user",
        )

        # Merge into a set of distinct PKs to avoid double-processing
        stale_pks = set(stale_qs.values_list("pk", flat=True)) | set(
            stale_ended_qs.values_list("pk", flat=True)
        )

        if not stale_pks:
            if verbosity >= 1:
                self.stdout.write(self.style.SUCCESS("No stale participant records found."))
            return

        # Re-fetch with full select_related for processing
        participants = MeetingParticipant.objects.filter(pk__in=stale_pks).select_related(
            "meeting__channel__team",
            "meeting__host",
            "user",
        )

        affected_meeting_ids = set()
        cleaned = 0

        for p in participants:
            meeting = p.meeting
            # Determine best left_at timestamp
            if meeting.ended_at:
                effective_left_at = meeting.ended_at
            elif meeting.end_time:
                effective_left_at = meeting.end_time
            else:
                effective_left_at = now

            if verbosity >= 2:
                self.stdout.write(
                    f"{prefix}Marking stale: participant pk={p.pk} "
                    f"user={p.user.username} meeting={meeting.pk} "
                    f"({meeting.title}) left_at={effective_left_at}"
                )

            if not dry_run:
                p.is_present = False
                p.left_at = effective_left_at
                p.last_seen_at = now
                p.save(update_fields=["is_present", "left_at", "last_seen_at"])

            affected_meeting_ids.add(meeting.pk)
            cleaned += 1

        # After clearing stale participants, check each affected meeting
        # to see if it should now be stamped as ended.
        if not dry_run:
            from meetings.views import _mark_call_ended_if_empty  # noqa: PLC0415

            for meeting_pk in affected_meeting_ids:
                try:
                    meeting = Meeting.objects.select_related(
                        "channel__team", "host"
                    ).get(pk=meeting_pk)
                    ended = _mark_call_ended_if_empty(meeting)
                    if ended and verbosity >= 2:
                        self.stdout.write(
                            f"  → Meeting pk={meeting_pk} marked as ended and system message posted."
                        )
                except Exception as exc:
                    logger.error(
                        "cleanup_stale_participants: _mark_call_ended_if_empty failed "
                        "for meeting %s: %s",
                        meeting_pk,
                        exc,
                    )

        msg = (
            f"{prefix}Cleaned {cleaned} stale participant record(s) "
            f"across {len(affected_meeting_ids)} meeting(s)."
        )
        self.stdout.write(self.style.SUCCESS(msg))
        logger.info(msg)
