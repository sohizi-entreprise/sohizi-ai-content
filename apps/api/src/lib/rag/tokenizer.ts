export interface TokenizerInterface {
  tokenLength(text: string): Promise<number>
}
