import { type Block } from "../type";

type Primitive = string | number | boolean | null | undefined;
type SchemaPayload = Record<string, Primitive | Array<Primitive | SchemaPayload> | Record<string, Primitive> >

export const transformSchemaToBlock = (schema: SchemaPayload) => {

    const blocks: Block[] = [];
    const blockIds = new Set<string>(); // Track block IDs to prevent duplicates

    for(const [key, value] of Object.entries(schema)) {
        switch(key){
            case 'title':
                const titleId = 'title';
                if (!blockIds.has(titleId)) {
                    blocks.push({
                        id: titleId,
                        content: value as string,
                        type: 'title',
                    });
                    blockIds.add(titleId);
                }
                break;
            case 'logline':
                const loglineId = 'logline';
                if (!blockIds.has(loglineId)) {
                    blocks.push({
                        id: loglineId,
                        content: value as string,
                        type: 'logline',
                    });
                    blockIds.add(loglineId);
                }
                break;
            case 'segments':
                for(const segment of value as Array<SchemaPayload>) {
                    const segmentId = segment.id as string;
                    if (!blockIds.has(segmentId)) {
                        blocks.push({
                            id: segmentId,
                            content: segment.title as string,
                            payload: {
                                title: segment.title as string,
                                summary: segment.summary as string,
                                goals: segment.goals as Array<string>,
                                turningPoints: segment.turningPoints as Array<string>,
                            },
                            type: 'segment',
                        });
                        const summaryId = `${segmentId}-summary`;
                        blocks.push({
                            id: summaryId,
                            content: segment.summary as string,
                            type: 'summary',
                            parentId: segmentId,
                        });
                        blockIds.add(segmentId);
                        blockIds.add(summaryId);
                    }
                    const scenes = (segment.scenes || []) as Array<SchemaPayload>;
                    for(const scene of scenes) {
                        const sceneId = scene.id as string;
                        if (!blockIds.has(sceneId)) {
                            blocks.push({
                                id: sceneId,
                                content: scene.summary as string,
                                parentId: segmentId,
                                payload: {
                                    title: scene.title as string,
                                    summary: scene.summary as string,
                                    segmentId: segment.id as string,
                                },
                                type: 'scene',
                            });
                            blockIds.add(sceneId);
                        }
                    }
                }
                break;
            default:
                break;
        }
    }

    return blocks;

}