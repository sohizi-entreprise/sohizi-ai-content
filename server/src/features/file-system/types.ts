
type FileCreationRequest = {
    projectId: string;
    name: string;
    directory: boolean;
    parentId: string | null;
    position: number;
    format: 'text/markdown' | 'text/fountain';
}