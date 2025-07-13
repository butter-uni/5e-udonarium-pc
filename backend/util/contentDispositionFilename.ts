export function contentDispositionFilename(filename:string) {
    // 制御文字や不正な文字を除去・置換
    let cleanedFilename = filename.replace(/[\x00-\x1F\x7F]/g, '_');
    cleanedFilename = cleanedFilename.replace(/[";\\/]/g, '_'); // 例: 特定の記号を置換
    cleanedFilename = encodeURIComponent(cleanedFilename);
    return cleanedFilename;
}