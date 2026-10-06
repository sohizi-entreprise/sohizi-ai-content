import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"
import {
  appendDirectoryChild,
  removeDirectoryChild,
  reorderDirectoryChild,
  reorderDirectoryChildren,
  updateDirectoryChild,
} from "./directory-children-cache"
import type {
  DirectoryChild,
  DirectoryChildrenPage,
} from "@/features/projects/type"
import {
  directoryChildrenKey,
  fileTreeKey,
} from "@/features/projects/query-mutation"

const projectId = "project"
const parentId = "folder"

function child(id: string, position: number): DirectoryChild {
  return {
    id,
    name: id,
    directory: false,
    projectId,
    type: "document",
    format: "markdown",
    parentId,
    position,
    editable: true,
    contentEditable: true,
    path: `/${id}`,
    previewUrl: null,
  }
}

describe("directory children cache", () => {
  it("keeps the fully loaded grid and list caches ordered and in sync", () => {
    const queryClient = new QueryClient()
    const a = child("a", 1000)
    const c = child("c", 3000)
    queryClient.setQueryData(fileTreeKey(projectId, parentId), [a, c])
    queryClient.setQueryData(directoryChildrenKey(projectId, parentId), {
      pages: [page([a, c])],
      pageParams: [undefined],
    })

    appendDirectoryChild(queryClient, projectId, parentId, child("b", 2000))

    expect(treeIds(queryClient)).toEqual(["a", "b", "c"])
    expect(gridIds(queryClient)).toEqual(["a", "b", "c"])

    updateDirectoryChild(queryClient, projectId, parentId, "b", {
      name: "renamed",
    })
    expect(treeNodes(queryClient)[1]?.name).toBe("renamed")
    expect(gridNodes(queryClient)[1]?.name).toBe("renamed")

    removeDirectoryChild(queryClient, projectId, parentId, "b")
    expect(treeIds(queryClient)).toEqual(["a", "c"])
    expect(gridIds(queryClient)).toEqual(["a", "c"])
  })

  it("leaves an incomplete grid page alone while still patching the list", () => {
    const queryClient = new QueryClient()
    const a = child("a", 1000)
    queryClient.setQueryData(fileTreeKey(projectId, parentId), [a])
    queryClient.setQueryData(directoryChildrenKey(projectId, parentId), {
      pages: [page([a], true)],
      pageParams: [undefined],
    })

    appendDirectoryChild(queryClient, projectId, parentId, child("z", 9000))

    expect(treeIds(queryClient)).toEqual(["a", "z"])
    expect(gridIds(queryClient)).toEqual(["a"])
  })

  it("reorders loaded grid pages and the list cache together", () => {
    const queryClient = new QueryClient()
    const nodes = [child("a", 1000), child("b", 2000), child("c", 3000)]
    queryClient.setQueryData(fileTreeKey(projectId, parentId), nodes)
    queryClient.setQueryData(directoryChildrenKey(projectId, parentId), {
      pages: [page(nodes.slice(0, 2), true), page(nodes.slice(2))],
      pageParams: [undefined, "cursor"],
    })

    reorderDirectoryChild(queryClient, projectId, parentId, "c", "a", "before")

    expect(treeIds(queryClient)).toEqual(["c", "a", "b"])
    expect(gridIds(queryClient)).toEqual(["c", "a", "b"])
  })

  it("applies a two-axis grid order to both caches", () => {
    const queryClient = new QueryClient()
    const nodes = [child("a", 1000), child("b", 2000), child("c", 3000)]
    queryClient.setQueryData(fileTreeKey(projectId, parentId), nodes)
    queryClient.setQueryData(directoryChildrenKey(projectId, parentId), {
      pages: [page(nodes)],
      pageParams: [undefined],
    })

    reorderDirectoryChildren(queryClient, projectId, parentId, ["b", "c", "a"])

    expect(treeIds(queryClient)).toEqual(["b", "c", "a"])
    expect(gridIds(queryClient)).toEqual(["b", "c", "a"])
  })
})

function page(
  data: Array<DirectoryChild>,
  hasMore = false,
): DirectoryChildrenPage {
  return {
    data,
    hasMore,
    nextCursor: hasMore ? "cursor" : null,
  }
}

function treeNodes(queryClient: QueryClient) {
  return (
    queryClient.getQueryData<Array<DirectoryChild>>(
      fileTreeKey(projectId, parentId),
    ) ?? []
  )
}

function gridNodes(queryClient: QueryClient) {
  const data = queryClient.getQueryData<{
    pages: Array<DirectoryChildrenPage>
  }>(directoryChildrenKey(projectId, parentId))
  return data?.pages.flatMap((item) => item.data) ?? []
}

function treeIds(queryClient: QueryClient) {
  return treeNodes(queryClient).map((item) => item.id)
}

function gridIds(queryClient: QueryClient) {
  return gridNodes(queryClient).map((item) => item.id)
}
