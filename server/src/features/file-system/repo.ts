import { db } from "@/db";
import { fileNodeContentChunks, fileNodeContents, fileNodes, type FileNode } from "@/db/schema";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { DatabaseError } from "pg";
import { FileCreationRequest, FileNodeInsertPosition, UpdateFileContentRequest, UpdateFileRequest } from "./payload";

const ORDER_GAP = 1000;
const FILE_NODE_UNIQUE_CONSTRAINTS = new Set([
    'file_nodes_project_id_parent_id_name_unique',
    'file_nodes_project_id_root_name_unique',
]);


type DbExecutor = Pick<typeof db, 'select' | 'execute' | 'update' | 'insert'>;

export class FileNodeInsertionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FileNodeInsertionError';
    }
}

export class FileNodeUniqueConstraintError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FileNodeUniqueConstraintError';
    }
}

const isFileNodeUniqueConstraintError = (error: unknown) => {
    return error instanceof DatabaseError
        && error.code === '23505'
        && !!error.constraint
        && FILE_NODE_UNIQUE_CONSTRAINTS.has(error.constraint);
}

// ================================

export async function getFileNodeById(projectId: string, id: string): Promise<FileNode | undefined>;
export async function getFileNodeById(projectId: string, id: string[]): Promise<FileNode[]>;
export async function getFileNodeById(projectId: string, id: string | string[]): Promise<FileNode | undefined | FileNode[]> {
    if (Array.isArray(id)) {
        if (id.length === 0) {
            return [];
        }

        const result = await db.select()
                               .from(fileNodes)
                               .where(and(
                                    eq(fileNodes.projectId, projectId),
                                    sql`${fileNodes.id} = ANY(${id})`,
                               ));

        const fileNodesById = new Map(result.map((fileNode) => [fileNode.id, fileNode]));
        return id.flatMap((fileNodeId) => {
            const fileNode = fileNodesById.get(fileNodeId);
            return fileNode ? [fileNode] : [];
        });
    }

    const result = await db.select()
                           .from(fileNodes)
                           .where(and(eq(fileNodes.id, id), eq(fileNodes.projectId, projectId)));
    return result[0];
}

export const getFileNodeByName = async(projectId: string, parentId: string | null, name: string) => {
    const result = await db.select()
                           .from(fileNodes)
                           .where(and(
                                eq(fileNodes.projectId, projectId),
                                eq(fileNodes.name, name),
                                parentId === null ? isNull(fileNodes.parentId) : eq(fileNodes.parentId, parentId),
                           ));
    return result[0];
}

export const getFileNodeDepthById = async(projectId: string, id: string) => {
    const result = await db.execute(sql`
        WITH RECURSIVE ancestors AS (
            SELECT
                fn.id,
                fn.parent_id,
                0 AS depth
            FROM file_nodes fn
            WHERE fn.project_id = ${projectId}
              AND fn.id = ${id}

            UNION ALL

            SELECT
                parent.id,
                parent.parent_id,
                ancestors.depth + 1
            FROM file_nodes parent
            JOIN ancestors ON ancestors.parent_id = parent.id
            WHERE parent.project_id = ${projectId}
        ) CYCLE id SET is_cycle USING cycle_path
        SELECT COALESCE(MAX(depth), 0) AS depth
        FROM ancestors
        WHERE NOT is_cycle
    `);

    const row = result.rows[0] as { depth?: number | string } | undefined;

    if (!row) {
        return null;
    }

    return typeof row.depth === "string" ? Number(row.depth) : (row.depth ?? 0);
}

