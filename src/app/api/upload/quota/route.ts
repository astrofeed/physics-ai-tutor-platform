import { NextResponse } from "next/server";
import { isErrorResponse, requireApiAuth } from "@/lib/api-auth";
import { getUploadQuotaStatus } from "@/lib/services/upload-quota";
import {
  MAX_DOCUMENTS_PER_DAY,
  MAX_DOCUMENT_BYTES_PER_DAY,
  MAX_IMAGES_PER_HOUR,
} from "@/lib/chat-attachments";

/** Remaining attachment allowance for the signed-in user. */
export async function GET() {
  const auth = await requireApiAuth();
  if (isErrorResponse(auth)) return auth;

  const usage = await getUploadQuotaStatus(auth.user.id);

  return NextResponse.json({
    imagesRemainingThisHour: Math.max(0, MAX_IMAGES_PER_HOUR - usage.imagesLastHour),
    documentsRemainingToday: Math.max(0, MAX_DOCUMENTS_PER_DAY - usage.documentsToday),
    documentBytesRemainingToday: Math.max(
      0,
      MAX_DOCUMENT_BYTES_PER_DAY - usage.documentBytesToday
    ),
  });
}
