import { queryOptions, mutationOptions } from "@tanstack/react-query"
import { getFileContent, saveFileContent } from "./requests"

const keysFactory = {
  fileContent: (projectId: string, fileId: string) => ['project', projectId, 'files', fileId, 'content'],
}

export const getFileContentQueryOptions = (projectId: string, fileId: string) => queryOptions({
  queryKey: keysFactory.fileContent(projectId, fileId),
  queryFn: () => getFileContent(projectId, fileId),
  enabled: !!projectId && !!fileId,
})

export const saveFileContentMutationOptions = (projectId: string, fileId: string) => mutationOptions({
  mutationFn: (content: string) => saveFileContent(projectId, fileId, content),
  onSuccess: (data, _var, _, context) => {
    const content = data.content
    context.client.setQueryData(keysFactory.fileContent(projectId, fileId), {content})
  },
})