export const getFileNodeSubtreeHeight = async(projectId: string, id: string) => {
    const result = await db.execute(sql`
        WITH RECURSIVE subtree AS (
            SELECT
                fn.id,
                0 AS depth
            FROM file_nodes fn
            WHERE fn.project_id = ${projectId}
              AND fn.id = ${id}

            UNION ALL

            SELECT
                child.id,
                subtree.depth + 1
            FROM file_nodes child
            JOIN subtree ON child.parent_id = subtree.id
            WHERE child.project_id = ${projectId}
        ) CYCLE id SET is_cycle USING cycle_path
        SELECT COALESCE(MAX(depth), 0) AS depth
        FROM subtree
        WHERE NOT is_cycle
    `);

    const row = result.rows[0] as { depth?: number | string } | undefined;

    if (!row) {
        return null;
    }

    return typeof row.depth === "string" ? Number(row.depth) : (row.depth ?? 0);
}

export const isFileNodeInAncestorChain = async(
    projectId: string,
    startId: string,
    targetAncestorId: string,
) => {
    const result = await db.execute(sql`
        WITH RECURSIVE ancestors AS (
            SELECT
                fn.id,
                fn.parent_id
            FROM file_nodes fn
            WHERE fn.project_id = ${projectId}
              AND fn.id = ${startId}

            UNION ALL

            SELECT
                parent.id,
                parent.parent_id
            FROM file_nodes parent
            JOIN ancestors ON ancestors.parent_id = parent.id
            WHERE parent.project_id = ${projectId}
        ) CYCLE id SET is_cycle USING cycle_path
        SELECT EXISTS(
            SELECT 1
            FROM ancestors
            WHERE id = ${targetAncestorId}
              AND NOT is_cycle
        ) AS exists
    `);

    const row = result.rows[0] as { exists?: boolean } | undefined;
    return row?.exists ?? false;
}

export const createFileNode = async(data: FileCreationRequest) => {
    const result = await db.insert(fileNodes).values(data).onConflictDoNothing().returning();
    if(result.length === 0){
        return null;
    }
    return result[0];
}

export const deleteFileNode = async(projectId: string, id: string) => {
    const result = await db.delete(fileNodes).where(and(eq(fileNodes.id, id), eq(fileNodes.projectId, projectId))).returning();
    return result.length > 0;
}

export const updateFileNode = async(projectId: string, data: UpdateFileRequest) => {
    try {
        const patch: Partial<Pick<FileNode, 'name' | 'parentId'>> = {};
        if (data.name !== undefined) {
            patch.name = data.name;
        }
        if (data.parentId !== undefined) {
            patch.parentId = data.parentId;
        }

        const result = await db.update(fileNodes)
                               .set(patch)
                               .where(and(eq(fileNodes.id, data.id), eq(fileNodes.projectId, projectId)))
                               .returning();
        return result[0];
    } catch (error) {
        if (isFileNodeUniqueConstraintError(error)) {
            throw new FileNodeUniqueConstraintError('File name already exists in that parent directory.');
        }
        throw error;
    }
}

export const moveFileNode = async(
    projectId: string,
    data: {
        id: string;
        name: string;
        parentId: string | null;
        anchorId: string | null;
        position: FileNodeInsertPosition;
    },
) => {
    try {
        return db.transaction(async (tx) => {
            const source = await tx.select()
                                   .from(fileNodes)
                                   .where(and(eq(fileNodes.projectId, projectId), eq(fileNodes.id, data.id)));
            const sourceFileNode = source[0];
            if (!sourceFileNode) {
                return null;
            }

            const destinationSiblings = sourceFileNode.parentId === data.parentId
                ? await listDirectoryFilesForExecutor(tx, projectId, sourceFileNode.parentId)
                : await listDirectoryFilesForExecutor(tx, projectId, data.parentId);

            const siblingTargets = destinationSiblings.filter((sibling) => sibling.id !== sourceFileNode.id);
            const insertionPlan = buildInsertionPlan(
                siblingTargets,
                sourceFileNode.id,
                data.anchorId,
                data.position,
            );

            const updated = await tx.update(fileNodes)
                                    .set({
                                        name: data.name,
                                        parentId: data.parentId,
                                        position: insertionPlan.position,
                                    })
                                    .where(and(eq(fileNodes.projectId, projectId), eq(fileNodes.id, sourceFileNode.id)))
                                    .returning();

            if (!updated[0]) {
                return null;
            }

            if (insertionPlan.orderedIds) {
                await applyOrderedPositions(tx, projectId, insertionPlan.orderedIds);
            }
            return updated[0];
        });
    } catch (error) {
        if (isFileNodeUniqueConstraintError(error)) {
            throw new FileNodeUniqueConstraintError('File name already exists in that parent directory.');
        }
        throw error;
    }
}

