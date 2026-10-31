package com.kohulabs.android.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/*
 * The phone's tables. They match db/migrations/ (the cloud database) column for column, minus user_id;
 * db/check-schema.mjs checks that against Room's exported schema (app/schemas/). What each table and column
 * means is written there. Times are milliseconds since 1970, dates 'YYYY-MM-DD', clock times 'HH:MM'.
 */

@Entity(tableName = "workspaces")
data class Workspace(
    @PrimaryKey val id: String,
    val name: String,
    @ColumnInfo(name = "tools_allowed", defaultValue = "0") val toolsAllowed: Boolean = false,
    @ColumnInfo(defaultValue = "0") val sort: Int = 0,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(defaultValue = "0") val deleted: Boolean = false,
)

@Entity(tableName = "tasks")
data class Task(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "workspace_id") val workspaceId: String,
    val title: String,
    val category: String,
    val source: String? = null,
    @ColumnInfo(name = "due_date") val dueDate: String? = null,
    @ColumnInfo(defaultValue = "'open'") val status: String = "open",
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(defaultValue = "0") val deleted: Boolean = false,
    /** Minutes of work Kō plans for it (null: one chunk). */
    val estimate: Int? = null,
)

@Entity(tableName = "chunks", indices = [Index(value = ["date"], name = "chunks_by_date")])
data class Chunk(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "task_id") val taskId: String? = null,
    @ColumnInfo(name = "workspace_id") val workspaceId: String,
    val date: String,
    val start: String,
    val minutes: Int,
    val title: String,
    val category: String,
    @ColumnInfo(defaultValue = "'planned'") val status: String = PLANNED,
    @ColumnInfo(name = "started_at") val startedAt: Long? = null,
    @ColumnInfo(name = "carried_from") val carriedFrom: String? = null,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(defaultValue = "0") val deleted: Boolean = false,
) {
    companion object {
        const val PLANNED = "planned"
        const val PROPOSED = "proposed" // in Kō's plan for the day, not accepted yet
        const val DONE = "done"
        const val SKIPPED = "skipped"
        const val SPLIT = "split"     // replaced by its two halves
        const val MOVED = "moved"     // carried over to a later day
        const val DROPPED = "dropped"
    }
}

@Entity(tableName = "goals")
data class Goal(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "workspace_id") val workspaceId: String,
    val date: String,
    val title: String,
    @ColumnInfo(defaultValue = "0") val done: Boolean = false,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(defaultValue = "0") val deleted: Boolean = false,
)

@Entity(tableName = "nudges")
data class Nudge(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "workspace_id") val workspaceId: String? = null,
    val kind: String,
    @ColumnInfo(defaultValue = "'info'") val tone: String = "info",
    @ColumnInfo(name = "time_label") val timeLabel: String,
    val title: String,
    val body: String,
    @ColumnInfo(defaultValue = "'[]'") val actions: String = "[]",
    val go: String? = null,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    val answer: String? = null,
    @ColumnInfo(name = "answered_at") val answeredAt: Long? = null,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(defaultValue = "0") val deleted: Boolean = false,
)

@Entity(tableName = "follow_ups")
data class FollowUp(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "workspace_id") val workspaceId: String,
    val person: String,
    val what: String,
    val direction: String, // you | them
    val since: String,
    val source: String? = null,
    @ColumnInfo(defaultValue = "'open'") val status: String = "open",
    @ColumnInfo(name = "nudged_at") val nudgedAt: Long? = null,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(defaultValue = "0") val deleted: Boolean = false,
)

@Entity(tableName = "alarms")
data class Alarm(
    @PrimaryKey val id: String,
    val time: String,
    val label: String,
    val days: String,
    @ColumnInfo(defaultValue = "1") val enabled: Boolean = true,
    @ColumnInfo(name = "by_ko", defaultValue = "0") val byKo: Boolean = false,
    @ColumnInfo(defaultValue = "0") val brief: Boolean = false,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(defaultValue = "0") val deleted: Boolean = false,
)

@Entity(tableName = "messages", indices = [Index(value = ["date"], name = "messages_by_date")])
data class Message(
    @PrimaryKey val id: String,
    val date: String,
    @ColumnInfo(name = "workspace_id") val workspaceId: String? = null,
    val who: String, // user | ko
    val text: String? = null,
    @ColumnInfo(name = "reply_key") val replyKey: String? = null,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(defaultValue = "0") val deleted: Boolean = false,
)

@Entity(tableName = "day_reviews")
data class DayReview(
    @PrimaryKey val id: String, // the date
    val date: String,
    val feel: Int? = null,
    @ColumnInfo(defaultValue = "'{}'") val slips: String = "{}",
    @ColumnInfo(name = "closed_at") val closedAt: Long? = null,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(defaultValue = "0") val deleted: Boolean = false,
)

@Entity(tableName = "meetings")
data class Meeting(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "workspace_id") val workspaceId: String,
    val title: String,
    val date: String,
    val start: String,
    val minutes: Int,
    @ColumnInfo(defaultValue = "'{}'") val prep: String = "{}",
    @ColumnInfo(defaultValue = "'{}'") val recap: String = "{}",
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(defaultValue = "0") val deleted: Boolean = false,
)

@Entity(tableName = "usage")
data class Usage(
    @PrimaryKey val id: String,
    val at: Long,
    val model: String,
    val provider: String,
    val purpose: String,
    @ColumnInfo(name = "tokens_in", defaultValue = "0") val tokensIn: Long = 0,
    @ColumnInfo(name = "tokens_out", defaultValue = "0") val tokensOut: Long = 0,
    @ColumnInfo(name = "cache_read", defaultValue = "0") val cacheRead: Long = 0,
    @ColumnInfo(name = "cache_write", defaultValue = "0") val cacheWrite: Long = 0,
    @ColumnInfo(defaultValue = "0") val cost: Double = 0.0,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(defaultValue = "0") val deleted: Boolean = false,
)

@Entity(tableName = "settings")
data class Setting(
    @PrimaryKey val id: String, // the setting's name
    val value: String,          // JSON
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
    @ColumnInfo(defaultValue = "0") val deleted: Boolean = false,
)

/** Phone only: rows changed here and not uploaded yet (see Sync.kt). Cleared once the cloud has them. */
@Entity(tableName = "outbox", primaryKeys = ["table_name", "row_id"])
data class OutboxEntry(
    @ColumnInfo(name = "table_name") val tableName: String,
    @ColumnInfo(name = "row_id") val rowId: String,
    @ColumnInfo(name = "queued_at") val queuedAt: Long,
)
