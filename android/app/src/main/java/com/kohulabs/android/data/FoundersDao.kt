package com.kohulabs.android.data

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert

/** Every read and write the app makes. Rows marked deleted are left out of every read. */
@Dao
interface FoundersDao {
    @Query("SELECT * FROM workspaces WHERE deleted = 0 ORDER BY sort")
    fun workspaces(): List<Workspace>

    @Query("SELECT * FROM chunks WHERE deleted = 0 AND date = :date ORDER BY start, id")
    fun chunksOn(date: String): List<Chunk>

    /** Chunks from earlier days that were never done, skipped or carried: they roll over. */
    @Query("SELECT * FROM chunks WHERE deleted = 0 AND date < :date AND status = 'planned' ORDER BY date, start, id")
    fun unfinishedBefore(date: String): List<Chunk>

    @Query("SELECT * FROM chunks WHERE id = :id")
    fun chunk(id: String): Chunk?

    /** Open tasks Kō can plan: yours, not meetings from Calendar. Soonest deadline first, then oldest. */
    @Query("SELECT * FROM tasks WHERE deleted = 0 AND status = 'open' AND category <> 'meet' ORDER BY due_date IS NULL, due_date, created_at, id")
    fun openTasks(): List<Task>

    /** Every chunk of the open tasks (to know how much of each is done or planned). */
    @Query("SELECT c.* FROM chunks c JOIN tasks t ON t.id = c.task_id WHERE c.deleted = 0 AND t.deleted = 0 AND t.status = 'open'")
    fun chunksOfOpenTasks(): List<Chunk>

    @Query("SELECT * FROM chunks WHERE deleted = 0 AND date = :date AND status = 'proposed'")
    fun proposedOn(date: String): List<Chunk>

    @Query("SELECT * FROM goals WHERE deleted = 0 AND date = :date ORDER BY rowid")
    fun goalsOn(date: String): List<Goal>

    @Query("SELECT MAX(date) FROM goals WHERE deleted = 0 AND date < :date")
    fun lastGoalDateBefore(date: String): String?

    @Query("SELECT * FROM goals WHERE id = :id")
    fun goal(id: String): Goal?

    @Query("SELECT * FROM nudges WHERE deleted = 0 AND answer IS NULL ORDER BY created_at DESC")
    fun openNudges(): List<Nudge>

    @Query("SELECT * FROM nudges WHERE id = :id")
    fun nudge(id: String): Nudge?

    @Query("SELECT * FROM follow_ups WHERE deleted = 0 AND status = 'open' ORDER BY since")
    fun openFollowUps(): List<FollowUp>

    @Query("SELECT * FROM follow_ups WHERE id = :id")
    fun followUp(id: String): FollowUp?

    @Query("SELECT * FROM alarms WHERE deleted = 0 ORDER BY time")
    fun alarms(): List<Alarm>

    @Query("SELECT * FROM alarms WHERE id = :id")
    fun alarm(id: String): Alarm?

    @Query("SELECT * FROM messages WHERE deleted = 0 AND date = :date ORDER BY created_at, rowid")
    fun messagesOn(date: String): List<Message>

    @Query("SELECT * FROM day_reviews WHERE id = :date")
    fun review(date: String): DayReview?

    @Query("SELECT * FROM settings WHERE deleted = 0")
    fun settings(): List<Setting>

    @Query("SELECT * FROM settings WHERE id = :id AND deleted = 0")
    fun setting(id: String): Setting?

    @Upsert fun queue(rows: List<OutboxEntry>)

    @Query("SELECT * FROM outbox ORDER BY queued_at LIMIT :limit")
    fun outbox(limit: Int): List<OutboxEntry>

    @Query("DELETE FROM outbox WHERE table_name = :table AND row_id = :id AND queued_at <= :upTo")
    fun unqueue(table: String, id: String, upTo: Long)

    @Query("SELECT COUNT(*) FROM outbox")
    fun outboxSize(): Int

    @Upsert fun upsertWorkspaces(rows: List<Workspace>)
    @Upsert fun upsertTasks(rows: List<Task>)
    @Upsert fun upsertChunks(rows: List<Chunk>)
    @Upsert fun upsertGoals(rows: List<Goal>)
    @Upsert fun upsertNudges(rows: List<Nudge>)
    @Upsert fun upsertFollowUps(rows: List<FollowUp>)
    @Upsert fun upsertAlarms(rows: List<Alarm>)
    @Upsert fun upsertMessages(rows: List<Message>)
    @Upsert fun upsertReview(row: DayReview)
    @Upsert fun upsertSetting(row: Setting)
}
