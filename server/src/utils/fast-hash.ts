export function fastHash64(input: string): string {
    let hash = 0xcbf29ce484222325n;
  
    for (let i = 0; i < input.length; i++) {
      hash ^= BigInt(input.charCodeAt(i));
      hash *= 0x100000001b3n;
      hash &= 0xffffffffffffffffn;
    }
  
    return hash.toString(36);
}