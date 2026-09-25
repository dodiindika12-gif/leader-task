import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NEXT_API_BASE_URL } from '../../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InlineToken =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'code'; content: string }
  | { type: 'link'; content: string; url: string };

type Block =
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'heading'; level: number; content: string }
  | { type: 'list_item'; ordered: boolean; bullet: string; content: string }
  | { type: 'code_block'; lang?: string; code: string }
  | { type: 'blockquote'; content: string }
  | { type: 'paragraph'; content: string }
  | { type: 'space' };

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
}

// ---------------------------------------------------------------------------
// Tokenizers & Parsers
// ---------------------------------------------------------------------------

/**
 * Parses inline formatting: **bold**, `code`, [link](url), *italic*
 */
function tokenizeInline(text: string): InlineToken[] {
  if (!text) return [];
  const tokens: InlineToken[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith('**') && raw.endsWith('**')) {
      tokens.push({ type: 'bold', content: raw.slice(2, -2) });
    } else if (raw.startsWith('`') && raw.endsWith('`')) {
      tokens.push({ type: 'code', content: raw.slice(1, -1) });
    } else if (raw.startsWith('[') && raw.includes('](')) {
      const closeBracket = raw.indexOf('](');
      const label = raw.slice(1, closeBracket);
      const url = raw.slice(closeBracket + 2, -1);
      tokens.push({ type: 'link', content: label, url });
    } else if (raw.startsWith('*') && raw.endsWith('*')) {
      tokens.push({ type: 'italic', content: raw.slice(1, -1) });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', content: text.substring(lastIndex) });
  }

  return tokens;
}

/**
 * Normalizes inline table runs into multiline markdown tables.
 */
function normalizeTables(md: string): string {
  if (!md || !md.includes('|')) return md;
  // If table delimiter is glued on a single line, split it
  return md.replace(/\|\s*\|\s*\|/g, '|\n|');
}

/**
 * Parses markdown text into structural blocks (Tables, Headings, Lists, Paragraphs).
 */
function parseMarkdownToBlocks(rawMd: string): Block[] {
  if (!rawMd) return [];
  const md = normalizeTables(rawMd);
  const lines = md.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      blocks.push({ type: 'space' });
      i++;
      continue;
    }

    // 1. Table detection (starts with | and contains |)
    if (trimmed.startsWith('|') && trimmed.includes('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }

      const rows: string[][] = [];
      for (const line of tableLines) {
        const clean = line.trim();
        // Skip markdown separator row |---|---|
        if (/^\|[\s|:\-]+$/.test(clean)) continue;
        const cells = clean
          .replace(/^\||\|$/g, '')
          .split('|')
          .map(c => c.trim());
        rows.push(cells);
      }

      if (rows.length > 0) {
        const headers = rows[0];
        const bodyRows = rows.slice(1);
        blocks.push({ type: 'table', headers, rows: bodyRows });
      }
      continue;
    }

    // 2. Code block detection (```)
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++; // skip closing ```
      }
      blocks.push({ type: 'code_block', lang, code: codeLines.join('\n') });
      continue;
    }

    // 3. Heading detection (# )
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      i++;
      continue;
    }

    // 4. List item detection (- item or 1. item)
    const listMatch = trimmed.match(/^([-*+]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      blocks.push({
        type: 'list_item',
        ordered: /^\d+\./.test(listMatch[1]),
        bullet: listMatch[1],
        content: listMatch[2],
      });
      i++;
      continue;
    }

    // 5. Blockquote (> )
    if (trimmed.startsWith('>')) {
      blocks.push({
        type: 'blockquote',
        content: trimmed.replace(/^>\s*/, ''),
      });
      i++;
      continue;
    }

    // 6. Regular Paragraph accumulation
    const paraLines = [rawLine];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('|') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().match(/^([-*+]|\d+\.)\s+/) &&
      !lines[i].trim().match(/^#{1,6}\s+/) &&
      !lines[i].trim().startsWith('>')
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'paragraph', content: paraLines.join('\n') });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function handleOpenUrl(url: string) {
  if (!url) return;
  const fullUrl = url.startsWith('/') ? `${NEXT_API_BASE_URL}${url}` : url;
  Linking.canOpenURL(fullUrl).then(supported => {
    if (supported) {
      Linking.openURL(fullUrl);
    }
  }).catch(() => {});
}

/**
 * Renders inline text with rich tokens (Bold, Code, Links, Italic).
 */
