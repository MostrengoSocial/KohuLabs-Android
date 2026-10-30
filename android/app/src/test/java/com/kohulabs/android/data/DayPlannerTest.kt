package com.kohulabs.android.data

import org.junit.Assert.assertEquals
import org.junit.Test

class DayPlannerTest {
    private fun chunk(id: String, date: String = "2026-10-29", start: String = "09:15", minutes: Int = 25, status: String = Chunk.PLANNED) =
        Chunk(id, "t", "kohu", date, start, minutes, "Outline", "inv", status = status, startedAt = 5, updatedAt = 0)

    private var n = 0
    private val ids = { "new${++n}" }

    @Test fun unfinishedWorkMovesToTheSameSlotToday() {
        val r = DayPlanner.rollover("2026-10-30", listOf(chunk("c3")), { emptyMap() }, emptyList(), now = 9, newId = ids)
        assertEquals(listOf("c3" to Chunk.MOVED, "new1" to Chunk.PLANNED), r.changed.map { it.id to it.status })
        val carried = r.changed[1]
        assertEquals("2026-10-30", carried.date)
        assertEquals("09:15", carried.start)
        assertEquals("c3", carried.carriedFrom)
        assertEquals(null, carried.startedAt)
    }

    @Test fun theReviewCanSplitOrDrop() {
        val r = DayPlanner.rollover("2026-10-30", listOf(chunk("c7", start = "14:00"), chunk("c8")),
            { mapOf("c7" to DayPlanner.SPLIT, "c8" to DayPlanner.DROP) }, emptyList(), now = 9, newId = ids)
        assertEquals(listOf("c7" to Chunk.MOVED, "new1" to Chunk.PLANNED, "new2" to Chunk.PLANNED, "c8" to Chunk.DROPPED), r.changed.map { it.id to it.status })
        assertEquals(listOf("14:00" to 13, "14:13" to 12), r.changed.subList(1, 3).map { it.start to it.minutes })
        assertEquals("Outline (2/2)", r.changed[2].title)
    }

    @Test fun finishedWorkAndTodaysWorkStay() {
        val r = DayPlanner.rollover("2026-10-30", listOf(chunk("c1", status = Chunk.DONE), chunk("c9", date = "2026-10-30")), { emptyMap() }, emptyList(), 9, ids)
        assertEquals(emptyList<Chunk>(), r.changed)
    }

    @Test fun unfinishedGoalsCarryOver() {
        val goals = listOf(Goal("g1", "kohu", "2026-10-29", "Inbox to zero", done = false, updatedAt = 0), Goal("g2", "kohu", "2026-10-29", "Run", done = true, updatedAt = 0))
        val r = DayPlanner.rollover("2026-10-30", emptyList(), { emptyMap() }, goals, 9, ids)
        assertEquals(listOf("Inbox to zero" to "2026-10-30"), r.goals.map { it.title to it.date })
    }

    @Test fun halvesRoundTheFirstHalfUp() {
        assertEquals(listOf(8, 7), DayPlanner.halves(chunk("c8", minutes = 15), "a", "b").map { it.minutes })
        assertEquals("23:59", DayPlanner.addMinutes("23:50", 30))
    }
}
