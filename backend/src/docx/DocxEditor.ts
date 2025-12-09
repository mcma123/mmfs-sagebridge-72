import PizZip from 'pizzip';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export type BlockType = 'paragraph' | 'table';

export interface ParagraphBlock {
    id: string;
    type: 'paragraph';
    path: string | null;
    text: string;
}

export interface TableCell {
    id: string;
    path: string;
    text: string;
}

export interface TableRow {
    cells: TableCell[];
}

export interface TableBlock {
    id: string;
    type: 'table';
    path: string;
    rows: TableRow[];
}

export interface DocxContent {
    blocks: Array<ParagraphBlock | TableBlock>;
}

const parserOptions = {
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: false,
    preserveOrder: true,
};

const builderOptions = {
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    preserveOrder: true,
    suppressEmptyNode: false,
    removeNSPrefix: false,
};

/**
 * Parse a DOCX buffer and extract editable content (paragraphs and table cells)
 * into a simple JSON structure.
 */
export function parseDocxToBlocks(buffer: Buffer): DocxContent {
    const { root, bodyChildren } = loadDocumentBody(buffer);
    const blocks: Array<ParagraphBlock | TableBlock> = [];

    let paragraphIndex = 0;
    let tableIndex = 0;

    for (const child of bodyChildren) {
        if (child['w:p']) {
            paragraphIndex += 1;
            const path = `body/p[${paragraphIndex}]`;
            const text = extractParagraphText(child['w:p']);
            blocks.push({
                id: `p-${paragraphIndex}`,
                type: 'paragraph',
                path,
                text,
            });
        } else if (child['w:tbl']) {
            tableIndex += 1;
            const tablePath = `body/tbl[${tableIndex}]`;
            const block = extractTableBlock(child['w:tbl'], tableIndex, tablePath);
            if (block) {
                blocks.push(block);
            }
        }
    }

    return { blocks };
}

/**
 * Apply edited JSON content back into the original DOCX buffer, preserving
 * all non-text structure (styles, headers/footers, images, etc.) as far as
 * possible by only replacing text nodes in the main document body.
 */