export const updateFileNodePositions = async(projectId: string, orderedIds: string[]) => {
    await applyOrderedPositions(db, projectId, orderedIds);
    return true;
}

export const areFileNodesInSameDirectory = async(projectId: string, fileIds: string[]) => {
    if (fileIds.length === 0) {
        return true;
    }

    const uniqueFileIds = [...new Set(fileIds)];
    const result = await db.select({
                            id: fileNodes.id,
                            parentId: fileNodes.parentId,
                        })
                        .from(fileNodes)
                        .where(and(
                            eq(fileNodes.projectId, projectId),
                            sql`${fileNodes.id} = ANY(${uniqueFileIds})`,
                        ));

    if (result.length !== uniqueFileIds.length) {
        return false;
    }

    const firstParentId = result[0]?.parentId ?? null;
    return result.every((fileNode) => (fileNode.parentId ?? null) === firstParentId);
}

export const updateBulkFileNodes = async(projectId: string, data: UpdateFileRequest[]) => {
    if (data.length === 0) {
        return true;
    }

    const updatedRows = await db.transaction(async (tx) => {
        const results: FileNode[] = [];

        for (const item of data) {
            const patch: Partial<Pick<FileNode, "name" | "parentId">> = {};

            if ("name" in item) {
                patch.name = item.name;
            }

            if ("parentId" in item) {
                patch.parentId = item.parentId;
            }

            const updated = await tx
                .update(fileNodes)
                .set(patch)
                .where(and(eq(fileNodes.projectId, projectId), eq(fileNodes.id, item.id)))
                .returning();

            if (updated[0]) {
                results.push(updated[0]);
            }
        }

        return results;
    });

    return updatedRows.length === data.length;
}

export const updateFileContent = async(projectId: string, fileNodeId: string, data: UpdateFileContentRequest)=>{
    const result = await db.update(fileNodeContents)
                           .set(data)
                           .where(and(eq(fileNodeContents.projectId, projectId), eq(fileNodeContents.fileNodeId, fileNodeId)))
                           .returning();
    return result[0];
}

export const createFileWithContentAtPosition = async(
    projectId: string,
    data: FileCreationRequest,
    content: UpdateFileContentRequest,
    anchorId: string | null,
    position: FileNodeInsertPosition,
) => {
    return db.transaction(async (tx) => {
        const siblings = await listDirectoryFilesForExecutor(tx, projectId, data.parentId);
        const provisionalPosition = getNextPositionFromSiblings(siblings);
        const file = await tx.insert(fileNodes)
                             .values({...data, position: provisionalPosition})
                             .onConflictDoNothing()
                             .returning();
        if(file.length === 0){
            return null;
        }

        const insertedFile = file[0];
        await tx.insert(fileNodeContents).values({
            projectId,
            fileNodeId: insertedFile.id,
            content: content.content,
            jsonContent: content.jsonContent,
            proseContent: content.proseContent,
        }).returning();

        const insertionPlan = buildInsertionPlan(
            siblings,
            insertedFile.id,
            anchorId,
            position,
        );

        if (insertionPlan.position !== provisionalPosition) {
            await tx.update(fileNodes)
                    .set({position: insertionPlan.position})
                    .where(and(eq(fileNodes.projectId, projectId), eq(fileNodes.id, insertedFile.id)));
        }

        if (insertionPlan.orderedIds) {
            await applyOrderedPositions(tx, projectId, insertionPlan.orderedIds);
        }
        return insertedFile;
    });
}

