import { useQuery } from "@tanstack/react-query";

export function useReportPdfBytes(url: string) {
  return useQuery({
    queryKey: ["report-pdf", url],
    queryFn: async ({ signal }) => {
      const response = await fetch(url, { signal, credentials: "include" });
      if (!response.ok) throw new Error(`Could not load report PDF (${response.status}).`);
      return response.arrayBuffer();
    },
    staleTime: Infinity,
    gcTime: 0,
  });
}