export function applyBlocksToDocx(originalBuffer: Buffer, content: DocxContent): Buffer {
    const { root, bodyChildren } = loadDocumentBody(originalBuffer);

    // Build initial index of paragraphs and table cells by path for quick lookup.
    const paragraphIndex = new Map<string, any[]>();
    const cellIndex = new Map<string, any[]>();

    let paragraphCounter = 0;
    let tableCounter = 0;

    for (const child of bodyChildren) {
        if (child['w:p']) {
            paragraphCounter += 1;
            const path = `body/p[${paragraphCounter}]`;
            paragraphIndex.set(path, child['w:p']);
        } else if (child['w:tbl']) {
            tableCounter += 1;
            const tablePath = `body/tbl[${tableCounter}]`;
            indexTableCells(child['w:tbl'], tablePath, cellIndex);
        }
    }

    const paragraphBlocks = content.blocks.filter(
        (b): b is ParagraphBlock => b.type === 'paragraph'
    );
    const requestedParagraphPaths = new Set(
        paragraphBlocks
            .map((b) => b.path)
            .filter((p): p is string => !!p)
    );

    // 1) Delete paragraphs that were removed by the editor.
    const newBodyChildren: any[] = [];
    let deleteCounter = 0;
    for (const child of bodyChildren) {
        if (child['w:p']) {
            deleteCounter += 1;
            const path = `body/p[${deleteCounter}]`;
            if (requestedParagraphPaths.has(path)) {
                newBodyChildren.push(child);
            }
            // If not requested, we drop this paragraph (effectively deleted).
        } else {
            newBodyChildren.push(child);
        }
    }
    bodyChildren.length = 0;
    bodyChildren.push(...newBodyChildren);

    // 2) Rebuild indices after structural changes.
    paragraphIndex.clear();
    cellIndex.clear();
    paragraphCounter = 0;
    tableCounter = 0;

    for (const child of bodyChildren) {
        if (child['w:p']) {
            paragraphCounter += 1;
            const path = `body/p[${paragraphCounter}]`;
            paragraphIndex.set(path, child['w:p']);
        } else if (child['w:tbl']) {
            tableCounter += 1;
            const tablePath = `body/tbl[${tableCounter}]`;
            indexTableCells(child['w:tbl'], tablePath, cellIndex);
        }
    }

    // 3) Apply edits to existing paragraphs and table cells.
    for (const block of content.blocks) {
        if (block.type === 'paragraph') {
            if (!block.path) {
                continue;
            }
            const pNode = paragraphIndex.get(block.path);
            if (pNode) {
                setParagraphText(pNode, block.text ?? '');
            }
        } else if (block.type === 'table') {
            for (const row of block.rows) {
                for (const cell of row.cells) {
                    const tcNode = cellIndex.get(cell.path);
                    if (tcNode) {
                        setCellText(tcNode, cell.text ?? '');
                    }
                }
            }
        }
    }

    // 4) Append any new paragraphs (blocks with path === null) to the end of the body.
    const newParagraphBlocks = paragraphBlocks.filter((b) => !b.path);

    if (newParagraphBlocks.length > 0) {
        let firstRunTemplate: any | null = null;

        // Try to find a template run from the first existing paragraph to preserve basic styling.
        for (const child of bodyChildren) {
            if (child['w:p']) {
                const pChildren = child['w:p'] as any[];
                for (const pChild of pChildren) {
                    if (pChild['w:r']) {
                        firstRunTemplate = pChild;
                        break;
                    }
                }
            }
            if (firstRunTemplate) break;
        }

        for (const block of newParagraphBlocks) {
            const newRun = buildRunWithText(firstRunTemplate, block.text ?? '');
            const newParagraphNode = { 'w:p': [newRun] };
            bodyChildren.push(newParagraphNode);
        }
    }

    const builder = new XMLBuilder(builderOptions as any);
    const xml = builder.build(root as any);

    const zip = new PizZip(originalBuffer);
    zip.file('word/document.xml', xml);
    return zip.generate({ type: 'nodebuffer' }) as Buffer;
}

/**
 * Load and parse word/document.xml from a DOCX buffer and return the parsed
 * root plus the array of children under w:body.
 */
function loadDocumentBody(buffer: Buffer): { root: any; bodyChildren: any[] } {
    const zip = new PizZip(buffer);
    const file = zip.file('word/document.xml');
    if (!file) {
        throw new Error('DOCX does not contain word/document.xml');
    }

    const xml = file.asText();
    const parser = new XMLParser(parserOptions as any);
    const root = parser.parse(xml) as any;

    if (!Array.isArray(root)) {
        throw new Error('Unexpected DOCX XML structure (expected preserveOrder array)');
    }

    const documentNode = root.find((n: any) => n['w:document']);
    if (!documentNode) {
        throw new Error('DOCX document.xml missing w:document');
    }

    const documentChildren = documentNode['w:document'] as any[];
    if (!Array.isArray(documentChildren)) {
        throw new Error('DOCX w:document has unexpected structure');
    }

    const bodyNode = documentChildren.find((n: any) => n['w:body']);
    if (!bodyNode) {
        throw new Error('DOCX document.xml missing w:body');
    }

    const bodyChildren = bodyNode['w:body'] as any[];
    if (!Array.isArray(bodyChildren)) {
        throw new Error('DOCX w:body has unexpected structure');
    }

    return { root, bodyChildren };
}

function extractParagraphText(pChildren: any[]): string {
    let text = '';

    for (const child of pChildren) {
        if (child['w:r']) {
            const runChildren = child['w:r'] as any[];
            for (const rChild of runChildren) {
                if (rChild['w:t']) {
                    const tChildren = rChild['w:t'] as any[];
                    for (const tChild of tChildren) {
                        if (typeof tChild['#text'] === 'string') {
                            text += tChild['#text'];
                        }
                    }
                }
            }
        }
    }

    return text;
}

