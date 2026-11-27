-- Append a version only when the active rubric is the unedited former default.
-- Existing jobs keep their rubricId. A staff-authored rubric always takes precedence.
WITH latest AS (
    SELECT "version", "content", "updatedById"
    FROM "ReportRubric"
    ORDER BY "version" DESC
    LIMIT 1
)
INSERT INTO "ReportRubric" ("id", "version", "content", "updatedById")
SELECT gen_random_uuid()::text, "version" + 1,
    regexp_replace(
        regexp_replace("content", 'It may also list .*?one completion check per suggestion\.',
            $intro$**PRESENTATION SUGGESTIONS** are optional directions from the review of the student's talk, not assigned questions. Give a summary, evidence-referenced comments, a 0–10 score with its reason for each of the seven criteria below, and descriptive observations on any listed directions.$intro$),
        '#### Presentation suggestions .*?nothing to deduct\.',
        $policy$#### Optional evidence of breadth or depth (within criterion 1, not extra points)
Judge how well the report explains its topic and answers the assigned question, if any. A relevant comparison, a worked limiting case, or a well-justified extension can demonstrate breadth or depth. Give a student's own direction the same consideration as a suggested one. One careful investigation can show more understanding than several ideas mentioned in passing.

The report can earn 10/10 without pursuing any suggested direction. Do not count directions, add a bonus per suggestion, deduct for omissions, or cap the score. Extensions do not replace an assigned question. If a suggestion identified a physics error and that error is present in the written report, assess the error once under the appropriate criterion, not again for ignoring the suggestion.

For each listed direction, describe what appears in the report: **completed** means developed with evidence, **partially_addressed** means explored in part, and **not_addressed** means not pursued. Cite a section, page or equation for work you find. An unused direction is not a shortcoming. If there are no suggestions, return no observations.$policy$),
    "updatedById"
FROM latest
WHERE encode(sha256(convert_to("content", 'UTF8')), 'hex') =
    '0abdbcbb1a8e23993cf4e52e9f8df00d52582d0894d29868dc43a5c0d051141e';
