package com.kohulabs.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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

    @Test fun meetingsStayOnTheirDay() {
        val meeting = chunk("cal:e1").copy(category = DayPlanner.MEETING)
        assertEquals(emptyList<Chunk>(), DayPlanner.rollover("2026-10-30", listOf(meeting), { emptyMap() }, emptyList(), 9, ids).changed)
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

    // ---- Kō's plan ----

    private fun task(id: String, due: String? = null, ws: String = "kohu") = Task(id, ws, "Task $id", "task", dueDate = due, createdAt = 0, updatedAt = 0)
    private val workday = DayPlanner.Hours(9 * 60, 18 * 60)

    @Test fun theProposalFillsWorkingHoursAroundMeetingsAndLunch() {
        val meeting = chunk("cal:e1", date = "2026-11-02", start = "10:00", minutes = 60).copy(category = DayPlanner.MEETING)
        val p = DayPlanner.propose("2026-11-02", workday, from = 0, busy = listOf(meeting),
            needs = listOf(DayPlanner.Need(task("a"), 60), DayPlanner.Need(task("b", ws = "revolut"), 25), DayPlanner.Need(task("c"), 0)), chunk = 25, now = 7)
        // 09:00 to 09:55 (a break before the meeting), then from 11:05; a's last 10 minutes get a chunk of their own.
        assertEquals(listOf("09:00" to 25, "09:30" to 25, "11:05" to 10, "11:20" to 25), p.map { it.start to it.minutes })
        assertEquals(listOf("a", "a", "a", "b"), p.map { it.taskId })
        assertEquals("plan:2026-11-02:0900", p[0].id)
        assertEquals(Chunk.PROPOSED to "revolut", p[3].status to p[3].workspaceId)
        assertEquals("Task b", p[3].title)
    }

    @Test fun theProposalStartsFromNowAndKeepsLunchAndTheEndOfTheDayFree() {
        val many = listOf(DayPlanner.Need(task("a"), 600))
        val p = DayPlanner.propose("2026-11-02", workday, from = 11 * 60 + 52, busy = emptyList(), needs = many, chunk = 45, now = 7)
        assertEquals("11:55", p.first().start)
        assertTrue(p.none { DayPlanner.minutes(it.start) in 12 * 60 + 56 until 14 * 60 })
        assertTrue(p.all { DayPlanner.minutes(it.start) + it.minutes <= 18 * 60 })
        assertEquals(emptyList<Chunk>(), DayPlanner.propose("2026-11-02", workday, 17 * 60 + 50, emptyList(), many, 25, 7))
    }
}