export const createFileWithContent = async(projectId: string, data: FileCreationRequest, content: UpdateFileContentRequest) => {
    return createFileWithContentAtPosition(projectId, data, content, null, 'end');
}

export const insertFileNodeInDirectory = async(
    projectId: string,
    data: {
        id: string;
        parentId: string | null;
        anchorId: string | null;
        position: FileNodeInsertPosition;
    },
) => {
    return db.transaction(async (tx) => {
        const source = await tx.select()
                               .from(fileNodes)
                               .where(and(eq(fileNodes.projectId, projectId), eq(fileNodes.id, data.id)));
        const sourceFileNode = source[0];
        if (!sourceFileNode) {
            return null;
        }

        const destinationSiblings = sourceFileNode.parentId === data.parentId
            ? await listDirectoryFilesForExecutor(tx, projectId, sourceFileNode.parentId)
            : await listDirectoryFilesForExecutor(tx, projectId, data.parentId);

        const siblingTargets = destinationSiblings.filter((sibling) => sibling.id !== sourceFileNode.id);
        const insertionPlan = buildInsertionPlan(
            siblingTargets,
            sourceFileNode.id,
            data.anchorId,
            data.position,
        );

        const updated = await tx.update(fileNodes)
                                .set({
                                    parentId: data.parentId,
                                    position: insertionPlan.position,
                                })
                                .where(and(eq(fileNodes.projectId, projectId), eq(fileNodes.id, sourceFileNode.id)))
                                .returning();

        if (!updated[0]) {
            return null;
        }

        if (insertionPlan.orderedIds) {
            await applyOrderedPositions(tx, projectId, insertionPlan.orderedIds);
        }
        return updated[0];
    });
}

async function listDirectoryFilesForExecutor(executor: DbExecutor, projectId: string, parentId: string | null) {
    return executor.select()
                   .from(fileNodes)
                   .where(and(
                        eq(fileNodes.projectId, projectId),
                        parentId === null ? isNull(fileNodes.parentId) : eq(fileNodes.parentId, parentId),
                   ))
                   .orderBy(asc(fileNodes.position));
}

async function applyOrderedPositions(executor: Pick<typeof db, 'execute'>, projectId: string, orderedIds: string[]) {
    if (orderedIds.length === 0) {
        return;
    }

    const caseStatements = orderedIds
        .map((id, index) => `WHEN '${id}' THEN ${(index + 1) * ORDER_GAP}`)
        .join(" ");

    await executor.execute(sql`
        UPDATE file_nodes
        SET position = CASE id ${sql.raw(caseStatements)} END
        WHERE project_id = ${projectId}
          AND id = ANY(${orderedIds})
    `);
}

function getNextPositionFromSiblings(siblings: Array<{position: number}>) {
    const lastPosition = siblings[siblings.length - 1]?.position ?? 0;
    return lastPosition + ORDER_GAP;
}

function buildInsertionPlan(
    siblings: Array<{id: string; position: number}>,
    fileNodeId: string,
    anchorId: string | null,
    position: FileNodeInsertPosition,
) {
    const insertIndex = resolveInsertionIndex(siblings.map((sibling) => sibling.id), anchorId, position);
    const previousSibling = siblings[insertIndex - 1];
    const nextSibling = siblings[insertIndex];

    if (!previousSibling && !nextSibling) {
        return {position: ORDER_GAP};
    }

    if (!previousSibling && nextSibling) {
        return {position: nextSibling.position - ORDER_GAP};
    }

    if (previousSibling && !nextSibling) {
        return {position: previousSibling.position + ORDER_GAP};
    }

    if (!previousSibling || !nextSibling) {
        throw new FileNodeInsertionError('Unable to resolve insertion position.')
    }

    const positionGap = nextSibling.position - previousSibling.position;
    if (positionGap > 1) {
        return {position: Math.floor((previousSibling.position + nextSibling.position) / 2)};
    }

    const orderedIds = siblings.map((sibling) => sibling.id);
    orderedIds.splice(insertIndex, 0, fileNodeId);
    return {
        position: (insertIndex + 1) * ORDER_GAP,
        orderedIds,
    };
}

