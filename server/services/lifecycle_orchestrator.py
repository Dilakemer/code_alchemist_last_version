import threading
import queue
import logging
from datetime import datetime
from flask import current_app
from models import db, Conversation, History, Answer, SharedSession, ConversationSummary, MemoryNode, Notification, Favorite

logger = logging.getLogger(__name__)

# Simple background task queue for lifecycle orchestration
_task_queue = queue.Queue()

def _worker_loop(app):
    """Background worker loop to process lifecycle tasks."""
    last_purge = datetime.utcnow()
    with app.app_context():
        while True:
            try:
                # Periodic Purge Trigger (Check every hour, run if 24h passed)
                now = datetime.utcnow()
                if (now - last_purge).total_seconds() > 86400: # 24 Hours
                    try:
                        PurgeService.run_purge()
                        last_purge = now
                    except Exception as pe:
                        logger.error(f"Purge cycle failed: {pe}")

                task = _task_queue.get(timeout=3600) # Wait up to 1h for a task
                if task is None:
                    break
                
                func, args, kwargs = task
                func(*args, **kwargs)
                _task_queue.task_done()
            except queue.Empty:
                continue # Just loop back and check for purge
            except Exception as e:
                logger.error(f"Error in lifecycle worker: {e}", exc_info=True)

def start_worker(app):
    """Starts the background worker thread."""
    thread = threading.Thread(target=_worker_loop, args=(app,), daemon=True)
    thread.start()
    return thread

def enqueue_task(func, *args, **kwargs):
    """Enqueues a task for background processing."""
    _task_queue.put((func, args, kwargs))