const FormattedInline: React.FC<{
  text: string;
  isUser?: boolean;
  baseStyle?: any;
  defaultBold?: boolean;
}> = ({ text, isUser, baseStyle, defaultBold }) => {
  const tokens = useMemo(() => tokenizeInline(text), [text]);

  return (
    <Text style={[styles.inlineBase, baseStyle, isUser && styles.textWhite]}>
      {tokens.map((token, idx) => {
        if (token.type === 'bold') {
          return (
            <Text
              key={idx}
              style={[
                styles.inlineBold,
                isUser ? styles.textWhite : styles.textDark,
                defaultBold && styles.extraBold,
              ]}
            >
              {token.content}
            </Text>
          );
        }

        if (token.type === 'code') {
          return (
            <Text key={idx} style={[styles.inlineCode, isUser && styles.inlineCodeUser]}>
              {` ${token.content} `}
            </Text>
          );
        }

        if (token.type === 'link') {
          return (
            <Text
              key={idx}
              style={styles.inlineLink}
              onPress={() => handleOpenUrl(token.url)}
            >
              {token.content}
            </Text>
          );
        }

        if (token.type === 'italic') {
          return (
            <Text key={idx} style={styles.inlineItalic}>
              {token.content}
            </Text>
          );
        }

        return (
          <Text
            key={idx}
            style={[defaultBold ? styles.inlineBold : undefined, isUser && styles.textWhite]}
          >
            {token.content}
          </Text>
        );
      })}
    </Text>
  );
};

// ---------------------------------------------------------------------------
// Table Component
// ---------------------------------------------------------------------------

