package com.kohulabs.android.data

import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * The app's data, for the screens: [today] gives one day as JSON (seeding the first day and rolling unfinished
 * work over when a new day starts), and [apply] saves what the person did, as a list of small changes.
 * The WebView screens call both through KohuBridge; the Compose screens will call the same methods.
 * Every call is one database transaction.
 */
class FoundersStore(
    private val db: FoundersDatabase,
    private val clock: () -> Long = System::currentTimeMillis,
    private val newId: () -> String = ::randomId,
) {
    private val dao = db.dao()

    /** The day as the screens need it. [date] is 'YYYY-MM-DD' on the phone; [lang] (en | pt) is used to seed. */
    fun today(date: String, lang: String): JSONObject = db.runInTransaction<JSONObject> {
        seedIfEmpty(date, lang)
        rollOver(date)
        snapshot(date)
    }

    /**
     * Saves changes. Each is an object with an "op":
     *   chunk {id, status}         done | skipped | planned
     *   started {id, at}           the chunk became the current one (its timer starts)
     *   split {id}                 the chunk becomes two halves, id+"a" and id+"b"
     *   add {clientId, ws, title, minutes, start, date}   a task you gave Kō, as one chunk
     *   goal {id, done}            nudge {id, answer}       followUp {id, done?, nudged?}
     *   alarm {id, time?, label?, days?, on?, byKo?, brief?}   (adds it when new)
     *   message {date, ws?, who, text?, key?}   setting {key, value}   review {date, feel?, slips?}
     * Returns {"ids": {clientId: id}} for rows the store named.
     */
    fun apply(ops: JSONArray): JSONObject = db.runInTransaction<JSONObject> {
        val ids = JSONObject()
        for (i in 0 until ops.length()) applyOne(ops.getJSONObject(i), ids)
        JSONObject().put("ids", ids)
    }

    private fun applyOne(o: JSONObject, ids: JSONObject) {
        val now = clock()
        val id = o.optString("id")
        when (o.getString("op")) {
            "chunk" -> dao.chunk(id)?.let { saveChunks(listOf(it.copy(status = o.getString("status"), updatedAt = now))) }
            "started" -> dao.chunk(id)?.takeIf { it.startedAt == null }?.let { saveChunks(listOf(it.copy(startedAt = o.optLong("at", now), updatedAt = now))) }
            "split" -> dao.chunk(id)?.takeIf { it.status == Chunk.PLANNED }?.let {
                saveChunks(listOf(it.copy(status = Chunk.SPLIT, updatedAt = now)) + DayPlanner.halves(it, id + "a", id + "b").map { h -> h.copy(updatedAt = now) })
            }
            "add" -> {
                val taskId = newId()
                val chunkId = newId()
                val ws = o.getString("ws")
                val title = o.getString("title")
                val date = o.getString("date")
                saveTasks(listOf(Task(taskId, ws, title, "fed", source = "you", dueDate = date, createdAt = now, updatedAt = now)))
                saveChunks(listOf(Chunk(chunkId, taskId, ws, date, o.getString("start"), o.getInt("minutes"), title, "fed", updatedAt = now)))
                ids.put(o.optString("clientId", chunkId), chunkId)
            }
            "goal" -> dao.goal(id)?.let { saveGoals(listOf(it.copy(done = o.getBoolean("done"), updatedAt = now))) }
            "nudge" -> dao.nudge(id)?.let { saveNudges(listOf(it.copy(answer = o.optString("answer", "dismissed"), answeredAt = now, updatedAt = now))) }
            "followUp" -> dao.followUp(id)?.let {
                var f = it.copy(updatedAt = now)
                if (o.optBoolean("done")) f = f.copy(status = "done")
                if (o.optBoolean("nudged")) f = f.copy(nudgedAt = now)
                saveFollowUps(listOf(f))
            }
            "alarm" -> {
                val a = dao.alarm(id) ?: Alarm(id, o.getString("time"), o.getString("label"), o.optString("days"), updatedAt = now)
                saveAlarms(listOf(a.copy(
                    time = o.optString("time", a.time), label = o.optString("label", a.label), days = o.optString("days", a.days),
                    enabled = o.optBoolean("on", a.enabled), byKo = o.optBoolean("byKo", a.byKo), brief = o.optBoolean("brief", a.brief),
                    updatedAt = now,
                )))
            }
            "message" -> saveMessages(listOf(Message(newId(), o.getString("date"), o.optStringOrNull("ws"), o.getString("who"),
                o.optStringOrNull("text"), o.optStringOrNull("key"), createdAt = now, updatedAt = now)))
            "setting" -> saveSetting(Setting(o.getString("key"), o.getString("value"), now))
            "review" -> {
                val date = o.getString("date")
                val r = dao.review(date) ?: DayReview(date, date, updatedAt = now)
                saveReview(r.copy(
                    feel = if (o.has("feel") && !o.isNull("feel")) o.getInt("feel") else r.feel,
                    slips = o.optJSONObject("slips")?.toString() ?: r.slips,
                    updatedAt = now,
                ))
            }
        }
    }

    // Every write goes through these: save the rows, and queue them for the cloud (the outbox, see Sync.kt).
    private fun queue(table: String, ids: List<String>) = dao.queue(ids.map { OutboxEntry(table, it, clock()) })
    private fun saveWorkspaces(rows: List<Workspace>) { dao.upsertWorkspaces(rows); queue("workspaces", rows.map { it.id }) }
    private fun saveTasks(rows: List<Task>) { dao.upsertTasks(rows); queue("tasks", rows.map { it.id }) }
    private fun saveChunks(rows: List<Chunk>) { dao.upsertChunks(rows); queue("chunks", rows.map { it.id }) }
    private fun saveGoals(rows: List<Goal>) { dao.upsertGoals(rows); queue("goals", rows.map { it.id }) }
    private fun saveNudges(rows: List<Nudge>) { dao.upsertNudges(rows); queue("nudges", rows.map { it.id }) }
    private fun saveFollowUps(rows: List<FollowUp>) { dao.upsertFollowUps(rows); queue("follow_ups", rows.map { it.id }) }
    private fun saveAlarms(rows: List<Alarm>) { dao.upsertAlarms(rows); queue("alarms", rows.map { it.id }) }
    private fun saveMessages(rows: List<Message>) { dao.upsertMessages(rows); queue("messages", rows.map { it.id }) }
    private fun saveReview(row: DayReview) { dao.upsertReview(row); queue("day_reviews", listOf(row.id)) }
    private fun saveSetting(row: Setting) { dao.upsertSetting(row); queue("settings", listOf(row.id)) }

    private fun seedIfEmpty(date: String, lang: String) {
        if (dao.workspaces().isNotEmpty()) return
        val now = clock()
        // Dated at the very start of time: if this phone had the app before, the real rows coming down from the cloud
        // (same ids) are always newer and replace these.
        val s = SampleDay.rows(LocalDate.parse(date), lang, now, updatedAt = SAMPLE_UPDATED_AT)
        saveWorkspaces(s.workspaces); saveTasks(s.tasks); saveChunks(s.chunks); saveGoals(s.goals)
        saveNudges(s.nudges); saveFollowUps(s.followUps); saveAlarms(s.alarms)
        saveSetting(Setting(ROLLED_TO, JSONObject.quote(date), now))
    }

    /** Once per new day: carry unfinished chunks and goals over (see [DayPlanner]). */
    private fun rollOver(date: String) {
        val last = dao.setting(ROLLED_TO)?.value?.let { JSONArray("[$it]").getString(0) }
        if (last != null && last >= date) return
        val now = clock()
        val lastGoalDate = dao.lastGoalDateBefore(date)
        val r = DayPlanner.rollover(
            date, dao.unfinishedBefore(date),
            slips = { d -> dao.review(d)?.slips?.let(::slipsOf) ?: emptyMap() },
            lastGoals = lastGoalDate?.let(dao::goalsOn) ?: emptyList(),
            now = now, newId = newId,
        )
        saveChunks(r.changed)
        saveGoals(r.goals)
        saveSetting(Setting(ROLLED_TO, JSONObject.quote(date), now))
    }

    private fun snapshot(date: String): JSONObject {
        val day = LocalDate.parse(date)
        val shown = setOf(Chunk.PLANNED, Chunk.DONE, Chunk.SKIPPED)
        return JSONObject()
            .put("date", date)
            .put("workspaces", JSONArray(dao.workspaces().map { JSONObject().put("id", it.id).put("name", it.name).put("toolsAllowed", it.toolsAllowed) }))
            .put("chunks", JSONArray(dao.chunksOn(date).filter { it.status in shown }.map {
                JSONObject().put("id", it.id).put("taskId", it.taskId).put("ws", it.workspaceId).put("start", it.start).put("minutes", it.minutes)
                    .put("title", it.title).put("category", it.category).put("status", it.status).put("startedAt", it.startedAt ?: JSONObject.NULL)
                    .put("carried", it.carriedFrom != null)
            }))
            .put("goals", JSONArray(dao.goalsOn(date).map { JSONObject().put("id", it.id).put("ws", it.workspaceId).put("title", it.title).put("done", it.done) }))
            .put("nudges", JSONArray(dao.openNudges().map {
                JSONObject().put("id", it.id).put("ws", it.workspaceId ?: JSONObject.NULL).put("kind", it.kind).put("tone", it.tone).put("time", it.timeLabel)
                    .put("title", it.title).put("body", it.body).put("actions", JSONArray(it.actions)).put("go", it.go ?: JSONObject.NULL)
            }))
            .put("followUps", JSONArray(dao.openFollowUps().map {
                JSONObject().put("id", it.id).put("ws", it.workspaceId).put("person", it.person).put("what", it.what).put("direction", it.direction)
                    .put("days", ChronoUnit.DAYS.between(LocalDate.parse(it.since), day)).put("source", it.source ?: JSONObject.NULL)
                    .put("nudged", it.nudgedAt != null)
            }))
            .put("alarms", JSONArray(dao.alarms().map {
                JSONObject().put("id", it.id).put("time", it.time).put("label", it.label).put("days", it.days).put("on", it.enabled)
                    .put("byKo", it.byKo).put("brief", it.brief)
            }))
            .put("messages", JSONArray(dao.messagesOn(date).map {
                JSONObject().put("who", it.who).put("ws", it.workspaceId ?: JSONObject.NULL).put("text", it.text ?: JSONObject.NULL).put("key", it.replyKey ?: JSONObject.NULL)
            }))
            .put("review", dao.review(date)?.let { JSONObject().put("feel", it.feel ?: JSONObject.NULL).put("slips", JSONObject(it.slips)) } ?: JSONObject.NULL)
            .put("settings", JSONObject().apply { dao.settings().filter { it.id != ROLLED_TO }.forEach { put(it.id, it.value) } })
    }

    private fun slipsOf(json: String): Map<String, Int> {
        val o = JSONObject(json)
        return o.keys().asSequence().associateWith { o.getInt(it) }
    }

    private fun JSONObject.optStringOrNull(key: String): String? = if (has(key) && !isNull(key)) getString(key) else null

    companion object {
        private const val ROLLED_TO = "rolledTo"
        const val SAMPLE_UPDATED_AT = 1L

        /** A UUID that never ends in a or b: the screens read a trailing a/b as the half of a split chunk. */
        fun randomId(): String = UUID.randomUUID().toString().let { if (it.last() == 'a' || it.last() == 'b') it.dropLast(1) + "0" else it }
    }
}