class LifecycleOrchestrator:
    """SaaS-grade lifecycle orchestration for entity deactivation and restoration."""

    @staticmethod
    def deactivate_conversation(conv_id: int):
        """Initiates deactivation of a conversation and its dependencies."""
        conv = db.session.get(Conversation, conv_id)
        if not conv or conv.is_deleted:
            return

        # 1. Immediate state change (Monolithic start)
        conv.is_deleted = True
        conv.deleted_at = datetime.utcnow()
        conv.deleted_by_cascade = False
        conv.version += 1
        db.session.commit()

        # 2. Schedule async cleanup of dependencies
        enqueue_task(LifecycleOrchestrator._async_cleanup_conversation_dependencies, conv_id)

    @staticmethod
    def _async_cleanup_conversation_dependencies(conv_id: int):
        """Asynchronously resolves conversation dependencies iterativey."""
        # Note: This runs in background with app context
        # 1. Deactivate History Items
        histories = History.query.filter_by(conversation_id=conv_id, is_deleted=False).all()
        for history in histories:
            LifecycleOrchestrator.deactivate_history_item(history.id, is_cascade=True)

        # 2. Deactivate Shared Sessions
        SharedSession.query.filter_by(conversation_id=conv_id, is_deleted=False).update({
            'is_deleted': True,
            'deleted_at': datetime.utcnow(),
            'deleted_by_cascade': True,
            'version': SharedSession.version + 1
        }, synchronize_session=False)

        # 3. Deactivate Summaries
        ConversationSummary.query.filter_by(conversation_id=conv_id, is_deleted=False).update({
            'is_deleted': True,
            'deleted_at': datetime.utcnow(),
            'deleted_by_cascade': True,
            'version': ConversationSummary.version + 1
        }, synchronize_session=False)

        # 4. Invalidate Memory Nodes (SaaS Policy: Audit-safe invalidation)
        MemoryNode.query.filter_by(conversation_id=conv_id).update({
            'validity_state': 'invalidated',
            'version': MemoryNode.version + 1
        }, synchronize_session=False)

        db.session.commit()
        logger.info(f"Asynchronous cleanup completed for conversation {conv_id}")

    @staticmethod
    def deactivate_history_item(history_id: int, is_cascade: bool = False):
        """Deactivates a single history item and its immediate dependencies."""
        history = db.session.get(History, history_id)
        if not history or history.is_deleted:
            return

        history.is_deleted = True
        history.deleted_at = datetime.utcnow()
        history.deleted_by_cascade = is_cascade
        history.version += 1

        # Deactivate Answers
        Answer.query.filter_by(history_id=history_id, is_deleted=False).update({
            'is_deleted': True,
            'deleted_at': datetime.utcnow(),
            'deleted_by_cascade': True,
            'version': Answer.version + 1
        }, synchronize_session=False)

        # Hide Notifications (State machine transition)
        Notification.query.filter_by(related_post_id=history_id, is_deleted=False).update({
            'is_deleted': True,
            'lifecycle_state': 'hidden',
            'deleted_by_cascade': True,
            'version': Notification.version + 1
        }, synchronize_session=False)

        # Hide Favorites
        Favorite.query.filter_by(history_id=history_id, is_deleted=False).update({
            'is_deleted': True,
            'deleted_by_cascade': True,
            'version': Favorite.version + 1
        }, synchronize_session=False)

        db.session.commit()

    @staticmethod
    def restore_conversation(conv_id: int):
        """Restores a conversation and selectively restores cascaded dependencies."""
        conv = db.session.get(Conversation, conv_id)
        if not conv or not conv.is_deleted:
            return

        conv.is_deleted = False
        conv.deleted_at = None
        conv.version += 1
        db.session.commit()

        # Schedule async restoration
        enqueue_task(LifecycleOrchestrator._async_restore_conversation_dependencies, conv_id)

    @staticmethod
    def _async_restore_conversation_dependencies(conv_id: int):
        """Selectively restores items that were deleted by cascade."""
        # 1. Restore Scoped History
        histories = History.query.filter_by(conversation_id=conv_id, is_deleted=True, deleted_by_cascade=True).all()
        for history in histories:
            LifecycleOrchestrator.restore_history_item(history.id, verify_parent=False)

        # 2. Restore Sessions & Summaries
        SharedSession.query.filter_by(conversation_id=conv_id, is_deleted=True, deleted_by_cascade=True).update({
            'is_deleted': False,
            'deleted_at': None,
            'deleted_by_cascade': False,
            'version': SharedSession.version + 1
        }, synchronize_session=False)

        ConversationSummary.query.filter_by(conversation_id=conv_id, is_deleted=True, deleted_by_cascade=True).update({
            'is_deleted': False,
            'deleted_at': None,
            'deleted_by_cascade': False,
            'version': ConversationSummary.version + 1
        }, synchronize_session=False)

        # 3. Re-validate Memory Nodes (SaaS Policy: Trace to recomputing)
        MemoryNode.query.filter_by(conversation_id=conv_id, validity_state='invalidated').update({
            'validity_state': 'recomputing', # Triggers re-verification job
            'version': MemoryNode.version + 1
        }, synchronize_session=False)

        db.session.commit()
        logger.info(f"Asynchronous restoration completed for conversation {conv_id}")

    @staticmethod
    def restore_history_item(history_id: int, verify_parent: bool = True):
        """Restores a single history item and its cascaded children."""
        history = db.session.get(History, history_id)
        if not history or not history.is_deleted:
            return
        
        # Verify parent conversation is active
        if verify_parent and history.conversation and history.conversation.is_deleted:
            return

        history.is_deleted = False
        history.deleted_at = None
        history.deleted_by_cascade = False
        history.version += 1

        # Restore Scoped Answers
        Answer.query.filter_by(history_id=history_id, is_deleted=True, deleted_by_cascade=True).update({
            'is_deleted': False,
            'deleted_at': None,
            'deleted_by_cascade': False,
            'version': Answer.version + 1
        }, synchronize_session=False)

        # Restore Notifications
        Notification.query.filter_by(related_post_id=history_id, is_deleted=True, deleted_by_cascade=True).update({
            'is_deleted': False,
            'lifecycle_state': 'active',
            'deleted_by_cascade': False,
            'version': Notification.version + 1
        }, synchronize_session=False)

        # Restore Favorites
        Favorite.query.filter_by(history_id=history_id, is_deleted=True, deleted_by_cascade=True).update({
            'is_deleted': False,
            'deleted_at': None,
            'deleted_by_cascade': False,
            'version': Favorite.version + 1
        }, synchronize_session=False)

        db.session.commit()


class PurgeService:
    """Manages the permanent deletion of soft-deleted records (30-day TTL)."""

    @staticmethod
    def run_purge(days_ttl: int = 30):
        """Finds and permanently deletes records soft-deleted more than TTL days ago."""
        from datetime import datetime, timedelta
        cutoff = datetime.utcnow() - timedelta(days=days_ttl)

        logger.info(f"Starting Purge Cycle (TTL: {days_ttl} days, Cutoff: {cutoff})")

        # 1. Purge Conversations (and their cascaded items will be purged too)
        # Note: In a real distributed system, we'd use a more robust batching approach.
        deleted_convs = Conversation.query.filter(
            Conversation.is_deleted == True,
            Conversation.deleted_at <= cutoff
        ).all()

        for conv in deleted_convs:
            # Physical delete from DB
            db.session.delete(conv)
            logger.info(f"Permanently purged conversation {conv.id}")

        # 2. Purge orphaned History items (manual deletes)
        deleted_histories = History.query.filter(
            History.is_deleted == True,
            History.deleted_at <= cutoff
        ).all()
        for h in deleted_histories:
            db.session.delete(h)

        # 3. Purge orphaned items from other models
        for model in [Answer, SharedSession, ConversationSummary, Favorite, Notification]:
            model.query.filter(
                model.is_deleted == True,
                model.deleted_at <= cutoff
            ).delete(synchronize_session=False)

        db.session.commit()
        logger.info("Purge cycle completed.")