const MarkdownTable: React.FC<{
  headers: string[];
  rows: string[][];
}> = ({ headers, rows }) => {
  // Determine smart column widths based on content lengths
  const colWidths = useMemo(() => {
    return headers.map((header, colIdx) => {
      let maxLen = header.length;
      for (const row of rows) {
        if (row[colIdx]) {
          maxLen = Math.max(maxLen, row[colIdx].length);
        }
      }
      if (maxLen <= 4) return 60; // No, %
      if (maxLen <= 10) return 100;
      if (maxLen <= 20) return 140; // Amounts (Rp 1.500.000.000)
      return 180; // Long branch names
    });
  }, [headers, rows]);

  return (
    <View style={styles.tableCard}>
      {/* Table meta bar */}
      <View style={styles.tableHeaderBanner}>
        <View style={styles.tableBadge}>
          <Ionicons name="stats-chart" size={11} color="#db2777" />
          <Text style={styles.tableBannerTitle}>Tabel Data ({rows.length} Baris)</Text>
        </View>
        <Text style={styles.tableScrollHint}>Geser horizontal ➔</Text>
      </View>

      {/* Horizontal Scroll Table */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        nestedScrollEnabled={true}
        contentContainerStyle={styles.tableScrollContent}
      >
        <View>
          {/* Header row */}
          <View style={styles.tableRowHeader}>
            {headers.map((h, colIdx) => (
              <View
                key={colIdx}
                style={[
                  styles.tableCellHeader,
                  { width: colWidths[colIdx] },
                  colIdx === headers.length - 1 && styles.tableCellLast,
                ]}
              >
                <Text style={styles.tableCellHeaderText} numberOfLines={2}>
                  {h.replace(/\*\*/g, '').trim()}
                </Text>
              </View>
            ))}
          </View>

          {/* Body rows */}
          {rows.map((row, rowIdx) => {
            const isTotalRow = row.some(cell =>
              /total/i.test(cell.replace(/\*/g, '').trim())
            );

            return (
              <View
                key={rowIdx}
                style={[
                  styles.tableRow,
                  rowIdx % 2 === 1 && styles.tableRowAlt,
                  isTotalRow && styles.tableRowTotal,
                  rowIdx === rows.length - 1 && styles.tableRowLast,
                ]}
              >
                {headers.map((_, colIdx) => {
                  const cell = row[colIdx] || '-';
                  return (
                    <View
                      key={colIdx}
                      style={[
                        styles.tableCell,
                        { width: colWidths[colIdx] },
                        colIdx === headers.length - 1 && styles.tableCellLast,
                        isTotalRow && styles.tableCellTotal,
                      ]}
                    >
                      <FormattedInline
                        text={cell}
                        defaultBold={isTotalRow}
                        baseStyle={isTotalRow ? styles.totalCellText : styles.bodyCellText}
                      />
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Main Markdown Renderer Component
// ---------------------------------------------------------------------------

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isUser }) => {
  const blocks = useMemo(() => parseMarkdownToBlocks(content), [content]);

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        if (block.type === 'space') {
          return <View key={idx} style={styles.verticalSpacer} />;
        }

        if (block.type === 'table') {
          return <MarkdownTable key={idx} headers={block.headers} rows={block.rows} />;
        }

        if (block.type === 'heading') {
          return (
            <View key={idx} style={styles.headingWrap}>
              <Text
                style={[
                  styles.headingText,
                  block.level === 1 && styles.h1,
                  block.level === 2 && styles.h2,
                  block.level >= 3 && styles.h3,
                  isUser && styles.textWhite,
                ]}
              >
                {block.content}
              </Text>
            </View>
          );
        }

        if (block.type === 'list_item') {
          return (
            <View key={idx} style={styles.listRow}>
              <View style={styles.bulletCol}>
                {block.ordered ? (
                  <Text style={[styles.listNumberText, isUser && styles.textWhite]}>
                    {block.bullet}
                  </Text>
                ) : (
                  <View style={styles.bulletDot} />
                )}
              </View>
              <View style={styles.listContentCol}>
                <FormattedInline text={block.content} isUser={isUser} />
              </View>
            </View>
          );
        }

        if (block.type === 'code_block') {
          return (
            <View key={idx} style={styles.codeBlockCard}>
              {Boolean(block.lang) && (
                <View style={styles.codeBlockHeader}>
                  <Text style={styles.codeBlockLang}>{block.lang?.toUpperCase()}</Text>
                </View>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={styles.codeBlockText}>{block.code}</Text>
              </ScrollView>
            </View>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <View key={idx} style={styles.blockquoteCard}>
              <FormattedInline text={block.content} isUser={isUser} baseStyle={styles.blockquoteText} />
            </View>
          );
        }

        // Paragraph
        // Check if paragraph contains download file link
        const downloadMatch = block.content.match(/^\[Unduh ([^\]]+)\]\(([^)]+)\)$/i);
        if (downloadMatch) {
          const fileName = downloadMatch[1];
          const downloadUrl = downloadMatch[2];
          return (
            <TouchableOpacity
              key={idx}
              style={styles.fileDownloadCard}
              onPress={() => handleOpenUrl(downloadUrl)}
              activeOpacity={0.8}
            >
              <View style={styles.fileIconBadge}>
                <Ionicons name="document-text" size={18} color="#db2777" />
              </View>
              <View style={styles.fileDownloadInfo}>
                <Text style={styles.fileDownloadName} numberOfLines={1}>{fileName}</Text>
                <Text style={styles.fileDownloadSub}>Ketuk untuk mengunduh dokumen</Text>
              </View>
              <Ionicons name="cloud-download-outline" size={20} color="#db2777" />
            </TouchableOpacity>
          );
        }

        return (
          <View key={idx} style={styles.paragraphWrap}>
            <FormattedInline text={block.content} isUser={isUser} />
          </View>
        );
      })}
    </View>
  );
};

export default MarkdownRenderer;

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  verticalSpacer: {
    height: 8,
  },
  paragraphWrap: {
    marginVertical: 2,
  },
  inlineBase: {
    fontSize: 14,
    lineHeight: 22,
    color: '#1e293b',
  },
  textWhite: {
    color: '#ffffff',
  },
  textDark: {
    color: '#0f172a',
  },
  inlineBold: {
    fontWeight: '700',
    color: '#0f172a',
  },
  extraBold: {
    fontWeight: '800',
  },
  inlineItalic: {
    fontStyle: 'italic',
  },
  inlineCode: {
    fontFamily: monoFont,
    fontSize: 12.5,
    backgroundColor: '#f1f5f9',
    color: '#db2777',
    fontWeight: '600',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inlineCodeUser: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: '#fbcfe8',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  inlineLink: {
    color: '#2563eb',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Headings
  headingWrap: {
    marginTop: 10,
    marginBottom: 4,
  },
  headingText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  h1: {
    fontSize: 17,
    lineHeight: 24,
  },
  h2: {
    fontSize: 15.5,
    lineHeight: 22,
  },
  h3: {
    fontSize: 14.5,
    lineHeight: 20,
  },

  // Lists
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2.5,
  },
  bulletCol: {
    width: 18,
    paddingTop: 7,
    alignItems: 'center',
  },
  bulletDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    backgroundColor: '#db2777',
  },
  listNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#db2777',
  },
  listContentCol: {
    flex: 1,
  },

  // Table
  tableCard: {
    marginVertical: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  tableHeaderBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#fdf2f8',
    borderBottomWidth: 1,
    borderBottomColor: '#fbcfe8',
  },
  tableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tableBannerTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#9d174d',
  },
  tableScrollHint: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#db2777',
  },
  tableScrollContent: {
    paddingBottom: 2,
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1.5,
    borderBottomColor: '#cbd5e1',
  },
  tableCellHeader: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    justifyContent: 'center',
  },
  tableCellHeaderText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  tableRowTotal: {
    backgroundColor: '#fff1f2',
    borderTopWidth: 1.5,
    borderTopColor: '#fecdd3',
    borderBottomWidth: 1.5,
    borderBottomColor: '#fecdd3',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCell: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
    justifyContent: 'center',
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
  tableCellTotal: {
    borderRightColor: '#fecdd3',
  },
  bodyCellText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#1e293b',
  },
  totalCellText: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '700',
    color: '#9f1239',
  },

  // Code Block
  codeBlockCard: {
    marginVertical: 8,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
  },
  codeBlockHeader: {
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  codeBlockLang: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  codeBlockText: {
    fontFamily: monoFont,
    fontSize: 12,
    color: '#f8fafc',
    lineHeight: 18,
  },

  // Blockquote
  blockquoteCard: {
    marginVertical: 6,
    paddingLeft: 12,
    paddingVertical: 6,
    borderLeftWidth: 3.5,
    borderLeftColor: '#db2777',
    backgroundColor: '#fff5f7',
    borderRadius: 4,
  },
  blockquoteText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#475569',
  },

  // File Download Button Card
  fileDownloadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdf2f8',
    borderWidth: 1.5,
    borderColor: '#fbcfe8',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    gap: 10,
  },
  fileIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fce7f3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileDownloadInfo: {
    flex: 1,
  },
  fileDownloadName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#9d174d',
    marginBottom: 2,
  },
  fileDownloadSub: {
    fontSize: 11,
    color: '#db2777',
  },
});
