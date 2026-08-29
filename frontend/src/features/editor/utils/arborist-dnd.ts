/** react-arborist drag item type (see useDragHook in react-arborist). */
export const ARBORIST_NODE_DRAG_TYPE = 'NODE'

export type ArboristNodeDragItem = {
  id: string
  dragIds: Array<string>
}
