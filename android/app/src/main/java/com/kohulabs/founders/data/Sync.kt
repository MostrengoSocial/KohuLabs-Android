package com.kohulabs.founders.data

import android.content.SharedPreferences
import android.database.Cursor
import androidx.core.content.edit
import androidx.sqlite.db.SimpleSQLiteQuery
import org.json.JSONArray
import org.json.JSONObject

/** The cloud side of a sync: POST /api/sync on the Worker (api/sync.js). Throws on any failure. */
fun interface SyncApi {
    fun sync(body: JSONObject): JSONObject
}

/**
 * Syncs the phone's database with the cloud copy (Cloudflare D1, through the Worker). One [run]:
 *
 * 1. Push: the rows waiting in the outbox (every change FoundersStore makes is queued there) go up, a page at a time.
 * 2. Pull: in the same request, the cloud sends what changed since the last sync (the cursor); those rows are saved
 *    here unless this phone has a newer version (the newest updated_at wins, the same rule as in the cloud).
 * 3. The outbox entries that went up are cleared, unless the row changed again meanwhile, and the cursor is kept.
 *
 * Rows travel as plain JSON objects of their columns, read and written straight from SQLite, so this needs no
 * per-table code: a new column or table syncs as soon as it is in both schemas (db/check-schema.mjs).
 */
class Sync(
    private val db: FoundersDatabase,
    private val api: SyncApi,
    private val prefs: SharedPreferences,
) {
    data class Result(val pushed: Int, val pulled: Int)

    private val dao = db.dao()
    private val columns = mutableMapOf<String, Set<String>>()

    fun run(): Result {
        var pushed = 0
        var pulled = 0
        var rounds = 0
        while (rounds++ < MAX_ROUNDS) {
            val queued = dao.outbox(PAGE)
            val changes = JSONObject()
            for ((table, entries) in queued.groupBy { it.tableName }) {
                if (table !in TABLES) continue
                changes.put(table, JSONArray(entries.mapNotNull { read(table, it.rowId) }))
            }
            val reply = api.sync(JSONObject().put("cursor", prefs.getLong(CURSOR, 0)).put("changes", changes))
            val incoming = reply.optJSONObject("changes") ?: JSONObject()
            db.runInTransaction {
                for (e in queued) dao.unqueue(e.tableName, e.rowId, e.queuedAt)
                for (table in incoming.keys()) {
                    if (table !in TABLES) continue
                    val rows = incoming.getJSONArray(table)
                    for (i in 0 until rows.length()) if (write(table, rows.getJSONObject(i))) pulled++
                }
                prefs.edit { putLong(CURSOR, reply.getLong("cursor")) }
            }
            pushed += queued.size
            if (!reply.optBoolean("more") && queued.size < PAGE) break
        }
        return Result(pushed, pulled)
    }

    /** Forget where the cloud was up to (on sign-out), so the next account starts from the beginning. */
    fun reset() = prefs.edit { remove(CURSOR) }

    private fun read(table: String, id: String): JSONObject? =
        db.query(SimpleSQLiteQuery("SELECT * FROM $table WHERE id = ?", arrayOf(id))).use { c ->
            if (!c.moveToFirst()) return null
            JSONObject().apply {
                for (i in 0 until c.columnCount) put(c.getColumnName(i), when (c.getType(i)) {
                    Cursor.FIELD_TYPE_INTEGER -> c.getLong(i)
                    Cursor.FIELD_TYPE_FLOAT -> c.getDouble(i)
                    Cursor.FIELD_TYPE_STRING -> c.getString(i)
                    else -> JSONObject.NULL
                })
            }
        }

    /** Saves a row from the cloud unless this phone's copy is as new or newer. True when it was saved. */
    private fun write(table: String, row: JSONObject): Boolean {
        val id = row.optString("id").takeIf { it.isNotEmpty() } ?: return false
        val updatedAt = row.optLong("updated_at", -1)
        val mine = db.query(SimpleSQLiteQuery("SELECT updated_at FROM $table WHERE id = ?", arrayOf(id))).use { c -> if (c.moveToFirst()) c.getLong(0) else null }
        if (mine != null && mine >= updatedAt) return false
        val cols = columnsOf(table).filter { row.has(it) }
        val values = cols.map { c -> row.get(c).let { v -> if (v == JSONObject.NULL) null else if (v is Boolean) (if (v) 1 else 0) else v } }
        // INSERT OR REPLACE rather than an upsert: Android 8 to 10 ship SQLite versions without ON CONFLICT DO UPDATE.
        db.openHelper.writableDatabase.execSQL(
            "INSERT OR REPLACE INTO $table (${cols.joinToString()}) VALUES (${cols.joinToString { "?" }})",
            values.toTypedArray(),
        )
        return true
    }

    private fun columnsOf(table: String) = columns.getOrPut(table) {
        db.query(SimpleSQLiteQuery("PRAGMA table_info($table)")).use { c -> buildSet { while (c.moveToNext()) add(c.getString(c.getColumnIndexOrThrow("name"))) } }
    }

    companion object {
        /** The synced tables (all but the outbox), as in db/migrations/. */
        val TABLES = listOf("workspaces", "tasks", "chunks", "goals", "nudges", "follow_ups", "alarms", "messages", "day_reviews", "meetings", "usage", "settings")
        const val PAGE = 500
        private const val MAX_ROUNDS = 50
        private const val CURSOR = "sync.cursor"
    }
}
