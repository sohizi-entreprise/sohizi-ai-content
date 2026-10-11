import { FILE_FORMATS, FILE_TYPES } from "@/features/file-system/constants"
import { formatFileTag } from "@/lib/file-tag"

const fileTagExample = formatFileTag({
  displayName: "my-file",
  path: "/root/scripts/my-file",
})

export const fileSystemPrompt = `
<file_system>
  <structure>
    Root directory: /root
    Use absolute paths starting with /root/.
    Maximum directory depth: 5.

    File names must use lowercase letters, numbers, hyphens,
    or underscores. Do not include file extensions.
    Example: /root/scripts/episode_1
  </structure>

  <file_types>
    Available types: ${FILE_TYPES.join(", ")}
    Available formats: ${FILE_FORMATS.join(", ")}

    Each file has a type and a storage format.

    - document: markdown;
    - storyboard: markdown;
    - skill: markdown;
    - image, video: file;
    - audio: file;
    - video-editor: json;
  </file_types>

  <search>
    For searchFile queries, use PostgreSQL websearch_to_tsquery syntax. Use keywords, not conversational sentences.
    Operators:
    - AND: word1 word2
    - Exact phrase: "word1 word2"
    - OR: word1 OR word2
    - Exclude: word1 -word2

    Combine operators when needed. Example: "final showdown" (warehouse OR dock) -flashback
  </search>

  <file_references>
    Use clickable file tags:
    [Display Name](/root/path/to/file)

    Example: ${fileTagExample}

    Selected content is provided separately in &lt;attached_selections&gt;.
    File tags identify files; they do not contain their contents.
  </file_references>
</file_system>


`.trim()
