declare module 'utif' {
  interface UtifIFD {
    width: number;
    height: number;
    data?: Uint8Array;
    [key: string]: unknown;
  }

  const UTIF: {
    decode(buffer: ArrayBuffer | Uint8Array): UtifIFD[];
    decodeImage(buffer: ArrayBuffer | Uint8Array, ifd: UtifIFD, ifds?: UtifIFD[]): void;
    toRGBA8(ifd: UtifIFD): Uint8Array;
    [key: string]: unknown;
  };

  export default UTIF;
}