function resolveInsertionIndex(
    siblingIds: string[],
    anchorId: string | null,
    position: FileNodeInsertPosition,
) {
    switch (position) {
        case 'start':
            return 0;
        case 'end':
            return siblingIds.length;
        case 'before':
        case 'after': {
            if (!anchorId) {
                throw new FileNodeInsertionError(`anchorId is required when position is ${position}.`)
            }

            const anchorIndex = siblingIds.findIndex((id) => id === anchorId);
            if (anchorIndex === -1) {
                throw new FileNodeInsertionError(`Anchor file "${anchorId}" was not found in the target directory.`)
            }

            return position === 'before' ? anchorIndex : anchorIndex + 1;
        }
    }
}

export const listDirectoryFiles = async(projectId: string, parentId: string | null) => {
    // We get only a single level of files under the parentId
    const result = await db.select()
                          .from(fileNodes).where(and(eq(fileNodes.projectId, projectId), parentId === null ? isNull(fileNodes.parentId) : eq(fileNodes.parentId, parentId)))
                          .orderBy(asc(fileNodes.position));
    return result;
}

export const getNextFileNodePosition = async(projectId: string, parentId: string | null) => {
    const siblings = await listDirectoryFiles(projectId, parentId);
    return getNextPositionFromSiblings(siblings);
}

export const getFileContentById = async(projectId: string, fileNodeId: string) => {
    const result = await db.select().from(fileNodeContents).where(and(eq(fileNodeContents.projectId, projectId), eq(fileNodeContents.fileNodeId, fileNodeId)));
    return result[0];
}

export const getFileNodePathById = async(projectId: string, fileNodeId: string) => {
    const result = await db.execute(sql`
        WITH RECURSIVE ancestors AS (
            SELECT
                fn.id,
                fn.parent_id,
                fn.name,
                0 AS depth
            FROM file_nodes fn
            WHERE fn.project_id = ${projectId}
              AND fn.id = ${fileNodeId}

            UNION ALL

            SELECT
                parent.id,
                parent.parent_id,
                parent.name,
                ancestors.depth + 1
            FROM file_nodes parent
            JOIN ancestors ON ancestors.parent_id = parent.id
            WHERE parent.project_id = ${projectId}
        ) CYCLE id SET is_cycle USING cycle_path
        SELECT '/' || string_agg(name, '/' ORDER BY depth DESC) AS path
        FROM ancestors
        WHERE NOT is_cycle
    `);

    const row = result.rows[0] as { path?: string | null } | undefined;
    return row?.path ?? null;
}

