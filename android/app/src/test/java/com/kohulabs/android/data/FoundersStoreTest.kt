package com.kohulabs.android.data

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class FoundersStoreTest {
    private lateinit var db: FoundersDatabase
    private lateinit var store: FoundersStore
    private var now = 1_000L
    private var n = 0

    @Before fun open() {
        db = Room.inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), FoundersDatabase::class.java).allowMainThreadQueries().build()
        store = FoundersStore(db, clock = { now }, newId = { "id${++n}" })
    }

    @After fun close() = db.close()

    private fun ops(vararg o: JSONObject) = store.apply(JSONArray(o.toList()))
    private fun op(name: String, vararg kv: Pair<String, Any?>) = JSONObject().put("op", name).apply { kv.forEach { (k, v) -> put(k, v) } }
    private fun JSONArray.objects() = (0 until length()).map { getJSONObject(it) }
    private fun chunks(day: JSONObject) = day.getJSONArray("chunks").objects()

    @Test fun newIdsNeverLookLikeTheHalfOfASplitChunk() {
        repeat(500) { assertTrue(FoundersStore.randomId().last() !in "ab") }
    }

    @Test fun aNewInstallStartsWithTheSampleDayInItsLanguage() {
        val day = store.today("2026-10-29", "pt")
        assertEquals(21, chunks(day).size)
        assertEquals("Triagem do email", chunks(day).first { it.getString("id") == "c1" }.getString("title"))
        assertEquals(listOf("c1", "c2", "p1", "r1"), chunks(day).filter { it.getString("status") == "done" }.map { it.getString("id") }.sorted())
        assertEquals(4, day.getJSONArray("followUps").objects().first { it.getString("id") == "y1" }.getInt("days"))
        assertEquals(6, day.getJSONArray("nudges").length())
    }

    @Test fun whatYouDoIsKept() {
        store.today("2026-10-29", "en")
        val res = ops(
            op("chunk", "id" to "c3", "status" to "done"),
            op("split", "id" to "c4"),
            op("add", "clientId" to "f0", "ws" to "personal", "title" to "Renew my passport", "minutes" to 25, "start" to "20:30", "date" to "2026-10-29"),
            op("goal", "id" to "g2", "done" to true),
            op("nudge", "id" to "n1", "answer" to "Friday"),
            op("followUp", "id" to "y1", "done" to true),
            op("alarm", "id" to "a4", "time" to "06:45", "label" to "Run before work", "days" to "Tomorrow", "byKo" to true, "brief" to true),
            op("message", "date" to "2026-10-29", "who" to "user", "text" to "What's next?"),
            op("setting", "key" to "lang", "value" to "\"pt\""),
        )
        val fed = res.getJSONObject("ids").getString("f0")
        val day = store.today("2026-10-29", "en")
        val byId = chunks(day).associateBy { it.getString("id") }
        assertEquals("done", byId.getValue("c3").getString("status"))
        assertTrue("c4" !in byId)
        assertEquals("Investor update: metrics (1/2)" to 13, byId.getValue("c4a").let { it.getString("title") to it.getInt("minutes") })
        assertEquals("Renew my passport", byId.getValue(fed).getString("title"))
        assertTrue(day.getJSONArray("goals").objects().first { it.getString("id") == "g2" }.getBoolean("done"))
        assertTrue(day.getJSONArray("nudges").objects().none { it.getString("id") == "n1" })
        assertTrue(day.getJSONArray("followUps").objects().none { it.getString("id") == "y1" })
        assertEquals("06:45", day.getJSONArray("alarms").objects().first().getString("time"))
        assertEquals("What's next?", day.getJSONArray("messages").getJSONObject(0).getString("text"))
        assertEquals("\"pt\"", day.getJSONObject("settings").getString("lang"))
    }

    @Test fun theSampleDayGoesOnceTheFirstRealDayArrivesFromGoogle() {
        store.today("2026-10-29", "en")
        ops(op("add", "clientId" to "f0", "ws" to "personal", "title" to "Renew my passport", "minutes" to 25, "start" to "20:30", "date" to "2026-10-29"))
        val sql = db.openHelper.writableDatabase
        fun count(table: String) = db.query(androidx.sqlite.db.SimpleSQLiteQuery("SELECT COUNT(*) FROM $table WHERE deleted = 0")).use { it.moveToFirst(); it.getInt(0) }
        // Nothing from Google yet: the sample stays.
        store.today("2026-10-29", "en")
        assertEquals(22, count("chunks"))
        // What a sync brings down from the cloud's import (written straight to SQLite, as Sync does).
        sql.execSQL("INSERT INTO chunks (id, task_id, workspace_id, date, start, minutes, title, category, status, updated_at, deleted) VALUES ('cal:e1', 'cal:e1', 'kohu', '2026-10-29', '09:30', 30, 'Board', 'meet', 'planned', 5, 0)")
        sql.execSQL("INSERT INTO nudges (id, kind, tone, time_label, title, body, actions, created_at, updated_at, deleted) VALUES ('brief:2026-10-29', 'Today', 'info', '08:00', 'Today: 1 meeting', '…', '[\"OK\"]', 5, 5, 0)")
        val day = store.today("2026-10-29", "en")
        assertEquals(listOf("Board", "Renew my passport"), chunks(day).map { it.getString("title") }.sorted())
        assertEquals(0, day.getJSONArray("goals").length())
        assertEquals(listOf("brief:2026-10-29"), day.getJSONArray("nudges").objects().map { it.getString("id") })
        assertEquals(0, day.getJSONArray("followUps").length() + day.getJSONArray("alarms").length())
        // The deletions go to the cloud, and it happens once: a sample goal title added later stays.
        assertTrue(db.dao().outbox(500).any { it.tableName == "chunks" && it.rowId == "c1" })
        sql.execSQL("INSERT INTO goals (id, workspace_id, date, title, done, updated_at, deleted) VALUES ('mine', 'kohu', '2026-10-29', 'Inbox to zero', 0, 9, 0)")
        assertEquals(1, store.today("2026-10-29", "en").getJSONArray("goals").length())
    }

    @Test fun theWeekCountsChunksDoneAndTheirMinutes() {
        store.today("2026-10-29", "en")                     // a Thursday: c1 (15) and c2 (25) are done in the sample
        ops(op("chunk", "id" to "c3", "status" to "done"))  // 25 more
        val days = store.week("2026-10-29").getJSONArray("days").objects()
        assertEquals("2026-10-26", days.first().getString("date"))
        assertEquals(7, days.size)
        val thursday = days.first { it.getString("date") == "2026-10-29" }
        assertEquals(5 to 100, thursday.getInt("done") to thursday.getInt("minutes")) // c1 15, c2 25, c3 25, p1 20, r1 15
        assertEquals(0, days.first().getInt("done"))
    }

    @Test fun theNextDayCarriesUnfinishedWorkAsTheReviewSaid() {
        store.today("2026-10-29", "en")
        ops(op("review", "date" to "2026-10-29", "feel" to 2, "slips" to JSONObject().put("c8", DayPlanner.DROP).put("c7", DayPlanner.SPLIT)))
        now = 2_000
        val day = store.today("2026-10-30", "en")
        val titles = chunks(day).map { it.getString("title") }
        assertEquals(17 - 1 + 1, titles.size) // 17 unfinished, c8 dropped, c7 in two
        assertTrue("Send October invoices" !in titles)
        assertTrue("Pricing page: review copy (1/2)" in titles && "Pricing page: review copy (2/2)" in titles)
        assertTrue(chunks(day).all { it.getString("status") == "planned" && it.getBoolean("carried") })
        assertEquals(8, day.getJSONArray("goals").length()) // g4 was done
        assertEquals(0, day.getJSONArray("messages").length())
        // Opening the app again the same day changes nothing.
        assertEquals(titles, chunks(store.today("2026-10-30", "en")).map { it.getString("title") })
    }

    // ---- Kō's plan ----

    private fun at(iso: String) { now = java.time.Instant.parse(iso).toEpochMilli() }
    private fun realDay(date: String) {
        store.today(date, "en")
        db.openHelper.writableDatabase.execSQL("INSERT INTO nudges (id, kind, tone, time_label, title, body, actions, created_at, updated_at, deleted) VALUES ('brief:$date', 'Today', 'info', '08:00', 'Today', '…', '[]', 5, 5, 0)")
    }
    private fun meeting(date: String, start: String, minutes: Int) = db.openHelper.writableDatabase.execSQL(
        "INSERT INTO chunks (id, task_id, workspace_id, date, start, minutes, title, category, status, updated_at, deleted) VALUES ('cal:$start', 'cal:$start', 'kohu', '$date', '$start', $minutes, 'Call', 'meet', 'planned', 5, 0)")
    private fun planned(day: JSONObject) = chunks(day).filter { it.getString("category") != "meet" }.map { Triple(it.getString("start"), it.getInt("minutes"), it.getString("title")) to it.getString("status") }

    @Test fun eachMorningKoProposesTheDayAndYouAcceptIt() {
        store = FoundersStore(db, clock = { now }, newId = { "id${++n}" }, zone = java.time.ZoneOffset.UTC)
        at("2026-11-02T08:00:00Z")                                   // a Monday, before work
        realDay("2026-11-02")
        assertEquals("proposed", store.today("2026-11-02", "en").getJSONObject("plan").getString("state"))
        ops(op("task", "clientId" to "x", "ws" to "kohu", "title" to "Write proposal", "estimate" to 50, "due" to "2026-11-03"),
            op("task", "ws" to "revolut", "title" to "Revolut deck", "estimate" to 25),
            op("task", "ws" to "personal", "title" to "Later", "due" to "2026-11-20"))
        meeting("2026-11-02", "09:30", 30)
        var day = store.today("2026-11-02", "en")
        // Soonest deadline first, around the meeting; tasks without a size get one chunk (25 minutes by default).
        assertEquals(listOf(Triple("09:00", 25, "Write proposal") to "proposed", Triple("10:05", 25, "Write proposal") to "proposed",
            Triple("10:35", 25, "Later") to "proposed", Triple("11:05", 25, "Revolut deck") to "proposed"), planned(day))
        assertEquals(listOf("09:00", "18:00", 3), day.getJSONObject("plan").let { listOf(it.getString("start"), it.getString("end"), it.getInt("tasks")) })
        // Read again, unchanged: nothing new to sync.
        val queued = db.dao().outboxSize()
        store.today("2026-11-02", "en")
        assertEquals(queued, db.dao().outboxSize())

        ops(op("plan", "date" to "2026-11-02", "action" to "accept"))
        day = store.today("2026-11-02", "en")
        assertEquals("accepted", day.getJSONObject("plan").getString("state"))
        assertTrue(planned(day).all { it.second == "planned" })
        // Once accepted, new things do not move the plan by themselves.
        ops(op("task", "ws" to "kohu", "title" to "Call the accountant"))
        assertEquals(4, planned(store.today("2026-11-02", "en")).size)

        // "Today I work until 20:00", at 10:20: the rest of the day is planned again, for you to accept.
        at("2026-11-02T10:20:00Z")
        ops(op("setting", "key" to "hours:2026-11-02", "value" to "{\"end\":\"20:00\"}"), op("plan", "date" to "2026-11-02", "action" to "again"))
        day = store.today("2026-11-02", "en")
        assertEquals("20:00" to "proposed", day.getJSONObject("plan").let { it.getString("end") to it.getString("state") })
        assertEquals(listOf(Triple("09:00", 25, "Write proposal") to "planned", Triple("10:05", 25, "Write proposal") to "planned",
            Triple("10:35", 25, "Later") to "proposed", Triple("11:05", 25, "Revolut deck") to "proposed", Triple("11:35", 25, "Call the accountant") to "proposed"), planned(day))
        assertTrue("hours:2026-11-02" in day.getJSONObject("settings").keys().asSequence().toList())
    }

    @Test fun noPlanOnADayOffUnlessYouSaySo() {
        store = FoundersStore(db, clock = { now }, newId = { "id${++n}" }, zone = java.time.ZoneOffset.UTC)
        at("2026-11-07T09:00:00Z")                                   // a Saturday
        realDay("2026-11-07")
        ops(op("task", "ws" to "kohu", "title" to "Write proposal"))
        assertEquals(JSONObject.NULL, store.today("2026-11-07", "en").getJSONObject("plan").get("state"))
        assertEquals(JSONObject.NULL, store.today("2026-11-07", "en").getJSONObject("plan").get("start"))
        ops(op("setting", "key" to "hours:2026-11-07", "value" to "{\"start\":\"10:00\",\"end\":\"12:00\"}"))
        val day = store.today("2026-11-07", "en")
        assertEquals(listOf(Triple("10:00", 25, "Write proposal") to "proposed"), planned(day))
        // And a working day you take off.
        ops(op("setting", "key" to "hours:2026-11-09", "value" to "{\"off\":true}"))
        assertEquals(null, store.hoursOn("2026-11-09"))
        assertEquals(DayPlanner.Hours(540, 1080), store.hoursOn("2026-11-10"))
    }
}
