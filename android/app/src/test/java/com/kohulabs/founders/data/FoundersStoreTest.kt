package com.kohulabs.founders.data

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
}