export const searchDirectoryChunksByKeyword = async(
    projectId: string,
    fileNodeId: string,
    keyword: string,
    limit = 20,
) => {
    // Works with files as well
    const normalizedKeyword = keyword.trim();

    if (!normalizedKeyword) {
        return [];
    }

    const query = sql`websearch_to_tsquery('simple', ${normalizedKeyword})`;
    const result = await db.execute(sql`
        WITH RECURSIVE subtree AS (
            SELECT
                fn.id,
                fn.directory
            FROM file_nodes fn
            WHERE fn.project_id = ${projectId}
              AND fn.id = ${fileNodeId}

            UNION ALL

            SELECT
                child.id,
                child.directory
            FROM file_nodes child
            JOIN subtree ON child.parent_id = subtree.id
            WHERE child.project_id = ${projectId}
        ) CYCLE id SET is_cycle USING subtree_cycle_path,
        hits AS (
            SELECT
                chunks.id,
                chunks.file_node_id,
                chunks.chunk_index,
                chunks.chunk_text,
                ts_rank_cd(chunks.search_text, ${query}) AS rank
            FROM file_node_content_chunks chunks
            JOIN subtree ON subtree.id = chunks.file_node_id
            WHERE chunks.project_id = ${projectId}
              AND NOT subtree.is_cycle
              AND subtree.directory = false
              AND chunks.search_text @@ ${query}
            ORDER BY rank DESC, chunks.chunk_index ASC
            LIMIT ${limit}
        ),
        hit_files AS (
            SELECT DISTINCT hits.file_node_id
            FROM hits
        ),
        ancestors AS (
            SELECT
                fn.id,
                fn.parent_id,
                fn.name,
                fn.id AS leaf_id,
                0 AS depth
            FROM file_nodes fn
            JOIN hit_files ON hit_files.file_node_id = fn.id
            WHERE fn.project_id = ${projectId}

            UNION ALL

            SELECT
                parent.id,
                parent.parent_id,
                parent.name,
                ancestors.leaf_id,
                ancestors.depth + 1
            FROM file_nodes parent
            JOIN ancestors ON ancestors.parent_id = parent.id
            WHERE parent.project_id = ${projectId}
        ) CYCLE id SET is_cycle USING ancestor_cycle_path,
        paths AS (
            SELECT
                ancestors.leaf_id AS file_node_id,
                '/' || string_agg(ancestors.name, '/' ORDER BY ancestors.depth DESC) AS path
            FROM ancestors
            WHERE NOT ancestors.is_cycle
            GROUP BY ancestors.leaf_id
        )
        SELECT
            hits.id,
            hits.file_node_id AS "fileNodeId",
            hits.chunk_index AS "chunkIndex",
            hits.chunk_text AS "chunkText",
            paths.path,
            hits.rank
        FROM hits
        JOIN paths ON paths.file_node_id = hits.file_node_id
        ORDER BY hits.rank DESC, hits.chunk_index ASC
    `);

    return result.rows as Array<{
        id: string;
        fileNodeId: string;
        chunkIndex: number;
        chunkText: string;
        path: string;
        rank: number;
    }>;
}

export const searchProjectChunksByKeyword = async(
    projectId: string,
    keyword: string,
    limit = 20,
) => {
    const normalizedKeyword = keyword.trim();

    if (!normalizedKeyword) {
        return [];
    }

    const query = sql`websearch_to_tsquery('simple', ${normalizedKeyword})`;
    const result = await db.execute(sql`
        WITH RECURSIVE hits AS (
            SELECT
                chunks.id,
                chunks.file_node_id,
                chunks.chunk_index,
                chunks.chunk_text,
                ts_rank_cd(chunks.search_text, ${query}) AS rank
            FROM file_node_content_chunks chunks
            WHERE chunks.project_id = ${projectId}
              AND chunks.search_text @@ ${query}
            ORDER BY rank DESC, chunks.chunk_index ASC
            LIMIT ${limit}
        ),
        hit_files AS (
            SELECT DISTINCT hits.file_node_id
            FROM hits
        ),
        ancestors AS (
            SELECT
                fn.id,
                fn.parent_id,
                fn.name,
                fn.id AS leaf_id,
                0 AS depth
            FROM file_nodes fn
            JOIN hit_files ON hit_files.file_node_id = fn.id
            WHERE fn.project_id = ${projectId}

            UNION ALL

            SELECT
                parent.id,
                parent.parent_id,
                parent.name,
                ancestors.leaf_id,
                ancestors.depth + 1
            FROM file_nodes parent
            JOIN ancestors ON ancestors.parent_id = parent.id
            WHERE parent.project_id = ${projectId}
        ) CYCLE id SET is_cycle USING ancestor_cycle_path,
        paths AS (
            SELECT
                ancestors.leaf_id AS file_node_id,
                '/' || string_agg(ancestors.name, '/' ORDER BY ancestors.depth DESC) AS path
            FROM ancestors
            WHERE NOT ancestors.is_cycle
            GROUP BY ancestors.leaf_id
        )
        SELECT
            hits.id,
            hits.file_node_id AS "fileNodeId",
            hits.chunk_index AS "chunkIndex",
            hits.chunk_text AS "chunkText",
            paths.path,
            hits.rank
        FROM hits
        JOIN paths ON paths.file_node_id = hits.file_node_id
        ORDER BY hits.rank DESC, hits.chunk_index ASC
    `);

    return result.rows as Array<{
        id: string;
        fileNodeId: string;
        chunkIndex: number;
        chunkText: string;
        path: string;
        rank: number;
    }>;
}

