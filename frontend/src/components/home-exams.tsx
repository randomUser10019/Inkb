import { useQueryClient } from "@tanstack/react-query";
import { ExamCatalog } from "@/components/browse-catalog";
import { rememberHub } from "@inkboard/shared/catalog-cache";
import { COPY } from "@inkboard/shared/copy";
import { loadExamHub } from "@/lib/unacademy";

export function HomeExams() {
  const qc = useQueryClient();

  function prefetch(id: string) {
    void qc.prefetchQuery({
      queryKey: ["exam-hub", "v8", id],
      queryFn: async () => {
        const page = await loadExamHub({ data: { goalId: id } });
        if (!rememberHub(id, page)) throw new Error(COPY.wallDidNotLoad);
        return page;
      },
    });
  }

  return <ExamCatalog onPrefetch={prefetch} />;
}
