
// Generate different patching strategies
class Patcher {

    async patch(oldText: string, newText: string, currentContent: string, replaceAll: boolean): Promise<string> {
        const diff = `[-${oldText}-] [+${newText}+]`;
        if(replaceAll){
            return currentContent.replaceAll(oldText, diff);
        }
        return currentContent.replace(oldText, diff);
    }

    async write(oldContent: string, newContent: string, strategy: 'overwrite' | 'append'): Promise<string> {
        if(strategy === 'overwrite'){
            return `[+newContent+]`;
        }
        return `${oldContent} [+${newContent}+]`;
    }

    async returnCurrentPatch(content: string): Promise<string> {
        return content.replaceAll('[-]', '').replaceAll('[+]', '');
    }
}