export const semanticSearchFileChunks = async(
    projectId: string,
    fileNodeId: string,
    queryEmbedding: number[],
    limit = 20,
) => {
    if (queryEmbedding.length === 0) {
        return [];
    }

    const vectorLiteral = `[${queryEmbedding.join(",")}]`;
    const distance = sql<number>`${fileNodeContentChunks.embedding} <=> ${vectorLiteral}::vector`;

    return db.select({
                id: fileNodeContentChunks.id,
                fileNodeId: fileNodeContentChunks.fileNodeId,
                chunkIndex: fileNodeContentChunks.chunkIndex,
                chunkText: fileNodeContentChunks.chunkText,
                embeddingMetadata: fileNodeContentChunks.embeddingMetadata,
                tokenCount: fileNodeContentChunks.tokenCount,
                distance,
            })
            .from(fileNodeContentChunks)
            .where(and(
                eq(fileNodeContentChunks.projectId, projectId),
                eq(fileNodeContentChunks.fileNodeId, fileNodeId),
                sql`${fileNodeContentChunks.embedding} is not null`,
            ))
            .orderBy(sql`${distance} asc`, asc(fileNodeContentChunks.chunkIndex))
            .limit(limit);
}

export const semanticSearchDirectoryChunks = async(
    projectId: string,
    directoryId: string,
    queryEmbedding: number[],
    limit = 20,
) => {
    if (queryEmbedding.length === 0) {
        return [];
    }

    // This works with file as well

    const vectorLiteral = `[${queryEmbedding.join(",")}]`;
    const result = await db.execute(sql`
        WITH RECURSIVE subtree AS (
            SELECT
                fn.id,
                fn.directory
            FROM file_nodes fn
            WHERE fn.project_id = ${projectId}
              AND fn.id = ${directoryId}

            UNION ALL

            SELECT
                child.id,
                child.directory
            FROM file_nodes child
            JOIN subtree ON child.parent_id = subtree.id
            WHERE child.project_id = ${projectId}
        ) CYCLE id SET is_cycle USING subtree_cycle_path,
        hits AS (
            SELECT
                chunks.id,
                chunks.file_node_id,
                chunks.chunk_index,
                chunks.chunk_text,
                chunks.embedding_metadata,
                chunks.token_count,
                chunks.embedding <=> ${vectorLiteral}::vector AS distance
            FROM file_node_content_chunks chunks
            JOIN subtree ON subtree.id = chunks.file_node_id
            WHERE chunks.project_id = ${projectId}
              AND NOT subtree.is_cycle
              AND subtree.directory = false
              AND chunks.embedding IS NOT NULL
            ORDER BY distance ASC, chunks.chunk_index ASC
            LIMIT ${limit}
        ),
        hit_files AS (
            SELECT DISTINCT hits.file_node_id
            FROM hits
        ),
        ancestors AS (
            SELECT
                fn.id,
                fn.parent_id,
                fn.name,
                fn.id AS leaf_id,
                0 AS depth
            FROM file_nodes fn
            JOIN hit_files ON hit_files.file_node_id = fn.id
            WHERE fn.project_id = ${projectId}

            UNION ALL

            SELECT
                parent.id,
                parent.parent_id,
                parent.name,
                ancestors.leaf_id,
                ancestors.depth + 1
            FROM file_nodes parent
            JOIN ancestors ON ancestors.parent_id = parent.id
            WHERE parent.project_id = ${projectId}
        ) CYCLE id SET is_cycle USING ancestor_cycle_path,
        paths AS (
            SELECT
                ancestors.leaf_id AS file_node_id,
                '/' || string_agg(ancestors.name, '/' ORDER BY ancestors.depth DESC) AS path
            FROM ancestors
            WHERE NOT ancestors.is_cycle
            GROUP BY ancestors.leaf_id
        )
        SELECT
            hits.id,
            hits.file_node_id AS "fileNodeId",
            hits.chunk_index AS "chunkIndex",
            hits.chunk_text AS "chunkText",
            hits.embedding_metadata AS "embeddingMetadata",
            hits.token_count AS "tokenCount",
            paths.path,
            hits.distance
        FROM hits
        JOIN paths ON paths.file_node_id = hits.file_node_id
        ORDER BY hits.distance ASC, hits.chunk_index ASC
    `);

    return result.rows as Array<{
        id: string;
        fileNodeId: string;
        chunkIndex: number;
        chunkText: string;
        embeddingMetadata: Record<string, unknown> | null;
        tokenCount: number | null;
        path: string;
        distance: number;
    }>;
}

