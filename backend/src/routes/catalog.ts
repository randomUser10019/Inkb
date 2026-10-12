import type { FastifyInstance } from "fastify";
import { EXAMS } from "@inkboard/shared/exams";
import {
  BatchDetailInput,
  BatchScheduleInput,
  ClassDetailInput,
  CourseDetailInput,
  CourseLessonsInput,
  EducatorPageInput,
  ExamCoursesInput,
  ExamHubInput,
  ExamSubjectInput,
  ExamTeachersInput,
  LiveSlideInput,
  SearchEducatorsInput,
  TeacherBatchesInput,
  TeacherOffsetInput,
  TestSeriesItemsInput,
} from "@inkboard/shared/ua-input";
import {
  loadBatchDetail,
  loadBatchSchedule,
  loadClassDetail,
  loadCourseDetail,
  loadCourseLessons,
  loadEducatorBatches,
  loadEducatorPage,
  loadEducatorSpecials,
  loadExamCourses,
  loadExamHub,
  loadExamPractice,
  loadExamSubjectCourses,
  loadExamTeachers,
  loadExamTests,
  loadLiveFeed,
  loadLiveHistory,
  loadLiveSession,
  loadLiveSlide,
  loadTestSeriesItems,
  searchEducators,
} from "@/catalog/source.ts";
import { handleJson, requestIdOf } from "../http.ts";
import { parseInput } from "../dto/validate.ts";
import { runGuarded } from "../lib/breaker.ts";
import type { ZodType } from "zod";

function read<T>(schema: ZodType<T>, value: unknown): T {
  return parseInput(schema, value, "request");
}

export async function registerCatalog(app: FastifyInstance) {
  app.get("/api/exams", async () => ({ exams: EXAMS }));

  app.get("/api/exams/:goalId/hub", async (req, reply) => {
    const data = read(ExamHubInput, req.params);
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadExamHub(data)));
  });

  app.get("/api/exams/:goalId/teachers", async (req, reply) => {
    const data = read(ExamTeachersInput, { ...(req.params as object), ...(req.query as object) });
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadExamTeachers(data)));
  });

  app.get("/api/exams/:goalId/courses", async (req, reply) => {
    const q = req.query as { subject?: string; offset?: string };
    if (q.subject) {
      const data = read(ExamSubjectInput, { topologyUid: q.subject });
      return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadExamSubjectCourses(data)));
    }
    const data = read(ExamCoursesInput, { ...(req.params as object), offset: q.offset });
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadExamCourses(data)));
  });

  app.get("/api/exams/:goalId/tests", async (req, reply) => {
    const data = read(ExamHubInput, req.params);
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadExamTests(data)));
  });

  app.get("/api/exams/:goalId/practice", async (req, reply) => {
    const data = read(ExamHubInput, req.params);
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadExamPractice(data)));
  });

  app.get("/api/test-series/:id/items", async (req, reply) => {
    const data = read(TestSeriesItemsInput, { uid: (req.params as { id: string }).id });
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadTestSeriesItems(data)));
  });

  app.get("/api/educators/:username", async (req, reply) => {
    const data = read(EducatorPageInput, { ...(req.params as object), ...(req.query as object) });
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadEducatorPage(data)));
  });

  app.get("/api/educators/:username/batches", async (req, reply) => {
    const data = read(TeacherBatchesInput, { ...(req.params as object), ...(req.query as object) });
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadEducatorBatches(data)));
  });

  app.get("/api/educators/:username/specials", async (req, reply) => {
    const data = read(TeacherOffsetInput, { ...(req.params as object), ...(req.query as object) });
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadEducatorSpecials(data)));
  });

  app.get("/api/search/educators", async (req, reply) => {
    const data = read(SearchEducatorsInput, req.query);
    return handleJson(reply, requestIdOf(req), () => searchEducators(data));
  });

  app.get("/api/courses/:uid", async (req, reply) => {
    const data = read(CourseDetailInput, { ...(req.params as object), ...(req.query as object) });
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadCourseDetail(data)));
  });

  app.get("/api/courses/:uid/lessons", async (req, reply) => {
    const data = read(CourseLessonsInput, { ...(req.params as object), ...(req.query as object) });
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadCourseLessons(data)));
  });

  app.get("/api/batches/:uid", async (req, reply) => {
    const data = read(BatchDetailInput, { ...(req.params as object), ...(req.query as object) });
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadBatchDetail(data)));
  });

  app.get("/api/batches/:uid/schedule", async (req, reply) => {
    const q = req.query as { rank?: string; past?: string };
    const data = read(BatchScheduleInput, {
      ...(req.params as object),
      past: q.past,
      rank: q.rank ? Number(q.rank) : undefined,
    });
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadBatchSchedule(data)));
  });

  app.get("/api/classes/:uid", async (req, reply) => {
    const data = read(ClassDetailInput, { ...(req.params as object), ...(req.query as object) });
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadClassDetail(data)));
  });

  app.get("/api/live/feed", async (req, reply) => handleJson(reply, requestIdOf(req), () => runGuarded(() => loadLiveFeed())));

  app.get("/api/live/sessions/:uid", async (req, reply) => {
    const data = read(ClassDetailInput, { ...(req.params as object), ...(req.query as object) });
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadLiveSession(data)));
  });

  app.get("/api/live/sessions/:uid/slide", async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const data = read(LiveSlideInput, {
      ...(req.params as object),
      className: q.name || q.className,
      courseName: q.course || q.courseName,
      educatorName: q.educator || q.educatorName,
      rank: q.rank,
      special: q.special,
      theme: q.theme,
    });
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadLiveSlide(data)));
  });

  app.get("/api/live/sessions/:uid/history", async (req, reply) => {
    const data = read(ClassDetailInput, { ...(req.params as object), ...(req.query as object) });
    return handleJson(reply, requestIdOf(req), () => runGuarded(() => loadLiveHistory(data)));
  });
}
