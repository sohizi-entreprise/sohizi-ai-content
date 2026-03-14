import { Editor, Extension } from "@tiptap/core";
import { toast } from "sonner";

type DiffChange = {
    type: 'addition' | 'deletion'
    blockId: string
}

type DiffMap = Map<string, DiffChange[]>;

declare module '@tiptap/core' {
    interface Storage {
        diffStore: { diffMap: DiffMap };
    }
  }
  
export const DiffStoreExtension = Extension.create({
    name: 'diffStore',
    addStorage() {
        return { diffMap: new Map() as DiffMap };
    },
    onCreate({editor}){
        const initialDiffMap = buildDiffMap(editor)
        for(const [rootId, changes] of initialDiffMap){
            const baseChanges = changes.map(({type, blockId}) => ({type, blockId}))
            editor.storage.diffStore.diffMap.set(rootId, baseChanges)
        }
    }
})


export function respondToChanges(editor: Editor, action: 'accept' | 'decline'){
    const diffMap = editor.storage.diffStore.diffMap
    if(diffMap.size === 0) return

    const mapPerAction = {
        accept: 'addition',
        decline: 'deletion',
    } as const

    // We want to get the current state (position + text of the editor) before accepting or declining changes
    const currentDiffMap = buildDiffMap(editor)

    for(const [rootId, _changes] of diffMap){
        const currentChanges = currentDiffMap.get(rootId)
        if(!currentChanges || currentChanges.length === 0) continue

        if(currentChanges.length === 1){
            // This means that we are either inserting or deleting
            const { type, from, to, text } = currentChanges[0]
            const content = type === mapPerAction[action] ? text : ''
            let success = editor.chain()
                .focus()
                .deleteRange({ from, to })
                .insertContentAt(from, content)
                .run()
            if(!success) {
                toast.error('Failed to apply changes')
                return
            }
            diffMap.delete(rootId)
        }
        else{
            // This means that we are replacing
            const minFrom = Math.min(...currentChanges.map((change) => change.from))
            const maxTo = Math.max(...currentChanges.map((change) => change.to))

            const content = currentChanges.filter((change) => change.type === mapPerAction[action]).map((change) => change.text).join('')
            let success = editor.chain()
                .focus()
                .deleteRange({ from: minFrom, to: maxTo })
                .insertContentAt(minFrom, content)
                .run()
            if(!success) {
                toast.error('Failed to apply changes')
                return
            }
            diffMap.delete(rootId)
        }
    }
}

function buildDiffMap(editor: Editor){
const diffMap = new Map<string, (DiffChange & {text: string; from: number; to: number})[]>()

const additionType = editor.state.schema.marks.aiAddition
const deletionType = editor.state.schema.marks.aiDeletion

if (!additionType || !deletionType) return diffMap

editor.state.doc.descendants((node, pos) => {
    if(!node.isText) return
    node.marks.forEach((mark) => {
        if (mark.type !== additionType && mark.type !== deletionType) return
        const blockId = mark.attrs.blockId as string
        if(!blockId) return

        const rootId = blockId.replace(/^addition-/, '').replace(/^deletion-/, '')

        // Implementation
        const baseInfo = {blockId, from: pos, to: pos + node.nodeSize, text: node.text ?? ''}
        switch(mark.type){
            case additionType: {
                if(!diffMap.has(rootId)) {
                    diffMap.set(rootId, [{ type: 'addition', ...baseInfo }])
                }else{
                    const array = diffMap.get(rootId) as DiffChange[]
                    array.push({ type: 'addition', ...baseInfo })
                }
                break
            }
            case deletionType:{
                if(!diffMap.has(rootId)) {
                    diffMap.set(rootId, [{ type: 'deletion', ...baseInfo }])
                }else{
                    const array = diffMap.get(rootId) as DiffChange[]
                    array.push({ type: 'deletion', ...baseInfo })
                }
                break
            }
        }

        })
    })
    return diffMap
}