export const semanticSearchProjectChunks = async(
    projectId: string,
    queryEmbedding: number[],
    limit = 20,
) => {
    if (queryEmbedding.length === 0) {
        return [];
    }

    const vectorLiteral = `[${queryEmbedding.join(",")}]`;
    const result = await db.execute(sql`
        WITH RECURSIVE hits AS (
            SELECT
                chunks.id,
                chunks.file_node_id,
                chunks.chunk_index,
                chunks.chunk_text,
                chunks.embedding_metadata,
                chunks.token_count,
                chunks.embedding <=> ${vectorLiteral}::vector AS distance
            FROM file_node_content_chunks chunks
            WHERE chunks.project_id = ${projectId}
              AND chunks.embedding IS NOT NULL
            ORDER BY distance ASC, chunks.chunk_index ASC
            LIMIT ${limit}
        ),
        hit_files AS (
            SELECT DISTINCT hits.file_node_id
            FROM hits
        ),
        ancestors AS (
            SELECT
                fn.id,
                fn.parent_id,
                fn.name,
                fn.id AS leaf_id,
                0 AS depth
            FROM file_nodes fn
            JOIN hit_files ON hit_files.file_node_id = fn.id
            WHERE fn.project_id = ${projectId}

            UNION ALL

            SELECT
                parent.id,
                parent.parent_id,
                parent.name,
                ancestors.leaf_id,
                ancestors.depth + 1
            FROM file_nodes parent
            JOIN ancestors ON ancestors.parent_id = parent.id
            WHERE parent.project_id = ${projectId}
        ) CYCLE id SET is_cycle USING ancestor_cycle_path,
        paths AS (
            SELECT
                ancestors.leaf_id AS file_node_id,
                '/' || string_agg(ancestors.name, '/' ORDER BY ancestors.depth DESC) AS path
            FROM ancestors
            WHERE NOT ancestors.is_cycle
            GROUP BY ancestors.leaf_id
        )
        SELECT
            hits.id,
            hits.file_node_id AS "fileNodeId",
            hits.chunk_index AS "chunkIndex",
            hits.chunk_text AS "chunkText",
            hits.embedding_metadata AS "embeddingMetadata",
            hits.token_count AS "tokenCount",
            paths.path,
            hits.distance
        FROM hits
        JOIN paths ON paths.file_node_id = hits.file_node_id
        ORDER BY hits.distance ASC, hits.chunk_index ASC
    `);

    return result.rows as Array<{
        id: string;
        fileNodeId: string;
        chunkIndex: number;
        chunkText: string;
        embeddingMetadata: Record<string, unknown> | null;
        tokenCount: number | null;
        path: string;
        distance: number;
    }>;
}



// ================================
