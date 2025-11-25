/* eslint-disable @typescript-eslint/no-explicit-any */

export interface DroppedFileWithPath {
    file: File;
    /**
     * Relative folder path for this file, relative to the chosen root folder.
     * Empty string means "place directly in the root folder".
     * Example: "Client A/2025/Binder Docs"
     */
    relativePath: string;
}

/**
 * Collect File objects from a DataTransfer, including folder hierarchy
 * where the browser exposes directory entries or webkitRelativePath.
 *
 * This is designed to feed the existing folder upload logic on the
 * DMS Documents page, which expects a set of files plus relative
 * directory paths so it can call batchCreateFolders + uploadToFolder.
 */
export async function collectDroppedFiles(
    dataTransfer: DataTransfer
): Promise<DroppedFileWithPath[]> {
    const collected: DroppedFileWithPath[] = [];

    // Prefer DataTransferItem list so we can use webkitGetAsEntry
    const items = dataTransfer.items;
    if (items && items.length > 0) {
        const entryPromises: Promise<void>[] = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind !== 'file') continue;

            const anyItem: any = item;
            const getAsEntry = anyItem.webkitGetAsEntry || anyItem.getAsEntry;
            const entry = typeof getAsEntry === 'function' ? getAsEntry.call(anyItem) : null;

            if (entry) {
                entryPromises.push(walkEntry(entry, '', collected));
            } else {
                const file = item.getAsFile();
                if (file) {
                    const relPath = getFolderPathFromFile(file);
                    collected.push({ file, relativePath: relPath });
                }
            }
        }

        await Promise.all(entryPromises);

        if (collected.length > 0) {
            return collected;
        }
    }

    // Fallback: use DataTransfer.files directly
    const files = dataTransfer.files;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relPath = getFolderPathFromFile(file);
        collected.push({ file, relativePath: relPath });
    }

    return collected;
}

/**
 * Extract the relative folder path from a File using webkitRelativePath
 * if available. The returned string does not include the filename.
 */
function getFolderPathFromFile(file: File): string {
    const anyFile: any = file;
    const webkitRelativePath: string | undefined = anyFile.webkitRelativePath;

    if (webkitRelativePath && webkitRelativePath.includes('/')) {
        const segments = webkitRelativePath.split('/').filter(Boolean);
        if (segments.length > 1) {
            return segments.slice(0, -1).join('/');
        }
    }

    return '';
}

/**
 * Recursively walk a FileSystemEntry tree, collecting files and
 * constructing relative folder paths for each file.
 *
 * The parentPath argument is the folder path relative to the drop root
 * (does not include the current entry's name).
 */
async function walkEntry(
    entry: any,
    parentPath: string,
    collected: DroppedFileWithPath[]
): Promise<void> {
    if (!entry) return;

    if (entry.isFile) {
        await new Promise<void>((resolve) => {
            entry.file(
                (file: File) => {
                    collected.push({ file, relativePath: parentPath || '' });
                    resolve();
                },
                () => {
                    // Ignore individual file errors; continue with the rest
                    resolve();
                }
            );
        });
        return;
    }

    if (entry.isDirectory) {
        const dirPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
        const reader = entry.createReader();

        await readAllDirectoryEntries(reader, dirPath, collected);
    }
}

/**
 * Read all entries from a FileSystemDirectoryReader, which may require
 * multiple readEntries() calls until an empty array is returned.
 */
async function readAllDirectoryEntries(
    reader: any,
    dirPath: string,
    collected: DroppedFileWithPath[]
): Promise<void> {
    const readBatch = (): Promise<any[]> =>
        new Promise((resolve, reject) => {
            reader.readEntries(
                (entries: any[]) => resolve(entries),
                (err: any) => {
                    console.error('Error reading directory entries from drag-and-drop:', err);
                    resolve([]);
                }
            );
        });

    while (true) {
        const entries = await readBatch();
        if (!entries || entries.length === 0) break;

        for (const child of entries) {
            await walkEntry(child, dirPath, collected);
        }
    }
}