INSERT INTO "commands" ("name", "action", "is_public", "project_id")
VALUES
  (
    'summarize',
    'Summarize the user request or referenced content clearly and concisely. Focus on the most important points and keep the response brief.',
    true,
    NULL
  ),
  (
    'proofread',
    'Review the user request or referenced content for grammar, spelling, clarity, and tone. Fix issues directly and explain only the most important corrections.',
    true,
    NULL
  ),
  (
    'translate',
    'Translate the user request or referenced content into the target language implied by the user. Preserve meaning, tone, and formatting where possible.',
    true,
    NULL
  )
ON CONFLICT DO NOTHING;