function extractTableBlock(tblChildren: any[], tblIndex: number, tablePath: string): TableBlock | null {
    const rows: TableRow[] = [];
    let rowIndex = 0;

    for (const child of tblChildren) {
        if (child['w:tr']) {
            rowIndex += 1;
            const trChildren = child['w:tr'] as any[];
            const rowCells: TableCell[] = [];
            let cellIndex = 0;

            for (const trChild of trChildren) {
                if (trChild['w:tc']) {
                    cellIndex += 1;
                    const tcChildren = trChild['w:tc'] as any[];
                    const cellText = extractTableCellText(tcChildren);
                    const cellPath = `${tablePath}/tr[${rowIndex}]/tc[${cellIndex}]`;
                    rowCells.push({
                        id: `tbl-${tblIndex}-r${rowIndex}-c${cellIndex}`,
                        path: cellPath,
                        text: cellText,
                    });
                }
            }

            if (rowCells.length > 0) {
                rows.push({ cells: rowCells });
            }
        }
    }

    if (rows.length === 0) {
        return null;
    }

    return {
        id: `tbl-${tblIndex}`,
        type: 'table',
        path: tablePath,
        rows,
    };
}

function extractTableCellText(tcChildren: any[]): string {
    let text = '';

    for (const child of tcChildren) {
        if (child['w:p']) {
            const pChildren = child['w:p'] as any[];
            const paragraphText = extractParagraphText(pChildren);
            if (paragraphText) {
                if (text) text += '\n';
                text += paragraphText;
            }
        }
    }

    return text;
}

function indexTableCells(tblChildren: any[], tablePath: string, cellIndex: Map<string, any[]>): void {
    let rowIndex = 0;

    for (const child of tblChildren) {
        if (child['w:tr']) {
            rowIndex += 1;
            const trChildren = child['w:tr'] as any[];
            let cellIdx = 0;

            for (const trChild of trChildren) {
                if (trChild['w:tc']) {
                    cellIdx += 1;
                    const tcChildren = trChild['w:tc'] as any[];
                    const cellPath = `${tablePath}/tr[${rowIndex}]/tc[${cellIdx}]`;
                    cellIndex.set(cellPath, tcChildren);
                }
            }
        }
    }
}

function setParagraphText(pChildren: any[], text: string): void {
    const newChildren: any[] = [];
    let firstRunTemplate: any | null = null;

    for (const child of pChildren) {
        if (child['w:r']) {
            if (!firstRunTemplate) {
                firstRunTemplate = child;
            }
            // Skip existing runs; they will be replaced.
            continue;
        }
        newChildren.push(child);
    }

    const newRun = buildRunWithText(firstRunTemplate, text);
    newChildren.push(newRun);

    pChildren.length = 0;
    pChildren.push(...newChildren);
}

function setCellText(tcChildren: any[], text: string): void {
    const newChildren: any[] = [];
    let firstRunTemplate: any | null = null;

    for (const child of tcChildren) {
        if (child['w:p']) {
            const pChildren = child['w:p'] as any[];
            // Find first run template inside this paragraph
            for (const pChild of pChildren) {
                if (pChild['w:r']) {
                    firstRunTemplate = pChild;
                    break;
                }
            }
            // We'll drop existing paragraphs and create a single new one below.
            continue;
        }
        newChildren.push(child);
    }

    const newParagraphRun = buildRunWithText(firstRunTemplate, text);
    const newParagraph = { 'w:p': [newParagraphRun] };
    newChildren.push(newParagraph);

    tcChildren.length = 0;
    tcChildren.push(...newChildren);
}

function buildRunWithText(templateRun: any | null, text: string): any {
    const tNode = { 'w:t': [{ '#text': text }] };

    if (!templateRun || !Array.isArray(templateRun['w:r'])) {
        return { 'w:r': [tNode] };
    }

    const templateChildren = templateRun['w:r'] as any[];
    const newChildren: any[] = [];

    for (const child of templateChildren) {
        if (child['w:rPr']) {
            newChildren.push(child);
        }
    }

    newChildren.push(tNode);
    return { 'w:r': newChildren };
}